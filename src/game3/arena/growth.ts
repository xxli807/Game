import type { Effect, HeroDef, Scale, SkillDef } from './data'

// 成长：每升一级三选一。纯数据 + 纯函数，sim.ts 负责状态与结算。
//   技能精进：三个技能各三阶，第三阶「觉醒」改变技能的样子而不只是数值。
//   自动武学：拿到就自己出手的新技能（飞剑、雷法、箭雨……），每局最多三门，各三阶。
//   心法：小而稳的被动。
// 敌我 AI 也按同一套规则抽卡，所以不会让玩家单方面变强。

export type AutoId = 'orbit' | 'bolt' | 'rain' | 'aura' | 'frost' | 'drum' | 'summon' | 'ward'
export type PerkId = 'crit' | 'vamp' | 'swift' | 'vigor' | 'haste' | 'focus' | 'greed'
export type Card = { kind: 'skill'; slot: number } | { kind: 'auto'; id: AutoId } | { kind: 'perk'; id: PerkId }
export const SKILL_RANKS = 3
export const AUTO_RANKS = 3
export const MAX_AUTOS = 3

export const AUTOS: Record<AutoId, { name: string; glyph: string; color: string; ranks: [string, string, string] }> = {
  orbit: { name: '飞剑', glyph: '剑', color: '#9fe3ff', ranks: ['两柄飞剑绕身旋转，划伤靠近的敌人', '飞剑增至三柄，伤害提升', '飞剑增至四柄，转得更快'] },
  bolt: { name: '雷法', glyph: '雷', color: '#c9b4ff', ranks: ['每 3 秒一道落雷劈向最近的敌人', '落雷更频繁、更重', '落雷连锁跳向另外两个敌人'] },
  rain: { name: '箭雨', glyph: '矢', color: '#ffd38a', ranks: ['每 6 秒一阵箭雨覆盖敌人所在处', '箭雨范围与伤害提升', '箭雨附带减速，间隔缩短'] },
  aura: { name: '火环', glyph: '炎', color: '#ff8a4a', ranks: ['身周燃起火环，持续灼烧贴身的敌人', '火环更大、更烫', '火环再扩大，灼烧加剧'] },
  frost: { name: '寒霜', glyph: '霜', color: '#bfe8ff', ranks: ['每 5 秒寒气炸开，伤害并减速四周敌人', '寒气范围与伤害提升', '寒气同时冻住敌人片刻'] },
  drum: { name: '战鼓', glyph: '鼓', color: '#ffe07a', ranks: ['每 9 秒擂鼓，附近友军攻速提升', '鼓声更响，加成更高', '鼓声同时让友军加速'] },
  summon: { name: '亲兵', glyph: '兵', color: '#8fd08a', ranks: ['每 20 秒召出两名亲兵随你推线', '召唤更频繁，亲兵更壮', '每次召出三名亲兵'] },
  ward: { name: '护体', glyph: '护', color: '#d8f0ff', ranks: ['每 12 秒自动套上护盾', '护盾更厚、更频繁', '护盾大幅加厚'] },
}
export const AUTO_IDS = Object.keys(AUTOS) as AutoId[]

export const PERKS: Record<PerkId, { name: string; glyph: string; desc: string; max: number }> = {
  crit: { name: '会心', glyph: '击', desc: '普攻 12% 几率暴击（1.8 倍）', max: 3 },
  vamp: { name: '嗜血', glyph: '噬', desc: '普攻吸血 +8%', max: 3 },
  swift: { name: '疾行', glyph: '疾', desc: '移速 +20', max: 3 },
  vigor: { name: '强体', glyph: '体', desc: '最大生命 +10%', max: 3 },
  haste: { name: '连击', glyph: '连', desc: '攻速 +15%', max: 3 },
  focus: { name: '凝神', glyph: '神', desc: '技能冷却 −8%', max: 3 },
  greed: { name: '聚财', glyph: '财', desc: '击杀与补刀金币 +25%', max: 2 },
}
export const PERK_IDS = Object.keys(PERKS) as PerkId[]

// ---- skill ranks and awakening ----
const AWAKEN: Record<Effect['t'], string> = {
  shot: '多射两道并贯穿', cone: '扇面大开并附带晕眩', blast: '炸后留下灼烧之地', dash: '冲得更远并撞晕敌人',
  zone: '范围暴涨，敌人寸步难行', buff: '效果延长并惠及身边友军', blink: '落地时震爆四周',
}
/** What a skill's awakening does, named after its main effect. */
export function awakeningText(skill: SkillDef) { return AWAKEN[mainEffect(skill).t] }
const mainEffect = (skill: SkillDef) => skill.fx.find(f => 'dmg' in f && f.dmg) ?? skill.fx[0]
const grow = (s: Scale, k: number): Scale => [s[0] * k, s[1] * k, s[2] * k]

/** Damage, size and cooldown multipliers for a skill rank (0 = as designed). */
export const rankScale = (rank: number) => ({ dmg: 1 + 0.25 * rank, size: 1 + 0.12 * rank, cd: 1 - 0.08 * rank })

/** A skill's effects at a given rank; rank 3 adds its awakening. */
export function tuneSkill(skill: SkillDef, rank: number): Effect[] {
  if (rank <= 0) return skill.fx
  const k = rankScale(rank), awake = rank >= SKILL_RANKS, main = mainEffect(skill)
  const out = skill.fx.map((fx): Effect => {
    const lead = fx === main && awake
    switch (fx.t) {
      case 'dash': return { ...fx, dist: fx.dist * (lead ? 1.4 : 1), dmg: fx.dmg && grow(fx.dmg, k.dmg), width: (fx.width ?? 0) * k.size, stun: lead ? Math.max(fx.stun ?? 0, 0.6) : fx.stun }
      case 'shot': return { ...fx, dmg: grow(fx.dmg, k.dmg), width: fx.width * k.size, count: (fx.count ?? 1) + (lead ? 2 : 0), spread: lead ? Math.max(fx.spread ?? 0, 0.16) : fx.spread, pierce: fx.pierce || lead }
      case 'cone': return { ...fx, dmg: grow(fx.dmg, k.dmg), radius: fx.radius * k.size, arc: lead ? Math.min(Math.PI * 2, fx.arc * 1.6) : fx.arc, stun: lead ? Math.max(fx.stun ?? 0, 0.5) : fx.stun }
      case 'blast': return { ...fx, dmg: grow(fx.dmg, k.dmg), radius: fx.radius * k.size }
      case 'zone': return { ...fx, dmg: grow(fx.dmg, k.dmg), radius: fx.radius * k.size * (lead ? 1.3 : 1), duration: fx.duration + (lead ? 1.5 : 0) }
      case 'buff': return { ...fx, dur: fx.dur * (awake && main.t === 'buff' ? 1.5 : 1), shield: fx.shield && grow(fx.shield, k.dmg), heal: fx.heal && grow(fx.heal, k.dmg), allies: awake && main.t === 'buff' ? Math.max(fx.allies ?? 0, 500) : fx.allies }
      case 'blink': return fx
    }
  })
  if (awake && main.t === 'blast') { const b = main as Extract<Effect, { t: 'blast' }>; out.push({ t: 'zone', radius: b.radius * k.size, duration: 2.5, dmg: grow(b.dmg, 0.18 * k.dmg) }) }
  if (awake && main.t === 'blink') out.push({ t: 'blast', radius: 220, delay: 0.1, dmg: [220, 30, 0.6] })
  return out
}

// ---- offers ----
export type Growth = { ranks: number[]; autos: { id: AutoId; rank: number }[]; perks: Partial<Record<PerkId, number>> }
export function candidates(g: Growth, ultUnlocked: boolean): { card: Card; weight: number }[] {
  const out: { card: Card; weight: number }[] = []
  g.ranks.forEach((rank, slot) => { if (rank < SKILL_RANKS && (slot < 2 || ultUnlocked)) out.push({ card: { kind: 'skill', slot }, weight: slot === 2 ? 3.5 : 3 }) })
  for (const a of g.autos) if (a.rank < AUTO_RANKS) out.push({ card: { kind: 'auto', id: a.id }, weight: 2.6 })
  if (g.autos.length < MAX_AUTOS) for (const id of AUTO_IDS) if (!g.autos.some(a => a.id === id)) out.push({ card: { kind: 'auto', id }, weight: 3.2 / AUTO_IDS.length * 3 })
  for (const id of PERK_IDS) if ((g.perks[id] ?? 0) < PERKS[id].max) out.push({ card: { kind: 'perk', id }, weight: 1.1 })
  return out
}
export const sameCard = (a: Card, b: Card) => a.kind === b.kind && (a.kind === 'skill' ? a.slot === (b as typeof a).slot : a.id === (b as typeof a).id)
/** Three distinct weighted picks; the first option is always a skill or martial art when any exist. */
export function drawOffer(g: Growth, ultUnlocked: boolean, random: () => number): Card[] {
  let pool = candidates(g, ultUnlocked)
  const picks: Card[] = []
  while (picks.length < 3 && pool.length) {
    const wantPower = picks.length === 0 && pool.some(c => c.card.kind !== 'perk')
    const from = wantPower ? pool.filter(c => c.card.kind !== 'perk') : pool
    let roll = random() * from.reduce((s, c) => s + c.weight, 0)
    const chosen = from.find(c => (roll -= c.weight) <= 0) ?? from[from.length - 1]
    picks.push(chosen.card)
    pool = pool.filter(c => !sameCard(c.card, chosen.card))
  }
  return picks
}

/** Display text for a card, for the HUD and the regression. */
export function describe(card: Card, g: Growth, def: HeroDef) {
  if (card.kind === 'skill') {
    const skill = def.skills[card.slot], rank = g.ranks[card.slot]
    const next = rank + 1
    return { tag: next >= SKILL_RANKS ? '觉醒' : '精进', glyph: skill.glyph, title: `${skill.name} ${'Ⅰ Ⅱ Ⅲ'.split(' ')[rank]}`, desc: next >= SKILL_RANKS ? `觉醒：${awakeningText(skill)}` : `伤害 +25%、范围 +12%、冷却 −8%`, color: def.color, rank, max: SKILL_RANKS }
  }
  if (card.kind === 'auto') {
    const a = AUTOS[card.id], owned = g.autos.find(x => x.id === card.id), rank = owned?.rank ?? 0
    return { tag: owned ? '武学精进' : '新武学', glyph: a.glyph, title: `${a.name}${owned ? ` ${'Ⅰ Ⅱ Ⅲ'.split(' ')[rank]}` : ''}`, desc: a.ranks[Math.min(AUTO_RANKS - 1, rank)], color: a.color, rank, max: AUTO_RANKS }
  }
  const p = PERKS[card.id], stacks = g.perks[card.id] ?? 0
  return { tag: '心法', glyph: p.glyph, title: `${p.name}${stacks ? ` ×${stacks + 1}` : ''}`, desc: p.desc, color: '#d8c79a', rank: stacks, max: p.max }
}
