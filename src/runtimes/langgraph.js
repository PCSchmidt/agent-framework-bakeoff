/**
 * Phase 2 LangGraph baseline.
 * Fixture tools only — no LLM, no network, no API keys.
 * Emits the same brief JSON the mechanical judge scores.
 */

import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { emitBrief, joinOverlaps, retrieveAdsb, retrieveNotams, retrieveTle } from '../tools.js'
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

export function buildLangGraph(world) {
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

  const emit = (state) => ({
    brief: emitBrief(
      { airport: state.airport, date: state.date, runtime: 'langgraph' },
      {
        notams: state.notams,
        tracks: state.tracks,
        passes: state.passes,
        pairs: state.pairs,
      },
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

export async function runLangGraphBrief(query, world = loadWorld()) {
  const app = buildLangGraph(world)
  const result = await app.invoke({
    airport: query.airport,
    date: query.date,
  })
  return result.brief
}
