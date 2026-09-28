#!/usr/bin/env node
/**
 * Phase 5: LLM-written briefs on all four runtimes.
 *
 * Paired design: for each (model, query, sample) the first draft is one
 * recorded completion shared by every runtime. LangGraph, CrewAI, and AG2
 * ship that draft. Meridian judges it, sends issues back for up to
 * `max_retries` revisions, and fail-closes if the brief still fails.
 *
 *   npm run eval:llm                                  # replay recordings (no key, CI)
 *   npm run eval:llm -- --mode record                 # call OpenRouter for missing recordings
 *   npm run eval:llm -- --mode record --models deepseek/deepseek-v4-flash --samples 1
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { judgeBrief } from '../src/judge.js'
import { createLlmWriter, PROMPT_VERSION } from '../src/llm-writer.js'
import { MeridianGateError } from '../src/runtimes/meridian.js'
import { RUNTIME_IDS, RUNTIMES } from '../src/runtimes/index.js'
import { gatherEvidence } from '../src/tools.js'
import { loadWorld } from '../src/world.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const UNGATED = RUNTIME_IDS.filter((id) => id !== 'meridian')

export function loadLlmConfig(path = join(HERE, 'llm.config.json')) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/**
 * Share of ground-truth overlap pairs the brief reports. When a query has no
 * overlaps, share of retrieved records the brief cites (rule 5 of the prompt).
 */
export function coverage(brief, evidence) {
  if (!brief || typeof brief !== 'object' || !Array.isArray(brief.findings)) return null
  const truthPairs = new Set(evidence.pairs.map((p) => `${p.notam.id}|${p.timed.id}`))
  const cited = brief.findings.flatMap((f) => (Array.isArray(f?.citations) ? [f.citations] : []))
  if (truthPairs.size > 0) {
    const found = new Set()
    for (const ids of cited) {
      for (const a of ids) {
        for (const b of ids) {
          if (truthPairs.has(`${a}|${b}`)) found.add(`${a}|${b}`)
        }
      }
    }
    return found.size / truthPairs.size
  }
  const truth = new Set([...evidence.notams, ...evidence.tracks, ...evidence.passes].map((r) => r.id))
  if (truth.size === 0) return null
  const found = new Set(cited.flat().filter((id) => truth.has(id)))
  return found.size / truth.size
}

function comparable(brief) {
  if (!brief || typeof brief !== 'object') return JSON.stringify(brief)
  const { runtime, handoff, gate_verdict, gate_attempts, ...rest } = brief
  return JSON.stringify(rest)
}

async function runOne({ model, runtime, query, sample, config, mode, world, evidence }) {
  const calls = []
  const writer = createLlmWriter({
    model,
    sample,
    temperature: config.temperature,
    mode,
    onCall: (entry) => calls.push(entry),
  })
  let brief = null
  let delivered = true
  let attempts
  try {
    brief = await RUNTIMES[runtime](query, world, {
      writer,
      maxRetries: runtime === 'meridian' ? config.max_retries : 0,
    })
    attempts = brief?.gate_attempts
  } catch (err) {
    if (!(err instanceof MeridianGateError)) throw err
    delivered = false
    attempts = err.attempts
  }
  const judged = delivered ? judgeBrief(query, brief, world) : null
  const draft = attempts?.[0] ?? { verdict: judged.verdict, issues: judged.issues.map((i) => i.code) }
  return {
    row: {
      model,
      runtime,
      airport: query.airport,
      date: query.date,
      sample,
      delivered,
      verdict: judged?.verdict ?? 'blocked',
      issues: judged ? judged.issues.map((i) => i.code) : attempts.at(-1).issues,
      draft_verdict: draft.verdict,
      draft_issues: draft.issues,
      attempts_n: attempts?.length ?? 1,
      coverage: delivered ? coverage(brief, evidence) : null,
      calls_n: calls.length,
      cost_usd: calls.reduce((sum, c) => sum + (c.usage?.cost ?? 0), 0),
      tokens_in: calls.reduce((sum, c) => sum + (c.usage?.prompt_tokens ?? 0), 0),
      tokens_out: calls.reduce((sum, c) => sum + (c.usage?.completion_tokens ?? 0), 0),
      llm_ms: calls.reduce((sum, c) => sum + (c.latency_ms ?? 0), 0),
    },
    brief,
  }
}

async function runTask(task, ctx) {
  const evidence = gatherEvidence(ctx.world, task.query)
  const rows = []
  const ungatedBriefs = []
  // Ungated first: the first runtime records the shared draft, the rest replay it.
  for (const runtime of [...UNGATED, 'meridian']) {
    const { row, brief } = await runOne({ ...task, runtime, ...ctx, evidence })
    rows.push(row)
    if (runtime !== 'meridian') ungatedBriefs.push(comparable(brief))
  }
  const identical = ungatedBriefs.every((b) => b === ungatedBriefs[0])
  for (const row of rows) row.ungated_identical = identical
  return rows
}

async function pool(items, limit, worker) {
  const results = []
  let next = 0
  async function lane() {
    while (next < items.length) {
      const i = next
      next += 1
      results[i] = await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
  return results
}

/** Wilson score interval for a binomial proportion. */
export function wilson(k, n, z = 1.96) {
  if (!n) return [null, null]
  const p = k / n
  const denom = 1 + (z * z) / n
  const centre = (p + (z * z) / (2 * n)) / denom
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom
  return [Math.max(0, centre - half), Math.min(1, centre + half)]
}

function mean(values) {
  const xs = values.filter((v) => v != null)
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

export function summarize(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = `${row.model}|${row.runtime}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const summary = []
  for (const [key, group] of groups) {
    const [model, runtime] = key.split('|')
    const n = group.length
    const draftPass = group.filter((r) => r.draft_verdict !== 'fail').length
    const clean = group.filter((r) => r.delivered && r.verdict !== 'fail')
    const bad = group.filter((r) => r.delivered && r.verdict === 'fail').length
    const blocked = group.filter((r) => !r.delivered).length
    summary.push({
      model,
      runtime,
      n,
      draft_pass_rate: draftPass / n,
      shipped_clean_rate: clean.length / n,
      shipped_clean_ci: wilson(clean.length, n),
      shipped_bad_rate: bad / n,
      shipped_bad_ci: wilson(bad, n),
      blocked_rate: blocked / n,
      coverage_clean: mean(clean.map((r) => r.coverage)),
      calls_per_run: mean(group.map((r) => r.calls_n)),
      cost_per_run_usd: mean(group.map((r) => r.cost_usd)),
      llm_ms_per_run: mean(group.map((r) => r.llm_ms)),
    })
  }
  return summary
}

export function failureModes(rows) {
  const byModel = {}
  for (const row of rows.filter((r) => r.runtime === UNGATED[0])) {
    byModel[row.model] ??= {}
    for (const code of new Set(row.draft_issues)) {
      byModel[row.model][code] = (byModel[row.model][code] ?? 0) + 1
    }
  }
  return byModel
}

export async function runLlmEval(config, opts = {}) {
  const world = opts.world ?? loadWorld()
  const mode = opts.mode ?? 'replay'
  const tasks = []
  for (const model of config.models) {
    for (const query of config.queries) {
      for (let sample = 0; sample < config.samples; sample += 1) {
        tasks.push({ model, query, sample, config })
      }
    }
  }
  let done = 0
  const nested = await pool(tasks, opts.concurrency ?? 6, async (task) => {
    const rows = await runTask(task, { world, mode })
    done += 1
    opts.onProgress?.(done, tasks.length, task)
    return rows
  })
  const rows = nested.flat()
  return {
    project: 'agent-framework-bakeoff',
    phase: 5,
    generated_at: opts.now ?? new Date().toISOString(),
    prompt_version: PROMPT_VERSION,
    config: { ...config },
    judge: 'mechanical-brief-judge (no LLM)',
    ungated_runtimes_identical: rows.every((r) => r.ungated_identical),
    summary: summarize(rows),
    failure_modes: failureModes(rows),
    rows,
  }
}

function pct(x) {
  return x == null ? '—' : `${Math.round(x * 100)}%`
}

function ci([lo, hi]) {
  return lo == null ? '' : ` (${Math.round(lo * 100)}–${Math.round(hi * 100)})`
}

export function formatLlmMarkdown(report) {
  const lines = [
    '# LLM score table (Phase 5)',
    '',
    `**Generated:** ${report.generated_at}  `,
    `**Judge / gate:** ${report.judge}  `,
    `**Prompt:** \`${report.prompt_version}\` · temperature ${report.config.temperature} · ${report.config.samples} samples × ${report.config.queries.length} queries per model · Meridian max retries ${report.config.max_retries}`,
    '',
    'Paired design: each (model, query, sample) has one recorded first draft shared by all four runtimes. LangGraph, CrewAI, and AG2 ship it. Meridian judges it, returns the issues for revision, and blocks the brief if it still fails.',
    '',
    `Ungated runtimes shipped byte-identical briefs on every run: **${report.ungated_runtimes_identical ? 'yes' : 'no'}**. ${report.ungated_runtimes_identical ? 'They are shown as one row.' : ''}`,
    '',
    '| Model | Runtime | n | Draft pass | Shipped clean (95% CI) | Shipped bad (95% CI) | Blocked | Coverage of clean | LLM calls / run | Cost / run |',
    '|-------|---------|---|-----------:|-----------------------:|---------------------:|--------:|------------------:|----------------:|-----------:|',
  ]
  for (const model of report.config.models) {
    const rows = report.summary.filter((s) => s.model === model)
    const shown = report.ungated_runtimes_identical
      ? [{ ...rows.find((s) => s.runtime === UNGATED[0]), runtime: UNGATED.join(' / ') }, rows.find((s) => s.runtime === 'meridian')]
      : rows
    for (const s of shown) {
      lines.push(`| ${model} | ${s.runtime} | ${s.n} | ${pct(s.draft_pass_rate)} | ${pct(s.shipped_clean_rate)}${ci(s.shipped_clean_ci)} | ${pct(s.shipped_bad_rate)}${ci(s.shipped_bad_ci)} | ${pct(s.blocked_rate)} | ${pct(s.coverage_clean)} | ${s.calls_per_run.toFixed(2)} | $${s.cost_per_run_usd.toFixed(5)} |`)
    }
  }
  lines.push(
    '',
    '- **Draft pass:** first draft passes the mechanical judge.',
    '- **Shipped clean / bad:** a brief reached the user and passes / fails the judge.',
    '- **Blocked:** Meridian refused to deliver after all revisions failed.',
    '- **Coverage of clean:** share of ground-truth overlap pairs (from the deterministic join) that clean briefs report. The judge does not check completeness, so this measures what the gate cannot see.',
    '',
    '## First-draft failure modes',
    '',
    'Runs whose first draft had each issue (a run can have several).',
    '',
  )
  const codes = [...new Set(Object.values(report.failure_modes).flatMap((m) => Object.keys(m)))].sort()
  if (codes.length) {
    lines.push(`| Model | ${codes.join(' | ')} |`, `|-------|${codes.map(() => '---:').join('|')}|`)
    for (const model of report.config.models) {
      const m = report.failure_modes[model] ?? {}
      lines.push(`| ${model} | ${codes.map((c) => m[c] ?? 0).join(' | ')} |`)
    }
  } else {
    lines.push('No first-draft failures.')
  }
  lines.push('')
  return `${lines.join('\n')}\n`
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a.startsWith('--')) args[a.slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] == null ? true : argv[(i += 1)]
  }
  return args
}

async function main() {
  const envFile = join(ROOT, '.env')
  if (existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile)
  const args = parseArgs(process.argv.slice(2))
  const config = loadLlmConfig()
  if (args.models) config.models = String(args.models).split(',')
  if (args.samples) config.samples = Number(args.samples)
  if (args.queries) config.queries = config.queries.slice(0, Number(args.queries))
  const mode = args.mode ?? 'replay'
  const report = await runLlmEval(config, {
    mode,
    concurrency: args.concurrency ? Number(args.concurrency) : 6,
    now: args.now,
    onProgress: (done, total, task) => {
      if (mode !== 'replay') process.stderr.write(`[${done}/${total}] ${task.model} ${task.query.airport} ${task.query.date} s${task.sample}\n`)
    },
  })
  const markdown = formatLlmMarkdown(report)
  if (!args['no-write']) {
    mkdirSync(join(HERE, 'results'), { recursive: true })
    writeFileSync(join(HERE, 'results', 'llm-results.json'), `${JSON.stringify(report, null, 2)}\n`)
    writeFileSync(join(HERE, 'LLM_SCORE_TABLE.md'), markdown)
  }
  process.stdout.write(markdown)
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invoked) {
  main().catch((err) => {
    process.stderr.write(`${err.stack || err}\n`)
    process.exitCode = 1
  })
}
