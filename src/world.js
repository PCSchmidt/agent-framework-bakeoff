import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(HERE, '..', 'fixtures')

export function loadWorld() {
  const adsb = JSON.parse(readFileSync(join(FIXTURES, 'adsb.json'), 'utf8'))
  const notams = JSON.parse(readFileSync(join(FIXTURES, 'notams.json'), 'utf8'))
  const tle = JSON.parse(readFileSync(join(FIXTURES, 'tle.json'), 'utf8'))
  const byId = new Map()
  for (const row of adsb.tracks) byId.set(row.id, { kind: 'adsb', ...row })
  for (const row of notams.items) byId.set(row.id, { kind: 'notam', ...row })
  for (const row of tle.passes) byId.set(row.id, { kind: 'tle', ...row })
  return { adsb, notams, tle, byId }
}

export function utcDate(iso) {
  return String(iso).slice(0, 10)
}

export function inWindow(time, from, to) {
  return time >= from && time <= to
}

export function recordAirport(record) {
  return record.airport || record.location || record.over
}

export function recordTime(record) {
  return record.time || record.valid_from
}
