# Contributing

This repository compares agent **runtimes** on one frozen public task. Contracts live in [portfolio-kit](https://github.com/PCSchmidt/portfolio-kit).

## Checks

```sh
npm test
npm run eval
npm run eval:langgraph
```

All three must stay green. `eval` is the published D3 table; `eval:langgraph` is the Phase 2 runtime table.

## Catalog rules

- Keep `AIR-###` ids stable once published.
- New cases must set `kind`, `failure_mode` (or null), `query`, `expect_verdict`, and `brief`.
- Do not require network in CI.

## License

MIT. See [LICENSE](LICENSE).
