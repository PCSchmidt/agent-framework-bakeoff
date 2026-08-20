/**
 * Phase 3 Meridian-gated port.
 * Mechanical query gate, then the same tools, then the independent judge.
 * Fail-closed: a fail verdict is not returned as a user-facing brief.
 */

import { judgeBrief } from '../judge.js'
import { emitBrief, gatherEvidence } from '../tools.js'
import { loadWorld } from '../world.js'

export class MeridianGateError extends Error {
  constructor(message) {
    super(message)
    this.name = 'MeridianGateError'
    this.exitCode = 2
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

export async function runMeridianBrief(query, world = loadWorld()) {
  verifyQuery(query)
  const gathered = gatherEvidence(world, query)
  const brief = emitBrief(
    { airport: query.airport, date: query.date, runtime: 'meridian' },
    gathered,
  )
  const judged = judgeBrief(query, brief, world)
  if (judged.verdict === 'fail') {
    throw new MeridianGateError(judged.notes || 'Evaluator fail')
  }
  brief.gate_verdict = judged.verdict
  return brief
}
