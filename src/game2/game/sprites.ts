// Hand-drawn 2D character + environment art (no emoji).
// Everything is canvas paths so it scales crisply and can be tinted per biome.

export type Biome = 'dungeon' | 'forest' | 'snow' | 'volcano'
export type Kind = 'grunt' | 'fast' | 'tank' | 'ranged' | 'boss'

export interface Palette {
  name: string
  floorA: string
  floorB: string
  grout: string
  wall: string
  wallEdge: string
  accent: string
  torch: string
  fog: string
  body: string // base creature color for this biome
  bodyDark: string
}

export const BIOMES: Record<Biome, Palette> = {
  dungeon: {
    name: '地牢',
    floorA: '#2b2f48', floorB: '#252940', grout: '#191c30', wall: '#161829', wallEdge: '#2f3454',
    accent: '#8c9eff', torch: '#ffb347', fog: 'rgba(12,14,28,0.0)', body: '#cfd3e0', bodyDark: '#9aa0b8',
  },
  forest: {
    name: '低语森林',
    floorA: '#2f4a34', floorB: '#28422e', grout: '#1b2e20', wall: '#16281a', wallEdge: '#2f5236',
    accent: '#7be08a', torch: '#ffe066', fog: 'rgba(20,40,24,0.0)', body: '#6fae5c', bodyDark: '#4c7d3e',
  },
  snow: {
    name: '霜咬峰',
    floorA: '#3d4d61', floorB: '#36465b', grout: '#2a3646', wall: '#223042', wallEdge: '#48607c',
    accent: '#9ad4ff', torch: '#bfe3ff', fog: 'rgba(200,225,255,0.05)', body: '#aecfe6', bodyDark: '#7ba5c4',
  },
  volcano: {
    name: '烬渊洞窟',
    floorA: '#3d2626', floorB: '#361f1f', grout: '#241414', wall: '#1e1010', wallEdge: '#5a2a22',
    accent: '#ff7a5c', torch: '#ff922b', fog: 'rgba(60,20,10,0.04)', body: '#b0472f', bodyDark: '#7d2f1f',
  },
}

export const BIOME_ORDER: Biome[] = ['dungeon', 'forest', 'snow', 'volcano']

/** Advance to a new region every 3 stages, looping through the biomes. */
export function biomeForStage(stage: number): Biome {
  const idx = Math.floor((stage - 1) / 3) % BIOME_ORDER.length
  return BIOME_ORDER[idx]
}

// ---- small helpers ----
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// ============================================================
//  HERO — a human knight
// ============================================================
export interface KnightOpts {
  x: number
  y: number
  facing: number
  walkPhase: number
  moving: boolean
  swingT: number
  swingDur: number
  swingAngle: number
  swingDir: number
  aim: number
  swordTier: number
  styleId: SwordStyleId
  time: number
  invuln: number
  shield: boolean
  faceDir: 'up' | 'down' | 'left' | 'right'
}

// ---- Sword STYLE: one randomly-forged look per run ----
export type SwordStyleId = 'steel' | 'ember' | 'stone' | 'frost' | 'storm'

export interface SwordStyle {
  id: SwordStyleId
  name: string
  icon: string
  blade: string
  edge: string
  glow: string
  spark: string // hit-spark / slash tint
  effect: string // one-line flavor of its bonus
}

export const SWORD_STYLES: Record<SwordStyleId, SwordStyle> = {
  steel: { id: 'steel', name: '精钢长剑', icon: '⚔️', blade: '#c2ccd8', edge: '#f2f6fb', glow: 'rgba(180,210,240,0.5)', spark: '#e9f2ff', effect: '暴击率 +8%' },
  ember: { id: 'ember', name: '烬焰之刃', icon: '🔥', blade: '#ff6a2b', edge: '#ffd08a', glow: 'rgba(255,120,40,0.8)', spark: '#ffb347', effect: '伤害 +12%，攻击附带灼烧' },
  stone: { id: 'stone', name: '裂石斩', icon: '🪨', blade: '#8b8577', edge: '#d8d2c4', glow: 'rgba(180,140,90,0.5)', spark: '#c9a066', effect: '强力击退' },
  frost: { id: 'frost', name: '霜咬之锋', icon: '❄️', blade: '#7fd3f2', edge: '#e6faff', glow: 'rgba(140,220,255,0.8)', spark: '#bdecff', effect: '冰缓并减速敌人' },
  storm: { id: 'storm', name: '唤雷者', icon: '⚡', blade: '#ffe066', edge: '#fff6c2', glow: 'rgba(255,225,90,0.85)', spark: '#fff1a8', effect: '攻击距离与速度提升' },
}

export function randomSwordStyle(): SwordStyleId {
  const ids = Object.keys(SWORD_STYLES) as SwordStyleId[]
  return ids[Math.floor(Math.random() * ids.length)]
}

// Tier only controls the blade's size/power; the STYLE controls its look.
const TIER_GEO = [
  { len: 30, w: 5, glow: 6 },
  { len: 34, w: 6, glow: 9 },
  { len: 39, w: 7, glow: 12 },
  { len: 44, w: 8, glow: 15 },
  { len: 49, w: 9, glow: 18 },
  { len: 56, w: 10, glow: 22 },
]

export function swordTierGeo(tier: number) {
  return TIER_GEO[Math.min(TIER_GEO.length - 1, Math.max(0, tier - 1))]
}

// Draws the blade in the rotated hand frame (+x points away from the hero).
function drawBlade(
  ctx: CanvasRenderingContext2D,
  style: SwordStyle,
  geo: { len: number; w: number; glow: number },
  time: number,
) {
  const x0 = 18
  const len = geo.len
  const hw = geo.w / 2
  const tip = x0 + len

  // base blade + elemental glow
  ctx.save()
  ctx.shadowColor = style.glow
  ctx.shadowBlur = geo.glow
  const grad = ctx.createLinearGradient(x0, 0, tip, 0)
  grad.addColorStop(0, style.blade)
  grad.addColorStop(1, style.edge)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(x0, -hw)
  ctx.lineTo(tip - 6, -hw)
  ctx.lineTo(tip, 0)
  ctx.lineTo(tip - 6, hw)
  ctx.lineTo(x0, hw)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  switch (style.id) {
    case 'steel':
      ctx.strokeStyle = 'rgba(255,255,255,0.65)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x0 + 1, 0); ctx.lineTo(tip - 6, 0); ctx.stroke()
      break
    case 'ember': {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < len; i += 5) {
        const fx = x0 + i
        const f = Math.sin(time * 12 + i) * 0.5 + 0.5
        const h = 3 + f * 5
        ctx.fillStyle = i / len < 0.5 ? '#ff922b' : '#ffd43b'
        ctx.beginPath(); ctx.moveTo(fx, -hw); ctx.quadraticCurveTo(fx + 2, -hw - h, fx + 5, -hw); ctx.fill()
        ctx.beginPath(); ctx.moveTo(fx, hw); ctx.quadraticCurveTo(fx + 2, hw + h, fx + 5, hw); ctx.fill()
      }
      ctx.restore()
      break
    }
    case 'stone': {
      ctx.strokeStyle = 'rgba(40,30,20,0.85)'
      ctx.lineWidth = 1.3
      ctx.beginPath()
      ctx.moveTo(x0 + 3, -hw + 1)
      ctx.lineTo(x0 + len * 0.4, 1)
      ctx.lineTo(x0 + len * 0.7, -1)
      ctx.lineTo(tip - 4, 0)
      ctx.stroke()
      const pulse = Math.sin(time * 4) * 0.3 + 0.5
      ctx.strokeStyle = `rgba(255,140,60,${pulse})`
      ctx.lineWidth = 0.8
      ctx.stroke()
      break
    }
    case 'frost': {
      ctx.fillStyle = 'rgba(230,250,255,0.85)'
      for (let i = 4; i < len - 4; i += 7) {
        ctx.beginPath(); ctx.moveTo(x0 + i, -hw); ctx.lineTo(x0 + i + 3, -hw - 3); ctx.lineTo(x0 + i + 5, -hw); ctx.fill()
      }
      const s = Math.sin(time * 6) * 0.5 + 0.5
      ctx.fillStyle = `rgba(255,255,255,${0.4 + s * 0.4})`
      ctx.beginPath(); ctx.arc(tip - 8, 0, 1.6, 0, Math.PI * 2); ctx.fill()
      break
    }
    case 'storm': {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = '#fff6c2'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      let px = x0 + 2
      ctx.moveTo(px, 0)
      let seed = Math.floor(time * 20)
      while (px < tip - 4) {
        px += 4 + (seed % 3)
        const jy = (seed * 37) % 7 - 3
        ctx.lineTo(px, jy)
        seed++
      }
      ctx.stroke()
      ctx.restore()
      break
    }
  }
}

export function drawKnight(ctx: CanvasRenderingContext2D, o: KnightOpts) {
  const flicker = o.invuln > 0 && !o.shield && Math.floor(o.invuln * 20) % 2 === 0
  ctx.save()
  if (flicker) ctx.globalAlpha = 0.45

  const bob = o.moving ? Math.sin(o.walkPhase) * 1.8 : Math.sin(o.walkPhase * 0.3) * 0.6
  const legSwing = o.moving ? Math.sin(o.walkPhase) * 5 : 0
  const style = SWORD_STYLES[o.styleId]
  const geo = swordTierGeo(o.swordTier)

  // ---- body: rendered for the direction the hero is facing ----
  ctx.save()
  ctx.translate(o.x, o.y + bob)
  if (o.faceDir === 'up') knightBack(ctx, legSwing, style)
  else if (o.faceDir === 'down') knightFront(ctx, legSwing, style)
  else { ctx.scale(o.facing, 1); knightSide(ctx, legSwing, style) }
  ctx.restore()

  // ---- sword arm + blade (world space) ----
  // The blade sweeps a wide arc every swing (dir alternates), leaving a
  // motion-trail of after-images so it always feels alive and dynamic.
  const SWEEP = 2.6
  const prog = o.swingT > 0 ? 1 - o.swingT / o.swingDur : 1 // 0→1 through the swing
  const eased = prog * prog * (3 - 2 * prog) // smoothstep
  const dir = o.swingDir || 1
  const base = o.swingT > 0 ? o.swingAngle : o.aim
  const swordAngle = o.swingT > 0 ? base + dir * (-SWEEP / 2 + eased * SWEEP) : base

  const cx = o.x
  const cy = o.y + bob - 2

  // motion-trail after-images across the part of the arc already swept
  if (o.swingT > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const trails = 5
    for (let i = 1; i <= trails; i++) {
      const p = Math.max(0, eased - i * 0.06)
      const a = base + dir * (-SWEEP / 2 + p * SWEEP)
      ctx.globalAlpha = (0.16 * (trails - i)) / trails
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(a)
      ctx.fillStyle = style.edge
      ctx.beginPath()
      ctx.moveTo(18, -3); ctx.lineTo(18 + geo.len, 0); ctx.lineTo(18, 3); ctx.closePath(); ctx.fill()
      ctx.restore()
    }
    ctx.restore()
  }

  // Two-handed grip: both arms bend from the shoulders to meet on the hilt,
  // like a real person actually holding and swinging the sword.
  const ax = Math.cos(swordAngle)
  const ay = Math.sin(swordAngle)
  const gx = cx + ax * 12 // where the hands hold the handle
  const gy = cy + ay * 12

  const drawArm = (sx: number, sy: number, bend: number) => {
    const dx = gx - sx
    const dy = gy - sy
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const ex = (sx + gx) / 2 + nx * bend // elbow
    const ey = (sy + gy) / 2 + ny * bend
    ctx.lineCap = 'round'
    // shoulder plate
    ctx.fillStyle = '#9cc4ef'
    ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, Math.PI * 2); ctx.fill()
    // upper arm (armored)
    ctx.strokeStyle = '#3f4a68'; ctx.lineWidth = 7
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke()
    // forearm (skin)
    ctx.strokeStyle = '#e6b68a'; ctx.lineWidth = 6
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(gx, gy); ctx.stroke()
    // elbow
    ctx.fillStyle = '#33405e'; ctx.beginPath(); ctx.arc(ex, ey, 3.4, 0, Math.PI * 2); ctx.fill()
  }
  // back arm bends one way, lead arm the other, so both reach the grip
  drawArm(cx - 8, cy - 5, 9)
  drawArm(cx + 8, cy - 5, -9)

  // hilt + hands, drawn along the sword's direction
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(swordAngle)
  // handle
  ctx.fillStyle = '#4a2f18'
  rr(ctx, 7, -1.8, 11, 3.6, 1.6); ctx.fill()
  // two gauntlet fists gripping (stacked along the handle)
  ctx.fillStyle = '#aeb9cc'
  rr(ctx, 8, -3.4, 4.5, 6.8, 2); ctx.fill()
  rr(ctx, 13, -3.4, 4.5, 6.8, 2); ctx.fill()
  ctx.strokeStyle = '#6b7891'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(9, -2.5); ctx.lineTo(12, -2.5); ctx.moveTo(14, -2.5); ctx.lineTo(17, -2.5); ctx.stroke()
  // pommel + crossguard (gold)
  ctx.fillStyle = '#e6c15a'
  ctx.beginPath(); ctx.arc(6.5, 0, 2.4, 0, Math.PI * 2); ctx.fill()
  rr(ctx, 18, -6, 3.5, 12, 1.5); ctx.fill()
  // blade — style-specific animated look
  drawBlade(ctx, style, geo, o.time)
  ctx.restore()

  // ---- active damage shield bubble ----
  if (o.shield) {
    ctx.save()
    ctx.globalAlpha = 0.35 + Math.sin(o.walkPhase * 2) * 0.1
    const g = ctx.createRadialGradient(o.x, o.y, 6, o.x, o.y, 28)
    g.addColorStop(0, 'rgba(120,255,190,0)')
    g.addColorStop(0.7, 'rgba(120,255,190,0.15)')
    g.addColorStop(1, 'rgba(120,255,190,0.55)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(o.x, o.y - 2, 28, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(160,255,210,0.8)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(o.x, o.y - 2, 28, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
  }

  ctx.restore()
}

// legs shared by every view
function knightLegs(ctx: CanvasRenderingContext2D, legSwing: number) {
  ctx.fillStyle = '#33425c'
  rr(ctx, -8, 9, 6.5, 13 + legSwing, 3); ctx.fill()
  rr(ctx, 2, 9, 6.5, 13 - legSwing, 3); ctx.fill()
  ctx.fillStyle = '#8ea2c0'
  ctx.beginPath(); ctx.arc(-4.7, 12 + legSwing * 0.4, 2.4, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(5.2, 12 - legSwing * 0.4, 2.4, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#20293c'
  rr(ctx, -10, 21 + legSwing, 9, 5, 2); ctx.fill()
  rr(ctx, 1, 21 - legSwing, 9, 5, 2); ctx.fill()
}

function knightTorso(ctx: CanvasRenderingContext2D, style: SwordStyle, gem: boolean) {
  const torso = ctx.createLinearGradient(0, -12, 0, 12)
  torso.addColorStop(0, '#6cb0ef')
  torso.addColorStop(1, '#2b62a8')
  ctx.fillStyle = torso
  ctx.beginPath()
  ctx.moveTo(-11, -11)
  ctx.quadraticCurveTo(0, -14, 11, -11)
  ctx.lineTo(9, 11)
  ctx.quadraticCurveTo(0, 14, -9, 11)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = 'rgba(10,30,60,0.4)'; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.moveTo(-7, 2); ctx.lineTo(7, 2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-6, 7); ctx.lineTo(6, 7); ctx.stroke()
  ctx.fillStyle = '#e6c15a'
  rr(ctx, -9, 9, 18, 3.4, 1.5); ctx.fill()
  ctx.fillStyle = '#8a5a1a'; ctx.beginPath(); ctx.arc(0, 10.6, 1.6, 0, Math.PI * 2); ctx.fill()
  if (gem) { ctx.fillStyle = style.blade; ctx.beginPath(); ctx.arc(0, -3, 2.6, 0, Math.PI * 2); ctx.fill() }
}

function knightPauldrons(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#9cc4ef'
  ctx.beginPath(); ctx.ellipse(-11, -9, 5.5, 4.5, -0.3, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(11, -9, 5.5, 4.5, 0.3, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#e6c15a'
  ctx.beginPath(); ctx.moveTo(-15, -11); ctx.lineTo(-12, -15); ctx.lineTo(-10, -10); ctx.fill()
  ctx.beginPath(); ctx.moveTo(15, -11); ctx.lineTo(12, -15); ctx.lineTo(10, -10); ctx.fill()
}

// helmet dome + plume, shared; `face` toggles the visible human face
function knightHelmet(ctx: CanvasRenderingContext2D, face: 'front' | 'side' | 'none') {
  if (face !== 'none') {
    ctx.fillStyle = '#e6b68a'
    ctx.beginPath(); ctx.arc(face === 'side' ? 1.5 : 0, -21, 7.5, 0, Math.PI * 2); ctx.fill()
  }
  // dome
  ctx.fillStyle = '#c8d2e0'
  ctx.beginPath(); ctx.arc(face === 'side' ? 1.5 : 0, -23, 8, Math.PI * 1.02, Math.PI * 2.02); ctx.fill()
  ctx.fillStyle = '#9fb0c6'
  rr(ctx, -7, -25, 15, 3.5, 1.5); ctx.fill()
  // plume
  ctx.fillStyle = '#d8324f'
  ctx.beginPath()
  ctx.moveTo(0, -33); ctx.quadraticCurveTo(8, -37, 5, -25); ctx.quadraticCurveTo(2.5, -29, 0, -33); ctx.fill()
}

function knightSide(ctx: CanvasRenderingContext2D, legSwing: number, style: SwordStyle) {
  // cape
  const cape = ctx.createLinearGradient(-14, -10, -8, 22)
  cape.addColorStop(0, '#e03e5c'); cape.addColorStop(1, '#8a1730')
  ctx.fillStyle = cape
  ctx.beginPath()
  ctx.moveTo(-7, -12); ctx.quadraticCurveTo(-20, 2, -13 - legSwing * 0.4, 22)
  ctx.quadraticCurveTo(-6, 16, -1, 20); ctx.lineTo(-3, -10); ctx.closePath(); ctx.fill()

  knightLegs(ctx, legSwing)

  // back arm + heater shield
  ctx.save(); ctx.translate(-11, 0)
  ctx.beginPath()
  ctx.moveTo(-5, -8); ctx.lineTo(5, -8); ctx.lineTo(5, 4); ctx.quadraticCurveTo(0, 12, -5, 4); ctx.closePath()
  ctx.fillStyle = '#aab8d0'; ctx.fill()
  ctx.strokeStyle = '#e6c15a'; ctx.lineWidth = 1.6; ctx.stroke()
  ctx.fillStyle = '#e6c15a'
  ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(2, 0); ctx.lineTo(0, 5); ctx.lineTo(-2, 0); ctx.closePath(); ctx.fill()
  ctx.restore()

  knightTorso(ctx, style, true)
  knightPauldrons(ctx)
  ctx.fillStyle = '#d9a074'; rr(ctx, -3, -16, 6, 6, 2); ctx.fill()
  knightHelmet(ctx, 'side')
  // gold nasal guard + wing + eyes (side)
  ctx.fillStyle = '#e6c15a'; rr(ctx, 0.5, -25, 2, 8, 1); ctx.fill()
  ctx.fillStyle = '#e6eaf2'; ctx.beginPath(); ctx.moveTo(9, -24); ctx.lineTo(15, -26); ctx.lineTo(9, -20); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#2b2233'
  ctx.beginPath(); ctx.arc(4.5, -21, 1.4, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(-0.5, -21, 1.2, 0, Math.PI * 2); ctx.fill()
}

function knightFront(ctx: CanvasRenderingContext2D, legSwing: number, style: SwordStyle) {
  knightLegs(ctx, legSwing)
  // both arms at the sides
  ctx.fillStyle = '#e6b68a'
  ctx.save(); ctx.translate(-12, -2); rr(ctx, -2, 0, 4, 12, 2); ctx.fill(); ctx.restore()
  ctx.save(); ctx.translate(12, -2); rr(ctx, -2, 0, 4, 12, 2); ctx.fill(); ctx.restore()
  knightTorso(ctx, style, true)
  knightPauldrons(ctx)
  ctx.fillStyle = '#d9a074'; rr(ctx, -3, -16, 6, 6, 2); ctx.fill()
  knightHelmet(ctx, 'front')
  // gold nasal guard
  ctx.fillStyle = '#e6c15a'; rr(ctx, -1, -25, 2, 8, 1); ctx.fill()
  // two eyes + stern brows
  ctx.fillStyle = '#2b2233'
  ctx.beginPath(); ctx.arc(-2.6, -21, 1.3, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(2.6, -21, 1.3, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#5a3a24'; ctx.lineWidth = 1.1
  ctx.beginPath(); ctx.moveTo(-4.5, -23); ctx.lineTo(-1, -22.2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(4.5, -23); ctx.lineTo(1, -22.2); ctx.stroke()
}

function knightBack(ctx: CanvasRenderingContext2D, legSwing: number, style: SwordStyle) {
  knightLegs(ctx, legSwing)
  knightTorso(ctx, style, false)
  knightPauldrons(ctx)
  // back of head: helmet dome + hair at nape, no face
  ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.arc(0, -18, 6, 0, Math.PI * 2); ctx.fill()
  knightHelmet(ctx, 'none')
  // big flowing cape covering the back
  const cape = ctx.createLinearGradient(0, -12, 0, 24)
  cape.addColorStop(0, '#e8455f'); cape.addColorStop(1, '#8a1730')
  ctx.fillStyle = cape
  ctx.beginPath()
  ctx.moveTo(-9, -10)
  ctx.quadraticCurveTo(-11 + legSwing * 0.5, 12, -7, 24)
  ctx.quadraticCurveTo(0, 20, 7, 24)
  ctx.quadraticCurveTo(11 - legSwing * 0.5, 12, 9, -10)
  ctx.quadraticCurveTo(0, -6, -9, -10); ctx.closePath(); ctx.fill()
  // spine seam
  ctx.strokeStyle = 'rgba(120,20,40,0.6)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 20); ctx.stroke()
}

// ============================================================
//  ENEMIES — drawn beasts / humanoids, tinted per biome
// ============================================================
export interface CreatureOpts {
  x: number
  y: number
  kind: Kind
  radius: number
  facing: number
  phase: number
  hitFlash: number
  elite: boolean
  pal: Palette
}

export function drawCreature(ctx: CanvasRenderingContext2D, o: CreatureOpts) {
  const bob = Math.sin(o.phase) * (o.radius * 0.12)
  ctx.save()
  ctx.translate(o.x, o.y + bob)

  // elite aura
  if (o.elite) {
    ctx.save()
    ctx.globalAlpha = 0.5 + Math.sin(o.phase * 2) * 0.15
    ctx.fillStyle = 'rgba(255,215,80,0.18)'
    ctx.beginPath(); ctx.arc(0, 0, o.radius * 1.5, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  const s = o.radius / 20
  ctx.scale(s * o.facing, s)

  if (o.hitFlash > 0) { ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 20 }

  switch (o.kind) {
    case 'grunt': drawGrunt(ctx, o.pal); break
    case 'fast': drawFast(ctx, o.pal); break
    case 'tank': drawTank(ctx, o.pal); break
    case 'ranged': drawRanged(ctx, o.pal); break
    case 'boss': drawBoss(ctx, o.pal); break
  }

  if (o.hitFlash > 0) ctx.restore()

  // elite crown
  if (o.elite) {
    ctx.fillStyle = '#ffd43b'
    ctx.beginPath()
    ctx.moveTo(-8, -24); ctx.lineTo(-8, -30); ctx.lineTo(-4, -26)
    ctx.lineTo(0, -32); ctx.lineTo(4, -26); ctx.lineTo(8, -30); ctx.lineTo(8, -24)
    ctx.closePath(); ctx.fill()
  }

  ctx.restore()
}

function eyes(ctx: CanvasRenderingContext2D, pal: Palette, x: number, y: number, gap = 4) {
  ctx.fillStyle = pal.accent
  ctx.shadowColor = pal.accent
  ctx.shadowBlur = 6
  ctx.beginPath(); ctx.arc(x - gap, y, 1.8, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(x + gap, y, 1.8, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0
}

// humanoid brute with a club
function drawGrunt(ctx: CanvasRenderingContext2D, pal: Palette) {
  // legs
  ctx.fillStyle = pal.bodyDark
  rr(ctx, -7, 6, 5, 12, 2); ctx.fill()
  rr(ctx, 2, 6, 5, 12, 2); ctx.fill()
  // arm + club
  ctx.strokeStyle = pal.bodyDark; ctx.lineWidth = 4; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(14, -12); ctx.stroke()
  ctx.fillStyle = '#6b4a2a'
  rr(ctx, 12, -20, 6, 12, 3); ctx.fill()
  // torso
  ctx.fillStyle = pal.body
  rr(ctx, -9, -8, 18, 16, 6); ctx.fill()
  // head
  ctx.fillStyle = pal.body
  ctx.beginPath(); ctx.arc(0, -14, 8, 0, Math.PI * 2); ctx.fill()
  // ears
  ctx.beginPath(); ctx.moveTo(-8, -16); ctx.lineTo(-13, -20); ctx.lineTo(-7, -12); ctx.fill()
  ctx.beginPath(); ctx.moveTo(8, -16); ctx.lineTo(13, -20); ctx.lineTo(7, -12); ctx.fill()
  // tusks
  ctx.fillStyle = '#f5f0e6'
  ctx.beginPath(); ctx.moveTo(-3, -11); ctx.lineTo(-4, -7); ctx.lineTo(-1, -11); ctx.fill()
  ctx.beginPath(); ctx.moveTo(3, -11); ctx.lineTo(4, -7); ctx.lineTo(1, -11); ctx.fill()
  eyes(ctx, pal, 0, -15)
}

// low, fast beast (four legs)
function drawFast(ctx: CanvasRenderingContext2D, pal: Palette) {
  // legs
  ctx.strokeStyle = pal.bodyDark; ctx.lineWidth = 3; ctx.lineCap = 'round'
  for (const lx of [-8, -3, 3, 8]) { ctx.beginPath(); ctx.moveTo(lx, 4); ctx.lineTo(lx, 12); ctx.stroke() }
  // body
  ctx.fillStyle = pal.body
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2); ctx.fill()
  // head
  ctx.beginPath(); ctx.arc(10, -3, 6, 0, Math.PI * 2); ctx.fill()
  // ears
  ctx.beginPath(); ctx.moveTo(8, -8); ctx.lineTo(6, -14); ctx.lineTo(11, -9); ctx.fill()
  ctx.beginPath(); ctx.moveTo(13, -8); ctx.lineTo(15, -14); ctx.lineTo(11, -9); ctx.fill()
  // tail
  ctx.strokeStyle = pal.body; ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(-12, -2); ctx.quadraticCurveTo(-20, -6, -18, -12); ctx.stroke()
  eyes(ctx, pal, 11, -3, 2.5)
}

// big armored tank with horns
function drawTank(ctx: CanvasRenderingContext2D, pal: Palette) {
  ctx.fillStyle = pal.bodyDark
  rr(ctx, -10, 8, 8, 12, 3); ctx.fill()
  rr(ctx, 2, 8, 8, 12, 3); ctx.fill()
  // huge torso
  ctx.fillStyle = pal.body
  rr(ctx, -15, -12, 30, 24, 9); ctx.fill()
  // armor plate
  ctx.fillStyle = pal.bodyDark
  rr(ctx, -12, -8, 24, 10, 4); ctx.fill()
  // small head
  ctx.fillStyle = pal.body
  ctx.beginPath(); ctx.arc(0, -16, 7, 0, Math.PI * 2); ctx.fill()
  // horns
  ctx.strokeStyle = '#f5f0e6'; ctx.lineWidth = 3; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-6, -18); ctx.quadraticCurveTo(-13, -22, -12, -28); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(6, -18); ctx.quadraticCurveTo(13, -22, 12, -28); ctx.stroke()
  eyes(ctx, pal, 0, -16, 3)
}

// robed caster with a glowing staff
function drawRanged(ctx: CanvasRenderingContext2D, pal: Palette) {
  // robe
  ctx.fillStyle = pal.bodyDark
  ctx.beginPath()
  ctx.moveTo(0, -14); ctx.lineTo(12, 14); ctx.lineTo(-12, 14); ctx.closePath(); ctx.fill()
  ctx.fillStyle = pal.body
  ctx.beginPath()
  ctx.moveTo(0, -12); ctx.lineTo(7, 14); ctx.lineTo(-7, 14); ctx.closePath(); ctx.fill()
  // hood
  ctx.fillStyle = pal.bodyDark
  ctx.beginPath(); ctx.arc(0, -14, 7, 0, Math.PI * 2); ctx.fill()
  // staff
  ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(11, 14); ctx.lineTo(14, -16); ctx.stroke()
  // orb
  ctx.fillStyle = pal.accent
  ctx.shadowColor = pal.accent; ctx.shadowBlur = 12
  ctx.beginPath(); ctx.arc(14, -18, 4, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0
  // glowing eyes in hood
  ctx.fillStyle = pal.accent
  ctx.beginPath(); ctx.arc(-2, -14, 1.4, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(2, -14, 1.4, 0, Math.PI * 2); ctx.fill()
}

// winged, horned boss demon
function drawBoss(ctx: CanvasRenderingContext2D, pal: Palette) {
  // wings
  ctx.fillStyle = pal.bodyDark
  ctx.beginPath()
  ctx.moveTo(-10, -6); ctx.quadraticCurveTo(-34, -20, -30, 6); ctx.quadraticCurveTo(-20, 0, -10, 6); ctx.fill()
  ctx.beginPath()
  ctx.moveTo(10, -6); ctx.quadraticCurveTo(34, -20, 30, 6); ctx.quadraticCurveTo(20, 0, 10, 6); ctx.fill()
  // legs
  ctx.fillStyle = pal.bodyDark
  rr(ctx, -10, 10, 8, 12, 3); ctx.fill()
  rr(ctx, 2, 10, 8, 12, 3); ctx.fill()
  // body
  const g = ctx.createLinearGradient(0, -18, 0, 14)
  g.addColorStop(0, pal.body); g.addColorStop(1, pal.bodyDark)
  ctx.fillStyle = g
  rr(ctx, -16, -14, 32, 28, 10); ctx.fill()
  // belly plates
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5
  for (let i = -6; i <= 8; i += 6) { ctx.beginPath(); ctx.moveTo(-8, i); ctx.lineTo(8, i); ctx.stroke() }
  // head
  ctx.fillStyle = pal.body
  ctx.beginPath(); ctx.arc(0, -20, 11, 0, Math.PI * 2); ctx.fill()
  // horns
  ctx.fillStyle = '#f5f0e6'
  ctx.beginPath(); ctx.moveTo(-8, -26); ctx.lineTo(-16, -38); ctx.lineTo(-4, -28); ctx.fill()
  ctx.beginPath(); ctx.moveTo(8, -26); ctx.lineTo(16, -38); ctx.lineTo(4, -28); ctx.fill()
  // glowing eyes + mouth
  ctx.fillStyle = '#fff'
  ctx.shadowColor = pal.accent; ctx.shadowBlur = 14
  ctx.beginPath(); ctx.arc(-4, -21, 2.4, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(4, -21, 2.4, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = '#3a0d0d'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(-5, -15); ctx.lineTo(5, -15); ctx.stroke()
}
