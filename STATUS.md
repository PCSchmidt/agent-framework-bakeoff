# Status

**Phase:** 1 — CONTRACT / SPEC / golden set
**Date:** 2026-08-20
**Family handoff:** [portfolio-kit docs/STATUS.md](https://github.com/PCSchmidt/portfolio-kit/blob/main/docs/STATUS.md)

## Done

- Frozen airspace-risk task in [CONTRACT.md](CONTRACT.md) / [SPEC.md](SPEC.md)
- Synthetic public fixtures + [fixtures/SOURCES.md](fixtures/SOURCES.md)
- Mechanical brief judge (`src/judge.js`)
- 36-case golden set `AIR-001`–`AIR-036` (12 good / 24 bad)
- `npm test` / `npm run eval` + CI

## Not done

- LangGraph baseline (Phase 2)
- CrewAI, AG2/MAF, Meridian-gated ports
- Unified score table across runtimes
- LLM judge

**Next:** Phase 2 LangGraph baseline that emits the same brief JSON. Do not start red/blue.
