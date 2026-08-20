#!/usr/bin/env node
/**
 * Phase 2 wrapper: LangGraph on unique golden-set queries.
 * Prefer `npm run eval:runtimes` in Phase 3+.
 */

import { fileURLToPath } from 'node:url'
import { loadCatalog } from './run.js'
import { runRuntimeEval } from './run-runtime.js'

export async function runLangGraphEval(catalog, opts = {}) {
  return runRuntimeEval(catalog, 'langgraph', opts)
}

async function main() {
  const report = await runLangGraphEval(loadCatalog())
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (!report.ok) process.exitCode = 1
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invoked) main()
