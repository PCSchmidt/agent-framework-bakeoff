/**
 * Phase 3 AG2 / Microsoft Agent Framework-shaped port.
 * Speaker handoff (user → retriever → analyst → writer). Same tools. No LLM.
 */

import { emitBrief, joinOverlaps, retrieveAdsb, retrieveNotams, retrieveTle } from '../tools.js'
import { loadWorld } from '../world.js'

export async function runAg2Brief(query, world = loadWorld()) {
  const messages = [{ speaker: 'user', content: { airport: query.airport, date: query.date } }]

  const tracks = retrieveAdsb(world, query)
  const notams = retrieveNotams(world, query)
  const passes = retrieveTle(world, query)
  messages.push({
    speaker: 'retriever',
    content: {
      track_ids: tracks.map((row) => row.id),
      notam_ids: notams.map((row) => row.id),
      pass_ids: passes.map((row) => row.id),
    },
  })

  const pairs = joinOverlaps(notams, [...tracks, ...passes])
  messages.push({
    speaker: 'analyst',
    content: { pair_n: pairs.length },
  })

  const brief = emitBrief(
    { airport: query.airport, date: query.date, runtime: 'ag2' },
    { notams, tracks, passes, pairs },
  )
  messages.push({ speaker: 'writer', content: { findings_n: brief.findings.length } })
  brief.handoff = messages.map((row) => row.speaker)
  return brief
}
