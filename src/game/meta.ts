import { MetaState, defaultMeta } from './types'

const KEY = 'sword-of-the-depths:meta'

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
