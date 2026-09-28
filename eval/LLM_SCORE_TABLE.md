# LLM score table (Phase 5)

**Generated:** 2026-09-28T19:09:26.807Z  
**Judge / gate:** mechanical-brief-judge (no LLM)  
**Prompt:** `brief-writer-v1` · temperature 0.7 · 5 samples × 9 queries per model · Meridian max retries 2

Paired design: each (model, query, sample) has one recorded first draft shared by all four runtimes. LangGraph, CrewAI, and AG2 ship it. Meridian judges it, returns the issues for revision, and blocks the brief if it still fails.

Ungated runtimes shipped byte-identical briefs on every run: **yes**. They are shown as one row.

| Model | Runtime | n | Draft pass | Shipped clean (95% CI) | Shipped bad (95% CI) | Blocked | Coverage of clean | LLM calls / run | Cost / run |
|-------|---------|---|-----------:|-----------------------:|---------------------:|--------:|------------------:|----------------:|-----------:|
| deepseek/deepseek-v4-flash | langgraph / crewai / ag2 | 45 | 93% | 93% (82–98) | 7% (2–18) | 0% | 100% | 1.00 | $0.00079 |
| deepseek/deepseek-v4-flash | meridian | 45 | 93% | 100% (92–100) | 0% (0–8) | 0% | 100% | 1.07 | $0.00080 |
| z-ai/glm-5.3-flash | langgraph / crewai / ag2 | 45 | 84% | 84% (71–92) | 16% (8–29) | 0% | 98% | 1.00 | $0.00081 |
| z-ai/glm-5.3-flash | meridian | 45 | 84% | 100% (92–100) | 0% (0–8) | 0% | 99% | 1.16 | $0.00090 |
| xiaomi/mimo-v2.6-pro | langgraph / crewai / ag2 | 45 | 87% | 87% (74–94) | 13% (6–26) | 0% | 100% | 1.00 | $0.00121 |
| xiaomi/mimo-v2.6-pro | meridian | 45 | 87% | 100% (92–100) | 0% (0–8) | 0% | 100% | 1.13 | $0.00130 |

- **Draft pass:** first draft passes the mechanical judge.
- **Shipped clean / bad:** a brief reached the user and passes / fails the judge.
- **Blocked:** Meridian refused to deliver after all revisions failed.
- **Coverage of clean:** share of ground-truth overlap pairs (from the deterministic join) that clean briefs report. The judge does not check completeness, so this measures what the gate cannot see.

## First-draft failure modes

Runs whose first draft had each issue (a run can have several).

| Model | no_overlap | unsupported_claim |
|-------|---:|---:|
| deepseek/deepseek-v4-flash | 2 | 1 |
| z-ai/glm-5.3-flash | 2 | 5 |
| xiaomi/mimo-v2.6-pro | 0 | 6 |

