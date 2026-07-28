// ---------- Core stat block shared by meta + in-run upgrades ----------
export interface Stats {
  maxHp: number
  hpRegen: number
  maxRage: number
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
}

export function defaultMeta(): MetaState {
  return { bestStage: 0, totalKills: 0, runs: 0 }
}

// ---------- Class and run-based skill system ----------
export type ClassId = 'warrior'

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
    name: 'Warrior',
    icon: '⚔️',
    description: 'A relentless melee fighter who gains Rage by chopping monsters down.',
    resourceName: 'Rage',
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

export interface SkillDefinition {
  id: SkillId
  name: string
  icon: string
  description: string
  kind: SkillKind
  rarity: Rarity
  maxLevel: number
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
  dash: { id: 'dash', name: 'Iron Rush', icon: '💨', description: 'No cooldown · 20 Rage · Charge through enemies and briefly stun them.', kind: 'active', rarity: 'common', maxLevel: 5 },
  whirlwind: { id: 'whirlwind', name: 'Cleaving Arc', icon: '🪓', description: 'No cooldown · 15 Rage · Deliver a wide frontal strike with a deadly center.', kind: 'active', rarity: 'common', maxLevel: 5 },
  fireball: { id: 'fireball', name: 'Seismic Leap', icon: '💥', description: 'No cooldown · 30 Rage · Leap to the target and release a damaging shockwave.', kind: 'active', rarity: 'common', maxLevel: 5 },
  meteor: { id: 'meteor', name: 'Challenging Roar', icon: '📣', description: 'No cooldown · 25 Rage · Taunt the swarm and gain a shield for each nearby enemy.', kind: 'active', rarity: 'rare', maxLevel: 5 },
  heal: { id: 'heal', name: 'Blood Reprisal', icon: '🩸', description: 'No cooldown · 35 Rage · Counter incoming attacks with damage and healing.', kind: 'active', rarity: 'rare', maxLevel: 5 },
  power: { id: 'power', name: 'Battle Fury', icon: '🔥', description: 'Gain more Rage from kills; spending Rage empowers sword attacks.', kind: 'passive', rarity: 'common', maxLevel: 5 },
  haste: { id: 'haste', name: 'Deep Wounds', icon: '🩸', description: 'Critical and heavy attacks inflict bleed; bleeding kills grant bonus Rage.', kind: 'passive', rarity: 'rare', maxLevel: 5 },
  vitality: { id: 'vitality', name: 'Juggernaut', icon: '🛡️', description: 'Gain maximum health and damage reduction while moving.', kind: 'passive', rarity: 'common', maxLevel: 5 },
  precision: { id: 'precision', name: 'Weapon Mastery', icon: '⚔️', description: 'Increase sword damage, critical damage, and melee reach.', kind: 'passive', rarity: 'rare', maxLevel: 5 },
  thorns: { id: 'thorns', name: 'Unbreakable Will', icon: '⛓️', description: 'Heavy hits grant Rage and brief damage reduction.', kind: 'passive', rarity: 'rare', maxLevel: 5 },
  inferno: { id: 'inferno', name: 'Bladestorm Charge', icon: '🌪️', description: '40 Rage · Charge unstoppably while repeatedly striking around you.', kind: 'active', rarity: 'epic', maxLevel: 5 },
  'blade-dancer': { id: 'blade-dancer', name: 'Living Battering Ram', icon: '🐏', description: '35 Rage · A fortified charge that scatters enemies and refunds Rage on kills.', kind: 'active', rarity: 'epic', maxLevel: 5 },
  'guardian-angel': { id: 'guardian-angel', name: 'Crimson Earthshatter', icon: '🌋', description: '45 Rage · Leap down and open bleeding fissures around the impact.', kind: 'active', rarity: 'epic', maxLevel: 5 },
  'absolute-zero': { id: 'absolute-zero', name: 'Last Stand', icon: '🛡️', description: '50 Rage · Taunt, recover, and survive one otherwise-fatal blow.', kind: 'active', rarity: 'epic', maxLevel: 5 },
  tempest: { id: 'tempest', name: "Berserker's Reckoning", icon: '😡', description: '55 Rage · Enter a frenzy of healing counterattacks.', kind: 'active', rarity: 'epic', maxLevel: 5 },
  titanbreaker: { id: 'titanbreaker', name: 'Titanbreaker', icon: '⚡', description: '60 Rage · Leap, cleave, and send a devastating shockwave forward.', kind: 'active', rarity: 'epic', maxLevel: 5 },
}

export const SKILL_SYNERGIES: SkillSynergy[] = [
  { result: 'inferno', ingredients: ['dash', 'whirlwind'] },
  { result: 'blade-dancer', ingredients: ['dash', 'vitality'] },
  { result: 'guardian-angel', ingredients: ['fireball', 'haste'] },
  { result: 'absolute-zero', ingredients: ['meteor', 'thorns'] },
  { result: 'tempest', ingredients: ['heal', 'power'] },
  { result: 'titanbreaker', ingredients: ['whirlwind', 'fireball', 'precision'] },
]

export const BASE_SKILL_IDS = (Object.keys(SKILLS) as SkillId[]).filter(
  (id) => !SKILL_SYNERGIES.some((synergy) => synergy.result === id),
)

// ---------- Live snapshot for the React HUD ----------
export type GameStatus = 'menu' | 'playing' | 'skillselect' | 'paused' | 'dead'

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
  className: string
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
  abilities: AbilityView[]
  skills: OwnedSkill[]
  cards: DraftChoice[]
  runKills: number
}
