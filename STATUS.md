# Status

**Phase:** 3 — four-runtime ports
**Date:** 2026-08-20
**Family handoff:** [portfolio-kit docs/STATUS.md](https://github.com/PCSchmidt/portfolio-kit/blob/main/docs/STATUS.md)

## Done

- Frozen airspace-risk task, fixtures, mechanical judge, 36-case golden set
- Shared retrieve/join/emit in [src/tools.js](src/tools.js)
- LangGraph, CrewAI-shaped crew, AG2-shaped handoff, Meridian-gated port
- `npm run eval:runtimes` — 3 unique queries × 4 runtimes, all judge `pass`

## Last measured

2026-08-20: `npm test` 15/15; D3 catch 1.0; langgraph/crewai/ag2/meridian 3/3.

## Not done

- Unified score table / failure-mode write-up (Phase 4)
- Real CrewAI / AG2 Python SDKs or LLM nodes

**Next:** Phase 4 unified runner + score table. Do not start red/blue.
