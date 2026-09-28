/**
 * Phase 3 CrewAI-shaped port.
 * Sequential crew of named roles. Same src/tools.js. No Python SDK.
 * The brief_writer role calls `ctx.writer` (template by default). No gate: the draft ships.
 */

import { joinOverlaps, retrieveAdsb, retrieveNotams, retrieveTle, templateWriter } from '../tools.js'
import { loadWorld } from '../world.js'

const CREW = [
  {
    role: 'adsb_scout',
    task: 'Retrieve ADS-B tracks for the query airport and date',
    run(ctx) {
      ctx.tracks = retrieveAdsb(ctx.world, ctx.query)
    },
  },
  {
    role: 'notam_scout',
    task: 'Retrieve published notices for the query airport and date',
    run(ctx) {
      ctx.notams = retrieveNotams(ctx.world, ctx.query)
    },
  },
  {
    role: 'tle_scout',
    task: 'Retrieve synthetic pass geometry for the query airport and date',
    run(ctx) {
      ctx.passes = retrieveTle(ctx.world, ctx.query)
    },
  },
  {
    role: 'overlap_analyst',
    task: 'Join timed rows onto NOTAM windows',
    run(ctx) {
      ctx.pairs = joinOverlaps(ctx.notams, [...ctx.tracks, ...ctx.passes])
    },
  },
  {
    role: 'brief_writer',
    task: 'Emit frozen brief JSON citing fixture ids only',
    async run(ctx) {
      ctx.brief = await ctx.writer(
        ctx.query,
        {
          notams: ctx.notams,
          tracks: ctx.tracks,
          passes: ctx.passes,
          pairs: ctx.pairs,
        },
        { runtime: 'crewai', attempt: 1 },
      )
    },
  },
]

export function buildCrew() {
  return CREW.map(({ role, task }) => ({ role, task }))
}

export async function runCrewAiBrief(query, world = loadWorld(), opts = {}) {
  const ctx = {
    world,
    writer: opts.writer ?? templateWriter,
    query: { airport: query.airport, date: query.date },
    tracks: [],
    notams: [],
    passes: [],
    pairs: [],
    brief: null,
  }
  for (const agent of CREW) {
    await agent.run(ctx)
  }
  return ctx.brief
}
