import {
  Stats,
  CARD_POOL,
  HudState,
  GameStatus,
  AbilityView,
  DraftChoice,
  Rarity,
} from './types'
import {
  Biome,
  BIOMES,
  BIOME_ORDER,
  drawKnight,
  drawCreature,
  SwordStyleId,
  SWORD_STYLES,
  randomSwordStyle,
} from './sprites'

// Canvas / viewport size (what the camera shows at once)
export const WIDTH = 960
export const HEIGHT = 640
// The full world is much larger than the viewport
export const WORLD_W = 2880
export const WORLD_H = 2000

// The world is split into four biome regions (a 2x2 map you roam across).
// BIOME_ORDER = [dungeon, forest, snow, volcano] → TL, TR, BL, BR
export function regionAt(x: number, y: number): Biome {
  const col = x < WORLD_W / 2 ? 0 : 1
  const row = y < WORLD_H / 2 ? 0 : 1
  return BIOME_ORDER[row * 2 + col]
}

interface Vec {
  x: number
  y: number
}

interface Hero {
  x: number
  y: number
  hp: number
  mana: number
  aim: number // facing angle
  attackTimer: number
  swingT: number // slash animation timer
  swingMax: number
  swingAngle: number
  swingDir: number // +1 / -1 alternating sweep direction
  dashCd: number
  whirlCd: number
  fireCd: number
  ultCd: number
  healCd: number
  shieldT: number // active damage shield
  dashT: number // active dash timer
  dashDir: Vec
  dashHits: Set<Enemy>
  invuln: number
  level: number
  xp: number
  xpToNext: number
  walkPhase: number
  facing: number // 1 = right, -1 = left (side view flip)
  faceDir: 'up' | 'down' | 'left' | 'right'
  moving: boolean
}

type EnemyKind = 'grunt' | 'fast' | 'tank' | 'ranged' | 'boss'

interface Enemy {
  x: number
  y: number
  hp: number
  maxHp: number
  kind: EnemyKind
  emoji: string
  radius: number
  speed: number
  damage: number
  touch: number // contact cooldown
  shoot: number // ranged fire timer
  xp: number
  hitFlash: number
  knock: Vec
  phase: number // idle bob animation
  facing: number
  elite: boolean
  ebiome: Biome // which region it belongs to (drives its look)
  slowT: number // frost slow timer
  wCd: number // weapon damage tick cooldown (orbit/aura)
}

interface Decoration {
  x: number
  y: number
  type: string
  biome: Biome
  s: number // scale
}

interface Ambient {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  kind: Biome
}

interface Gem {
  x: number
  y: number
  vx: number
  vy: number
  value: number
  big: boolean
  magnet: boolean
}

type PickupType = 'heart' | 'magnet' | 'bomb' | 'clock' | 'gold' | 'chest'

interface Pickup {
  x: number
  y: number
  vx: number
  vy: number
  type: PickupType
  phase: number
  life: number // seconds before it fades (0 = never)
}

interface Projectile {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  damage: number
  life: number
  friendly: boolean
  radius: number // explosion radius (fireball); 0 = none
  pierce: number // enemies it can pass through (0 = dies on first hit)
  homing: boolean
  spin: number // visual spin for axes; 0 = draw as orb
  color: string
  hit: Set<Enemy> // enemies already hit (for piercing)
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  text: string
  size: number
  color: string
}

interface SlashFx {
  x: number
  y: number
  angle: number
  arc: number
  range: number
  life: number
  maxLife: number
  tier: number
}

interface RingFx {
  x: number
  y: number
  r: number
  maxR: number
  life: number
  color: string
}

interface Meteor {
  x: number
  y: number
  t: number // seconds until impact
  damage: number
  radius: number
}

interface RunEnd {
  wave: number
  kills: number
  essence: number
}

interface Opts {
  stats: Stats
  swordLvl: number
  onState: (s: HudState) => void
  onRunEnd: (r: RunEnd) => void
}

const KIND_EMOJI: Record<EnemyKind, string> = {
  grunt: '👹',
  fast: '🦇',
  tank: '🐗',
  ranged: '💀',
  boss: '🐲',
}

// ---------- Auto-weapons (collected & levelled through the draft) ----------
type WeaponId = 'orbit' | 'wand' | 'aura' | 'axe' | 'lightning'

interface WeaponMeta {
  id: WeaponId
  name: string
  icon: string
  max: number
  rarity: Rarity
  blurb: string
}

const WEAPONS: Record<WeaponId, WeaponMeta> = {
  orbit: { id: 'orbit', name: 'Spirit Blades', icon: '🗡️', max: 6, rarity: 'rare', blurb: 'Blades orbit you, shredding all they touch' },
  wand: { id: 'wand', name: 'Magic Wand', icon: '✨', max: 6, rarity: 'common', blurb: 'Auto-fires homing bolts at the nearest foe' },
  aura: { id: 'aura', name: 'Frost Aura', icon: '❄️', max: 5, rarity: 'rare', blurb: 'Pulses cold damage & slows nearby enemies' },
  axe: { id: 'axe', name: 'War Axes', icon: '🪓', max: 6, rarity: 'common', blurb: 'Hurls spinning axes that pierce the horde' },
  lightning: { id: 'lightning', name: 'Storm Call', icon: '⚡', max: 5, rarity: 'epic', blurb: 'Lightning zaps and chains between foes' },
}
const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[]
const MAX_WEAPONS = 5

interface OwnedWeapon { id: WeaponId; level: number; timer: number }
interface Bolt { x1: number; y1: number; x2: number; y2: number; life: number }
interface LevelOpt { choice: DraftChoice; apply: () => void; weight: number }

export class GameEngine {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private opts: Opts
  private stats: Stats

  private status: GameStatus = 'playing'
  private hero!: Hero
  private enemies: Enemy[] = []
  private projectiles: Projectile[] = []
  private particles: Particle[] = []
  private slashes: SlashFx[] = []
  private rings: RingFx[] = []
  private meteors: Meteor[] = []

  private wave = 0
  private kills = 0
  private eliteKills = 0
  private swordTier = 1
  private swordStyleId: SwordStyleId = 'steel'
  private biome: Biome = 'dungeon'
  private spawnTimer = 0
  private bossTimer = 45
  private swingFlip = 1
  private weapons: OwnedWeapon[] = []
  private orbitAngle = 0
  private bolts: Bolt[] = []
  private choices: DraftChoice[] = []
  private choiceActions: Record<string, () => void> = {}
  private decor: Decoration[] = []
  private ambient: Ambient[] = []
  private gems: Gem[] = []
  private pickups: Pickup[] = []
  private gold = 0
  private freezeT = 0
  private flash = 0
  private treasureTimer = 18
  private survTime = 0
  private readonly MAX_ENEMIES = 140
  private cam: Vec = { x: 0, y: 0 }

  // painted ground textures per biome (loaded from public/arts)
  private tileImgs: Partial<Record<Biome, HTMLImageElement>> = {}

  // ---- designed world landmarks ----
  private readonly plaza = { x: WORLD_W / 2, y: WORLD_H / 2, r: 210 }
  private readonly river = { y: WORLD_H / 2, half: 78 } // east-west, splits top/bottom
  private readonly road = { x: WORLD_W / 2, half: 50 } // north-south, splits left/right
  private readonly lakes: { x: number; y: number; rx: number; ry: number; type: 'ice' | 'lava' | 'pond' }[] = [
    { x: WORLD_W * 0.26, y: WORLD_H * 0.76, rx: 300, ry: 175, type: 'ice' },
    { x: WORLD_W * 0.74, y: WORLD_H * 0.72, rx: 285, ry: 160, type: 'lava' },
    { x: WORLD_W * 0.80, y: WORLD_H * 0.24, rx: 190, ry: 120, type: 'pond' },
  ]
  private readonly bridges = [WORLD_W * 0.26, WORLD_W * 0.74]
  private lavaTick = 0

  // in-run sword tier thresholds (cumulative kills)
  private readonly TIER_KILLS = [10, 26, 48, 78, 120]

  private keys = new Set<string>()
  private mouse: Vec = { x: WIDTH / 2, y: HEIGHT / 2 }

  // touch virtual joystick (screen-space, canvas-internal coords)
  private joyActive = false
  private joyId = -1
  private joyBase: Vec = { x: 0, y: 0 }
  private joyKnob: Vec = { x: 0, y: 0 }
  private joyVec: Vec = { x: 0, y: 0 }
  private readonly JOY_R = 70

  private lastTs = 0
  private rafId = 0
  private shakeAmt = 0
  private floorPhase = 0

  constructor(canvas: HTMLCanvasElement, opts: Opts) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.opts = opts
    this.stats = opts.stats
    this.loadArt()
    this.bindInput()
    this.reset()
    this.loop(performance.now())
  }

  private loadArt() {
    const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
    const biomes: Biome[] = ['dungeon', 'forest', 'snow', 'volcano']
    for (const b of biomes) {
      const img = new Image()
      img.src = `${base}arts/tile_${b}.png`
      this.tileImgs[b] = img
    }
  }

  // ---------- lifecycle ----------
  private reset() {
    // start in the middle of the dungeon region (top-left quadrant)
    this.hero = {
      x: WORLD_W * 0.25,
      y: WORLD_H * 0.25,
      hp: this.stats.maxHp,
      mana: this.stats.maxMana,
      aim: 0,
      attackTimer: 0,
      swingT: 0,
      swingMax: 0.3,
      swingAngle: 0,
      swingDir: 1,
      dashCd: 0,
      whirlCd: 0,
      fireCd: 0,
      ultCd: 0,
      healCd: 0,
      shieldT: 0,
      dashT: 0,
      dashDir: { x: 1, y: 0 },
      dashHits: new Set(),
      invuln: 0,
      level: 1,
      xp: 0,
      xpToNext: 10,
      walkPhase: 0,
      facing: 1,
      faceDir: 'down',
      moving: false,
    }
    this.enemies = []
    this.projectiles = []
    this.particles = []
    this.slashes = []
    this.rings = []
    this.meteors = []
    this.ambient = []
    this.gems = []
    this.pickups = []
    this.bolts = []
    this.orbitAngle = 0
    // begin every run with one random auto-weapon so it's lively from the start
    this.weapons = [{ id: WEAPON_IDS[Math.floor(Math.random() * WEAPON_IDS.length)], level: 1, timer: 0 }]
    this.gold = 0
    this.freezeT = 0
    this.flash = 0
    this.treasureTimer = 18
    this.survTime = 0
    this.wave = 1
    this.kills = 0
    this.eliteKills = 0
    this.swordTier = 1
    this.biome = regionAt(this.hero.x, this.hero.y)
    // forge a random sword for this run and apply its signature bonus
    this.swordStyleId = randomSwordStyle()
    this.applySwordStyle()
    this.generateDecor()
    this.centerCamera()
    this.spawnTimer = 0
    this.bossTimer = 45
    this.status = 'playing'
  }

  private applySwordStyle() {
    const s = this.stats
    switch (this.swordStyleId) {
      case 'steel': s.crit += 0.08; break
      case 'ember': s.swordDamage *= 1.12; break
      case 'storm': s.swordRange *= 1.15; s.attackInterval *= 0.9; break
      // stone (knockback) & frost (slow) apply on hit, handled in combat
    }
  }

  /** Keep props off water, roads and the plaza so the map reads as designed. */
  private onClearGround(x: number, y: number): boolean {
    if (Math.hypot(x - this.plaza.x, y - this.plaza.y) < this.plaza.r + 20) return false
    if (Math.abs(y - this.river.y) < this.river.half + 10) return false
    if (Math.abs(x - this.road.x) < this.road.half + 10) return false
    for (const l of this.lakes) {
      const dx = (x - l.x) / (l.rx + 16)
      const dy = (y - l.y) / (l.ry + 16)
      if (dx * dx + dy * dy < 1) return false
    }
    return true
  }

  private addDecor(x: number, y: number, type: string, s: number) {
    if (x < 26 || x > WORLD_W - 26 || y < 26 || y > WORLD_H - 26) return
    if (!this.onClearGround(x, y)) return
    this.decor.push({ x, y, biome: regionAt(x, y), type, s })
  }

  private cluster(cx: number, cy: number, spread: number, n: number, types: string[]) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * spread
      const t = types[Math.floor(Math.random() * types.length)]
      this.addDecor(cx + Math.cos(a) * r, cy + Math.sin(a) * r, t, 0.8 + Math.random() * 0.7)
    }
  }

  private generateDecor() {
    this.decor = []
    const perType: Record<Biome, string[]> = {
      dungeon: ['pillar', 'rubble'],
      forest: ['tree', 'tree', 'bush'],
      snow: ['pine', 'icerock'],
      volcano: ['rock', 'rock'],
    }
    // sparse background scatter (kept light so the map doesn't feel cluttered)
    for (let i = 0; i < 85; i++) {
      const x = 30 + Math.random() * (WORLD_W - 60)
      const y = 30 + Math.random() * (WORLD_H - 60)
      const opts = perType[regionAt(x, y)]
      this.addDecor(x, y, opts[Math.floor(Math.random() * opts.length)], 0.7 + Math.random() * 0.6)
    }
    // forest grove — a dense cluster of trees, plus a landmark dead tree
    this.cluster(WORLD_W * 0.58, WORLD_H * 0.32, 240, 46, ['tree', 'tree', 'bush'])
    this.addDecor(WORLD_W * 0.58, WORLD_H * 0.32, 'deadtree', 2.0)
    // reeds around the forest pond
    this.cluster(WORLD_W * 0.80, WORLD_H * 0.24, 220, 24, ['bush'])
    // frozen lake shore — pines and ice, plus an ice spire
    this.cluster(WORLD_W * 0.26, WORLD_H * 0.76, 360, 40, ['pine', 'icerock'])
    this.addDecor(WORLD_W * 0.40, WORLD_H * 0.62, 'icespire', 2.2)
    // volcano field — rocks around the lava lake, with a smoking vent
    this.cluster(WORLD_W * 0.74, WORLD_H * 0.72, 360, 34, ['rock', 'rock'])
    this.addDecor(WORLD_W * 0.62, WORLD_H * 0.86, 'vent', 2.0)
    // dungeon ruins — pillars in a broken colonnade + a statue
    for (let i = 0; i < 6; i++) {
      this.addDecor(WORLD_W * 0.14 + i * 46, WORLD_H * 0.18, 'pillar', 1.2)
      this.addDecor(WORLD_W * 0.14 + i * 46, WORLD_H * 0.34, 'pillar', 1.2)
    }
    this.cluster(WORLD_W * 0.22, WORLD_H * 0.26, 200, 16, ['bones', 'rubble'])
    this.addDecor(WORLD_W * 0.30, WORLD_H * 0.14, 'statue', 2.0)
    // the central plaza obelisk
    this.addDecor(this.plaza.x, this.plaza.y, 'obelisk', 2.6)
  }

  private centerCamera() {
    this.cam.x = Math.max(0, Math.min(WORLD_W - WIDTH, this.hero.x - WIDTH / 2))
    this.cam.y = Math.max(0, Math.min(WORLD_H - HEIGHT, this.hero.y - HEIGHT / 2))
  }

  chooseCard(id: string) {
    if (this.status !== 'levelup') return
    const action = this.choiceActions[id]
    if (action) action()
    // maybe multiple pending level-ups
    if (this.hero.xp >= this.hero.xpToNext) {
      this.doLevelUp()
    } else {
      this.status = 'playing'
      this.lastTs = performance.now()
    }
    this.emit()
  }

  pause() {
    if (this.status === 'playing') { this.status = 'paused'; this.emit() }
  }

  resume() {
    if (this.status === 'paused') { this.status = 'playing'; this.lastTs = performance.now(); this.emit() }
  }

  togglePause() {
    if (this.status === 'playing') this.pause()
    else if (this.status === 'paused') this.resume()
  }

  destroy() {
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
  }

  // ---------- input ----------
  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    const toWorld = (cx: number, cy: number) => {
      const r = this.canvas.getBoundingClientRect()
      this.mouse = {
        x: ((cx - r.left) / r.width) * WIDTH + this.cam.x,
        y: ((cy - r.top) / r.height) * HEIGHT + this.cam.y,
      }
    }
    // ---- desktop: mouse aims, clicks cast ----
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') toWorld(e.clientX, e.clientY)
    })
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return
      toWorld(e.clientX, e.clientY)
      if (e.button === 0) this.castFire()
      if (e.button === 2) this.castDash()
    })
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    // ---- touch: a drag-anywhere virtual joystick moves the hero ----
    const screenPos = (cx: number, cy: number): Vec => {
      const r = this.canvas.getBoundingClientRect()
      return { x: ((cx - r.left) / r.width) * WIDTH, y: ((cy - r.top) / r.height) * HEIGHT }
    }
    this.canvas.addEventListener('touchstart', (e) => {
      if (this.joyActive) return
      const t = e.changedTouches[0]
      this.joyId = t.identifier
      this.joyActive = true
      this.joyBase = screenPos(t.clientX, t.clientY)
      this.joyKnob = { ...this.joyBase }
      this.joyVec = { x: 0, y: 0 }
      e.preventDefault()
    }, { passive: false })
    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.joyActive) return
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== this.joyId) continue
        const p = screenPos(t.clientX, t.clientY)
        let dx = p.x - this.joyBase.x
        let dy = p.y - this.joyBase.y
        const d = Math.hypot(dx, dy)
        if (d > this.JOY_R) { dx = (dx / d) * this.JOY_R; dy = (dy / d) * this.JOY_R }
        this.joyKnob = { x: this.joyBase.x + dx, y: this.joyBase.y + dy }
        this.joyVec = { x: dx / this.JOY_R, y: dy / this.JOY_R }
      }
      e.preventDefault()
    }, { passive: false })
    const endTouch = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joyId) {
          this.joyActive = false
          this.joyId = -1
          this.joyVec = { x: 0, y: 0 }
        }
      }
    }
    this.canvas.addEventListener('touchend', endTouch)
    this.canvas.addEventListener('touchcancel', endTouch)
  }

  /** Fire an ability from an on-screen (touch) button, auto-aimed at the swarm. */
  castAbility(key: string) {
    if (this.status !== 'playing') return
    const h = this.hero
    const t = this.nearestEnemy(99999)
    if (t) {
      this.mouse = { x: t.x, y: t.y }
      h.aim = Math.atan2(t.y - h.y, t.x - h.x)
    } else {
      this.mouse = { x: h.x + Math.cos(h.aim) * 300, y: h.y + Math.sin(h.aim) * 300 }
    }
    if (key === 'Q') this.castDash()
    else if (key === 'SPC') this.castWhirl()
    else if (key === 'E') this.castFire()
    else if (key === 'R') this.castUlt()
    else if (key === 'F') this.castHeal()
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    this.keys.add(k)
    if (k === 'p' || k === 'escape') { this.togglePause(); return }
    if (this.status !== 'playing') return
    if (k === 'q') this.castDash()
    if (k === 'e') this.castFire()
    if (k === ' ') { this.castWhirl(); e.preventDefault() }
    if (k === 'r') this.castUlt()
    if (k === 'f') this.castHeal()
  }
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase())
  }

  // enemy power grows with survival time, hero level, and sword level
  private scale(): number {
    return 1 + (this.wave - 1) * 0.18 + (this.hero.level - 1) * 0.05 + (this.opts.swordLvl - 1) * 0.13
  }

  private spawnEnemy(force?: EnemyKind) {
    const s = this.scale()
    let kind: EnemyKind
    if (force) {
      kind = force
    } else {
      // as you level up, tougher enemy types make up more of the horde
      const threat = this.wave + Math.floor(this.hero.level / 2)
      const roll = Math.random()
      if (threat >= 4 && roll < 0.18) kind = 'ranged'
      else if (threat >= 3 && roll < 0.4) kind = 'tank'
      else if (threat >= 2 && roll < 0.7) kind = 'fast'
      else kind = 'grunt'
    }

    const spec = this.enemySpec(kind, s)
    // spawn in a ring just outside the camera view, around the hero
    const ang = Math.random() * Math.PI * 2
    const dist = 560 + Math.random() * 200
    let x = this.hero.x + Math.cos(ang) * dist
    let y = this.hero.y + Math.sin(ang) * dist
    x = Math.max(20, Math.min(WORLD_W - 20, x))
    y = Math.max(20, Math.min(WORLD_H - 20, y))

    // special "elite" beasts: rarer, tougher, glowing — worth big rewards
    const eliteChance = kind === 'boss' ? 0 : Math.min(0.16, 0.02 + this.wave * 0.01)
    const elite = Math.random() < eliteChance
    const hp = spec.hp * (elite ? 2.6 : 1)

    this.enemies.push({
      x, y,
      hp,
      maxHp: hp,
      kind,
      emoji: KIND_EMOJI[kind],
      radius: spec.radius * (elite ? 1.35 : 1),
      speed: spec.speed * (elite ? 0.92 : 1) * (1 + this.hero.level * 0.012),
      damage: spec.damage * (elite ? 1.4 : 1),
      touch: 0,
      shoot: 1 + Math.random(),
      xp: spec.xp * (elite ? 3 : 1),
      hitFlash: 0,
      knock: { x: 0, y: 0 },
      phase: Math.random() * Math.PI * 2,
      facing: -1,
      elite,
      ebiome: regionAt(x, y),
      slowT: 0,
      wCd: 0,
    })
  }

  private enemySpec(kind: EnemyKind, s: number) {
    switch (kind) {
      case 'grunt': return { hp: 15 * s, speed: 66, damage: 6 * s, radius: 18, xp: 3 }
      case 'fast': return { hp: 9 * s, speed: 150, damage: 5 * s, radius: 15, xp: 4 }
      case 'tank': return { hp: 52 * s, speed: 42, damage: 12 * s, radius: 27, xp: 8 }
      case 'ranged': return { hp: 14 * s, speed: 48, damage: 9 * s, radius: 17, xp: 6 }
      case 'boss': return { hp: 520 * s, speed: 46, damage: 24 * s, radius: 46, xp: 60 }
    }
  }

  // ---------- abilities ----------
  private spendMana(cost: number): boolean {
    if (this.hero.mana < cost) return false
    this.hero.mana -= cost
    return true
  }

  private castDash() {
    if (this.status !== 'playing') return
    const h = this.hero
    if (h.dashCd > 0) return
    if (!this.spendMana(this.stats.dashMana)) return
    h.dashCd = this.stats.dashCd
    h.dashT = 0.16
    h.invuln = 0.16
    const dir = this.aimDir()
    h.dashDir = dir
    h.dashHits = new Set()
  }

  private castWhirl() {
    if (this.status !== 'playing') return
    const h = this.hero
    if (h.whirlCd > 0) return
    if (!this.spendMana(this.stats.whirlMana)) return
    h.whirlCd = this.stats.whirlCd
    const R = this.stats.whirlRadius
    this.rings.push({ x: h.x, y: h.y, r: 10, maxR: R, life: 0.35, color: 'rgba(120,220,255,0.6)' })
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - h.x, e.y - h.y)
      if (d < R + e.radius) {
        this.damageEnemy(e, this.stats.whirlDamage, true)
        const a = Math.atan2(e.y - h.y, e.x - h.x)
        e.knock.x += Math.cos(a) * 260
        e.knock.y += Math.sin(a) * 260
      }
    }
    this.shake(8)
  }

  private castFire() {
    if (this.status !== 'playing') return
    const h = this.hero
    if (h.fireCd > 0) return
    if (!this.spendMana(this.stats.fireMana)) return
    h.fireCd = this.stats.fireCd
    const baseA = this.hero.aim
    const n = this.stats.fireCount
    const spread = 0.18
    for (let i = 0; i < n; i++) {
      const a = baseA + (i - (n - 1) / 2) * spread
      this.projectiles.push(this.mkProj(
        h.x + Math.cos(a) * 24, h.y + Math.sin(a) * 24,
        Math.cos(a) * 560, Math.sin(a) * 560,
        this.stats.fireDamage, true,
        { r: 9, life: 1.4, radius: this.stats.fireRadius },
      ))
    }
  }

  // R — Meteor Storm: rain fiery meteors around the cursor
  private castUlt() {
    if (this.status !== 'playing') return
    const h = this.hero
    if (h.ultCd > 0) return
    if (!this.spendMana(this.stats.ultMana)) return
    h.ultCd = this.stats.ultCd
    const n = this.stats.ultMeteors
    const spread = this.stats.ultRadius
    const cx = this.mouse.x
    const cy = this.mouse.y
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * spread
      this.meteors.push({
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        t: 0.35 + Math.random() * 0.9,
        damage: this.stats.ultDamage,
        radius: 70,
      })
    }
    this.floatText(cx, cy - spread - 10, '☄️ METEOR STORM', '#ff922b', 26)
  }

  // F — Battle Heal: restore health and gain a brief shield
  private castHeal() {
    if (this.status !== 'playing') return
    const h = this.hero
    if (h.healCd > 0) return
    if (!this.spendMana(this.stats.healMana)) return
    h.healCd = this.stats.healCd
    h.hp = Math.min(this.stats.maxHp, h.hp + this.stats.healAmount)
    h.shieldT = this.stats.shieldTime
    this.rings.push({ x: h.x, y: h.y, r: 10, maxR: 60, life: 0.35, color: 'rgba(120,255,170,0.7)' })
    this.floatText(h.x, h.y - 34, `+${Math.round(this.stats.healAmount)}`, '#69db7c', 22)
  }

  private mkProj(
    x: number, y: number, vx: number, vy: number, damage: number, friendly: boolean,
    opts?: { r?: number; life?: number; radius?: number; pierce?: number; homing?: boolean; spin?: number; color?: string },
  ): Projectile {
    return {
      x, y, vx, vy, damage, friendly,
      r: opts?.r ?? 8, life: opts?.life ?? 3, radius: opts?.radius ?? 0,
      pierce: opts?.pierce ?? 0, homing: opts?.homing ?? false, spin: opts?.spin ?? 0,
      color: opts?.color ?? (friendly ? '#ff922b' : '#b197fc'),
      hit: new Set(),
    }
  }

  private aimDir(): Vec {
    const a = Math.atan2(this.mouse.y - this.hero.y, this.mouse.x - this.hero.x)
    return { x: Math.cos(a), y: Math.sin(a) }
  }

  // ---------- damage helpers ----------
  private damageEnemy(e: Enemy, base: number, fromAbility: boolean) {
    let dmg = base
    let crit = false
    if (Math.random() < this.stats.crit) {
      dmg *= this.stats.critMult
      crit = true
    }
    e.hp -= dmg
    e.hitFlash = 0.1
    // frost sword chills foes on melee hits
    if (!fromAbility && this.swordStyleId === 'frost') e.slowT = 1.2
    this.floatText(e.x, e.y - e.radius, `${Math.round(dmg)}`, crit ? '#ffd43b' : '#fff', crit ? 22 : 16)
    if (this.stats.lifesteal > 0 && !fromAbility) {
      this.hero.hp = Math.min(this.stats.maxHp, this.hero.hp + dmg * this.stats.lifesteal)
    } else if (this.stats.lifesteal > 0 && fromAbility) {
      this.hero.hp = Math.min(this.stats.maxHp, this.hero.hp + dmg * this.stats.lifesteal * 0.5)
    }
    if (e.hp <= 0) this.killEnemy(e)
  }

  private killEnemy(e: Enemy) {
    e.hp = 0
    this.kills++
    if (e.elite) {
      this.eliteKills++
      this.floatText(e.x, e.y - 10, '★ SPECIAL ★', '#ffd43b', 20)
    }
    if (e.kind === 'boss') this.floatText(e.x, e.y, 'BOSS DOWN!', '#ff6b6b', 24)
    // drop XP gems that the hero collects (Vampire-Survivors style)
    const gemCount = e.kind === 'boss' ? 10 : e.elite ? 4 : 1
    const big = e.kind === 'boss' || e.elite
    for (let i = 0; i < gemCount; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 30 + Math.random() * 90
      this.gems.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        value: Math.max(1, Math.round(e.xp / gemCount)),
        big, magnet: false,
      })
    }
    const burst = e.kind === 'boss' ? 26 : e.elite ? 12 : 4
    const col = BIOMES[this.biome].accent
    for (let i = 0; i < burst; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 60 + Math.random() * 180
      this.particles.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.45, maxLife: 0.45, text: '✦', size: e.elite ? 15 : 11, color: e.elite ? '#ffd43b' : col,
      })
    }
    // ground loot — drops you walk over to grab
    if (e.kind === 'boss') {
      this.dropPickup(e.x, e.y, 'chest')
    } else if (e.elite) {
      this.dropPickup(e.x, e.y, Math.random() < 0.5 ? 'bomb' : 'clock')
    } else {
      const r = Math.random()
      if (r < 0.02) this.dropPickup(e.x, e.y, 'heart')
      else if (r < 0.05) this.dropPickup(e.x, e.y, 'gold')
      else if (r < 0.058) this.dropPickup(e.x, e.y, 'magnet')
    }

    if (e.kind === 'boss') this.shake(16)
    else if (e.elite) this.shake(6)
    this.checkSwordTier()
  }

  private dropPickup(x: number, y: number, type: PickupType) {
    const a = Math.random() * Math.PI * 2
    const sp = 40 + Math.random() * 60
    this.pickups.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      type, phase: Math.random() * Math.PI * 2,
      life: type === 'chest' || type === 'gold' ? 0 : 22, // chests/gold wait forever
    })
  }

  private updatePickups(dt: number) {
    const h = this.hero
    for (const p of this.pickups) {
      p.phase += dt * 4
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 0.88
      p.vy *= 0.88
      if (p.life > 0) p.life -= dt
      // chests & hearts get gently pulled from a short range; all are grabbed on touch
      const d = Math.hypot(h.x - p.x, h.y - p.y)
      if (d < this.stats.pickupRadius * 0.6) {
        p.x += (h.x - p.x) * Math.min(1, dt * 5)
        p.y += (h.y - p.y) * Math.min(1, dt * 5)
      }
      if (d < 26) { this.collectPickup(p.type); p.life = -1 }
    }
    // keep permanent (life===0) and still-alive timed (life>0); drop collected/expired (life<0)
    this.pickups = this.pickups.filter((p) => p.life >= 0)
  }

  private collectPickup(type: PickupType) {
    const h = this.hero
    switch (type) {
      case 'heart':
        h.hp = Math.min(this.stats.maxHp, h.hp + this.stats.maxHp * 0.3)
        this.floatText(h.x, h.y - 30, '+HP', '#69db7c', 22)
        break
      case 'gold': {
        const g = 3 + Math.floor(Math.random() * 5)
        this.gold += g
        this.floatText(h.x, h.y - 30, `+${g}🪙`, '#ffd43b', 20)
        break
      }
      case 'magnet':
        for (const gem of this.gems) gem.magnet = true
        this.floatText(h.x, h.y - 30, 'MAGNET!', '#8cf5ff', 24)
        break
      case 'bomb':
        this.flash = 1
        this.shake(18)
        for (const e of this.enemies) {
          if (this.inView(e.x, e.y, 80)) this.damageEnemy(e, 9999, true)
        }
        this.floatText(h.x, h.y - 30, '💥 BOOM!', '#ff922b', 28)
        break
      case 'clock':
        this.freezeT = 3.5
        this.floatText(h.x, h.y - 30, '⏱ FREEZE!', '#a5d8ff', 26)
        break
      case 'chest': {
        this.gold += 15
        h.hp = Math.min(this.stats.maxHp, h.hp + this.stats.maxHp * 0.25)
        this.gainXp(this.hero.xpToNext) // guaranteed level-up draft
        this.floatText(h.x, h.y - 36, '🎁 TREASURE!', '#ffd43b', 30)
        for (let i = 0; i < 24; i++) {
          const a = Math.random() * Math.PI * 2
          const sp = 80 + Math.random() * 160
          this.particles.push({ x: h.x, y: h.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6, maxLife: 0.6, text: '✦', size: 14, color: '#ffe066' })
        }
        this.shake(10)
        break
      }
    }
  }

  private updateGems(dt: number) {
    const h = this.hero
    const mag = this.stats.pickupRadius
    for (const g of this.gems) {
      const dx = h.x - g.x
      const dy = h.y - g.y
      const d = Math.hypot(dx, dy)
      if (g.magnet || d < mag) {
        g.magnet = true
        const pull = 620
        g.vx += (dx / (d || 1)) * pull * dt
        g.vy += (dy / (d || 1)) * pull * dt
        g.vx *= 0.9
        g.vy *= 0.9
      } else {
        g.vx *= 0.9
        g.vy *= 0.9
      }
      g.x += g.vx * dt
      g.y += g.vy * dt
      if (d < 22) {
        this.gainXp(g.value)
        g.value = -1 // mark collected
      }
    }
    if (this.gems.some((g) => g.value < 0)) this.gems = this.gems.filter((g) => g.value >= 0)
  }

  /** In-run blade forging: after enough kills the sword ascends a tier. */
  private checkSwordTier() {
    const next = this.TIER_KILLS[this.swordTier - 1]
    if (next !== undefined && this.kills >= next) {
      this.swordTier++
      const s = this.stats
      s.swordDamage *= 1.3
      s.swordArc = Math.min(Math.PI * 1.5, s.swordArc + 0.18)
      s.swordRange += 8
      s.cleave += 1
      const style = SWORD_STYLES[this.swordStyleId]
      this.floatText(this.hero.x, this.hero.y - 40, `⚔ SWORD TIER ${this.swordTier}!`, style.edge, 30)
      this.rings.push({ x: this.hero.x, y: this.hero.y, r: 10, maxR: 90, life: 0.4, color: style.glow })
      this.shake(10)
    }
  }

  private gainXp(amount: number) {
    this.hero.xp += amount
    let guard = 0
    while (this.hero.xp >= this.hero.xpToNext && this.status === 'playing' && guard++ < 20) {
      this.doLevelUp()
    }
  }

  private doLevelUp() {
    const h = this.hero
    h.xp -= h.xpToNext
    h.level++
    h.xpToNext = Math.round(6 + h.level * 5 + h.level * h.level * 0.35)
    h.hp = Math.min(this.stats.maxHp, h.hp + this.stats.maxHp * 0.1)
    // every 5th level a big boss marches in
    if (h.level % 5 === 0) this.spawnMegaBoss()
    // pause and let the player pick a skill
    this.status = 'levelup'
    this.buildChoices()
    this.emit()
  }

  private buildChoices() {
    const opts = this.levelUpOptions()
    // weighted pick of 3 distinct options
    const chosen: LevelOpt[] = []
    const pool = [...opts]
    for (let i = 0; i < 3 && pool.length; i++) {
      const total = pool.reduce((a, o) => a + o.weight, 0)
      let r = Math.random() * total
      let idx = 0
      for (let j = 0; j < pool.length; j++) { r -= pool[j].weight; if (r <= 0) { idx = j; break } }
      chosen.push(pool[idx])
      pool.splice(idx, 1)
    }
    this.choices = chosen.map((o) => o.choice)
    this.choiceActions = {}
    for (const o of chosen) this.choiceActions[o.choice.id] = o.apply
  }

  private levelUpOptions(): LevelOpt[] {
    const opts: LevelOpt[] = []
    // upgrade weapons you own
    for (const w of this.weapons) {
      const m = WEAPONS[w.id]
      if (w.level >= m.max) continue
      opts.push({
        weight: m.rarity === 'epic' ? 3 : m.rarity === 'rare' ? 4 : 5,
        choice: { id: `wup-${w.id}`, name: m.name, icon: m.icon, desc: m.blurb, rarity: m.rarity, tag: `Lv ${w.level} → ${w.level + 1}` },
        apply: () => { w.level++ },
      })
    }
    // brand-new weapons (free slot)
    if (this.weapons.length < MAX_WEAPONS) {
      for (const id of WEAPON_IDS) {
        if (this.weapons.some((w) => w.id === id)) continue
        const m = WEAPONS[id]
        opts.push({
          weight: m.rarity === 'epic' ? 2.5 : m.rarity === 'rare' ? 3.5 : 4.5,
          choice: { id: `wnew-${id}`, name: m.name, icon: m.icon, desc: m.blurb, rarity: m.rarity, tag: '★ NEW WEAPON' },
          apply: () => { this.weapons.push({ id, level: 1, timer: 0 }) },
        })
      }
    }
    // stat / ability cards
    for (const c of CARD_POOL) {
      opts.push({
        weight: c.rarity === 'common' ? 4 : c.rarity === 'rare' ? 2.2 : 1.1,
        choice: { id: c.id, name: c.name, icon: c.icon, desc: c.desc, rarity: c.rarity },
        apply: () => {
          const before = this.stats.maxHp
          c.apply(this.stats)
          this.hero.hp = Math.min(this.stats.maxHp, this.hero.hp + Math.max(0, this.stats.maxHp - before))
        },
      })
    }
    return opts
  }

  private spawnMegaBoss() {
    const h = this.hero
    // spawn a boss and beef it up to a "big boss"
    const before = this.enemies.length
    this.spawnEnemy('boss')
    const boss = this.enemies[before]
    if (boss) {
      boss.hp *= 2.4
      boss.maxHp = boss.hp
      boss.radius *= 1.4
      boss.damage *= 1.3
      boss.elite = true
    }
    this.floatText(h.x, h.y - 70, '⚠ BIG BOSS APPROACHES!', '#ff6b6b', 30)
    this.shake(14)
  }

  // ---------- main loop ----------
  private loop = (ts: number) => {
    this.rafId = requestAnimationFrame(this.loop)
    let dt = (ts - this.lastTs) / 1000
    this.lastTs = ts
    if (dt > 0.05) dt = 0.05
    this.floorPhase += dt
    if (this.status === 'playing') this.update(dt)
    this.render()
  }

  private update(dt: number) {
    const h = this.hero
    const s = this.stats

    // regen
    h.hp = Math.min(s.maxHp, h.hp + s.hpRegen * dt)
    h.mana = Math.min(s.maxMana, h.mana + s.manaRegen * dt)

    // cooldowns
    h.dashCd = Math.max(0, h.dashCd - dt)
    h.whirlCd = Math.max(0, h.whirlCd - dt)
    h.fireCd = Math.max(0, h.fireCd - dt)
    h.ultCd = Math.max(0, h.ultCd - dt)
    h.healCd = Math.max(0, h.healCd - dt)
    h.invuln = Math.max(0, h.invuln - dt)
    h.shieldT = Math.max(0, h.shieldT - dt)
    if (h.swingT > 0) h.swingT -= dt

    // aim toward the cursor (drives the sword, not necessarily the body)
    h.aim = Math.atan2(this.mouse.y - h.y, this.mouse.x - h.x)

    // movement (or dash override)
    let mvx = 0
    let mvy = 0
    if (h.dashT > 0) {
      h.dashT -= dt
      h.moving = true
      mvx = h.dashDir.x
      mvy = h.dashDir.y
      const dashSpeed = this.stats.dashRange / 0.16
      h.x += h.dashDir.x * dashSpeed * dt
      h.y += h.dashDir.y * dashSpeed * dt
      // dash damage to enemies touched
      for (const e of this.enemies) {
        if (h.dashHits.has(e)) continue
        if (Math.hypot(e.x - h.x, e.y - h.y) < e.radius + 22) {
          h.dashHits.add(e)
          this.damageEnemy(e, this.stats.dashDamage, true)
        }
      }
    } else {
      if (this.joyActive && (this.joyVec.x !== 0 || this.joyVec.y !== 0)) {
        // touch joystick (analog)
        mvx = this.joyVec.x
        mvy = this.joyVec.y
      } else {
        // keyboard
        if (this.keys.has('a') || this.keys.has('arrowleft')) mvx -= 1
        if (this.keys.has('d') || this.keys.has('arrowright')) mvx += 1
        if (this.keys.has('w') || this.keys.has('arrowup')) mvy -= 1
        if (this.keys.has('s') || this.keys.has('arrowdown')) mvy += 1
      }
      const mag = Math.hypot(mvx, mvy)
      h.moving = mag > 0.15
      if (mag > 0) {
        const f = (mag > 1 ? 1 / mag : 1) * s.moveSpeed * dt // normalize keyboard, keep analog joystick
        h.x += mvx * f
        h.y += mvy * f
      }
    }

    // body faces the way it walks; when standing still it faces the cursor
    const [fdx, fdy] = h.moving ? [mvx, mvy] : [Math.cos(h.aim), Math.sin(h.aim)]
    if (Math.abs(fdx) > Math.abs(fdy)) {
      h.faceDir = fdx < 0 ? 'left' : 'right'
      h.facing = fdx < 0 ? -1 : 1
    } else {
      h.faceDir = fdy < 0 ? 'up' : 'down'
    }

    // stride animation
    if (h.moving) h.walkPhase += dt * 12
    else h.walkPhase = 0
    h.x = Math.max(24, Math.min(WORLD_W - 24, h.x))
    h.y = Math.max(24, Math.min(WORLD_H - 24, h.y))

    // camera follows the hero, clamped to the world
    const tcx = Math.max(0, Math.min(WORLD_W - WIDTH, h.x - WIDTH / 2))
    const tcy = Math.max(0, Math.min(WORLD_H - HEIGHT, h.y - HEIGHT / 2))
    this.cam.x += (tcx - this.cam.x) * Math.min(1, dt * 6)
    this.cam.y += (tcy - this.cam.y) * Math.min(1, dt * 6)

    // announce when the hero crosses into a new region
    const region = regionAt(h.x, h.y)
    if (region !== this.biome) {
      this.biome = region
      const p = BIOMES[region]
      this.floatText(h.x, h.y - 60, `⚑ ${p.name}`, p.accent, 30)
    }

    // standing in the lava lake burns you (a hazard that makes the map matter)
    this.lavaTick = Math.max(0, this.lavaTick - dt)
    for (const l of this.lakes) {
      if (l.type !== 'lava') continue
      const dx = (h.x - l.x) / l.rx
      const dy = (h.y - l.y) / l.ry
      if (dx * dx + dy * dy < 1 && h.shieldT <= 0) {
        if (this.lavaTick <= 0) {
          this.lavaTick = 0.5
          h.hp -= 14
          this.floatText(h.x, h.y - 24, '🔥', '#ff922b', 20)
          this.particles.push({ x: h.x, y: h.y, vx: 0, vy: -40, life: 0.4, maxLife: 0.4, text: '🔥', size: 16, color: '#ff922b' })
        }
      }
    }

    // dynamic sword: it sweeps on its own rhythm, always, whether or not
    // an enemy is in reach — so the blade is perpetually in motion.
    h.attackTimer -= dt
    if (h.attackTimer <= 0) {
      h.attackTimer = s.attackInterval
      this.swordSwing(this.nearestEnemy(s.swordRange + 200))
    }

    // auto-weapons fire on their own
    this.updateWeapons(dt)

    // survival difficulty ramps with time; enemies stream in endlessly
    this.survTime += dt
    this.wave = 1 + Math.floor(this.survTime / 22)
    const targetPop = Math.min(this.MAX_ENEMIES, 18 + Math.floor(this.survTime * 0.8) + this.hero.level * 2)
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0 && this.enemies.length < targetPop) {
      const burst = 1 + Math.floor(this.wave / 3)
      for (let i = 0; i < burst; i++) this.spawnEnemy()
      this.spawnTimer = 0.25
    }
    // periodic boss
    this.bossTimer -= dt
    if (this.bossTimer <= 0) {
      this.bossTimer = 45
      this.spawnEnemy('boss')
    }

    // periodic treasure appears out in the world — worth running for
    this.treasureTimer -= dt
    if (this.treasureTimer <= 0) {
      this.treasureTimer = 20 + Math.random() * 12
      const a = Math.random() * Math.PI * 2
      const dist = 260 + Math.random() * 260
      const tx = Math.max(40, Math.min(WORLD_W - 40, h.x + Math.cos(a) * dist))
      const ty = Math.max(40, Math.min(WORLD_H - 40, h.y + Math.sin(a) * dist))
      const roll = Math.random()
      this.dropPickup(tx, ty, roll < 0.4 ? 'chest' : roll < 0.7 ? 'heart' : roll < 0.85 ? 'bomb' : 'clock')
    }

    // freeze / screen-flash timers
    this.freezeT = Math.max(0, this.freezeT - dt)
    this.flash = Math.max(0, this.flash - dt * 2.5)

    this.updateEnemies(dt)
    this.updateGems(dt)
    this.updatePickups(dt)
    this.updateProjectiles(dt)
    this.updateMeteors(dt)
    this.updateAmbient(dt)

    // fx timers
    for (const sl of this.slashes) sl.life -= dt
    this.slashes = this.slashes.filter((s) => s.life > 0)
    for (const r of this.rings) { r.life -= dt; r.r += (r.maxR - r.r) * Math.min(1, dt * 10) }
    this.rings = this.rings.filter((r) => r.life > 0)
    for (const b of this.bolts) b.life -= dt
    this.bolts = this.bolts.filter((b) => b.life > 0)
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.life -= dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)

    if (h.hp <= 0) this.endRun()

    this.emit()
  }

  private swordSwing(target: Enemy | null) {
    const h = this.hero
    const s = this.stats
    // aim at the nearest foe; if none, sweep in the direction we face/aim
    const angle = target
      ? Math.atan2(target.y - h.y, target.x - h.x)
      : (h.moving ? Math.atan2(h.faceDir === 'up' ? -1 : h.faceDir === 'down' ? 1 : 0, h.faceDir === 'left' ? -1 : h.faceDir === 'right' ? 1 : 0) : h.aim)
    // alternate the sweep direction each swing for a lively back-and-forth
    this.swingFlip = -this.swingFlip
    h.swingAngle = angle
    h.swingDir = this.swingFlip
    h.swingT = s.attackInterval * 0.7
    h.swingMax = h.swingT
    const slashLife = 0.22
    this.slashes.push({
      x: h.x, y: h.y, angle,
      arc: s.swordArc, range: s.swordRange,
      life: slashLife, maxLife: slashLife, tier: this.swordTier,
    })
    let hitCount = 0
    // hit nearest first up to cleave
    const inArc = this.enemies
      .map((e) => ({ e, d: Math.hypot(e.x - h.x, e.y - h.y) }))
      .filter(({ e, d }) => {
        if (d > s.swordRange + e.radius) return false
        const a = Math.atan2(e.y - h.y, e.x - h.x)
        let diff = Math.abs(a - angle)
        if (diff > Math.PI) diff = Math.PI * 2 - diff
        return diff <= s.swordArc / 2
      })
      .sort((a, b) => a.d - b.d)
    const stone = this.swordStyleId === 'stone'
    for (const { e } of inArc) {
      if (hitCount >= s.cleave) break
      this.damageEnemy(e, s.swordDamage, false)
      if (stone) {
        const a = Math.atan2(e.y - h.y, e.x - h.x)
        e.knock.x += Math.cos(a) * 320
        e.knock.y += Math.sin(a) * 320
      }
      hitCount++
    }
  }

  private nearestEnemy(range: number): Enemy | null {
    let best: Enemy | null = null
    let bestD = range + 60
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - this.hero.x, e.y - this.hero.y)
      if (d < bestD) { bestD = d; best = e }
    }
    return best
  }

  // ---------- auto-weapons ----------
  private updateWeapons(dt: number) {
    const h = this.hero
    this.orbitAngle += dt * 2.4
    for (const w of this.weapons) {
      w.timer -= dt
      const L = w.level
      switch (w.id) {
        case 'orbit': {
          // continuous — blades whirl around the hero and shred on contact
          const count = 1 + L
          const rad = 62 + L * 8
          const dmg = 6 + L * 4
          for (let i = 0; i < count; i++) {
            const a = this.orbitAngle + (i / count) * Math.PI * 2
            const bx = h.x + Math.cos(a) * rad
            const by = h.y + Math.sin(a) * rad
            for (const e of this.enemies) {
              if (e.wCd > 0) continue
              if (Math.hypot(e.x - bx, e.y - by) < e.radius + 12) {
                this.damageEnemy(e, dmg, true)
                e.wCd = 0.25
              }
            }
          }
          break
        }
        case 'wand':
          if (w.timer <= 0) {
            w.timer = Math.max(0.35, 1.1 - L * 0.12)
            const shots = 1 + Math.floor(L / 2)
            for (let i = 0; i < shots; i++) {
              const t = this.pickEnemy(i)
              const a = t ? Math.atan2(t.y - h.y, t.x - h.x) : Math.random() * Math.PI * 2
              this.projectiles.push(this.mkProj(h.x, h.y, Math.cos(a) * 460, Math.sin(a) * 460, 10 + L * 6, true, { r: 7, life: 2, homing: true, pierce: 0, color: '#74c0fc' }))
            }
          }
          break
        case 'aura':
          if (w.timer <= 0) {
            w.timer = 0.7
            const rad = 90 + L * 22
            const dmg = 5 + L * 4
            this.rings.push({ x: h.x, y: h.y, r: 10, maxR: rad, life: 0.35, color: 'rgba(140,220,255,0.5)' })
            for (const e of this.enemies) {
              if (Math.hypot(e.x - h.x, e.y - h.y) < rad + e.radius) {
                this.damageEnemy(e, dmg, true)
                e.slowT = 1.2
              }
            }
          }
          break
        case 'axe':
          if (w.timer <= 0) {
            w.timer = Math.max(0.6, 1.6 - L * 0.15)
            const count = 1 + Math.floor((L + 1) / 2)
            for (let i = 0; i < count; i++) {
              const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6
              this.projectiles.push(this.mkProj(h.x, h.y, Math.cos(a) * 320, Math.sin(a) * 320 - 120, 16 + L * 8, true, { r: 11, life: 1.6, pierce: 2 + L, spin: 1, color: '#dbb48a' }))
            }
          }
          break
        case 'lightning':
          if (w.timer <= 0) {
            w.timer = Math.max(0.5, 1.4 - L * 0.16)
            this.castChainLightning(20 + L * 12, 2 + L)
          }
          break
      }
    }
  }

  private pickEnemy(n: number): Enemy | null {
    // nth-nearest-ish: just pick among the closest few
    const sorted = this.enemies
      .map((e) => ({ e, d: (e.x - this.hero.x) ** 2 + (e.y - this.hero.y) ** 2 }))
      .sort((a, b) => a.d - b.d)
    return sorted[n]?.e ?? sorted[0]?.e ?? null
  }

  private castChainLightning(dmg: number, jumps: number) {
    const hitSet = new Set<Enemy>()
    let src = { x: this.hero.x, y: this.hero.y }
    for (let j = 0; j < jumps; j++) {
      let best: Enemy | null = null
      let bestD = 320 ** 2
      for (const e of this.enemies) {
        if (hitSet.has(e)) continue
        const d = (e.x - src.x) ** 2 + (e.y - src.y) ** 2
        if (d < bestD) { bestD = d; best = e }
      }
      if (!best) break
      hitSet.add(best)
      this.bolts.push({ x1: src.x, y1: src.y, x2: best.x, y2: best.y, life: 0.18 })
      this.damageEnemy(best, dmg, true)
      src = { x: best.x, y: best.y }
    }
  }

  private updateEnemies(dt: number) {
    const h = this.hero
    for (const e of this.enemies) {
      if (e.hitFlash > 0) e.hitFlash -= dt
      if (e.slowT > 0) e.slowT -= dt
      if (e.wCd > 0) e.wCd -= dt
      e.phase += dt * 5
      e.facing = h.x < e.x ? -1 : 1
      const spd = this.freezeT > 0 ? 0 : e.speed * (e.slowT > 0 ? 0.45 : 1)
      // knockback decay
      e.x += e.knock.x * dt
      e.y += e.knock.y * dt
      e.knock.x *= 0.86
      e.knock.y *= 0.86

      const a = Math.atan2(h.y - e.y, h.x - e.x)
      const dist = Math.hypot(h.x - e.x, h.y - e.y)

      if (e.kind === 'ranged') {
        // keep distance & shoot
        const desired = 260
        if (dist < desired - 30) { e.x -= Math.cos(a) * spd * dt; e.y -= Math.sin(a) * spd * dt }
        else if (dist > desired + 30) { e.x += Math.cos(a) * spd * dt; e.y += Math.sin(a) * spd * dt }
        e.shoot -= dt
        if (e.shoot <= 0) {
          e.shoot = 2.2
          this.projectiles.push(this.mkProj(e.x, e.y, Math.cos(a) * 320, Math.sin(a) * 320, e.damage, false))
        }
      } else {
        e.x += Math.cos(a) * spd * dt
        e.y += Math.sin(a) * spd * dt
        if (e.kind === 'boss') {
          e.shoot -= dt
          if (e.shoot <= 0) {
            e.shoot = 3
            for (let i = 0; i < 8; i++) {
              const ba = (i / 8) * Math.PI * 2
              this.projectiles.push(this.mkProj(e.x, e.y, Math.cos(ba) * 240, Math.sin(ba) * 240, e.damage * 0.6, false, { r: 9 }))
            }
          }
        }
      }

      // contact damage
      e.touch = Math.max(0, e.touch - dt)
      if (dist < e.radius + 18 && e.touch <= 0) {
        e.touch = 0.6
        this.hurtHero(e.damage)
        // thorns
        if (this.stats.thorns > 0) this.damageEnemy(e, e.damage * this.stats.thorns, true)
        // small pushback on enemy
        e.knock.x += Math.cos(a) * -120
        e.knock.y += Math.sin(a) * -120
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0)
  }

  private updateProjectiles(dt: number) {
    const h = this.hero
    for (const p of this.projectiles) {
      // homing bolts steer toward the nearest enemy
      if (p.homing) {
        const t = this.nearestEnemyTo(p.x, p.y)
        if (t) {
          const sp = Math.hypot(p.vx, p.vy) || 400
          const a = Math.atan2(t.y - p.y, t.x - p.x)
          p.vx += (Math.cos(a) * sp - p.vx) * Math.min(1, dt * 6)
          p.vy += (Math.sin(a) * sp - p.vy) * Math.min(1, dt * 6)
        }
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
      if (p.spin) p.spin += dt * 14

      if (p.friendly) {
        for (const e of this.enemies) {
          if (p.hit.has(e)) continue
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.radius + p.r) {
            if (p.radius > 0) { this.explodeFire(p); p.life = 0; break }
            this.damageEnemy(e, p.damage, true)
            p.hit.add(e)
            if (p.pierce <= 0) { p.life = 0; break }
            p.pierce--
          }
        }
      } else if (h.invuln <= 0 && h.shieldT <= 0 && Math.hypot(h.x - p.x, h.y - p.y) < 20 + p.r) {
        this.hurtHero(p.damage)
        p.life = 0
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0)
  }

  private nearestEnemyTo(x: number, y: number): Enemy | null {
    let best: Enemy | null = null
    let bestD = Infinity
    for (const e of this.enemies) {
      const d = (e.x - x) ** 2 + (e.y - y) ** 2
      if (d < bestD) { bestD = d; best = e }
    }
    return best
  }

  private explodeFire(p: Projectile) {
    this.rings.push({ x: p.x, y: p.y, r: 8, maxR: p.radius, life: 0.3, color: 'rgba(255,140,60,0.6)' })
    for (const e of this.enemies) {
      if (Math.hypot(e.x - p.x, e.y - p.y) < p.radius + e.radius) {
        this.damageEnemy(e, p.damage, true)
      }
    }
    this.shake(5)
  }

  private updateMeteors(dt: number) {
    for (const m of this.meteors) {
      m.t -= dt
      if (m.t <= 0) {
        // impact
        this.rings.push({ x: m.x, y: m.y, r: 8, maxR: m.radius, life: 0.35, color: 'rgba(255,120,40,0.75)' })
        for (const e of this.enemies) {
          if (Math.hypot(e.x - m.x, e.y - m.y) < m.radius + e.radius) {
            this.damageEnemy(e, m.damage, true)
          }
        }
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2
          const sp = 60 + Math.random() * 140
          this.particles.push({
            x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 0.4, maxLife: 0.4, text: '🔥', size: 16, color: '#ff922b',
          })
        }
        this.shake(7)
      }
    }
    this.meteors = this.meteors.filter((m) => m.t > 0)
  }

  private hurtHero(dmg: number) {
    if (this.hero.invuln > 0 || this.hero.shieldT > 0) return
    this.hero.hp -= dmg
    this.hero.invuln = 0.2
    this.floatText(this.hero.x, this.hero.y - 26, `-${Math.round(dmg)}`, '#ff8787', 18)
    this.shake(6)
  }

  private endRun() {
    if (this.status === 'dead') return
    this.status = 'dead'
    const essence = this.wave * 6 + this.kills * 2 + this.eliteKills * 8 + this.gold
    this.opts.onRunEnd({ wave: this.wave, kills: this.kills, essence })
    this.emit()
  }

  // ---------- fx ----------
  private floatText(x: number, y: number, text: string, color: string, size: number) {
    this.particles.push({ x, y, vx: (Math.random() - 0.5) * 30, vy: -60, life: 0.8, maxLife: 0.8, text, size, color })
  }
  private shake(a: number) { this.shakeAmt = Math.max(this.shakeAmt, a) }

  // ---------- ambient weather (per biome) ----------
  private updateAmbient(dt: number) {
    // keep a population of drifting particles across the visible area
    const target = 70
    while (this.ambient.length < target) this.spawnAmbient()
    for (const p of this.ambient) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
    }
    this.ambient = this.ambient.filter(
      (p) => p.life > 0 &&
        p.x > this.cam.x - 60 && p.x < this.cam.x + WIDTH + 60 &&
        p.y > this.cam.y - 60 && p.y < this.cam.y + HEIGHT + 60,
    )
  }

  private spawnAmbient() {
    // spawn somewhere around the camera view, styled to the hero's region
    const biome = this.biome
    const x = this.cam.x - 40 + Math.random() * (WIDTH + 80)
    const y = this.cam.y - 40 + Math.random() * (HEIGHT + 80)
    let p: Ambient
    switch (biome) {
      case 'snow':
        p = { x, y: this.cam.y - 30, vx: -10 + Math.random() * 20, vy: 40 + Math.random() * 40, life: 12, maxLife: 12, size: 2 + Math.random() * 2, color: '#eaf6ff', kind: biome }
        break
      case 'volcano':
        p = { x, y: this.cam.y + HEIGHT + 20, vx: -8 + Math.random() * 16, vy: -50 - Math.random() * 50, life: 6, maxLife: 6, size: 2 + Math.random() * 2, color: Math.random() < 0.5 ? '#ff922b' : '#ffd43b', kind: biome }
        break
      case 'forest':
        p = { x, y, vx: 15 + Math.random() * 20, vy: 12 + Math.random() * 16, life: 8, maxLife: 8, size: 2 + Math.random() * 2, color: Math.random() < 0.5 ? '#8ce99a' : '#ffe066', kind: biome }
        break
      default: // dungeon dust motes
        p = { x, y, vx: -6 + Math.random() * 12, vy: -4 + Math.random() * 8, life: 7, maxLife: 7, size: 1.5 + Math.random() * 1.5, color: 'rgba(200,210,255,0.6)', kind: biome }
    }
    this.ambient.push(p)
  }

  private drawAmbient() {
    const ctx = this.ctx
    ctx.save()
    for (const p of this.ambient) {
      const fade = Math.min(1, p.life / 1.5) * Math.min(1, (p.maxLife - p.life) / 0.6)
      ctx.globalAlpha = Math.max(0, fade) * (p.kind === 'dungeon' ? 0.5 : 0.85)
      if (p.kind === 'volcano') { ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = p.color; ctx.shadowBlur = 8 }
      else { ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0 }
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }

  // ---------- render ----------
  private render() {
    const ctx = this.ctx
    ctx.save()
    if (this.shakeAmt > 0) {
      ctx.translate((Math.random() - 0.5) * this.shakeAmt, (Math.random() - 0.5) * this.shakeAmt)
      this.shakeAmt *= 0.85
      if (this.shakeAmt < 0.4) this.shakeAmt = 0
    }

    // ---- world space (offset by the camera) ----
    ctx.save()
    ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y))

    this.drawFloor()
    this.drawDecor()

    const style = SWORD_STYLES[this.swordStyleId]
    // slashes — a wide crescent of force that grows with the sword's tier
    for (const sl of this.slashes) {
      const t = Math.max(0, sl.life / sl.maxLife)
      const grow = 1 - t // 0 → 1 as it fades
      const radius = sl.range * (0.6 + grow * 0.55)
      const a0 = sl.angle - sl.arc / 2
      const a1 = sl.angle + sl.arc / 2
      // filled crescent
      ctx.globalAlpha = t * 0.5
      ctx.fillStyle = style.edge
      ctx.beginPath()
      ctx.arc(sl.x, sl.y, radius, a0, a1)
      ctx.arc(sl.x, sl.y, radius * 0.55, a1, a0, true)
      ctx.closePath()
      ctx.fill()
      // bright leading edge
      ctx.globalAlpha = t
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 4 + sl.tier
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(sl.x, sl.y, radius, a0, a1)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // rings
    for (const r of this.rings) {
      ctx.strokeStyle = r.color
      ctx.lineWidth = 6
      ctx.globalAlpha = Math.max(0, r.life / 0.35)
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // meteor target reticles (fill up as impact nears)
    for (const m of this.meteors) {
      const p = 1 - Math.min(1, m.t / 1.25)
      ctx.strokeStyle = 'rgba(255,120,40,0.9)'
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = 'rgba(255,120,40,0.28)'
      ctx.beginPath(); ctx.arc(m.x, m.y, m.radius * p, 0, Math.PI * 2); ctx.fill()
      // incoming meteor streak
      const fall = 60 * m.t
      ctx.strokeStyle = 'rgba(255,180,80,0.85)'
      ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(m.x, m.y - fall - 20); ctx.lineTo(m.x, m.y - fall); ctx.stroke()
    }

    // XP gems (only those in view)
    for (const g of this.gems) {
      if (!this.inView(g.x, g.y, 30)) continue
      const r = g.big ? 6 : 4
      ctx.save()
      ctx.shadowColor = g.big ? '#ffd43b' : '#8cf5ff'
      ctx.shadowBlur = 10
      ctx.fillStyle = g.big ? '#ffe066' : '#63e6ff'
      ctx.translate(g.x, g.y)
      ctx.rotate(this.floorPhase * 2)
      ctx.beginPath()
      ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    // ground loot pickups
    this.drawPickups()

    // enemies
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const e of this.enemies) this.drawEnemy(e)

    // projectiles
    ctx.save()
    for (const p of this.projectiles) {
      if (p.spin) {
        // spinning axe
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.spin)
        ctx.shadowColor = '#000'; ctx.shadowBlur = 4
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -8); ctx.stroke()
        ctx.fillStyle = '#cfd6e0'
        ctx.beginPath(); ctx.moveTo(-2, -8); ctx.quadraticCurveTo(9, -10, 8, -2); ctx.quadraticCurveTo(2, -3, -2, -8); ctx.fill()
        ctx.restore()
        continue
      }
      const glow = p.color
      ctx.shadowColor = glow
      ctx.shadowBlur = 14
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = glow; ctx.fill()
      ctx.shadowBlur = 0
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'; ctx.fill()
    }
    ctx.restore()

    // lightning bolts
    if (this.bolts.length) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = '#fff6c2'; ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 12
      for (const b of this.bolts) {
        ctx.globalAlpha = Math.max(0, b.life / 0.18)
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(b.x1, b.y1)
        const segs = 5
        for (let i = 1; i < segs; i++) {
          const t = i / segs
          const jx = (Math.random() - 0.5) * 16
          const jy = (Math.random() - 0.5) * 16
          ctx.lineTo(b.x1 + (b.x2 - b.x1) * t + jx, b.y1 + (b.y2 - b.y1) * t + jy)
        }
        ctx.lineTo(b.x2, b.y2)
        ctx.stroke()
      }
      ctx.restore()
    }

    // orbiting spirit blades
    const orbit = this.weapons.find((w) => w.id === 'orbit')
    if (orbit) {
      const count = 1 + orbit.level
      const rad = 62 + orbit.level * 8
      ctx.save()
      for (let i = 0; i < count; i++) {
        const a = this.orbitAngle + (i / count) * Math.PI * 2
        const bx = this.hero.x + Math.cos(a) * rad
        const by = this.hero.y + Math.sin(a) * rad
        ctx.save()
        ctx.translate(bx, by)
        ctx.rotate(a + Math.PI / 2)
        ctx.shadowColor = '#a5d8ff'; ctx.shadowBlur = 10
        ctx.fillStyle = '#e7f5ff'
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(3, 6); ctx.lineTo(0, 10); ctx.lineTo(-3, 6); ctx.closePath(); ctx.fill()
        ctx.restore()
      }
      ctx.restore()
    }

    this.drawHero()

    // particles / float text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
      ctx.font = `bold ${p.size}px system-ui, sans-serif`
      ctx.fillStyle = p.color
      ctx.fillText(p.text, p.x, p.y)
    }
    ctx.globalAlpha = 1

    this.drawAmbient() // snow / embers / leaves drifting over the scene

    ctx.restore() // end world space

    // ---- screen space overlays ----
    if (this.freezeT > 0) {
      ctx.fillStyle = `rgba(120,190,255,${0.12 * Math.min(1, this.freezeT)})`
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.6 * this.flash})`
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
    }
    this.drawVignette()
    this.drawMinimap()
    this.drawJoystick()
    ctx.restore()
  }

  private drawJoystick() {
    if (!this.joyActive) return
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(this.joyBase.x, this.joyBase.y, this.JOY_R, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.beginPath(); ctx.arc(this.joyBase.x, this.joyBase.y, this.JOY_R, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.beginPath(); ctx.arc(this.joyKnob.x, this.joyKnob.y, 26, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  private drawMinimap() {
    const ctx = this.ctx
    const w = 150
    const h = w * (WORLD_H / WORLD_W)
    const x = WIDTH - w - 12
    const y = HEIGHT - h - 12
    const sx = w / WORLD_W
    const sy = h / WORLD_H
    ctx.save()
    ctx.globalAlpha = 0.85
    // region quadrants
    for (let r = 0; r < 4; r++) {
      const pal = BIOMES[BIOME_ORDER[r]]
      const qx = x + (r % 2) * (w / 2)
      const qy = y + Math.floor(r / 2) * (h / 2)
      ctx.fillStyle = pal.floorA
      ctx.fillRect(qx, qy, w / 2, h / 2)
    }
    // river + road
    ctx.strokeStyle = '#3d92c9'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(x, y + this.river.y * sy); ctx.lineTo(x + w, y + this.river.y * sy); ctx.stroke()
    ctx.strokeStyle = '#8a7f66'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x + this.road.x * sx, y); ctx.lineTo(x + this.road.x * sx, y + h); ctx.stroke()
    // lakes + plaza landmarks
    for (const l of this.lakes) {
      ctx.fillStyle = l.type === 'lava' ? '#ff6b2b' : l.type === 'ice' ? '#bfe3f5' : '#2f6d6a'
      ctx.beginPath(); ctx.ellipse(x + l.x * sx, y + l.y * sy, l.rx * sx, l.ry * sy, 0, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = '#cfd3e0'
    ctx.beginPath(); ctx.arc(x + this.plaza.x * sx, y + this.plaza.y * sy, 3, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, h)
    // enemies
    ctx.fillStyle = '#ff6b6b'
    for (const e of this.enemies) ctx.fillRect(x + e.x * sx - 1, y + e.y * sy - 1, e.elite ? 3 : 2, e.elite ? 3 : 2)
    // hero
    ctx.fillStyle = '#ffe066'
    ctx.beginPath(); ctx.arc(x + this.hero.x * sx, y + this.hero.y * sy, 3, 0, Math.PI * 2); ctx.fill()
    // chests & hearts blip on the minimap so you run for them
    for (const pk of this.pickups) {
      if (pk.type !== 'chest' && pk.type !== 'heart') continue
      ctx.fillStyle = pk.type === 'chest' ? '#ffd43b' : '#ff6b6b'
      ctx.beginPath(); ctx.arc(x + pk.x * sx, y + pk.y * sy, 2.5, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }

  private drawShadow(x: number, y: number, rx: number) {
    const ctx = this.ctx
    ctx.fillStyle = 'rgba(0,0,0,0.30)'
    ctx.beginPath()
    ctx.ellipse(x, y, rx, rx * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawPickups() {
    const ctx = this.ctx
    const icon: Record<PickupType, string> = { heart: '❤️', magnet: '🧲', bomb: '💣', clock: '⏱️', gold: '🪙', chest: '🎁' }
    const glow: Record<PickupType, string> = { heart: '#ff6b6b', magnet: '#8cf5ff', bomb: '#ff922b', clock: '#a5d8ff', gold: '#ffd43b', chest: '#ffd43b' }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const p of this.pickups) {
      if (!this.inView(p.x, p.y, 60)) continue
      const bob = Math.sin(p.phase) * 3
      const big = p.type === 'chest'
      // beam of light for chests so you notice them across the map
      if (big) {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        const g = ctx.createLinearGradient(p.x, p.y - 70, p.x, p.y)
        g.addColorStop(0, 'rgba(255,220,100,0)')
        g.addColorStop(1, 'rgba(255,220,100,0.45)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.moveTo(p.x - 12, p.y); ctx.lineTo(p.x - 5, p.y - 70); ctx.lineTo(p.x + 5, p.y - 70); ctx.lineTo(p.x + 12, p.y); ctx.closePath(); ctx.fill()
        ctx.restore()
      }
      this.drawShadow(p.x, p.y + 10, big ? 14 : 9)
      // glow halo
      ctx.save()
      ctx.shadowColor = glow[p.type]
      ctx.shadowBlur = 14
      ctx.font = `${big ? 30 : 22}px system-ui, sans-serif`
      ctx.fillText(icon[p.type], p.x, p.y + bob)
      ctx.restore()
    }
  }

  // cinematic lighting: a spotlight follows the hero, edges fall into shadow
  private drawVignette() {
    const ctx = this.ctx
    const style = SWORD_STYLES[this.swordStyleId]
    const hx = this.hero.x - this.cam.x
    const hy = this.hero.y - this.cam.y
    // shadow the periphery, keep the hero lit
    const g = ctx.createRadialGradient(hx, hy, 170, hx, hy, 650)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(0.7, 'rgba(6,8,20,0.28)')
    g.addColorStop(1, 'rgba(4,6,16,0.6)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    // soft warm key-light on the hero, tinted by the sword element
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const w = ctx.createRadialGradient(hx, hy, 20, hx, hy, 230)
    w.addColorStop(0, style.glow)
    w.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = 0.14
    ctx.fillStyle = w
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.restore()
  }

  private inView(x: number, y: number, pad: number): boolean {
    return x > this.cam.x - pad && x < this.cam.x + WIDTH + pad &&
      y > this.cam.y - pad && y < this.cam.y + HEIGHT + pad
  }

  private drawFloor() {
    const ctx = this.ctx
    const step = 64
    // organic ground tiles across the visible area
    const x0 = Math.floor(this.cam.x / step) * step
    const y0 = Math.floor(this.cam.y / step) * step
    const x1 = this.cam.x + WIDTH
    const y1 = this.cam.y + HEIGHT
    for (let gy = y0; gy < y1; gy += step) {
      for (let gx = x0; gx < x1; gx += step) {
        const biome = regionAt(gx + 1, gy + 1)
        const seed = ((gx * 73856093) ^ (gy * 19349663)) >>> 0
        const img = this.tileImgs[biome]
        if (img && img.complete && img.naturalWidth > 0) {
          // painted texture; mirror some cells to hide the repeat
          const fx = seed & 1 ? -1 : 1
          const fy = seed & 2 ? -1 : 1
          ctx.save()
          ctx.translate(gx + step / 2, gy + step / 2)
          ctx.scale(fx, fy)
          ctx.drawImage(img, -step / 2 - 0.5, -step / 2 - 0.5, step + 1, step + 1)
          ctx.restore()
        } else {
          // vector fallback until the texture loads
          const pal = BIOMES[biome]
          ctx.fillStyle = (seed % 2 === 0) ? pal.floorA : pal.floorB
          ctx.fillRect(gx, gy, step, step)
          this.decorateTile(biome, gx, gy, step)
        }
      }
    }

    // ---- designed landmarks (drawn over the ground) ----
    this.drawLakes()
    this.drawRiver()
    this.drawRoad()
    this.drawPlaza()
    this.drawBridges()

    // world border wall
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth = 20
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H)
  }

  private drawLakes() {
    const ctx = this.ctx
    const t = this.floorPhase
    for (const l of this.lakes) {
      if (!this.inView(l.x, l.y, Math.max(l.rx, l.ry) + 40)) continue
      if (l.type === 'ice') {
        ctx.fillStyle = '#bfe3f5'
        ctx.beginPath(); ctx.ellipse(l.x, l.y, l.rx, l.ry, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.beginPath(); ctx.ellipse(l.x - l.rx * 0.2, l.y - l.ry * 0.2, l.rx * 0.55, l.ry * 0.4, -0.3, 0, Math.PI * 2); ctx.fill()
        // cracks
        ctx.strokeStyle = 'rgba(150,200,230,0.7)'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(l.x - l.rx * 0.5, l.y); ctx.lineTo(l.x, l.y - l.ry * 0.3); ctx.lineTo(l.x + l.rx * 0.5, l.y + l.ry * 0.2); ctx.stroke()
        ctx.strokeStyle = 'rgba(200,235,255,0.9)'; ctx.lineWidth = 3
        ctx.beginPath(); ctx.ellipse(l.x, l.y, l.rx, l.ry, 0, 0, Math.PI * 2); ctx.stroke()
      } else if (l.type === 'lava') {
        const pulse = 0.5 + 0.3 * Math.sin(t * 2)
        ctx.fillStyle = '#2a0f0a'
        ctx.beginPath(); ctx.ellipse(l.x, l.y, l.rx + 8, l.ry + 8, 0, 0, Math.PI * 2); ctx.fill()
        const g = ctx.createRadialGradient(l.x, l.y, 10, l.x, l.y, l.rx)
        g.addColorStop(0, '#ffe066'); g.addColorStop(0.4, '#ff6b2b'); g.addColorStop(1, '#7d2a12')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.ellipse(l.x, l.y, l.rx, l.ry, 0, 0, Math.PI * 2); ctx.fill()
        // dark crust islands
        ctx.fillStyle = 'rgba(40,15,10,0.85)'
        ctx.beginPath(); ctx.ellipse(l.x - l.rx * 0.3, l.y + l.ry * 0.2, 30, 18, 0.4, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.ellipse(l.x + l.rx * 0.35, l.y - l.ry * 0.25, 24, 14, -0.3, 0, Math.PI * 2); ctx.fill()
        ctx.save(); ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = `rgba(255,180,60,${0.25 * pulse})`
        ctx.beginPath(); ctx.ellipse(l.x, l.y, l.rx * 0.9, l.ry * 0.9, 0, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      } else {
        // forest pond
        ctx.fillStyle = '#2f6d6a'
        ctx.beginPath(); ctx.ellipse(l.x, l.y, l.rx, l.ry, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(140,220,220,0.35)'
        ctx.beginPath(); ctx.ellipse(l.x - l.rx * 0.25, l.y - l.ry * 0.25, l.rx * 0.5, l.ry * 0.35, -0.3, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#3f9a6a'; ctx.lineWidth = 4
        ctx.beginPath(); ctx.ellipse(l.x, l.y, l.rx, l.ry, 0, 0, Math.PI * 2); ctx.stroke()
      }
    }
  }

  private drawRiver() {
    const ctx = this.ctx
    const { y, half } = this.river
    if (this.cam.y > y + half + 20 || this.cam.y + HEIGHT < y - half - 20) return
    const vx0 = this.cam.x, vx1 = this.cam.x + WIDTH
    const g = ctx.createLinearGradient(0, y - half, 0, y + half)
    g.addColorStop(0, '#2a6fa0'); g.addColorStop(0.5, '#3d92c9'); g.addColorStop(1, '#2a6fa0')
    ctx.fillStyle = g
    ctx.fillRect(vx0, y - half, WIDTH, half * 2)
    // banks
    ctx.fillStyle = 'rgba(120,90,60,0.5)'
    ctx.fillRect(vx0, y - half - 6, WIDTH, 6); ctx.fillRect(vx0, y + half, WIDTH, 6)
    // animated ripples
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2
    for (let i = 0; i < 3; i++) {
      const ry = y - half + 20 + i * 24
      ctx.beginPath()
      for (let x = vx0; x <= vx1; x += 16) ctx.lineTo(x, ry + Math.sin(x * 0.03 + this.floorPhase * 2 + i) * 4)
      ctx.stroke()
    }
  }

  private drawRoad() {
    const ctx = this.ctx
    const { x, half } = this.road
    if (this.cam.x > x + half + 20 || this.cam.x + WIDTH < x - half - 20) return
    const vy0 = this.cam.y
    ctx.fillStyle = '#6a6152'
    ctx.fillRect(x - half, vy0, half * 2, HEIGHT)
    // paving stones
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2
    const s = 34
    for (let py = Math.floor(vy0 / s) * s; py < vy0 + HEIGHT; py += s) {
      ctx.strokeRect(x - half + 4, py, half - 6, s - 4)
      ctx.strokeRect(x + 2, py + s / 2, half - 6, s - 4)
    }
  }

  private drawPlaza() {
    const ctx = this.ctx
    const { x, y, r } = this.plaza
    if (!this.inView(x, y, r + 40)) return
    ctx.fillStyle = '#7c8496'
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#8b94a8'
    ctx.beginPath(); ctx.arc(x, y, r - 16, 0, Math.PI * 2); ctx.fill()
    // concentric rings
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 3
    for (const rr2 of [r - 40, r - 90, r - 140]) { ctx.beginPath(); ctx.arc(x, y, rr2, 0, Math.PI * 2); ctx.stroke() }
    // radial seams
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 2
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke()
    }
  }

  private drawBridges() {
    const ctx = this.ctx
    const { y, half } = this.river
    for (const bx of this.bridges) {
      if (!this.inView(bx, y, 90)) continue
      ctx.fillStyle = '#7a5a34'
      ctx.fillRect(bx - 34, y - half - 8, 68, half * 2 + 16)
      ctx.fillStyle = '#8a6a40'
      for (let py = y - half - 4; py < y + half + 8; py += 12) ctx.fillRect(bx - 32, py, 64, 7)
      // rails
      ctx.fillStyle = '#5a3f22'
      ctx.fillRect(bx - 36, y - half - 8, 4, half * 2 + 16)
      ctx.fillRect(bx + 32, y - half - 8, 4, half * 2 + 16)
    }
  }

  // Per-tile flourishes that make each biome feel alive.
  private decorateTile(biome: Biome, gx: number, gy: number, step: number) {
    const ctx = this.ctx
    // deterministic per-tile randomness
    const seed = ((gx * 73856093) ^ (gy * 19349663)) >>> 0
    const rnd = (n: number) => (((seed * (n + 1) * 2654435761) >>> 0) % 1000) / 1000
    const t = this.floorPhase

    if (biome === 'volcano') {
      // glowing lava seams that pulse; occasional bright lava pool
      const pulse = 0.45 + 0.35 * Math.sin(t * 3 + seed % 7)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = `rgba(255,110,40,${0.5 * pulse})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(gx + rnd(1) * step, gy)
      ctx.lineTo(gx + rnd(2) * step, gy + step * 0.5)
      ctx.lineTo(gx + rnd(3) * step, gy + step)
      ctx.stroke()
      if (rnd(4) > 0.82) {
        const cx = gx + step * 0.5, cy = gy + step * 0.5
        const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22)
        g.addColorStop(0, `rgba(255,210,90,${0.7 * pulse})`)
        g.addColorStop(1, 'rgba(255,90,30,0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    } else if (biome === 'snow') {
      // twinkling frost sparkles + a bluish snow drift
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.10)'
      ctx.beginPath(); ctx.ellipse(gx + step * 0.5, gy + step * 0.7, step * 0.4, step * 0.16, 0, 0, Math.PI * 2); ctx.fill()
      for (let i = 0; i < 3; i++) {
        const sx = gx + rnd(i + 1) * step
        const sy = gy + rnd(i + 5) * step
        const tw = 0.5 + 0.5 * Math.sin(t * 4 + seed + i * 2)
        ctx.fillStyle = `rgba(255,255,255,${0.25 + tw * 0.6})`
        ctx.beginPath(); ctx.arc(sx, sy, 1.2 + tw, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    } else if (biome === 'forest') {
      // grass tufts + occasional flower
      ctx.strokeStyle = 'rgba(120,210,120,0.5)'
      ctx.lineWidth = 1.5
      for (let i = 0; i < 3; i++) {
        const bx = gx + rnd(i + 1) * step
        const by = gy + step - 6 - rnd(i + 4) * 10
        ctx.beginPath(); ctx.moveTo(bx, by + 6); ctx.lineTo(bx - 2, by); ctx.moveTo(bx, by + 6); ctx.lineTo(bx + 2, by); ctx.stroke()
      }
      if (rnd(9) > 0.85) {
        ctx.fillStyle = rnd(10) > 0.5 ? '#ffd43b' : '#ff8fab'
        ctx.beginPath(); ctx.arc(gx + rnd(2) * step, gy + rnd(3) * step, 2, 0, Math.PI * 2); ctx.fill()
      }
    } else {
      // dungeon: faint cracks
      if (rnd(1) > 0.6) {
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(gx + rnd(2) * step, gy + rnd(3) * step)
        ctx.lineTo(gx + rnd(4) * step, gy + rnd(5) * step)
        ctx.stroke()
      }
    }
  }

  private drawDecor() {
    const ctx = this.ctx
    const minX = this.cam.x - 40
    const maxX = this.cam.x + WIDTH + 40
    const minY = this.cam.y - 40
    const maxY = this.cam.y + HEIGHT + 40
    // light sources: colour + flicker per glowing prop type
    const LIGHT: Record<string, { c: string; r: number }> = {
      lava: { c: '255,120,40', r: 60 },
      vent: { c: '255,120,40', r: 70 },
      obelisk: { c: '140,160,255', r: 70 },
      icespire: { c: '150,210,255', r: 55 },
      statue: { c: '150,170,255', r: 45 },
    }
    for (const d of this.decor) {
      if (d.x < minX || d.x > maxX || d.y < minY || d.y > maxY) continue
      const light = LIGHT[d.type]
      if (light) {
        const flick = 0.7 + Math.sin(this.floorPhase * 6 + d.x) * 0.15
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        const r = light.r * d.s
        const g = ctx.createRadialGradient(d.x, d.y - 4, 2, d.x, d.y - 4, r)
        g.addColorStop(0, `rgba(${light.c},${0.5 * flick})`)
        g.addColorStop(1, `rgba(${light.c},0)`)
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(d.x, d.y - 4, r, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      }
      this.drawShadow(d.x, d.y + 6 * d.s, 12 * d.s)
      ctx.save()
      ctx.translate(d.x, d.y)
      ctx.scale(d.s, d.s)
      this.drawProp(d.type)
      ctx.restore()
    }
  }

  private drawProp(type: string) {
    const ctx = this.ctx
    switch (type) {
      case 'tree':
        ctx.fillStyle = '#5a3a24'; ctx.fillRect(-3, -2, 6, 16)
        ctx.fillStyle = '#2f7d3a'; ctx.beginPath(); ctx.arc(0, -12, 14, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#3c9a4a'; ctx.beginPath(); ctx.arc(-5, -8, 9, 0, Math.PI * 2); ctx.fill()
        break
      case 'bush':
        ctx.fillStyle = '#2f7d3a'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.arc(9, 2, 7, 0, Math.PI * 2); ctx.fill()
        break
      case 'pine':
        ctx.fillStyle = '#5a3a24'; ctx.fillRect(-2, 6, 4, 8)
        ctx.fillStyle = '#3f6f52'
        ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(10, 8); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#d7ecf5'; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(4, -6); ctx.lineTo(-4, -6); ctx.closePath(); ctx.fill()
        break
      case 'icerock':
        ctx.fillStyle = '#9ec9e6'; ctx.beginPath(); ctx.moveTo(-10, 8); ctx.lineTo(-4, -10); ctx.lineTo(6, -4); ctx.lineTo(11, 8); ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#e6faff'; ctx.beginPath(); ctx.moveTo(-4, -10); ctx.lineTo(0, 0); ctx.lineTo(6, -4); ctx.closePath(); ctx.fill()
        break
      case 'lava':
        ctx.fillStyle = '#3a1a12'; ctx.beginPath(); ctx.ellipse(0, 2, 15, 9, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#ff6b2b'; ctx.beginPath(); ctx.ellipse(0, 2, 11, 6, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#ffd43b'; ctx.beginPath(); ctx.ellipse(-2, 1, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill()
        break
      case 'rock':
        ctx.fillStyle = '#5a3730'; ctx.beginPath(); ctx.moveTo(-9, 7); ctx.lineTo(-3, -7); ctx.lineTo(7, -3); ctx.lineTo(10, 7); ctx.closePath(); ctx.fill()
        break
      case 'pillar':
        ctx.fillStyle = '#3a3f5c'; ctx.fillRect(-6, -22, 12, 30)
        ctx.fillStyle = '#4a5178'; ctx.fillRect(-8, -24, 16, 5); ctx.fillRect(-8, 4, 16, 5)
        break
      case 'bones':
        ctx.strokeStyle = '#d9d3c4'; ctx.lineWidth = 3; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(8, -4); ctx.stroke()
        ctx.beginPath(); ctx.arc(9, -5, 3, 0, Math.PI * 2); ctx.stroke()
        break
      case 'deadtree':
        ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 5; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -14)
        ctx.moveTo(0, -4); ctx.lineTo(-10, -14); ctx.moveTo(0, -8); ctx.lineTo(9, -18)
        ctx.moveTo(0, 0); ctx.lineTo(-8, 4); ctx.stroke()
        break
      case 'icespire':
        ctx.fillStyle = '#9ad4ff'
        ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(-3, -22); ctx.lineTo(2, 12); ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#e6faff'
        ctx.beginPath(); ctx.moveTo(2, 12); ctx.lineTo(6, -12); ctx.lineTo(10, 12); ctx.closePath(); ctx.fill()
        break
      case 'vent':
        ctx.fillStyle = '#2a1712'; ctx.beginPath(); ctx.moveTo(-12, 12); ctx.lineTo(-6, -8); ctx.lineTo(6, -8); ctx.lineTo(12, 12); ctx.closePath(); ctx.fill()
        ctx.save(); ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = 'rgba(255,120,40,0.7)'; ctx.beginPath(); ctx.ellipse(0, -8, 6, 3, 0, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
        break
      case 'statue':
        ctx.fillStyle = '#4a5178'; ctx.fillRect(-9, 6, 18, 8) // plinth
        ctx.fillStyle = '#6b7299'; ctx.fillRect(-5, -16, 10, 22) // body
        ctx.beginPath(); ctx.arc(0, -20, 5, 0, Math.PI * 2); ctx.fill() // head
        break
      case 'obelisk':
        ctx.fillStyle = '#3a4066'; ctx.beginPath(); ctx.moveTo(-8, 16); ctx.lineTo(-5, -30); ctx.lineTo(0, -36); ctx.lineTo(5, -30); ctx.lineTo(8, 16); ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#565d8c'; ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(5, -30); ctx.lineTo(2, 16); ctx.lineTo(0, 16); ctx.closePath(); ctx.fill()
        ctx.save(); ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = `rgba(140,160,255,${0.4 + 0.3 * Math.sin(this.floorPhase * 2)})`
        ctx.beginPath(); ctx.arc(0, -10, 4, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
        break
      default: // rubble
        ctx.fillStyle = '#2f3450'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.arc(7, 3, 4, 0, Math.PI * 2); ctx.fill()
    }
  }

  private drawEnemy(e: Enemy) {
    const ctx = this.ctx
    this.drawShadow(e.x, e.y + e.radius * 0.7, e.radius * 0.8)
    drawCreature(ctx, {
      x: e.x, y: e.y, kind: e.kind, radius: e.radius,
      facing: e.facing, phase: e.phase, hitFlash: e.hitFlash,
      elite: e.elite, pal: BIOMES[e.ebiome],
    })
    // health bar
    if (e.hp < e.maxHp) {
      const w = e.radius * 2
      const x = e.x - w / 2
      const y = e.y - e.radius - 16
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(x - 1, y - 1, w + 2, 6)
      ctx.fillStyle = e.kind === 'boss' ? '#ff6b6b' : e.elite ? '#ffd43b' : '#69db7c'
      ctx.fillRect(x, y, w * (e.hp / e.maxHp), 4)
    }
  }

  private drawHero() {
    const ctx = this.ctx
    const h = this.hero
    const style = SWORD_STYLES[this.swordStyleId]
    // elemental ground glow beneath the hero (colour of the equipped sword)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const pulse = 0.55 + Math.sin(this.floorPhase * 3) * 0.12
    const gg = ctx.createRadialGradient(h.x, h.y + 14, 4, h.x, h.y + 14, 52)
    gg.addColorStop(0, style.glow)
    gg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = pulse
    ctx.fillStyle = gg
    ctx.beginPath(); ctx.ellipse(h.x, h.y + 16, 46, 20, 0, 0, Math.PI * 2); ctx.fill()
    // faint aura halo around the body
    const ag = ctx.createRadialGradient(h.x, h.y - 8, 6, h.x, h.y - 8, 40)
    ag.addColorStop(0, 'rgba(0,0,0,0)')
    ag.addColorStop(0.6, 'rgba(0,0,0,0)')
    ag.addColorStop(1, style.glow)
    ctx.globalAlpha = 0.35 * pulse
    ctx.fillStyle = ag
    ctx.beginPath(); ctx.arc(h.x, h.y - 6, 40, 0, Math.PI * 2); ctx.fill()
    ctx.restore()

    this.drawShadow(h.x, h.y + 22, 16)
    // draw the character slightly larger so it reads as the hero of the scene
    ctx.save()
    ctx.translate(h.x, h.y)
    ctx.scale(1.1, 1.1)
    ctx.translate(-h.x, -h.y)
    drawKnight(ctx, {
      x: h.x, y: h.y, facing: h.facing, walkPhase: h.walkPhase, moving: h.moving,
      swingT: h.swingT, swingDur: h.swingMax, swingAngle: h.swingAngle, swingDir: h.swingDir, aim: h.aim,
      swordTier: this.swordTier, styleId: this.swordStyleId, time: this.floorPhase,
      invuln: h.invuln, shield: h.shieldT > 0, faceDir: h.faceDir,
    })
    ctx.restore()
  }

  // ---------- emit HUD ----------
  private emit() {
    const h = this.hero
    const s = this.stats
    const ab: AbilityView[] = [
      { key: 'Q', name: 'Dash', icon: '💨', cdLeft: h.dashCd, cdMax: s.dashCd, manaCost: s.dashMana },
      { key: 'SPC', name: 'Whirl', icon: '🌪️', cdLeft: h.whirlCd, cdMax: s.whirlCd, manaCost: s.whirlMana },
      { key: 'E', name: 'Fire', icon: '🔥', cdLeft: h.fireCd, cdMax: s.fireCd, manaCost: s.fireMana },
      { key: 'R', name: 'Meteor', icon: '☄️', cdLeft: h.ultCd, cdMax: s.ultCd, manaCost: s.ultMana },
      { key: 'F', name: 'Heal', icon: '✚', cdLeft: h.healCd, cdMax: s.healCd, manaCost: s.healMana },
    ]
    const state: HudState = {
      status: this.status,
      hp: Math.max(0, Math.round(h.hp)),
      maxHp: Math.round(s.maxHp),
      mana: Math.round(h.mana),
      maxMana: Math.round(s.maxMana),
      level: h.level,
      xp: Math.round(h.xp),
      xpToNext: h.xpToNext,
      time: this.survTime,
      gold: this.gold,
      wave: this.wave,
      kills: this.kills,
      swordLvl: this.opts.swordLvl,
      swordTier: this.swordTier,
      swordStyleName: SWORD_STYLES[this.swordStyleId].name,
      swordStyleIcon: SWORD_STYLES[this.swordStyleId].icon,
      biome: BIOMES[this.biome].name,
      abilities: ab,
      weapons: this.weapons.map((w) => ({ icon: WEAPONS[w.id].icon, level: w.level })),
      cards: this.status === 'levelup' ? this.choices : [],
      runWave: this.wave,
      runKills: this.kills,
      essenceEarned: this.wave * 6 + this.kills * 2 + this.eliteKills * 8 + this.gold,
    }
    this.opts.onState(state)
  }
}
