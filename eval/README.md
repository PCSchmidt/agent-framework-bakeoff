# eval/

Held-out golden set for the public airspace-risk brief (portfolio-kit D3 + verdict agreement).

```sh
npm test
npm run eval
```

```sh
npm run eval:runtimes
npm run eval:table
```

- Phase 1 `npm run eval`: authored briefs vs judge (D3). No network.
- Phase 3 `npm run eval:runtimes`: four ports on unique `{airport,date}` queries.
- Phase 4 `npm run eval:table`: writes [SCORE_TABLE.md](SCORE_TABLE.md) (D1–D8 + retrospective).
- Cases: [cases.json](cases.json) (`AIR-001`–`AIR-036`)
- Judge: [src/judge.js](../src/judge.js) against [fixtures/](../fixtures/)

Do not rewrite this catalog to match the generator.
