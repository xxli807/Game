import { MetaState, defaultMeta } from './types'

// v2 keeps its own save so the story progress never collides with v1's.
const KEY = 'sword-of-the-depths:v2:meta'

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultMeta()
    const parsed = JSON.parse(raw) as Partial<MetaState>
    const base = defaultMeta()
    const legacy = parsed as Partial<MetaState> & { bestWave?: number }
    return {
      bestStage: parsed.bestStage ?? legacy.bestWave ?? base.bestStage,
      totalKills: parsed.totalKills ?? base.totalKills,
      runs: parsed.runs ?? base.runs,
      deepestLayer: parsed.deepestLayer ?? base.deepestLayer,
      lordsLaidToRest: parsed.lordsLaidToRest ?? base.lordsLaidToRest,
      relicsFound: parsed.relicsFound ?? base.relicsFound,
      victories: parsed.victories ?? base.victories,
    }
  } catch {
    return defaultMeta()
  }
}

export function saveMeta(meta: MetaState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta))
  } catch {
    /* ignore quota / private mode errors */
  }
}
