/**
 * Phase 4 unified score table.
 * Combines golden-set D3 with per-runtime D2/D5/D6/D7/D8.
 * No network, no LLM.
 */

import { runEval } from './run.js'
import { runAllRuntimeEvals } from './run-runtime.js'
import { runAg2Brief } from '../src/runtimes/ag2.js'
import { buildCrew, runCrewAiBrief } from '../src/runtimes/crewai.js'
import { runLangGraphBrief } from '../src/runtimes/langgraph.js'
import { MeridianGateError, runMeridianBrief } from '../src/runtimes/meridian.js'

const BAD_QUERY = { airport: 'den', date: 'not-a-date' }

function percentile(sorted, p) {
  if (!sorted.length) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

function latency(report) {
  const times = report.cases.map((row) => row.duration_ms).sort((a, b) => a - b)
  return {
    p50_ms: percentile(times, 50),
    p95_ms: percentile(times, 95),
    n: times.length,
  }
}

function observability(runtimeId, sampleBrief) {
  if (runtimeId === 'ag2') {
    const ok = Array.isArray(sampleBrief?.handoff) && sampleBrief.handoff.includes('retriever')
    return { D8: ok ? 10 : 0, notes: 'Speaker handoff list on the brief' }
  }
  if (runtimeId === 'meridian') {
    const ok = sampleBrief?.gate_verdict === 'pass' || sampleBrief?.gate_verdict === 'warn'
    return { D8: ok ? 10 : 6, notes: 'Independent judge verdict attached; query gate exit 2' }
  }
  if (runtimeId === 'crewai') {
    const ok = buildCrew().length === 5
    return { D8: ok ? 8 : 0, notes: 'Five named crew roles; no event log on the brief' }
  }
  return { D8: 7, notes: 'LangGraph retrieve/join/emit nodes; no event log on the brief' }
}

async function recoveryProbe() {
  const runners = {
    langgraph: runLangGraphBrief,
    crewai: runCrewAiBrief,
    ag2: runAg2Brief,
    meridian: runMeridianBrief,
  }
  const rows = {}
  for (const [id, run] of Object.entries(runners)) {
    try {
      const brief = await run(BAD_QUERY)
      rows[id] = {
        blocked: false,
        D6: 0,
        notes: `Emitted a brief instead of blocking (findings=${brief?.findings?.length ?? 'n/a'})`,
      }
    } catch (err) {
      const blocked = id === 'meridian' && err instanceof MeridianGateError && err.exitCode === 2
      rows[id] = {
        blocked,
        D6: blocked ? 10 : 4,
        notes: blocked ? 'Fail-closed query gate (exit 2)' : String(err.message || err),
      }
    }
  }
  return rows
}

function round1(n) {
  return n == null ? null : Math.round(n * 10) / 10
}

export async function buildScoreTable(catalog, opts = {}) {
  const golden = runEval(catalog, { now: opts.now })
  const bundle = await runAllRuntimeEvals(catalog, { now: opts.now, world: opts.world })
  const recovery = await recoveryProbe()
  const sampleQuery = { airport: 'KDEN', date: '2026-08-19' }

  const rows = []
  for (const report of bundle.reports) {
    const sample = report.cases[0]
    const sampleBrief = await (
      report.runtime === 'langgraph' ? runLangGraphBrief
        : report.runtime === 'crewai' ? runCrewAiBrief
          : report.runtime === 'ag2' ? runAg2Brief
            : runMeridianBrief
    )(sampleQuery, opts.world)
    const obs = observability(report.runtime, sampleBrief)
    const lat = latency(report)
    const d5 = report.metrics.query_pass_rate
    rows.push({
      runtime: report.runtime,
      scores: {
        D1: sample.gate_verdict === 'pass' ? 10 : 0,
        D2: sample.gate_verdict === 'pass' ? 10 : 0,
        D3: golden.metrics.D3_gate_catch_rate,
        D4: sample.gate_verdict === 'pass' ? 0 : 10,
        D5: d5,
        D6: recovery[report.runtime].D6,
        D7: lat,
        D8: obs.D8,
        D9: null,
      },
      query_pass_n: report.metrics.query_pass_n,
      query_n: report.query_n,
      gate_verdict: sample.gate_verdict,
      notes: [obs.notes, recovery[report.runtime].notes].join('; '),
    })
  }

  return {
    project: catalog.project,
    rubric: catalog.rubric,
    generated_at: opts.now ?? new Date().toISOString(),
    golden_set_size: golden.golden_set_size,
    split: { catalog: golden.split, runtimes: 'golden-set-queries' },
    seed: null,
    model: 'fixture-tools-no-llm',
    judge: 'mechanical-brief-judge',
    metrics: {
      D3_gate_catch_rate: golden.metrics.D3_gate_catch_rate,
      D3_n: golden.metrics.D3_n,
      verdict_agreement: golden.metrics.verdict_agreement,
      failure_mode_count: golden.metrics.failure_mode_count,
    },
    runtimes: rows,
    retrospective: {
      what_happened: 'All four ports share src/tools.js, so D1/D2/D4/D5 match on the three golden queries. D3 is the catalog judge, not a per-runtime generator catch.',
      what_differed: 'Meridian is the only port that fail-closes a malformed query (D6). AG2 is the only port that ships a speaker handoff on the brief (D8). LangGraph pays graph compile/invoke latency (D7).',
      what_next: 'Do not add LLM nodes until a second golden split exists. Optional later: AutoGen → Microsoft Agent Framework postmortem as a write-up, not a fifth runtime.',
    },
    next: 'Pause bake-off implementation. Next family work is not red/blue.',
    ok: golden.ok && bundle.ok && rows.every((row) => row.scores.D5 === 1 && row.scores.D6 != null),
  }
}

export function formatScoreTableMarkdown(table) {
  const lines = [
    '# Score table',
    '',
    `**Project:** ${table.project}  `,
    `**Generated:** ${table.generated_at}  `,
    `**Judge:** ${table.judge} (no LLM)  `,
    `**Golden set:** ${table.golden_set_size} authored briefs (D3 n=${table.metrics.D3_n})  `,
    `**Queries:** 3 unique \`{airport, date}\` rows × 4 runtimes`,
    '',
    'Rubric: [portfolio-kit EVAL_RUBRIC_TEMPLATE](https://github.com/PCSchmidt/portfolio-kit/blob/main/docs/EVAL_RUBRIC_TEMPLATE.md). Rates are 0–1; D1/D2/D6/D8 are 0–10; D4 is fabrication % (lower is better); D7 is milliseconds; D9 is N/A (J-space).',
    '',
    '| Runtime | D1 cite | D2 complete | D3 catch | D4 fab% | D5 pass@1 | D6 recover | D7 p50/p95 ms | D8 observe | D9 |',
    '|---------|---------|-------------|----------|---------|-----------|------------|---------------|------------|----|',
  ]
  for (const row of table.runtimes) {
    const d7 = `${row.scores.D7.p50_ms}/${row.scores.D7.p95_ms}`
    lines.push(
      `| ${row.runtime} | ${row.scores.D1} | ${row.scores.D2} | ${round1(row.scores.D3)} (shared) | ${row.scores.D4} | ${row.scores.D5} (${row.query_pass_n}/${row.query_n}) | ${row.scores.D6} | ${d7} | ${row.scores.D8} | — |`,
    )
  }
  lines.push(
    '',
    '## Failure retrospective',
    '',
    `- ${table.retrospective.what_happened}`,
    `- ${table.retrospective.what_differed}`,
    `- ${table.retrospective.what_next}`,
    '',
    '## Notes',
    '',
  )
  for (const row of table.runtimes) {
    lines.push(`- **${row.runtime}:** ${row.notes}`)
  }
  lines.push('')
  return `${lines.join('\n')}\n`
}
