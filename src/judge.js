/**
 * Mechanical judge for Phase 1 golden briefs.
 * No network, no LLM. Fail-closed on missing structure, fabricated ids,
 * extra entities, date/airport mismatch, and empty citations.
 */

const FORBIDDEN = /\b(F-?35|JPO|ITAR|CUI|classified)\b|employer inventory/i
const STUB = /\b(TODO|TBD|placeholder|coming soon)\b/i

function issue(severity, code, message) {
  return { severity, code, message }
}

function asText(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * @param {{ airport: string, date: string }} query
 * @param {object} brief
 * @param {{ byId: Map<string, object> }} world
 */
export function judgeBrief(query, brief, world) {
  const issues = []
  const blob = asText(brief)

  if (FORBIDDEN.test(blob)) {
    issues.push(issue('high', 'extra_entity', 'Brief contains a forbidden program or classification token'))
  }
  if (typeof brief === 'string' || brief == null) {
    issues.push(issue('high', 'heading_only', 'Brief is not a structured object'))
    return finalize(issues)
  }
  if (STUB.test(blob)) {
    issues.push(issue('high', 'stub_as_done', 'Brief still contains stub language'))
  }
  if (!Array.isArray(brief.findings)) {
    issues.push(issue('high', 'missing_section', 'Brief is missing a findings array'))
    return finalize(issues)
  }
  if (brief.findings.length === 0) {
    issues.push(issue('high', 'empty_brief', 'Findings array is empty'))
  }
  if (brief.airport && brief.airport !== query.airport) {
    issues.push(issue('high', 'airport_mismatch', `Brief airport ${brief.airport} != query ${query.airport}`))
  }
  if (brief.date && brief.date !== query.date) {
    issues.push(issue('high', 'date_mismatch', `Brief date ${brief.date} != query ${query.date}`))
  }

  for (const finding of brief.findings) {
    if (!finding || typeof finding !== 'object') {
      issues.push(issue('high', 'missing_section', 'Finding is not an object'))
      continue
    }
    if (!finding.id) {
      issues.push(issue('high', 'missing_finding_id', 'Finding is missing id'))
    }
    if (finding.confidence == null) {
      issues.push(issue('high', 'missing_confidence', `${finding.id || '?'} is missing confidence`))
    } else if (typeof finding.confidence !== 'number' || finding.confidence < 0 || finding.confidence > 1) {
      issues.push(issue('high', 'confidence_out_of_range', `${finding.id || '?'} confidence must be 0–1`))
    }
    const citations = finding.citations
    if (!Array.isArray(citations) || citations.length === 0) {
      issues.push(issue('high', 'missing_citation', `${finding.id || '?'} has no citations`))
      continue
    }
    const resolved = []
    for (const cite of citations) {
      const rec = world.byId.get(cite)
      if (!rec) {
        issues.push(issue('high', 'fabricated_citation', `Unknown citation ${cite}`))
        continue
      }
      resolved.push(rec)
      const ap = rec.airport || rec.location || rec.over
      if (ap && ap !== query.airport) {
        issues.push(issue('high', 'airport_mismatch', `${cite} is ${ap}, query is ${query.airport}`))
      }
      const t = rec.time || rec.valid_from
      if (t && String(t).slice(0, 10) !== query.date) {
        issues.push(issue('high', 'date_mismatch', `${cite} date ${String(t).slice(0, 10)} != ${query.date}`))
      }
    }
    const notam = resolved.find((r) => r.kind === 'notam')
    const timed = resolved.find((r) => r.kind === 'adsb' || r.kind === 'tle')
    if (notam && timed) {
      const t = timed.time
      if (!(t >= notam.valid_from && t <= notam.valid_to)) {
        issues.push(issue('high', 'no_overlap', `${timed.id} is outside ${notam.id} window`))
      }
    }
  }

  return finalize(issues)
}

function finalize(issues) {
  const high = issues.filter((i) => i.severity === 'high')
  const verdict = high.length ? 'fail' : issues.length ? 'warn' : 'pass'
  return {
    verdict,
    overall: verdict === 'pass' ? 8.5 : verdict === 'warn' ? 6 : 2,
    issues,
    notes: issues[0]?.message || 'No high-severity gaps in the reviewed brief.',
  }
}
