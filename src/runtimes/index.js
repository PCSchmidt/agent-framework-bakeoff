import { runAg2Brief } from './ag2.js'
import { runCrewAiBrief } from './crewai.js'
import { runLangGraphBrief } from './langgraph.js'
import { runMeridianBrief } from './meridian.js'

export const RUNTIMES = {
  langgraph: runLangGraphBrief,
  crewai: runCrewAiBrief,
  ag2: runAg2Brief,
  meridian: runMeridianBrief,
}

export const RUNTIME_IDS = Object.keys(RUNTIMES)
