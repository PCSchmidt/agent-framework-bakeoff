# eval/

Held-out golden set for the public airspace-risk brief (portfolio-kit D3 + verdict agreement).

```sh
npm test
npm run eval
```

- No network, no LangGraph / CrewAI / dsh, no API keys
- Cases: [cases.json](cases.json) (`AIR-001`–`AIR-036`)
- Judge: [src/judge.js](../src/judge.js) against [fixtures/](../fixtures/)
- Target: 30–50 cases, gate-catch ≥ 85% on known-bad, 100% labeled agreement

Last Phase 1 design: 12 good / 24 bad. Runtimes in later phases must emit the same brief JSON; they do not rewrite this catalog.
