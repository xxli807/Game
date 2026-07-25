import { MetaState, defaultMeta } from './types'

const KEY = 'sword-of-the-depths:meta'

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultMeta()
    const parsed = JSON.parse(raw) as Partial<MetaState>
    const base = defaultMeta()
    return {
      ...base,
      ...parsed,
      forge: { ...base.forge, ...(parsed.forge ?? {}) },
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
