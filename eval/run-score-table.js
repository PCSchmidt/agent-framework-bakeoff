#!/usr/bin/env node
/**
 * Phase 4: unified score table.
 *
 *   node eval/run-score-table.js
 *   npm run eval:table
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from './run.js'
import { buildScoreTable, formatScoreTableMarkdown } from './score-table.js'

const HERE = dirname(fileURLToPath(import.meta.url))

export async function writeScoreTable(opts = {}) {
  const table = await buildScoreTable(loadCatalog(), opts)
  const markdown = formatScoreTableMarkdown(table)
  const out = opts.markdownPath ?? join(HERE, 'SCORE_TABLE.md')
  writeFileSync(out, markdown)
  return { table, markdown, out }
}

async function main() {
  const { table } = await writeScoreTable()
  process.stdout.write(`${JSON.stringify(table, null, 2)}\n`)
  if (!table.ok) process.exitCode = 1
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invoked) main()
