/**
 * Phase 5 LLM brief writer (OpenRouter, OpenAI-compatible chat API).
 *
 * The model receives the retrieved records but NOT the precomputed overlap
 * pairs, so it has to do the time-window reasoning itself.
 *
 * Every response is recorded under eval/recordings/<model>/<key>.json so the
 * eval replays offline with no API key:
 *   replay  read recordings only; a missing recording is an error (default, CI)
 *   record  read a recording if present, otherwise call the API and save it
 *   live    always call the API, never save
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const DEFAULT_RECORDINGS = join(HERE, '..', 'eval', 'recordings')
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
export const PROMPT_VERSION = 'brief-writer-v1'

const SYSTEM = `You are the brief writer on an airspace-risk analysis team.
You receive retrieved records for one airport and one UTC date, and you write a daily airspace-risk brief as JSON.

Rules:
1. Output only a JSON object: {"airport": string, "date": "YYYY-MM-DD", "findings": [...]}.
2. Each finding is {"id": "F1", "summary": string, "confidence": number between 0 and 1, "citations": [record ids]}.
3. Cite only record ids that appear in the retrieved records. Never invent ids.
4. Report every pair of (aircraft track or satellite pass, NOTAM) where the track or pass time falls inside the NOTAM validity window, inclusive of both endpoints. Use one finding per pair, citing exactly those two ids.
5. If there are no such pairs, instead report each NOTAM and each track or pass as its own finding, citing only that record.
6. A summary may name only aircraft, callsigns, or record ids that the same finding cites.
7. Do not mention programs, classification markings, or entities that are not in the records.`

function slim(rows, fields) {
  return rows.map((row) => Object.fromEntries(fields.filter((f) => row[f] != null).map((f) => [f, row[f]])))
}

/**
 * @param {{ airport: string, date: string }} query
 * @param {{ notams: object[], tracks: object[], passes: object[] }} evidence
 * @param {{ rounds: { previous: unknown, issues: object[] }[] } | null} feedback
 *   Every rejected draft so far, oldest first, so each revision sees the full history.
 */
export function buildMessages(query, evidence, feedback = null) {
  const records = {
    notams: slim(evidence.notams, ['id', 'location', 'valid_from', 'valid_to', 'text']),
    aircraft_tracks: slim(evidence.tracks, ['id', 'callsign', 'airport', 'alt_ft', 'time']),
    satellite_passes: slim(evidence.passes, ['id', 'object', 'over', 'time', 'max_elev_deg']),
  }
  const messages = [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Query: ${JSON.stringify({ airport: query.airport, date: query.date })}\n\nRetrieved records:\n${JSON.stringify(records, null, 2)}\n\nWrite the brief.`,
    },
  ]
  for (const round of feedback?.rounds ?? []) {
    const previous = typeof round.previous === 'string'
      ? round.previous
      : JSON.stringify(stripRuntimeFields(round.previous))
    const issues = round.issues.map((row) => `- ${row.code}: ${row.message}`).join('\n')
    messages.push(
      { role: 'assistant', content: previous },
      {
        role: 'user',
        content: `An independent Evaluator rejected that brief:\n${issues}\n\nReturn a corrected brief as a single JSON object that follows every rule.`,
      },
    )
  }
  return messages
}

function stripRuntimeFields(brief) {
  if (!brief || typeof brief !== 'object') return brief
  const { runtime, handoff, gate_verdict, gate_attempts, ...rest } = brief
  return rest
}

/**
 * Parse model output into a brief object. Returns the raw string when the
 * output is not a JSON object, so the judge scores it as heading_only.
 */
export function parseBrief(content) {
  const text = String(content ?? '').trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  try {
    const parsed = JSON.parse(candidate)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : text
  } catch {
    return text
  }
}

export function recordingKey(model, messages, params) {
  const payload = JSON.stringify({ prompt: PROMPT_VERSION, model, messages, ...params })
  return createHash('sha256').update(payload).digest('hex').slice(0, 24)
}

function modelDir(recordingsDir, model) {
  return join(recordingsDir, model.replace(/[^A-Za-z0-9._-]+/g, '__'))
}

async function callOpenRouter({ model, messages, temperature, seed, apiKey, fetchImpl, maxTokens }) {
  const body = {
    model,
    messages,
    temperature,
    seed,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    usage: { include: true },
  }
  let lastError
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)))
    const started = Date.now()
    let res
    try {
      res = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/PCSchmidt/agent-framework-bakeoff',
          'X-Title': 'agent-framework-bakeoff',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      })
    } catch (err) {
      lastError = err
      continue
    }
    if (res.status === 429 || res.status >= 500) {
      lastError = new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`)
      continue
    }
    if (!res.ok) {
      throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`)
    }
    const data = await res.json()
    if (data.error) {
      lastError = new Error(`OpenRouter error: ${JSON.stringify(data.error).slice(0, 300)}`)
      continue
    }
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      finish_reason: data.choices?.[0]?.finish_reason ?? null,
      served_model: data.model ?? null,
      provider: data.provider ?? null,
      usage: data.usage ?? null,
      latency_ms: Date.now() - started,
    }
  }
  throw lastError
}

/**
 * @param {{
 *   model: string,
 *   sample?: number,
 *   temperature?: number,
 *   mode?: 'replay' | 'record' | 'live',
 *   recordingsDir?: string,
 *   apiKey?: string,
 *   fetchImpl?: typeof fetch,
 *   maxTokens?: number,
 *   onCall?: (entry: object) => void,
 * }} options
 */
export function createLlmWriter(options) {
  const {
    model,
    sample = 0,
    temperature = 0.7,
    mode = 'replay',
    recordingsDir = DEFAULT_RECORDINGS,
    apiKey = process.env.OPENROUTER_API_KEY,
    fetchImpl = globalThis.fetch,
    maxTokens = 8000,
    onCall = () => {},
  } = options
  const inflight = new Map()

  async function complete(messages, meta) {
    const key = recordingKey(model, messages, { temperature, sample })
    const file = join(modelDir(recordingsDir, model), `${key}.json`)
    if (mode !== 'live' && existsSync(file)) {
      const saved = JSON.parse(readFileSync(file, 'utf8'))
      onCall({ key, cached: true, ...saved.response })
      return saved.response.content
    }
    if (mode === 'replay') {
      throw new Error(`No recording for ${model} ${meta.airport} ${meta.date} sample ${sample} attempt ${meta.attempt} (${key}). Run with --mode record.`)
    }
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')
    const call = () => callOpenRouter({ model, messages, temperature, seed: sample, apiKey, fetchImpl, maxTokens })
    if (mode === 'live') inflight.delete(key)
    if (!inflight.has(key)) inflight.set(key, call())
    const response = await inflight.get(key)
    if (mode === 'record' && !existsSync(file)) {
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, `${JSON.stringify({
        key,
        prompt_version: PROMPT_VERSION,
        model,
        params: { temperature, sample },
        meta,
        recorded_at: new Date().toISOString(),
        response,
      }, null, 2)}\n`)
    }
    onCall({ key, cached: false, ...response })
    return response.content
  }

  return async function llmWriter(query, evidence, ctx) {
    const messages = buildMessages(query, evidence, ctx.feedback ?? null)
    const content = await complete(messages, { airport: query.airport, date: query.date, attempt: ctx.attempt ?? 1 })
    const brief = parseBrief(content)
    if (brief && typeof brief === 'object') brief.runtime = ctx.runtime
    return brief
  }
}
