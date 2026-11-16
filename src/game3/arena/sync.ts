import type { ArenaEvent, ArenaSim, Hero, Kind, Shot, Unit, Zone } from './sim'
import type { Card } from './growth'
import { LANE_IDS, type LaneId, type Team } from './data'

// 联机快照。房主的浏览器跑真正的对局，每秒发 20 份快照；好友的浏览器有一份同种子的「镜像」对局，
// 只把快照写进去再交给同一个渲染器画，两次快照之间做插值，看起来仍是 60 帧。
// 不做双端同步模拟（lockstep）：iPhone 与 Mac 的三角函数实现可能有细微差别，两边会慢慢算岔。

const KINDS: Kind[] = ['minion', 'tower', 'base', 'monster']
const round = (v: number) => Math.round(v * 10) / 10
type UnitRow = [id: number, kind: number, team: number, sub: string, x: number, y: number, hp: number, maxHp: number, heading: number, flags: number, target: number, r: number, range: number, lane: number]
type HeroRow = {
  id: number; x: number; y: number; hd: number; hp: number; mx: number; sh: number; al: boolean; lv: number; xp: number; g: number
  k: number; d: number; a: number; cd: number[]; hc: number; fc: number; rc: number; st: number; sl: number; fl: number
  as: number; cs: number; csl: number; ch: number; ds: boolean; ob: number; rk: number[]; au: [string, number][]; pk: Record<string, number>
  pi: number; of?: Card[] | null; it: string[]; bf: number[]; rs: number; mv: boolean; vx: number; vy: number; wu: number; dl: number; sk: number
}
// Heroes travel as plain arrays in this fixed field order; named keys would double the payload.
const HERO_KEYS = ['id', 'x', 'y', 'hd', 'hp', 'mx', 'sh', 'al', 'lv', 'xp', 'g', 'k', 'd', 'a', 'cd', 'hc', 'fc', 'rc', 'st', 'sl', 'fl', 'as', 'cs', 'csl', 'ch', 'ds', 'ob', 'rk', 'au', 'pk', 'pi', 'of', 'it', 'bf', 'rs', 'mv', 'vx', 'vy', 'wu', 'dl', 'sk'] as const
const pack = (row: HeroRow) => HERO_KEYS.map(k => row[k])
const unpack = (values: unknown[]) => Object.fromEntries(HERO_KEYS.map((k, i) => [k, values[i]])) as HeroRow
export type Snapshot = {
  t: number; w: Team | null; kl: [number, number]; bb: [number, number]; sticky: number
  u: UnitRow[]; h: unknown[][]
  s: [number, number, number, number, number, number, string, number, number, number, number][]
  z: [number, number, number, number, number, number, number, number, string][]
  e: ArenaEvent[]
}

/** Host: everything the guest needs to draw this moment, from the guest's own point of view. */
export function encode(sim: ArenaSim, viewer: Hero, events: ArenaEvent[]): Snapshot {
  const units: UnitRow[] = []
  for (const u of sim.units) {
    if (u.kind === 'hero') continue
    const flags = (u.moving ? 1 : 0) | (u.windup > 0 ? 2 : 0) | (u.stun > 0 ? 4 : 0) | (u.slowT > 0 ? 8 : 0) | (u.alive ? 16 : 0)
    units.push([u.id, KINDS.indexOf(u.kind), u.team, u.sub, round(u.x), round(u.y), Math.round(u.hp), Math.round(u.maxHp), round(u.heading), flags, u.targetId, u.r, u.range, u.lane ? LANE_IDS.indexOf(u.lane) : -1])
  }
  const heroes: HeroRow[] = sim.heroes.map(h => ({
    id: h.id, x: round(h.x), y: round(h.y), hd: round(h.heading), hp: Math.round(h.hp), mx: Math.round(h.maxHp), sh: Math.round(h.shield), al: h.alive, lv: h.level, xp: Math.round(h.xp), g: Math.floor(h.gold),
    k: h.k, d: h.d, a: h.a, cd: h.cds.map(round), hc: round(h.healCd), fc: round(h.flashCd), rc: round(h.recallT), st: round(h.stun), sl: round(h.slowT), fl: round(h.flash),
    as: h.attackSeq, cs: h.castSeq, csl: h.castSlot, ch: h.chain, ds: Boolean(h.dash), ob: round(h.orbit), rk: [...h.ranks], au: h.autos.map(a => [a.id, a.rank]), pk: { ...h.perks } as Record<string, number>,
    pi: h.picks, of: h === viewer ? h.offer : null, it: [...h.items], bf: [h.buffs.atk.t, h.buffs.speed.t, h.buffs.aspd.t, h.buffs.ls.t].map(round),
    rs: round(h.respawnAt), mv: h.moving, vx: Math.round(h.vx), vy: Math.round(h.vy), wu: round(h.windup), dl: Math.round(h.dealt), sk: h.streak,
  }))
  return {
    t: round(sim.time), w: sim.winner, kl: [sim.kills[0], sim.kills[1]], bb: [round(sim.bossBuff[0]), round(sim.bossBuff[1])], sticky: sim.seat(viewer).sticky,
    u: units, h: heroes.map(pack),
    s: sim.shots.map(s => [s.id, round(s.x), round(s.y), round(s.dx), round(s.dy), s.team, s.color, s.speed, ['basic', 'tower', 'skill'].indexOf(s.kind), s.width, s.heavy ? 1 : 0]),
    z: sim.zones.map(z => [z.id, round(z.x), round(z.y), z.r, z.delay, round(z.wait), round(z.left), z.team, z.color]),
    e: events,
  }
}

// ---------- guest side ----------
type Smooth = { fx: number; fy: number; tx: number; ty: number; at: number }
const smooth = new WeakMap<object, Smooth>()
let gap = 50 // measured ms between snapshots
let last = 0

/** Guest: write a host snapshot into the mirror match. Returns the events to play. */
export function apply(mirror: ArenaSim, snap: Snapshot, now: number): ArenaEvent[] {
  if (last) gap = gap * 0.8 + Math.min(200, now - last) * 0.2
  last = now
  const move = (o: { x: number; y: number }, x: number, y: number) => {
    const s = smooth.get(o)
    // Recall, respawn, blinks and first sight jump straight there; everything else glides.
    if (!s || Math.hypot(x - o.x, y - o.y) > 300) { o.x = x; o.y = y; smooth.set(o, { fx: x, fy: y, tx: x, ty: y, at: now }); return }
    s.fx = o.x; s.fy = o.y; s.tx = x; s.ty = y; s.at = now
  }
  mirror.time = snap.t; mirror.winner = snap.w; mirror.kills = snap.kl; mirror.bossBuff = snap.bb
  mirror.stickyTarget = snap.sticky
  const byId = new Map(mirror.units.map(u => [u.id, u]))
  const seen = new Set<number>()
  for (const row of snap.u) {
    const [id, kind, team, sub, x, y, hp, maxHp, heading, flags, target, r, range, lane] = row
    seen.add(id)
    let u = byId.get(id)
    if (!u) u = mirror.mirrorUnit({ id, team: team as Team | 2, kind: KINDS[kind], sub, x, y, r, hp, maxHp, range, lane: lane >= 0 ? LANE_IDS[lane] as LaneId : undefined })
    move(u, x, y)
    Object.assign(u, { hp, maxHp, heading, targetId: target, moving: Boolean(flags & 1), windup: flags & 2 ? 0.2 : 0, stun: flags & 4 ? 0.5 : 0, slowT: flags & 8 ? 0.5 : 0, alive: Boolean(flags & 16) })
  }
  mirror.units = mirror.units.filter(u => u.kind === 'hero' || seen.has(u.id))
  for (const values of snap.h) {
    const row = unpack(values)
    const h = mirror.heroes.find(x => x.id === row.id) as Hero | undefined
    if (!h) continue
    move(h, row.x, row.y)
    const b = row.bf
    Object.assign(h, {
      heading: row.hd, hp: row.hp, maxHp: row.mx, shield: row.sh, alive: row.al, level: row.lv, xp: row.xp, gold: row.g, k: row.k, d: row.d, a: row.a,
      cds: row.cd, healCd: row.hc, flashCd: row.fc, recallT: row.rc, stun: row.st, slowT: row.sl, flash: row.fl, attackSeq: row.as, castSeq: row.cs, castSlot: row.csl, chain: row.ch,
      dash: row.ds ? (h.dash ?? { dx: 0, dy: 0, left: 1, dmg: 0, width: 0, stun: 0, slow: 0, hit: [] }) : null, orbit: row.ob, ranks: row.rk, autos: row.au.map(([id, rank]) => ({ id, rank, t: 0 })), perks: row.pk,
      picks: row.pi, items: row.it, respawnAt: row.rs, moving: row.mv, vx: row.vx, vy: row.vy, windup: row.wu, dealt: row.dl, streak: row.sk,
    })
    if (h === mirror.player) h.offer = row.of ?? null
    h.buffs.atk.t = b[0]; h.buffs.speed.t = b[1]; h.buffs.aspd.t = b[2]; h.buffs.ls.t = b[3]
  }
  const oldShots = new Map(mirror.shots.map(s => [s.id, s]))
  mirror.shots = snap.s.map(([id, x, y, dx, dy, team, color, speed, kind, width, heavy]) => {
    const s = oldShots.get(id) ?? ({ id, ownerId: 0, targetId: 0, dmg: 0, left: 1, pierce: false, hit: [], stun: 0, slow: 0 } as unknown as Shot)
    Object.assign(s, { x, y, dx, dy, team, color, speed, kind: (['basic', 'tower', 'skill'] as const)[kind], width, heavy: Boolean(heavy) })
    smooth.set(s, { fx: x, fy: y, tx: x, ty: y, at: now })
    return s
  })
  mirror.zones = snap.z.map(([id, x, y, r, delay, wait, left, team, color]) => ({ id, ownerId: 0, x, y, r, delay, wait, left, tick: 0, dmg: 0, stun: 0, slow: 0, team, color }) as Zone)
  return snap.e
}

/** Guest: place everything between the last two snapshots for this frame. */
export function interpolate(mirror: ArenaSim, now: number) {
  const step = (o: Unit | Shot, s: Smooth | undefined) => {
    if (!s) return
    const k = Math.min(1, (now - s.at) / gap)
    o.x = s.fx + (s.tx - s.fx) * k; o.y = s.fy + (s.ty - s.fy) * k
  }
  for (const u of mirror.units) step(u, smooth.get(u))
  // Projectiles fly on between snapshots instead of hopping.
  for (const s of mirror.shots) { const sm = smooth.get(s); if (sm) { const t = (now - sm.at) / 1000; s.x = sm.tx + s.dx * s.speed * t; s.y = sm.ty + s.dy * s.speed * t } }
}
