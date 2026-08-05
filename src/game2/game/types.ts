// ---------- Core stat block shared by meta + in-run upgrades ----------
export interface Stats {
  maxHp: number
  hpRegen: number
  maxRage: number
  manaRegen: number
  moveSpeed: number
  pickupRadius: number

  // sword (auto-attack)
  swordDamage: number
  attackInterval: number
  swordRange: number
  swordArc: number
  cleave: number
  crit: number
  critMult: number
  lifesteal: number
  thorns: number

  // Warrior active-skill tuning
  dashDamage: number
  dashRange: number
  dashCd: number
  dashRage: number
  whirlDamage: number
  whirlRadius: number
  whirlCd: number
  whirlRage: number
  fireDamage: number
  fireCount: number
  fireCd: number
  fireRage: number
  fireRadius: number
  ultDamage: number
  ultRadius: number
  ultMeteors: number
  ultCd: number
  ultRage: number
  healAmount: number
  shieldTime: number
  healCd: number
  healRage: number
}

export function baseStats(): Stats {
  return {
    maxHp: 220,
    hpRegen: 3,
    maxRage: 100,
    manaRegen: 6,
    moveSpeed: 240,
    pickupRadius: 110,

    swordDamage: 12,
    attackInterval: 0.42,
    swordRange: 120,
    swordArc: Math.PI * 0.85,
    cleave: 6,
    crit: 0.05,
    critMult: 2,
    lifesteal: 0,
    thorns: 0,

    dashDamage: 25,
    dashRange: 240,
    dashCd: 0,
    dashRage: 20,
    whirlDamage: 34,
    whirlRadius: 145,
    whirlCd: 0,
    whirlRage: 15,
    fireDamage: 48,
    fireCount: 1,
    fireCd: 0,
    fireRage: 30,
    fireRadius: 115,
    ultDamage: 0,
    ultRadius: 190,
    ultMeteors: 0,
    ultCd: 0,
    ultRage: 25,
    healAmount: 0,
    shieldTime: 2.4,
    healCd: 0,
    healRage: 35,
  }
}

export interface MetaState {
  bestStage: number
  totalKills: number
  runs: number
  // story progress — what the Ember hub remembers between descents
  deepestLayer: number // 0..4, how far into the descent you've reached
  lordsLaidToRest: string[] // relic/lord keys you've put to rest
  relicsFound: string[]
  victories: number
  // embers: the currency carried back from every descent, spent at the hub
  embers: number
  upgrades: Record<string, number>
}

export function defaultMeta(): MetaState {
  return {
    bestStage: 0, totalKills: 0, runs: 0,
    deepestLayer: 0, lordsLaidToRest: [], relicsFound: [], victories: 0,
    embers: 0, upgrades: {},
  }
}

// ---------- Permanent upgrades bought at the Last Ember ----------
export interface MetaUpgrade {
  id: string
  name: string
  icon: string
  desc: string
  maxLevel: number
  baseCost: number
}

export const META_UPGRADES: MetaUpgrade[] = [
  { id: 'vigour', name: '誓约体魄', icon: '❤️', desc: '每级生命上限 +25。', maxLevel: 5, baseCost: 30 },
  { id: 'edge', name: '砥砺锋刃', icon: '⚔️', desc: '每级武器伤害 +8%。', maxLevel: 5, baseCost: 35 },
  { id: 'stride', name: '行者步伐', icon: '👟', desc: '每级移动速度 +4%。', maxLevel: 4, baseCost: 30 },
  { id: 'focus', name: '燃焰专注', icon: '🔵', desc: '每级资源上限 +10。', maxLevel: 4, baseCost: 30 },
  { id: 'fortune', name: '余烬财运', icon: '🪙', desc: '每级余烬获取 +15%。', maxLevel: 4, baseCost: 40 },
  { id: 'reach', name: '延展触及', icon: '🧲', desc: '每级拾取范围 +20%。', maxLevel: 3, baseCost: 25 },
]

/** Costs climb so later levels are a real decision. */
export function upgradeCost(u: MetaUpgrade, level: number): number {
  return Math.round(u.baseCost * Math.pow(1.6, level))
}

/** Fold the player's permanent upgrades into the run's starting stats. */
export function statsFromMeta(meta: MetaState): Stats {
  const s = baseStats()
  const lvl = (id: string) => meta.upgrades[id] ?? 0
  s.maxHp += 25 * lvl('vigour')
  s.swordDamage *= 1 + 0.08 * lvl('edge')
  s.moveSpeed *= 1 + 0.04 * lvl('stride')
  s.maxRage += 10 * lvl('focus')
  s.pickupRadius *= 1 + 0.2 * lvl('reach')
  return s
}

/** Embers earned from a finished descent. */
export function embersEarned(meta: MetaState, stageReached: number, kills: number, won: boolean): number {
  const base = kills + stageReached * 12 + (won ? 150 : 0)
  return Math.max(1, Math.round(base * (1 + 0.15 * (meta.upgrades.fortune ?? 0))))
}

// ---------- Class and run-based skill system ----------
export type ClassId = 'warrior' | 'mage' | 'necromancer'

export interface ClassDefinition {
  id: ClassId
  name: string
  icon: string
  description: string
  resourceName: string
}

export const CLASSES: Record<ClassId, ClassDefinition> = {
  warrior: {
    id: 'warrior',
    name: '战士',
    icon: '⚔️',
    description: '不知疲倦的近战武者，靠砍倒怪物积攒怒气。',
    resourceName: '怒气',
  },
  mage: {
    id: 'mage',
    name: '法师',
    icon: '🧙',
    description: '远程施法者，以可回复的法力驾驭火焰、寒霜与秘法。',
    resourceName: '法力',
  },
  necromancer: {
    id: 'necromancer',
    name: '死灵法师',
    icon: '💀',
    description: '黑暗召唤者，收割精魄并统率骷髅大军。',
    resourceName: '精魄',
  },
}

export type Rarity = 'common' | 'rare' | 'epic'
export type SkillKind = 'active' | 'passive'

// Existing compact IDs are retained so saved/internal references remain stable.
export type SkillId =
  | 'dash'
  | 'whirlwind'
  | 'fireball'
  | 'meteor'
  | 'heal'
  | 'power'
  | 'haste'
  | 'vitality'
  | 'precision'
  | 'thorns'
  | 'inferno'
  | 'blade-dancer'
  | 'guardian-angel'
  | 'absolute-zero'
  | 'tempest'
  | 'titanbreaker'
  | 'mage-cinderbolt'
  | 'mage-frost-nova'
  | 'mage-arcane-orbs'
  | 'mage-blink'
  | 'mage-ice-barrier'
  | 'mage-arcane-intellect'
  | 'mage-ignite'
  | 'mage-shatter'
  | 'mage-spell-haste'
  | 'mage-mana-shield'
  | 'mage-pyroclasm'
  | 'mage-frozen-tempest'
  | 'mage-arcane-barrage'
  | 'mage-prismatic-step'
  | 'mage-glacial-aegis'
  | 'mage-elemental-convergence'
  | 'necro-raise-skeleton'
  | 'necro-bone-spear'
  | 'necro-corpse-burst'
  | 'necro-blood-nova'
  | 'necro-decrepify'
  | 'necro-skeleton-mastery'
  | 'necro-grim-harvest'
  | 'necro-bone-armor'
  | 'necro-blood-pact'
  | 'necro-dark-command'
  | 'necro-skeleton-legion'
  | 'necro-ossuary-lance'
  | 'necro-corpse-cathedral'
  | 'necro-crimson-covenant'
  | 'necro-withering-army'
  | 'necro-army-of-the-dead'

export interface SkillDefinition {
  id: SkillId
  name: string
  icon: string
  description: string
  kind: SkillKind
  rarity: Rarity
  maxLevel: number
  classId: ClassId
}

export interface SkillSynergy {
  result: SkillId
  ingredients: SkillId[]
}

export interface OwnedSkill {
  id: SkillId
  level: number
}

export const SKILLS: Record<SkillId, SkillDefinition> = {
  dash: { id: 'dash', name: '铁流冲锋', icon: '💨', description: '无冷却 · 20 怒气 · 冲穿敌群并短暂眩晕它们。', kind: 'active', rarity: 'common', maxLevel: 5, classId: 'warrior' },
  whirlwind: { id: 'whirlwind', name: '裂斩弧', icon: '🪓', description: '无冷却 · 15 怒气 · 挥出宽幅前扫，正中最痛。', kind: 'active', rarity: 'common', maxLevel: 5, classId: 'warrior' },
  fireball: { id: 'fireball', name: '震地跃击', icon: '💥', description: '无冷却 · 30 怒气 · 跃向目标并释放伤害冲击波。', kind: 'active', rarity: 'common', maxLevel: 5, classId: 'warrior' },
  meteor: { id: 'meteor', name: '挑衅怒吼', icon: '📣', description: '无冷却 · 25 怒气 · 嘲讽敌群，每有一名近敌便获得护盾。', kind: 'active', rarity: 'rare', maxLevel: 5, classId: 'warrior' },
  heal: { id: 'heal', name: '血之反击', icon: '🩸', description: '无冷却 · 35 怒气 · 反击来袭攻击，造成伤害并回复生命。', kind: 'active', rarity: 'rare', maxLevel: 5, classId: 'warrior' },
  power: { id: 'power', name: '战斗狂怒', icon: '🔥', description: '击杀获得更多怒气；消耗怒气可强化武器攻击。', kind: 'passive', rarity: 'common', maxLevel: 5, classId: 'warrior' },
  haste: { id: 'haste', name: '深创', icon: '🩸', description: '暴击与重击造成流血；流血致死额外回怒。', kind: 'passive', rarity: 'rare', maxLevel: 5, classId: 'warrior' },
  vitality: { id: 'vitality', name: '壁垒之躯', icon: '🛡️', description: '提升生命上限，移动时获得伤害减免。', kind: 'passive', rarity: 'common', maxLevel: 5, classId: 'warrior' },
  precision: { id: 'precision', name: '兵器精通', icon: '⚔️', description: '提升武器伤害、暴击伤害与近战距离。', kind: 'passive', rarity: 'rare', maxLevel: 5, classId: 'warrior' },
  thorns: { id: 'thorns', name: '不屈意志', icon: '⛓️', description: '承受重击时获得怒气与短暂减伤。', kind: 'passive', rarity: 'rare', maxLevel: 5, classId: 'warrior' },
  inferno: { id: 'inferno', name: '剑刃风暴冲锋', icon: '🌪️', description: '40 怒气 · 无法阻挡地冲锋，沿途持续横扫。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'warrior' },
  'blade-dancer': { id: 'blade-dancer', name: '活体撞城槌', icon: '🐏', description: '35 怒气 · 强化冲撞击散敌人，击杀返还怒气。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'warrior' },
  'guardian-angel': { id: 'guardian-angel', name: '赤红裂地', icon: '🌋', description: '45 怒气 · 跃下砸地，在落点周围裂开流血地缝。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'warrior' },
  'absolute-zero': { id: 'absolute-zero', name: '背水一战', icon: '🛡️', description: '50 怒气 · 嘲讽、回复，并抵挡一次致命伤害。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'warrior' },
  tempest: { id: 'tempest', name: '狂战士的清算', icon: '😡', description: '55 怒气 · 进入以反击回血的狂暴状态。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'warrior' },
  titanbreaker: { id: 'titanbreaker', name: '泰坦终结者', icon: '⚡', description: '60 怒气 · 跃击、横扫，并向前送出毁灭性冲击波。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'warrior' },
  'mage-cinderbolt': { id: 'mage-cinderbolt', name: '灰烬弹', icon: '🔥', description: '18 法力 · 射出会爆炸的火焰弹。', kind: 'active', rarity: 'common', maxLevel: 5, classId: 'mage' },
  'mage-frost-nova': { id: 'mage-frost-nova', name: '冰霜新星', icon: '❄️', description: '24 法力 · 对周围造成伤害、冰缓并击退。', kind: 'active', rarity: 'common', maxLevel: 5, classId: 'mage' },
  'mage-arcane-orbs': { id: 'mage-arcane-orbs', name: '秘法宝珠', icon: '✨', description: '28 法力 · 射出扇形追踪奥术飞弹。', kind: 'active', rarity: 'common', maxLevel: 5, classId: 'mage' },
  'mage-blink': { id: 'mage-blink', name: '闪现', icon: '🌀', description: '20 法力 · 瞬移向目标并短暂无敌。', kind: 'active', rarity: 'rare', maxLevel: 5, classId: 'mage' },
  'mage-ice-barrier': { id: 'mage-ice-barrier', name: '寒冰壁障', icon: '🧊', description: '32 法力 · 为自己套上保护性屏障。', kind: 'active', rarity: 'rare', maxLevel: 5, classId: 'mage' },
  'mage-arcane-intellect': { id: 'mage-arcane-intellect', name: '奥术智慧', icon: '🧠', description: '提升法力上限与法力回复。', kind: 'passive', rarity: 'common', maxLevel: 5, classId: 'mage' },
  'mage-ignite': { id: 'mage-ignite', name: '点燃', icon: '🔥', description: '法术命中使敌人持续燃烧。', kind: 'passive', rarity: 'rare', maxLevel: 5, classId: 'mage' },
  'mage-shatter': { id: 'mage-shatter', name: '碎冰', icon: '❄️', description: '对被冰缓的敌人提升暴击率与伤害。', kind: 'passive', rarity: 'rare', maxLevel: 5, classId: 'mage' },
  'mage-spell-haste': { id: 'mage-spell-haste', name: '法术急速', icon: '⚡', description: '提升攻击速度与移动速度。', kind: 'passive', rarity: 'common', maxLevel: 5, classId: 'mage' },
  'mage-mana-shield': { id: 'mage-mana-shield', name: '法力护盾', icon: '💠', description: '提升生命上限；受重击后回复法力。', kind: 'passive', rarity: 'rare', maxLevel: 5, classId: 'mage' },
  'mage-pyroclasm': { id: 'mage-pyroclasm', name: '炽焰浩劫', icon: '🌠', description: '42 法力 · 掷出巨型火球，炸出连片燃烧。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'mage' },
  'mage-frozen-tempest': { id: 'mage-frozen-tempest', name: '冰封暴雪', icon: '🌨️', description: '45 法力 · 释放大范围冰冻暴风雪。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'mage' },
  'mage-arcane-barrage': { id: 'mage-arcane-barrage', name: '奥术弹幕', icon: '🔮', description: '48 法力 · 倾泻强化追踪飞弹的风暴。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'mage' },
  'mage-prismatic-step': { id: 'mage-prismatic-step', name: '棱光步', icon: '🪞', description: '35 法力 · 闪现并向四面释放奥术回响。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'mage' },
  'mage-glacial-aegis': { id: 'mage-glacial-aegis', name: '冰川守护', icon: '🛡️', description: '50 法力 · 展开强力屏障并冻结近敌。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'mage' },
  'mage-elemental-convergence': { id: 'mage-elemental-convergence', name: '元素归一', icon: '🌌', description: '60 法力 · 让火焰、寒霜与奥术同时引爆。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'mage' },
  'necro-raise-skeleton': { id: 'necro-raise-skeleton', name: '唤起骷髅', icon: '💀', description: '18 精魄 · 唤起持久的骷髅战士猎杀近敌。', kind: 'active', rarity: 'common', maxLevel: 5, classId: 'necromancer' },
  'necro-bone-spear': { id: 'necro-bone-spear', name: '骨矛', icon: '🦴', description: '22 精魄 · 掷出可穿透的锐骨长矛。', kind: 'active', rarity: 'common', maxLevel: 5, classId: 'necromancer' },
  'necro-corpse-burst': { id: 'necro-corpse-burst', name: '尸爆', icon: '🪦', description: '25 精魄 · 引爆一具尸体，伤害其周围一切。', kind: 'active', rarity: 'common', maxLevel: 5, classId: 'necromancer' },
  'necro-blood-nova': { id: 'necro-blood-nova', name: '血之新星', icon: '🩸', description: '30 精魄 · 释放吸取生命的血魔法环。', kind: 'active', rarity: 'rare', maxLevel: 5, classId: 'necromancer' },
  'necro-decrepify': { id: 'necro-decrepify', name: '衰朽诅咒', icon: '🕯️', description: '24 精魄 · 诅咒近敌，使其大幅减速。', kind: 'active', rarity: 'rare', maxLevel: 5, classId: 'necromancer' },
  'necro-skeleton-mastery': { id: 'necro-skeleton-mastery', name: '骷髅精通', icon: '⚰️', description: '提升骷髅数量上限、伤害与移动速度。', kind: 'passive', rarity: 'common', maxLevel: 5, classId: 'necromancer' },
  'necro-grim-harvest': { id: 'necro-grim-harvest', name: '残酷收割', icon: '🌾', description: '击杀获得更多精魄，并偶尔免费唤起骷髅。', kind: 'passive', rarity: 'rare', maxLevel: 5, classId: 'necromancer' },
  'necro-bone-armor': { id: 'necro-bone-armor', name: '骨甲', icon: '🛡️', description: '提升生命上限；吞噬尸体可获得短暂护盾。', kind: 'passive', rarity: 'common', maxLevel: 5, classId: 'necromancer' },
  'necro-blood-pact': { id: 'necro-blood-pact', name: '血之契约', icon: '❤️‍🔥', description: '血魔法与仆从攻击回复部分生命。', kind: 'passive', rarity: 'rare', maxLevel: 5, classId: 'necromancer' },
  'necro-dark-command': { id: 'necro-dark-command', name: '黑暗号令', icon: '👑', description: '骷髅攻击更快，并优先攻击被诅咒的敌人。', kind: 'passive', rarity: 'rare', maxLevel: 5, classId: 'necromancer' },
  'necro-skeleton-legion': { id: 'necro-skeleton-legion', name: '骷髅军团', icon: '☠️', description: '45 精魄 · 一次唤起四名强化骷髅。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'necromancer' },
  'necro-ossuary-lance': { id: 'necro-ossuary-lance', name: '骸骨长枪', icon: '🗡️', description: '42 精魄 · 射出巨型骨枪并获得骨之屏障。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'necromancer' },
  'necro-corpse-cathedral': { id: 'necro-corpse-cathedral', name: '尸骸圣殿', icon: '⛪', description: '48 精魄 · 引爆周围每一具尸体，形成连锁反应。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'necromancer' },
  'necro-crimson-covenant': { id: 'necro-crimson-covenant', name: '猩红圣约', icon: '🫀', description: '50 精魄 · 释放巨大血之新星，治疗你与你的大军。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'necromancer' },
  'necro-withering-army': { id: 'necro-withering-army', name: '凋零之军', icon: '🕸️', description: '46 精魄 · 诅咒整个战场并让所有骷髅陷入狂乱。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'necromancer' },
  'necro-army-of-the-dead': { id: 'necro-army-of-the-dead', name: '亡者大军', icon: '🏴‍☠️', description: '60 精魄 · 吞噬尸体，让亡者淹没战场。', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'necromancer' },
}

export const SKILL_SYNERGIES: SkillSynergy[] = [
  { result: 'inferno', ingredients: ['dash', 'whirlwind'] },
  { result: 'blade-dancer', ingredients: ['dash', 'vitality'] },
  { result: 'guardian-angel', ingredients: ['fireball', 'haste'] },
  { result: 'absolute-zero', ingredients: ['meteor', 'thorns'] },
  { result: 'tempest', ingredients: ['heal', 'power'] },
  { result: 'titanbreaker', ingredients: ['whirlwind', 'fireball', 'precision'] },
  { result: 'mage-pyroclasm', ingredients: ['mage-cinderbolt', 'mage-ignite'] },
  { result: 'mage-frozen-tempest', ingredients: ['mage-frost-nova', 'mage-shatter'] },
  { result: 'mage-arcane-barrage', ingredients: ['mage-arcane-orbs', 'mage-arcane-intellect'] },
  { result: 'mage-prismatic-step', ingredients: ['mage-blink', 'mage-spell-haste'] },
  { result: 'mage-glacial-aegis', ingredients: ['mage-ice-barrier', 'mage-mana-shield'] },
  { result: 'mage-elemental-convergence', ingredients: ['mage-cinderbolt', 'mage-frost-nova', 'mage-arcane-orbs'] },
  { result: 'necro-skeleton-legion', ingredients: ['necro-raise-skeleton', 'necro-skeleton-mastery'] },
  { result: 'necro-ossuary-lance', ingredients: ['necro-bone-spear', 'necro-bone-armor'] },
  { result: 'necro-corpse-cathedral', ingredients: ['necro-corpse-burst', 'necro-grim-harvest'] },
  { result: 'necro-crimson-covenant', ingredients: ['necro-blood-nova', 'necro-blood-pact'] },
  { result: 'necro-withering-army', ingredients: ['necro-decrepify', 'necro-dark-command'] },
  { result: 'necro-army-of-the-dead', ingredients: ['necro-raise-skeleton', 'necro-corpse-burst', 'necro-grim-harvest'] },
]

export const BASE_SKILL_IDS = (Object.keys(SKILLS) as SkillId[]).filter(
  (id) => !SKILL_SYNERGIES.some((synergy) => synergy.result === id),
)

export const classBaseSkillIds = (classId: ClassId): SkillId[] =>
  BASE_SKILL_IDS.filter((id) => SKILLS[id].classId === classId)

export const classSkillSynergies = (classId: ClassId): SkillSynergy[] =>
  SKILL_SYNERGIES.filter((synergy) => SKILLS[synergy.result].classId === classId)

// ---------- Live snapshot for the React HUD ----------
export type GameStatus = 'menu' | 'playing' | 'skillselect' | 'paused' | 'dead' | 'victory'

export interface AbilityView {
  id: SkillId
  key: string
  name: string
  icon: string
  cdLeft: number
  cdMax: number
  rageCost: number
}

export interface DraftChoice {
  id: string
  name: string
  icon: string
  desc: string
  rarity: Rarity
  tag?: string
}

export interface HudState {
  status: GameStatus
  hp: number
  maxHp: number
  rage: number
  maxRage: number
  classId: ClassId
  className: string
  resourceName: string
  minionCount: number
  time: number
  gold: number
  stage: number
  stageKills: number
  stageEnemyTotal: number
  bossStage: boolean
  kills: number
  swordTier: number
  swordStyleName: string
  swordStyleIcon: string
  biome: string
  combo: number // current kill streak
  comboPct: number // 0..1 time left before the streak drops
  depth: number // which layer of the descent (1..4)
  maxDepth: number
  finalStage: number
  relics: string[]
  abilities: AbilityView[]
  skills: OwnedSkill[]
  cards: DraftChoice[]
  bonusDraft: boolean // a cache pick, not a stage-clear pick
  runKills: number
}
