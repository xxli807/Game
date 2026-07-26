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

// ---------- Meta progression (persisted) ----------
export type ForgeId =
  | 'blade'
  | 'edge'
  | 'vampire'
  | 'titan'
  | 'arcane'
  | 'boots'

export interface ForgeUpgrade {
  id: ForgeId
  name: string
  icon: string
  description: string
  baseCost: number
  costGrowth: number
  maxLevel: number
  apply: (s: Stats, level: number) => void
}

export const FORGE: ForgeUpgrade[] = [
  {
    id: 'blade',
    name: 'Sharpened Blade',
    icon: '🗡️',
    description: '+5 sword damage per level',
    baseCost: 20,
    costGrowth: 1.5,
    maxLevel: 20,
    apply: (s, l) => (s.swordDamage += 5 * l),
  },
  {
    id: 'edge',
    name: 'Keen Edge',
    icon: '✨',
    description: '+4% crit chance per level',
    baseCost: 25,
    costGrowth: 1.55,
    maxLevel: 12,
    apply: (s, l) => (s.crit += 0.04 * l),
  },
  {
    id: 'vampire',
    name: 'Vampiric Rune',
    icon: '🩸',
    description: '+3% lifesteal per level',
    baseCost: 30,
    costGrowth: 1.6,
    maxLevel: 10,
    apply: (s, l) => (s.lifesteal += 0.03 * l),
  },
  {
    id: 'titan',
    name: 'Titan Heart',
    icon: '❤️',
    description: '+25 max HP per level',
    baseCost: 22,
    costGrowth: 1.5,
    maxLevel: 15,
    apply: (s, l) => (s.maxHp += 25 * l),
  },
  {
    id: 'arcane',
    name: 'Arcane Core',
    icon: '🔮',
    description: '+15 max mana & +2 regen per level',
    baseCost: 22,
    costGrowth: 1.5,
    maxLevel: 12,
    apply: (s, l) => {
      s.maxMana += 15 * l
      s.manaRegen += 2 * l
    },
  },
  {
    id: 'boots',
    name: 'Swift Boots',
    icon: '👢',
    description: '+15 move speed per level',
    baseCost: 20,
    costGrowth: 1.5,
    maxLevel: 10,
    apply: (s, l) => (s.moveSpeed += 15 * l),
  },
]

export interface MetaState {
  essence: number
  forge: Record<ForgeId, number>
  bestWave: number
  totalKills: number
  runs: number
}

export function defaultMeta(): MetaState {
  return {
    essence: 0,
    forge: { blade: 0, edge: 0, vampire: 0, titan: 0, arcane: 0, boots: 0 },
    bestWave: 0,
    totalKills: 0,
    runs: 0,
  }
}

/** Sword level = 1 + total forge investment. Drives enemy scaling. */
export function swordLevel(meta: MetaState): number {
  return 1 + Object.values(meta.forge).reduce((a, b) => a + b, 0)
}

export function forgeCost(u: ForgeUpgrade, level: number): number {
  return Math.round(u.baseCost * Math.pow(u.costGrowth, level))
}

/** Build starting stats from the meta save. */
export function statsFromMeta(meta: MetaState): Stats {
  const s = baseStats()
  for (const u of FORGE) {
    const lvl = meta.forge[u.id]
    if (lvl > 0) u.apply(s, lvl)
  }
  return s
}

// ---------- In-run draft cards ----------
export type Rarity = 'common' | 'rare' | 'epic'

export interface Card {
  id: string
  name: string
  icon: string
  desc: string
  rarity: Rarity
  apply: (s: Stats) => void
}

export const CARD_POOL: Card[] = [
  { id: 'dmg', name: 'Honed Blade', icon: '⚔️', rarity: 'common', desc: '+25% sword damage', apply: (s) => (s.swordDamage *= 1.25) },
  { id: 'aspd', name: 'Flurry', icon: '🌀', rarity: 'common', desc: '+18% attack speed', apply: (s) => (s.attackInterval *= 0.82) },
  { id: 'cleave', name: 'Wide Arc', icon: '↔️', rarity: 'rare', desc: '+2 cleave targets & wider swing', apply: (s) => { s.cleave += 2; s.swordArc = Math.min(Math.PI * 1.4, s.swordArc + 0.3) } },
  { id: 'range', name: 'Long Reach', icon: '📏', rarity: 'common', desc: '+25% sword range', apply: (s) => (s.swordRange *= 1.25) },
  { id: 'crit', name: 'Deadly Aim', icon: '🎯', rarity: 'rare', desc: '+12% crit chance', apply: (s) => (s.crit += 0.12) },
  { id: 'critdmg', name: 'Executioner', icon: '💢', rarity: 'epic', desc: '+0.6x crit damage', apply: (s) => (s.critMult += 0.6) },
  { id: 'life', name: 'Bloodthirst', icon: '🩸', rarity: 'rare', desc: '+6% lifesteal', apply: (s) => (s.lifesteal += 0.06) },
  { id: 'hp', name: 'Vitality', icon: '❤️', rarity: 'common', desc: '+40 max HP (heal too)', apply: (s) => (s.maxHp += 40) },
  { id: 'regen', name: 'Regeneration', icon: '💚', rarity: 'common', desc: '+3 HP regen / sec', apply: (s) => (s.hpRegen += 3) },
  { id: 'thorns', name: 'Spiked Armor', icon: '🛡️', rarity: 'rare', desc: 'Reflect 30% melee damage', apply: (s) => (s.thorns += 0.3) },
  { id: 'speed', name: 'Fleet Foot', icon: '👟', rarity: 'common', desc: '+15% move speed', apply: (s) => (s.moveSpeed *= 1.15) },
  { id: 'mana', name: 'Mana Font', icon: '🔵', rarity: 'common', desc: '+30 mana & +4 regen', apply: (s) => { s.maxMana += 30; s.manaRegen += 4 } },
  { id: 'magnet', name: 'Lodestone', icon: '🧲', rarity: 'common', desc: '+60% pickup range', apply: (s) => (s.pickupRadius *= 1.6) },
  { id: 'sweep', name: 'Whirling Blade', icon: '🌀', rarity: 'rare', desc: '+40% sword arc & +2 cleave', apply: (s) => { s.swordArc = Math.min(Math.PI * 2, s.swordArc * 1.4); s.cleave += 2 } },

  { id: 'dash-dmg', name: 'Rending Dash', icon: '💨', rarity: 'rare', desc: 'Dash: +100% damage', apply: (s) => (s.dashDamage *= 2) },
  { id: 'dash-cd', name: 'Quick Step', icon: '⏱️', rarity: 'common', desc: 'Dash: -35% cooldown', apply: (s) => (s.dashCd *= 0.65) },

  { id: 'whirl-dmg', name: 'Cyclone', icon: '🌪️', rarity: 'rare', desc: 'Whirlwind: +80% damage', apply: (s) => (s.whirlDamage *= 1.8) },
  { id: 'whirl-rad', name: 'Maelstrom', icon: '💠', rarity: 'epic', desc: 'Whirlwind: +40% radius, -25% CD', apply: (s) => { s.whirlRadius *= 1.4; s.whirlCd *= 0.75 } },

  { id: 'fire-dmg', name: 'Inferno', icon: '🔥', rarity: 'rare', desc: 'Fireball: +70% damage', apply: (s) => (s.fireDamage *= 1.7) },
  { id: 'fire-count', name: 'Multi-Cast', icon: '☄️', rarity: 'epic', desc: 'Fireball: +2 projectiles', apply: (s) => (s.fireCount += 2) },
  { id: 'fire-cd', name: 'Pyromancer', icon: '🧨', rarity: 'common', desc: 'Fireball: -30% cooldown', apply: (s) => (s.fireCd *= 0.7) },

  { id: 'ult-dmg', name: 'Armageddon', icon: '☄️', rarity: 'epic', desc: 'Meteor Storm: +70% damage', apply: (s) => (s.ultDamage *= 1.7) },
  { id: 'ult-count', name: 'Falling Sky', icon: '🌠', rarity: 'epic', desc: 'Meteor Storm: +3 meteors', apply: (s) => (s.ultMeteors += 3) },
  { id: 'ult-cd', name: 'Doomcaller', icon: '⏳', rarity: 'rare', desc: 'Meteor Storm: -30% cooldown', apply: (s) => (s.ultCd *= 0.7) },

  { id: 'heal-amt', name: 'Field Medic', icon: '✚', rarity: 'rare', desc: 'Battle Heal: +60% healing', apply: (s) => (s.healAmount *= 1.6) },
  { id: 'heal-shield', name: 'Aegis', icon: '🛡️', rarity: 'epic', desc: 'Battle Heal: +1.4s shield', apply: (s) => (s.shieldTime += 1.4) },
  { id: 'heal-cd', name: 'Second Wind', icon: '🌬️', rarity: 'common', desc: 'Battle Heal: -30% cooldown', apply: (s) => (s.healCd *= 0.7) },
]

// ---------- Live snapshot for the React HUD ----------
export type GameStatus = 'menu' | 'playing' | 'levelup' | 'paused' | 'dead'

export interface AbilityView {
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

export interface WeaponView {
  icon: string
  level: number
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
  swordLvl: number
  swordTier: number
  swordStyleName: string
  swordStyleIcon: string
  biome: string
  abilities: AbilityView[]
  weapons: WeaponView[]
  cards: DraftChoice[]
  // filled on death
  runWave: number
  runKills: number
  essenceEarned: number
}
