# Phase 5 findings: LLM-written briefs

**Run:** 2026-09-28 · 3 OpenRouter models × 9 queries × 5 samples = 135 first drafts · temperature 0.7 · total spend ≈ $0.15
**Numbers:** [LLM_SCORE_TABLE.md](LLM_SCORE_TABLE.md) · raw rows: [results/llm-results.json](results/llm-results.json) · replay: `npm run eval:llm`

## Headline

| Model | Ungated: shipped a failing brief | Meridian: shipped a failing brief | Meridian extra cost |
|-------|---:|---:|---:|
| deepseek/deepseek-v4-flash | 3 / 45 (7%) | 0 / 45 | +1% |
| z-ai/glm-5.3-flash | 7 / 45 (16%) | 0 / 45 | +11% |
| xiaomi/mimo-v2.6-pro | 6 / 45 (13%) | 0 / 45 | +7% |

Every rejected draft passed on its **first** revision; nothing was blocked. The three ungated runtimes shipped byte-identical briefs on every run, because orchestration shape does not change what the model writes. The meaningful comparison is gated vs. ungated, not LangGraph vs. CrewAI vs. AG2.

## What the failures actually were

A manual audit of all 16 failing first drafts:

| Kind | Drafts | Example |
|------|---:|---------|
| **Factual error** | 2 | MiMo, KORD: "AAL311 (ADSB-014) at 14:00Z" — ADSB-014 is UAL1502; AAL311 is ADSB-013 at 13:59, *outside* the window. DeepSeek, KSEA: two aircraft "fall outside both NOTAM windows" — both are inside the all-day crane NOTAM-012. |
| **Accurate statement, citation-rule violation** | 14 | "JBU1101 at 11:05Z is outside the NOTAM-018 window" while citing only the track (rule 6), or citing a NOTAM + track together to say they *don't* overlap (rule 4). |

12 of the 14 rule violations are on **KBOS**, the near-miss trap (track 5 min after the window, pass 2 min before). The models reasoned correctly and wanted to say so; the prompt and judge have no citation shape for "near miss".

So the honest reading: **the gate caught both real errors, and both revisions were genuinely correct** (MiMo's KORD revision lists all 7 overlaps with the right callsigns; DeepSeek's KSEA revision lists all 7). But most of what the gate enforced was format, and on KBOS the "fix" was to delete the useful near-miss context.

## What the gate cannot see

Coverage (share of true overlap pairs reported) is not checked by the judge. Meridian delivered **4 incomplete briefs** that passed the gate:

| Model | Query | Coverage |
|-------|-------|---:|
| z-ai/glm-5.3-flash | KORD 2026-08-22 (3 of 5 samples) | 0.71–0.86 |
| xiaomi/mimo-v2.6-pro | KORD 2026-08-22 (1 of 5) | 0.86 |

Omissions on the boundary-heavy KORD query (windows touching at 14:00 and 16:00) are the most common *consequential* failure in this run, and neither the ungated runtimes nor Meridian stop them.

## Caveats

- n = 45 per model; the 95% intervals in the score table are wide. "Meridian shipped 0 failing briefs" is by construction — it cannot deliver a brief its own judge fails.
- The judge is the gate *and* the scorer. A second, independent check (coverage vs. the deterministic join) is what exposed the omissions.
- Fixtures are small and synthetic. Retrieval is deterministic and shared; only the writing step is an LLM.

## Suggested next steps

1. **Add a near-miss citation shape** (e.g. an optional `near_miss` field, or allow citing a NOTAM in a finding that states non-overlap) so accurate negative statements stop failing. Change the prompt and judge together, bump `PROMPT_VERSION`, and re-record.
2. **Add a completeness gate** to Meridian: the deterministic join already exists in `src/tools.js`, so the gate can require every true overlap pair to be reported. This targets the failure the current gate misses.
3. Re-run with more samples on KORD and KBOS only, where all the interesting behaviour is.
