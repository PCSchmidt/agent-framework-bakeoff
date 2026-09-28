/**
 * Phase 3 Meridian-gated port.
 * Mechanical query gate, then the same tools, then the independent judge.
 * Fail-closed: a fail verdict is not returned as a user-facing brief.
 *
 * Phase 5: with `opts.maxRetries > 0`, a rejected draft goes back to the
 * writer with the judge's issues (Meridian's evaluate-then-revise loop).
 * The template writer is deterministic, so the default stays at 0 retries.
 */

import { judgeBrief } from '../judge.js'
import { gatherEvidence, templateWriter } from '../tools.js'
import { loadWorld } from '../world.js'

export class MeridianGateError extends Error {
  constructor(message, attempts = []) {
    super(message)
    this.name = 'MeridianGateError'
    this.exitCode = 2
    this.attempts = attempts
  }
}

export function verifyQuery(query) {
  if (!query || typeof query.airport !== 'string' || !/^[A-Z]{4}$/.test(query.airport)) {
    throw new MeridianGateError('query.airport must be a 4-letter ICAO code')
  }
  if (!query.date || !/^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
    throw new MeridianGateError('query.date must be YYYY-MM-DD')
  }
}

export async function runMeridianBrief(query, world = loadWorld(), opts = {}) {
  verifyQuery(query)
  const writer = opts.writer ?? templateWriter
  const maxAttempts = 1 + (opts.maxRetries ?? 0)
  const gathered = gatherEvidence(world, query)
  const attempts = []
  const rounds = []

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const brief = await writer(
      { airport: query.airport, date: query.date },
      gathered,
      { runtime: 'meridian', attempt, feedback: rounds.length ? { rounds: [...rounds] } : null },
    )
    const judged = judgeBrief(query, brief, world)
    attempts.push({
      attempt,
      verdict: judged.verdict,
      issues: judged.issues.map((row) => row.code),
    })
    if (judged.verdict !== 'fail') {
      brief.gate_verdict = judged.verdict
      brief.gate_attempts = attempts
      return brief
    }
    rounds.push({ previous: brief, issues: judged.issues })
  }

  const last = rounds.at(-1).issues[0]?.message || 'Evaluator fail'
  throw new MeridianGateError(last, attempts)
}
