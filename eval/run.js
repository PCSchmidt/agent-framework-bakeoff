#!/usr/bin/env node
/**
 * Phase 1 golden-set harness.
 * Scores D3 gate-catch and verdict agreement on authored briefs.
 * No network, no agent runtime, no API keys.
 *
 *   node eval/run.js
 *   npm run eval
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { judgeBrief } from '../src/judge.js'
import { loadWorld } from '../src/world.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_CASES = join(HERE, 'cases.json')

function verdictMatches(expected, actual) {
  return Array.isArray(expected) ? expected.includes(actual) : expected === actual
}

export function runEval(catalog, opts = {}) {
  const world = opts.world ?? loadWorld()
  const rows = []
  let catchHits = 0
  let catchN = 0
  let agreementHits = 0
  const modes = new Set()

  for (const testCase of catalog.cases) {
    const started = Date.now()
    const judged = judgeBrief(testCase.query, testCase.brief, world)
    const agreed = verdictMatches(testCase.expect_verdict, judged.verdict)
    if (agreed) agreementHits += 1
    if (testCase.kind === 'bad') {
      catchN += 1
      const caught = judged.verdict === 'fail' || judged.verdict === 'warn'
      if (caught) catchHits += 1
    }
    if (testCase.failure_mode) modes.add(testCase.failure_mode)
    const caughtBad = testCase.kind === 'bad' && (judged.verdict === 'fail' || judged.verdict === 'warn')
    rows.push({
      case_id: testCase.case_id,
      project: catalog.project,
      runtime: catalog.runtime,
      scores: {
        D3: testCase.kind === 'bad' ? (caughtBad ? 10 : 0) : null,
      },
      gate_verdict: judged.verdict,
      expected: testCase.expect_verdict,
      agreed,
      failure_mode: testCase.failure_mode,
      notes: judged.notes,
      duration_ms: Date.now() - started,
    })
  }

  const n = catalog.cases.length
  const report = {
    project: catalog.project,
    runtime: catalog.runtime,
    rubric: catalog.rubric,
    generated_at: opts.now ?? new Date().toISOString(),
    golden_set_size: n,
    split: catalog.split ?? 'held-out-fixtures',
    seed: null,
    model: 'mechanical-brief-judge',
    metrics: {
      D3_gate_catch_rate: catchN ? catchHits / catchN : null,
      D3_n: catchN,
      verdict_agreement: n ? agreementHits / n : null,
      good_n: n - catchN,
      failure_mode_count: modes.size,
    },
    target_gate_catch: catalog.target_gate_catch ?? 0.85,
    cases: rows,
    next: 'Phase 4 unified table is `npm run eval:table`.',
  }
  report.ok = (report.metrics.D3_gate_catch_rate ?? 0) >= report.target_gate_catch
    && report.metrics.verdict_agreement === 1
    && n >= 30
    && n <= 50
  return report
}

export function loadCatalog(path = DEFAULT_CASES) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function main() {
  const report = runEval(loadCatalog())
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (!report.ok) {
    process.stderr.write(
      `eval failed: catch=${report.metrics.D3_gate_catch_rate} agreement=${report.metrics.verdict_agreement} n=${report.golden_set_size}\n`,
    )
    process.exitCode = 1
  }
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invoked) main()
