# AGENTS.md

How coding agents should work in this repository.

## Read first

1. [README.md](README.md) and [STATUS.md](STATUS.md)
2. [CONTRACT.md](CONTRACT.md) and [SPEC.md](SPEC.md)
3. [portfolio-kit GATE_CONTRACT](https://github.com/PCSchmidt/portfolio-kit/blob/main/docs/GATE_CONTRACT.md)
4. [portfolio-kit DATA_POLICY](https://github.com/PCSchmidt/portfolio-kit/blob/main/docs/DATA_POLICY.md)

## Do

- Keep brief JSON field names stable so later runtimes share [eval/cases.json](eval/cases.json).
- Cite only fixture ids from [fixtures/](fixtures/).
- Run `npm test` and `npm run eval` after judge or catalog changes.
- Stay inside this repo unless the task explicitly spans siblings.

## Do not

- Invent a second gate or memory schema.
- Add JPO / F-35 / employer inventory as claimed facts (those strings exist only as **known-bad** fixtures).
- Start LangGraph / CrewAI / redteam-blue-gate work unless the user asked for Phase 2+.
- Rewrite the golden set to match a generator. Change the generator.
- Commit `.env`, live feed dumps, or non-public data.
