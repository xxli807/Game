// ---------- Core stat block shared by meta + in-run upgrades ----------
export interface Stats {
  maxHp: number
  hpRegen: number
  maxMana: number
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

  // Q — dash slash
  dashDamage: number
  dashRange: number
  dashCd: number
  dashMana: number

  // W — whirlwind
  whirlDamage: number
  whirlRadius: number
  whirlCd: number
  whirlMana: number

  // E — fireball
  fireDamage: number
  fireCount: number
  fireCd: number
  fireMana: number
  fireRadius: number

  // R — meteor storm (ultimate)
  ultDamage: number
  ultRadius: number
  ultMeteors: number
  ultCd: number
  ultMana: number

  // F — battle heal
  healAmount: number
  shieldTime: number
  healCd: number
  healMana: number
}

export function baseStats(): Stats {
  return {
    maxHp: 220,
    hpRegen: 3,
    maxMana: 90,
    manaRegen: 12,
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
    dashCd: 3,
    dashMana: 15,

    whirlDamage: 30,
    whirlRadius: 130,
    whirlCd: 6,
    whirlMana: 25,

    fireDamage: 35,
    fireCount: 1,
    fireCd: 2,
    fireMana: 20,
    fireRadius: 55,

    ultDamage: 90,
    ultRadius: 170,
    ultMeteors: 6,
    ultCd: 14,
    ultMana: 55,

    healAmount: 70,
    shieldTime: 1.6,
    healCd: 11,
    healMana: 35,
  }
}

export interface MetaState {
  bestWave: number
  totalKills: number
  runs: number
}

export function defaultMeta(): MetaState {
  return {
    bestWave: 0,
    totalKills: 0,
    runs: 0,
  }
}

// ---------- Run-based skill system ----------
export type Rarity = 'common' | 'rare' | 'epic'

export type SkillKind = 'active' | 'passive'

export type SkillId =
  | 'dash'
  | 'whirlwind'
  | 'fireball'
  | 'meteor'
  | 'heal'
  | 'frost-nova'
  | 'chain-lightning'
  | 'blade-storm'
  | 'holy-beam'
  | 'time-warp'
  | 'power'
  | 'haste'
  | 'vitality'
  | 'regeneration'
  | 'focus'
  | 'swiftness'
  | 'precision'
  | 'vampirism'
  | 'magnetism'
  | 'thorns'
  | 'inferno'
  | 'blade-dancer'
  | 'guardian-angel'
  | 'absolute-zero'
  | 'tempest'

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
  ingredients: [SkillId, SkillId]
}

export interface OwnedSkill {
  id: SkillId
  level: number
}

export const SKILLS: Record<SkillId, SkillDefinition> = {
  dash: { id: 'dash', name: 'Rending Dash', icon: '💨', description: 'Dash through enemies; upgrades damage and cooldown.', kind: 'active', rarity: 'common', maxLevel: 5 },
  whirlwind: { id: 'whirlwind', name: 'Whirlwind', icon: '🌪️', description: 'Damage and knock back every nearby monster.', kind: 'active', rarity: 'common', maxLevel: 5 },
  fireball: { id: 'fireball', name: 'Fireball', icon: '🔥', description: 'Launch an explosive fireball toward the nearest monster.', kind: 'active', rarity: 'common', maxLevel: 5 },
  meteor: { id: 'meteor', name: 'Meteor Storm', icon: '☄️', description: 'Rain meteors over a large target area.', kind: 'active', rarity: 'rare', maxLevel: 5 },
  heal: { id: 'heal', name: 'Battle Heal', icon: '✚', description: 'Restore health and gain a brief shield.', kind: 'active', rarity: 'common', maxLevel: 5 },
  'frost-nova': { id: 'frost-nova', name: 'Frost Nova', icon: '❄️', description: 'Freeze and damage monsters around you.', kind: 'active', rarity: 'rare', maxLevel: 5 },
  'chain-lightning': { id: 'chain-lightning', name: 'Chain Lightning', icon: '⚡', description: 'Lightning jumps rapidly between nearby monsters.', kind: 'active', rarity: 'rare', maxLevel: 5 },
  'blade-storm': { id: 'blade-storm', name: 'Blade Storm', icon: '🗡️', description: 'Fire a ring of piercing spectral blades.', kind: 'active', rarity: 'rare', maxLevel: 5 },
  'holy-beam': { id: 'holy-beam', name: 'Holy Beam', icon: '🌟', description: 'Strike the nearest monster with focused holy power.', kind: 'active', rarity: 'rare', maxLevel: 5 },
  'time-warp': { id: 'time-warp', name: 'Time Warp', icon: '⏳', description: 'Stop all monsters and enemy projectiles briefly.', kind: 'active', rarity: 'epic', maxLevel: 5 },
  power: { id: 'power', name: 'Brutal Power', icon: '💪', description: '+25% sword damage per level.', kind: 'passive', rarity: 'common', maxLevel: 5 },
  haste: { id: 'haste', name: 'Battle Haste', icon: '🌀', description: '+15% sword attack speed per level.', kind: 'passive', rarity: 'common', maxLevel: 5 },
  vitality: { id: 'vitality', name: 'Vitality', icon: '❤️', description: '+45 maximum health per level.', kind: 'passive', rarity: 'common', maxLevel: 5 },
  regeneration: { id: 'regeneration', name: 'Regeneration', icon: '💚', description: '+3 health regeneration per second per level.', kind: 'passive', rarity: 'common', maxLevel: 5 },
  focus: { id: 'focus', name: 'Arcane Focus', icon: '🔵', description: '+25 mana and +3 mana regeneration per level.', kind: 'passive', rarity: 'common', maxLevel: 5 },
  swiftness: { id: 'swiftness', name: 'Swiftness', icon: '👟', description: '+12% movement speed per level.', kind: 'passive', rarity: 'common', maxLevel: 5 },
  precision: { id: 'precision', name: 'Precision', icon: '🎯', description: '+10% critical chance per level.', kind: 'passive', rarity: 'rare', maxLevel: 5 },
  vampirism: { id: 'vampirism', name: 'Vampirism', icon: '🩸', description: '+5% lifesteal per level.', kind: 'passive', rarity: 'rare', maxLevel: 5 },
  magnetism: { id: 'magnetism', name: 'Magnetism', icon: '🧲', description: '+50% pickup radius per level.', kind: 'passive', rarity: 'common', maxLevel: 5 },
  thorns: { id: 'thorns', name: 'Spiked Armor', icon: '🛡️', description: 'Reflect 25% contact damage per level.', kind: 'passive', rarity: 'rare', maxLevel: 5 },
  inferno: { id: 'inferno', name: 'Inferno', icon: '🌋', description: 'Fireball + Meteor: launch fireballs and rain meteors together.', kind: 'active', rarity: 'epic', maxLevel: 5 },
  'blade-dancer': { id: 'blade-dancer', name: 'Blade Dancer', icon: '⚔️', description: 'Dash + Whirlwind: become an invulnerable spinning charge.', kind: 'active', rarity: 'epic', maxLevel: 5 },
  'guardian-angel': { id: 'guardian-angel', name: 'Guardian Angel', icon: '🪽', description: 'Heal + Vitality: fully heal and gain a powerful shield.', kind: 'active', rarity: 'epic', maxLevel: 5 },
  'absolute-zero': { id: 'absolute-zero', name: 'Absolute Zero', icon: '🧊', description: 'Frost Nova + Time Warp: freeze and shatter the whole screen.', kind: 'active', rarity: 'epic', maxLevel: 5 },
  tempest: { id: 'tempest', name: 'Tempest', icon: '🌩️', description: 'Chain Lightning + Precision: a devastating critical lightning storm.', kind: 'active', rarity: 'epic', maxLevel: 5 },
}

export const SKILL_SYNERGIES: SkillSynergy[] = [
  { result: 'inferno', ingredients: ['fireball', 'meteor'] },
  { result: 'blade-dancer', ingredients: ['dash', 'whirlwind'] },
  { result: 'guardian-angel', ingredients: ['heal', 'vitality'] },
  { result: 'absolute-zero', ingredients: ['frost-nova', 'time-warp'] },
  { result: 'tempest', ingredients: ['chain-lightning', 'precision'] },
]

export const BASE_SKILL_IDS = (Object.keys(SKILLS) as SkillId[]).filter(
  (id) => !SKILL_SYNERGIES.some((synergy) => synergy.result === id),
)

/** XP needed to advance from the supplied level.
 * Cost compounds every level and receives another large jump after levels 10, 20, 30, etc. */
export function xpRequiredForLevel(level: number): number {
  const safeLevel = Math.max(1, level)
  const perLevelGrowth = Math.pow(1.12, safeLevel - 1)
  const milestoneGrowth = Math.pow(1.5, Math.floor(safeLevel / 10))
  return Math.round(30 * perLevelGrowth * milestoneGrowth)
}

export interface LegacyCard {
  id: string
  name: string
  icon: string
  desc: string
  rarity: Rarity
  apply: (s: Stats) => void
}

export const CARD_POOL: LegacyCard[] = [
  { id: 'power', name: 'Brutal Power', icon: '⚔️', desc: '+4 sword damage.', rarity: 'common', apply: (s) => { s.swordDamage += 4 } },
  { id: 'haste', name: 'Battle Haste', icon: '💨', desc: '+12% sword attack speed.', rarity: 'common', apply: (s) => { s.attackInterval = Math.max(0.16, s.attackInterval * 0.88) } },
  { id: 'vitality', name: 'Vitality', icon: '❤️', desc: '+35 maximum health.', rarity: 'common', apply: (s) => { s.maxHp += 35 } },
  { id: 'regeneration', name: 'Regeneration', icon: '💚', desc: '+1.5 health regeneration per second.', rarity: 'common', apply: (s) => { s.hpRegen += 1.5 } },
  { id: 'focus', name: 'Arcane Focus', icon: '🔵', desc: '+20 mana and +2 mana regeneration.', rarity: 'common', apply: (s) => { s.maxMana += 20; s.manaRegen += 2 } },
  { id: 'swiftness', name: 'Swiftness', icon: '👟', desc: '+10% movement speed.', rarity: 'common', apply: (s) => { s.moveSpeed *= 1.1 } },
  { id: 'precision', name: 'Precision', icon: '🎯', desc: '+8% critical chance.', rarity: 'rare', apply: (s) => { s.crit = Math.min(0.75, s.crit + 0.08) } },
  { id: 'magnetism', name: 'Magnetism', icon: '🧲', desc: '+35% pickup radius.', rarity: 'common', apply: (s) => { s.pickupRadius *= 1.35 } },
]

// ---------- Live snapshot for the React HUD ----------
export type GameStatus = 'menu' | 'playing' | 'levelup' | 'paused' | 'dead'

export interface AbilityView {
  id: SkillId
  key: string
  name: string
  icon: string
  cdLeft: number
  cdMax: number
  manaCost: number
}

/** A single option shown in the level-up draft (stat card OR weapon). */
export interface DraftChoice {
  id: string
  name: string
  icon: string
  desc: string
  rarity: Rarity
  tag?: string // e.g. "NEW WEAPON", "Lv 3"
}

export interface HudState {
  status: GameStatus
  hp: number
  maxHp: number
  mana: number
  maxMana: number
  level: number
  xp: number
  xpToNext: number
  time: number
  gold: number
  wave: number
  kills: number
  swordTier: number
  swordStyleName: string
  swordStyleIcon: string
  biome: string
  abilities: AbilityView[]
  skills: OwnedSkill[]
  cards: DraftChoice[]
  // filled on death
  runWave: number
  runKills: number
}
