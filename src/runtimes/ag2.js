/**
 * Phase 3 AG2 / Microsoft Agent Framework-shaped port.
 * Speaker handoff (user → retriever → analyst → writer). Same tools.
 * The writer turn calls `opts.writer` (template by default). No gate: the draft ships.
 */

import { joinOverlaps, retrieveAdsb, retrieveNotams, retrieveTle, templateWriter } from '../tools.js'
import { loadWorld } from '../world.js'

export async function runAg2Brief(query, world = loadWorld(), opts = {}) {
  const writer = opts.writer ?? templateWriter
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

  const brief = await writer(
    { airport: query.airport, date: query.date },
    { notams, tracks, passes, pairs },
    { runtime: 'ag2', attempt: 1 },
  )
  messages.push({ speaker: 'writer', content: { findings_n: brief?.findings?.length ?? 0 } })
  if (brief && typeof brief === 'object') brief.handoff = messages.map((row) => row.speaker)
  return brief
}
