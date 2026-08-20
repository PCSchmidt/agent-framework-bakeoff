# eval/

Held-out golden set for the public airspace-risk brief (portfolio-kit D3 + verdict agreement).

```sh
npm test
npm run eval
```

```sh
npm run eval:runtimes
```

- Phase 1 `npm run eval`: authored briefs vs judge (D3). No network.
- Phase 3 `npm run eval:runtimes`: langgraph / crewai / ag2 / meridian emit briefs for unique `{airport,date}` queries; judge must `pass` all.
- Cases: [cases.json](cases.json) (`AIR-001`–`AIR-036`)
- Judge: [src/judge.js](../src/judge.js) against [fixtures/](../fixtures/)
- Target: 30–50 cases, gate-catch ≥ 85% on known-bad, 100% labeled agreement

Do not rewrite this catalog to match the generator.
