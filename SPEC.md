# SPEC.md

Features as `##` headings, in priority order. Each heading is a candidate FEATURES.json entry.

## Feature: Frozen public airspace-risk task

**Gate:** confirmed
**Acceptance:**

- [x] CONTRACT.md names one query `{ airport, date }` and forbids live employer / JPO / F-35 feeds
- [x] Out of scope excludes replacing a daily coding agent
- [x] Task is airspace-risk, not inventory reconciliation

**Out of scope for this feature:** runtime-specific prompts.

## Feature: Synthetic public fixtures

**Gate:** confirmed
**Acceptance:**

- [x] `fixtures/adsb.json`, `fixtures/notams.json`, `fixtures/tle.json` load
- [x] Every record has a stable id (`ADSB-*`, `NOTAM-*`, `TLE-*`)
- [x] [fixtures/SOURCES.md](fixtures/SOURCES.md) states synthetic + retrieval date

**Out of scope for this feature:** live scraping.

## Feature: Brief JSON schema

**Gate:** confirmed
**Acceptance:**

- [x] A brief is an object with `airport`, `date`, `findings[]`
- [x] Each finding has `id`, `summary`, `confidence` in `[0, 1]`, `citations[]` of fixture ids
- [x] Heading-only strings and `null` briefs fail the judge

**Out of scope for this feature:** natural-language report prose as the scored artifact.

## Feature: Mechanical brief judge

**Gate:** tests_passing
**Acceptance:**

- [x] `src/judge.js` fail-closes on empty findings, missing citations, fabricated ids, extra entities, date/airport mismatch, no overlap, stubs, missing confidence
- [x] `npm test` covers loader, catch target, and mislabel regression

**Out of scope for this feature:** LLM judge.

## Feature: Golden set of 30–50 cases

**Gate:** evaluated
**Acceptance:**

- [x] [eval/cases.json](eval/cases.json) has 36 cases `AIR-001`–`AIR-036`
- [x] Mix of good and known-bad with failure_mode tags
- [x] `npm run eval` reports D3 catch ≥ 0.85 and verdict agreement 1.0

**Out of scope for this feature:** generating briefs from an agent.

## Feature: Four-runtime ports

**Gate:** evaluated
**Acceptance:**

- [x] LangGraph baseline emits the same brief JSON *(Phase 2)*
- [ ] CrewAI, AG2/MAF, Meridian-gated ports *(Phase 3)*
- [ ] Unified score table *(Phase 4)*

**Out of scope for this feature:** LLM nodes inside LangGraph.
