/**
 * Phase 2 LangGraph baseline.
 * Fixture tools for retrieve/join; the emit node calls `opts.writer`
 * (deterministic template by default, an LLM writer in Phase 5).
 * Emits the same brief JSON the mechanical judge scores. No gate: the draft ships.
 */

import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { joinOverlaps, retrieveAdsb, retrieveNotams, retrieveTle, templateWriter } from '../tools.js'
import { loadWorld } from '../world.js'

const BriefState = Annotation.Root({
  airport: Annotation(),
  date: Annotation(),
  tracks: Annotation({ default: () => [] }),
  notams: Annotation({ default: () => [] }),
  passes: Annotation({ default: () => [] }),
  pairs: Annotation({ default: () => [] }),
  brief: Annotation(),
})

export function buildLangGraph(world, writer = templateWriter) {
  const retrieve = (state) => {
    const query = { airport: state.airport, date: state.date }
    return {
      tracks: retrieveAdsb(world, query),
      notams: retrieveNotams(world, query),
      passes: retrieveTle(world, query),
    }
  }

  const join = (state) => ({
    pairs: joinOverlaps(state.notams, [...state.tracks, ...state.passes]),
  })

  const emit = async (state) => ({
    brief: await writer(
      { airport: state.airport, date: state.date },
      {
        notams: state.notams,
        tracks: state.tracks,
        passes: state.passes,
        pairs: state.pairs,
      },
      { runtime: 'langgraph', attempt: 1 },
    ),
  })

  return new StateGraph(BriefState)
    .addNode('retrieve', retrieve)
    .addNode('join', join)
    .addNode('emit', emit)
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'join')
    .addEdge('join', 'emit')
    .addEdge('emit', END)
    .compile()
}

export async function runLangGraphBrief(query, world = loadWorld(), opts = {}) {
  const app = buildLangGraph(world, opts.writer)
  const result = await app.invoke({
    airport: query.airport,
    date: query.date,
  })
  return result.brief
}
