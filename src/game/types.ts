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
}

export function defaultMeta(): MetaState {
  return { bestStage: 0, totalKills: 0, runs: 0 }
}

// ---------- Class and run-based skill system ----------
export type ClassId = 'warrior' | 'mage'

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
  mage: {
    id: 'mage',
    name: 'Mage',
    icon: '🧙',
    description: 'A ranged spellcaster who controls fire, frost, and arcane magic with regenerating Mana.',
    resourceName: 'Mana',
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
  dash: { id: 'dash', name: 'Iron Rush', icon: '💨', description: 'No cooldown · 20 Rage · Charge through enemies and briefly stun them.', kind: 'active', rarity: 'common', maxLevel: 5, classId: 'warrior' },
  whirlwind: { id: 'whirlwind', name: 'Cleaving Arc', icon: '🪓', description: 'No cooldown · 15 Rage · Deliver a wide frontal strike with a deadly center.', kind: 'active', rarity: 'common', maxLevel: 5, classId: 'warrior' },
  fireball: { id: 'fireball', name: 'Seismic Leap', icon: '💥', description: 'No cooldown · 30 Rage · Leap to the target and release a damaging shockwave.', kind: 'active', rarity: 'common', maxLevel: 5, classId: 'warrior' },
  meteor: { id: 'meteor', name: 'Challenging Roar', icon: '📣', description: 'No cooldown · 25 Rage · Taunt the swarm and gain a shield for each nearby enemy.', kind: 'active', rarity: 'rare', maxLevel: 5, classId: 'warrior' },
  heal: { id: 'heal', name: 'Blood Reprisal', icon: '🩸', description: 'No cooldown · 35 Rage · Counter incoming attacks with damage and healing.', kind: 'active', rarity: 'rare', maxLevel: 5, classId: 'warrior' },
  power: { id: 'power', name: 'Battle Fury', icon: '🔥', description: 'Gain more Rage from kills; spending Rage empowers sword attacks.', kind: 'passive', rarity: 'common', maxLevel: 5, classId: 'warrior' },
  haste: { id: 'haste', name: 'Deep Wounds', icon: '🩸', description: 'Critical and heavy attacks inflict bleed; bleeding kills grant bonus Rage.', kind: 'passive', rarity: 'rare', maxLevel: 5, classId: 'warrior' },
  vitality: { id: 'vitality', name: 'Juggernaut', icon: '🛡️', description: 'Gain maximum health and damage reduction while moving.', kind: 'passive', rarity: 'common', maxLevel: 5, classId: 'warrior' },
  precision: { id: 'precision', name: 'Weapon Mastery', icon: '⚔️', description: 'Increase sword damage, critical damage, and melee reach.', kind: 'passive', rarity: 'rare', maxLevel: 5, classId: 'warrior' },
  thorns: { id: 'thorns', name: 'Unbreakable Will', icon: '⛓️', description: 'Heavy hits grant Rage and brief damage reduction.', kind: 'passive', rarity: 'rare', maxLevel: 5, classId: 'warrior' },
  inferno: { id: 'inferno', name: 'Bladestorm Charge', icon: '🌪️', description: '40 Rage · Charge unstoppably while repeatedly striking around you.', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'warrior' },
  'blade-dancer': { id: 'blade-dancer', name: 'Living Battering Ram', icon: '🐏', description: '35 Rage · A fortified charge that scatters enemies and refunds Rage on kills.', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'warrior' },
  'guardian-angel': { id: 'guardian-angel', name: 'Crimson Earthshatter', icon: '🌋', description: '45 Rage · Leap down and open bleeding fissures around the impact.', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'warrior' },
  'absolute-zero': { id: 'absolute-zero', name: 'Last Stand', icon: '🛡️', description: '50 Rage · Taunt, recover, and survive one otherwise-fatal blow.', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'warrior' },
  tempest: { id: 'tempest', name: "Berserker's Reckoning", icon: '😡', description: '55 Rage · Enter a frenzy of healing counterattacks.', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'warrior' },
  titanbreaker: { id: 'titanbreaker', name: 'Titanbreaker', icon: '⚡', description: '60 Rage · Leap, cleave, and send a devastating shockwave forward.', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'warrior' },
  'mage-cinderbolt': { id: 'mage-cinderbolt', name: 'Cinderbolt', icon: '🔥', description: '18 Mana · Launch an explosive bolt of fire.', kind: 'active', rarity: 'common', maxLevel: 5, classId: 'mage' },
  'mage-frost-nova': { id: 'mage-frost-nova', name: 'Frost Nova', icon: '❄️', description: '24 Mana · Damage, chill, and repel nearby enemies.', kind: 'active', rarity: 'common', maxLevel: 5, classId: 'mage' },
  'mage-arcane-orbs': { id: 'mage-arcane-orbs', name: 'Arcane Orbs', icon: '✨', description: '28 Mana · Launch a fan of homing arcane missiles.', kind: 'active', rarity: 'common', maxLevel: 5, classId: 'mage' },
  'mage-blink': { id: 'mage-blink', name: 'Blink', icon: '🌀', description: '20 Mana · Teleport toward the target and briefly become untouchable.', kind: 'active', rarity: 'rare', maxLevel: 5, classId: 'mage' },
  'mage-ice-barrier': { id: 'mage-ice-barrier', name: 'Ice Barrier', icon: '🧊', description: '32 Mana · Surround yourself with a protective barrier.', kind: 'active', rarity: 'rare', maxLevel: 5, classId: 'mage' },
  'mage-arcane-intellect': { id: 'mage-arcane-intellect', name: 'Arcane Intellect', icon: '🧠', description: 'Increase maximum Mana and Mana regeneration.', kind: 'passive', rarity: 'common', maxLevel: 5, classId: 'mage' },
  'mage-ignite': { id: 'mage-ignite', name: 'Ignite', icon: '🔥', description: 'Spell hits burn enemies over time.', kind: 'passive', rarity: 'rare', maxLevel: 5, classId: 'mage' },
  'mage-shatter': { id: 'mage-shatter', name: 'Shatter', icon: '❄️', description: 'Gain critical chance and damage against chilled enemies.', kind: 'passive', rarity: 'rare', maxLevel: 5, classId: 'mage' },
  'mage-spell-haste': { id: 'mage-spell-haste', name: 'Spell Haste', icon: '⚡', description: 'Increase attack speed and movement speed.', kind: 'passive', rarity: 'common', maxLevel: 5, classId: 'mage' },
  'mage-mana-shield': { id: 'mage-mana-shield', name: 'Mana Shield', icon: '💠', description: 'Gain health and recover Mana after heavy hits.', kind: 'passive', rarity: 'rare', maxLevel: 5, classId: 'mage' },
  'mage-pyroclasm': { id: 'mage-pyroclasm', name: 'Pyroclasm', icon: '🌠', description: '42 Mana · Hurl a massive fireball that erupts in burning impacts.', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'mage' },
  'mage-frozen-tempest': { id: 'mage-frozen-tempest', name: 'Frozen Tempest', icon: '🌨️', description: '45 Mana · Unleash a wide freezing blizzard.', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'mage' },
  'mage-arcane-barrage': { id: 'mage-arcane-barrage', name: 'Arcane Barrage', icon: '🔮', description: '48 Mana · Fire a storm of empowered homing missiles.', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'mage' },
  'mage-prismatic-step': { id: 'mage-prismatic-step', name: 'Prismatic Step', icon: '🪞', description: '35 Mana · Blink and release arcane echoes in every direction.', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'mage' },
  'mage-glacial-aegis': { id: 'mage-glacial-aegis', name: 'Glacial Aegis', icon: '🛡️', description: '50 Mana · Raise a powerful barrier that freezes nearby foes.', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'mage' },
  'mage-elemental-convergence': { id: 'mage-elemental-convergence', name: 'Elemental Convergence', icon: '🌌', description: '60 Mana · Detonate fire, frost, and arcane magic together.', kind: 'active', rarity: 'epic', maxLevel: 5, classId: 'mage' },
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
]

export const BASE_SKILL_IDS = (Object.keys(SKILLS) as SkillId[]).filter(
  (id) => !SKILL_SYNERGIES.some((synergy) => synergy.result === id),
)

export const classBaseSkillIds = (classId: ClassId): SkillId[] =>
  BASE_SKILL_IDS.filter((id) => SKILLS[id].classId === classId)

export const classSkillSynergies = (classId: ClassId): SkillSynergy[] =>
  SKILL_SYNERGIES.filter((synergy) => SKILLS[synergy.result].classId === classId)

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
  resourceName: string
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
