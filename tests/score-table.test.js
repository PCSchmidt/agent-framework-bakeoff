import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadCatalog } from '../eval/run.js'
import { writeScoreTable } from '../eval/run-score-table.js'
import { buildScoreTable, formatScoreTableMarkdown } from '../eval/score-table.js'

test('unified table has four runtimes and shared D3', async () => {
  const table = await buildScoreTable(loadCatalog(), { now: '2026-08-21T12:00:00.000Z' })
  assert.equal(table.ok, true)
  assert.equal(table.runtimes.length, 4)
  assert.equal(table.metrics.D3_gate_catch_rate, 1)
  assert.equal(table.metrics.verdict_agreement, 1)
  for (const row of table.runtimes) {
    assert.equal(row.scores.D5, 1)
    assert.equal(row.scores.D3, 1)
    assert.equal(row.scores.D9, null)
    assert.ok(row.scores.D7.p50_ms != null)
  }
})

test('Meridian is the only runtime that fail-closes a bad query', async () => {
  const table = await buildScoreTable(loadCatalog(), { now: '2026-08-21T12:00:00.000Z' })
  const byId = Object.fromEntries(table.runtimes.map((row) => [row.runtime, row]))
  assert.equal(byId.meridian.scores.D6, 10)
  assert.equal(byId.langgraph.scores.D6, 0)
  assert.equal(byId.crewai.scores.D6, 0)
  assert.equal(byId.ag2.scores.D6, 0)
  assert.ok(byId.ag2.scores.D8 >= byId.langgraph.scores.D8)
})

test('markdown table includes all runtime names and retrospective', async () => {
  const table = await buildScoreTable(loadCatalog(), { now: '2026-08-21T12:00:00.000Z' })
  const md = formatScoreTableMarkdown(table)
  assert.match(md, /\| langgraph \|/)
  assert.match(md, /\| crewai \|/)
  assert.match(md, /\| ag2 \|/)
  assert.match(md, /\| meridian \|/)
  assert.match(md, /Failure retrospective/)
  const dir = mkdtempSync(join(tmpdir(), 'bakeoff-table-'))
  const path = join(dir, 'SCORE_TABLE.md')
  await writeScoreTable({ now: '2026-08-21T12:00:00.000Z', markdownPath: path })
  assert.match(readFileSync(path, 'utf8'), /Score table/)
})
