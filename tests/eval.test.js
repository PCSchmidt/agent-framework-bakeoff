import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadCatalog, runEval } from '../eval/run.js'
import { judgeBrief } from '../src/judge.js'
import { loadWorld } from '../src/world.js'

test('golden set is 30–50 cases with both good and bad rows', () => {
  const catalog = loadCatalog()
  assert.ok(catalog.cases.length >= 30)
  assert.ok(catalog.cases.length <= 50)
  assert.ok(catalog.cases.some((c) => c.kind === 'good'))
  assert.ok(catalog.cases.some((c) => c.kind === 'bad'))
  assert.equal(catalog.cases[0].case_id, 'AIR-001')
})

test('held-out eval meets gate-catch target and full agreement', () => {
  const report = runEval(loadCatalog(), { now: '2026-08-20T12:00:00.000Z' })
  assert.equal(report.metrics.verdict_agreement, 1)
  assert.ok(report.metrics.D3_gate_catch_rate >= report.target_gate_catch)
  assert.equal(report.ok, true)
})

test('eval fails when a known-bad case is mislabeled as pass', () => {
  const catalog = loadCatalog()
  const broken = {
    ...catalog,
    cases: catalog.cases.map((item) => (
      item.case_id === 'AIR-013'
        ? { ...item, expect_verdict: 'pass' }
        : item
    )),
  }
  const report = runEval(broken)
  assert.equal(report.ok, false)
  assert.ok(report.metrics.verdict_agreement < 1)
})

test('judge blocks fabricated citations and extra entities', () => {
  const world = loadWorld()
  const query = { airport: 'KDEN', date: '2026-08-19' }
  const fabricated = judgeBrief(query, {
    airport: 'KDEN',
    date: '2026-08-19',
    findings: [{ id: 'F1', summary: 'x', confidence: 0.9, citations: ['NOTAM-999'] }],
  }, world)
  assert.equal(fabricated.verdict, 'fail')
  const extra = judgeBrief(query, {
    airport: 'KDEN',
    date: '2026-08-19',
    findings: [{
      id: 'F1',
      summary: 'F-35 overlay',
      confidence: 0.9,
      citations: ['ADSB-001', 'NOTAM-001'],
    }],
  }, world)
  assert.equal(extra.verdict, 'fail')
})

test('world loader indexes fixture ids', () => {
  const world = loadWorld()
  assert.equal(world.byId.get('ADSB-001').kind, 'adsb')
  assert.equal(world.byId.get('NOTAM-004').location, 'KJFK')
  assert.equal(world.byId.get('TLE-ISS-001').over, 'KDEN')
})
