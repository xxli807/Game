import { useEffect, useState } from 'react'
import { applyPassive, applyActive, applyCourt, badEndingChance, checkCrisis, challengeOdds, challengeSetback, courtSummary, describeEffect, domainFor, militaryFailure, militaryOdds, militaryResult, normalizeEffect, politicalResult, quality, recruitmentOdds, resolveEnding, Resources, Court } from './rules'
import { loadMeta, saveMeta, recordRun, recordVictory, nextLocked, DynastyMeta } from './meta'
import { handwrittenEvents } from './events'
import { artForEvent } from './art'

const TIME_LIMIT = 480 // 21 次抉择约需 378 秒，留出约 100 秒容错：出错会逼近上限，但不至于必输

type Phase = '蛰伏' | '立足' | '逐鹿' | '问鼎' | '建国'
type Status = 'running' | 'victory' | 'defeat'
type Monarch = { name: string; epithet: string; passive: string; active: string; trait: string; color: string; starting: Resources }
type Effect = import('./rules').EffectLike
type EventOption = { label: string; detail: string; effect: Effect; success?: number; reward?: Effect }
type GameEvent = { id: string; title: string; body: string; source: string; options: EventOption[]; phase: Phase }
type Run = { monarch: Monarch; status: Status; elapsed: number; eventCount: number; event: GameEvent; deck: GameEvent[]; cursor: number; military: number; politics: number; economy: number; destiny: number; city: string; cities: string[]; talents: string[]; spouse: string; armyType: string; log: string[]; ending?: string; activeUsed: boolean; crisis?: string; endTitle?: string; reign?: string; unlockedName?: string; settled?: boolean }

const initialResources = (military: number, politics: number, economy: number, destiny: number): Resources => ({ military, politics, economy, destiny })

const MONARCHS: Monarch[] = [
  { name: '嬴政', epithet: '秦始皇', passive: '威压：政令更容易落地', active: '书同文：让天下重新听见同一种命令', trait: '集权', color: '#b64b3b', starting: initialResources(44, 68, 42, 62) },
  { name: '刘邦', epithet: '汉高祖', passive: '市井：更容易聚拢人才与民心', active: '约法三章：让百姓与群臣重新愿意跟随', trait: '用人', color: '#8d5b31', starting: initialResources(42, 66, 48, 64) },
  { name: '刘彻', epithet: '汉武帝', passive: '雄略：军情事件更容易见效', active: '推恩：让军令贯通边地', trait: '远征', color: '#6a4b88', starting: initialResources(62, 46, 38, 58) },
  { name: '李世民', epithet: '唐太宗', passive: '纳谏：坏结果不容易扩大', active: '天可汗：让内外关系暂时归于和顺', trait: '开明', color: '#4b688d', starting: initialResources(54, 72, 62, 86) },
  { name: '武曌', epithet: '武则天', passive: '任人唯才：朝堂事件更有影响力', active: '制诏：重新安排一轮朝局', trait: '权谋', color: '#8c3d68', starting: initialResources(42, 70, 54, 68) },
  { name: '赵匡胤', epithet: '宋太祖', passive: '收编：军政关系更不容易失控', active: '陈桥：让军政两端暂时归心', trait: '收编', color: '#53735c', starting: initialResources(52, 62, 58, 64) },
  { name: '铁木真', epithet: '成吉思汗', passive: '疾驰：军情推进更迅猛', active: '万户：以草原军令聚拢兵势', trait: '草原', color: '#6d7352', starting: initialResources(72, 42, 34, 56) },
  { name: '朱元璋', epithet: '明太祖', passive: '屯田：经济危机恢复更快', active: '肃贪：清出一条还能运转的国库', trait: '草根', color: '#a33b36', starting: initialResources(38, 48, 44, 28) },
  { name: '朱棣', epithet: '永乐帝', passive: '北征：疆域扩张更能抬升声势', active: '迁都：把王朝重心推向新的方向', trait: '雄主', color: '#3f6d78', starting: initialResources(58, 50, 52, 56) },
  { name: '曹操', epithet: '魏武帝', passive: '唯才是举：人才更能改变朝局', active: '挟天子：暂借旧名分稳住天下', trait: '枭雄', color: '#47515c', starting: initialResources(58, 58, 46, 44) },
  { name: '司马懿', epithet: '晋宣帝', passive: '蛰伏：前期损失更容易被压住', active: '隐忍：让危险的猜忌自行冷却', trait: '耐心', color: '#53636a', starting: initialResources(46, 56, 50, 52) },
  { name: '忽必烈', epithet: '元世祖', passive: '通商：经济与外交彼此照应', active: '四海：重新打开商路与盟约', trait: '融合', color: '#5b6b43', starting: initialResources(52, 60, 70, 66) },
]
const CITIES = ['西安', '太原', '北京', '济南', '南京', '武昌', '成都', '杭州', '广州', '山海关']
const SPOUSES = ['关中豪族之女', '江南商帮继承人', '辽东部族公主', '前朝宗室', '并肩作战的女将', '盐商之女']
const ARMIES = ['农民军', '边军骑兵', '火器新军', '江南水师', '亲军精锐']
const PHASES: Phase[] = ['蛰伏', '立足', '逐鹿', '问鼎', '建国']

const authoredEvents: GameEvent[] = [
  { id: 'station', title: '驿站裁撤', body: '陕西大旱，朝廷裁撤驿站。百姓和驿卒都在问：下一顿饭在哪里？', source: '天灾 · 陕西', phase: '蛰伏', options: [{ label: '带驿卒劫仓', detail: '兵力 +18，民心 -8', effect: { army: 18, morale: -8 } }, { label: '游说县令赈灾', detail: '民心 +12，威望 +5', effect: { morale: 12, prestige: 5 } }] },
  { id: 'oath', title: '一纸旧诏', body: '一名落魄翰林携明廷旧诏来投，愿以名望换一处容身之地。', source: '人才 · 西安', phase: '蛰伏', options: [{ label: '收为谋士', detail: '获得人才“张居正”，威望 +8', effect: { talent: '张居正', prestige: 8 } }, { label: '烧掉旧诏', detail: '稳定 +10，暂不背负正统', effect: { stability: 10 } }] },
  { id: 'salt', title: '盐商献策', body: '晋商提出以盐引换军粮，只要你保证商路安全。', source: '财富 · 山西', phase: '立足', options: [{ label: '答应互市', detail: '银两 +22，粮草 +12', effect: { silver: 22, grain: 12 } }, { label: '征用商队', detail: '粮草 +25，民心 -10', effect: { grain: 25, morale: -10 } }] },
  { id: 'general', title: '降将叩门', body: '明军守将带着三百亲兵叩门。他说自己不是怕死，只是不愿替昏君死。', source: '军情 · 太原', phase: '立足', options: [{ label: '设宴收编', detail: '兵力 +25，获得人才“戚继光”', effect: { army: 25, talent: '戚继光' } }, { label: '先扣家眷', detail: '稳定 +14，但威望下降', effect: { stability: 14, prestige: -3 } }] },
  { id: 'marriage', title: '联姻提议', body: '江南商帮愿献出女儿和一支船队，只求新朝保证漕运。', source: '婚姻 · 江南', phase: '立足', options: [{ label: '结为连理', detail: '获得配偶与银两 +18', effect: { spouse: '江南商帮继承人', silver: 18 } }, { label: '只结盟不成亲', detail: '稳定 +8，保留政治自由', effect: { stability: 8 } }] },
  { id: 'army', title: '练什么兵？', body: '你有一笔仅够支撑一种军制的银两。将领们争论了整夜。', source: '军制 · 根据地', phase: '逐鹿', options: [{ label: '边军骑兵', detail: '兵力 +20，机动远征', effect: { armyType: '边军骑兵', army: 20 } }, { label: '火器新军', detail: '银两 -8，攻城优势', effect: { armyType: '火器新军', silver: -8 } }] },
  { id: 'city', title: '三镇请降', body: '西安、太原、济南的守将同时递来密信，谁也不愿第一个开城。', source: '城池 · 北方', phase: '逐鹿', options: [{ label: '先取太原', detail: '获得城市“太原”，兵力 +10', effect: { city: '太原', army: 10 } }, { label: '绕道济南', detail: '获得城市“济南”，粮草 +18', effect: { city: '济南', grain: 18 } }] },
  { id: 'foreign', title: '关外借兵', body: '关外使者带来战马和弓手，条件是开关互市，并承认他们的盟主地位。', source: '外交 · 山海关', phase: '逐鹿', options: [{ label: '借兵北伐', detail: '兵力 +35，正统 -8', effect: { army: 35, prestige: -8 } }, { label: '只买战马', detail: '银两 -12，兵力 +12', effect: { silver: -12, army: 12 } }] },
  { id: 'famine', title: '蝗灾入境', body: '蝗虫遮天蔽日。若此时征粮，百姓会把你的旗帜也一并烧掉。', source: '天灾 · 黄河', phase: '逐鹿', options: [{ label: '开仓赈济', detail: '粮草 -20，民心 +24', effect: { grain: -20, morale: 24 } }, { label: '军粮优先', detail: '兵力 +8，民心 -18', effect: { army: 8, morale: -18 } }] },
  { id: 'spy', title: '敌营细作', body: '敌方谋士愿以一份京师布防图换取你的庇护，但他的故事漏洞百出。', source: '谋略 · 京师', phase: '问鼎', options: [{ label: '相信他', detail: '威望 +5，有机会获得北京', effect: { prestige: 5, city: '北京' } }, { label: '反过来利用', detail: '稳定 +12，人才“司马懿”投效', effect: { stability: 12, talent: '司马懿' } }] },
  { id: 'imperial', title: '奉谁为正朔？', body: '旧王朝尚未倒下，士大夫要求你明确回答：是救明，还是代明？', source: '正统 · 南京', phase: '问鼎', options: [{ label: '奉明讨贼', detail: '威望 +16，暂缓称帝', effect: { prestige: 16 } }, { label: '天下非一姓', detail: '军心 +15，正统受考验', effect: { army: 15, stability: -5 } }] },
  { id: 'capital', title: '两都之间', body: '北京城门已摇摇欲坠，南京官员却愿拥你为盟主。你只能先选一边。', source: '战略 · 中原', phase: '问鼎', options: [{ label: '北上夺京', detail: '获得北京，兵力 -8', effect: { city: '北京', army: -8 } }, { label: '经营南京', detail: '获得南京，银两 +24', effect: { city: '南京', silver: 24 } }] },
  { id: 'edict', title: '传国玉玺', body: '一名老宦官在雨夜献上玉玺。他说真正的天命，从来不在玉上。', source: '天命 · 旧宫', phase: '建国', options: [{ label: '昭告天下', detail: '威望 +24，获得正统', effect: { prestige: 24 } }, { label: '秘而不宣', detail: '稳定 +20，保留神秘感', effect: { stability: 20 } }] },
  { id: 'newlaw', title: '新朝第一道诏书', body: '所有人都在等你写下新朝的第一句话。', source: '开国 · 新都', phase: '建国', options: [{ label: '轻徭薄赋', detail: '民心 +20', effect: { morale: 20 } }, { label: '整军肃贪', detail: '兵力 +20，稳定 +8', effect: { army: 20, stability: 8 } }] },
  { id: 'plague', title: '营中疫气', body: '军营里有人高烧不退。军医说只要封营，你就能避过疫气；但敌军也在此时逼近。', source: '死生 · 军营', phase: '逐鹿', options: [{ label: '亲自入营巡视', detail: '民心 +12，但可能中道崩殂', effect: { morale: 12, death: true, city: '中道崩殂' } }, { label: '封营隔离', detail: '稳定 +10，兵力 -8', effect: { stability: 10, army: -8 } }] },
  { id: 'arrow', title: '城头流矢', body: '攻城时，一支没有旗号的冷箭穿过烟尘。将士们劝你退回中军。', source: '死生 · 城下', phase: '问鼎', options: [{ label: '继续登城', detail: '兵力 +18，但可能死于流矢', effect: { army: 18, death: true, city: '中道崩殂' } }, { label: '让名将代行', detail: '获得人才，威望 +6', effect: { talent: '郭子仪', prestige: 6 } }] },
  { id: 'palace', title: '夜半宫变', body: '亲军统领叩响寝门，说宫中有人要先下手为强。你必须在黑暗中做出判断。', source: '死生 · 行宫', phase: '建国', options: [{ label: '只带一名侍卫赴约', detail: '稳定 +20，但可能中道崩殂', effect: { stability: 20, death: true, city: '中道崩殂' } }, { label: '召集百官护驾', detail: '威望 +10，银两 -10', effect: { prestige: 10, silver: -10 } }] },
]

// 原先这里是 Array.from({ length: 83 }) 生成的模板事件（「乱世传闻 · 37」那批），
// 已由 events.ts 的手写事件替换。tim.lu 手写的 authoredEvents 与 CHALLENGES 原样保留。
const EVENT_POOL: GameEvent[] = [...authoredEvents, ...handwrittenEvents]
const FINAL_EVENT: GameEvent = { id: 'founding', title: '最后的问答：新朝姓什么？', body: '旧王朝的旗帜在城头落下。你的军队、臣子与百姓都在等一句话：你要用什么方式结束这场乱世？', source: '终局 · 开国大典', phase: '建国', options: [{ label: '以民心立国', detail: '需要民心与稳定', effect: { morale: 10 } }, { label: '以军功立国', detail: '需要兵力与威望', effect: { army: 10 } }, { label: '以万邦立国', detail: '需要城市与盟友', effect: { prestige: 10 } }] }
const CHALLENGES: GameEvent[] = [
  { id: 'challenge-1', title: '蛰伏试炼：夜渡渭水', body: '你的营地被官军发现。只有在今夜渡过渭水，才能保住第一支队伍。', source: '阶段挑战 · 蛰伏', phase: '蛰伏', options: [{ label: '冒险夜渡', detail: '成功率 55% · 兵力 +35、威望 +12', success: 0.55, effect: {}, reward: { army: 35, prestige: 12 } }, { label: '绕路潜行', detail: '成功率 90% · 兵力 +8', success: 0.9, effect: {}, reward: { army: 8 } }] },
  { id: 'challenge-2', title: '立足试炼：夺取粮仓', body: '根据地的粮食只够三天。前方粮仓守备空虚，却有一支援军正在赶来。', source: '阶段挑战 · 立足', phase: '立足', options: [{ label: '强攻粮仓', detail: '成功率 50% · 粮草 +35、城市 +1', success: 0.5, effect: {}, reward: { grain: 35, city: '西安' } }, { label: '说服守军', detail: '成功率 88% · 粮草 +12、民心 +8', success: 0.88, effect: {}, reward: { grain: 12, morale: 8 } }] },
  { id: 'challenge-3', title: '逐鹿试炼：破关', body: '山海关横在你与中原之间。这里的胜负会决定天下人是否承认你的旗帜。', source: '阶段挑战 · 逐鹿', phase: '逐鹿', options: [{ label: '炮火破关', detail: '成功率 48% · 兵力 +45、威望 +18', success: 0.48, effect: {}, reward: { army: 45, prestige: 18 } }, { label: '收买守将', detail: '成功率 86% · 威望 +8、银两 +10', success: 0.86, effect: {}, reward: { prestige: 8, silver: 10 } }] },
  { id: 'challenge-4', title: '问鼎试炼：京师决断', body: '京师城门只开一夜。你必须选择一次豪赌，决定自己究竟是诸侯还是天子。', source: '阶段挑战 · 问鼎', phase: '问鼎', options: [{ label: '率亲军登城', detail: '成功率 45% · 获得北京、兵力 +35', success: 0.45, effect: {}, reward: { city: '北京', army: 35 } }, { label: '逼守军议和', detail: '成功率 84% · 获得北京、威望 +8', success: 0.84, effect: {}, reward: { city: '北京', prestige: 8 } }] },
  { id: 'challenge-5', title: '建国试炼：开国大典', body: '旧朝已经倒下，但最后一场兵变正在宫门外酝酿。新朝能否活过第一夜？', source: '阶段挑战 · 建国', phase: '建国', options: [{ label: '亲自镇压兵变', detail: '成功率 42% · 稳定 +35、威望 +20', success: 0.42, effect: {}, reward: { stability: 35, prestige: 20 } }, { label: '让三军互相制衡', detail: '成功率 82% · 稳定 +12、民心 +12', success: 0.82, effect: {}, reward: { stability: 12, morale: 12 } }] },
]
const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5)
const phaseFor = (count: number): Phase => PHASES[Math.min(4, Math.floor(count / 4))]
const DECK_SIZE = 21
const grants = (event: GameEvent, key: 'spouse' | 'armyType') => event.options.some((o) => o.effect[key] !== undefined)
const addResources = (base: Resources, effect: Effect): Resources => ({
  military: Math.max(0, Math.min(100, base.military + (effect.military ?? 0))),
  politics: Math.max(0, Math.min(100, base.politics + (effect.politics ?? 0))),
  economy: Math.max(0, Math.min(100, base.economy + (effect.economy ?? 0))),
  destiny: Math.max(0, Math.min(100, base.destiny + (effect.destiny ?? 0))),
})

/**
 * 按幕抽牌。
 * 原本是把全池乱洗后顺序发牌，事件自带的 `phase` 只用于显示——
 * 于是「开国大典」气质的事件会出现在第 2 个抉择。模板事件内容空洞看不出来，
 * 换成手写事件后会立刻穿帮，所以这里改成每个位置只从当幕的事件里抽。
 * 另外每局最多各出现一次联姻与军制事件，避免「结这门亲」连着来两回。
 */
const weightedPick = (items: GameEvent[], weight: (event: GameEvent) => number) => {
  const total = items.reduce((sum, item) => sum + weight(item), 0)
  let roll = Math.random() * total
  for (const item of items) {
    roll -= weight(item)
    if (roll <= 0) return item
  }
  return items[items.length - 1]
}

const prepareDeck = (starting: Resources) => {
  const byPhase = new Map<Phase, GameEvent[]>(PHASES.map((p) => [p, shuffle(EVENT_POOL.filter((e) => e.phase === p))]))
  const used = new Set<string>()
  let hasSpouse = false
  let hasArmyType = false
  const drawn: GameEvent[] = []
  for (let i = 0; i < DECK_SIZE; i++) {
    const ok = (e: GameEvent) =>
      !used.has(e.id) && !(hasSpouse && grants(e, 'spouse')) && !(hasArmyType && grants(e, 'armyType'))
    // 政治越稳，人才事件在牌堆中出现的权重越高；不是简单地给玩家一张固定人才牌。
    const candidates = (byPhase.get(phaseFor(i)) ?? []).filter(ok)
    const fallback = EVENT_POOL.filter(ok)
    const pick = weightedPick(candidates.length ? candidates : fallback, (event) => event.options.some((option) => option.effect.talent) ? 0.55 + starting.politics / 100 : 1)
    if (!pick) break
    used.add(pick.id)
    if (grants(pick, 'spouse')) hasSpouse = true
    if (grants(pick, 'armyType')) hasArmyType = true
    drawn.push(pick)
  }
  const seenTalents = new Set<string>()
  return drawn.map((event) => ({ ...event, options: event.options.map((option) => {
    const talent = option.effect.talent
    if (!talent || !seenTalents.has(talent)) {
      if (talent) seenTalents.add(talent)
      return option
    }
    return { ...option, label: '收取谢礼', detail: '该人才已在本局出现，改为充实国库', effect: { ...option.effect, talent: undefined, silver: undefined, economy: 8 } }
  }) }))
}
// 尚未成家：联姻因此成为一次真正的抉择，而不是一开始就白送的加成
const isMarried = (spouse: string) => SPOUSES.includes(spouse)
const createRun = (monarch: Monarch): Run => { const start = { ...monarch.starting }; const deck = prepareDeck(start); return { monarch, status: 'running', elapsed: 0, eventCount: 0, event: deck[0], deck, cursor: 1, ...start, city: '无名营地', cities: [], talents: [], spouse: '尚未成家', armyType: ARMIES[0], log: ['你在明末乱世中醒来。旧王朝正在崩塌，四方都在等着看你的天命。'], activeUsed: false } }

export default function App() {
  const [meta, setMeta] = useState<DynastyMeta>(() => loadMeta())
  const [monarch, setMonarch] = useState(() => MONARCHS.find((m) => m.name === loadMeta().unlocked[0]) ?? MONARCHS[0])
  const [run, setRun] = useState<Run | null>(null)
  const persist = (next: DynastyMeta) => { setMeta(next); saveMeta(next) }
  const startRun = () => { persist(recordRun(meta)); setRun(createRun(monarch)) }
  useEffect(() => {
    if (!run || run.status !== 'running' || run.event.id.startsWith('challenge-')) return
    const boundary = [4, 8, 12, 16, 20].indexOf(run.eventCount)
    if (boundary < 0) return
    setRun((current) => current && current.status === 'running' && current.eventCount === run.eventCount && !current.event.id.startsWith('challenge-') ? { ...current, event: CHALLENGES[boundary] } : current)
  }, [run?.eventCount, run?.event.id, run?.status])
  // 通关结算：记一次胜利并解锁下一位君王（每局只结算一次）
  useEffect(() => {
    if (!run || run.status !== 'victory' || run.settled) return
    const { meta: next, unlockedName } = recordVictory(meta, run.reign ?? '无号')
    persist(next)
    setRun((current) => (current && current.status === 'victory' && !current.settled ? { ...current, settled: true, unlockedName } : current))
  }, [run?.status, run?.settled])
  const res = (r: Run): Resources => ({ military: r.military, politics: r.politics, economy: r.economy, destiny: r.destiny })
  const court = (r: Run): Court => ({ talents: r.talents, armyType: r.armyType, spouse: r.spouse })

  // 君王专属抉择：每局一次，真正改变局势
  const useActive = () => setRun((current) => {
    if (!current || current.status !== 'running' || current.activeUsed) return current
    const { res: rawAfter, note } = applyActive(current.monarch.name, res(current))
    const after = ['蛰伏', '立足', '逐鹿'].includes(current.event.phase) ? rawAfter : { ...rawAfter, military: current.military }
    return { ...current, ...after, activeUsed: true, log: [`${current.monarch.epithet}发动「${current.monarch.active.split('：')[0]}」——${note}`, ...current.log].slice(0, 5) }
  })

  const suddenEnding = (base: Run, risk = 0): Run => {
    if (base.destiny <= 0) return { ...base, status: 'defeat', endTitle: '天命断绝', reign: '无号', ending: '天命在这一刻归于寂灭。你的旗帜还在，天下却已经不再承认它。' }
    if (Math.random() < badEndingChance(base.destiny, risk)) return { ...base, status: 'defeat', endTitle: '天命骤断', reign: '无号', ending: '没有人能说清是哪一件小事改变了天下。只知道从这一刻起，所有人的选择都开始背离你的王朝。' }
    return base
  }

  const choose = (option: EventOption) => setRun((current) => {
    if (!current || current.status !== 'running') return current
    const domain = domainFor(current.event.source)
    let effect = applyCourt(applyPassive(current.monarch.name, option.effect, current.eventCount, current.event.phase, domain), court(current), domain)
    let militaryFailed = false
    if (domain === 'military' && Math.random() >= militaryOdds(res(current), option.label, court(current))) {
      effect = militaryFailure(effect, res(current))
      militaryFailed = true
    } else if (domain === 'military') {
      effect = militaryResult(effect, res(current), current.event.phase)
    } else if (domain === 'political') {
      effect = politicalResult(effect, res(current), current.event.phase)
    }
    effect = normalizeEffect(effect, current.event.phase)
    const hasTalent = Boolean(effect.talent && !current.talents.includes(effect.talent))
    const recruited = hasTalent && Math.random() < recruitmentOdds(current.politics, current.monarch.name)
    const recruitmentFailed = hasTalent && !recruited
    if (recruitmentFailed) effect = { ...effect, talent: undefined, politics: Math.min(-5, effect.politics ?? -5) }
    const gainedCity = militaryFailed || effect.death || effect.city === '中道崩殂' ? undefined : effect.city
    const cities = gainedCity && !current.cities.includes(gainedCity) ? [...current.cities, gainedCity] : current.cities
    const talents = recruited && effect.talent ? [...current.talents, effect.talent].slice(-6) : current.talents
    const nextCount = current.eventCount + 1
    let after = addResources(res(current), effect)
    const log = [`${current.event.title}：${option.label}`, ...current.log]
    let elapsed = current.elapsed + (militaryFailed ? 30 : 18)
    if (militaryFailed) log.unshift('⚠ 军情失利，战果反噬了你的王朝。')
    if (recruitmentFailed) log.unshift('⚠ 朝中无人响应，人才没有留下。')
    const nextCourt: Court = { talents, armyType: effect.armyType ?? current.armyType, spouse: effect.spouse ?? current.spouse }
    let crisis: string | undefined
    const c = checkCrisis(after)
    if (c) { after = c.res; crisis = c.message; log.unshift(`⚠ ${c.message}`); elapsed += 25 }
    const next: Run = {
      ...current, ...after, eventCount: nextCount, elapsed: Math.min(TIME_LIMIT, elapsed),
      event: nextCount >= 20 ? FINAL_EVENT : current.deck[current.cursor] ?? current.deck[0],
      cursor: nextCount >= 20 ? current.cursor : current.cursor + 1,
      city: gainedCity ?? current.city, cities, talents, spouse: nextCourt.spouse, armyType: nextCourt.armyType,
      crisis, log: log.slice(0, 5),
    }
    const doomed = suddenEnding(next, effect.death ? 0.2 : 0)
    if (doomed.status !== 'running') return doomed
    if (elapsed >= TIME_LIMIT) return { ...next, status: 'defeat', endTitle: '时局已失', reign: '无号', ending: '你还在权衡时，旧朝已先一步收拢残局。你的旗号没有等到天亮。' }
    if (current.event.id === 'founding') {
      const e = resolveEnding(after, cities.length, talents.length)
      return { ...next, status: e.win ? 'victory' : 'defeat', endTitle: e.title, reign: e.reign, ending: e.text }
    }
    return next
  })

  const resolveChallenge = (option: EventOption) => setRun((current) => {
    if (!current || current.status !== 'running' || !option.success) return current
    const { odds } = challengeOdds(option.success, option.label, res(current), court(current))
    const nextCount = current.eventCount + 1
    if (Math.random() >= odds) {
      const { res: after, message } = challengeSetback(res(current), court(current))
      const elapsed = current.elapsed + 40
      const base: Run = { ...current, ...after, eventCount: nextCount, elapsed: Math.min(TIME_LIMIT, elapsed),
        event: nextCount >= 21 ? FINAL_EVENT : current.deck[current.cursor] ?? current.deck[0],
        cursor: nextCount >= 21 ? current.cursor : current.cursor + 1,
        crisis: message, log: [`${current.event.title}：${message}`, ...current.log].slice(0, 5) }
      const doomed = suddenEnding(base, 0.08)
      if (doomed.status !== 'running') return doomed
      if (elapsed >= TIME_LIMIT) return { ...base, status: 'defeat', endTitle: '时局已失', reign: '无号', ending: '这一败耗尽了最后的时间，旧朝趁势收拢了天下。' }
      return base
    }
    const domain = domainFor(current.event.source)
    const rawReward = applyCourt(applyPassive(current.monarch.name, option.reward ?? {}, current.eventCount, current.event.phase, domain), court(current), domain)
    const reward = normalizeEffect(/攻|破|夺|登城|镇压|冒险|夜渡/.test(option.label) ? militaryResult(rawReward, res(current), current.event.phase) : rawReward, current.event.phase)
    const cities = reward.city && !current.cities.includes(reward.city) ? [...current.cities, reward.city] : current.cities
    let after = addResources(res(current), reward)
    let crisis: string | undefined
    const c = checkCrisis(after)
    if (c) { after = c.res; crisis = c.message }
    const base: Run = { ...current, ...after, eventCount: nextCount, elapsed: Math.min(TIME_LIMIT, current.elapsed + 18),
      event: nextCount >= 21 ? FINAL_EVENT : current.deck[current.cursor] ?? current.deck[0],
      cursor: nextCount >= 21 ? current.cursor : current.cursor + 1,
      city: reward.city ?? current.city, cities, crisis,
      log: [`${current.event.title}：挑战成功，${option.label}`, ...current.log].slice(0, 5) }
    const doomed = suddenEnding(base)
    if (doomed.status !== 'running') return doomed
    return base
  })
  if (!run) {
    const locked = nextLocked(meta)
    return <main className="dynasty-app lobby-screen">
      <div className="lobby-seal">鼎</div>
      <p className="eyebrow">明末 · 天命肉鸽</p>
      <h1>鼎革：<span>王朝崛起</span></h1>
      <p className="subtitle">天下大乱，旧朝将倾。你选一位君王的魂魄降临末世，八分钟内写下新王朝的第一章。</p>

      <section className="monarch-roster">
        <p className="eyebrow">选择君王　{meta.unlocked.length === MONARCHS.length ? '诸王皆已归位' : '仍有君王沉睡'}</p>
        <div className="monarch-grid">
          {MONARCHS.map((m) => {
            const open = meta.unlocked.includes(m.name)
            return <button
              key={m.name}
              className={`monarch-pick${monarch.name === m.name ? ' selected' : ''}${open ? '' : ' locked'}`}
              style={open ? { borderColor: m.color } : undefined}
              disabled={!open}
              onClick={() => setMonarch(m)}
            >{open ? m.name : '🔒'}</button>
          })}
        </div>
        {locked && <p className="fine-print">下一位待解锁：<b>{locked}</b> —— 继续建立新朝，沉睡的魂魄会回应。</p>}
      </section>

      <section className="monarch-card" style={{ borderColor: monarch.color }}>
        <div>
          <p className="eyebrow">本局君王</p>
          <h2>{monarch.name} · {monarch.epithet}</h2>
          <p className="trait">「{monarch.trait}」　{monarch.passive}</p>
          <p className="active">专属抉择：{monarch.active}</p>
          <p className="starting-readout">初始天命：{quality(monarch.starting.destiny)} · 军势：{quality(monarch.starting.military)} · 朝局：{quality(monarch.starting.politics)} · 国库：{quality(monarch.starting.economy)}</p>
        </div>
      </section>

      <button className="start-btn" onClick={startRun}>开始鼎革 <span>→</span></button>
      <p className="fine-print">
        每一局的事件都会被四柱与朝堂关系重新改写 · 人才、军制与姻亲会持续影响王朝走向
        {meta.reigns.length > 0 && <> · 已收录国号：{meta.reigns.join('、')}</>}
      </p>
    </main>
  }
  if (run.status === 'running' && run.event.id.startsWith('challenge-')) return <main className="dynasty-app lobby-screen challenge-screen"><p className="eyebrow">{run.event.source}</p><EventIllustration event={run.event} /><h1>{run.event.title}</h1><p className="subtitle">{run.event.body}</p><section className="challenge-options">{run.event.options.map((option) => { const o = challengeOdds(option.success ?? 0.5, option.label, res(run), court(run)); return <button key={option.label} className="choice" onClick={() => resolveChallenge(option)}><strong>{option.label}</strong><span>{describeEffect(option.reward ?? option.effect, run.event.phase)} · {o.hint}</span></button> })}</section><p className="fine-print">军势、朝局、国库与天命会共同改变挑战走向；失利会留下真实伤痕。</p></main>
  const phase = phaseFor(run.eventCount)
  return <main className="dynasty-app"><header className="topbar"><div><p className="eyebrow">{run.monarch.name} · {run.monarch.epithet}</p><h1>鼎革：<span>王朝崛起</span></h1></div><div className={`timer ${run.elapsed > TIME_LIMIT * 0.75 ? 'urgent' : ''}`} title="时局越往后越紧，天命也可能在任何一刻断裂"><b>{timeWord(run.elapsed)}</b><small>时局脉动</small></div></header><section className="dashboard"><div className="phase-track">{PHASES.map((item, index) => <div key={item} className={`phase ${index <= PHASES.indexOf(phase) ? 'active' : ''}`}><span>{['一', '二', '三', '四', '五'][index]}</span>{item}</div>)}</div><div className="stats"><Stat label="军事" value={run.military} icon="⚔" /><Stat label="政治" value={run.politics} icon="⚖" /><Stat label="经济" value={run.economy} icon="🪙" /><Stat label="天命" value={run.destiny} icon="✦" /></div></section><div className="game-grid"><aside className="realm-panel"><p className="eyebrow">你的势力</p><h2>{run.city}</h2><p className="army-name">{run.armyType}</p><div className="map-grid">{CITIES.map((city) => <span key={city} className={run.cities.includes(city) ? 'owned' : ''}>{city}</span>)}</div><div className="roster"><p>人才名录</p><div>{run.talents.length ? run.talents.map((talent) => <span key={talent}>{talent}</span>) : <small>乱世尚未有人投效</small>}</div><p>配偶</p><strong>{isMarried(run.spouse) ? run.spouse : '尚未成家'}</strong></div><div className="boons"><p className="eyebrow">朝堂影响</p>{courtSummary(court(run)).length ? courtSummary(court(run)).map((line) => <span key={line}>{line}</span>) : <small>还没有人为你带来额外的助力</small>}</div></aside><section className="event-column"><div className="event-meta"><span>当幕：{run.event.phase}</span><span>{run.event.source}</span></div><article className="event-card"><EventIllustration event={run.event} /><div className="wax-seal">诏</div><p className="eyebrow">{run.event.phase} · {run.event.source.split(' · ')[0]}</p><h2>{run.event.title}</h2><p className="event-body">{run.event.body}</p><div className="choices">{run.event.options.map((option) => <button key={option.label} className={`choice${option.effect.death ? ' choice-risk' : ''}`} onClick={() => choose(option)}><strong>{option.label}</strong><span>{describeEffect(option.effect, run.event.phase)}</span>{option.effect.death && <em className="risk-tag">☠ 暗藏覆亡之险</em>}</button>)}</div>{!run.activeUsed && <button className="royal-btn" onClick={useActive}>👑 {run.monarch.active}（本局尚未动用）</button>}</article>{run.crisis && <div className="crisis-banner">⚠ {run.crisis}</div>}<div className="chronicle"><p className="eyebrow">起居注</p>{run.log.map((line, index) => <p key={`${line}-${index}`} className={index === 0 ? 'latest' : ''}>{line}</p>)}</div></section></div>{(run.status === 'victory' || run.status === 'defeat') && <div className="result-overlay"><div className={`result-card ${run.status}${run.endTitle === '万世之基' ? ' foundation-ending' : ''}`}><p className="eyebrow">{run.status === 'victory' ? `新朝已立 · ${run.reign ?? ''}` : '天命未成'}</p><h2>{run.endTitle ?? (run.status === 'victory' ? '天下换了姓' : '乱世吞没了你')}</h2><p>{run.ending}</p><div className="result-stats"><span>疆域：{realmQuality(run.cities.length)}</span><span>朝堂：{courtQuality(run.talents.length)}</span><span>天命：{quality(run.destiny)}</span></div>{run.unlockedName && <p className="unlock-note">🔓 解锁新君王：<b>{run.unlockedName}</b></p>}<button className="start-btn" onClick={() => setRun(null)}>再开一局 <span>→</span></button></div></div>}</main>
}
function timeWord(elapsed: number) {
  if (elapsed > TIME_LIMIT * 0.82) return '天命迫近'
  if (elapsed > TIME_LIMIT * 0.62) return '风雨欲来'
  if (elapsed > TIME_LIMIT * 0.35) return '时局渐紧'
  return '局势初定'
}

function realmQuality(cities: number) {
  if (cities <= 0) return '无立足处'
  if (cities <= 2) return '初有根基'
  if (cities <= 4) return '渐成疆域'
  return '四方归附'
}

function courtQuality(talents: number) {
  if (talents <= 0) return '群臣未聚'
  if (talents <= 2) return '略有人望'
  if (talents <= 4) return '朝堂渐成'
  return '贤才云集'
}

function Stat({ label, value, icon }: { label: string; value: number; icon: string }) { return <div className="stat"><span>{icon}</span><div><strong>{quality(value)}</strong><small>{label}</small></div></div> }

function EventIllustration({ event }: { event: GameEvent }) {
  const src = artForEvent(event.id)
  if (!src) return null
  return <div className="event-art"><img src={src} alt={`${event.title}场景插画`} loading="lazy" decoding="async" /></div>
}
