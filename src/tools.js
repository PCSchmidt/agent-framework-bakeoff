/**
 * Shared retrieve / join tools for every runtime.
 * Deterministic, fixture-only, no network.
 */

import { inWindow, recordAirport, recordTime, utcDate } from './world.js'

export function retrieveAdsb(world, query) {
  return world.adsb.tracks.filter((row) => (
    recordAirport(row) === query.airport && utcDate(recordTime(row)) === query.date
  ))
}

export function retrieveNotams(world, query) {
  return world.notams.items.filter((row) => (
    recordAirport(row) === query.airport && utcDate(row.valid_from) === query.date
  ))
}

export function retrieveTle(world, query) {
  return world.tle.passes.filter((row) => (
    recordAirport(row) === query.airport && utcDate(recordTime(row)) === query.date
  ))
}

export function joinOverlaps(notams, timedRows) {
  const pairs = []
  for (const notam of notams) {
    for (const timed of timedRows) {
      const t = timed.time
      if (t && inWindow(t, notam.valid_from, notam.valid_to)) {
        pairs.push({ notam, timed })
      }
    }
  }
  return pairs
}

function timedKind(row) {
  return row.id.startsWith('TLE-') ? 'pass' : 'track'
}

function overlapSummary(timed, notam) {
  const kind = timedKind(timed)
  const label = timed.callsign || timed.object || timed.id
  return `${label} (${timed.id}) ${kind} overlapped ${notam.id}: ${notam.text}`
}

function notamOnlySummary(notam) {
  return `Published notice ${notam.id} with no overlapping timed traffic in fixtures: ${notam.text}`
}

function timedOnlySummary(timed) {
  const kind = timedKind(timed)
  const label = timed.callsign || timed.object || timed.id
  return `${label} (${timed.id}) ${kind} on query date with no overlapping published notice in fixtures`
}

/**
 * Emit the frozen brief JSON. Cite only fixture ids. Never invent entities.
 */
export function emitBrief(query, { notams, tracks, passes, pairs }) {
  const findings = []
  const usedTimed = new Set()
  const usedNotam = new Set()
  let n = 1

  for (const pair of pairs) {
    findings.push({
      id: `F${n}`,
      summary: overlapSummary(pair.timed, pair.notam),
      confidence: 0.82,
      citations: [pair.timed.id, pair.notam.id],
    })
    usedTimed.add(pair.timed.id)
    usedNotam.add(pair.notam.id)
    n += 1
  }

  if (findings.length === 0) {
    for (const notam of notams) {
      findings.push({
        id: `F${n}`,
        summary: notamOnlySummary(notam),
        confidence: 0.64,
        citations: [notam.id],
      })
      usedNotam.add(notam.id)
      n += 1
    }
    for (const timed of [...tracks, ...passes]) {
      if (usedTimed.has(timed.id)) continue
      findings.push({
        id: `F${n}`,
        summary: timedOnlySummary(timed),
        confidence: 0.6,
        citations: [timed.id],
      })
      n += 1
    }
  }

  return {
    airport: query.airport,
    date: query.date,
    runtime: 'langgraph',
    findings,
  }
}
