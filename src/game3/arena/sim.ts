import {
  BASE, BOSS_PIT, BUILDS, CAMPS, CLASS_STATS, DIFFICULTIES, Effect, FOUNTAIN, HEROES, HeroDef, LANES, LANE_IDS, LaneId, MAP, MAX_ITEMS,
  MAX_LEVEL, Scale, TOWERS, TREES, Team, ULT_LEVEL, Vec, heroByName, itemById, laneLength, lanePoint, laneProgress, nearestLane,
} from './data'
import { type AutoId, type Card, type PerkId, drawOffer, rankScale, SKILL_RANKS, tuneSkill } from './growth'

// The whole match as plain state + step(dt). No DOM, no three.js, no timers: the renderer and HUD
// only read from it, and the regression plays complete AI-vs-AI matches in node in a few seconds.

export type Kind = 'hero' | 'minion' | 'tower' | 'base' | 'monster'
export type Unit = {
  id: number; team: Team | 2; kind: Kind; sub: string
  x: number; y: number; r: number; heading: number
  hp: number; maxHp: number; atk: number; armor: number; range: number; interval: number; speed: number; ranged: boolean
  cd: number; windup: number; swingId: number; targetId: number; think: number
  alive: boolean; stun: number; slowT: number; shield: number; shieldT: number
  flash: number; attackSeq: number; moving: boolean
  lane?: LaneId; wp: number; home?: Vec; respawnAt: number; ramp: number
  lastHero: number; lastHeroT: number; forcedT: number
}
type Timed = { m: number; t: number }
export type Hero = Unit & {
  kind: 'hero'; team: Team; def: HeroDef; isPlayer: boolean
  level: number; xp: number; gold: number; earned: number; items: string[]
  ranks: number[]; autos: { id: AutoId; rank: number; t: number }[]; perks: Partial<Record<PerkId, number>>; picks: number; offer: Card[] | null; orbit: number; orbitHits: Map<number, number>
  cds: [number, number, number]; healCd: number; flashCd: number; recallT: number; chain: number; chainAt: number
  k: number; d: number; a: number; streak: number; multi: number; multiT: number; dealt: number
  baseSpeed: number; baseInterval: number; itemLs: number; cdr: number
  buffs: { atk: Timed; speed: Timed; aspd: Timed; ls: Timed }
  dash: { dx: number; dy: number; left: number; dmg: number; width: number; stun: number; slow: number; hit: number[] } | null
  damagedAt: number; assists: Map<number, number>; castSeq: number; castSlot: number; vx: number; vy: number
  ai: { mode: 'lane' | 'retreat' | 'defend'; lane: LaneId; flex: boolean; moveTo: Vec | null; attackId: number; think: number; react: number; laneCheck: number; backoff: number }
}
export type Shot = { heavy?: boolean; id: number; team: Team | 2; ownerId: number; x: number; y: number; dx: number; dy: number; speed: number; targetId: number; dmg: number; width: number; left: number; pierce: boolean; hit: number[]; stun: number; slow: number; kind: 'basic' | 'tower' | 'skill'; color: string }
export type Zone = { id: number; team: Team; ownerId: number; x: number; y: number; r: number; delay: number; wait: number; left: number; tick: number; dmg: number; stun: number; slow: number; color: string }
export type ArenaEvent =
  | { type: 'dmg'; x: number; y: number; amount: number; mine: boolean; heavy: boolean }
  | { type: 'gold'; x: number; y: number; amount: number }
  | { type: 'flash'; x: number; y: number; tx: number; ty: number; color: string }
  | { type: 'down'; x: number; y: number; color: string }
  | { type: 'heal'; x: number; y: number; amount: number }
  | { type: 'kill'; killer: string | null; victim: string; killerTeam: Team | 2; first: boolean; multi: number; streak: number; role: 'killer' | 'victim' | 'assist' | null }
  | { type: 'tower'; team: Team; lane: LaneId }
  | { type: 'cast'; id: number; slot: number; mine: boolean; x: number; y: number; color: string }
  | { type: 'cone'; x: number; y: number; dx: number; dy: number; radius: number; arc: number; color: string }
  | { type: 'hit'; x: number; y: number; big: boolean; color: string }
  | { type: 'levelup'; id: number; mine: boolean }
  | { type: 'boss'; team: Team } | { type: 'bossSpawn' }
  | { type: 'grow'; id: number; mine: boolean; card: Card; awake: boolean }
  | { type: 'zap'; x: number; y: number; tx: number; ty: number; color: string }
  | { type: 'nova'; x: number; y: number; r: number; color: string }
  | { type: 'drum'; x: number; y: number }
  | { type: 'summon'; x: number; y: number; color: string }
  | { type: 'end'; winner: Team }

const SLOW = 0.6
const TOWER_RANGE = 520
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const xpNeed = (level: number) => 100 + 62 * level

export type ArenaOptions = { hero: string; seed?: number; difficulty?: number; allAi?: boolean }

export class ArenaSim {
  time = 0
  units: Unit[] = []
  heroes: Hero[] = []
  shots: Shot[] = []
  zones: Zone[] = []
  events: ArenaEvent[] = []
  winner: Team | null = null
  kills: [number, number] = [0, 0]
  bossBuff: [number, number] = [0, 0] // seconds left of 铁牛之力 per team
  player!: Hero
  autopilot = false
  input = { mx: 0, my: 0, attack: false, prefer: 'auto' as 'auto' | 'minion' | 'tower' }
  private id = 1
  private seed: number
  private wave = 0
  private nextWave = 8
  private firstBlood = false
  private heavy = false
  stickyTarget = 0
  private baseHitAt: [number, number] = [-99, -99]
  private bossAt = 150
  private difficulty: (typeof DIFFICULTIES)[number]
  private allAi: boolean

  constructor(options: ArenaOptions) {
    this.seed = (options.seed ?? Date.now()) % 2147483647 || 1
    this.difficulty = DIFFICULTIES[options.difficulty ?? 1]
    this.allAi = Boolean(options.allAi)
    for (const team of [0, 1] as Team[]) this.units.push(this.unit({ team, kind: 'base', sub: 'base', ...BASE[team], r: 110, hp: 8200, atk: 380, armor: 60, range: 560, interval: 1 }))
    for (const t of TOWERS) this.units.push(this.unit({ team: t.team, kind: 'tower', sub: t.tier, ...t.at, r: 62, hp: t.tier === 'outer' ? 4800 : 5800, atk: 260, armor: 60, range: TOWER_RANGE, interval: 1, lane: t.lane }))
    for (const camp of CAMPS) this.units.push(this.monster(camp, 'camp'))
    this.draft(heroByName(options.hero))
  }

  // ---------- setup ----------
  private random() { this.seed = this.seed * 16807 % 2147483647; return this.seed / 2147483647 }
  private unit(p: Partial<Unit> & { team: Team | 2; kind: Kind; sub: string; x: number; y: number; r: number; hp: number; atk: number; range: number; interval: number }): Unit {
    return {
      id: this.id++, heading: p.team === 1 ? Math.PI * 1.25 : Math.PI * 0.25, maxHp: p.hp, armor: 0, speed: 0, ranged: true, cd: 0, windup: 0, swingId: 0, targetId: 0,
      think: this.random() * 0.3, alive: true, stun: 0, slowT: 0, shield: 0, shieldT: 0, flash: 0, attackSeq: 0, moving: false, wp: 0, respawnAt: 0, ramp: 0,
      lastHero: 0, lastHeroT: -99, forcedT: 0, ...p,
    }
  }
  private monster(at: Vec, sub: 'camp' | 'boss'): Unit {
    const boss = sub === 'boss'
    return this.unit({ team: 2, kind: 'monster', sub, ...at, r: boss ? 70 : 42, hp: boss ? 5600 : 1500, atk: boss ? 170 : 85, armor: boss ? 40 : 15, range: boss ? 170 : 120, interval: 1.2, speed: 250, ranged: false, home: { ...at } })
  }
  private draft(pick: HeroDef) {
    const pool = [...HEROES].filter(h => h !== pick)
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
    const take = (cls: string) => pool.splice(pool.findIndex(h => h.cls === cls), 1)[0]
    const shape = ['fighter', 'mage', 'marksman', 'tank', 'fighter']
    const lanes: { lane: LaneId; flex: boolean }[] = [{ lane: 'top', flex: false }, { lane: 'mid', flex: false }, { lane: 'bot', flex: false }, { lane: 'bot', flex: false }, { lane: 'mid', flex: true }]
    for (const team of [0, 1] as Team[]) {
      let mine = team === 0 ? shape.lastIndexOf(pick.cls) : -1
      shape.forEach((cls, i) => {
        const isPick = i === mine
        if (isPick) mine = -2
        const hero = this.makeHero(isPick ? pick : take(cls), team, lanes[i], isPick && !this.allAi)
        if (isPick) this.player = hero
      })
    }
  }
  private makeHero(def: HeroDef, team: Team, slot: { lane: LaneId; flex: boolean }, isPlayer: boolean): Hero {
    const c = CLASS_STATS[def.cls], n = this.heroes.filter(h => h.team === team).length
    const spawn = { x: FOUNTAIN[team].x + Math.cos(n * 1.3) * 90, y: FOUNTAIN[team].y + Math.sin(n * 1.3) * 90 }
    const hero: Hero = {
      ...this.unit({ team, kind: 'hero', sub: def.cls, ...spawn, r: 30, hp: c.hp, atk: c.atk, armor: c.armor, range: c.range, interval: c.interval, speed: c.speed, ranged: c.ranged }),
      kind: 'hero', team, def, isPlayer, level: 1, xp: 0, gold: 300, earned: 300, items: [], ranks: [0, 0, 0], autos: [], perks: {}, picks: 1, offer: null, orbit: 0, orbitHits: new Map(), cds: [0, 0, 0], healCd: 0, flashCd: 0, recallT: 0, chain: 0, chainAt: -99,
      k: 0, d: 0, a: 0, streak: 0, multi: 0, multiT: -99, dealt: 0, baseSpeed: c.speed, baseInterval: c.interval, itemLs: 0, cdr: 0,
      buffs: { atk: { m: 1, t: 0 }, speed: { m: 1, t: 0 }, aspd: { m: 1, t: 0 }, ls: { m: 0, t: 0 } }, dash: null,
      damagedAt: -99, assists: new Map(), castSeq: 0, castSlot: 0, vx: 0, vy: 0,
      ai: { mode: 'lane', ...slot, moveTo: null, attackId: 0, think: this.random() * 0.3, react: 0, laneCheck: 10 + this.random() * 6, backoff: 0 },
    }
    this.refresh(hero); hero.hp = hero.maxHp
    this.units.push(hero); this.heroes.push(hero)
    return hero
  }
  private refresh(h: Hero) {
    const c = CLASS_STATS[h.def.cls], grown = h.level - 1
    const tune = h.team === 1 && !this.allAi ? this.difficulty.enemy : 1
    let hp = c.hp * (1 + 0.085 * grown), atk = c.atk * (1 + 0.075 * grown), armor = c.armor + 2.5 * grown, speed = c.speed, aspd = 1, ls = 0, cdr = 0
    for (const id of h.items) { const it = itemById(id); hp += it.hp ?? 0; atk += it.atk ?? 0; armor += it.armor ?? 0; speed += it.speed ?? 0; aspd += it.aspd ?? 0; ls += it.lifesteal ?? 0; cdr += it.cdr ?? 0 }
    const perk = (id: PerkId) => h.perks?.[id] ?? 0
    hp *= 1 + 0.1 * perk('vigor'); speed += 20 * perk('swift'); aspd += 0.15 * perk('haste'); ls += 0.08 * perk('vamp'); cdr += 0.08 * perk('focus')
    const ratio = h.maxHp ? h.hp / h.maxHp : 1
    h.maxHp = hp * tune; h.atk = atk * tune; h.armor = armor; h.hp = h.maxHp * ratio
    h.baseSpeed = speed; h.baseInterval = c.interval / aspd; h.itemLs = ls; h.cdr = Math.min(0.45, cdr)
  }

  // ---------- queries ----------
  byId(id: number) { return id ? this.units.find(u => u.id === id && u.alive) : undefined }
  private hostile(a: Unit, b: Unit) { return a.team !== b.team && b.alive }
  private around(p: Vec, radius: number, keep: (u: Unit) => boolean) { return this.units.filter(u => u.alive && keep(u) && dist(u, p) <= radius + u.r) }
  private nearest(p: Vec, radius: number, keep: (u: Unit) => boolean) {
    let best: Unit | undefined, d = radius
    for (const u of this.units) if (u.alive && keep(u)) { const dd = dist(u, p) - u.r; if (dd < d) { d = dd; best = u } }
    return best
  }
  baseOpen(team: Team) { return LANE_IDS.some(lane => !this.units.some(u => u.kind === 'tower' && u.team === team && u.lane === lane && u.alive)) }
  private covered(structure: Unit) { return this.units.some(u => u.alive && u.kind === 'minion' && u.team !== structure.team && dist(u, structure) < structure.range + 40) }
  private atkNow(h: Hero) { return h.atk * (h.buffs.atk.t > 0 ? h.buffs.atk.m : 1) * (this.bossBuff[h.team] > 0 ? 1.15 : 1) }
  private speedNow(u: Unit) {
    const h = u.kind === 'hero' ? u as Hero : null
    return (h ? h.baseSpeed * (h.buffs.speed.t > 0 ? h.buffs.speed.m : 1) : u.speed) * (u.slowT > 0 ? SLOW : 1)
  }
  skillDamage(h: Hero, s: Scale) { return (s[0] + s[1] * (h.level - 1) + s[2] * this.atkNow(h)) * CLASS_STATS[h.def.cls].power * 1.15 }
  skillReady(h: Hero, slot: number) { return h.alive && h.cds[slot] <= 0 && (slot < 2 || h.level >= ULT_LEVEL) }
  nextItem(h: Hero) { return h.items.length >= MAX_ITEMS ? undefined : BUILDS[h.def.cls].map(itemById).find(it => !h.items.includes(it.id)) }

  // ---------- damage, death, rewards ----------
  damage(target: Unit, raw: number, source: Unit | null, pure = false): number {
    if (!target.alive || this.winner !== null) return 0
    let amount = pure ? raw : raw * 100 / (100 + target.armor)
    if (target.kind === 'base' && !this.baseOpen(target.team as Team)) return 0
    if ((target.kind === 'tower' || target.kind === 'base') && !this.covered(target)) amount *= 0.3 // no wave, no siege
    if (target.shield > 0) { const soak = Math.min(target.shield, amount); target.shield -= soak; amount -= soak }
    target.hp -= amount; target.flash = 0.15
    const hero = source?.kind === 'hero' ? source as Hero : null
    if (target.kind === 'base') this.baseHitAt[target.team as Team] = this.time
    if (hero) {
      target.lastHero = hero.id; target.lastHeroT = this.time; hero.dealt += target.kind === 'hero' ? amount : 0
      if (target.kind === 'monster') target.targetId = hero.id
      if (target.kind === 'hero') {
        // Hitting a hero calls the wave and any tower in reach onto the attacker.
        for (const u of this.units) {
          if (!u.alive || u.team !== target.team) continue
          if (u.kind === 'minion' && dist(u, target) < 420) { u.targetId = hero.id; u.forcedT = 2.5 }
          if ((u.kind === 'tower' || u.kind === 'base') && dist(u, hero) < u.range + hero.r) { u.targetId = hero.id; u.forcedT = 2.5 }
        }
      }
    }
    if (target.kind === 'hero') {
      const t = target as Hero
      t.damagedAt = this.time; t.recallT = 0
      if (hero) t.assists.set(hero.id, this.time)
    }
    if (amount > 1 && (source === this.player || target === this.player)) this.events.push({ type: 'dmg', x: target.x, y: target.y, amount, mine: source === this.player, heavy: this.heavy })
    if (target.hp <= 0) this.kill(target, source)
    return amount
  }
  private heal(h: Unit, amount: number) {
    const before = h.hp
    h.hp = Math.min(h.maxHp, h.hp + amount)
    if (h === this.player && h.hp - before > 8) this.events.push({ type: 'heal', x: h.x, y: h.y, amount: h.hp - before })
  }
  private pay(h: Hero, gold: number, xp: number, at?: Vec) {
    gold *= 1 + 0.25 * (h.perks.greed ?? 0)
    h.gold += gold; h.earned += gold; h.xp += xp
    if (at && h === this.player && gold >= 1) this.events.push({ type: 'gold', x: at.x, y: at.y, amount: Math.round(gold) })
    while (h.level < MAX_LEVEL && h.xp >= xpNeed(h.level)) {
      h.xp -= xpNeed(h.level); h.level++; h.picks++
      this.refresh(h); this.heal(h, h.maxHp * 0.12)
      this.events.push({ type: 'levelup', id: h.id, mine: h === this.player })
    }
  }
  private kill(target: Unit, source: Unit | null) {
    target.alive = false; target.hp = 0
    const window = target.kind === 'hero' ? 8 : 3
    const killer = (source?.kind === 'hero' ? source : this.time - target.lastHeroT < window ? this.units.find(u => u.id === target.lastHero) : undefined) as Hero | undefined
    const foes = this.heroes.filter(h => h.alive && h.team !== target.team && dist(h, target) < 700)
    if (target.kind === 'minion') {
      const gold = target.sub === 'siege' ? 48 : target.sub === 'ranged' ? 19 : 23, xp = target.sub === 'siege' ? 55 : 28
      if (killer) this.pay(killer, gold, 0, target)
      else for (const h of foes) this.pay(h, gold * 0.5 / foes.length, 0)
      for (const h of foes) this.pay(h, 0, xp / Math.max(1, foes.length) * (foes.length > 1 ? 1.3 : 1))
    } else if (target.kind === 'monster') {
      const boss = target.sub === 'boss'
      target.respawnAt = this.time + (boss ? 150 : 70)
      if (killer) {
        this.pay(killer, boss ? 150 : 75, boss ? 220 : 95, target)
        if (boss) {
          this.bossBuff[killer.team] = 75
          for (const h of this.heroes) if (h.team === killer.team && h !== killer) this.pay(h, 100, 120)
          this.events.push({ type: 'boss', team: killer.team })
        }
      }
    } else if (target.kind === 'tower') {
      for (const h of this.heroes) if (h.team !== target.team) this.pay(h, 130, 60)
      this.events.push({ type: 'tower', team: target.team as Team, lane: target.lane! })
    } else if (target.kind === 'base') {
      this.winner = target.team === 0 ? 1 : 0
      this.events.push({ type: 'end', winner: this.winner })
    } else if (target.kind === 'hero') {
      const victim = target as Hero
      victim.d++; victim.streak = 0; victim.dash = null; victim.recallT = 0
      this.events.push({ type: 'down', x: victim.x, y: victim.y, color: victim.def.color })
      victim.respawnAt = this.time + Math.min(38, 5 + victim.level * 2.2)
      const helpers = [...victim.assists].filter(([id, at]) => this.time - at < 8 && id !== killer?.id).map(([id]) => this.heroes.find(h => h.id === id)!).filter(Boolean)
      victim.assists.clear()
      if (killer) {
        killer.k++; killer.streak++
        killer.multi = this.time - killer.multiT < 10 ? killer.multi + 1 : 1; killer.multiT = this.time
        this.kills[killer.team]++
        this.pay(killer, 200 + victim.level * 15, 90 + victim.level * 22, victim)
      } else if (source && source.team !== 2) this.kills[source.team as Team]++
      for (const h of helpers) { h.a++; this.pay(h, 70, 50 + victim.level * 12) }
      const role = killer === this.player ? 'killer' : victim === this.player ? 'victim' : helpers.includes(this.player) ? 'assist' : null
      this.events.push({ type: 'kill', killer: killer?.def.name ?? null, victim: victim.def.name, killerTeam: killer?.team ?? source?.team ?? 2, first: !this.firstBlood && Boolean(killer), multi: killer?.multi ?? 0, streak: killer?.streak ?? 0, role })
      if (killer) this.firstBlood = true
    }
  }

  // ---------- movement ----------
  private move(u: Unit, dx: number, dy: number, dt: number, scale = 1) {
    const len = Math.hypot(dx, dy)
    if (len < 0.001) return
    const step = this.speedNow(u) * scale * dt
    u.x = clamp(u.x + dx / len * step, 50, MAP - 50); u.y = clamp(u.y + dy / len * step, 50, MAP - 50)
    u.heading = Math.atan2(dx, dy); u.moving = true
    if (u.kind === 'hero') this.unstick(u)
  }
  // Heroes slide around trees and standing structures; convex shapes, so no pathfinding is needed.
  private unstick(u: Unit) {
    const push = (c: Vec, r: number) => { const d = dist(u, c), min = r + u.r; if (d < min && d > 0.01) { u.x = c.x + (u.x - c.x) / d * min; u.y = c.y + (u.y - c.y) / d * min } }
    for (const t of TREES) push(t, t.r)
    for (const s of this.units) if (s.alive && (s.kind === 'tower' || s.kind === 'base')) push(s, s.r)
  }
  private toward(u: Unit, p: Vec, dt: number, stop = 6) {
    if (dist(u, p) <= stop) return false
    this.move(u, p.x - u.x, p.y - u.y, dt); return true
  }

  // ---------- attacks ----------
  private strike(u: Unit, target: Unit) {
    if (u.cd > 0 || u.windup > 0 || u.stun > 0) return
    u.heading = Math.atan2(target.x - u.x, target.y - u.y)
    u.windup = u.kind === 'hero' ? 0.2 : 0.3; u.swingId = target.id; u.attackSeq++
    const h = u.kind === 'hero' ? u as Hero : null
    u.cd = h ? h.baseInterval / (h.buffs.aspd.t > 0 ? h.buffs.aspd.m : 1) : u.interval
    // Every third basic attack in a row is a heavy blow.
    if (h) { h.chain = this.time - h.chainAt < 2.6 ? h.chain % 3 + 1 : 1; h.chainAt = this.time }
  }
  private land(u: Unit) {
    const target = this.byId(u.swingId)
    if (!target || dist(u, target) > u.range + target.r + u.r + 90) return
    const h = u.kind === 'hero' ? u as Hero : null
    // Third hit of a chain is heavy; a 会心 crit lands the same way.
    const crit = Boolean(h && h.chain !== 3 && this.random() < 0.12 * (h.perks.crit ?? 0))
    const heavy = Boolean(h && (h.chain === 3 || crit))
    let dmg = h ? this.atkNow(h) * (h.chain === 3 ? 1.6 : crit ? 1.8 : 1) : u.atk
    if (u.kind === 'minion') dmg *= target.kind === 'tower' || target.kind === 'base' ? (u.sub === 'siege' ? 2.4 : 0.85) : target.kind === 'hero' ? 0.7 : 1
    if (u.kind === 'tower' || u.kind === 'base') {
      // Towers hit a hero harder with every consecutive shot.
      u.ramp = target.kind === 'hero' && u.targetId === target.id ? Math.min(4, u.ramp + 1) : 0
      dmg *= target.kind === 'hero' ? 1 + 0.4 * u.ramp : 1
    }
    if (u.ranged) {
      this.shots.push({ id: this.id++, team: u.team, ownerId: u.id, x: u.x, y: u.y, dx: 0, dy: 0, speed: u.kind === 'tower' || u.kind === 'base' ? 950 : 1250, targetId: target.id, dmg, width: 0, left: 9999, pierce: false, hit: [], stun: 0, slow: 0, kind: u.kind === 'tower' || u.kind === 'base' ? 'tower' : 'basic', color: h ? h.def.color : u.team === 0 ? '#7fb3d9' : '#d98a7f', heavy })
    } else this.basicHit(u, target, dmg, heavy)
  }
  private basicHit(u: Unit | undefined, target: Unit, dmg: number, heavy = false) {
    this.heavy = heavy
    const dealt = this.damage(target, dmg, u ?? null)
    this.heavy = false
    if (u?.kind === 'hero' && dealt > 0) {
      const h = u as Hero, ls = h.itemLs + (h.buffs.ls.t > 0 ? h.buffs.ls.m : 0)
      if (ls > 0 && h.alive) this.heal(h, dealt * ls * (target.kind === 'hero' ? 1 : 0.5))
    }
    this.events.push({ type: 'hit', x: target.x, y: target.y, big: heavy, color: u?.kind === 'hero' ? (u as Hero).def.color : '#ffe9c4' })
  }

  // ---------- skills ----------
  /** aim: a direction for 'dir' skills, a world point for 'point' skills; omitted = auto-aim. */
  cast(h: Hero, slot: number, aim?: Vec): boolean {
    if (!this.skillReady(h, slot) || h.stun > 0 || h.dash || this.winner !== null) return false
    const skill = h.def.skills[slot]
    let dx = Math.sin(h.heading), dy = Math.cos(h.heading), point = { x: h.x, y: h.y }
    if (skill.aim !== 'self') {
      // No aim given = a quick tap: fire at the best enemy, as the genre does.
      aim ??= this.autoAim(h, slot) ?? (skill.aim === 'dir' ? { x: dx, y: dy } : { x: h.x + dx * skill.range * 0.7, y: h.y + dy * skill.range * 0.7 })
      if (skill.aim === 'dir') { const len = Math.hypot(aim.x, aim.y) || 1; dx = aim.x / len; dy = aim.y / len }
      else {
        const len = dist(aim, h), reach = Math.min(len, skill.range)
        if (len > 0.01) { dx = (aim.x - h.x) / len; dy = (aim.y - h.y) / len }
        point = { x: clamp(h.x + dx * reach, 60, MAP - 60), y: clamp(h.y + dy * reach, 60, MAP - 60) }
      }
      h.heading = Math.atan2(dx, dy)
    }
    const rank = h.ranks[slot]
    h.cds[slot] = skill.cd * rankScale(rank).cd * (1 - h.cdr); h.castSeq++; h.castSlot = slot; h.recallT = 0; h.windup = 0
    this.events.push({ type: 'cast', id: h.id, slot, mine: h === this.player, x: h.x, y: h.y, color: h.def.color })
    for (const fx of tuneSkill(skill, rank)) this.apply(h, fx, dx, dy, point)
    return true
  }
  private apply(h: Hero, fx: Effect, dx: number, dy: number, point: Vec) {
    const color = h.def.color
    if (fx.t === 'dash') h.dash = { dx, dy, left: fx.dist, dmg: fx.dmg ? this.skillDamage(h, fx.dmg) : 0, width: fx.width ?? 0, stun: fx.stun ?? 0, slow: fx.slow ?? 0, hit: [] }
    else if (fx.t === 'shot') {
      const count = fx.count ?? 1
      for (let i = 0; i < count; i++) {
        const a = Math.atan2(dx, dy) + (i - (count - 1) / 2) * (fx.spread ?? 0)
        this.shots.push({ id: this.id++, team: h.team, ownerId: h.id, x: h.x, y: h.y, dx: Math.sin(a), dy: Math.cos(a), speed: fx.speed, targetId: 0, dmg: this.skillDamage(h, fx.dmg), width: fx.width, left: fx.range, pierce: Boolean(fx.pierce), hit: [], stun: fx.stun ?? 0, slow: fx.slow ?? 0, kind: 'skill', color })
      }
    } else if (fx.t === 'cone') {
      const dmg = this.skillDamage(h, fx.dmg), cos = Math.cos(fx.arc / 2)
      for (const u of this.around(h, fx.radius, u => this.hostile(h, u) && u.kind !== 'tower' && u.kind !== 'base')) {
        const d = dist(u, h) || 1
        if (d > u.r + 40 && ((u.x - h.x) * dx + (u.y - h.y) * dy) / d < cos) continue
        this.affect(h, u, dmg, fx.stun ?? 0, fx.slow ?? 0)
      }
      this.events.push({ type: 'cone', x: h.x, y: h.y, dx, dy, radius: fx.radius, arc: fx.arc, color })
    } else if (fx.t === 'blast' || fx.t === 'zone') {
      const at = h.def.skills[h.castSlot].aim === 'point' ? point : { x: h.x, y: h.y }
      const zone = fx.t === 'zone'
      this.zones.push({ id: this.id++, team: h.team, ownerId: h.id, ...at, r: fx.radius, delay: zone ? 0.25 : fx.delay, wait: zone ? 0.25 : fx.delay, left: zone ? fx.duration : 0, tick: 0, dmg: this.skillDamage(h, fx.dmg), stun: zone ? 0 : fx.stun ?? 0, slow: fx.slow ?? 0, color })
    } else if (fx.t === 'blink') { h.x = point.x; h.y = point.y; this.unstick(h) }
    else if (fx.t === 'buff') {
      const targets = fx.allies ? this.heroes.filter(a => a.alive && a.team === h.team && dist(a, h) <= fx.allies!) : [h]
      for (const a of targets) {
        if (fx.atk) a.buffs.atk = { m: fx.atk, t: fx.dur }
        if (fx.speed) a.buffs.speed = { m: fx.speed, t: fx.dur }
        if (fx.aspd) a.buffs.aspd = { m: fx.aspd, t: fx.dur }
        if (fx.lifesteal) a.buffs.ls = { m: fx.lifesteal, t: fx.dur }
        if (fx.shield) { a.shield = Math.max(a.shield, this.skillDamage(h, fx.shield)); a.shieldT = fx.dur }
        if (fx.heal) this.heal(a, this.skillDamage(h, fx.heal))
      }
    }
  }
  private affect(h: Unit | undefined, u: Unit, dmg: number, stun: number, slow: number) {
    if (dmg > 0) this.damage(u, dmg, h ?? null)
    if (!u.alive) return
    if (stun > 0) { u.stun = Math.max(u.stun, stun); u.windup = 0; if (u.kind === 'hero') (u as Hero).recallT = 0 }
    if (slow > 0) u.slowT = Math.max(u.slowT, slow)
    this.events.push({ type: 'hit', x: u.x, y: u.y, big: true, color: h?.kind === 'hero' ? (h as Hero).def.color : '#ffd9a0' })
  }

  // ---------- player commands ----------
  recall(h: Hero = this.player) { if (h.alive && !h.dash && h.stun <= 0 && h.recallT <= 0) h.recallT = 3.5 }
  useHeal(h: Hero = this.player) {
    if (!h.alive || h.healCd > 0) return false
    h.healCd = 60
    for (const a of this.heroes) if (a.alive && a.team === h.team && dist(a, h) < 500) this.heal(a, a.maxHp * (a === h ? 0.22 : 0.1))
    return true
  }
  /** 闪现：瞬移一小段。dir 省略时朝当前朝向。 */
  flash(h: Hero = this.player, dir?: Vec) {
    if (!h.alive || h.flashCd > 0 || h.stun > 0 || this.winner !== null) return false
    const len = dir ? Math.hypot(dir.x, dir.y) : 0
    const dx = len > 0.01 ? dir!.x / len : Math.sin(h.heading), dy = len > 0.01 ? dir!.y / len : Math.cos(h.heading)
    const from = { x: h.x, y: h.y }
    // Blink may cross obstacles, but must land in free space, including when aimed
    // exactly at a tree / tower centre. Shorten the jump if the endpoint is blocked.
    const obstacles = [...TREES, ...this.units.filter(u => u.alive && (u.kind === 'tower' || u.kind === 'base'))]
    let landing: Vec | undefined
    for (let reach = 330; reach >= 10; reach -= 10) {
      const p = { x: clamp(from.x + dx * reach, 60, MAP - 60), y: clamp(from.y + dy * reach, 60, MAP - 60) }
      if (dist(p, from) > 1 && obstacles.every(o => dist(p, o) >= o.r + h.r)) { landing = p; break }
    }
    if (!landing) return false
    h.x = landing.x; h.y = landing.y
    h.windup = 0; h.swingId = 0
    h.flashCd = 75; h.recallT = 0; h.dash = null; h.heading = Math.atan2(dx, dy)
    this.events.push({ type: 'flash', x: from.x, y: from.y, tx: h.x, ty: h.y, color: h.def.color })
    return true
  }
  /** Take one of the three offered cards. */
  pick(index: number, h: Hero = this.player) {
    const card = h.offer?.[index]
    if (!card) return false
    h.offer = null; h.picks = Math.max(0, h.picks - 1)
    this.grant(h, card)
    return true
  }
  private grant(h: Hero, card: Card) {
    let awake = false
    if (card.kind === 'skill') { h.ranks[card.slot] = Math.min(SKILL_RANKS, h.ranks[card.slot] + 1); awake = h.ranks[card.slot] >= SKILL_RANKS }
    else if (card.kind === 'auto') { const owned = h.autos.find(a => a.id === card.id); if (owned) owned.rank++; else h.autos.push({ id: card.id, rank: 1, t: 1.2 }) }
    else { h.perks[card.id] = (h.perks[card.id] ?? 0) + 1; this.refresh(h) }
    this.events.push({ type: 'grow', id: h.id, mine: h === this.player, card, awake })
  }
  private offerFor(h: Hero) { return drawOffer({ ranks: h.ranks, autos: h.autos, perks: h.perks }, h.level >= ULT_LEVEL, () => this.random()) }
  /** AI draft: usually the first (strongest-weighted) card, sometimes another, rarely a perk over power. */
  private aiPick(h: Hero) {
    while (h.picks > 0) {
      const offer = this.offerFor(h)
      if (!offer.length) { h.picks = 0; break }
      const roll = this.random(), index = roll < 0.6 ? 0 : roll < 0.85 ? Math.min(1, offer.length - 1) : offer.length - 1
      h.offer = offer; this.pick(index, h)
    }
  }
  buy(h: Hero, id: string) {
    const item = itemById(id)
    if (!item || h.items.includes(id) || h.items.length >= MAX_ITEMS || h.gold < item.cost) return false
    h.gold -= item.cost; h.items.push(id); this.refresh(h)
    return true
  }
  // ---------- targeting (the player's attack button and quick-cast skills) ----------
  /** An enemy hero is a safe auto-target unless it stands under an enemy tower out of our reach. */
  private safeHero(h: Hero, u: Unit) {
    if (dist(u, h) <= h.range + u.r + h.r) return true
    return !this.units.some(t => t.alive && (t.kind === 'tower' || t.kind === 'base') && t.team !== h.team && dist(t, u) < t.range && !this.covered(t))
  }
  /** Best enemy within radius: heroes first (weakest and closest), else the nearest minion or beast. */
  bestTarget(h: Hero, radius: number, heroesOnly = false): Unit | undefined {
    const score = (u: Unit) => dist(u, h) / radius + 0.9 * u.hp / u.maxHp
    const heroes = this.around(h, radius, u => this.hostile(h, u) && u.kind === 'hero' && this.safeHero(h, u))
    if (heroes.length) return heroes.sort((a, b) => score(a) - score(b))[0]
    return heroesOnly ? undefined : this.nearest(h, radius, u => this.hostile(h, u) && (u.kind === 'minion' || u.kind === 'monster'))
  }
  /** Where a quick-cast skill should go: at the best target, leading it if it is moving. */
  autoAim(h: Hero, slot: number): Vec | undefined {
    const skill = h.def.skills[slot]
    if (skill.aim === 'self') return undefined
    const target = this.bestTarget(h, skill.range * 1.25)
    if (!target) return undefined
    const lead = skill.fx[0]
    const t = lead.t === 'shot' ? dist(target, h) / lead.speed : lead.t === 'blast' ? lead.delay * 0.8 : lead.t === 'zone' ? 0.3 : 0
    const v = target.kind === 'hero' ? target as Hero : undefined
    const at = { x: target.x + (v?.vx ?? 0) * t, y: target.y + (v?.vy ?? 0) * t }
    return skill.aim === 'dir' ? { x: at.x - h.x, y: at.y - h.y } : at
  }
  /** What the attack button would lock onto right now, without committing to it. */
  lockCandidate(h: Hero = this.player): Unit | undefined { return this.chooseTarget(h, false) }
  private chooseTarget(h: Hero, commit: boolean): Unit | undefined {
    const reach = h.range + 320, heroReach = h.range + 300, prefer = this.input.prefer
    const ok = (u: Unit) => this.hostile(h, u) && (u.kind !== 'base' || this.baseOpen(u.team as Team))
    const structure = (u: Unit) => u.kind === 'tower' || u.kind === 'base'
    const sticky = this.byId(this.stickyTarget)
    let pick: Unit | undefined
    if (sticky && ok(sticky) && dist(sticky, h) < reach + sticky.r && prefer === 'auto') {
      // Keep the lock, except that a hero stepping into reach outranks a minion.
      pick = sticky.kind === 'hero' ? sticky : this.bestTarget(h, heroReach, true) ?? sticky
    } else {
      if (prefer === 'tower') pick = this.nearest(h, reach, u => ok(u) && structure(u))
      if (prefer === 'minion') pick = this.nearest(h, reach, u => ok(u) && (u.kind === 'minion' || u.kind === 'monster'))
      pick ??= this.bestTarget(h, heroReach, true)
      pick ??= this.nearest(h, reach, u => ok(u) && (!structure(u) || this.covered(u)))
    }
    if (commit) this.stickyTarget = pick?.id ?? 0
    return pick
  }
  private playerTarget(h: Hero) { return this.chooseTarget(h, true) }
  private control(h: Hero, dt: number) {
    const { mx, my, attack } = this.input, len = Math.hypot(mx, my)
    if (len > 0.12) {
      h.recallT = 0; h.windup = 0; this.stickyTarget = 0
      this.move(h, mx, my, dt, Math.min(1, len))
      return
    }
    if (!attack && !this.stickyTarget) {
      // Standing still, the hero fights whatever is already in reach — but never picks a fight
      // with a hero under an enemy tower, and never opens on a structure that has no wave on it.
      if (h.recallT > 0) return
      const underFire = this.units.some(u => u.alive && (u.kind === 'tower' || u.kind === 'base') && u.team !== h.team && dist(u, h) < u.range + h.r)
      const fair = (u: Unit) => this.hostile(h, u) && (u.kind === 'minion' || (u.kind === 'monster' && u.targetId === h.id) || (u.kind === 'hero' && !underFire && this.safeHero(h, u)) || ((u.kind === 'tower' || (u.kind === 'base' && this.baseOpen(u.team as Team))) && this.covered(u)))
      const idle = this.nearest(h, h.range + h.r, fair) ?? this.nearest(h, h.range + h.r + 110, u => fair(u) && u.kind !== 'tower' && u.kind !== 'base')
      if (!idle) return
      // A short step in, so a target just out of reach is not ignored.
      if (dist(h, idle) <= h.range + idle.r + h.r) this.strike(h, idle)
      else if (h.windup <= 0) this.toward(h, idle, dt)
      return
    }
    const target = this.playerTarget(h)
    if (!target) return
    h.recallT = 0
    if (dist(h, target) <= h.range + target.r + h.r) this.strike(h, target)
    else if (h.windup <= 0) this.toward(h, target, dt)
  }

  // ---------- hero AI ----------
  private power(h: Hero) { return h.hp / h.maxHp * (0.6 + 0.08 * h.level) }
  private think(h: Hero) {
    const ai = h.ai, hp = h.hp / h.maxHp, red = h.team === 1 && !this.allAi
    const nerve = red ? this.difficulty.nerve : 1
    ai.moveTo = null; ai.attackId = 0
    const item = this.nextItem(h)
    if (item && h.gold >= item.cost) this.buy(h, item.id)
    const foes = this.heroes.filter(f => f.alive && f.team !== h.team && dist(f, h) < 780)
    const friends = this.heroes.filter(f => f.alive && f.team === h.team && f !== h && dist(f, h) < 700)
    const fountain = FOUNTAIN[h.team], home = dist(h, fountain)
    // Flexible heroes reinforce whichever lane is short-handed.
    if (ai.flex && (ai.laneCheck -= 0.2) <= 0) {
      ai.laneCheck = 14
      const need = (lane: LaneId) => this.heroes.filter(f => f.alive && f.team !== h.team && nearestLane(f) === lane).length - this.heroes.filter(f => f.alive && f.team === h.team && f !== h && nearestLane(f) === lane).length
      ai.lane = LANE_IDS.reduce((a, b) => need(b) > need(a) ? b : a, ai.lane)
    }
    // Survival first.
    if (ai.mode === 'retreat') { if (hp > 0.82) ai.mode = 'lane' }
    else if (hp < 0.3 || (hp < 0.5 && foes.length > friends.length + 1)) ai.mode = 'retreat'
    if (ai.mode !== 'retreat' && this.time - this.baseHitAt[h.team] < 4 && dist(h, BASE[h.team]) > 900) ai.mode = 'defend'
    else if (ai.mode === 'defend') ai.mode = 'lane'
    if (ai.mode === 'retreat') {
      if (hp < 0.4 && h.healCd <= 0) this.useHeal(h)
      if (hp < 0.3 && h.flashCd <= 0 && foes.some(f => dist(f, h) < 380)) this.flash(h, { x: fountain.x - h.x, y: fountain.y - h.y })
      this.aiSkills(h, foes.slice().sort((a, b) => dist(a, h) - dist(b, h))[0], false)
      if (home < 260) return
      const safe = !this.heroes.some(f => f.alive && f.team !== h.team && dist(f, h) < 950) && this.time - h.damagedAt > 2
      if (safe && home > 1300) { this.recall(h); return }
      ai.moveTo = fountain; return
    }
    if (ai.mode === 'defend') {
      const intruder = this.nearest(BASE[h.team], 800, u => this.hostile(h, u) && u.kind !== 'monster')
      if (dist(h, BASE[h.team]) > 1700 && !foes.length) { this.recall(h); return }
      if (intruder && dist(intruder, h) < 700) ai.attackId = intruder.id
      else ai.moveTo = BASE[h.team]
      return
    }
    // Never stand under a tower that has nothing else to shoot.
    const tower = this.nearest(h, TOWER_RANGE + 90, u => (u.kind === 'tower' || u.kind === 'base') && this.hostile(h, u))
    const exposed = tower && dist(tower, h) < tower.range + h.r + 50 && (!this.covered(tower) || (tower.targetId === h.id && hp < 0.6))
    const weak = foes.slice().sort((a, b) => a.hp - b.hp)[0]
    if (exposed && !(weak && weak.hp / weak.maxHp < 0.22 && hp > 0.55)) { ai.backoff = 1.2 }
    if (ai.backoff > 0) {
      ai.backoff -= 0.2
      const s = laneProgress(ai.lane, h) + (h.team === 0 ? -500 : 500)
      ai.moveTo = lanePoint(ai.lane, s)
      this.aiSkills(h, weak, false)
      return
    }
    // Fight when the numbers say so.
    if (weak) {
      const side = (team: Team) => this.heroes.filter(f => f.alive && f.team === team && dist(f, weak) < 650).reduce((sum, f) => sum + this.power(f), 0)
      const under = this.units.some(u => u.alive && (u.kind === 'tower' || u.kind === 'base') && u.team === weak.team && dist(u, weak) < u.range)
      const mine = side(h.team) + (dist(h, weak) >= 650 ? this.power(h) : 0), theirs = side(weak.team) + (under ? 1.1 : 0)
      const finish = weak.hp / weak.maxHp < 0.25 && hp > 0.4 && !under
      if (mine * nerve >= theirs * 0.8 || finish) {
        ai.attackId = weak.id
        this.aiSkills(h, weak, true)
        return
      }
      if (theirs > mine * 1.35 && dist(weak, h) < 520) { ai.backoff = 1; return }
      this.aiSkills(h, weak, false)
    }
    // Otherwise work the lane behind the wave.
    const lane = ai.lane, fwd = h.team === 0 ? 1 : -1, total = laneLength(lane)
    const wave = this.units.filter(u => u.alive && u.kind === 'minion' && u.team === h.team && u.lane === lane).map(u => laneProgress(lane, u))
    const holds = this.units.filter(u => u.alive && u.kind === 'tower' && u.team === h.team && u.lane === lane).map(u => laneProgress(lane, u))
    const front = wave.length ? (fwd > 0 ? Math.max(...wave) : Math.min(...wave)) : holds.length ? (fwd > 0 ? Math.max(...holds) : Math.min(...holds)) : fwd > 0 ? 0 : total
    let want = front - fwd * (h.ranged ? 150 : 20)
    const gate = this.units.filter(u => u.alive && u.kind === 'tower' && u.team !== h.team && u.lane === lane).map(u => laneProgress(lane, u))
    const next = gate.length ? (fwd > 0 ? Math.min(...gate) : Math.max(...gate)) : fwd > 0 ? total + 300 : -300
    const gateUnit = gate.length ? this.units.find(u => u.alive && u.kind === 'tower' && u.team !== h.team && u.lane === lane && Math.abs(laneProgress(lane, u) - next) < 1)! : this.units.find(u => u.kind === 'base' && u.team !== h.team)!
    const open = this.covered(gateUnit)
    if (!open) want = fwd > 0 ? Math.min(want, next - 640) : Math.max(want, next + 640)
    const prey = this.around(h, h.range + 190, u => u.kind === 'minion' && this.hostile(h, u)).sort((a, b) => a.hp - b.hp)[0]
    const poke = weak && dist(weak, h) < h.range + weak.r + 40 && hp > 0.5 ? weak : undefined
    if (prey) ai.attackId = prey.id
    else if (poke) ai.attackId = poke.id
    else if (open && dist(gateUnit, h) < 760 && (gateUnit.kind !== 'base' || this.baseOpen(gateUnit.team as Team))) ai.attackId = gateUnit.id
    else ai.moveTo = lanePoint(lane, clamp(want, 0, total))
    // Spend a basic skill on a clumped wave now and then.
    if (prey && this.random() < 0.12) {
      const slot = [0, 1].find(i => this.skillReady(h, i) && h.def.skills[i].fx.some(f => f.t === 'cone' || f.t === 'shot' || f.t === 'blast' || f.t === 'zone'))
      if (slot !== undefined && this.around(prey, 220, u => u.kind === 'minion' && this.hostile(h, u)).length >= 3 && dist(prey, h) < h.def.skills[slot].range) this.cast(h, slot, h.def.skills[slot].aim === 'dir' ? { x: prey.x - h.x, y: prey.y - h.y } : { x: prey.x, y: prey.y })
    }
  }
  private aiSkills(h: Hero, foe: Hero | undefined, committed: boolean) {
    if (!foe || h.ai.react > 0) return
    const red = h.team === 1 && !this.allAi, d = dist(foe, h)
    for (const slot of [2, 0, 1]) {
      if (!this.skillReady(h, slot)) continue
      const skill = h.def.skills[slot], first = skill.fx[0]
      const moves = skill.fx.some(f => f.t === 'dash' || f.t === 'blink'), harms = skill.fx.some(f => 'dmg' in f && f.dmg)
      // Ultimates are for real fights, but not hoarded: any committed fight where the target is hurt at all, or outnumbers us.
      if (slot === 2 && !(committed && (foe.hp / foe.maxHp < 0.92 || h.hp / h.maxHp < 0.6 || this.heroes.filter(f => f.alive && f.team !== h.team && dist(f, h) < 600).length > 1))) continue
      if (moves && !committed && (harms || !(h.ai.backoff > 0 || h.ai.mode === 'retreat'))) continue // no diving, no idle blinks
      if (moves && !harms && committed && d < h.range) continue // pure mobility is for chasing or fleeing
      if (skill.aim === 'self') {
        const supportive = first.t === 'buff'
        if (supportive ? !(committed || h.hp / h.maxHp < 0.6) : d > skill.range * 0.85) continue
        this.cast(h, slot)
      } else {
        if (d > skill.range * (moves ? 1.3 : 0.95)) continue
        // Lead the target; less accurate when the difficulty says so.
        const lead = first.t === 'shot' ? d / first.speed : first.t === 'blast' ? first.delay * 0.7 : 0
        const miss = (red ? this.difficulty.react : 0.5) * 90
        const at = { x: foe.x + foe.vx * lead + (this.random() - 0.5) * miss, y: foe.y + foe.vy * lead + (this.random() - 0.5) * miss }
        const away = moves && !committed ? { x: h.x * 2 - at.x, y: h.y * 2 - at.y } : at
        this.cast(h, slot, skill.aim === 'dir' ? { x: away.x - h.x, y: away.y - h.y } : away)
      }
      h.ai.react = (red ? this.difficulty.react : 0.5) * (0.6 + this.random() * 0.8)
      return
    }
  }
  private drive(h: Hero, dt: number) {
    const ai = h.ai
    ai.react = Math.max(0, ai.react - dt)
    if ((ai.think -= dt) <= 0) { ai.think = 0.2; if (h.recallT <= 0) this.think(h) }
    if (h.recallT > 0) return
    const target = this.byId(ai.attackId)
    if (target) {
      const d = dist(h, target), reach = h.range + target.r + h.r
      if (d <= reach) {
        this.strike(h, target)
        // Ranged heroes give ground to anything that closes on them.
        if (h.ranged && h.windup <= 0 && h.cd > 0.25 && target.kind === 'hero' && d < h.range * 0.55) this.move(h, h.x - target.x, h.y - target.y, dt)
      } else if (h.windup <= 0) this.toward(h, target, dt)
    } else if (ai.moveTo && h.windup <= 0) this.toward(h, ai.moveTo, dt, 14)
  }

  // ---------- 自动武学 ----------
  private autoPower(h: Hero, rank: number) { return (0.3 * this.atkNow(h) + 12 * h.level) * [0, 1, 1.5, 2.1][rank] }
  private runAutos(h: Hero, dt: number) {
    const foes = (r: number, at: Vec = h) => this.around(at, r, u => this.hostile(h, u) && u.kind !== 'tower' && u.kind !== 'base')
    const pickTarget = (r: number) => this.nearest(h, r, u => this.hostile(h, u) && u.kind === 'hero') ?? this.nearest(h, r, u => this.hostile(h, u) && (u.kind === 'minion' || (u.kind === 'monster' && u.targetId !== 0)))
    for (const a of h.autos) {
      const p = this.autoPower(h, a.rank), color = { orbit: '#9fe3ff', bolt: '#c9b4ff', rain: '#ffd38a', aura: '#ff8a4a', frost: '#bfe8ff', drum: '#ffe07a', summon: '#8fd08a', ward: '#d8f0ff' }[a.id]
      if (a.id === 'orbit') {
        h.orbit += dt * (a.rank >= 3 ? 4.4 : 3.3)
        const blades = a.rank + 1
        for (let i = 0; i < blades; i++) {
          const ang = h.orbit + i / blades * Math.PI * 2, at = { x: h.x + Math.cos(ang) * 150, y: h.y + Math.sin(ang) * 150 }
          for (const u of foes(42, at)) {
            if (this.time - (h.orbitHits.get(u.id) ?? -9) < 0.6) continue
            h.orbitHits.set(u.id, this.time); this.damage(u, p * 0.55, h)
            this.events.push({ type: 'hit', x: u.x, y: u.y, big: false, color })
          }
        }
        continue
      }
      if ((a.t -= dt) > 0) continue
      if (a.id === 'aura') { a.t = 0.5; for (const u of foes(150 + 28 * a.rank)) this.damage(u, p * 0.3, h); continue }
      if (a.id === 'bolt') {
        a.t = [0, 3, 2.6, 2.2][a.rank]
        const first = pickTarget(620)
        if (!first) { a.t = 0.4; continue }
        const struck = [first]
        if (a.rank >= 3) for (let n = 0; n < 2; n++) { const last = struck[struck.length - 1], next = this.nearest(last, 320, u => this.hostile(h, u) && u.kind !== 'tower' && u.kind !== 'base' && !struck.includes(u)); if (next) struck.push(next) }
        let from: Vec = h
        for (const u of struck) { this.events.push({ type: 'zap', x: from.x, y: from.y, tx: u.x, ty: u.y, color }); this.affect(h, u, p * 1.5, 0, 0); from = u }
      } else if (a.id === 'rain') {
        a.t = [0, 6, 5.5, 4.6][a.rank]
        const target = pickTarget(700)
        if (!target) { a.t = 0.5; continue }
        this.zones.push({ id: this.id++, team: h.team, ownerId: h.id, x: target.x, y: target.y, r: 150 + 22 * a.rank, delay: 0.6, wait: 0.6, left: 0, tick: 0, dmg: p * 1.7, stun: 0, slow: a.rank >= 3 ? 1.5 : 0, color })
      } else if (a.id === 'frost') {
        a.t = 5
        const r = 240 + 30 * a.rank, hit = foes(r)
        if (!hit.length) { a.t = 0.5; continue }
        for (const u of hit) this.affect(h, u, p, a.rank >= 3 ? 0.5 : 0, 1.2)
        this.events.push({ type: 'nova', x: h.x, y: h.y, r, color })
      } else if (a.id === 'drum') {
        a.t = 9
        for (const ally of this.heroes) if (ally.alive && ally.team === h.team && dist(ally, h) < 600) {
          ally.buffs.aspd = { m: 1.15 + 0.1 * a.rank, t: 4 }
          if (a.rank >= 3) ally.buffs.speed = { m: 1.15, t: 4 }
        }
        this.events.push({ type: 'drum', x: h.x, y: h.y })
      } else if (a.id === 'summon') {
        a.t = [0, 20, 17, 14][a.rank]
        const lane = nearestLane(h), boost = (1 + 0.07 * this.time / 60) * (a.rank >= 2 ? 1.3 : 1)
        for (let i = 0; i < (a.rank >= 3 ? 3 : 2); i++) {
          const at = { x: clamp(h.x + (i - 1) * 46, 60, MAP - 60), y: clamp(h.y + 40, 60, MAP - 60) }
          this.units.push(this.unit({ team: h.team, kind: 'minion', sub: 'melee', ...at, r: 22, hp: 600 * boost, atk: 44 * boost, armor: 10, range: 70, interval: 1.1, speed: 250, ranged: false, lane, wp: this.waypointAhead(lane, h.team, h) }))
        }
        this.events.push({ type: 'summon', x: h.x, y: h.y, color })
      } else if (a.id === 'ward') {
        a.t = [0, 12, 10, 8][a.rank]
        h.shield = Math.max(h.shield, h.maxHp * [0, 0.12, 0.16, 0.22][a.rank]); h.shieldT = 4
      }
    }
  }
  /** Index of the next lane waypoint a minion of this team should walk to from p. */
  private waypointAhead(lane: LaneId, team: Team, p: Vec) {
    const path = team === 0 ? LANES[lane] : [...LANES[lane]].reverse()
    let walked = 0, best = 0, bestD = Infinity
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1], len = dist(a, b), t = clamp(((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (len * len), 0, 1)
      const d = Math.hypot(p.x - a.x - (b.x - a.x) * t, p.y - a.y - (b.y - a.y) * t)
      if (d < bestD) { bestD = d; best = i + 1 }
      walked += len
    }
    return Math.min(best, path.length - 1)
  }

  // ---------- per-kind updates ----------
  private updateHero(h: Hero, dt: number) {
    const px = h.x, py = h.y
    for (let i = 0; i < 3; i++) h.cds[i] = Math.max(0, h.cds[i] - dt)
    h.healCd = Math.max(0, h.healCd - dt); h.flashCd = Math.max(0, h.flashCd - dt)
    for (const b of Object.values(h.buffs)) b.t = Math.max(0, b.t - dt)
    if (!h.alive) {
      if (this.time >= h.respawnAt) { h.alive = true; h.hp = h.maxHp; h.x = FOUNTAIN[h.team].x; h.y = FOUNTAIN[h.team].y; h.stun = h.slowT = h.shield = 0; h.ai.mode = 'lane'; h.ai.backoff = 0 }
      h.vx = h.vy = 0; return
    }
    h.gold += 3 * dt; h.earned += 3 * dt; h.xp += 4 * dt
    if (h.picks > 0) { if (h.isPlayer && !this.autopilot) h.offer ??= this.offerFor(h); else this.aiPick(h) }
    if (h.stun <= 0 && this.winner === null) this.runAutos(h, dt)
    if (h.level < MAX_LEVEL && h.xp >= xpNeed(h.level)) this.pay(h, 0, 0)
    h.moving = false
    if (h.dash) {
      const step = Math.min(h.dash.left, 1250 * dt)
      h.x = clamp(h.x + h.dash.dx * step, 50, MAP - 50); h.y = clamp(h.y + h.dash.dy * step, 50, MAP - 50); h.dash.left -= step; h.moving = true
      if (h.dash.dmg > 0 || h.dash.stun > 0 || h.dash.slow > 0) for (const u of this.around(h, h.dash.width, u => this.hostile(h, u) && u.kind !== 'tower' && u.kind !== 'base' && !h.dash!.hit.includes(u.id))) { h.dash.hit.push(u.id); this.affect(h, u, h.dash.dmg, h.dash.stun, h.dash.slow) }
      if (h.dash.left <= 0) { h.dash = null; this.unstick(h) }
    } else if (h.stun <= 0) {
      if (h.isPlayer && !this.autopilot) this.control(h, dt)
      else this.drive(h, dt)
    }
    if (h.recallT > 0 && (h.recallT -= dt) <= 0) { h.x = FOUNTAIN[h.team].x; h.y = FOUNTAIN[h.team].y; h.recallT = 0 }
    // Fountain: fast healing at home, and a hard no for visitors.
    const home = dist(h, FOUNTAIN[h.team])
    if (home < 340) this.heal(h, h.maxHp * 0.14 * dt)
    else if (this.time - h.damagedAt > 5) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.012 * dt)
    if (dist(h, FOUNTAIN[h.team === 0 ? 1 : 0]) < 400) this.damage(h, 700 * dt, null, true)
    h.vx = (h.x - px) / dt; h.vy = (h.y - py) / dt
  }
  private updateMinion(u: Unit, dt: number) {
    u.moving = false
    if (u.stun > 0) return
    u.forcedT = Math.max(0, u.forcedT - dt)
    let target = this.byId(u.targetId)
    if (target && (dist(target, u) > 560 || !this.hostile(u, target))) target = undefined
    if ((u.think -= dt) <= 0 && u.forcedT <= 0) {
      u.think = 0.3
      const ok = (t: Unit) => this.hostile(u, t) && t.kind !== 'monster' && (t.kind !== 'base' || this.baseOpen(t.team as Team))
      const siege = u.sub === 'siege' ? this.nearest(u, u.range + 60, t => ok(t) && (t.kind === 'tower' || t.kind === 'base')) : undefined
      target = siege ?? this.nearest(u, 400, ok)
    }
    u.targetId = target?.id ?? 0
    if (target) {
      if (dist(u, target) <= u.range + target.r + u.r) this.strike(u, target)
      else if (u.windup <= 0) this.toward(u, target, dt)
      return
    }
    const path = LANES[u.lane!], goal = u.team === 0 ? (u.wp < path.length ? path[u.wp] : BASE[1]) : (u.wp < path.length ? path[path.length - 1 - u.wp] : BASE[0])
    if (dist(u, goal) < 70 && u.wp < path.length) u.wp++
    else this.toward(u, goal, dt)
  }
  private updateStructure(u: Unit) {
    let target = this.byId(u.targetId)
    if (target && (dist(target, u) > u.range + target.r || !this.hostile(u, target))) target = undefined
    if (!target) {
      const ok = (t: Unit) => this.hostile(u, t) && t.kind !== 'monster'
      target = this.nearest(u, u.range, t => ok(t) && t.kind === 'minion') ?? this.nearest(u, u.range, ok)
      if (target?.id !== u.targetId) u.ramp = 0
    }
    u.targetId = target?.id ?? 0
    if (target) this.strike(u, target)
  }
  private updateMonster(u: Unit, dt: number) {
    u.moving = false
    if (!u.alive) {
      if (u.respawnAt && this.time >= u.respawnAt) { u.alive = true; u.hp = u.maxHp = u.maxHp * 1.12; u.atk *= 1.08; u.x = u.home!.x; u.y = u.home!.y; u.targetId = 0 }
      return
    }
    if (u.stun > 0) return
    const target = this.byId(u.targetId)
    if (target && dist(u, u.home!) < 380 && dist(target, u.home!) < 520) {
      if (dist(u, target) <= u.range + target.r + u.r) this.strike(u, target)
      else if (u.windup <= 0) this.toward(u, target, dt)
    } else {
      u.targetId = 0
      if (this.toward(u, u.home!, dt, 8)) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.25 * dt)
    }
  }
  private spawnWave() {
    this.wave++
    // Waves keep growing, and faster after eight minutes, so a late game cannot stall forever.
    const minutes = this.time / 60, grow = 1 + 0.07 * minutes + Math.max(0, minutes - 8) * 0.12
    for (const lane of LANE_IDS) for (const team of [0, 1] as Team[]) {
      const path = LANES[lane], start = team === 0 ? path[0] : path[path.length - 1]
      // Losing both towers in a lane lets the enemy's wave there march in reinforced.
      const breached = !this.units.some(u => u.kind === 'tower' && u.team !== team && u.lane === lane && u.alive)
      const boost = (breached ? 1.6 : 1) * (this.bossBuff[team] > 0 ? 1.25 : 1) * grow
      const kinds = ['melee', 'melee', 'melee', 'ranged', ...(this.time > 360 ? ['melee'] : []), ...(this.wave % 2 === 0 ? ['siege'] : [])]
      kinds.forEach((sub, i) => {
        const melee = sub === 'melee', siege = sub === 'siege'
        this.units.push(this.unit({ team, kind: 'minion', sub, x: start.x + (i % 3 - 1) * 38 + (team === 0 ? -1 : 1) * Math.floor(i / 3) * 40, y: start.y + (i % 2) * 34 + (team === 0 ? 1 : -1) * Math.floor(i / 3) * 40, r: siege ? 30 : 20, hp: (siege ? 950 : melee ? 540 : 340) * boost, atk: (siege ? 70 : melee ? 36 : 48) * boost, armor: siege ? 20 : 0, range: siege ? 420 : melee ? 70 : 380, interval: siege ? 1.6 : 1.15, speed: 230, ranged: !melee, lane, wp: 1 }))
      })
    }
  }

  // ---------- step ----------
  step(dt: number) {
    if (this.winner !== null) return
    this.time += dt
    if (this.time >= this.nextWave) { this.nextWave += 22; this.spawnWave() }
    if (this.bossAt && this.time >= this.bossAt) { this.bossAt = 0; this.units.push(this.monster(BOSS_PIT, 'boss')); this.events.push({ type: 'bossSpawn' }) }
    for (const team of [0, 1] as const) this.bossBuff[team] = Math.max(0, this.bossBuff[team] - dt)
    for (const u of this.units) {
      u.flash = Math.max(0, u.flash - dt); u.cd = Math.max(0, u.cd - dt)
      if (u.alive) {
        u.stun = Math.max(0, u.stun - dt); u.slowT = Math.max(0, u.slowT - dt)
        if (u.shieldT > 0 && (u.shieldT -= dt) <= 0) u.shield = 0
        if (u.windup > 0 && (u.windup -= dt) <= 0 && u.stun <= 0) this.land(u)
      }
      if (u.kind === 'hero') this.updateHero(u as Hero, dt)
      else if (!u.alive) { if (u.kind === 'monster') this.updateMonster(u, dt) }
      else if (u.kind === 'minion') this.updateMinion(u, dt)
      else if (u.kind === 'monster') this.updateMonster(u, dt)
      else this.updateStructure(u)
    }
    // Minions jostle rather than stack on one spot.
    const minions = this.units.filter(u => u.alive && u.kind === 'minion')
    for (let i = 0; i < minions.length; i++) for (let j = i + 1; j < minions.length; j++) {
      const a = minions[i], b = minions[j], d = dist(a, b), min = a.r + b.r
      if (d < min && d > 0.01) { const push = (min - d) / 2, nx = (a.x - b.x) / d, ny = (a.y - b.y) / d; a.x += nx * push; a.y += ny * push; b.x -= nx * push; b.y -= ny * push }
    }
    this.updateShots(dt); this.updateZones(dt)
    this.units = this.units.filter(u => u.alive || u.kind !== 'minion')
  }
  private updateShots(dt: number) {
    for (const s of this.shots) {
      const owner = this.units.find(u => u.id === s.ownerId)
      if (s.targetId) {
        const target = this.byId(s.targetId)
        if (!target) { s.left = 0; continue }
        const d = dist(s, target), step = s.speed * dt
        if (d <= step + target.r * 0.5) { s.left = 0; if (s.kind === 'tower') { this.damage(target, s.dmg, owner ?? null); this.events.push({ type: 'hit', x: target.x, y: target.y, big: true, color: '#ffd9a0' }) } else this.basicHit(owner, target, s.dmg, Boolean(s.heavy)); continue }
        s.dx = (target.x - s.x) / d; s.dy = (target.y - s.y) / d; s.x += s.dx * step; s.y += s.dy * step
      } else {
        const step = s.speed * dt
        s.x += s.dx * step; s.y += s.dy * step; s.left -= step
        for (const u of this.units) {
          if (!u.alive || u.team === s.team || u.kind === 'tower' || u.kind === 'base' || s.hit.includes(u.id) || dist(u, s) > s.width / 2 + u.r) continue
          s.hit.push(u.id); this.affect(owner, u, s.dmg, s.stun, s.slow)
          if (!s.pierce) { s.left = 0; break }
        }
        if (s.x < 0 || s.y < 0 || s.x > MAP || s.y > MAP) s.left = 0
      }
    }
    this.shots = this.shots.filter(s => s.left > 0)
  }
  private updateZones(dt: number) {
    for (const z of this.zones) {
      const owner = this.units.find(u => u.id === z.ownerId)
      const victims = () => this.around(z, z.r, u => u.team !== z.team && u.kind !== 'tower' && u.kind !== 'base')
      if (z.wait > 0) {
        if ((z.wait -= dt) > 0) continue
        if (z.left <= 0) { for (const u of victims()) this.affect(owner, u, z.dmg, z.stun, z.slow); z.left = -1; continue }
      }
      z.left -= dt
      if ((z.tick -= dt) <= 0) { z.tick = 0.5; for (const u of victims()) this.affect(owner, u, z.dmg, 0, z.slow) }
      if (z.left <= 0) z.left = -1
    }
    this.zones = this.zones.filter(z => z.left >= 0 || z.wait > 0)
  }
}
