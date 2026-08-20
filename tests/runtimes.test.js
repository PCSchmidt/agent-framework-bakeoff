import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadCatalog } from '../eval/run.js'
import { runAllRuntimeEvals, runRuntimeEval } from '../eval/run-runtime.js'
import { judgeBrief } from '../src/judge.js'
import { runAg2Brief } from '../src/runtimes/ag2.js'
import { buildCrew, runCrewAiBrief } from '../src/runtimes/crewai.js'
import { RUNTIME_IDS } from '../src/runtimes/index.js'
import { MeridianGateError, runMeridianBrief } from '../src/runtimes/meridian.js'
import { loadWorld } from '../src/world.js'

const QUERY = { airport: 'KDEN', date: '2026-08-19' }

test('CrewAI sequential crew calls the five named roles', () => {
  const roles = buildCrew().map((row) => row.role)
  assert.deepEqual(roles, [
    'adsb_scout',
    'notam_scout',
    'tle_scout',
    'overlap_analyst',
    'brief_writer',
  ])
})

test('CrewAI, AG2, and Meridian briefs pass the judge on KDEN 2026-08-19', async () => {
  const world = loadWorld()
  for (const [id, brief] of [
    ['crewai', await runCrewAiBrief(QUERY, world)],
    ['ag2', await runAg2Brief(QUERY, world)],
    ['meridian', await runMeridianBrief(QUERY, world)],
  ]) {
    assert.equal(brief.runtime, id)
    assert.equal(brief.airport, QUERY.airport)
    assert.ok(brief.findings.length > 0)
    assert.equal(judgeBrief(QUERY, brief, world).verdict, 'pass')
  }
})

test('AG2 records speaker handoff', async () => {
  const brief = await runAg2Brief(QUERY)
  assert.deepEqual(brief.handoff, ['user', 'retriever', 'analyst', 'writer'])
})

test('Meridian gate exits 2 on a bad ICAO', async () => {
  await assert.rejects(
    () => runMeridianBrief({ airport: 'den', date: '2026-08-19' }),
    (err) => err instanceof MeridianGateError && err.exitCode === 2,
  )
})

test('all four runtimes pass every unique golden-set query', async () => {
  const catalog = loadCatalog()
  assert.deepEqual(RUNTIME_IDS, ['langgraph', 'crewai', 'ag2', 'meridian'])
  const bundle = await runAllRuntimeEvals(catalog, { now: '2026-08-20T20:00:00.000Z' })
  assert.equal(bundle.ok, true)
  for (const report of bundle.reports) {
    assert.equal(report.ok, true)
    assert.ok(report.query_n >= 2)
  }
})

test('runtime eval fails for an unknown runtime id', async () => {
  await assert.rejects(() => runRuntimeEval(loadCatalog(), 'autogen'))
})
