# Status

**Phase:** 2 — LangGraph baseline
**Date:** 2026-08-20
**Family handoff:** [portfolio-kit docs/STATUS.md](https://github.com/PCSchmidt/portfolio-kit/blob/main/docs/STATUS.md)

## Done

- Frozen airspace-risk task in [CONTRACT.md](CONTRACT.md) / [SPEC.md](SPEC.md)
- Synthetic public fixtures + mechanical judge + 36-case golden set
- Shared retrieve/join/emit tools in [src/tools.js](src/tools.js)
- LangGraph runtime: retrieve → join → emit ([src/runtimes/langgraph.js](src/runtimes/langgraph.js))
- `npm run eval:langgraph` — 3 unique queries, all judge `pass`

## Last measured

2026-08-20: `npm test` 9/9; `npm run eval` D3 catch 1.0 / agreement 1.0; `eval:langgraph` query_pass_rate 1.0 (n=3).

## Not done

- CrewAI, AG2/MAF, Meridian-gated ports (Phase 3)
- Unified score table across runtimes (Phase 4)
- LLM nodes inside LangGraph

**Next:** Phase 3 ports using the same `src/tools.js`. Do not start red/blue.
