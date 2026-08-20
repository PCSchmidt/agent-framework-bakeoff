import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadCatalog, runEval } from '../eval/run.js'
import { runLangGraphEval } from '../eval/run-langgraph.js'
import { judgeBrief } from '../src/judge.js'
import { runLangGraphBrief } from '../src/runtimes/langgraph.js'
import { retrieveAdsb, retrieveNotams } from '../src/tools.js'
import { loadWorld } from '../src/world.js'

test('Phase 1 golden catalog still agrees with the mechanical judge', () => {
  const report = runEval(loadCatalog(), { now: '2026-08-20T18:00:00.000Z' })
  assert.equal(report.ok, true)
})

test('LangGraph brief for KDEN 2026-08-19 is judge-pass JSON', async () => {
  const world = loadWorld()
  const query = { airport: 'KDEN', date: '2026-08-19' }
  const brief = await runLangGraphBrief(query, world)
  assert.equal(brief.airport, 'KDEN')
  assert.equal(brief.date, '2026-08-19')
  assert.ok(Array.isArray(brief.findings) && brief.findings.length > 0)
  for (const finding of brief.findings) {
    assert.ok(finding.id)
    assert.equal(typeof finding.confidence, 'number')
    assert.ok(finding.citations.length >= 1)
    for (const cite of finding.citations) {
      assert.ok(world.byId.has(cite))
    }
  }
  assert.equal(judgeBrief(query, brief, world).verdict, 'pass')
})

test('retrieve tools stay inside airport and date', () => {
  const world = loadWorld()
  const query = { airport: 'KJFK', date: '2026-08-19' }
  for (const row of retrieveAdsb(world, query)) {
    assert.equal(row.airport, 'KJFK')
    assert.equal(row.time.slice(0, 10), '2026-08-19')
  }
  for (const row of retrieveNotams(world, query)) {
    assert.equal(row.location, 'KJFK')
  }
})

test('LangGraph eval passes every unique golden-set query', async () => {
  const report = await runLangGraphEval(loadCatalog(), { now: '2026-08-20T18:00:00.000Z' })
  assert.equal(report.runtime, 'langgraph')
  assert.ok(report.query_n >= 2)
  assert.equal(report.ok, true)
})
