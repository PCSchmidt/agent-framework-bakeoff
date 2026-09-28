import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { coverage, summarize, wilson } from '../eval/run-llm.js'
import { judgeBrief } from '../src/judge.js'
import { buildMessages, createLlmWriter, parseBrief } from '../src/llm-writer.js'
import { RUNTIMES } from '../src/runtimes/index.js'
import { MeridianGateError, runMeridianBrief } from '../src/runtimes/meridian.js'
import { gatherEvidence } from '../src/tools.js'
import { loadWorld } from '../src/world.js'

const QUERY = { airport: 'KDEN', date: '2026-08-19' }
const GOOD = {
  airport: 'KDEN',
  date: '2026-08-19',
  findings: [{ id: 'F1', summary: 'UAL123 during RWY 16L/34R closure', confidence: 0.8, citations: ['ADSB-001', 'NOTAM-001'] }],
}
const BAD = { ...GOOD, findings: [{ ...GOOD.findings[0], citations: ['ADSB-999', 'NOTAM-001'] }] }

function fakeFetch(contents) {
  const calls = []
  const impl = async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push(body)
    const content = contents[Math.min(calls.length - 1, contents.length - 1)]
    return new Response(JSON.stringify({
      model: body.model,
      provider: 'fake',
      choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.001 },
    }), { status: 200 })
  }
  return { impl, calls }
}

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'bakeoff-llm-'))
}

test('prompt gives records but not the precomputed overlap pairs', () => {
  const evidence = gatherEvidence(loadWorld(), QUERY)
  const user = buildMessages(QUERY, evidence)[1].content
  assert.match(user, /NOTAM-001/)
  assert.match(user, /ADSB-001/)
  assert.doesNotMatch(user, /"pairs"|"pair_n"/)
})

test('parseBrief handles fenced JSON and returns raw text on garbage', () => {
  assert.deepEqual(parseBrief('```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(parseBrief('Here you go: {"a":1} done'), { a: 1 })
  assert.equal(parseBrief('no json here'), 'no json here')
  assert.equal(judgeBrief(QUERY, parseBrief('no json here'), loadWorld()).verdict, 'fail')
})

test('record mode saves a recording and replay mode reuses it without the network', async () => {
  const dir = tempDir()
  const { impl, calls } = fakeFetch([GOOD])
  const recorder = createLlmWriter({ model: 'fake/model', mode: 'record', recordingsDir: dir, apiKey: 'k', fetchImpl: impl })
  const evidence = gatherEvidence(loadWorld(), QUERY)
  const first = await recorder(QUERY, evidence, { runtime: 'langgraph', attempt: 1 })
  assert.equal(first.runtime, 'langgraph')
  assert.equal(calls.length, 1)
  assert.equal(readdirSync(join(dir, 'fake__model')).length, 1)

  const replayer = createLlmWriter({
    model: 'fake/model',
    mode: 'replay',
    recordingsDir: dir,
    fetchImpl: () => { throw new Error('network used in replay') },
  })
  const again = await replayer(QUERY, evidence, { runtime: 'crewai', attempt: 1 })
  assert.deepEqual({ ...again, runtime: null }, { ...first, runtime: null })
})

test('replay mode fails loudly on a missing recording', async () => {
  const writer = createLlmWriter({ model: 'fake/model', mode: 'replay', recordingsDir: tempDir() })
  await assert.rejects(
    () => writer(QUERY, gatherEvidence(loadWorld(), QUERY), { runtime: 'ag2', attempt: 1 }),
    /No recording/,
  )
})

test('different samples get different recordings', async () => {
  const dir = tempDir()
  const { impl } = fakeFetch([GOOD])
  const evidence = gatherEvidence(loadWorld(), QUERY)
  for (const sample of [0, 1]) {
    const writer = createLlmWriter({ model: 'fake/model', sample, mode: 'record', recordingsDir: dir, apiKey: 'k', fetchImpl: impl })
    await writer(QUERY, evidence, { runtime: 'langgraph', attempt: 1 })
  }
  assert.equal(readdirSync(join(dir, 'fake__model')).length, 2)
})

test('ungated runtimes ship a bad LLM draft as-is', async () => {
  const world = loadWorld()
  for (const id of ['langgraph', 'crewai', 'ag2']) {
    const { impl } = fakeFetch([BAD])
    const writer = createLlmWriter({ model: 'fake/model', mode: 'live', apiKey: 'k', fetchImpl: impl })
    const brief = await RUNTIMES[id](QUERY, world, { writer })
    assert.equal(brief.runtime, id)
    assert.equal(judgeBrief(QUERY, brief, world).verdict, 'fail')
  }
})

test('Meridian revises a rejected draft with the judge issues and delivers the fix', async () => {
  const { impl, calls } = fakeFetch([BAD, GOOD])
  const writer = createLlmWriter({ model: 'fake/model', mode: 'live', apiKey: 'k', fetchImpl: impl })
  const brief = await runMeridianBrief(QUERY, loadWorld(), { writer, maxRetries: 2 })
  assert.equal(brief.gate_verdict, 'pass')
  assert.deepEqual(brief.gate_attempts.map((a) => a.verdict), ['fail', 'pass'])
  assert.equal(calls.length, 2)
  const feedback = calls[1].messages.at(-1).content
  assert.match(feedback, /fabricated_citation/)
})

test('Meridian blocks when every revision still fails', async () => {
  const { impl, calls } = fakeFetch([BAD])
  const writer = createLlmWriter({ model: 'fake/model', mode: 'live', apiKey: 'k', fetchImpl: impl })
  await assert.rejects(
    () => runMeridianBrief(QUERY, loadWorld(), { writer, maxRetries: 2 }),
    (err) => err instanceof MeridianGateError && err.exitCode === 2 && err.attempts.length === 3,
  )
  assert.equal(calls.length, 3)
  // The third attempt carries both rejected drafts, so it is a distinct request.
  assert.equal(calls[2].messages.length, 6)
})

test('judge flags a summary that names an uncited aircraft', () => {
  const brief = { ...GOOD, findings: [{ ...GOOD.findings[0], summary: 'UAL123 and SWA456 during RWY 16L/34R closure' }] }
  const judged = judgeBrief(QUERY, brief, loadWorld())
  assert.equal(judged.verdict, 'fail')
  assert.ok(judged.issues.some((i) => i.code === 'unsupported_claim'))
})

test('judge checks every cited NOTAM against every cited track', () => {
  const world = loadWorld()
  const query = { airport: 'KSEA', date: '2026-08-22' }
  const brief = {
    airport: 'KSEA',
    date: '2026-08-22',
    // ADSB-020 (17:55) overlaps the all-day crane NOTAM-012 but not NOTAM-013 (18:00–19:30).
    findings: [{ id: 'F1', summary: 'ASA402 during crane and runway notices', confidence: 0.7, citations: ['NOTAM-012', 'NOTAM-013', 'ADSB-020'] }],
  }
  const judged = judgeBrief(query, brief, world)
  assert.ok(judged.issues.some((i) => i.code === 'no_overlap' && /NOTAM-013/.test(i.message)))
})

test('coverage scores pair recall, and record recall when there are no pairs', () => {
  const world = loadWorld()
  const evidence = gatherEvidence(world, QUERY)
  assert.equal(coverage(GOOD, evidence), 1 / evidence.pairs.length)
  const bos = { airport: 'KBOS', date: '2026-08-23' }
  const bosEvidence = gatherEvidence(world, bos)
  assert.equal(bosEvidence.pairs.length, 0)
  const solo = { findings: [{ id: 'F1', summary: 'x', confidence: 0.5, citations: ['NOTAM-018'] }] }
  assert.equal(coverage(solo, bosEvidence), 1 / 3)
  assert.equal(coverage('not a brief', evidence), null)
})

test('summary splits clean, bad, and blocked; wilson bounds are sane', () => {
  const base = { model: 'm', draft_issues: [], calls_n: 1, cost_usd: 0, llm_ms: 0, coverage: 1 }
  const rows = [
    { ...base, runtime: 'langgraph', delivered: true, verdict: 'pass', draft_verdict: 'pass' },
    { ...base, runtime: 'langgraph', delivered: true, verdict: 'fail', draft_verdict: 'fail' },
    { ...base, runtime: 'meridian', delivered: true, verdict: 'pass', draft_verdict: 'pass' },
    { ...base, runtime: 'meridian', delivered: false, verdict: 'blocked', draft_verdict: 'fail' },
  ]
  const [lg, md] = summarize(rows)
  assert.equal(lg.shipped_bad_rate, 0.5)
  assert.equal(md.shipped_bad_rate, 0)
  assert.equal(md.blocked_rate, 0.5)
  const [lo, hi] = wilson(0, 10)
  assert.equal(lo, 0)
  assert.ok(hi > 0.2 && hi < 0.35)
})
