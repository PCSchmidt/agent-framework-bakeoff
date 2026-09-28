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
- [x] CrewAI, AG2/MAF, Meridian-gated ports *(Phase 3)*
- [x] Unified score table *(Phase 4)*

**Out of scope for this feature:** LLM nodes; installing the Python CrewAI / AutoGen SDKs.

## Feature: LLM brief writer with recorded replay

**Gate:** evaluated
**Acceptance:**

- [x] `src/llm-writer.js` calls an OpenRouter model to write the brief from retrieved records; the precomputed overlap pairs are **not** in the prompt
- [x] Every runtime accepts `opts.writer`; the deterministic template stays the default so Phases 1–4 are unchanged
- [x] Paired design: the three ungated runtimes ship the shared first draft; Meridian judges it, returns the issues for up to 2 revisions, and fail-closes
- [x] Responses are recorded under `eval/recordings/`; `npm run eval:llm` replays them offline with no key
- [x] Five harder `{airport, date}` queries (KORD, KSEA, KATL, KBOS, KLAX) with window-boundary and near-miss traps
- [x] Judge also flags `unsupported_claim` (summary names an uncited aircraft or record) and checks every cited NOTAM × track pair
- [x] [eval/LLM_SCORE_TABLE.md](eval/LLM_SCORE_TABLE.md) reports draft pass, shipped clean / bad / blocked with 95% CIs, coverage, calls, and cost per run

**Out of scope for this feature:** an LLM judge; installing the Python CrewAI / AutoGen SDKs; editing the golden set.
