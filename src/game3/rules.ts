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
    res.grain = 4
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
export function challengeOdds(base: number, label: string, r: Resources): { odds: number; hint: string } {
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
  const odds = Math.max(0.15, Math.min(0.95, base + delta))
  return { odds, hint: bits.length ? `（${bits.join('、')}：${Math.round(odds * 100)}%）` : `（${Math.round(odds * 100)}%）` }
}

/** 挑战失败不再直接终结整局，而是付出真实代价。 */
export function challengeSetback(r: Resources): { res: Resources; message: string } {
  const res = { ...r }
  const lost = Math.max(8, Math.round(res.army * 0.3))
  res.army = Math.max(0, res.army - lost)
  res.morale = clamp(res.morale - 12)
  res.prestige = clamp(res.prestige - 8)
  res.grain = Math.max(0, res.grain - 10)
  return { res, message: `挑战失利：折损 ${lost} 兵，民心与威望皆挫，但你还没有倒下。` }
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
  // 以最高的一项决定王朝气质
  const top = Math.max(r.army, r.morale, r.prestige)
  if (top === r.army) {
    return {
      win: true, title: '马上得天下', reign: '武功之世',
      text: `你以 ${cities} 座城池与百战之师立国。边军的旗帜插到了从前无人抵达的地方——只是刀锋铸成的王座，也要用刀锋守着。`,
    }
  }
  if (top === r.morale) {
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
