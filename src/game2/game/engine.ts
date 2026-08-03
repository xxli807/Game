import {
  Stats,
  HudState,
  GameStatus,
  AbilityView,
  DraftChoice,
  Rarity,
  SkillId,
  OwnedSkill,
  ClassId,
  CLASSES,
  SKILLS,
  classSkillSynergies,
  classBaseSkillIds,
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
import { audio } from './audio'
import {
  StoryEvent, LAYERS, layerForStage, isLordStage, depthForStage,
  OPENING, FINAL_STAGE, LORD_DOWN, BARKS, randomLine,
} from './story'

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

type HeroFaceDir =
  | 'up'
  | 'upRight'
  | 'right'
  | 'downRight'
  | 'down'
  | 'downLeft'
  | 'left'
  | 'upLeft'

interface Hero {
  x: number
  y: number
  hp: number
  rage: number
  aim: number // facing angle
  attackTimer: number
  swingT: number // slash animation timer
  swingMax: number
  skillAttackT: number // keeps attack frames active briefly after a successful skill
  swingAngle: number
  swingDir: number // +1 / -1 alternating sweep direction
  dashCd: number
  whirlCd: number
  fireCd: number
  ultCd: number
  healCd: number
  shieldT: number // active damage shield
  counterT: number
  lastStandT: number
  furyT: number
  willT: number
  willCd: number
  dashT: number // active dash timer
  dashDir: Vec
  dashHits: Set<Enemy>
  invuln: number
  walkPhase: number
  facing: number // 1 = right, -1 = left (side view flip)
  faceDir: HeroFaceDir
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
  hitFlash: number
  knock: Vec
  phase: number // idle bob animation
  facing: number
  elite: boolean
  ebiome: Biome // which region it belongs to (drives its look)
  slowT: number // frost slow timer
  wCd: number // weapon damage tick cooldown (orbit/aura)
  bleedT: number
  bleedDps: number
  bleedTick: number
  // layer-lord state (0 = ordinary enemy, 1..4 = which fallen champion this is)
  lord: number
  castCd: number // time until the next signature attack
  windup: number // >0 while the telegraph is showing, then the attack lands
  phase2: boolean // the Hollow King's second phase
}

interface Skeleton {
  x: number
  y: number
  damage: number
  speed: number
  attackCd: number
  phase: number
  empowered: boolean
}

interface Corpse {
  x: number
  y: number
  life: number
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
  clearedStage: number
  kills: number
}

interface Opts {
  stats: Stats
  classId: ClassId
  onState: (s: HudState) => void
  onRunEnd: (r: RunEnd) => void
  onStageCleared: (stage: number) => void
  onStory: (e: StoryEvent) => void
}

// Ability-bar slots, in the order owned active skills fill them.
const ABILITY_KEYS = ['Q', 'E', 'SPC', 'R', 'F'] as const
// Cooldown (s) / Rage for evolved Warrior skills.
const ACTIVE_CFG: Partial<Record<SkillId, { cd: number; rage: number }>> = {
  inferno: { cd: 8, rage: 40 },
  'blade-dancer': { cd: 7, rage: 35 },
  'guardian-angel': { cd: 9, rage: 45 },
  'absolute-zero': { cd: 18, rage: 50 },
  tempest: { cd: 14, rage: 55 },
  titanbreaker: { cd: 12, rage: 60 },
  'mage-cinderbolt': { cd: 0, rage: 18 },
  'mage-frost-nova': { cd: 0, rage: 24 },
  'mage-arcane-orbs': { cd: 0, rage: 28 },
  'mage-blink': { cd: 0, rage: 20 },
  'mage-ice-barrier': { cd: 0, rage: 32 },
  'mage-pyroclasm': { cd: 8, rage: 42 },
  'mage-frozen-tempest': { cd: 10, rage: 45 },
  'mage-arcane-barrage': { cd: 9, rage: 48 },
  'mage-prismatic-step': { cd: 7, rage: 35 },
  'mage-glacial-aegis': { cd: 14, rage: 50 },
  'mage-elemental-convergence': { cd: 16, rage: 60 },
  'necro-raise-skeleton': { cd: 0, rage: 18 },
  'necro-bone-spear': { cd: 0, rage: 22 },
  'necro-corpse-burst': { cd: 0, rage: 25 },
  'necro-blood-nova': { cd: 0, rage: 30 },
  'necro-decrepify': { cd: 0, rage: 24 },
  'necro-skeleton-legion': { cd: 10, rage: 45 },
  'necro-ossuary-lance': { cd: 8, rage: 42 },
  'necro-corpse-cathedral': { cd: 12, rage: 48 },
  'necro-crimson-covenant': { cd: 14, rage: 50 },
  'necro-withering-army': { cd: 12, rage: 46 },
  'necro-army-of-the-dead': { cd: 18, rage: 60 },
}

const KIND_EMOJI: Record<EnemyKind, string> = {
  grunt: '👹',
  fast: '🦇',
  tank: '🐗',
  ranged: '💀',
  boss: '🐲',
}

// ---------- Auto-weapons (collected & levelled through the draft) ----------
// Ambient auto-weapon runtime (kept for the orbiting-blade visuals); no longer drafted.
type WeaponId = 'orbit' | 'wand' | 'aura' | 'axe' | 'lightning'
interface OwnedWeapon { id: WeaponId; level: number; timer: number }
interface Bolt { x1: number; y1: number; x2: number; y2: number; life: number }
interface LevelOpt { choice: DraftChoice; apply: () => void; weight: number }

export class GameEngine {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private opts: Opts
  private stats: Stats
  private readonly classId: ClassId

  private status: GameStatus = 'playing'
  private hero!: Hero
  private enemies: Enemy[] = []
  private projectiles: Projectile[] = []
  private particles: Particle[] = []
  private slashes: SlashFx[] = []
  private rings: RingFx[] = []
  private meteors: Meteor[] = []
  private skeletons: Skeleton[] = []
  private corpses: Corpse[] = []

  private stage = 1
  private stageSpawned = 0
  private stageKills = 0
  private kills = 0
  private eliteKills = 0
  private swordTier = 1
  private swordStyleId: SwordStyleId = 'steel'
  private biome: Biome = 'dungeon'
  // story descent: which layer (0..3) we're in, its display name, and collected relics
  private layerIndex = -1
  private layerName = ''
  private relics = new Set<string>()
  private barkedLowHp = false
  // juice: brief world-freeze on impact, and a decaying kill streak
  private hitStop = 0
  private hitStopCd = 0
  private combo = 0
  private comboT = 0
  private bestCombo = 0
  private spawnTimer = 0
  private swingFlip = 1
  private weapons: OwnedWeapon[] = []
  private skills: OwnedSkill[] = []
  private skillCd: Partial<Record<SkillId, number>> = {}
  private orbitAngle = 0
  private bolts: Bolt[] = []
  private choices: DraftChoice[] = []
  private choiceActions: Record<string, () => void> = {}
  private decor: Decoration[] = []
  private ambient: Ambient[] = []
  private pickups: Pickup[] = []
  private gold = 0
  private freezeT = 0
  private flash = 0
  private treasureTimer = 18
  private skeletonFrenzyT = 0
  private survTime = 0
  private readonly MAX_STAGE_ENEMIES = 140
  private cam: Vec = { x: 0, y: 0 }

  // painted ground textures per biome (loaded from public/arts)
  private tileImgs: Partial<Record<Biome, HTMLImageElement>> = {}
  // character / enemy sprites
  private heroImg?: HTMLImageElement
  private heroDir: Partial<Record<'up' | 'down' | 'side', HTMLImageElement>> = {}
  private heroAtk: HTMLImageElement[] = []
  private heroTurn: HTMLImageElement[] = []
  private heroWalkDown: HTMLImageElement[] = []
  private heroWalkSide: HTMLImageElement[] = []
  private heroWalkUp: HTMLImageElement[] = []
  private heroWalkUpRight: HTMLImageElement[] = []
  private heroWalkDownRight: HTMLImageElement[] = []
  private enemyImgs: Partial<Record<EnemyKind, HTMLImageElement>> = {}
  private lordImgs: HTMLImageElement[] = []
  private cinderMawRun: HTMLImageElement[] = []

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
  private heroTurnT = 0
  private heroTurnFrom = 0
  private heroTurnTo = 0
  private readonly HERO_TURN_DURATION = 0.2

  constructor(canvas: HTMLCanvasElement, opts: Opts) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.opts = opts
    this.stats = opts.stats
    this.classId = opts.classId
    this.loadArt()
    this.bindInput()
    this.reset()
    this.loop(performance.now())
  }

  private loadArt() {
    const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
    const load = (file: string) => { const i = new Image(); i.src = `${base}arts/${file}.png`; return i }
    const biomes: Biome[] = ['dungeon', 'forest', 'snow', 'volcano']
    for (const b of biomes) this.tileImgs[b] = load(`tile_${b}`)
    const heroPrefix = this.classId === 'warrior' ? 'hero_ashen' : 'hero_mage'
    this.heroImg = load(`${heroPrefix}_turn_1`)
    this.heroDir = {
      down: load(`${heroPrefix}_turn_1`),
      up: load(`${heroPrefix}_turn_4`),
      side: load(`${heroPrefix}_turn_3`),
    }
    this.heroTurn = Array.from({ length: 4 }, (_, index) => load(`${heroPrefix}_turn_${index + 1}`))
    this.heroAtk = Array.from({ length: 6 }, (_, index) => load(`${heroPrefix}_attack_${index + 1}`))
    this.heroWalkDown = Array.from({ length: 8 }, (_, index) => load(`${heroPrefix}_walk_s_${index + 1}`))
    this.heroWalkSide = Array.from({ length: 8 }, (_, index) => load(`${heroPrefix}_walk_e_${index + 1}`))
    this.heroWalkUp = Array.from({ length: 8 }, (_, index) => load(`${heroPrefix}_walk_up_${index + 1}`))
    this.heroWalkUpRight = Array.from({ length: 8 }, (_, index) => load(`${heroPrefix}_walk_ne_${index + 1}`))
    this.heroWalkDownRight = Array.from({ length: 8 }, (_, index) => load(`${heroPrefix}_walk_se_${index + 1}`))
    const enemyFile: Record<EnemyKind, string> = {
      grunt: 'enemy_goblin',
      fast: 'enemy_cinder_maw',
      tank: 'enemy_ironroot_colossus',
      ranged: 'enemy_mire_oracle',
      boss: 'boss_dragon',
    }
    for (const k of Object.keys(enemyFile) as EnemyKind[]) this.enemyImgs[k] = load(enemyFile[k])
    this.cinderMawRun = Array.from({ length: 8 }, (_, n) => load(`enemy_cinder_maw_run_${n + 1}`))
    // each layer-lord wears a different hollowed form
    this.lordImgs = LAYERS.map((layer) => load(layer.lordForm))
  }

  private ready(img?: HTMLImageElement): img is HTMLImageElement {
    return !!img && img.complete && img.naturalWidth > 0
  }

  /** Draw a sprite anchored at its feet, flipped by facing, with a pop scale. */
  private blit(img: HTMLImageElement, cx: number, footY: number, targetH: number, facing: number, pop = 1) {
    const ctx = this.ctx
    const w = targetH * (img.naturalWidth / img.naturalHeight)
    ctx.save()
    ctx.translate(cx, footY)
    ctx.scale(facing * pop, pop)
    ctx.drawImage(img, -w / 2, -targetH, w, targetH)
    ctx.restore()
  }

  // ---------- lifecycle ----------
  private reset() {
    // start in the middle of the dungeon region (top-left quadrant)
    this.hero = {
      x: WORLD_W * 0.25,
      y: WORLD_H * 0.25,
      hp: this.stats.maxHp,
      rage: this.classId === 'mage' ? this.stats.maxRage : 0,
      aim: 0,
      attackTimer: 0,
      swingT: 0,
      swingMax: 0.3,
      skillAttackT: 0,
      swingAngle: 0,
      swingDir: 1,
      dashCd: 0,
      whirlCd: 0,
      fireCd: 0,
      ultCd: 0,
      healCd: 0,
      shieldT: 0,
      counterT: 0,
      lastStandT: 0,
      furyT: 0,
      willT: 0,
      willCd: 0,
      dashT: 0,
      dashDir: { x: 1, y: 0 },
      dashHits: new Set(),
      invuln: 0,
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
    this.skeletons = []
    this.corpses = []
    this.ambient = []
    this.pickups = []
    this.bolts = []
    this.orbitAngle = 0
    this.weapons = []
    // begin every run with one random active skill so the ability bar is lively from the start
    this.skills = []
    this.skillCd = {}
    const starters = classBaseSkillIds(this.classId).filter((id) => SKILLS[id].kind === 'active')
    this.skills.push({ id: starters[Math.floor(Math.random() * starters.length)], level: 1 })
    this.recomputeStats()
    this.heroTurnT = 0
    this.heroTurnFrom = 0
    this.heroTurnTo = 0
    this.gold = 0
    this.freezeT = 0
    this.flash = 0
    this.treasureTimer = 18
    this.skeletonFrenzyT = 0
    this.survTime = 0
    this.stage = 1
    this.stageSpawned = 0
    this.stageKills = 0
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
    this.status = 'playing'
    // story: begin the descent — Cael's opening, then the first layer
    this.layerIndex = -1
    this.relics.clear()
    this.opts.onStory({ id: 'opening', lines: OPENING })
    this.enterStage(1)
  }

  /** Set the current layer from the stage; narrate layer changes and boss (layer-lord) stages. */
  private enterStage(stage: number) {
    this.barkedLowHp = false
    const layer = layerForStage(stage)
    this.biome = layer.biome
    this.layerName = layer.name
    if (layer.index - 1 !== this.layerIndex) {
      this.layerIndex = layer.index - 1
      this.generateDecor() // re-dress the arena with this layer's own props
      this.opts.onStory({ id: `layer-${layer.index}`, numeral: layer.numeral, title: layer.name, lines: layer.enter })
    }
    if (isLordStage(stage)) {
      this.opts.onStory({ id: `lord-${stage}`, title: layer.lord, subtitle: 'LAYER-LORD', lines: layer.lordIntro })
    }
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

  /** Keep a clear ring around the spawn point so the opening reads cleanly. */
  private onClearGround(x: number, y: number): boolean {
    return Math.hypot(x - WORLD_W / 2, y - WORLD_H / 2) > 150
  }

  private addDecor(x: number, y: number, type: string, s: number) {
    if (x < 26 || x > WORLD_W - 26 || y < 26 || y > WORLD_H - 26) return
    if (!this.onClearGround(x, y)) return
    this.decor.push({ x, y, biome: regionAt(x, y), type, s })
  }

  /**
   * Scatter props belonging to the CURRENT layer only, evenly across the arena.
   * Survivor maps stay uniform and readable — the ground is a backdrop, not a
   * puzzle — so this is a light, even sprinkle with no landmarks to navigate.
   */
  private generateDecor() {
    this.decor = []
    const perType: Record<Biome, string[]> = {
      dungeon: ['pillar', 'rubble', 'statue'],
      forest: ['tree', 'tree', 'bush', 'deadtree'],
      snow: ['pine', 'icerock', 'icespire'],
      volcano: ['rock', 'rock', 'vent'],
    }
    const opts = perType[this.biome]
    for (let i = 0; i < 70; i++) {
      const x = 40 + Math.random() * (WORLD_W - 80)
      const y = 40 + Math.random() * (WORLD_H - 80)
      if (!this.onClearGround(x, y)) continue
      this.addDecor(x, y, opts[Math.floor(Math.random() * opts.length)], 0.7 + Math.random() * 0.6)
    }
  }

  private centerCamera() {
    this.cam.x = Math.max(0, Math.min(WORLD_W - WIDTH, this.hero.x - WIDTH / 2))
    this.cam.y = Math.max(0, Math.min(WORLD_H - HEIGHT, this.hero.y - HEIGHT / 2))
  }

  chooseCard(id: string) {
    if (this.status !== 'skillselect') return
    const action = this.choiceActions[id]
    if (action) action()
    this.startStage(this.stage + 1)
    this.emit()
  }

  private stageEnemyTotal(stage = this.stage): number {
    if (isLordStage(stage)) return 1
    return Math.min(this.MAX_STAGE_ENEMIES, 8 + stage * 2)
  }

  /** How many of the Hollow should be on the field at once (the pressure dial). */
  private aliveTarget(): number {
    return Math.min(this.MAX_STAGE_ENEMIES, 14 + this.stage * 4)
  }

  private startStage(stage: number) {
    this.stage = stage
    this.stageSpawned = 0
    this.stageKills = 0
    this.spawnTimer = 0
    // a layer-lord is fought alone: clear the horde so the duel reads cleanly
    if (isLordStage(stage)) this.enemies = []
    this.projectiles = this.projectiles.filter((projectile) => projectile.friendly)
    this.hero.rage = this.classId === 'mage' ? this.stats.maxRage : 0
    this.status = 'playing'
    this.lastTs = performance.now()
    if (isLordStage(stage)) {
      this.floatText(this.hero.x, this.hero.y - 70, `⚠ BOSS STAGE ${stage}!`, '#ff6b6b', 30)
      this.shake(14)
    } else {
      this.floatText(this.hero.x, this.hero.y - 60, `STAGE ${stage}`, '#ffd43b', 28)
    }
    this.enterStage(stage)
  }

  private completeStage() {
    if (this.status !== 'playing') return
    // Reaching the Molten Heart's throne (final boss) is the win, not another draft.
    if (this.stage >= FINAL_STAGE) { this.win(); return }
    this.status = 'skillselect'
    // Survivors carry over so the next stage opens mid-fight instead of empty —
    // the horde is continuous; the stage counter is just how you measure it.
    this.projectiles = this.projectiles.filter((projectile) => projectile.friendly)
    this.hero.hp = Math.min(this.stats.maxHp, this.hero.hp + this.stats.maxHp * 0.12)
    this.floatText(this.hero.x, this.hero.y - 60, `STAGE ${this.stage} CLEARED!`, '#69db7c', 30)
    audio.play('stage')
    // A layer-lord just fell: Cael says goodbye to someone he knew.
    if (isLordStage(this.stage)) {
      const layer = layerForStage(this.stage)
      this.opts.onStory({
        id: `lord-down-${this.stage}`,
        title: `${layer.lord} — at rest`,
        lines: LORD_DOWN[layer.index - 1] ?? [],
      })
    }
    this.opts.onStageCleared(this.stage)
    this.buildChoices()
    this.emit()
  }

  private win() {
    this.status = 'victory'
    this.enemies = []
    this.floatText(this.hero.x, this.hero.y - 60, '👑 ALDERMERE RECLAIMED', '#ffd43b', 34)
    audio.play('victory')
    this.opts.onStageCleared(this.stage)
    this.opts.onRunEnd({ clearedStage: this.stage, kills: this.kills })
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
      const leap = this.owned('fireball')
      const rush = this.owned('dash')
      if (e.button === 0 && leap) this.castFire(leap.level)
      if (e.button === 2 && rush) this.castDash(rush.level)
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
    this.castKey(key)
  }

  /** Activate whichever owned active skill sits in the given ability slot. */
  private castKey(key: string) {
    const idx = ABILITY_KEYS.indexOf(key as (typeof ABILITY_KEYS)[number])
    if (idx < 0) return
    const os = this.activeSkills()[idx]
    if (os) this.activateSkill(os)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    this.keys.add(k)
    if (k === 'p' || k === 'escape') { this.togglePause(); return }
    if (this.status !== 'playing') return
    if (k === 'q') this.castKey('Q')
    if (k === 'e') this.castKey('E')
    if (k === ' ') { this.castKey('SPC'); e.preventDefault() }
    if (k === 'r') this.castKey('R')
    if (k === 'f') this.castKey('F')
  }
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase())
  }

  // Enemy power grows with the finite stage number.
  private scale(): number {
    // Tuned for the 12-stage descent: stage 12 lands near 4.7x so the
    // Molten Heart bites after a run's worth of skill picks.
    return 1 + (this.stage - 1) * 0.34
  }

  private spawnEnemy(force?: EnemyKind) {
    const s = this.scale()
    let kind: EnemyKind
    if (force) {
      kind = force
    } else {
      // Later stages introduce tougher enemy types more often.
      const threat = this.stage
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
    const eliteChance = kind === 'boss' ? 0 : Math.min(0.16, 0.02 + this.stage * 0.008)
    const elite = Math.random() < eliteChance
    const hp = spec.hp * (elite ? 2.6 : 1)

    this.enemies.push({
      x, y,
      hp,
      maxHp: hp,
      kind,
      emoji: KIND_EMOJI[kind],
      radius: spec.radius * (elite ? 1.35 : 1),
      speed: spec.speed * (elite ? 0.92 : 1) * (1 + this.stage * 0.008),
      damage: spec.damage * (elite ? 1.4 : 1),
      touch: 0,
      shoot: 1 + Math.random(),
      hitFlash: 0,
      knock: { x: 0, y: 0 },
      phase: Math.random() * Math.PI * 2,
      facing: -1,
      elite,
      ebiome: this.biome,
      slowT: 0,
      wCd: 0,
      bleedT: 0,
      bleedDps: 0,
      bleedTick: 0,
      lord: 0,
      castCd: 2.4,
      windup: 0,
      phase2: false,
    })
    // On a lord stage the single boss IS the fallen champion of this layer:
    // bigger, tougher, and armed with a signature attack.
    if (kind === 'boss' && isLordStage(this.stage)) {
      const e = this.enemies[this.enemies.length - 1]
      const layer = layerForStage(this.stage)
      e.lord = layer.index
      const isKing = layer.index === LAYERS.length
      // scale() already ramps hard across the descent, so the lord multiplier
      // stays modest — a fight, not a damage sponge.
      const hpMult = isKing ? 3.2 : 1.8
      e.hp *= hpMult
      e.maxHp = e.hp
      e.radius *= isKing ? 1.3 : 1.15
      e.damage *= isKing ? 1.35 : 1.15
      e.speed *= 0.9
    }
  }

  private enemySpec(kind: EnemyKind, s: number) {
    switch (kind) {
      case 'grunt': return { hp: 15 * s, speed: 66, damage: 6 * s, radius: 18 }
      case 'fast': return { hp: 9 * s, speed: 150, damage: 5 * s, radius: 15 }
      case 'tank': return { hp: 52 * s, speed: 42, damage: 12 * s, radius: 27 }
      case 'ranged': return { hp: 14 * s, speed: 48, damage: 9 * s, radius: 17 }
      case 'boss': return { hp: 520 * s, speed: 46, damage: 24 * s, radius: 46 }
    }
  }

  // ---------- abilities ----------
  private spendRage(cost: number): boolean {
    if (this.hero.rage < cost) return false
    this.hero.rage -= cost
    const fury = this.owned('power')?.level ?? 0
    if (fury > 0) this.hero.furyT = 2.5 + fury * 0.3
    return true
  }

  private castDash(lvl: number) {
    if (this.status !== 'playing') return
    const h = this.hero
    if (h.dashCd > 0) return
    if (!this.spendRage(this.stats.dashRage)) return
    h.dashCd = this.stats.dashCd * Math.max(0.6, 1 - (lvl - 1) * 0.08)
    this.startSkillAttackAnimation()
    h.dashT = 0.16
    h.invuln = 0.16
    const dir = this.aimDir()
    h.dashDir = dir
    h.dashHits = new Set()
  }

  private castWhirl(lvl: number) {
    if (this.status !== 'playing') return
    const h = this.hero
    if (h.whirlCd > 0) return
    if (!this.spendRage(this.stats.whirlRage)) return
    h.whirlCd = this.stats.whirlCd * Math.max(0.6, 1 - (lvl - 1) * 0.08)
    this.startSkillAttackAnimation()
    const R = this.stats.whirlRadius
    const facing = h.aim
    this.rings.push({ x: h.x, y: h.y, r: 10, maxR: R, life: 0.35, color: 'rgba(120,220,255,0.6)' })
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - h.x, e.y - h.y)
      const angle = Math.atan2(e.y - h.y, e.x - h.x)
      let diff = Math.abs(angle - facing)
      if (diff > Math.PI) diff = Math.PI * 2 - diff
      if (d < R + e.radius && diff < Math.PI * 0.55) {
        this.damageEnemy(e, this.stats.whirlDamage * (1 + (lvl - 1) * 0.22) * (diff < 0.22 ? 1.6 : 1), true, true)
        const a = Math.atan2(e.y - h.y, e.x - h.x)
        e.knock.x += Math.cos(a) * 260
        e.knock.y += Math.sin(a) * 260
      }
    }
    this.shake(8)
  }

  private castFire(lvl: number) {
    if (this.status !== 'playing') return
    const h = this.hero
    if (h.fireCd > 0) return
    if (!this.spendRage(this.stats.fireRage)) return
    h.fireCd = this.stats.fireCd * Math.max(0.6, 1 - (lvl - 1) * 0.08)
    this.startSkillAttackAnimation()
    const dx = this.mouse.x - h.x
    const dy = this.mouse.y - h.y
    const distance = Math.hypot(dx, dy) || 1
    const travel = Math.min(300, distance)
    h.x += (dx / distance) * travel
    h.y += (dy / distance) * travel
    h.invuln = Math.max(h.invuln, 0.35)
    const radius = this.stats.fireRadius
    for (const e of this.enemies) {
      if (Math.hypot(e.x - h.x, e.y - h.y) < radius + e.radius) {
        this.damageEnemy(e, this.stats.fireDamage * (1 + (lvl - 1) * 0.24), true, true)
        e.knock.x += (e.x - h.x) * 3
        e.knock.y += (e.y - h.y) * 3
      }
    }
    this.rings.push({ x: h.x, y: h.y, r: 10, maxR: radius, life: 0.4, color: 'rgba(210,170,110,0.75)' })
    this.floatText(h.x, h.y - 45, 'SEISMIC LEAP', '#ffd08a', 22)
    this.shake(9)
  }

  // R — Meteor Storm: rain fiery meteors around the cursor
  private castUlt(lvl: number) {
    if (this.status !== 'playing') return
    const h = this.hero
    if (h.ultCd > 0) return
    if (!this.spendRage(this.stats.ultRage)) return
    h.ultCd = this.stats.ultCd * Math.max(0.65, 1 - (lvl - 1) * 0.07)
    this.startSkillAttackAnimation()
    let affected = 0
    for (const e of this.enemies) {
      if (Math.hypot(e.x - h.x, e.y - h.y) < this.stats.ultRadius + e.radius) {
        affected++
        e.slowT = Math.max(e.slowT, 2)
      }
    }
    h.shieldT = Math.max(h.shieldT, this.stats.shieldTime + lvl * 0.25 + affected * 0.18)
    h.invuln = Math.max(h.invuln, 0.35)
    this.rings.push({ x: h.x, y: h.y, r: 10, maxR: this.stats.ultRadius, life: 0.45, color: 'rgba(255,185,90,0.7)' })
    this.floatText(h.x, h.y - 45, `CHALLENGING ROAR · ${affected}`, '#ffb45f', 22)
    this.shake(8)
  }

  // F — Battle Heal: restore health and gain a brief shield
  private castHeal(lvl: number) {
    if (this.status !== 'playing') return
    const h = this.hero
    if (h.healCd > 0) return
    if (!this.spendRage(this.stats.healRage)) return
    h.healCd = this.stats.healCd * Math.max(0.65, 1 - (lvl - 1) * 0.07)
    this.startSkillAttackAnimation()
    h.counterT = 2.2 + lvl * 0.25
    h.invuln = Math.max(h.invuln, 0.15)
    this.rings.push({ x: h.x, y: h.y, r: 10, maxR: 70, life: 0.35, color: 'rgba(210,55,65,0.7)' })
    this.floatText(h.x, h.y - 34, 'BLOOD REPRISAL', '#ff6b6b', 22)
  }

  // ---------- skill system ----------
  private activeSkills(): OwnedSkill[] {
    return this.skills.filter((os) => SKILLS[os.id].kind === 'active')
  }

  private activateSkill(os: OwnedSkill) {
    audio.play('cast')
    if (this.status !== 'playing') return
    switch (os.id) {
      case 'dash': this.castDash(os.level); break
      case 'whirlwind': this.castWhirl(os.level); break
      case 'fireball': this.castFire(os.level); break
      case 'meteor': this.castUlt(os.level); break
      case 'heal': this.castHeal(os.level); break
      case 'inferno': this.castInferno(os.level); break
      case 'blade-dancer': this.castBladeDancer(os.level); break
      case 'guardian-angel': this.castGuardianAngel(os.level); break
      case 'absolute-zero': this.castAbsoluteZero(os.level); break
      case 'tempest': this.castTempest(os.level); break
      case 'titanbreaker': this.castTitanbreaker(os.level); break
      case 'mage-cinderbolt': this.castMageCinderbolt(os.level); break
      case 'mage-frost-nova': this.castMageFrostNova(os.level); break
      case 'mage-arcane-orbs': this.castMageArcaneOrbs(os.level); break
      case 'mage-blink': this.castMageBlink(os.level); break
      case 'mage-ice-barrier': this.castMageIceBarrier(os.level); break
      case 'mage-pyroclasm': this.castMagePyroclasm(os.level); break
      case 'mage-frozen-tempest': this.castMageFrozenTempest(os.level); break
      case 'mage-arcane-barrage': this.castMageArcaneBarrage(os.level); break
      case 'mage-prismatic-step': this.castMagePrismaticStep(os.level); break
      case 'mage-glacial-aegis': this.castMageGlacialAegis(os.level); break
      case 'mage-elemental-convergence': this.castMageElementalConvergence(os.level); break
      case 'necro-raise-skeleton': this.castRaiseSkeleton(os.level); break
      case 'necro-bone-spear': this.castBoneSpear(os.level); break
      case 'necro-corpse-burst': this.castCorpseBurst(os.level); break
      case 'necro-blood-nova': this.castBloodNova(os.level); break
      case 'necro-decrepify': this.castDecrepify(os.level); break
      case 'necro-skeleton-legion': this.castSkeletonLegion(os.level); break
      case 'necro-ossuary-lance': this.castOssuaryLance(os.level); break
      case 'necro-corpse-cathedral': this.castCorpseCathedral(os.level); break
      case 'necro-crimson-covenant': this.castCrimsonCovenant(os.level); break
      case 'necro-withering-army': this.castWitheringArmy(os.level); break
      case 'necro-army-of-the-dead': this.castArmyOfTheDead(os.level); break
    }
  }

  /** Cooldown/Rage gate for evolved active skills. */
  private beginActive(id: SkillId): boolean {
    if ((this.skillCd[id] ?? 0) > 0) return false
    const cfg = ACTIVE_CFG[id]
    if (!cfg) return false
    if (!this.spendRage(cfg.rage)) return false
    this.skillCd[id] = cfg.cd
    this.startSkillAttackAnimation()
    return true
  }

  private startSkillAttackAnimation() {
    const h = this.hero
    this.swingFlip = -this.swingFlip
    h.swingAngle = h.aim
    h.swingDir = this.swingFlip
    h.swingT = 0.32
    h.swingMax = h.swingT
    h.skillAttackT = h.swingT
  }

  private cdInfo(os: OwnedSkill): { cdLeft: number; cdMax: number; rageCost: number } {
    const h = this.hero, s = this.stats
    const commonScale = Math.max(0.6, 1 - (os.level - 1) * 0.08)
    const rareScale = Math.max(0.65, 1 - (os.level - 1) * 0.07)
    switch (os.id) {
      case 'dash': return { cdLeft: h.dashCd, cdMax: s.dashCd * commonScale, rageCost: s.dashRage }
      case 'whirlwind': return { cdLeft: h.whirlCd, cdMax: s.whirlCd * commonScale, rageCost: s.whirlRage }
      case 'fireball': return { cdLeft: h.fireCd, cdMax: s.fireCd * commonScale, rageCost: s.fireRage }
      case 'meteor': return { cdLeft: h.ultCd, cdMax: s.ultCd * rareScale, rageCost: s.ultRage }
      case 'heal': return { cdLeft: h.healCd, cdMax: s.healCd * rareScale, rageCost: s.healRage }
      default: {
        const cfg = ACTIVE_CFG[os.id]
        return { cdLeft: this.skillCd[os.id] ?? 0, cdMax: cfg?.cd ?? 0, rageCost: cfg?.rage ?? 0 }
      }
    }
  }

  /** Rebuild live Stats from the base loadout + every owned passive skill. */
  private recomputeStats() {
    const prevHp = this.stats.maxHp
    const s: Stats = { ...this.opts.stats }
    for (const os of this.skills) {
      if (SKILLS[os.id].kind === 'passive') this.applyPassive(s, os.id, os.level)
    }
    for (const key of this.relics) this.applyRelic(s, key)
    this.stats = s
    if (this.hero) {
      if (s.maxHp > prevHp) this.hero.hp = Math.min(s.maxHp, this.hero.hp + (s.maxHp - prevHp))
    }
  }

  /** Story layer relics — flat stat boons flavoured to each layer of the descent. */
  private applyRelic(s: Stats, key: string) {
    switch (key) {
      case 'keepstone': s.maxHp += 80; s.hpRegen += 2; break
      case 'thornheart': s.lifesteal += 0.08; s.thorns += 0.5; break
      case 'rimebound': s.crit += 0.15; s.critMult += 0.4; break
      case 'emberwrath': s.swordDamage *= 1.25; break
    }
  }

  private applyPassive(s: Stats, id: SkillId, lvl: number) {
    switch (id) {
      case 'power': s.swordDamage *= 1 + 0.08 * lvl; break
      case 'haste': break
      case 'vitality': s.maxHp += 45 * lvl; break
      case 'precision':
        s.swordDamage *= 1 + 0.12 * lvl
        s.critMult += 0.15 * lvl
        s.swordRange += 8 * lvl
        break
      case 'thorns': break
      case 'mage-arcane-intellect':
        s.maxRage += 15 * lvl
        s.manaRegen += 1.5 * lvl
        break
      case 'mage-ignite': break
      case 'mage-shatter': break
      case 'mage-spell-haste':
        s.attackInterval *= Math.max(0.65, 1 - 0.06 * lvl)
        s.moveSpeed *= 1 + 0.04 * lvl
        break
      case 'mage-mana-shield': s.maxHp += 25 * lvl; break
      case 'necro-skeleton-mastery': break
      case 'necro-grim-harvest': break
      case 'necro-bone-armor': s.maxHp += 30 * lvl; break
      case 'necro-blood-pact': break
      case 'necro-dark-command': s.moveSpeed *= 1 + 0.02 * lvl; break
      default: break
    }
  }

  // ---- evolved Warrior active skills ----
  private castInferno(lvl: number) {
    if (!this.beginActive('inferno')) return
    const h = this.hero
    h.dashT = 0.55
    h.invuln = 0.8
    h.dashDir = this.aimDir()
    h.dashHits = new Set()
    for (const e of this.enemies) {
      if (Math.hypot(e.x - h.x, e.y - h.y) < 170 + e.radius) {
        this.damageEnemy(e, 42 + lvl * 14, true, true)
      }
    }
    this.rings.push({ x: h.x, y: h.y, r: 10, maxR: 170, life: 0.55, color: 'rgba(255,205,90,0.7)' })
    this.floatText(h.x, h.y - 44, 'BLADESTORM CHARGE', '#ffd866', 24)
    this.shake(10)
  }

  private castBladeDancer(lvl: number) {
    if (!this.beginActive('blade-dancer')) return
    const h = this.hero
    h.dashT = 0.65
    h.invuln = 0.9
    h.dashDir = this.aimDir()
    h.dashHits = new Set()
    const R = 125
    for (const e of this.enemies) {
      if (Math.hypot(e.x - h.x, e.y - h.y) < R + e.radius) {
        this.damageEnemy(e, 38 + lvl * 13, true, true)
        const a = Math.atan2(e.y - h.y, e.x - h.x)
        e.knock.x += Math.cos(a) * 520
        e.knock.y += Math.sin(a) * 520
      }
    }
    this.rings.push({ x: h.x, y: h.y, r: 10, maxR: R, life: 0.4, color: 'rgba(255,220,120,0.6)' })
    this.floatText(h.x, h.y - 44, 'LIVING BATTERING RAM', '#ffd866', 22)
    this.shake(8)
  }

  private castGuardianAngel(lvl: number) {
    if (!this.beginActive('guardian-angel')) return
    const h = this.hero
    const dir = this.aimDir()
    h.x += dir.x * 320
    h.y += dir.y * 320
    h.invuln = Math.max(h.invuln, 0.45)
    const radius = 175
    for (const e of this.enemies) {
      if (Math.hypot(e.x - h.x, e.y - h.y) < radius + e.radius) {
        this.damageEnemy(e, 58 + lvl * 18, true, true)
        this.applyBleed(e, 10 + lvl * 4, 4)
      }
    }
    this.rings.push({ x: h.x, y: h.y, r: 10, maxR: radius, life: 0.55, color: 'rgba(185,35,45,0.7)' })
    this.floatText(h.x, h.y - 44, 'CRIMSON EARTHSHATTER', '#ff6b6b', 22)
    this.shake(12)
  }

  private castAbsoluteZero(lvl: number) {
    if (!this.beginActive('absolute-zero')) return
    const h = this.hero
    h.hp = Math.min(this.stats.maxHp, h.hp + this.stats.maxHp * (0.3 + lvl * 0.05))
    h.shieldT = 3 + lvl * 0.4
    h.lastStandT = 5 + lvl
    h.invuln = Math.max(h.invuln, 0.4)
    this.rings.push({ x: h.x, y: h.y, r: 10, maxR: 230, life: 0.6, color: 'rgba(255,180,90,0.65)' })
    this.floatText(h.x, h.y - 44, 'LAST STAND', '#ffc078', 26)
    this.shake(12)
  }

  private castTempest(lvl: number) {
    if (!this.beginActive('tempest')) return
    const h = this.hero
    h.counterT = 4 + lvl * 0.5
    h.furyT = h.counterT
    this.rings.push({ x: h.x, y: h.y, r: 10, maxR: 130, life: 0.5, color: 'rgba(230,55,55,0.7)' })
    this.floatText(h.x, h.y - 44, "BERSERKER'S RECKONING", '#ff6b6b', 22)
    this.shake(10)
  }

  private castTitanbreaker(lvl: number) {
    if (!this.beginActive('titanbreaker')) return
    const h = this.hero
    const dir = this.aimDir()
    h.x += dir.x * 330
    h.y += dir.y * 330
    h.invuln = Math.max(h.invuln, 0.5)
    const damage = 85 + lvl * 25
    for (const e of this.enemies) {
      const dx = e.x - h.x
      const dy = e.y - h.y
      const distance = Math.hypot(dx, dy)
      const forward = (dx * dir.x + dy * dir.y)
      const lateral = Math.abs(dx * dir.y - dy * dir.x)
      if (distance < 150 + e.radius || (forward > 0 && forward < 420 && lateral < 85 + e.radius)) {
        const centerHit = distance < 90 + e.radius
        this.damageEnemy(e, damage * (centerHit ? 1.8 : 1), true, true)
        e.knock.x += dir.x * 420
        e.knock.y += dir.y * 420
      }
    }
    this.rings.push({ x: h.x, y: h.y, r: 10, maxR: 170, life: 0.5, color: 'rgba(255,210,105,0.75)' })
    this.floatText(h.x, h.y - 48, 'TITANBREAKER', '#ffe066', 28)
    this.shake(16)
  }

  // ---- Mage active skills ----
  private castMageCinderbolt(lvl: number) {
    if (!this.beginActive('mage-cinderbolt')) return
    const d = this.aimDir()
    this.projectiles.push(this.mkProj(this.hero.x, this.hero.y - 8, d.x * 520, d.y * 520, 30 + lvl * 11, true, {
      r: 10, radius: 55 + lvl * 5, color: '#ff7b32',
    }))
  }

  private castMageFrostNova(lvl: number) {
    if (!this.beginActive('mage-frost-nova')) return
    this.frostBurst(145 + lvl * 8, 24 + lvl * 9)
  }

  private castMageArcaneOrbs(lvl: number) {
    if (!this.beginActive('mage-arcane-orbs')) return
    this.arcaneVolley(2 + Math.ceil(lvl / 2), 18 + lvl * 7)
  }

  private castMageBlink(lvl: number) {
    if (!this.beginActive('mage-blink')) return
    this.blinkMage(210 + lvl * 20)
  }

  private castMageIceBarrier(lvl: number) {
    if (!this.beginActive('mage-ice-barrier')) return
    this.hero.shieldT = Math.max(this.hero.shieldT, 2.2 + lvl * 0.45)
    this.rings.push({ x: this.hero.x, y: this.hero.y, r: 10, maxR: 75, life: 0.4, color: 'rgba(125,220,255,0.75)' })
  }

  private castMagePyroclasm(lvl: number) {
    if (!this.beginActive('mage-pyroclasm')) return
    const d = this.aimDir()
    this.projectiles.push(this.mkProj(this.hero.x, this.hero.y - 8, d.x * 430, d.y * 430, 75 + lvl * 22, true, {
      r: 16, radius: 120 + lvl * 8, color: '#ff4d21',
    }))
    this.floatText(this.hero.x, this.hero.y - 42, 'PYROCLASM', '#ff7b32', 24)
  }

  private castMageFrozenTempest(lvl: number) {
    if (!this.beginActive('mage-frozen-tempest')) return
    this.frostBurst(260, 55 + lvl * 16)
    for (const e of this.enemies) if (Math.hypot(e.x - this.hero.x, e.y - this.hero.y) < 260 + e.radius) e.slowT = 4 + lvl * 0.4
    this.floatText(this.hero.x, this.hero.y - 42, 'FROZEN TEMPEST', '#a5e5ff', 22)
  }

  private castMageArcaneBarrage(lvl: number) {
    if (!this.beginActive('mage-arcane-barrage')) return
    this.arcaneVolley(7 + lvl, 28 + lvl * 9)
    this.floatText(this.hero.x, this.hero.y - 42, 'ARCANE BARRAGE', '#d0a6ff', 22)
  }

  private castMagePrismaticStep(lvl: number) {
    if (!this.beginActive('mage-prismatic-step')) return
    this.blinkMage(330 + lvl * 20)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      this.projectiles.push(this.mkProj(this.hero.x, this.hero.y, Math.cos(a) * 400, Math.sin(a) * 400, 24 + lvl * 8, true, { pierce: 1, color: '#d0a6ff' }))
    }
  }

  private castMageGlacialAegis(lvl: number) {
    if (!this.beginActive('mage-glacial-aegis')) return
    this.hero.shieldT = Math.max(this.hero.shieldT, 5 + lvl * 0.6)
    this.frostBurst(190, 34 + lvl * 10)
    this.floatText(this.hero.x, this.hero.y - 42, 'GLACIAL AEGIS', '#a5e5ff', 22)
  }

  private castMageElementalConvergence(lvl: number) {
    if (!this.beginActive('mage-elemental-convergence')) return
    const radius = 285
    for (const e of this.enemies) {
      if (Math.hypot(e.x - this.hero.x, e.y - this.hero.y) < radius + e.radius) {
        e.slowT = Math.max(e.slowT, 3)
        this.damageEnemy(e, 95 + lvl * 28, true, true)
        this.applyBleed(e, 9 + lvl * 4, 4)
      }
    }
    this.arcaneVolley(5 + lvl, 24 + lvl * 8)
    this.rings.push({ x: this.hero.x, y: this.hero.y, r: 10, maxR: radius, life: 0.7, color: 'rgba(180,110,255,0.75)' })
    this.floatText(this.hero.x, this.hero.y - 48, 'ELEMENTAL CONVERGENCE', '#f0c6ff', 24)
    this.shake(16)
  }

  private frostBurst(radius: number, damage: number) {
    for (const e of this.enemies) {
      if (Math.hypot(e.x - this.hero.x, e.y - this.hero.y) < radius + e.radius) {
        this.damageEnemy(e, damage, true, true)
        e.slowT = Math.max(e.slowT, 2.2)
        const a = Math.atan2(e.y - this.hero.y, e.x - this.hero.x)
        e.knock.x += Math.cos(a) * 180
        e.knock.y += Math.sin(a) * 180
      }
    }
    this.rings.push({ x: this.hero.x, y: this.hero.y, r: 10, maxR: radius, life: 0.45, color: 'rgba(125,220,255,0.7)' })
  }

  private arcaneVolley(count: number, damage: number) {
    const base = this.hero.aim
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * 0.13
      this.projectiles.push(this.mkProj(this.hero.x, this.hero.y - 8, Math.cos(a) * 430, Math.sin(a) * 430, damage, true, {
        r: 8, homing: true, color: '#b06cff',
      }))
    }
  }

  private blinkMage(distance: number) {
    const d = this.aimDir()
    this.hero.x = Math.max(22, Math.min(WORLD_W - 22, this.hero.x + d.x * distance))
    this.hero.y = Math.max(22, Math.min(WORLD_H - 22, this.hero.y + d.y * distance))
    this.hero.invuln = Math.max(this.hero.invuln, 0.35)
    this.rings.push({ x: this.hero.x, y: this.hero.y, r: 8, maxR: 60, life: 0.35, color: 'rgba(185,110,255,0.7)' })
  }

  // ---- Necromancer active skills and summons ----
  private castRaiseSkeleton(lvl: number) {
    if (!this.beginActive('necro-raise-skeleton')) return
    const count = lvl >= 4 ? 2 : 1
    for (let i = 0; i < count; i++) this.raiseSkeleton(lvl)
    this.floatText(this.hero.x, this.hero.y - 42, 'RISE!', '#8ce99a', 22)
  }

  private castBoneSpear(lvl: number) {
    if (!this.beginActive('necro-bone-spear')) return
    this.fireBoneSpear(42 + lvl * 14, 4 + lvl)
  }

  private castCorpseBurst(lvl: number) {
    const corpse = this.nearestCorpse()
    if (!corpse) {
      this.floatText(this.hero.x, this.hero.y - 38, 'NO CORPSE', '#adb5bd', 16)
      return
    }
    if (!this.beginActive('necro-corpse-burst')) return
    this.detonateCorpse(corpse, 48 + lvl * 18, 120 + lvl * 8)
  }

  private castBloodNova(lvl: number) {
    if (!this.beginActive('necro-blood-nova')) return
    this.bloodNova(155 + lvl * 10, 34 + lvl * 13, 0.06 + lvl * 0.01)
  }

  private castDecrepify(lvl: number) {
    if (!this.beginActive('necro-decrepify')) return
    const radius = 230 + lvl * 18
    for (const e of this.enemies) {
      if (Math.hypot(e.x - this.hero.x, e.y - this.hero.y) < radius + e.radius) {
        e.slowT = Math.max(e.slowT, 3.5 + lvl * 0.5)
      }
    }
    this.rings.push({ x: this.hero.x, y: this.hero.y, r: 10, maxR: radius, life: 0.55, color: 'rgba(105,190,115,0.7)' })
    this.floatText(this.hero.x, this.hero.y - 42, 'DECREPIFY', '#8ce99a', 20)
  }

  private castSkeletonLegion(lvl: number) {
    if (!this.beginActive('necro-skeleton-legion')) return
    for (let i = 0; i < 4; i++) this.raiseSkeleton(lvl + 2, true)
    this.floatText(this.hero.x, this.hero.y - 48, 'SKELETON LEGION', '#b2f2bb', 23)
  }

  private castOssuaryLance(lvl: number) {
    if (!this.beginActive('necro-ossuary-lance')) return
    this.fireBoneSpear(88 + lvl * 24, 20)
    this.hero.shieldT = Math.max(this.hero.shieldT, 2.5 + lvl * 0.4)
    this.floatText(this.hero.x, this.hero.y - 44, 'OSSUARY LANCE', '#e9ecef', 22)
  }

  private castCorpseCathedral(lvl: number) {
    if (this.corpses.length === 0) {
      this.floatText(this.hero.x, this.hero.y - 38, 'NO CORPSES', '#adb5bd', 16)
      return
    }
    if (!this.beginActive('necro-corpse-cathedral')) return
    const corpses = this.corpses
      .filter((corpse) => Math.hypot(corpse.x - this.hero.x, corpse.y - this.hero.y) < 650)
      .slice(0, 12)
    for (const corpse of corpses) this.detonateCorpse(corpse, 58 + lvl * 18, 135)
    this.floatText(this.hero.x, this.hero.y - 48, 'CORPSE CATHEDRAL', '#69db7c', 22)
  }

  private castCrimsonCovenant(lvl: number) {
    if (!this.beginActive('necro-crimson-covenant')) return
    this.bloodNova(280, 72 + lvl * 21, 0.2)
    this.skeletonFrenzyT = Math.max(this.skeletonFrenzyT, 3 + lvl * 0.4)
    this.floatText(this.hero.x, this.hero.y - 48, 'CRIMSON COVENANT', '#ff8787', 22)
  }

  private castWitheringArmy(lvl: number) {
    if (!this.beginActive('necro-withering-army')) return
    for (const e of this.enemies) e.slowT = Math.max(e.slowT, 5 + lvl * 0.5)
    this.skeletonFrenzyT = 6 + lvl * 0.7
    this.floatText(this.hero.x, this.hero.y - 48, 'WITHERING ARMY', '#8ce99a', 22)
  }

  private castArmyOfTheDead(lvl: number) {
    if (!this.beginActive('necro-army-of-the-dead')) return
    const corpsePower = Math.min(8, this.corpses.length)
    this.corpses.splice(0, corpsePower)
    for (let i = 0; i < 6 + corpsePower; i++) this.raiseSkeleton(lvl + 3, true, 16)
    this.skeletonFrenzyT = 8
    this.rings.push({ x: this.hero.x, y: this.hero.y, r: 10, maxR: 340, life: 0.8, color: 'rgba(80,210,110,0.75)' })
    this.floatText(this.hero.x, this.hero.y - 54, 'ARMY OF THE DEAD', '#b2f2bb', 26)
    this.shake(14)
  }

  private raiseSkeleton(lvl: number, empowered = false, capOverride?: number) {
    const mastery = this.owned('necro-skeleton-mastery')?.level ?? 0
    const raiseLevel = this.owned('necro-raise-skeleton')?.level
      ?? this.owned('necro-skeleton-legion')?.level
      ?? this.owned('necro-army-of-the-dead')?.level
      ?? lvl
    const cap = capOverride ?? 2 + raiseLevel + mastery
    if (this.skeletons.length >= cap) return
    const angle = Math.random() * Math.PI * 2
    const distance = 36 + Math.random() * 30
    this.skeletons.push({
      x: this.hero.x + Math.cos(angle) * distance,
      y: this.hero.y + Math.sin(angle) * distance,
      damage: (8 + lvl * 4 + mastery * 4) * (empowered ? 1.45 : 1),
      speed: 175 + mastery * 12,
      attackCd: Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      empowered,
    })
  }

  private fireBoneSpear(damage: number, pierce: number) {
    const d = this.aimDir()
    this.projectiles.push(this.mkProj(
      this.hero.x, this.hero.y - 8, d.x * 620, d.y * 620, damage, true,
      { r: 9, pierce, color: '#e9ecef' },
    ))
  }

  private nearestCorpse(): Corpse | undefined {
    let best: Corpse | undefined
    let bestDistance = Infinity
    for (const corpse of this.corpses) {
      const distance = Math.hypot(corpse.x - this.mouse.x, corpse.y - this.mouse.y)
      if (distance < bestDistance) {
        bestDistance = distance
        best = corpse
      }
    }
    return best
  }

  private detonateCorpse(corpse: Corpse, damage: number, radius: number) {
    const index = this.corpses.indexOf(corpse)
    if (index >= 0) this.corpses.splice(index, 1)
    for (const e of this.enemies) {
      if (Math.hypot(e.x - corpse.x, e.y - corpse.y) < radius + e.radius) {
        this.damageEnemy(e, damage, true, true)
      }
    }
    const armor = this.owned('necro-bone-armor')?.level ?? 0
    if (armor > 0) this.hero.shieldT = Math.max(this.hero.shieldT, 0.8 + armor * 0.3)
    this.rings.push({ x: corpse.x, y: corpse.y, r: 8, maxR: radius, life: 0.4, color: 'rgba(105,220,125,0.7)' })
    this.shake(5)
  }

  private bloodNova(radius: number, damage: number, healRatio: number) {
    let hits = 0
    for (const e of this.enemies) {
      if (Math.hypot(e.x - this.hero.x, e.y - this.hero.y) < radius + e.radius) {
        hits++
        this.damageEnemy(e, damage, true, true)
      }
    }
    const pact = this.owned('necro-blood-pact')?.level ?? 0
    const healing = hits * damage * (healRatio + pact * 0.015)
    this.hero.hp = Math.min(this.stats.maxHp, this.hero.hp + healing)
    this.rings.push({ x: this.hero.x, y: this.hero.y, r: 10, maxR: radius, life: 0.5, color: 'rgba(210,45,75,0.75)' })
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
  private damageEnemy(e: Enemy, base: number, fromAbility: boolean, heavy = false) {
    if (e.hp <= 0) return
    let dmg = base
    let crit = false
    const shatter = e.slowT > 0 ? (this.owned('mage-shatter')?.level ?? 0) : 0
    if (Math.random() < this.stats.crit + shatter * 0.06) {
      dmg *= this.stats.critMult
      if (shatter > 0) dmg *= 1 + shatter * 0.12
      crit = true
    }
    if (!fromAbility && this.hero.furyT > 0) {
      dmg *= 1 + 0.08 * (this.owned('power')?.level ?? 0)
    }
    e.hp -= dmg
    e.hitFlash = 0.1
    audio.play(crit ? 'crit' : 'hit', Math.min(1, this.combo / 20))
    // A crit briefly freezes the world so the hit lands with weight — but rate
    // limited, or a high-crit late build would stutter constantly.
    if (crit && this.hitStopCd <= 0) {
      this.hitStop = Math.max(this.hitStop, 0.045)
      this.hitStopCd = 0.35
    }
    // frost sword chills foes on melee hits
    if (!fromAbility && this.swordStyleId === 'frost') e.slowT = 1.2
    this.floatText(e.x, e.y - e.radius, `${Math.round(dmg)}`, crit ? '#ffd43b' : '#fff', crit ? 22 : 16)
    if (this.stats.lifesteal > 0 && !fromAbility) {
      this.hero.hp = Math.min(this.stats.maxHp, this.hero.hp + dmg * this.stats.lifesteal)
    } else if (this.stats.lifesteal > 0 && fromAbility) {
      this.hero.hp = Math.min(this.stats.maxHp, this.hero.hp + dmg * this.stats.lifesteal * 0.5)
    }
    const deepWounds = this.owned('haste')?.level ?? 0
    if (deepWounds > 0 && (crit || heavy)) this.applyBleed(e, 3 + deepWounds * 2, 3.5)
    const ignite = this.owned('mage-ignite')?.level ?? 0
    if (fromAbility && ignite > 0) this.applyBleed(e, 3 + ignite * 2.5, 3.5)
    if (e.hp <= 0) this.killEnemy(e)
  }

  private applyBleed(e: Enemy, dps: number, duration: number) {
    e.bleedDps = Math.max(e.bleedDps, dps)
    e.bleedT = Math.max(e.bleedT, duration)
    e.bleedTick = Math.min(e.bleedTick, 0.25)
  }

  /**
   * Layer-lord behaviour: each fallen champion fights the way they used to.
   * Every attack telegraphs first (a growing warning ring) so it can be dodged.
   */
  private updateLord(e: Enemy, dt: number, aimAtHero: number, dist: number) {
    // The Hollow King gains a second phase at half health.
    if (e.lord === LAYERS.length && !e.phase2 && e.hp < e.maxHp * 0.5) {
      e.phase2 = true
      e.castCd = 0.8
      this.shake(16)
      this.flash = 0.5
      this.floatText(e.x, e.y - e.radius - 30, 'THE CROWN BURNS', '#ff6b3d', 26)
      // the King calls the Hollow to him
      for (let i = 0; i < 4; i++) this.spawnEnemy('fast')
    }

    if (e.windup > 0) {
      e.windup -= dt
      if (e.windup <= 0) this.lordStrike(e)
      return // committed to the attack — stands still while winding up
    }

    e.castCd -= dt
    if (e.castCd <= 0 && dist < 620) {
      // begin the telegraph: a warning ring the player can read and escape
      e.windup = e.lord === 1 ? 0.75 : 0.85
      const base = e.lord === LAYERS.length ? (e.phase2 ? 2.6 : 3.4) : 3.8
      e.castCd = base + Math.random() * 0.8
      this.telegraphLord(e, aimAtHero)
    }
  }

  /** Draw the wind-up warning for a lord's signature attack. */
  private telegraphLord(e: Enemy, aim: number) {
    audio.play('lordWarn')
    const warn = 'rgba(255,90,70,0.75)'
    switch (e.lord) {
      case 1: // Roderin — shield slam around himself
        this.rings.push({ x: e.x, y: e.y, r: 8, maxR: 190, life: 0.75, color: warn })
        this.floatText(e.x, e.y - e.radius - 20, 'SHIELD SLAM', '#ffd43b', 18)
        break
      case 2: // Maren — root volley aimed at the hero
        this.rings.push({ x: e.x, y: e.y, r: 8, maxR: 110, life: 0.85, color: 'rgba(140,220,120,0.8)' })
        this.floatText(e.x, e.y - e.radius - 20, 'ROOT VOLLEY', '#8ce99a', 18)
        e.facing = Math.cos(aim) < 0 ? -1 : 1
        break
      case 3: { // Yll — three freezing sigils on the ground near the hero
        const h = this.hero
        for (let i = 0; i < 3; i++) {
          const ang = Math.random() * Math.PI * 2
          const r = 40 + Math.random() * 110
          this.meteors.push({
            x: h.x + Math.cos(ang) * r, y: h.y + Math.sin(ang) * r,
            t: 0.85, damage: e.damage * 0.9, radius: 78,
          })
        }
        this.floatText(e.x, e.y - e.radius - 20, 'FROST SIGILS', '#8cd6ff', 18)
        break
      }
      default: // the Hollow King — slam, and in phase 2 a rain of fire
        this.rings.push({ x: e.x, y: e.y, r: 8, maxR: 230, life: 0.85, color: warn })
        this.floatText(e.x, e.y - e.radius - 24, e.phase2 ? 'HEART OF FIRE' : 'CROWN SLAM', '#ff922b', 20)
        if (e.phase2) {
          const h = this.hero
          for (let i = 0; i < 5; i++) {
            const ang = Math.random() * Math.PI * 2
            const r = Math.sqrt(Math.random()) * 190
            this.meteors.push({
              x: h.x + Math.cos(ang) * r, y: h.y + Math.sin(ang) * r,
              t: 0.9 + Math.random() * 0.5, damage: e.damage * 0.8, radius: 84,
            })
          }
        }
        break
    }
  }

  /** The moment a lord's telegraphed attack actually lands. */
  private lordStrike(e: Enemy) {
    audio.play('lordHit')
    this.hitStop = Math.max(this.hitStop, 0.06)
    const h = this.hero
    const hit = (radius: number, mult: number) => {
      if (Math.hypot(h.x - e.x, h.y - e.y) < radius) this.hurtHero(e.damage * mult)
    }
    switch (e.lord) {
      case 1: // shockwave out from Roderin
        this.rings.push({ x: e.x, y: e.y, r: 10, maxR: 190, life: 0.3, color: 'rgba(255,200,120,0.85)' })
        hit(190, 1)
        this.shake(12)
        break
      case 2: { // a fan of thorns toward the hero
        const a = Math.atan2(h.y - e.y, h.x - e.x)
        for (let i = 0; i < 5; i++) {
          const spread = a + (i - 2) * 0.16
          this.projectiles.push(this.mkProj(
            e.x, e.y, Math.cos(spread) * 330, Math.sin(spread) * 330,
            e.damage * 0.7, false, { r: 9, color: '#8ce99a' },
          ))
        }
        break
      }
      case 3: // sigils already resolve as meteors; Yll blinks away to reposition
        this.rings.push({ x: e.x, y: e.y, r: 8, maxR: 90, life: 0.3, color: 'rgba(180,150,255,0.8)' })
        e.x += (Math.random() - 0.5) * 260
        e.y += (Math.random() - 0.5) * 260
        e.x = Math.max(30, Math.min(WORLD_W - 30, e.x))
        e.y = Math.max(30, Math.min(WORLD_H - 30, e.y))
        break
      default: // the King's crown slam
        this.rings.push({ x: e.x, y: e.y, r: 10, maxR: 230, life: 0.35, color: 'rgba(255,150,80,0.9)' })
        hit(230, 1.1)
        this.shake(16)
        break
    }
  }

  private killEnemy(e: Enemy) {
    e.hp = 0
    this.kills++
    this.stageKills++
    // kill streak: climbs while you keep killing, and pitches the sound up with it
    this.combo++
    this.comboT = 2.5
    if (this.combo > this.bestCombo) this.bestCombo = this.combo
    audio.play('kill', Math.min(1, this.combo / 20))
    if (e.lord > 0) { this.hitStop = Math.max(this.hitStop, 0.12); audio.play('lordHit') }
    // A fallen champion always yields their layer's relic.
    if (e.lord > 0) {
      const layer = LAYERS[e.lord - 1]
      if (layer && !this.relics.has(layer.relic.key)) {
        this.relics.add(layer.relic.key)
        this.recomputeStats()
        this.floatText(e.x, e.y - 40, `${layer.relic.icon} ${layer.relic.name}`, '#ffd43b', 24)
        audio.play('relic')
        this.hitStop = Math.max(this.hitStop, 0.1)
        this.opts.onStory({
          id: `relic-${layer.relic.key}`,
          title: layer.relic.name,
          subtitle: 'RELIC OF ALDERMERE',
          lines: [layer.relicTaken, layer.relic.desc],
        })
      }
    }
    if (this.classId === 'warrior') {
      const baseRage = e.kind === 'boss' ? 35 : e.elite ? 20 : 8
      const furyLevel = this.owned('power')?.level ?? 0
      const bleedBonus = e.bleedT > 0 && this.owned('haste') ? 3 : 0
      const ramRefund = this.owned('blade-dancer') && this.hero.dashT > 0 ? 5 : 0
      const gainedRage = Math.round(baseRage * (1 + furyLevel * 0.15) + bleedBonus + ramRefund)
      this.hero.rage = Math.min(this.stats.maxRage, this.hero.rage + gainedRage)
      this.floatText(e.x, e.y - e.radius - 14, `+${gainedRage} RAGE`, '#ff922b', 14)
    } else if (this.classId === 'necromancer') {
      const harvest = this.owned('necro-grim-harvest')?.level ?? 0
      const baseEssence = e.kind === 'boss' ? 30 : e.elite ? 16 : 7
      const gainedEssence = Math.round(baseEssence * (1 + harvest * 0.16))
      this.hero.rage = Math.min(this.stats.maxRage, this.hero.rage + gainedEssence)
      this.floatText(e.x, e.y - e.radius - 14, `+${gainedEssence} ESSENCE`, '#69db7c', 14)
      this.corpses.push({ x: e.x, y: e.y, life: 24 })
      if (this.corpses.length > 30) this.corpses.shift()
      if (harvest > 0 && Math.random() < harvest * 0.06) this.raiseSkeleton(harvest)
    }
    if (e.elite) {
      this.eliteKills++
      this.floatText(e.x, e.y - 10, '★ SPECIAL ★', '#ffd43b', 20)
    }
    if (e.kind === 'boss') this.floatText(e.x, e.y, 'BOSS DOWN!', '#ff6b6b', 24)
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
    audio.play('pickup')
    const h = this.hero
    switch (type) {
      case 'heart':
        h.hp = Math.min(this.stats.maxHp, h.hp + this.stats.maxHp * 0.3)
        this.floatText(h.x, h.y - 30, '+HP', '#69db7c', 22)
        break
      case 'gold': {
        // a hot streak pays better — the combo is worth chasing, not just pretty
        const streak = 1 + Math.min(1, this.combo / 25)
        const g = Math.round((3 + Math.floor(Math.random() * 5)) * streak)
        this.gold += g
        this.floatText(h.x, h.y - 30, `+${g}🪙`, '#ffd43b', 20)
        break
      }
      case 'magnet':
        for (const pickup of this.pickups) {
          pickup.x += (h.x - pickup.x) * 0.8
          pickup.y += (h.y - pickup.y) * 0.8
        }
        this.floatText(h.x, h.y - 30, 'LOOT PULLED!', '#8cf5ff', 24)
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
        this.gold += 25
        h.hp = Math.min(this.stats.maxHp, h.hp + this.stats.maxHp * 0.35)
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

  private buildChoices() {
    const opts = this.skillDraftOptions()
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

  private readonly MAX_SKILLS = 5

  private rarityWeight(r: Rarity): number {
    return r === 'epic' ? 1.3 : r === 'rare' ? 2.4 : 4
  }

  private owned(id: SkillId): OwnedSkill | undefined {
    return this.skills.find((os) => os.id === id)
  }

  private skillDraftOptions(): LevelOpt[] {
    const opts: LevelOpt[] = []

    // 1) Synergy evolutions — offered when you own BOTH ingredients and not the result yet.
    for (const syn of classSkillSynergies(this.classId)) {
      if (this.owned(syn.result)) continue
      if (!syn.ingredients.every((ingredient) => this.owned(ingredient))) continue
      const def = SKILLS[syn.result]
      opts.push({
        weight: 9, // strongly surface evolutions
        choice: {
          id: `syn-${syn.result}`, name: def.name, icon: def.icon,
          desc: def.description, rarity: def.rarity, tag: '✨ EVOLVE',
        },
        apply: () => {
          this.skills = this.skills.filter((os) => !syn.ingredients.includes(os.id))
          this.skills.push({ id: syn.result, level: 1 })
          this.recomputeStats()
        },
      })
    }

    // 2) Upgrade a skill you already own (below its max level).
    for (const os of this.skills) {
      const def = SKILLS[os.id]
      if (os.level >= def.maxLevel) continue
      opts.push({
        weight: this.rarityWeight(def.rarity) + 1.5,
        choice: {
          id: `up-${os.id}`, name: def.name, icon: def.icon,
          desc: def.description, rarity: def.rarity, tag: `Lv ${os.level} → ${os.level + 1}`,
        },
        apply: () => { os.level++; if (def.kind === 'passive') this.recomputeStats() },
      })
    }

    // 3) Brand-new base skills (only while a slot is free).
    if (this.skills.length < this.MAX_SKILLS) {
      for (const id of classBaseSkillIds(this.classId)) {
        if (this.owned(id)) continue
        const def = SKILLS[id]
        opts.push({
          weight: this.rarityWeight(def.rarity),
          choice: {
            id: `new-${id}`, name: def.name, icon: def.icon,
            desc: def.description, rarity: def.rarity,
            tag: def.kind === 'active' ? '★ NEW SKILL' : '★ NEW PASSIVE',
          },
          apply: () => { this.skills.push({ id, level: 1 }); if (def.kind === 'passive') this.recomputeStats() },
        })
      }
    }

    // (Layer relics are no longer drafted — they're taken from the fallen lord.)

    // Fallback: if every slot is full & maxed, offer a small heal-up so the draft is never empty.
    if (opts.length === 0) {
      opts.push({
        weight: 1,
        choice: { id: 'fallback-heal', name: 'Second Wind', icon: '💗', desc: 'Fully restore health.', rarity: 'common' },
        apply: () => { this.hero.hp = this.stats.maxHp },
      })
    }
    return opts
  }

  private spawnStageBoss() {
    const h = this.hero
    // Boss stages contain exactly one oversized, strengthened monster.
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
    // hit-stop: hold the world still for a few frames so impacts read as weight
    if (this.hitStop > 0) {
      this.hitStop -= dt
      this.render()
      return
    }
    if (this.status === 'playing') this.update(dt)
    this.render()
  }

  private update(dt: number) {
    const h = this.hero
    const s = this.stats

    this.hitStopCd = Math.max(0, this.hitStopCd - dt)
    // kill streak decays if you stop killing
    if (this.comboT > 0) {
      this.comboT -= dt
      if (this.comboT <= 0) this.combo = 0
    }

    // Health always regenerates. Mage Mana also recovers continuously.
    h.hp = Math.min(s.maxHp, h.hp + s.hpRegen * dt)
    if (this.classId === 'mage') h.rage = Math.min(s.maxRage, h.rage + s.manaRegen * dt)
    this.skeletonFrenzyT = Math.max(0, this.skeletonFrenzyT - dt)
    for (const corpse of this.corpses) corpse.life -= dt
    this.corpses = this.corpses.filter((corpse) => corpse.life > 0)

    // cooldowns
    h.dashCd = Math.max(0, h.dashCd - dt)
    h.whirlCd = Math.max(0, h.whirlCd - dt)
    h.fireCd = Math.max(0, h.fireCd - dt)
    h.ultCd = Math.max(0, h.ultCd - dt)
    h.healCd = Math.max(0, h.healCd - dt)
    for (const id of Object.keys(this.skillCd) as SkillId[]) {
      const cd = this.skillCd[id] ?? 0
      if (cd > 0) this.skillCd[id] = Math.max(0, cd - dt)
    }
    h.invuln = Math.max(0, h.invuln - dt)
    h.shieldT = Math.max(0, h.shieldT - dt)
    h.counterT = Math.max(0, h.counterT - dt)
    h.lastStandT = Math.max(0, h.lastStandT - dt)
    h.furyT = Math.max(0, h.furyT - dt)
    h.willT = Math.max(0, h.willT - dt)
    h.willCd = Math.max(0, h.willCd - dt)
    this.heroTurnT = Math.max(0, this.heroTurnT - dt)
    if (h.swingT > 0) h.swingT -= dt
    if (h.skillAttackT > 0) h.skillAttackT -= dt

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
          const dashLevel = this.owned('dash')?.level
            ?? this.owned('inferno')?.level
            ?? this.owned('blade-dancer')?.level
            ?? 1
          this.damageEnemy(e, this.stats.dashDamage * (1 + (dashLevel - 1) * 0.22), true, true)
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

    // face the way we walk; when standing still, turn toward the enemies we fight
    let fdx: number
    let fdy: number
    if (h.moving) {
      fdx = mvx; fdy = mvy
    } else {
      const foe = this.nearestEnemy(520)
      if (foe) { fdx = foe.x - h.x; fdy = foe.y - h.y }
      else { fdx = Math.cos(h.aim); fdy = Math.sin(h.aim) }
    }
    // flip left/right whenever there's a clear horizontal component
    if (Math.abs(fdx) > 0.001) h.facing = fdx < 0 ? -1 : 1
    const nextFaceDir = this.faceDirection(fdx, fdy)
    if (nextFaceDir !== h.faceDir) {
      this.heroTurnFrom = this.faceFrameIndex(h.faceDir)
      this.heroTurnTo = this.faceFrameIndex(nextFaceDir)
      this.heroTurnT = this.HERO_TURN_DURATION
      h.faceDir = nextFaceDir
    }

    // stride animation
    if (h.moving) h.walkPhase += dt * 10
    else h.walkPhase = 0
    h.x = Math.max(24, Math.min(WORLD_W - 24, h.x))
    h.y = Math.max(24, Math.min(WORLD_H - 24, h.y))

    // camera follows the hero, clamped to the world
    const tcx = Math.max(0, Math.min(WORLD_W - WIDTH, h.x - WIDTH / 2))
    const tcy = Math.max(0, Math.min(WORLD_H - HEIGHT, h.y - HEIGHT / 2))
    this.cam.x += (tcx - this.cam.x) * Math.min(1, dt * 6)
    this.cam.y += (tcy - this.cam.y) * Math.min(1, dt * 6)

    // biome is fixed by the current descent layer (set in enterStage), not by roaming


    // Warriors cleave in melee; Mages automatically fire a ranged wand bolt.
    const attackTarget = this.nearestEnemy(this.classId === 'warrior' ? s.swordRange + 50 : 520)
    if (attackTarget) {
      h.attackTimer -= dt
      if (h.attackTimer <= 0) {
        const furyLevel = h.furyT > 0 ? (this.owned('power')?.level ?? 0) : 0
        h.attackTimer = s.attackInterval / (1 + furyLevel * 0.1)
        if (this.classId !== 'warrior') this.mageWandBolt(attackTarget)
        else this.swordSwing(attackTarget)
      }
    } else {
      h.attackTimer = 0
      if (h.skillAttackT <= 0) h.swingT = 0
    }

    // auto-weapons fire on their own
    this.updateWeapons(dt)

    // A stage is a KILL QUOTA, not a spawn budget: the Hollow keeps streaming in
    // until the quota is met, so there's never a lull spent hunting stragglers.
    this.survTime += dt
    const stageTotal = this.stageEnemyTotal()
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0 && this.stageKills < stageTotal) {
      if (isLordStage(this.stage)) {
        // the layer-lord is a duel — spawn them once, alone
        if (this.stageSpawned === 0) {
          this.spawnStageBoss()
          this.stageSpawned = 1
        }
      } else {
        // keep the field populated rather than emptying it
        const alive = this.enemies.reduce((n, e) => n + (e.hp > 0 ? 1 : 0), 0)
        const deficit = this.aliveTarget() - alive
        if (deficit > 0) {
          const burst = Math.min(deficit, 1 + Math.floor(this.stage / 3))
          for (let i = 0; i < burst; i++) this.spawnEnemy()
          this.stageSpawned += burst
        }
      }
      this.spawnTimer = 0.22
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
    this.updateSkeletons(dt)
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

    if (h.hp <= 0) {
      this.endRun()
    } else if (this.status === 'playing' && this.stageKills >= stageTotal) {
      // quota met — advance even if stragglers are still closing in
      this.completeStage()
    }

    this.emit()
  }

  private faceFrameIndex(direction: Hero['faceDir']): number {
    if (direction === 'down') return 0
    if (direction === 'downLeft' || direction === 'downRight') return 1
    if (direction === 'left' || direction === 'right') return 2
    if (direction === 'up') return 3
    return 3
  }

  private faceDirection(dx: number, dy: number): HeroFaceDir {
    const directions: HeroFaceDir[] = [
      'right', 'downRight', 'down', 'downLeft',
      'left', 'upLeft', 'up', 'upRight',
    ]
    const octant = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8
    return directions[octant]
  }

  private faceVector(direction: HeroFaceDir): Vec {
    const diagonal = Math.SQRT1_2
    switch (direction) {
      case 'up': return { x: 0, y: -1 }
      case 'upRight': return { x: diagonal, y: -diagonal }
      case 'right': return { x: 1, y: 0 }
      case 'downRight': return { x: diagonal, y: diagonal }
      case 'down': return { x: 0, y: 1 }
      case 'downLeft': return { x: -diagonal, y: diagonal }
      case 'left': return { x: -1, y: 0 }
      case 'upLeft': return { x: -diagonal, y: -diagonal }
    }
  }

  private heroWalkFrames(direction: HeroFaceDir): HTMLImageElement[] {
    switch (direction) {
      case 'up': return this.heroWalkUp
      case 'upRight':
      case 'upLeft': return this.heroWalkUpRight
      case 'right':
      case 'left': return this.heroWalkSide
      case 'downRight':
      case 'downLeft': return this.heroWalkDownRight
      case 'down': return this.heroWalkDown
    }
  }

  private mirrorHeroDirection(direction: HeroFaceDir): boolean {
    return direction === 'left' || direction === 'upLeft' || direction === 'downLeft'
  }

  private cardinalHeroDirection(direction: HeroFaceDir): 'up' | 'down' | 'left' | 'right' {
    if (direction === 'up') return 'up'
    if (direction === 'down') return 'down'
    if (direction === 'left' || direction === 'upLeft' || direction === 'downLeft') return 'left'
    return 'right'
  }

  private swordSwing(target: Enemy | null) {
    const h = this.hero
    const s = this.stats
    // aim at the nearest foe; if none, sweep in the direction we face/aim
    const angle = target
      ? Math.atan2(target.y - h.y, target.x - h.x)
      : (h.moving
        ? Math.atan2(this.faceVector(h.faceDir).y, this.faceVector(h.faceDir).x)
        : h.aim)
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

  private mageWandBolt(target: Enemy) {
    const h = this.hero
    const angle = Math.atan2(target.y - h.y, target.x - h.x)
    this.startSkillAttackAnimation()
    this.projectiles.push(this.mkProj(
      h.x, h.y - 10,
      Math.cos(angle) * 480, Math.sin(angle) * 480,
      this.stats.swordDamage, true,
      { r: 6, homing: true, color: this.classId === 'necromancer' ? '#69db7c' : '#8ec5ff' },
    ))
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
      if (e.bleedT > 0) {
        e.bleedT -= dt
        e.bleedTick -= dt
        if (e.bleedTick <= 0) {
          e.bleedTick = 0.5
          this.damageEnemy(e, e.bleedDps * 0.5, true)
          if (e.hp <= 0) continue
        }
      }
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
        if (e.lord > 0) {
          this.updateLord(e, dt, a, dist)
        } else if (e.kind === 'boss') {
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

  private updateSkeletons(dt: number) {
    const command = this.owned('necro-dark-command')?.level ?? 0
    const frenzy = this.skeletonFrenzyT > 0 ? 1.75 : 1
    for (let index = 0; index < this.skeletons.length; index++) {
      const skeleton = this.skeletons[index]
      skeleton.phase += dt * 7
      skeleton.attackCd = Math.max(0, skeleton.attackCd - dt * frenzy * (1 + command * 0.1))
      const target = this.nearestEnemyTo(skeleton.x, skeleton.y)
      if (target && target.hp > 0) {
        const dx = target.x - skeleton.x
        const dy = target.y - skeleton.y
        const distance = Math.hypot(dx, dy)
        if (distance > target.radius + 25) {
          const speed = skeleton.speed * (this.skeletonFrenzyT > 0 ? 1.25 : 1)
          skeleton.x += (dx / distance) * speed * dt
          skeleton.y += (dy / distance) * speed * dt
        } else if (skeleton.attackCd <= 0) {
          skeleton.attackCd = Math.max(0.28, 0.9 - command * 0.07)
          this.damageEnemy(target, skeleton.damage, true, true)
          const pact = this.owned('necro-blood-pact')?.level ?? 0
          if (pact > 0) {
            this.hero.hp = Math.min(this.stats.maxHp, this.hero.hp + skeleton.damage * pact * 0.012)
          }
          this.floatText(target.x, target.y - target.radius - 8, '🦴', '#e9ecef', 13)
        }
      } else {
        const orbitAngle = (index / Math.max(1, this.skeletons.length)) * Math.PI * 2 + this.floorPhase * 0.35
        const followX = this.hero.x + Math.cos(orbitAngle) * (55 + (index % 3) * 16)
        const followY = this.hero.y + Math.sin(orbitAngle) * (40 + (index % 3) * 12)
        const dx = followX - skeleton.x
        const dy = followY - skeleton.y
        const distance = Math.hypot(dx, dy)
        if (distance > 6) {
          skeleton.x += (dx / distance) * skeleton.speed * dt
          skeleton.y += (dy / distance) * skeleton.speed * dt
        }
      }
    }
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
      if (e.hp <= 0) continue
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
    const h = this.hero
    if (h.invuln > 0 || h.shieldT > 0) return
    const juggernaut = this.owned('vitality')?.level ?? 0
    const unbreakable = this.owned('thorns')?.level ?? 0
    if (h.moving && juggernaut > 0) dmg *= Math.max(0.7, 1 - juggernaut * 0.05)
    if (h.willT > 0 && unbreakable > 0) dmg *= Math.max(0.55, 1 - unbreakable * 0.09)
    if (unbreakable > 0 && h.willCd <= 0 && dmg >= this.stats.maxHp * 0.12) {
      h.willCd = 6
      h.willT = 2.2
      h.rage = Math.min(this.stats.maxRage, h.rage + 5 * unbreakable)
      this.floatText(h.x, h.y - 42, `+${5 * unbreakable} RAGE`, '#ff922b', 16)
    }
    const manaShield = this.owned('mage-mana-shield')?.level ?? 0
    if (manaShield > 0 && h.willCd <= 0 && dmg >= this.stats.maxHp * 0.12) {
      h.willCd = 5
      const restored = 4 + manaShield * 3
      h.rage = Math.min(this.stats.maxRage, h.rage + restored)
      this.floatText(h.x, h.y - 42, `+${restored} MANA`, '#74c0fc', 16)
    }
    h.hp -= dmg
    audio.play('hurt')
    // Cael notices when you're about to die (once per stage, so it stays meaningful).
    if (h.hp > 0 && h.hp < this.stats.maxHp * 0.25 && !this.barkedLowHp) {
      this.barkedLowHp = true
      this.floatText(h.x, h.y - 78, randomLine([...BARKS.lowHp]), '#ff8787', 17)
    }
    if (h.counterT > 0) {
      const counterLevel = this.owned('heal')?.level ?? this.owned('tempest')?.level ?? 1
      const counterDamage = 24 + counterLevel * 10 + (this.owned('power')?.level ?? 0) * 8
      for (const e of this.enemies) {
        if (Math.hypot(e.x - h.x, e.y - h.y) < 125 + e.radius) {
          this.damageEnemy(e, counterDamage, true, true)
        }
      }
      h.hp = Math.min(this.stats.maxHp, h.hp + counterDamage * 0.45)
      this.rings.push({ x: h.x, y: h.y, r: 8, maxR: 125, life: 0.28, color: 'rgba(220,55,65,0.7)' })
    }
    if (h.hp <= 0 && h.lastStandT > 0) {
      h.hp = 1
      h.lastStandT = 0
      h.shieldT = 1.2
      this.floatText(h.x, h.y - 52, 'NOT YET!', '#ffe066', 24)
    }
    h.invuln = 0.2
    this.floatText(this.hero.x, this.hero.y - 26, `-${Math.round(dmg)}`, '#ff8787', 18)
    this.shake(6)
  }

  private endRun() {
    if (this.status === 'dead') return
    this.status = 'dead'
    audio.play('death')
    this.opts.onRunEnd({ clearedStage: Math.max(0, this.stage - 1), kills: this.kills })
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

    // ground loot pickups
    this.drawPickups()

    // Necromancer corpses and summoned army
    for (const corpse of this.corpses) this.drawCorpse(corpse)
    for (const skeleton of this.skeletons) this.drawSkeleton(skeleton)

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
    const w = 96
    const h = w * (WORLD_H / WORLD_W)
    const x = WIDTH - w - 12
    const y = HEIGHT - h - 12
    const sx = w / WORLD_W
    const sy = h / WORLD_H
    ctx.save()
    // A plain radar: the arena tinted by the current layer, you, the enemies,
    // and anything worth running toward. Nothing else to decode.
    const pal = BIOMES[this.biome]
    ctx.globalAlpha = 0.72
    ctx.fillStyle = pal.floorA
    ctx.fillRect(x, y, w, h)
    ctx.globalAlpha = 0.95
    // camera viewport, so you can see how much of the arena you're looking at
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.lineWidth = 1
    ctx.strokeRect(x + this.cam.x * sx, y + this.cam.y * sy, WIDTH * sx, HEIGHT * sy)
    // enemies
    ctx.fillStyle = '#ff4d4d'
    for (const e of this.enemies) {
      const size = e.lord > 0 ? 4 : e.elite ? 3 : 2
      ctx.fillRect(x + e.x * sx - size / 2, y + e.y * sy - size / 2, size, size)
    }
    // pickups worth chasing
    for (const pk of this.pickups) {
      if (pk.type !== 'chest' && pk.type !== 'heart') continue
      ctx.fillStyle = pk.type === 'chest' ? '#ffd43b' : '#ff8787'
      ctx.beginPath(); ctx.arc(x + pk.x * sx, y + pk.y * sy, 2.5, 0, Math.PI * 2); ctx.fill()
    }
    // hero last, so they're always on top
    ctx.fillStyle = '#ffe066'
    ctx.beginPath(); ctx.arc(x + this.hero.x * sx, y + this.hero.y * sy, 3, 0, Math.PI * 2); ctx.fill()
    // frame
    ctx.strokeStyle = 'rgba(255,220,160,0.5)'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
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
        const biome = this.biome // whole arena themed to the current descent layer
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

    // Deliberately uniform ground: like other survivor games the arena stays
    // clean and readable so enemies, drops and telegraphs pop against it.

    // world border wall
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth = 20
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H)
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
    let img = this.enemyImgs[e.kind]
    if (e.kind === 'fast' && this.cinderMawRun.every((frame) => this.ready(frame))) {
      img = this.cinderMawRun[Math.floor(e.phase * 1.75) % this.cinderMawRun.length]
    }
    // a layer-lord wears the hollowed form of the champion they were
    if (e.lord > 0) {
      const lordImg = this.lordImgs[e.lord - 1]
      if (this.ready(lordImg)) img = lordImg
    }
    // elite aura
    if (e.elite) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.4 + Math.sin(e.phase * 2) * 0.12
      const ag = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, e.radius * 1.8)
      ag.addColorStop(0, 'rgba(255,215,80,0.5)')
      ag.addColorStop(1, 'rgba(255,215,80,0)')
      ctx.fillStyle = ag
      ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * 1.8, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
    this.drawShadow(e.x, e.y + e.radius * 0.85, e.radius * 0.9)
    if (this.ready(img)) {
      const pop = 1 + Math.max(0, e.hitFlash) * 1.8
      const bob = Math.sin(e.phase) * (e.radius * 0.05)
      this.blit(img, e.x, e.y + e.radius * 0.9 - bob, e.radius * 2.9, e.facing, pop)
      if (e.hitFlash > 0) { // white flash overlay
        ctx.save()
        ctx.globalAlpha = e.hitFlash * 5
        ctx.globalCompositeOperation = 'lighter'
        this.blit(img, e.x, e.y + e.radius * 0.9 - bob, e.radius * 2.9, e.facing, pop)
        ctx.restore()
      }
    } else {
      drawCreature(ctx, {
        x: e.x, y: e.y, kind: e.kind, radius: e.radius,
        facing: e.facing, phase: e.phase, hitFlash: e.hitFlash,
        elite: e.elite, pal: BIOMES[e.ebiome],
      })
    }
    // elite crown
    if (e.elite) {
      ctx.fillStyle = '#ffd43b'
      const cy = e.y - e.radius * 1.35
      ctx.beginPath()
      ctx.moveTo(e.x - 9, cy); ctx.lineTo(e.x - 9, cy - 7); ctx.lineTo(e.x - 4, cy - 3)
      ctx.lineTo(e.x, cy - 9); ctx.lineTo(e.x + 4, cy - 3); ctx.lineTo(e.x + 9, cy - 7); ctx.lineTo(e.x + 9, cy)
      ctx.closePath(); ctx.fill()
    }
    // health bar (lords always show theirs, with a name plate)
    if (e.hp < e.maxHp || e.lord > 0) {
      const w = e.radius * 2
      const x = e.x - w / 2
      const y = e.y - e.radius - 16
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(x - 1, y - 1, w + 2, 6)
      // enemy health is red too; lords/elites just run brighter
      ctx.fillStyle = e.lord > 0 || e.kind === 'boss' ? '#ff4d4d' : e.elite ? '#ff8787' : '#e03131'
      ctx.fillRect(x, y, w * (e.hp / e.maxHp), 4)
      if (e.lord > 0) {
        const layer = LAYERS[e.lord - 1]
        ctx.save()
        ctx.font = 'bold 13px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        ctx.fillText(layer.lordShort, e.x + 1, y - 7)
        ctx.fillStyle = e.phase2 ? '#ff922b' : '#ffd9b0'
        ctx.fillText(layer.lordShort, e.x, y - 8)
        ctx.restore()
      }
    }
  }

  private drawCorpse(corpse: Corpse) {
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = Math.min(0.8, corpse.life / 2)
    ctx.fillStyle = 'rgba(35,45,40,0.75)'
    ctx.beginPath(); ctx.ellipse(corpse.x, corpse.y + 8, 17, 8, -0.18, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#adb5bd'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(corpse.x - 9, corpse.y + 3); ctx.lineTo(corpse.x + 9, corpse.y + 11)
    ctx.moveTo(corpse.x + 8, corpse.y + 1); ctx.lineTo(corpse.x - 8, corpse.y + 12)
    ctx.stroke()
    ctx.restore()
  }

  private drawSkeleton(skeleton: Skeleton) {
    const ctx = this.ctx
    const bob = Math.sin(skeleton.phase) * 2
    ctx.save()
    ctx.translate(skeleton.x, skeleton.y - bob)
    if (skeleton.empowered) {
      ctx.shadowColor = '#69db7c'
      ctx.shadowBlur = 13
    }
    this.drawShadow(0, 19, 13)
    ctx.strokeStyle = skeleton.empowered ? '#d3f9d8' : '#e9ecef'
    ctx.fillStyle = '#f1f3f5'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.arc(0, -13, 8, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#343a40'
    ctx.beginPath(); ctx.arc(-3, -15, 1.5, 0, Math.PI * 2); ctx.arc(3, -15, 1.5, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath()
    ctx.moveTo(0, -5); ctx.lineTo(0, 12)
    ctx.moveTo(-8, 0); ctx.lineTo(8, 0)
    ctx.moveTo(0, 12); ctx.lineTo(-7, 21)
    ctx.moveTo(0, 12); ctx.lineTo(7, 21)
    ctx.moveTo(8, 0); ctx.lineTo(13, 9)
    ctx.stroke()
    ctx.strokeStyle = '#ced4da'
    ctx.lineWidth = 1.5
    for (let y = -2; y <= 7; y += 4) {
      ctx.beginPath(); ctx.moveTo(-6, y); ctx.lineTo(6, y); ctx.stroke()
    }
    ctx.restore()
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

    this.drawShadow(h.x, h.y + 22, 17)
    if (this.ready(this.heroImg) || this.ready(this.heroDir.down)) {
      const flick = h.invuln > 0 && h.shieldT <= 0 && Math.floor(h.invuln * 20) % 2 === 0
      const swinging = h.swingT > 0
      const st = swinging ? 1 - h.swingT / h.swingMax : 0 // 0 → 1 across the swing
      const swing = swinging ? Math.sin(st * Math.PI) : 0  // 0 → 1 → 0

      // Pick the sprite: front/side attack frames while slashing, else directional idle.
      const frames = this.heroAtk
      const framesReady = frames.length === 6 && frames.every((frame) => this.ready(frame))
      const turnFramesReady = this.heroTurn.length === 4 && this.heroTurn.every((frame) => this.ready(frame))
      const rearFacing = h.faceDir === 'up' || h.faceDir === 'upLeft' || h.faceDir === 'upRight'
      let img: HTMLImageElement | undefined = this.heroImg
      let useFrames = false
      if (swinging && framesReady && !rearFacing) {
        img = frames[Math.min(frames.length - 1, Math.floor(st * frames.length))]
        useFrames = true
      } else if (this.heroTurnT > 0 && turnFramesReady) {
        const progress = 1 - this.heroTurnT / this.HERO_TURN_DURATION
        const frameIndex = Math.round(this.heroTurnFrom + (this.heroTurnTo - this.heroTurnFrom) * progress)
        img = this.heroTurn[Math.max(0, Math.min(this.heroTurn.length - 1, frameIndex))]
      } else {
        const diagonal = h.faceDir === 'upLeft' || h.faceDir === 'upRight'
          || h.faceDir === 'downLeft' || h.faceDir === 'downRight'
        const diagonalIdle = diagonal ? this.heroWalkFrames(h.faceDir)[0] : undefined
        if (this.ready(diagonalIdle)) {
          img = diagonalIdle
        } else {
          const cardinal = this.cardinalHeroDirection(h.faceDir)
          const key = cardinal === 'left' || cardinal === 'right' ? 'side' : cardinal
          const dir = this.heroDir[key]
          if (this.ready(dir)) img = dir
        }
      }

      // Walk cycle. Prefer generated frame art; otherwise fall back to a procedural body rock.
      const walking = h.moving && !useFrames
      const wp = h.walkPhase
      let useWalkFrames = false
      if (walking) {
        const set = this.heroWalkFrames(h.faceDir)
        const rdy = set.filter((a) => this.ready(a))
        if (rdy.length >= 2) {
          const n = rdy.length
          img = rdy[Math.floor((wp * n) / (Math.PI * 2)) % n] // step through the frames over one stride
          useWalkFrames = true
        }
      }
      // Procedural weight-shift only when walking without frame art (frames carry their own motion).
      const rock = walking && !useWalkFrames
      const shift = rock ? Math.sin(wp) : 0                // -1..1: weight rocks side to side each step
      const bounce = rock ? Math.abs(Math.sin(wp)) : 0     // 0 at footfall, 1 mid-stride
      const lean = shift * 0.11                             // body leans ~6° toward the planted foot
      const swayX = shift * 2.4                             // hips drift toward the planted foot
      const sqX = 1 + (1 - bounce) * 0.05                   // squash & stretch: widen and settle on footfall
      const sqY = 1 - (1 - bounce) * 0.07
      const bob = rock
        ? bounce * 3.6                                      // body rises between footfalls, plants down on each step
        : (h.moving ? 0 : Math.sin(this.floorPhase * 2) * 1) // gentle breathing while standing still

      if (this.ready(img)) {
        // Horizontal mirror: attack frames & the side view flip to match facing.
        let flip = 1
        if (useFrames) flip = h.facing
        else if (this.mirrorHeroDirection(h.faceDir)) flip = -1
        // Rotation only drives the back-facing (up) swing; the frames animate themselves.
        const rot = useFrames ? 0 : swing * 0.5 * h.swingDir
        // Small forward lunge on the strike so the hit reads.
        const face = this.faceVector(h.faceDir)
        const lx = face.x * swing * 5
        const ly = face.y * swing * 4
        const targetH = 82
        const w = targetH * (img.naturalWidth / img.naturalHeight)
        const chest = targetH * 0.6
        const feetY = h.y + 28 - bob + ly
        ctx.save()
        if (flick) ctx.globalAlpha = 0.5
        // Rock & squash pivot around the feet (the weight shift of a stride)…
        ctx.translate(h.x + lx + swayX, feetY)
        ctx.rotate(lean)
        ctx.scale(sqX, sqY)
        // …while the sword swing pivots around the chest/hands.
        ctx.translate(0, -chest)
        ctx.rotate(rot)
        ctx.scale(flip, 1)
        ctx.drawImage(img, -w / 2, chest - targetH, w, targetH)
        ctx.restore()
        ctx.globalAlpha = 1
      }
      if (h.shieldT > 0) {
        ctx.save()
        ctx.globalAlpha = 0.4 + Math.sin(h.walkPhase * 2) * 0.1
        const sg = ctx.createRadialGradient(h.x, h.y - 4, 8, h.x, h.y - 4, 34)
        sg.addColorStop(0, 'rgba(120,255,190,0)')
        sg.addColorStop(1, 'rgba(120,255,190,0.5)')
        ctx.fillStyle = sg
        ctx.beginPath(); ctx.arc(h.x, h.y - 4, 34, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      }
    } else {
      // vector fallback
      ctx.save()
      ctx.translate(h.x, h.y); ctx.scale(1.1, 1.1); ctx.translate(-h.x, -h.y)
      drawKnight(ctx, {
        x: h.x, y: h.y, facing: h.facing, walkPhase: h.walkPhase, moving: h.moving,
        swingT: h.swingT, swingDur: h.swingMax, swingAngle: h.swingAngle, swingDir: h.swingDir, aim: h.aim,
        swordTier: this.swordTier, styleId: this.swordStyleId, time: this.floorPhase,
        invuln: h.invuln, shield: h.shieldT > 0, faceDir: this.cardinalHeroDirection(h.faceDir),
      })
      ctx.restore()
    }
    this.drawHeroBars()
  }

  /** Health + resource bars floating just above the hero, matched to their width. */
  private drawHeroBars() {
    const ctx = this.ctx
    const h = this.hero
    const s = this.stats
    const w = 46 // roughly the character's shoulder width on screen
    const x = h.x - w / 2
    const y = h.y - 62
    const barH = 4
    const gap = 2
    const hpPct = Math.max(0, Math.min(1, h.hp / s.maxHp))
    const resPct = s.maxRage > 0 ? Math.max(0, Math.min(1, h.rage / s.maxRage)) : 0
    const resColor = this.classId === 'mage' ? '#74c0fc' : this.classId === 'necromancer' ? '#8ce99a' : '#ffa94d'
    ctx.save()
    // backing plate
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(x - 1, y - 1, w + 2, barH * 2 + gap + 2)
    // health — always red; it darkens as it drains so low health still reads
    ctx.fillStyle = hpPct > 0.3 ? '#ff4d4d' : '#c92a2a'
    ctx.fillRect(x, y, w * hpPct, barH)
    // class resource (Rage / Mana / Essence)
    ctx.fillStyle = resColor
    ctx.fillRect(x, y + barH + gap, w * resPct, barH)
    ctx.restore()
  }

  // ---------- emit HUD ----------
  private emit() {
    const h = this.hero
    const s = this.stats
    const ab: AbilityView[] = this.activeSkills().slice(0, ABILITY_KEYS.length).map((os, i) => {
      const def = SKILLS[os.id]
      const info = this.cdInfo(os)
      return { id: os.id, key: ABILITY_KEYS[i], name: def.name, icon: def.icon, ...info }
    })
    const state: HudState = {
      status: this.status,
      hp: Math.max(0, Math.round(h.hp)),
      maxHp: Math.round(s.maxHp),
      rage: Math.round(h.rage),
      maxRage: Math.round(s.maxRage),
      className: CLASSES[this.classId].name,
      resourceName: CLASSES[this.classId].resourceName,
      minionCount: this.skeletons.length,
      time: this.survTime,
      gold: this.gold,
      stage: this.stage,
      stageKills: this.stageKills,
      stageEnemyTotal: this.stageEnemyTotal(),
      bossStage: isLordStage(this.stage),
      kills: this.kills,
      swordTier: this.swordTier,
      swordStyleName: SWORD_STYLES[this.swordStyleId].name,
      swordStyleIcon: SWORD_STYLES[this.swordStyleId].icon,
      biome: this.layerName || BIOMES[this.biome].name,
      combo: this.combo,
      comboPct: Math.max(0, Math.min(1, this.comboT / 2.5)),
      depth: depthForStage(this.stage),
      maxDepth: LAYERS.length,
      finalStage: FINAL_STAGE,
      relics: [...this.relics],
      abilities: ab,
      skills: this.skills.map((os) => ({ id: os.id, level: os.level })),
      cards: this.status === 'skillselect' ? this.choices : [],
      runKills: this.kills,
    }
    this.opts.onState(state)
  }
}
