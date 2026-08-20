#!/usr/bin/env node
/**
 * Score one or all runtimes on unique golden-set queries.
 *
 *   node eval/run-runtime.js
 *   node eval/run-runtime.js langgraph
 *   npm run eval:runtimes
 */

import { fileURLToPath } from 'node:url'
import { judgeBrief } from '../src/judge.js'
import { RUNTIME_IDS, RUNTIMES } from '../src/runtimes/index.js'
import { loadWorld } from '../src/world.js'
import { loadCatalog } from './run.js'

export function uniqueQueries(catalog) {
  const seen = new Map()
  for (const testCase of catalog.cases) {
    const key = `${testCase.query.airport}|${testCase.query.date}`
    if (!seen.has(key)) seen.set(key, testCase.query)
  }
  return [...seen.values()]
}

export async function runRuntimeEval(catalog, runtimeId, opts = {}) {
  const runner = RUNTIMES[runtimeId]
  if (!runner) {
    throw new Error(`unknown runtime: ${runtimeId}`)
  }
  const world = opts.world ?? loadWorld()
  const queries = uniqueQueries(catalog)
  const rows = []
  let passN = 0

  for (const query of queries) {
    const started = Date.now()
    const brief = await runner(query, world)
    const judged = judgeBrief(query, brief, world)
    if (judged.verdict === 'pass') passN += 1
    rows.push({
      case_id: `${query.airport}-${query.date}`,
      project: catalog.project,
      runtime: runtimeId,
      scores: {
        D2: judged.verdict === 'pass' ? 10 : 0,
        D3: null,
      },
      gate_verdict: judged.verdict,
      findings_n: Array.isArray(brief?.findings) ? brief.findings.length : 0,
      notes: judged.notes,
      duration_ms: Date.now() - started,
    })
  }

  const n = queries.length
  const report = {
    project: catalog.project,
    runtime: runtimeId,
    rubric: catalog.rubric,
    generated_at: opts.now ?? new Date().toISOString(),
    query_n: n,
    split: 'golden-set-queries',
    seed: null,
    model: `${runtimeId}-fixture-tools`,
    metrics: {
      query_pass_rate: n ? passN / n : null,
      query_pass_n: passN,
    },
    cases: rows,
    next: 'Phase 4: unified score table across runtimes.',
  }
  report.ok = n > 0 && passN === n
  return report
}

export async function runAllRuntimeEvals(catalog, opts = {}) {
  const reports = []
  for (const id of RUNTIME_IDS) {
    reports.push(await runRuntimeEval(catalog, id, opts))
  }
  return {
    project: catalog.project,
    generated_at: opts.now ?? new Date().toISOString(),
    runtimes: RUNTIME_IDS,
    reports,
    ok: reports.every((row) => row.ok),
  }
}

async function main() {
  const catalog = loadCatalog()
  const requested = process.argv[2]
  if (requested) {
    const report = await runRuntimeEval(catalog, requested)
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    if (!report.ok) process.exitCode = 1
    return
  }
  const bundle = await runAllRuntimeEvals(catalog)
  process.stdout.write(`${JSON.stringify(bundle, null, 2)}\n`)
  if (!bundle.ok) process.exitCode = 1
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invoked) main()
