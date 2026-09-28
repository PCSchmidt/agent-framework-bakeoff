# Status

**Phase:** 5 — LLM-written briefs, recorded and replayable
**Date:** 2026-09-28
**Family handoff:** [portfolio-kit docs/STATUS.md](https://github.com/PCSchmidt/portfolio-kit/blob/main/docs/STATUS.md)

## Done

- Frozen airspace-risk task, fixtures, mechanical judge, 36-case golden set
- Four runtimes on [src/tools.js](src/tools.js); deterministic table [eval/SCORE_TABLE.md](eval/SCORE_TABLE.md)
- Phase 5: pluggable brief writer; [src/llm-writer.js](src/llm-writer.js) on OpenRouter with record/replay; Meridian revise-then-block loop (max 2 revisions)
- Five harder queries (KORD, KSEA, KATL, KBOS, KLAX) with boundary and near-miss traps
- Judge adds `unsupported_claim` and checks every cited NOTAM × track pair (golden-set agreement still 1.0)
- Results: [eval/LLM_SCORE_TABLE.md](eval/LLM_SCORE_TABLE.md), audit: [eval/LLM_FINDINGS.md](eval/LLM_FINDINGS.md)

## Last measured

2026-09-28: `npm test` 30/30; golden D3 1.0, agreement 1.0; `npm run eval:llm` replays 135 recorded drafts (3 models × 9 queries × 5 samples). Ungated shipped-bad 7% / 16% / 13% (DeepSeek v4 Flash / GLM 5.3 Flash / MiMo v2.6 Pro); Meridian 0% with 0 blocked. Record spend ≈ $0.15.

## Not done

- Near-miss citation shape (most gate rejections were accurate statements breaking citation rules)
- Completeness gate (Meridian delivered 4 briefs missing true overlaps)
- Python CrewAI / AutoGen SDKs (ports stay orchestration-shaped in Node)
- D9 interpretability (meridian-jspace)

**Next:** near-miss citation shape + completeness gate, then re-record KORD/KBOS with more samples. Do **not** start red/blue.
