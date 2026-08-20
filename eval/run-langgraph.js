#!/usr/bin/env node
/**
 * Phase 2: run the LangGraph baseline on unique golden-set queries
 * and score briefs with the mechanical judge.
 *
 *   node eval/run-langgraph.js
 *   npm run eval:langgraph
 */

import { fileURLToPath } from 'node:url'
import { judgeBrief } from '../src/judge.js'
import { runLangGraphBrief } from '../src/runtimes/langgraph.js'
import { loadWorld } from '../src/world.js'
import { loadCatalog } from './run.js'

function uniqueQueries(catalog) {
  const seen = new Map()
  for (const testCase of catalog.cases) {
    const key = `${testCase.query.airport}|${testCase.query.date}`
    if (!seen.has(key)) seen.set(key, testCase.query)
  }
  return [...seen.values()]
}

export async function runLangGraphEval(catalog, opts = {}) {
  const world = opts.world ?? loadWorld()
  const queries = uniqueQueries(catalog)
  const rows = []
  let passN = 0

  for (const query of queries) {
    const started = Date.now()
    const brief = await runLangGraphBrief(query, world)
    const judged = judgeBrief(query, brief, world)
    if (judged.verdict === 'pass') passN += 1
    rows.push({
      case_id: `${query.airport}-${query.date}`,
      project: catalog.project,
      runtime: 'langgraph',
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
    runtime: 'langgraph',
    rubric: catalog.rubric,
    generated_at: opts.now ?? new Date().toISOString(),
    query_n: n,
    split: 'golden-set-queries',
    seed: null,
    model: 'langgraph-fixture-tools',
    metrics: {
      query_pass_rate: n ? passN / n : null,
      query_pass_n: passN,
    },
    cases: rows,
    next: 'Phase 3: CrewAI / AG2 / Meridian ports using the same src/tools.js.',
  }
  report.ok = n > 0 && passN === n
  return report
}

async function main() {
  const report = await runLangGraphEval(loadCatalog())
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (!report.ok) {
    process.stderr.write(
      `langgraph eval failed: pass=${report.metrics.query_pass_n}/${report.query_n}\n`,
    )
    process.exitCode = 1
  }
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invoked) main()
