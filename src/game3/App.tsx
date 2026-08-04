import { useEffect, useMemo, useState } from 'react'

type Phase = '蛰伏' | '立足' | '逐鹿' | '问鼎' | '建国'
type Status = 'running' | 'victory' | 'defeat'
type Monarch = { name: string; epithet: string; passive: string; active: string; trait: string; color: string }
type Effect = { grain?: number; silver?: number; morale?: number; prestige?: number; army?: number; city?: string; talent?: string; spouse?: string; armyType?: string; stability?: number; death?: boolean }
type EventOption = { label: string; detail: string; effect: Effect; success?: number; reward?: Effect }
type GameEvent = { id: string; title: string; body: string; source: string; options: EventOption[]; phase: Phase }
type Run = { monarch: Monarch; status: Status; elapsed: number; eventCount: number; event: GameEvent; deck: GameEvent[]; cursor: number; grain: number; silver: number; morale: number; prestige: number; army: number; stability: number; city: string; cities: string[]; talents: string[]; spouse: string; armyType: string; log: string[]; ending?: string }

const MONARCHS: Monarch[] = [
  { name: '嬴政', epithet: '秦始皇', passive: '威压：威望事件收益提高', active: '书同文：立刻稳定一座城市', trait: '集权', color: '#b64b3b' },
  { name: '刘邦', epithet: '汉高祖', passive: '市井：平民人才更容易投效', active: '约法三章：民心大幅上升', trait: '用人', color: '#8d5b31' },
  { name: '刘彻', epithet: '汉武帝', passive: '雄略：军队上限更高', active: '推恩：令一名敌将归顺', trait: '远征', color: '#6a4b88' },
  { name: '李世民', epithet: '唐太宗', passive: '纳谏：负面事件损失降低', active: '天可汗：与外族交易一次', trait: '开明', color: '#4b688d' },
  { name: '武曌', epithet: '武则天', passive: '任人唯才：无视出身招揽人才', active: '制诏：重抽当前事件', trait: '权谋', color: '#8c3d68' },
  { name: '赵匡胤', epithet: '宋太祖', passive: '杯酒释兵权：军队稳定更高', active: '陈桥：夺取一座无主城市', trait: '收编', color: '#53735c' },
  { name: '铁木真', epithet: '成吉思汗', passive: '疾驰：骑兵路线额外行动', active: '万户：招募一支骑兵', trait: '草原', color: '#6d7352' },
  { name: '朱元璋', epithet: '明太祖', passive: '屯田：粮食短缺时仍能征兵', active: '肃贪：银两换取民心', trait: '草根', color: '#a33b36' },
  { name: '朱棣', epithet: '永乐帝', passive: '北征：攻城事件更强', active: '迁都：刷新城市方向', trait: '雄主', color: '#3f6d78' },
  { name: '曹操', epithet: '魏武帝', passive: '唯才是举：谋士带来的收益翻倍', active: '挟天子：立即获得正统性', trait: '枭雄', color: '#47515c' },
  { name: '司马懿', epithet: '晋宣帝', passive: '蛰伏：前两幕损失降低', active: '隐忍：跳过一次负面事件', trait: '耐心', color: '#53636a' },
  { name: '忽必烈', epithet: '元世祖', passive: '通商：银两与粮食交易更划算', active: '四海：外族盟约不降低威望', trait: '融合', color: '#5b6b43' },
]
const CITIES = ['西安', '太原', '北京', '济南', '南京', '武昌', '成都', '杭州', '广州', '山海关']
const TALENTS = ['李靖', '诸葛亮', '狄仁杰', '戚继光', '张居正', '郭子仪', '卫青', '班超', '范仲淹', '郑和']
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

const generatedEvents: GameEvent[] = Array.from({ length: 83 }, (_, index) => {
  const talent = TALENTS[index % TALENTS.length]; const city = CITIES[index % CITIES.length]; const phase = PHASES[index % 4]; const positive = index % 2 === 0
  return { id: `rumor-${index + 1}`, title: positive ? `乱世传闻 · ${index + 1}` : `烽烟急报 · ${index + 1}`, body: positive ? `${city}传来消息：一位不甘沉沦的能人正在等待新的旗帜。` : `敌军趁夜渡河，${city}的粮道和城门同时传来坏消息。`, source: `随机事件 · ${city}`, phase, options: positive ? [{ label: `招揽${talent}`, detail: '获得人才，威望 +4', effect: { talent, prestige: 4 } }, { label: `整顿${city}`, detail: '稳定 +12，银两 -6', effect: { stability: 12, silver: -6 } }] : [{ label: '调兵迎战', detail: '兵力 +12，粮草 -8', effect: { army: 12, grain: -8 } }, { label: '闭城待变', detail: '稳定 +8，威望 -3', effect: { stability: 8, prestige: -3 } }] }
})
const TOTAL_EVENTS = authoredEvents.length + generatedEvents.length
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
const clamp = (value: number) => Math.max(0, Math.min(100, value))
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
const prepareDeck = () => {
  const seenEvents = new Set<string>()
  const seenTalents = new Set<string>()
  return shuffle([...authoredEvents, ...generatedEvents]).filter((event) => {
    if (seenEvents.has(event.id)) return false
    seenEvents.add(event.id)
    return true
  }).map((event) => ({ ...event, options: event.options.map((option) => {
    const talent = option.effect.talent
    if (!talent || !seenTalents.has(talent)) {
      if (talent) seenTalents.add(talent)
      return option
    }
    return { ...option, label: '收取谢礼', detail: '该人才已在本局出现，改得银两 +10', effect: { ...option.effect, talent: undefined, silver: (option.effect.silver ?? 0) + 10 } }
  }) }))
}
const createRun = (monarch: Monarch): Run => { const deck = prepareDeck(); return { monarch, status: 'running', elapsed: 0, eventCount: 0, event: deck[0], deck, cursor: 1, grain: 42, silver: 28, morale: 48, prestige: 12, army: 28, stability: 50, city: '无名营地', cities: [], talents: [], spouse: SPOUSES[0], armyType: ARMIES[0], log: ['你在明末乱世中醒来。旧王朝正在崩塌，而你的天命尚未写下。'] } }

export default function App() {
  const [monarch, setMonarch] = useState(() => MONARCHS[Math.floor(Math.random() * MONARCHS.length)])
  const [run, setRun] = useState<Run | null>(null)
  const eventTotal = useMemo(() => TOTAL_EVENTS, [])
  useEffect(() => {
    if (!run || run.status !== 'running' || run.event.id.startsWith('challenge-')) return
    const boundary = [4, 8, 12, 16, 20].indexOf(run.eventCount)
    if (boundary < 0) return
    setRun((current) => current && current.status === 'running' && current.eventCount === run.eventCount && !current.event.id.startsWith('challenge-') ? { ...current, event: CHALLENGES[boundary] } : current)
  }, [run?.eventCount, run?.event.id, run?.status])
  const choose = (option: EventOption) => setRun((current) => { if (!current || current.status !== 'running') return current; const effect = option.effect; const cities = effect.city && !current.cities.includes(effect.city) ? [...current.cities, effect.city] : current.cities; const talents = effect.talent && !current.talents.includes(effect.talent) ? [...current.talents, effect.talent].slice(-6) : current.talents; const nextCount = current.eventCount + 1; const next: Run = { ...current, eventCount: nextCount, elapsed: Math.min(599, current.elapsed + 18), event: nextCount >= 20 ? FINAL_EVENT : current.deck[current.cursor] ?? current.deck[0], cursor: nextCount >= 20 ? current.cursor : current.cursor + 1, grain: Math.max(0, current.grain + (effect.grain ?? 0)), silver: Math.max(0, current.silver + (effect.silver ?? 0)), morale: clamp(current.morale + (effect.morale ?? 0)), prestige: clamp(current.prestige + (effect.prestige ?? 0)), army: Math.max(0, current.army + (effect.army ?? 0)), stability: clamp(current.stability + (effect.stability ?? 0)), city: effect.city ?? current.city, cities, talents, spouse: effect.spouse ?? current.spouse, armyType: effect.armyType ?? current.armyType, log: [`${current.event.title}：${option.label}`, ...current.log].slice(0, 5) }; if (current.event.id === 'founding') { const enough = current.army >= 45 || current.morale >= 65 || current.prestige >= 55; return { ...next, status: enough ? 'victory' : 'defeat', ending: enough ? '你在旧王朝的废墟上立起新旗。天下尚未太平，但新的年号已经传遍四方。' : '你夺下了城，却没有守住天下。新朝还未诞生，诸侯已经开始争夺你的遗产。' } }; return next })
  const resolveChallenge = (option: EventOption) => setRun((current) => {
    if (!current || current.status !== 'running' || !option.success) return current
    if (Math.random() >= option.success) return { ...current, status: 'defeat', ending: `阶段挑战失败：${current.event.title}。你的势力在关键关口溃散，无法继续鼎革。` }
    const reward = option.reward ?? {}
    const cities = reward.city && !current.cities.includes(reward.city) ? [...current.cities, reward.city] : current.cities
    const nextCount = current.eventCount + 1
    return { ...current, eventCount: nextCount, event: nextCount >= 21 ? FINAL_EVENT : current.deck[current.cursor] ?? current.deck[0], cursor: nextCount >= 21 ? current.cursor : current.cursor + 1, grain: Math.max(0, current.grain + (reward.grain ?? 0)), silver: Math.max(0, current.silver + (reward.silver ?? 0)), morale: clamp(current.morale + (reward.morale ?? 0)), prestige: clamp(current.prestige + (reward.prestige ?? 0)), army: Math.max(0, current.army + (reward.army ?? 0)), stability: clamp(current.stability + (reward.stability ?? 0)), city: reward.city ?? current.city, cities, log: [`${current.event.title}：挑战成功，${option.label}`, ...current.log].slice(0, 5) }
  })
  if (!run) return <main className="dynasty-app lobby-screen"><div className="lobby-seal">鼎</div><p className="eyebrow">明末 · 天命肉鸽</p><h1>鼎革：<span>王朝崛起</span></h1><p className="subtitle">天下大乱，旧朝将倾。随机君王的魂魄降临末世，十分钟内写下新王朝的第一章。</p><section className="monarch-card" style={{ borderColor: monarch.color }}><div><p className="eyebrow">本局君王</p><h2>{monarch.name} · {monarch.epithet}</h2><p className="trait">「{monarch.trait}」　{monarch.passive}</p><p className="active">专属抉择：{monarch.active}</p></div><button className="ghost-btn" onClick={() => setMonarch(MONARCHS[Math.floor(Math.random() * MONARCHS.length)])}>换一位</button></section><button className="start-btn" onClick={() => setRun(createRun(monarch))}>开始鼎革 <span>→</span></button><p className="fine-print">本局从 {eventTotal} 个事件中抽取 20 个 · 每次选择推进乱世</p></main>
  if (run.city === '中道崩殂') return <main className="dynasty-app lobby-screen"><div className="lobby-seal">殁</div><p className="eyebrow">史册 · 中道崩殂</p><h1>天命<span>未竟</span></h1><p className="subtitle">你的君王倒在乱世途中。群臣争论继承，诸侯重新举旗；史官只留下四个字：中道崩殂。</p><button className="start-btn" onClick={() => setRun(null)}>返回乱世 <span>→</span></button></main>
  if (run.status === 'running' && run.event.id.startsWith('challenge-')) return <main className="dynasty-app lobby-screen challenge-screen"><p className="eyebrow">{run.event.source}</p><h1>{run.event.title}</h1><p className="subtitle">{run.event.body}</p><section className="challenge-options">{run.event.options.map((option) => <button key={option.label} className="choice" onClick={() => resolveChallenge(option)}><strong>{option.label}</strong><span>{option.detail}</span></button>)}</section><p className="fine-print">挑战失败将结束本局；成功后才可进入下一阶段。</p></main>
  const phase = phaseFor(run.eventCount)
  return <main className="dynasty-app"><header className="topbar"><div><p className="eyebrow">{run.monarch.name} · {run.monarch.epithet}</p><h1>鼎革：<span>王朝崛起</span></h1></div><div className={`timer ${run.elapsed > 480 ? 'urgent' : ''}`}>⏳ {formatTime(600 - run.elapsed)}</div></header><section className="dashboard"><div className="phase-track">{PHASES.map((item, index) => <div key={item} className={`phase ${index <= PHASES.indexOf(phase) ? 'active' : ''}`}><span>{index + 1}</span>{item}</div>)}</div><div className="stats"><Stat label="粮草" value={run.grain} icon="🌾" /><Stat label="银两" value={run.silver} icon="🪙" /><Stat label="民心" value={run.morale} icon="❤" /><Stat label="威望" value={run.prestige} icon="★" /><Stat label="兵力" value={run.army} icon="⚔" /></div></section><div className="game-grid"><aside className="realm-panel"><p className="eyebrow">你的势力</p><h2>{run.city}</h2><p className="army-name">{run.armyType}</p><div className="map-grid">{CITIES.map((city) => <span key={city} className={run.cities.includes(city) ? 'owned' : ''}>{city}</span>)}</div><div className="roster"><p>人才 {run.talents.length}/6</p><div>{run.talents.length ? run.talents.map((talent) => <span key={talent}>{talent}</span>) : <small>乱世尚未有人投效</small>}</div><p>配偶</p><strong>{run.spouse}</strong></div></aside><section className="event-column"><div className="event-meta"><span>第 {Math.min(run.eventCount + 1, 21)} / 21 个抉择</span><span>{run.event.source}</span></div><article className="event-card"><div className="wax-seal">诏</div><p className="eyebrow">{run.event.phase} · {run.event.source.split(' · ')[0]}</p><h2>{run.event.title}</h2><p className="event-body">{run.event.body}</p><div className="choices">{run.event.options.map((option) => <button key={option.label} className="choice" onClick={() => choose(option)}><strong>{option.label}</strong><span>{option.detail}</span></button>)}</div></article><div className="chronicle"><p className="eyebrow">起居注</p>{run.log.map((line, index) => <p key={`${line}-${index}`} className={index === 0 ? 'latest' : ''}>{line}</p>)}</div></section></div>{(run.status === 'victory' || run.status === 'defeat') && <div className="result-overlay"><div className={`result-card ${run.status}`}><p className="eyebrow">{run.status === 'victory' ? '新朝已立' : '天命未成'}</p><h2>{run.status === 'victory' ? '天下换了姓' : '乱世吞没了你'}</h2><p>{run.ending}</p><div className="result-stats"><span>城市 {run.cities.length}</span><span>人才 {run.talents.length}</span><span>抉择 {run.eventCount}</span></div><button className="start-btn" onClick={() => setRun(null)}>再开一局 <span>→</span></button></div></div>}</main>
}
function Stat({ label, value, icon }: { label: string; value: number; icon: string }) { return <div className="stat"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div> }
