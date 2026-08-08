// ---------- 鼎革：跨局进度（解锁系统） ----------
// 12 位君王一次性全给，等于没有「下一次开局的理由」。
// 改为初始 4 位，每通关一次解锁下一位——把「再来一局」和内容供给绑在一起。

const KEY = 'dingge:v3:meta'

export interface DynastyMeta {
  unlocked: string[]
  wins: number
  runs: number
  reigns: string[] // 已经打出过的国号（结局收集）
}

/** 初始可用的四位：草根、明君、开国、枭雄，四种截然不同的玩法。 */
export const STARTERS = ['刘邦', '李世民', '朱元璋', '曹操']

/** 解锁顺序：由稳到烈，最后才是嬴政。 */
export const UNLOCK_ORDER = ['赵匡胤', '刘彻', '武曌', '朱棣', '司马懿', '忽必烈', '铁木真', '嬴政']

const blank = (): DynastyMeta => ({ unlocked: [...STARTERS], wins: 0, runs: 0, reigns: [] })

export function loadMeta(): DynastyMeta {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return blank()
    const parsed = JSON.parse(raw) as Partial<DynastyMeta>
    const unlocked = Array.isArray(parsed.unlocked) && parsed.unlocked.length ? parsed.unlocked : [...STARTERS]
    return {
      unlocked: [...new Set([...STARTERS, ...unlocked])],
      wins: typeof parsed.wins === 'number' ? parsed.wins : 0,
      runs: typeof parsed.runs === 'number' ? parsed.runs : 0,
      reigns: Array.isArray(parsed.reigns) ? parsed.reigns : [],
    }
  } catch {
    return blank()
  }
}

export function saveMeta(meta: DynastyMeta) {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta))
  } catch {
    // 隐私模式下写不进去：不影响本局游玩
  }
}

/** 下一位待解锁的君王；全部解锁则返回 undefined。 */
export function nextLocked(meta: DynastyMeta): string | undefined {
  return UNLOCK_ORDER.find((name) => !meta.unlocked.includes(name))
}

/** 通关结算：记一次胜利，解锁下一位君王，收录国号。 */
export function recordVictory(meta: DynastyMeta, reign: string): { meta: DynastyMeta; unlockedName?: string } {
  const unlockedName = nextLocked(meta)
  const next: DynastyMeta = {
    unlocked: unlockedName ? [...meta.unlocked, unlockedName] : meta.unlocked,
    wins: meta.wins + 1,
    runs: meta.runs,
    reigns: meta.reigns.includes(reign) ? meta.reigns : [...meta.reigns, reign],
  }
  return { meta: next, unlockedName }
}

export function recordRun(meta: DynastyMeta): DynastyMeta {
  return { ...meta, runs: meta.runs + 1 }
}
