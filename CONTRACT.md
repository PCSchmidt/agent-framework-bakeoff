# CONTRACT.md

**Project:** agent-framework-bakeoff
**Owner:** Chris Schmidt
**Date:** 2026-08-20
**Reliability layer:** Meridian contracts via [portfolio-kit](https://github.com/PCSchmidt/portfolio-kit) 0.1.0

---

## Scope

Produce a **daily airspace-risk brief** for one public airport and UTC date from checked-in synthetic ADS-B, NOTAM, and TLE-style fixtures. Four runtimes (LangGraph, CrewAI, AG2 / Microsoft Agent Framework, Meridian-gated) will later implement the **same** tools and output schema. Phase 1 freezes the task, fixtures, and golden set so later ports cannot quietly change the problem.

### In scope

- One query: `{ airport, date }` (ICAO + UTC calendar date)
- Brief JSON with `findings[]`, each with `id`, `summary`, `confidence` (0–1), and `citations[]` that resolve to fixture ids
- Mechanical judge: missing sections, empty briefs, stubs, fabricated ids, extra entities (F-35 / JPO / classified / employer inventory), date/airport mismatch, no time overlap
- Public / unclassified fixtures only
- Portfolio-kit D3 gate-catch on known-bad authored briefs

### Out of scope

- JPO / F-35 / employer program data or live operational feeds
- Replacing Claude Code / Cursor / Copilot
- CrewAI / AG2 / Meridian agent loops *(Phase 3)*
- LLM calls inside LangGraph *(Phase 2 is fixture tools only)*
- Live FAA / ADS-B exchange / Space-Track downloads in CI
- Inventory-reconciliation task (airspace-risk is the frozen task)
- LLM judge *(optional later; mechanical judge is the Phase 1 source of truth)*

---

## Stack

| Layer | Technology |
|-------|------------|
| Runtime | Phase 2: LangGraph (`@langchain/langgraph`) with fixture tools. Later: CrewAI, AG2/MAF, Meridian-gated |
| Reliability | Meridian gate + independent Evaluator contracts (portfolio-kit 0.1.0) |
| Models | None. Mechanical brief judge + deterministic retrieve/join/emit |
| Deploy | Local Node 20+; `npm test` / `npm run eval` / `npm run eval:langgraph` |

---

## Acceptance criteria

A feature is not complete until:

1. Happy path works against the written SPEC
2. Mechanical gate hooks exit 0 (`npm test`, `npm run eval`)
3. Independent Evaluator / judge returns `pass` when the gate requires it
4. Eval table uses [EVAL_RUBRIC_TEMPLATE.md](https://github.com/PCSchmidt/portfolio-kit/blob/main/docs/EVAL_RUBRIC_TEMPLATE.md)
5. Data policy grep is clean (no JPO / F-35 as claimed facts)

---

## Known constraints

- Fixtures are synthetic public-style records; see [fixtures/SOURCES.md](fixtures/SOURCES.md)
- Golden set is 36 authored briefs (12 good / 24 bad), not model-generated
- Windows host via Git Bash; Node 20+
