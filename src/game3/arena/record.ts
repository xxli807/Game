// 逐鹿战绩：独立存档键，不改动 meta.ts 的结构。
const KEY = 'dingge:v3:arena'
export type ArenaRecord = { games: number; wins: number; kills: number; bestStreak: number }
const blank = (): ArenaRecord => ({ games: 0, wins: 0, kills: 0, bestStreak: 0 })
export function loadRecord(): ArenaRecord {
  try { return { ...blank(), ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<ArenaRecord>) } } catch { return blank() }
}
export function saveRecord(record: ArenaRecord) {
  try { localStorage.setItem(KEY, JSON.stringify(record)) } catch { /* 隐私模式：不影响游玩 */ }
}
