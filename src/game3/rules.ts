// ---------- 鼎革：机制层 ----------
// 事件文案仍留在 App.tsx（tim.lu 所写），这里只放"让数值真正有意义"的规则：
// 君王特性、资源危机、阶段挑战修正、多结局判定。
// 单独成文件是为了尽量减少与 v3 原作者的改动冲突。

export interface Resources {
  grain: number
  silver: number
  morale: number
  prestige: number
  army: number
  stability: number
}

export type EffectLike = Partial<Resources> & {
  city?: string
  talent?: string
  spouse?: string
  armyType?: string
  death?: boolean
}

// ---------- 1. 君王特性：让 12 位君王真的不一样 ----------
/**
 * 每位君王一条被动。传入一次抉择的收益，返回修正后的收益。
 * `stage` 是已做出的抉择数，用于「前两幕」这类条件。
 */
export function applyPassive(monarchName: string, effect: EffectLike, stage: number): EffectLike {
  const e: EffectLike = { ...effect }
  const boost = (key: keyof Resources, mult: number) => {
    const v = e[key]
    if (typeof v === 'number' && v > 0) e[key] = Math.round(v * mult)
  }
  const soften = (mult: number) => {
    for (const key of ['grain', 'silver', 'morale', 'prestige', 'army', 'stability'] as (keyof Resources)[]) {
      const v = e[key]
      if (typeof v === 'number' && v < 0) e[key] = Math.round(v * mult)
    }
  }
  switch (monarchName) {
    case '嬴政': boost('prestige', 1.5); break                      // 威压：威望收益 +50%
    case '刘邦': if (e.talent) e.morale = (e.morale ?? 0) + 6; break // 市井：招揽人才额外收民心
    case '刘彻': boost('army', 1.35); break                          // 雄略：兵力收益 +35%
    case '李世民': soften(0.6); break                                // 纳谏：负面损失 -40%
    case '武曌': boost('stability', 1.4); break                      // 权谋：稳定收益 +40%
    case '赵匡胤': if ((e.army ?? 0) > 0) e.stability = (e.stability ?? 0) + 5; break // 收编：征兵更稳
    case '铁木真': boost('army', 1.25); boost('grain', 1.15); break  // 草原：兵粮兼收
    case '朱元璋': boost('grain', 1.4); break                        // 屯田：粮食收益 +40%
    case '朱棣': if (e.city) e.prestige = (e.prestige ?? 0) + 8; break // 北征：夺城更长威望
    case '曹操': if (e.talent) { boost('prestige', 2); e.silver = (e.silver ?? 0) + 10 } break // 唯才是举：谋士收益翻倍
    case '司马懿': if (stage < 8) soften(0.5); break                 // 蛰伏：前两幕损失减半
    case '忽必烈': boost('silver', 1.45); break                      // 通商：银两收益 +45%
  }
  return e
}

/** 每局一次的君王专属抉择，直接作用于当前资源。 */
export function applyActive(monarchName: string, r: Resources): { res: Resources; note: string } {
  const res = { ...r }
  let note = ''
  switch (monarchName) {
    case '嬴政': res.stability += 25; note = '书同文：稳定 +25'; break
    case '刘邦': res.morale += 25; note = '约法三章：民心 +25'; break
    case '刘彻': res.army += 25; note = '推恩：兵力 +25'; break
    case '李世民': res.prestige += 12; res.morale += 12; note = '天可汗：威望 +12、民心 +12'; break
    case '武曌': res.prestige += 20; note = '制诏：威望 +20'; break
    case '赵匡胤': res.army += 15; res.stability += 15; note = '陈桥：兵力 +15、稳定 +15'; break
    case '铁木真': res.army += 30; res.morale -= 5; note = '万户：兵力 +30，民心 -5'; break
    case '朱元璋': res.silver -= 10; res.morale += 22; note = '肃贪：银两 -10，民心 +22'; break
    case '朱棣': res.grain += 20; res.army += 12; note = '迁都：粮草 +20、兵力 +12'; break
    case '曹操': res.prestige += 25; note = '挟天子：威望 +25'; break
    case '司马懿': res.stability += 20; res.silver += 12; note = '隐忍：稳定 +20、银两 +12'; break
    case '忽必烈': res.silver += 28; res.grain += 12; note = '四海：银两 +28、粮草 +12'; break
    default: note = '天命未动'
  }
  res.morale = clamp(res.morale)
  res.prestige = clamp(res.prestige)
  res.stability = clamp(res.stability)
  return { res, note }
}

const clamp = (v: number) => Math.max(0, Math.min(100, v))

// ---------- 1b. 朝堂：让人才 / 军制 / 配偶不再只是摆设 ----------
// 原诊断第 7 条：这三类收集物会被记录并显示，却不影响任何数值。
// 现在它们各自提供一条常驻加成，让「招揽谁」「练什么兵」「与谁联姻」成为真抉择。
export interface Court {
  talents: string[]
  armyType: string
  spouse: string
}

export const TALENT_BOONS: Record<string, string> = {
  李靖: '军神：攻势挑战成功率 +8%',
  诸葛亮: '丞相：每次抉择稳定 +2，内政挑战 +8%',
  狄仁杰: '名相：稳定收益 +30%',
  戚继光: '练兵：兵力收益 +20%',
  张居正: '改革：银两收益 +25%，军需 -1',
  郭子仪: '柱国：挑战失利损失减半',
  卫青: '骑将：兵力损失 -40%',
  班超: '通西域：威望收益 +25%',
  范仲淹: '忧乐：民心收益 +30%',
  郑和: '下西洋：每次抉择银两 +3',
  司马懿: '隐忍：稳定收益 +20%',
}

export const ARMY_BOONS: Record<string, string> = {
  农民军: '就食于乡：军需减半，但兵力收益 -10%',
  边军骑兵: '来去如风：攻势挑战 +8%',
  火器新军: '摧城：攻势挑战 +12%，军需 +1',
  江南水师: '漕运：银两收益 +20%',
  亲军精锐: '腹心：稳定收益 +15%，挑战失利损失 -30%',
}

export const SPOUSE_BOONS: Record<string, string> = {
  关中豪族之女: '关中粮仓：粮草收益 +20%',
  江南商帮继承人: '商路：银两收益 +25%',
  辽东部族公主: '塞外战马：兵力收益 +15%',
  前朝宗室: '旧朝名分：威望收益 +25%',
  并肩作战的女将: '同袍：攻势挑战 +8%',
  盐商之女: '盐利：军需 -1',
}

const has = (court: Court, talent: string) => court.talents.includes(talent)

/** 朝堂加成作用于一次抉择的收益（在君王被动之后叠加）。 */
export function applyCourt(effect: EffectLike, court: Court): EffectLike {
  const e: EffectLike = { ...effect }
  const boost = (key: keyof Resources, mult: number) => {
    const v = e[key]
    if (typeof v === 'number' && v > 0) e[key] = Math.round(v * mult)
  }
  const softenKey = (key: keyof Resources, mult: number) => {
    const v = e[key]
    if (typeof v === 'number' && v < 0) e[key] = Math.round(v * mult)
  }

  if (has(court, '狄仁杰')) boost('stability', 1.3)
  if (has(court, '戚继光')) boost('army', 1.2)
  if (has(court, '张居正')) boost('silver', 1.25)
  if (has(court, '卫青')) softenKey('army', 0.6)
  if (has(court, '班超')) boost('prestige', 1.25)
  if (has(court, '范仲淹')) boost('morale', 1.3)
  if (has(court, '司马懿')) boost('stability', 1.2)

  if (court.armyType === '农民军') boost('army', 0.9)
  if (court.armyType === '江南水师') boost('silver', 1.2)
  if (court.armyType === '亲军精锐') boost('stability', 1.15)

  if (court.spouse === '关中豪族之女') boost('grain', 1.2)
  if (court.spouse === '江南商帮继承人') boost('silver', 1.25)
  if (court.spouse === '辽东部族公主') boost('army', 1.15)
  if (court.spouse === '前朝宗室') boost('prestige', 1.25)

  return e
}

/** 当前每次抉择要消耗多少粮草养军。 */
export function upkeepFor(r: Resources, court: Court): number {
  let cost = Math.max(1, Math.floor(r.army / 22))
  if (court.armyType === '农民军') cost = Math.max(1, Math.round(cost * 0.5))
  if (court.armyType === '火器新军') cost += 1
  if (has(court, '张居正')) cost -= 1
  if (court.spouse === '盐商之女') cost -= 1
  // 只要还有兵，就至少要吃一份粮——否则「张居正 + 农民军」会变成完全免费的军队
  return r.army > 0 ? Math.max(1, cost) : 0
}

/**
 * 每次抉择后的「幕后结算」：军队吃粮，部分朝臣带来常驻收入。
 * 这让粮草第一次成为真正的约束——养得起多少兵，才敢招多少兵。
 */
export function tick(r: Resources, court: Court): { res: Resources; upkeep: number } {
  const res = { ...r }
  const cost = upkeepFor(res, court)
  res.grain = Math.max(0, res.grain - cost)
  if (has(court, '郑和')) res.silver += 3
  if (has(court, '诸葛亮')) res.stability = clamp(res.stability + 2)
  return { res, upkeep: cost }
}

/** 朝堂当前生效的加成清单，用于在界面上告诉玩家「你的选择确实有用」。 */
export function courtSummary(court: Court): string[] {
  const out: string[] = []
  for (const t of court.talents) if (TALENT_BOONS[t]) out.push(`${t} · ${TALENT_BOONS[t]}`)
  if (ARMY_BOONS[court.armyType]) out.push(`${court.armyType} · ${ARMY_BOONS[court.armyType]}`)
  if (SPOUSE_BOONS[court.spouse]) out.push(`${court.spouse} · ${SPOUSE_BOONS[court.spouse]}`)
  return out
}

// ---------- 2. 资源危机：让粮草、民心、稳定真的有牙齿 ----------
export interface Crisis {
  res: Resources
  message: string
  fatal: boolean
}

/**
 * 每次抉择后结算。资源见底会带来真实后果，而不是只让数字变小。
 */
export function checkCrisis(r: Resources): Crisis | null {
  const res = { ...r }
  // 断粮：军队自行溃散
  if (res.grain <= 0 && res.army > 0) {
    const lost = Math.max(6, Math.round(res.army * 0.25))
    res.army = Math.max(0, res.army - lost)
    res.morale = clamp(res.morale - 8)
    // 溃散的士卒也带走了自己那份口粮：留出几回合喘息，
    // 否则军需会让你下一回合立刻再次断粮，陷入无解的连环危机。
    res.grain = 12
    return { res, message: `军中断粮，${lost} 名士卒溃散离营。`, fatal: res.army <= 0 && res.morale <= 10 }
  }
  // 民心尽失：民变，稳定与兵力同时受损
  if (res.morale <= 8) {
    res.stability = clamp(res.stability - 15)
    res.army = Math.max(0, res.army - 8)
    res.morale = 14
    return { res, message: '民心尽失，各地民变四起。', fatal: res.stability <= 0 }
  }
  // 政权失稳：银两被贪墨，威望滑落
  if (res.stability <= 5) {
    res.silver = Math.max(0, res.silver - 12)
    res.prestige = clamp(res.prestige - 10)
    res.stability = 12
    return { res, message: '政令不出营门，府库亦被贪墨。', fatal: false }
  }
  return null
}

// ---------- 3. 阶段挑战：让成功率与你的经营挂钩 ----------
/**
 * 原本是纯掷骰子；现在你的资源会真的影响胜算（上下浮动约 ±18%）。
 * 返回修正后的成功率与说明。
 */
export function challengeOdds(base: number, label: string, r: Resources, court?: Court): { odds: number; hint: string } {
  let delta = 0
  const bits: string[] = []
  const add = (cond: boolean, amount: number, text: string) => {
    if (cond) { delta += amount; bits.push(text) }
  }
  const aggressive = /攻|破|夺|登城|镇压|冒险|夜渡/.test(label)
  if (aggressive) {
    add(r.army >= 60, 0.14, '兵强')
    add(r.army <= 25, -0.12, '兵弱')
    add(r.grain >= 50, 0.05, '粮足')
    add(r.grain <= 12, -0.08, '粮匮')
  } else {
    add(r.prestige >= 45, 0.12, '威望素著')
    add(r.silver >= 45, 0.08, '重金开道')
    add(r.morale >= 60, 0.05, '民心所向')
    add(r.stability <= 20, -0.1, '内政不稳')
  }
  // 朝堂：招来的人才与练成的军制，在关键关头会说话
  if (court) {
    if (aggressive) {
      add(has(court, '李靖'), 0.08, '李靖用兵')
      add(court.armyType === '边军骑兵', 0.08, '骑兵疾进')
      add(court.armyType === '火器新军', 0.12, '火器摧城')
      add(court.spouse === '并肩作战的女将', 0.08, '同袍并肩')
    } else {
      add(has(court, '诸葛亮'), 0.08, '孔明筹划')
    }
  }
  const odds = Math.max(0.15, Math.min(0.95, base + delta))
  return { odds, hint: bits.length ? `（${bits.join('、')}：${Math.round(odds * 100)}%）` : `（${Math.round(odds * 100)}%）` }
}

/** 挑战失败不再直接终结整局，而是付出真实代价。 */
export function challengeSetback(r: Resources, court?: Court): { res: Resources; message: string } {
  const res = { ...r }
  // 郭子仪坐镇 / 亲军精锐断后，都能把一场败仗变成撤退
  let mult = 1
  let saved = ''
  if (court && has(court, '郭子仪')) { mult *= 0.5; saved = '郭子仪亲自断后，' }
  if (court && court.armyType === '亲军精锐') { mult *= 0.7; saved = saved || '亲军死战断后，' }
  const lost = Math.max(4, Math.round(res.army * 0.3 * mult))
  res.army = Math.max(0, res.army - lost)
  res.morale = clamp(res.morale - Math.round(12 * mult))
  res.prestige = clamp(res.prestige - Math.round(8 * mult))
  res.grain = Math.max(0, res.grain - Math.round(10 * mult))
  return { res, message: `挑战失利：${saved}折损 ${lost} 兵，民心与威望皆挫，但你还没有倒下。` }
}

// ---------- 4. 多结局：让最终数值真的决定你建立了什么样的王朝 ----------
export interface Ending {
  win: boolean
  title: string
  reign: string // 国号 / 治世风格
  text: string
}

export function resolveEnding(r: Resources, cities: number, talents: number): Ending {
  // 立国门槛：不再是三选一的低标准，而要求真正经营过
  const pillars = [r.army >= 55, r.morale >= 60, r.prestige >= 55].filter(Boolean).length
  const foundation = r.stability >= 30 && r.grain > 0
  // 疆域与朝堂也算数：城多、贤才多，本身就是一种立国资本
  const support = (cities >= 4 ? 1 : 0) + (talents >= 4 ? 1 : 0)
  if (pillars === 0 || !foundation) {
    return {
      win: false,
      title: '乱世吞没了你',
      reign: '无号',
      text: r.stability < 30
        ? '你夺下了城，却始终没能把权力变成秩序。新朝还未诞生，诸侯已开始争夺你的遗产。'
        : '府库空空、军心涣散。天命在你指间滑过，史书只留下一行姓名。',
    }
  }
  // 最高结局：三根支柱立住两根，且疆域或朝堂也撑得起来
  if (pillars >= 2 && support >= 1 && r.stability >= 45) {
    return {
      win: true, title: '万世之基', reign: '开元之世',
      text: `${cities} 座城、${talents} 位贤才、一支养得起的军队——你留下的不是一次胜利，而是一套能自己运转下去的秩序。史官写：此非一人之功，乃一朝之始。`,
    }
  }
  // 以最高的一项决定王朝气质。
  // 注意：兵力没有上限，民心与威望封顶 100——直接比大小的话兵力永远胜出，
  // 「仁政之世」会变成不可达结局。因此比的是各自超出立国门槛的倍数。
  const byArmy = r.army / 55
  const byMorale = r.morale / 60
  const byPrestige = r.prestige / 55
  const top = Math.max(byArmy, byMorale, byPrestige)
  if (top === byArmy) {
    return {
      win: true, title: '马上得天下', reign: '武功之世',
      text: `你以 ${cities} 座城池与百战之师立国。边军的旗帜插到了从前无人抵达的地方——只是刀锋铸成的王座，也要用刀锋守着。`,
    }
  }
  if (top === byMorale) {
    return {
      win: true, title: '民心所归', reign: '仁政之世',
      text: `你没有屠过一座城。百姓在新朝的第一个春天照常播种，${talents} 位贤才在朝堂上争论如何轻徭薄赋——这是乱世最难得的声音。`,
    }
  }
  return {
    win: true, title: '万邦来朝', reign: '正统之世',
    text: `玉玺、诏书与礼乐都归于你。四方使节在新都排到宫门外，他们承认的不只是你的兵力，而是你这个"名分"。`,
  }
}
