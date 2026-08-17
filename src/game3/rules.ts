// ---------- 鼎革：四柱机制 ----------
// 资源不再以粮草、银两、民心、威望、兵力、稳定呈现。
// 这些旧事件仍保留在事件库中，统一在这里折算为四项不可见的内部值：
// 军事、政治、经济、天命。界面只显示模糊状态词，避免玩家把游戏玩成算术题。

export interface Resources {
  military: number
  politics: number
  economy: number
  destiny: number
}

export type EffectLike = Partial<Resources> & {
  // 旧事件字段：兼容已有 107 个事件，不让剧情和美术映射产生大面积冲突。
  grain?: number
  silver?: number
  morale?: number
  prestige?: number
  army?: number
  stability?: number
  city?: string
  talent?: string
  spouse?: string
  armyType?: string
  death?: boolean
}

export type EventDomain = 'military' | 'political' | 'economic' | 'destiny'

const clamp = (v: number) => Math.max(0, Math.min(100, v))
const isMilitaryPhase = (phase?: string) => phase === '蛰伏' || phase === '立足' || phase === '逐鹿'

/** 把旧事件结果转换成四柱结果。数值只存在于规则层，不直接展示给玩家。 */
export function normalizeEffect(effect: EffectLike, phase?: string): EffectLike {
  const hasModern = ['military', 'politics', 'economy', 'destiny'].some((key) => typeof effect[key as keyof Resources] === 'number')
  const military = hasModern ? (effect.military ?? 0) : (effect.army ?? 0)
  const politics = hasModern ? (effect.politics ?? 0) : (effect.morale ?? 0) + (effect.stability ?? 0)
  const economy = hasModern ? (effect.economy ?? 0) : (effect.grain ?? 0) + (effect.silver ?? 0)
  const destiny = hasModern ? (effect.destiny ?? 0) : (effect.prestige ?? 0)
  const result: EffectLike = {
    military, politics, economy, destiny,
    city: effect.city, talent: effect.talent, spouse: effect.spouse, armyType: effect.armyType, death: effect.death,
  }
  // 军事只能在前三幕增长。后两幕仍可以因战事损耗，但不能靠一次抉择继续堆高。
  if (!isMilitaryPhase(phase) && (result.military ?? 0) > 0) result.military = 0
  return result
}

export function domainFor(source: string): EventDomain {
  const prefix = source.split(' · ')[0]
  if (['军情', '军心', '军纪', '军制', '城池', '战略', '死生'].includes(prefix)) return 'military'
  if (['人才', '外交', '谋略', '婚姻', '正统', '内廷', '官府', '流民', '民变', '教门'].includes(prefix)) return 'political'
  if (['财富', '民政', '天灾'].includes(prefix)) return 'economic'
  return 'destiny'
}

const boost = (effect: EffectLike, key: keyof Resources, mult: number) => {
  const value = effect[key]
  if (typeof value === 'number' && value > 0) effect[key] = Math.round(value * mult)
}

const soften = (effect: EffectLike, mult: number) => {
  for (const key of ['military', 'politics', 'economy', 'destiny'] as (keyof Resources)[]) {
    const value = effect[key]
    if (typeof value === 'number' && value < 0) effect[key] = Math.round(value * mult)
  }
}

// ---------- 君王 ----------
export function applyPassive(monarchName: string, sourceEffect: EffectLike, stage: number, phase?: string, domain?: EventDomain): EffectLike {
  const e = normalizeEffect(sourceEffect, phase)
  switch (monarchName) {
    case '嬴政': boost(e, 'politics', 1.35); break // 威压：政令更容易落地
    case '刘邦': if (e.talent) e.politics = (e.politics ?? 0) + 8; break // 市井：更容易聚拢人心
    case '刘彻': if (domain === 'military') boost(e, 'military', 1.35); break // 雄略：军情收益更厚
    case '李世民': soften(e, 0.62); break // 纳谏：坏结果不容易扩大
    case '武曌': if (domain === 'political') boost(e, 'politics', 1.4); break // 任人唯才：朝堂事件更强
    case '赵匡胤': if (domain === 'military') e.politics = (e.politics ?? 0) + 5; break // 收编：军政更稳
    case '铁木真': if (domain === 'military') { boost(e, 'military', 1.25); boost(e, 'economy', 1.1) }; break
    case '朱元璋': if (domain === 'economic') boost(e, 'economy', 1.35); break // 屯田：后勤恢复更快
    case '朱棣': if (e.city) e.destiny = (e.destiny ?? 0) + 7; break // 北征：疆域扩张带来声势
    case '曹操': if (e.talent) { boost(e, 'politics', 1.5); e.destiny = (e.destiny ?? 0) + 4 }; break
    case '司马懿': if (stage < 8) soften(e, 0.5); break
    case '忽必烈': if (domain === 'economic' || domain === 'political') boost(e, 'economy', 1.35); break
  }
  return e
}

export function applyActive(monarchName: string, r: Resources): { res: Resources; note: string } {
  const res = { ...r }
  let note = ''
  switch (monarchName) {
    case '嬴政': res.politics += 22; note = '书同文：政令重新归于一统'; break
    case '刘邦': res.politics += 20; res.destiny += 8; note = '约法三章：百姓与群臣重新愿意跟随'; break
    case '刘彻': res.military += 22; res.destiny += 6; note = '推恩：军令贯通，边地重新听命'; break
    case '李世民': res.politics += 14; res.destiny += 18; note = '天可汗：内外关系一时归于和顺'; break
    case '武曌': res.politics += 24; note = '制诏：重新安排一轮朝局'; break
    case '赵匡胤': res.military += 12; res.politics += 18; note = '陈桥：军政两端暂时归心'; break
    case '铁木真': res.military += 26; res.economy -= 8; note = '万户：以草原军令换来迅猛的兵势'; break
    case '朱元璋': res.economy += 22; res.politics += 10; note = '肃贪：清出一条还能运转的国库'; break
    case '朱棣': res.economy += 14; res.destiny += 16; note = '迁都：把王朝的重心推向新的方向'; break
    case '曹操': res.politics += 18; res.destiny += 14; note = '挟天子：暂借旧名分稳住天下'; break
    case '司马懿': res.politics += 12; res.destiny += 12; note = '隐忍：让最危险的猜忌先自行冷却'; break
    case '忽必烈': res.economy += 24; res.politics += 10; note = '四海：商路与盟约重新打开'; break
    default: note = '天命未动'
  }
  return { res: clampResources(res), note }
}

const clampResources = (r: Resources): Resources => ({
  military: clamp(r.military), politics: clamp(r.politics), economy: clamp(r.economy), destiny: clamp(r.destiny),
})

// ---------- 朝堂影响 ----------
export interface Court {
  talents: string[]
  armyType: string
  spouse: string
}

export const TALENT_BOONS: Record<string, string> = {
  李靖: '军神：军情判断更有章法',
  诸葛亮: '丞相：政令更容易传到地方',
  狄仁杰: '名相：朝堂更少互相掣肘',
  戚继光: '练兵：军势恢复更快',
  张居正: '改革：国库与政令互相支撑',
  郭子仪: '柱国：败局更容易收住',
  卫青: '骑将：军队损耗更轻',
  班超: '通西域：远方盟约更容易兑现',
  范仲淹: '忧乐：民间更愿意接受政令',
  郑和: '下西洋：商路持续带来回响',
  司马懿: '隐忍：天命低迷时仍能拖住崩坏',
}

export const ARMY_BOONS: Record<string, string> = {
  农民军: '就食于乡：补充快，久战易散',
  边军骑兵: '来去如风：军情事件更有主动权',
  火器新军: '摧城：攻坚时声势惊人',
  江南水师: '漕运：经济与军需彼此照应',
  亲军精锐: '腹心：败局时更容易护住中枢',
}

export const SPOUSE_BOONS: Record<string, string> = {
  关中豪族之女: '关中粮仓：经济恢复更稳',
  江南商帮继承人: '商路：经济事件更容易见效',
  辽东部族公主: '塞外战马：军势更容易推进',
  前朝宗室: '旧朝名分：天命不易骤降',
  并肩作战的女将: '同袍：军情事件更有退路',
  盐商之女: '盐利：军队后勤压力较轻',
}

const has = (court: Court, talent: string) => court.talents.includes(talent)

export function applyCourt(sourceEffect: EffectLike, court: Court, domain?: EventDomain): EffectLike {
  const e = normalizeEffect(sourceEffect)
  const matching = (key: keyof Resources, mult: number) => {
    if (domain === key || (domain === 'military' && key === 'military') || (domain === 'political' && key === 'politics') || (domain === 'economic' && key === 'economy') || (domain === 'destiny' && key === 'destiny')) boost(e, key, mult)
  }
  if (has(court, '李靖')) matching('military', 1.16)
  if (has(court, '诸葛亮')) matching('politics', 1.16)
  if (has(court, '狄仁杰')) matching('politics', 1.18)
  if (has(court, '戚继光')) matching('military', 1.2)
  if (has(court, '张居正')) matching('economy', 1.2)
  if (has(court, '卫青')) matching('military', 1.12)
  if (has(court, '班超')) matching('destiny', 1.2)
  if (has(court, '范仲淹')) matching('politics', 1.2)
  if (has(court, '司马懿')) soften(e, 0.86)
  if (court.armyType === '边军骑兵') matching('military', 1.12)
  if (court.armyType === '火器新军') matching('military', 1.16)
  if (court.armyType === '江南水师') matching('economy', 1.16)
  if (court.armyType === '亲军精锐') soften(e, 0.9)
  if (court.spouse === '关中豪族之女') matching('economy', 1.14)
  if (court.spouse === '江南商帮继承人') matching('economy', 1.18)
  if (court.spouse === '辽东部族公主') matching('military', 1.12)
  if (court.spouse === '前朝宗室') matching('destiny', 1.16)
  return e
}

export function courtSummary(court: Court): string[] {
  const out: string[] = []
  for (const talent of court.talents) if (TALENT_BOONS[talent]) out.push(`${talent} · ${TALENT_BOONS[talent]}`)
  if (ARMY_BOONS[court.armyType]) out.push(`${court.armyType} · ${ARMY_BOONS[court.armyType]}`)
  if (SPOUSE_BOONS[court.spouse]) out.push(`${court.spouse} · ${SPOUSE_BOONS[court.spouse]}`)
  return out
}

export function recruitmentOdds(politics: number, monarchName = ''): number {
  let odds = 0.28 + politics * 0.0055
  if (monarchName === '刘邦') odds += 0.12
  if (monarchName === '武曌') odds += 0.08
  if (monarchName === '曹操') odds += 0.06
  return Math.max(0.22, Math.min(0.92, odds))
}

// ---------- 军事事件与阶段挑战 ----------
export function militaryOdds(r: Resources, label: string, court?: Court): number {
  const aggressive = /攻|破|夺|登城|镇压|冒险|夜渡|会战|突进/.test(label)
  let odds = aggressive ? 0.52 : 0.62
  odds += (r.military - 50) * 0.004
  odds += (r.economy - 50) * 0.0015
  if (court?.talents.includes('李靖')) odds += 0.07
  if (court?.talents.includes('戚继光')) odds += 0.05
  if (court?.armyType === '边军骑兵') odds += 0.06
  if (court?.armyType === '火器新军') odds += 0.08
  if (court?.spouse === '并肩作战的女将') odds += 0.05
  return Math.max(0.18, Math.min(0.9, odds))
}

export function militaryFailure(sourceEffect: EffectLike, r: Resources): EffectLike {
  const e = normalizeEffect(sourceEffect)
  // 强军即使失手，也更有能力收拾残局；疲弱军队则会把一次败仗扩散成连锁损失。
  const loss = Math.max(6, Math.round(18 - r.military * 0.1))
  return {
    military: e.military && e.military > 0 ? -loss : Math.min(-4, e.military ?? -4),
    politics: e.politics && e.politics > 0 ? -8 : Math.min(-4, e.politics ?? -4),
    economy: e.economy && e.economy > 0 ? -8 : Math.min(-4, e.economy ?? -4),
    destiny: e.destiny && e.destiny > 0 ? -10 : Math.min(-5, e.destiny ?? -5),
  }
}

export function militaryResult(sourceEffect: EffectLike, r: Resources, phase?: string): EffectLike {
  const e = normalizeEffect(sourceEffect, phase)
  const factor = r.military >= 72 ? 1.22 : r.military >= 56 ? 1.08 : r.military <= 30 ? 0.78 : 1
  boost(e, 'military', factor)
  if (r.military >= 72) soften(e, 0.82)
  return e
}

export function politicalResult(sourceEffect: EffectLike, r: Resources, phase?: string): EffectLike {
  const e = normalizeEffect(sourceEffect, phase)
  const factor = r.politics >= 72 ? 1.2 : r.politics >= 56 ? 1.08 : r.politics <= 30 ? 0.78 : 1
  boost(e, 'politics', factor)
  if (r.politics >= 72) soften(e, 0.86)
  return e
}

export function challengeOdds(base: number, label: string, r: Resources, court?: Court): { odds: number; hint: string } {
  const aggressive = /攻|破|夺|登城|镇压|冒险|夜渡/.test(label)
  // 阶段挑战是整局的高压节点：选项上的原始胜算只代表理想条件，
  // 真正结算时统一承受一轮乱世风险，让挑战明显比普通事件更容易失手。
  let odds = base * 0.72
  const bits: string[] = []
  if (aggressive) {
    odds += (r.military - 50) * 0.004 + (r.economy - 50) * 0.0015
    if (r.military >= 68) bits.push('军势正盛')
    if (r.military <= 30) bits.push('军势疲弱')
    if (r.economy <= 25) bits.push('后勤吃紧')
  } else {
    odds += (r.politics - 50) * 0.003 + (r.destiny - 50) * 0.002
    if (r.politics >= 68) bits.push('朝野愿听')
    if (r.politics <= 30) bits.push('政令受阻')
    if (r.destiny >= 68) bits.push('天命相助')
  }
  if (court) odds += militaryOdds(r, label, court) - militaryOdds({ ...r, military: 50, economy: 50 }, label)
  const finalOdds = Math.max(0.16, Math.min(0.9, odds))
  const quality = finalOdds >= 0.72 ? '胜算颇佳' : finalOdds >= 0.5 ? '胜负难料' : '凶险异常'
  return { odds: finalOdds, hint: bits.length ? `${quality}，${bits.join('、')}` : quality }
}

export function challengeSetback(r: Resources, court?: Court): { res: Resources; message: string } {
  const guarded = court?.talents.includes('郭子仪') || court?.armyType === '亲军精锐'
  const mult = guarded ? 0.62 : 1
  const res = clampResources({
    military: r.military - Math.round(16 * mult),
    politics: r.politics - Math.round(9 * mult),
    economy: r.economy - Math.round(10 * mult),
    destiny: r.destiny - Math.round(8 * mult),
  })
  return { res, message: guarded ? '挑战失利，但朝中有人替你收住了败势。' : '挑战失利，军心、国库与天命同时蒙尘。' }
}

// ---------- 危机与天命崩坏 ----------
export interface Crisis { res: Resources; message: string; fatal: boolean }

export function checkCrisis(r: Resources): Crisis | null {
  const res = { ...r }
  if (res.economy <= 8) {
    res.military = clamp(res.military - 10)
    res.politics = clamp(res.politics - 8)
    res.destiny = clamp(res.destiny - 8)
    res.economy = 18
    return { res, message: '府库见底，军队与地方开始各自寻找出路。', fatal: res.destiny <= 0 }
  }
  if (res.politics <= 8) {
    res.military = clamp(res.military - 7)
    res.destiny = clamp(res.destiny - 12)
    res.politics = 18
    return { res, message: '政令失去回声，朝野开始各自下注。', fatal: res.destiny <= 0 }
  }
  if (res.military <= 8) {
    res.politics = clamp(res.politics - 8)
    res.destiny = clamp(res.destiny - 10)
    res.military = 16
    return { res, message: '军势几近涣散，边镇与敌手都闻到了弱意。', fatal: res.destiny <= 0 }
  }
  return null
}

/** 天命越低，任何一次随机事件都越可能突然转成坏结局；天命归零立即结束。 */
export function badEndingChance(destiny: number, extraRisk = 0): number {
  const pressure = (100 - clamp(destiny)) / 100
  return Math.min(0.88, 0.012 + pressure * pressure * 0.58 + extraRisk)
}

// ---------- 结局 ----------
export interface Ending { win: boolean; title: string; reign: string; text: string }

export function resolveEnding(r: Resources, cities: number, talents: number): Ending {
  if (r.destiny <= 0) return { win: false, title: '天命断绝', reign: '无号', text: '天命在最后一刻归于寂灭。你的旗帜还在，天下却已经不再承认它。' }
  const pillars = [r.military >= 58, r.politics >= 58, r.economy >= 55].filter(Boolean).length
  if (pillars < 2 || r.destiny < 38) {
    return { win: false, title: '乱世吞没了你', reign: '无号', text: '你曾经握住过军队、朝堂或国库，却没有让它们在同一个方向上站稳。新朝尚未写完，旧乱已经卷土重来。' }
  }
  if (pillars === 3 && r.destiny >= 62 && cities >= 3 && talents >= 3) {
    return { win: true, title: '万世之基', reign: '开元之世', text: '军队、朝堂、国库与天命彼此咬合，王朝终于不再只靠你一个人站立。' }
  }
  const scores = [
    { value: r.military, title: '马上得天下', reign: '武功之世', text: '你以强悍军势压住乱世，天下先因畏惧而归附，再因秩序而留下。' },
    { value: r.politics, title: '民心所归', reign: '仁政之世', text: '你让朝堂与民间重新听见彼此，新朝不是被迫接受，而是被人愿意留下。' },
    { value: r.economy, title: '万邦来朝', reign: '富庶之世', text: '国库与商路撑起了新的秩序，远方来客承认这片土地已经换了主人。' },
  ]
  const top = scores.sort((a, b) => b.value - a.value)[0]
  return { win: true, title: top.title, reign: top.reign, text: top.text }
}

// ---------- 只给界面使用的模糊词 ----------
export function quality(value: number): string {
  if (value <= 15) return '危殆'
  if (value <= 35) return '疲弱'
  if (value <= 55) return '尚可'
  if (value <= 75) return '稳健'
  return '鼎盛'
}

export function momentum(value: number): string {
  if (value <= -12) return '明显受挫'
  if (value < 0) return '略有损耗'
  if (value >= 18) return '显著增强'
  if (value > 0) return '渐有起色'
  return '变化未明'
}

export function describeEffect(effect: EffectLike, phase?: string): string {
  const e = normalizeEffect(effect, phase)
  const out: string[] = []
  if (e.military) out.push(`军势${momentum(e.military)}`)
  if (e.politics) out.push(`朝局${momentum(e.politics)}`)
  if (e.economy) out.push(`国库${momentum(e.economy)}`)
  if (e.destiny) out.push(`天命${momentum(e.destiny)}`)
  if (e.talent) out.push('可能有人投效')
  if (e.spouse) out.push('姻盟将近')
  if (e.armyType) out.push('军制将变')
  if (e.city) out.push('疆域有望扩展')
  if (e.death) out.push('暗藏覆亡之险')
  return out.length ? out.join(' · ') : '局势仍未明朗'
}
