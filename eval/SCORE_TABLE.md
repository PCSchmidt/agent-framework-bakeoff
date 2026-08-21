# Score table

**Project:** agent-framework-bakeoff  
**Generated:** 2026-08-21T11:17:34.856Z  
**Judge:** mechanical-brief-judge (no LLM)  
**Golden set:** 36 authored briefs (D3 n=24)  
**Queries:** 3 unique `{airport, date}` rows × 4 runtimes

Rubric: [portfolio-kit EVAL_RUBRIC_TEMPLATE](https://github.com/PCSchmidt/portfolio-kit/blob/main/docs/EVAL_RUBRIC_TEMPLATE.md). Rates are 0–1; D1/D2/D6/D8 are 0–10; D4 is fabrication % (lower is better); D7 is milliseconds; D9 is N/A (J-space).

| Runtime | D1 cite | D2 complete | D3 catch | D4 fab% | D5 pass@1 | D6 recover | D7 p50/p95 ms | D8 observe | D9 |
|---------|---------|-------------|----------|---------|-----------|------------|---------------|------------|----|
| langgraph | 10 | 10 | 1 (shared) | 0 | 1 (3/3) | 0 | 4/16 | 7 | — |
| crewai | 10 | 10 | 1 (shared) | 0 | 1 (3/3) | 0 | 0/0 | 8 | — |
| ag2 | 10 | 10 | 1 (shared) | 0 | 1 (3/3) | 0 | 0/0 | 10 | — |
| meridian | 10 | 10 | 1 (shared) | 0 | 1 (3/3) | 10 | 0/0 | 10 | — |

## Failure retrospective

- All four ports share src/tools.js, so D1/D2/D4/D5 match on the three golden queries. D3 is the catalog judge, not a per-runtime generator catch.
- Meridian is the only port that fail-closes a malformed query (D6). AG2 is the only port that ships a speaker handoff on the brief (D8). LangGraph pays graph compile/invoke latency (D7).
- Do not add LLM nodes until a second golden split exists. Optional later: AutoGen → Microsoft Agent Framework postmortem as a write-up, not a fifth runtime.

## Notes

- **langgraph:** LangGraph retrieve/join/emit nodes; no event log on the brief; Emitted a brief instead of blocking (findings=0)
- **crewai:** Five named crew roles; no event log on the brief; Emitted a brief instead of blocking (findings=0)
- **ag2:** Speaker handoff list on the brief; Emitted a brief instead of blocking (findings=0)
- **meridian:** Independent judge verdict attached; query gate exit 2; Fail-closed query gate (exit 2)

