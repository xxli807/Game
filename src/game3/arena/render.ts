import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { loadHumans } from '../action/animatedHumans'
import { disposeObject, type ActorRig } from '../action/models3d'
import { makeWarrior, poseWarrior } from '../action/warriors3d'
import { BASE, BOSS_PIT, CAMPS, FOUNTAIN, LANES, LANE_IDS, MAP, TREES, type SkillDef, type Vec } from './data'
import type { ArenaEvent, ArenaSim } from './sim'
import { Vfx } from './vfx'

// Draws an ArenaSim. Fixed north-up camera (the player's base is always bottom-left), heroes are the
// shared skinned warriors, and everything numerous — minions, shots, health bars — is instanced.

const UNIT = 25
const SIZE = MAP / UNIT
const at = (p: Vec, h = 0) => new T.Vector3(p.x / UNIT, h, p.y / UNIT)
const TEAM = ['#3f78b0', '#b4483c']
// Fighters are drawn larger than their collision size so they read on a wide battlefield.
const HERO_SCALE = 1.7, MINION_SCALE = 1.5
const TEAM_LIGHT = ['#8fc4f0', '#f0a090']
export type AimPreview = { skill: SkillDef; dir?: Vec; point?: Vec } | null

/** Paint a geometry one colour and strip uv, so differently built parts can merge into one mesh. */
function part(geometry: T.BufferGeometry, color: string, move?: (g: T.BufferGeometry) => void) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  move?.(g)
  const c = new T.Color(color), n = g.attributes.position.count, colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new T.BufferAttribute(colors, 3)); g.deleteAttribute('uv')
  return g
}
const merged = (parts: T.BufferGeometry[]) => { const g = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); return g }
const paint = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })
const flat = (color: string, opacity = 1) => new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })

function minionGeometry(kind: string, team: number) {
  const cloth = TEAM[team], iron = '#3d4543', skin = '#b89272', wood = '#6b4a30'
  if (kind === 'siege') return merged([
    part(new T.BoxGeometry(0.9, 0.45, 1.5), wood, g => g.translate(0, 0.55, 0)),
    part(new T.CylinderGeometry(0.14, 0.14, 1.9, 8), iron, g => { g.rotateX(Math.PI / 2); g.translate(0, 0.95, 0.35) }),
    part(new T.BoxGeometry(0.8, 0.5, 0.06), cloth, g => g.translate(0, 1.25, -0.6)),
    ...[-1, 1].flatMap(x => [-1, 1].map(z => part(new T.CylinderGeometry(0.3, 0.3, 0.1, 10), iron, g => { g.rotateZ(Math.PI / 2); g.translate(x * 0.5, 0.3, z * 0.5) }))),
  ])
  return merged([
    part(new T.CylinderGeometry(0.2, 0.27, 0.62, 7), cloth, g => g.translate(0, 0.66, 0)),
    part(new T.BoxGeometry(0.3, 0.36, 0.2), iron, g => g.translate(0, 0.18, 0)),
    part(new T.SphereGeometry(0.16, 8, 6), skin, g => g.translate(0, 1.12, 0)),
    part(new T.ConeGeometry(0.2, 0.2, 7), iron, g => g.translate(0, 1.3, 0)),
    ...(kind === 'melee' ? [
      part(new T.CylinderGeometry(0.022, 0.022, 1.5, 5), wood, g => { g.rotateX(1.1); g.translate(0.24, 0.85, 0.3) }),
      part(new T.BoxGeometry(0.06, 0.5, 0.34), cloth, g => g.translate(-0.26, 0.72, 0.1)),
    ] : [
      part(new T.TorusGeometry(0.34, 0.022, 4, 10, Math.PI), wood, g => { g.rotateY(Math.PI / 2); g.rotateX(Math.PI / 2); g.translate(0.02, 0.8, 0.3) }),
      part(new T.BoxGeometry(0.12, 0.42, 0.12), wood, g => g.translate(0.12, 0.85, -0.2)),
    ]),
  ])
}
function towerGeometry(team: number) {
  const stone = '#77786c', timber = '#5e4530', roof = TEAM[team]
  return merged([
    part(new T.CylinderGeometry(1.55, 2, 2.6, 4), stone, g => { g.rotateY(Math.PI / 4); g.translate(0, 1.3, 0) }),
    part(new T.BoxGeometry(2.3, 1.5, 2.3), timber, g => g.translate(0, 3.35, 0)),
    part(new T.BoxGeometry(2.7, 0.18, 2.7), stone, g => g.translate(0, 2.65, 0)),
    part(new T.ConeGeometry(2.25, 1.35, 4), roof, g => { g.rotateY(Math.PI / 4); g.translate(0, 4.78, 0) }),
    part(new T.CylinderGeometry(0.05, 0.05, 2.2, 5), timber, g => g.translate(0, 6.4, 0)),
    part(new T.BoxGeometry(1.1, 0.7, 0.05), roof, g => g.translate(0.58, 7, 0)),
    ...[-1, 1].flatMap(x => [-1, 1].map(z => part(new T.BoxGeometry(0.34, 0.5, 0.34), stone, g => g.translate(x * 1.15, 2.95, z * 1.15)))),
  ])
}
function rubbleGeometry() {
  let seed = 5
  const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647
  return merged(Array.from({ length: 9 }, () => part(new T.BoxGeometry(0.5 + rand() * 0.9, 0.3 + rand() * 0.6, 0.5 + rand() * 0.9), rand() < 0.6 ? '#6b6c62' : '#4f3b2a', g => { g.rotateY(rand() * 3); g.translate((rand() - 0.5) * 2.6, 0.2 + rand() * 0.4, (rand() - 0.5) * 2.6) })))
}
function dingGeometry() {
  const bronze = '#7d6f3e', dark = '#57502f', stone = '#86877b'
  return merged([
    part(new T.CylinderGeometry(4.3, 4.8, 0.6, 24), stone, g => g.translate(0, 0.3, 0)),
    part(new T.CylinderGeometry(3.3, 3.6, 0.35, 24), '#6f7066', g => g.translate(0, 0.75, 0)),
    part(new T.CylinderGeometry(2.3, 1.7, 2.1, 20), bronze, g => g.translate(0, 3.2, 0)),
    part(new T.TorusGeometry(2.3, 0.17, 6, 24), dark, g => { g.rotateX(Math.PI / 2); g.translate(0, 4.25, 0) }),
    part(new T.TorusGeometry(2.05, 0.1, 6, 24), dark, g => { g.rotateX(Math.PI / 2); g.translate(0, 3.1, 0) }),
    ...[0, 1, 2].map(i => part(new T.CylinderGeometry(0.34, 0.24, 1.6, 8), bronze, g => g.translate(Math.cos(i * 2.094) * 1.35, 1.55, Math.sin(i * 2.094) * 1.35))),
    ...[-1, 1].map(x => part(new T.TorusGeometry(0.5, 0.13, 6, 12), dark, g => g.translate(x * 2.25, 4.75, 0))),
  ])
}
function beastGeometry() {
  const iron = '#3b403d', horn = '#b9ae8c'
  return merged([
    part(new T.BoxGeometry(1.1, 0.9, 1.9), iron, g => g.translate(0, 1.05, 0)),
    part(new T.BoxGeometry(0.8, 0.75, 0.8), iron, g => g.translate(0, 1.25, 1.2)),
    part(new T.SphereGeometry(0.55, 8, 6), iron, g => g.translate(0, 1.6, -0.2)),
    ...[-1, 1].map(x => part(new T.ConeGeometry(0.12, 0.7, 6), horn, g => { g.rotateZ(-x * 1.2); g.translate(x * 0.6, 1.7, 1.3) })),
    ...[-1, 1].flatMap(x => [-1, 1].map(z => part(new T.BoxGeometry(0.28, 0.7, 0.28), iron, g => g.translate(x * 0.38, 0.35, z * 0.65)))),
  ])
}

type HeroView = { bubble: T.Mesh; wasDash: boolean; rig: ActorRig; ring: T.Mesh; seq: number; cast: number; swing: number; windup: number; combo: number; heading: number; step: number; deadFor: number }
type Label = { el: HTMLDivElement; fill?: HTMLElement; shield?: HTMLElement; text?: HTMLElement; tag?: HTMLElement }

export class ArenaRenderer {
  private renderer: T.WebGLRenderer
  private scene = new T.Scene()
  private camera = new T.PerspectiveCamera(40, 1, 1, 600)
  private sun = new T.DirectionalLight('#ffe6bd', 2.6)
  private overlay = document.createElement('div')
  private labels = new Map<string, Label>()
  private used = new Set<string>()
  private heroes = new Map<number, HeroView>()
  private structures = new Map<number, { body: T.Object3D; rubble: T.Mesh; glow?: T.Mesh; dead: boolean }>()
  private beasts = new Map<number, T.Mesh>()
  private minions: Record<string, T.InstancedMesh> = {}
  private bars: [T.InstancedMesh, T.InstancedMesh]
  private shots: T.InstancedMesh
  private zoneDiscs: T.Mesh[] = []
  private zoneRings: T.Mesh[] = []
  private vfx: Vfx
  private zonesSeen = new Map<number, { x: number; y: number; r: number; foe: boolean; armed: boolean }>()
  private punch = 0
  // Adaptive resolution: a heavy team fight on a Retina screen can outrun the GPU, so the render
  // scale steps down while frames run long and back up once they recover.
  private maxPixels = 1
  private pixels = 1
  private frameMs = 16.7
  private lastFrame = 0
  private calm = 0
  private floats: { el: HTMLDivElement; at: T.Vector3; life: number }[] = []
  private aimArrow: T.Mesh
  private aimCircle: T.Mesh
  private aimRange: T.Mesh
  private targetRing: T.Mesh
  private dangerRing: T.Mesh
  private dangerLine: T.Mesh
  private recallRing: T.Mesh
  private focus = new T.Vector3()
  private clock = 0
  private shake = 0
  private ready = false
  private cleanup: (() => void)[] = []
  private m = new T.Matrix4()
  private q = new T.Quaternion()
  private v = new T.Vector3()
  private color = new T.Color()
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private width = 1
  private height = 1

  constructor(private canvas: HTMLCanvasElement, private sim: ArenaSim) {
    const context = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' })
    if (!context) throw new Error('WebGL2 unavailable')
    this.renderer = new T.WebGLRenderer({ canvas, context, antialias: true })
    this.maxPixels = Math.min(window.devicePixelRatio || 1, window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2)
    this.pixels = this.maxPixels
    this.renderer.setPixelRatio(this.pixels)
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFShadowMap
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05
    canvas.dataset.renderer = 'arena'
    this.scene.background = new T.Color('#1d2a24'); this.scene.fog = new T.Fog('#1d2a24', 90, 210)
    this.scene.add(new T.HemisphereLight('#e6ecd8', '#4d4a36', 1.25), this.sun, this.sun.target)
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048)
    Object.assign(this.sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 1, far: 140 })
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.04
    this.buildGround(); this.buildStructures()
    // Minions: one instanced mesh per team and kind.
    for (const team of [0, 1]) for (const kind of ['melee', 'ranged', 'siege']) {
      const mesh = new T.InstancedMesh(minionGeometry(kind, team), paint, 70)
      mesh.castShadow = true; mesh.frustumCulled = false; mesh.count = 0; this.scene.add(mesh); this.minions[`${team}${kind}`] = mesh
    }
    const quad = new T.PlaneGeometry(1, 1)
    this.bars = [new T.InstancedMesh(quad, new T.MeshBasicMaterial({ color: '#16110d', depthTest: false, transparent: true, opacity: 0.8 }), 260), new T.InstancedMesh(quad, new T.MeshBasicMaterial({ depthTest: false, transparent: true }), 260)]
    for (const bar of this.bars) { bar.frustumCulled = false; bar.count = 0; bar.renderOrder = 5; this.scene.add(bar) }
    this.bars[1].renderOrder = 6
    // Per-instance colour is created lazily on first setColorAt, which swaps the shader mid-fight
    // (a ~200 ms freeze when the first minion takes damage). Create it now.
    for (let i = 0; i < 260; i++) this.bars[1].setColorAt(i, this.color.set('#000'))
    this.shots = new T.InstancedMesh(new T.OctahedronGeometry(0.5, 0), new T.MeshBasicMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false }), 160)
    this.shots.frustumCulled = false; this.shots.count = 0; this.scene.add(this.shots)
    for (let i = 0; i < 160; i++) this.shots.setColorAt(i, this.color.set('#000'))
    this.vfx = new Vfx(this.scene)
    const decal = (geometry: T.BufferGeometry, color: string, opacity: number) => { const mesh = new T.Mesh(geometry, flat(color, opacity)); mesh.rotation.x = -Math.PI / 2; mesh.visible = false; mesh.renderOrder = 2; this.scene.add(mesh); return mesh }
    this.aimArrow = decal(new T.PlaneGeometry(1, 1).translate(0, 0.5, 0), '#ffe9a8', 0.42)
    this.aimCircle = decal(new T.CircleGeometry(1, 40), '#ffe9a8', 0.36)
    this.aimRange = decal(new T.RingGeometry(0.985, 1, 72), '#ffe9a8', 0.5)
    this.targetRing = decal(new T.RingGeometry(0.82, 1, 32), '#ff8a6a', 0.9)
    this.dangerRing = decal(new T.RingGeometry(0.985, 1, 96), '#ff6a55', 0.75)
    this.dangerLine = decal(new T.PlaneGeometry(1, 1).translate(0, 0.5, 0), '#ff5a45', 0.75)
    this.recallRing = decal(new T.RingGeometry(0.7, 1, 40), '#9fd6ff', 0.8)
    Object.assign(this.overlay.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' })
    this.overlay.className = 'arena-labels'; canvas.after(this.overlay)
    const observer = new ResizeObserver(() => this.resize()); observer.observe(canvas); this.resize()
    this.cleanup.push(() => observer.disconnect())
    this.focus.copy(at(sim.player))
    // Heroes wait for the skinned model; if it cannot load, makeWarrior falls back to the procedural one.
    void loadHumans().then(() => {
      if (!this.cleanup.length) return
      this.buildHeroes()
      // Compile every shader and upload every texture now, while the loading screen is still up,
      // so the first skill or the first wave does not cost a visible hitch mid-fight.
      // Effects and zone markers are created on first use, so make one of each now too.
      this.vfx.ring(-50, -50, '#fff', 1, 2); this.vfx.pillar(-50, -50, '#fff', 1, 2); this.vfx.arc(-50, -50, 1, 0, 1, 1, '#fff')
      this.drawZones(0, 0)
      const hidden: T.Object3D[] = []
      this.scene.traverse(o => { if (!o.visible) { o.visible = true; hidden.push(o) } })
      this.renderer.compile(this.scene, this.camera)
      for (const o of hidden) o.visible = false
      this.ready = true
    })
  }
  private resize() {
    const rect = this.canvas.getBoundingClientRect(), w = Math.max(320, rect.width), h = Math.max(240, rect.height)
    this.width = rect.width; this.height = rect.height
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix()
  }
  private buildGround() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = window.matchMedia('(pointer: coarse)').matches ? 2048 : 4096
    const g = canvas.getContext('2d')!, k = canvas.width / MAP
    g.scale(k, k)
    let seed = 3
    const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647
    g.fillStyle = '#627048'; g.fillRect(0, 0, MAP, MAP)
    for (let i = 0; i < 420; i++) {
      const x = rand() * MAP, y = rand() * MAP, r = 60 + rand() * 170, blot = g.createRadialGradient(x, y, 0, x, y, r)
      blot.addColorStop(0, i % 3 ? 'rgba(126,134,82,.3)' : 'rgba(70,88,54,.24)'); blot.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = blot; g.fillRect(x - r, y - r, r * 2, r * 2)
    }
    // River along the mirror line, with a lighter ford.
    g.lineCap = 'round'
    for (const [width, color] of [[330, '#48604f'], [250, '#3f6d74'], [150, '#4d8189']] as const) { g.strokeStyle = color; g.lineWidth = width; g.beginPath(); g.moveTo(-100, -100); g.lineTo(MAP + 100, MAP + 100); g.stroke() }
    for (let i = 0; i < 260; i++) { const t = rand() * MAP, o = (rand() - 0.5) * 150; g.fillStyle = 'rgba(190,222,220,.2)'; g.fillRect(t + o, t - o, 26 + rand() * 30, 3) }
    // Lanes.
    g.lineJoin = 'round'
    const lanes = (width: number, color: string) => {
      g.strokeStyle = color; g.lineWidth = width
      for (const lane of LANE_IDS) { const pts = [BASE[0], ...LANES[lane], BASE[1]]; g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (const p of pts.slice(1)) g.lineTo(p.x, p.y); g.stroke() }
    }
    g.globalAlpha = 0.5; lanes(250, '#6c6245'); g.globalAlpha = 1; lanes(190, '#958160'); lanes(140, '#a18c68'); lanes(40, '#ab9772')
    for (let i = 0; i < 2600; i++) {
      const lane = LANES[LANE_IDS[i % 3]], j = Math.floor(rand() * (lane.length - 1)), t = rand(), a = lane[j], b = lane[j + 1]
      g.fillStyle = rand() < 0.5 ? 'rgba(120,104,76,.7)' : 'rgba(186,168,130,.6)'
      g.fillRect(a.x + (b.x - a.x) * t + (rand() - 0.5) * 170, a.y + (b.y - a.y) * t + (rand() - 0.5) * 170, 4 + rand() * 5, 3)
    }
    // Camps, the boss pit, and the two home grounds tinted by side.
    for (const camp of CAMPS) { g.fillStyle = 'rgba(70,62,44,.55)'; g.beginPath(); g.arc(camp.x, camp.y, 150, 0, Math.PI * 2); g.fill() }
    g.fillStyle = 'rgba(40,58,60,.7)'; g.beginPath(); g.arc(BOSS_PIT.x, BOSS_PIT.y, 230, 0, Math.PI * 2); g.fill()
    g.strokeStyle = 'rgba(210,190,130,.6)'; g.lineWidth = 8; g.beginPath(); g.arc(BOSS_PIT.x, BOSS_PIT.y, 230, 0, Math.PI * 2); g.stroke()
    for (const team of [0, 1]) {
      const b = BASE[team], f = FOUNTAIN[team], glow = g.createRadialGradient(b.x, b.y, 80, b.x, b.y, 620)
      glow.addColorStop(0, team ? 'rgba(170,84,70,.6)' : 'rgba(72,120,170,.6)'); glow.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = glow; g.fillRect(b.x - 640, b.y - 640, 1280, 1280)
      g.fillStyle = '#8c8777'; g.beginPath(); g.arc(b.x, b.y, 260, 0, Math.PI * 2); g.fill()
      g.strokeStyle = '#646052'; g.lineWidth = 7; for (const r of [130, 195, 260]) { g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.stroke() }
      g.fillStyle = team ? 'rgba(214,120,100,.75)' : 'rgba(120,180,230,.75)'; g.beginPath(); g.arc(f.x, f.y, 200, 0, Math.PI * 2); g.fill()
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 10; g.beginPath(); g.arc(f.x, f.y, 200, 0, Math.PI * 2); g.stroke()
    }
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    const ground = new T.Mesh(new T.PlaneGeometry(SIZE, SIZE), new T.MeshStandardMaterial({ map: texture, roughness: 1 }))
    ground.rotation.x = -Math.PI / 2; ground.position.set(SIZE / 2, 0, SIZE / 2); ground.receiveShadow = true; this.scene.add(ground)
    const beyond = new T.Mesh(new T.PlaneGeometry(700, 700), new T.MeshStandardMaterial({ color: '#2f3b2c', roughness: 1 }))
    beyond.rotation.x = -Math.PI / 2; beyond.position.set(SIZE / 2, -0.06, SIZE / 2); this.scene.add(beyond)
    // Jungle clumps (solid in the sim) plus a forest wall around the map.
    const trees = TREES.map(t => ({ x: t.x / UNIT, z: t.y / UNIT, s: t.r / 48 }))
    for (let i = 0; i < 240; i++) {
      const side = i % 4, t = rand() * (SIZE + 16) - 8, off = -2 - rand() * 9
      trees.push({ x: side === 0 ? t : side === 1 ? t : side === 2 ? off : SIZE - off, z: side === 0 ? off : side === 1 ? SIZE - off : t, s: 1 + rand() * 0.9 })
    }
    const trunk = new T.InstancedMesh(new T.CylinderGeometry(0.22, 0.34, 2, 6), new T.MeshStandardMaterial({ color: '#4c3a2a', roughness: 1 }), trees.length)
    const crown = new T.InstancedMesh(new T.IcosahedronGeometry(1.5, 0), new T.MeshStandardMaterial({ roughness: 1, flatShading: true }), trees.length * 2)
    const palette = ['#4f6a3c', '#5d7745', '#466036', '#6b7c48', '#3f5a3a']
    trees.forEach((t, i) => {
      this.m.compose(new T.Vector3(t.x, t.s, t.z), this.q.identity(), new T.Vector3(t.s, t.s, t.s)); trunk.setMatrixAt(i, this.m)
      this.q.setFromEuler(new T.Euler(0, i * 1.7, 0))
      this.m.compose(new T.Vector3(t.x, 2.7 * t.s, t.z), this.q, new T.Vector3(t.s * 1.15, t.s, t.s * 1.15)); crown.setMatrixAt(i * 2, this.m)
      this.m.compose(new T.Vector3(t.x + 0.4 * t.s, 3.7 * t.s, t.z - 0.2 * t.s), this.q, new T.Vector3(t.s * 0.75, t.s * 0.7, t.s * 0.75)); crown.setMatrixAt(i * 2 + 1, this.m)
      crown.setColorAt(i * 2, this.color.set(palette[i % 5])); crown.setColorAt(i * 2 + 1, this.color.set(palette[(i + 2) % 5]))
    })
    for (const mesh of [trunk, crown]) { mesh.castShadow = true; mesh.receiveShadow = true; this.scene.add(mesh) }
  }
  private buildStructures() {
    const rubble = rubbleGeometry(), towers = [towerGeometry(0), towerGeometry(1)], ding = dingGeometry(), beast = beastGeometry()
    const bronze = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.55 })
    for (const u of this.sim.units) {
      if (u.kind !== 'tower' && u.kind !== 'base') continue
      const body = new T.Mesh(u.kind === 'base' ? ding : towers[u.team], u.kind === 'base' ? bronze : paint.clone())
      body.position.copy(at(u)); body.castShadow = true; body.receiveShadow = true
      const glow = new T.Mesh(new T.SphereGeometry(u.kind === 'base' ? 1.25 : 0.42, 14, 10), new T.MeshBasicMaterial({ color: TEAM_LIGHT[u.team] }))
      glow.position.copy(at(u, u.kind === 'base' ? 5.3 : 5.85))
      const wreck = new T.Mesh(rubble, paint); wreck.position.copy(at(u)); wreck.scale.setScalar(u.kind === 'base' ? 1.8 : 1); wreck.visible = false; wreck.receiveShadow = true
      this.scene.add(body, glow, wreck); this.structures.set(u.id, { body, rubble: wreck, glow, dead: false })
    }
    this.beastGeometry = beast
  }
  private beastGeometry!: T.BufferGeometry
  private buildHeroes() {
    for (const h of this.sim.heroes) {
      const rig = makeWarrior(h.def.rig, h.def.color)
      rig.root.scale.setScalar(HERO_SCALE)
      // A back banner in the army's colour (gold for the player) tells the sides apart at a glance.
      const banner = new T.Mesh(merged([
        part(new T.CylinderGeometry(0.018, 0.018, 1.5, 5), '#3a2c20', g => g.translate(0, 1.95, -0.2)),
        part(new T.BoxGeometry(0.46, 0.34, 0.02), h === this.sim.player ? '#f0c95a' : TEAM[h.team], g => g.translate(0.25, 2.5, -0.2)),
      ]), paint)
      banner.castShadow = true; rig.root.add(banner)
      const ring = new T.Mesh(new T.RingGeometry(1.35, 1.65, 40), flat(h === this.sim.player ? '#ffd76a' : TEAM_LIGHT[h.team], 0.85))
      ring.rotation.x = -Math.PI / 2; ring.renderOrder = 3
      this.scene.add(rig.root, ring)
      const bubble = new T.Mesh(new T.SphereGeometry(1.45, 18, 12), new T.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false }))
      bubble.visible = false; this.scene.add(bubble)
      this.heroes.set(h.id, { bubble, wasDash: false, rig, ring, seq: h.attackSeq, cast: h.castSeq, swing: 0, windup: 0, combo: 0, heading: h.heading, step: 0, deadFor: 0 })
    }
  }

  /** World point under a screen position, for mouse aiming. */
  ground(clientX: number, clientY: number): Vec {
    const rect = this.canvas.getBoundingClientRect()
    const ray = new T.Raycaster()
    ray.setFromCamera(new T.Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), this.camera)
    const hit = ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), new T.Vector3())
    return hit ? { x: hit.x * UNIT, y: hit.z * UNIT } : { x: this.sim.player.x, y: this.sim.player.y }
  }
  handle(event: ArenaEvent) {
    const fx = this.vfx, me = this.sim.player
    const close = (p: Vec, range = 900) => Math.hypot(p.x - me.x, p.y - me.y) < range
    if (event.type === 'hit') {
      const x = event.x / UNIT, z = event.y / UNIT
      fx.burst(x, 1.4, z, event.color, event.big ? 12 : 4, event.big ? 9 : 5)
      fx.ghost(x, 1.5, z, event.big ? 2.4 : 1.3, event.color, event.big ? 0.18 : 0.1, 0.8)
      if (event.big) fx.ring(x, z, event.color, 0.5, 2.4, 0.28)
    } else if (event.type === 'cone') {
      fx.arc(event.x / UNIT, event.y / UNIT, event.dx, event.dy, event.radius / UNIT, event.arc, event.color)
      for (let i = 0; i < 9; i++) { const a = Math.atan2(event.dy, event.dx) + (Math.random() - 0.5) * event.arc, r = event.radius / UNIT * (0.5 + Math.random() * 0.5); fx.burst(event.x / UNIT + Math.cos(a) * r, 1, event.y / UNIT + Math.sin(a) * r, event.color, 1, 3) }
    } else if (event.type === 'cast') {
      const x = event.x / UNIT, z = event.y / UNIT, ult = event.slot === 2
      fx.ring(x, z, event.color, 0.6, ult ? 5.5 : 2.6, ult ? 0.6 : 0.35)
      fx.ghost(x, 1.8, z, ult ? 4.5 : 2.6, event.color, ult ? 0.35 : 0.22, 0.6)
      if (ult) {
        // An ultimate announces itself: a column of light, a second shockwave, a shower of sparks.
        fx.pillar(x, z, event.color, 1.6, 13, 0.7); fx.ring(x, z, '#fff3c8', 1, 8, 0.8); fx.burst(x, 1.5, z, event.color, 34, 11, 9, 0.8)
        if (close(event)) { this.shake = Math.max(this.shake, event.mine ? 0.55 : 0.3); if (event.mine) this.punch = 1 }
      }
    } else if (event.type === 'flash') {
      for (const [px, py] of [[event.x, event.y], [event.tx, event.ty]]) { fx.ring(px / UNIT, py / UNIT, '#fff6d6', 0.4, 2.6, 0.35); fx.ghost(px / UNIT, 1.8, py / UNIT, 4.5, '#fff1b8', 0.3, 0.7); fx.burst(px / UNIT, 1.4, py / UNIT, event.color, 14, 6) }
    } else if (event.type === 'levelup') {
      const h = this.sim.heroes.find(x => x.id === event.id)
      if (h) { fx.ring(h.x / UNIT, h.y / UNIT, '#ffe28a', 0.6, 3.6, 0.6); fx.pillar(h.x / UNIT, h.y / UNIT, '#ffe28a', 1, 9, 0.7); fx.burst(h.x / UNIT, 1, h.y / UNIT, '#ffe9a8', 16, 4, 9, 0.9, 4) }
    } else if (event.type === 'down') {
      const x = event.x / UNIT, z = event.y / UNIT
      fx.ring(x, z, '#ff7a5c', 0.6, 4.6, 0.6); fx.ghost(x, 1.6, z, 6, '#ff9a70', 0.4, 0.8); fx.burst(x, 1.4, z, event.color, 30, 10, 8, 0.8)
    } else if (event.type === 'zap') {
      // Lightning: a jagged chain of bright points from caster to target, then a burst.
      const ax = event.x / UNIT, az = event.y / UNIT, bx = event.tx / UNIT, bz = event.ty / UNIT, len = Math.hypot(bx - ax, bz - az), steps = Math.max(4, Math.round(len / 0.7))
      for (let i = 0; i <= steps; i++) { const t = i / steps, jag = i % steps === 0 ? 0 : (Math.random() - 0.5) * 1.2; fx.ghost(ax + (bx - ax) * t + jag, 2.2 + Math.sin(t * Math.PI) * 2.5, az + (bz - az) * t + jag, 1.3, '#efe4ff', 0.2, 0) }
      fx.ghost(bx, 1.4, bz, 4, event.color, 0.25, 0.6); fx.burst(bx, 1.4, bz, event.color, 12, 7); fx.ring(bx, bz, event.color, 0.4, 2.2, 0.3)
    } else if (event.type === 'nova') {
      const x = event.x / UNIT, z = event.y / UNIT, r = event.r / UNIT
      fx.ring(x, z, event.color, 0.5, r, 0.45); fx.ring(x, z, '#ffffff', 0.3, r * 0.7, 0.3); fx.burst(x, 0.6, z, event.color, 26, r * 2.4, 3, 0.6, 2)
    } else if (event.type === 'drum') {
      const x = event.x / UNIT, z = event.y / UNIT
      fx.ring(x, z, '#ffe07a', 0.6, 24, 0.7); fx.ring(x, z, '#fff3c0', 0.4, 14, 0.5)
    } else if (event.type === 'summon') {
      const x = event.x / UNIT, z = event.y / UNIT
      fx.pillar(x, z, event.color, 1.8, 8, 0.6); fx.ring(x, z, event.color, 0.5, 4, 0.5); fx.burst(x, 0.5, z, event.color, 22, 5, 7, 0.7)
    } else if (event.type === 'grow') {
      const h = this.sim.heroes.find(x => x.id === event.id)
      if (h && close(h, 1600)) {
        const x = h.x / UNIT, z = h.y / UNIT, color = event.awake ? '#ffd76a' : h.def.color
        fx.ring(x, z, color, 0.5, event.awake ? 6 : 3, event.awake ? 0.7 : 0.45)
        if (event.awake) { fx.pillar(x, z, '#ffd76a', 2, 14, 0.9); fx.burst(x, 1, z, '#ffe9a8', 40, 8, 11, 1, 6) }
      }
    } else if (event.type === 'dmg') this.float(event.x, event.y, `${Math.round(event.amount)}`, `${event.mine ? 'mine' : 'hurt'}${event.heavy ? ' al-heavy' : event.amount > 260 ? ' al-big' : ''}`)
    else if (event.type === 'heal') this.float(event.x, event.y, `+${Math.round(event.amount)}`, 'heal')
    else if (event.type === 'gold') this.float(event.x, event.y, `+${event.amount} 金`, 'gold')
    else if (event.type === 'kill' && event.role) { this.shake = 0.6; if (event.role === 'killer') this.punch = 1 }
    else if (event.type === 'tower') { this.shake = 0.7 }
  }
  private float(x: number, y: number, text: string, kind: string) {
    if (this.floats.length > 30) return
    const el = document.createElement('div'); el.className = `al al-float al-${kind}`; el.textContent = text; this.overlay.append(el)
    // Fan numbers out around the target so a burst of hits stays readable.
    const spread = this.floats.filter(f => f.life > 0.45).length
    this.floats.push({ el, at: at({ x: x + (Math.random() - 0.5) * 90, y: y - (spread % 4) * 22 }, 2.6 + (spread % 3) * 0.7), life: 0.8 })
  }
  private project(p: T.Vector3) {
    const v = this.v.copy(p).project(this.camera)
    if (v.z > 1 || Math.abs(v.x) > 1.15 || Math.abs(v.y) > 1.2) return null
    // Cache dimensions on resize: reading layout between every label write stalls the frame.
    return { x: (v.x + 1) / 2 * this.width, y: (1 - v.y) / 2 * this.height }
  }
  private bar(key: string, p: T.Vector3, kind: string, hp: number, shield = 0, text = '', tag = '') {
    const spot = this.project(p)
    if (!spot) return
    this.used.add(key)
    let label = this.labels.get(key)
    if (!label) {
      const el = document.createElement('div'); el.className = `al al-bar ${kind}`
      el.innerHTML = '<span class="al-name"></span><span class="al-tag"></span><div class="al-track"><i></i><b></b></div>'
      this.overlay.append(el)
      label = { el, text: el.children[0] as HTMLElement, tag: el.children[1] as HTMLElement, fill: el.querySelector('i')!, shield: el.querySelector('b')! }
      this.labels.set(key, label)
    }
    label.el.style.display = ''
    label.fill!.style.width = `${Math.max(0, Math.min(1, hp)) * 100}%`; label.shield!.style.width = `${Math.min(1, shield) * 100}%`
    if (label.text!.textContent !== text) label.text!.textContent = text
    if (label.tag!.textContent !== tag) label.tag!.textContent = tag
    label.el.style.transform = `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px) translate(-50%, -100%)`
  }

  draw(dt: number, aim: AimPreview) {
    const now = performance.now()
    if (this.lastFrame) this.adapt(Math.min(100, now - this.lastFrame))
    this.lastFrame = now
    const sim = this.sim, me = sim.player
    this.clock += dt; this.used.clear()
    const time = this.clock
    // Camera: fixed heading, follows the hero; pulled back in portrait so the lane still fits.
    const goal = at(me.alive ? me : FOUNTAIN[0])
    // The view is locked to the hero (a trailing camera reads as lag); only the pan to the
    // fountain after a death is eased. Big moments push the camera in for a beat.
    if (me.alive || this.focus.distanceTo(goal) < 0.05) this.focus.copy(goal)
    else this.focus.lerp(goal, 1 - Math.exp(-dt * 3))
    this.punch = Math.max(0, this.punch - dt * 2.2)
    const portrait = this.camera.aspect < 1, distance = (portrait ? 74 : 46) * (1 - (this.reduced ? 0 : Math.sin(this.punch * Math.PI) * 0.07)), pitch = 0.98
    this.camera.position.set(this.focus.x, Math.sin(pitch) * distance, this.focus.z + Math.cos(pitch) * distance)
    if (this.shake > 0 && !this.reduced) { this.shake = Math.max(0, this.shake - dt * 2); this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.6; this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.6 }
    this.camera.lookAt(this.focus.x, 0, this.focus.z - (portrait ? 5 : 2))
    // Labels are projected before renderer.render(), which normally updates this matrix.
    this.camera.updateMatrixWorld()
    this.sun.position.set(this.focus.x - 24, 46, this.focus.z + 18); this.sun.target.position.copy(this.focus)
    this.vfx.begin(this.camera)
    const fx = this.vfx
    const near = (u: Vec, range = 1500) => Math.abs(u.x - this.focus.x * UNIT) < range && Math.abs(u.y - this.focus.z * UNIT) < range

    // Heroes.
    for (const h of sim.heroes) {
      const view = this.heroes.get(h.id)
      if (!view) continue
      view.deadFor = h.alive ? 0 : view.deadFor + dt
      const visible = near(h) && view.deadFor < 3.5
      view.rig.root.visible = visible; view.ring.visible = visible && h.alive; view.bubble.visible = visible && h.alive && h.shield > 0
      // The third blow of a chain uses the heavy swing, matching the sim's heavy hit.
      if (h.attackSeq !== view.seq) { view.seq = h.attackSeq; view.swing = 0.42; view.windup = 0.3; view.combo = h.chain }
      if (h.castSeq !== view.cast) { view.cast = h.castSeq; view.swing = 0.5; view.windup = 0.3; view.combo = 3 }
      view.swing = Math.max(0, view.swing - dt); view.windup = Math.max(0, view.windup - dt)
      if (!visible) continue
      const turn = Math.atan2(Math.sin(h.heading - view.heading), Math.cos(h.heading - view.heading))
      view.heading += turn * Math.min(1, dt * 16)
      view.rig.root.position.copy(at(h)); view.rig.root.rotation.y = view.heading
      view.ring.position.copy(at(h, 0.07))
      const lead = h.def.rig === 'player'
      // Heroes cover ground fast for their size; play the run faster so feet do not skate.
      if (view.rig.human) view.rig.human.update({ moving: h.moving && h.alive, attacking: lead ? view.swing : 0, combo: view.combo, windup: lead ? 0 : view.windup, hit: h.flash, dead: !h.alive, dash: Boolean(h.dash), battle: true }, dt * (h.moving && h.alive && !h.dash ? 1.55 : 1))
      else {
        if (h.moving) view.step += dt * 11
        const s = h.moving ? Math.sin(view.step) : 0
        view.rig.leftLeg.rotation.x = s * 0.7; view.rig.rightLeg.rotation.x = -s * 0.7; view.rig.leftArm.rotation.x = -s * 0.5; view.rig.rightArm.rotation.x = s * 0.5
        poseWarrior(view.rig, view.windup, view.swing, h.flash)
        view.rig.root.rotation.z = h.alive ? 0 : Math.min(1.5, view.deadFor * 4)
      }
      if (h.alive) {
        const x = h.x / UNIT, z = h.y / UNIT, b = h.buffs
        if (h.shield > 0) { view.bubble.position.set(x, 1.9, z); view.bubble.scale.setScalar(HERO_SCALE * (1 + Math.sin(time * 6) * 0.03)) }
        if (h.dash && dt > 0) { fx.ghost(x, 1.8, z, 3.4, h.def.color, 0.28, 0.2); if (Math.random() < 0.7) fx.burst(x, 1.2, z, '#fff1c8', 1, 2, 1, 0.3, 0) }
        if (b.atk.t > 0) { fx.glow(x, 0.5, z, 5.2, '#ff7a30', 0.45 + Math.sin(time * 9) * 0.1); if (Math.random() < dt * 14) fx.burst(x, 0.4, z, '#ffb060', 1, 1.5, 5, 0.7, -2) }
        if (b.ls.t > 0) fx.glow(x, 1.6, z, 4.2, '#d8304a', 0.4)
        if (b.speed.t > 0 && h.moving && Math.random() < dt * 30) fx.ghost(x, 1 + Math.random() * 1.6, z, 1.2, '#cfeeff', 0.3, 0)
        if (b.aspd.t > 0) fx.glow(x, 2.6, z, 2.6, '#ffe07a', 0.5 + Math.sin(time * 14) * 0.2)
        if (h.stun > 0) for (let i = 0; i < 3; i++) { const a = time * 5 + i * 2.094; fx.glow(x + Math.cos(a) * 0.9, 4.4, z + Math.sin(a) * 0.9, 0.9, '#fff2a0', 0.9) }
        if (h.slowT > 0) fx.glow(x, 0.3, z, 3.6, '#6fb8ff', 0.4)
        for (const a of h.autos) {
          if (a.id === 'orbit') {
            // Flying swords: bright heads with a short fading trail.
            const blades = a.rank + 1
            for (let i = 0; i < blades; i++) { const ang = h.orbit + i / blades * Math.PI * 2, bx = x + Math.cos(ang) * 6, bz = z + Math.sin(ang) * 6; fx.glow(bx, 2, bz, 1.9, '#bdf0ff', 1); fx.ghost(bx, 2, bz, 1.2, '#7fd4ff', 0.16, -0.4) }
          } else if (a.id === 'aura') {
            const r = (150 + 28 * a.rank) / UNIT
            for (let i = 0; i < 14; i++) { const ang = time * 1.4 + i / 14 * Math.PI * 2; fx.glow(x + Math.cos(ang) * r, 0.35, z + Math.sin(ang) * r, 1.8 + Math.sin(time * 9 + i) * 0.4, '#ff7a2e', 0.6) }
            if (Math.random() < dt * 22) { const ang = Math.random() * Math.PI * 2, rr = Math.random() * r; fx.burst(x + Math.cos(ang) * rr, 0.3, z + Math.sin(ang) * rr, '#ffab5c', 1, 0.8, 5, 0.6, -2) }
          }
        }
        if (h.recallT > 0) for (let i = 0; i < 3; i++) fx.glow(x, 0.6 + ((time * 2 + i / 3) % 1) * 5, z, 2.4, '#9fd6ff', 0.5)
        const status = h.stun > 0 ? '晕眩' : h.recallT > 0 ? '回城' : h.slowT > 0 ? '减速' : ''
        this.bar(`h${h.id}`, at(h, 2.75 * HERO_SCALE), `hero ${h.team === 0 ? 'ally' : 'foe'}${h === me ? ' me' : ''}`, h.hp / h.maxHp, h.shield / h.maxHp, `${h.level} ${h.def.name}`, status)
      }
    }
    // Structures and neutral beasts.
    for (const u of sim.units) {
      if (u.kind === 'tower' || u.kind === 'base') {
        const s = this.structures.get(u.id)!
        // A tower between the camera and the hero turns translucent.
        const hides = u.kind === 'tower' && u.alive && me.alive && me.y < u.y + 20 && u.y - me.y < 260 && Math.abs(u.x - me.x) < 110
        const mat = (s.body as T.Mesh).material as T.MeshStandardMaterial
        if (u.kind === 'tower') { const want = hides ? 0.3 : 1; mat.opacity += (want - mat.opacity) * Math.min(1, dt * 10); mat.transparent = mat.opacity < 0.99; mat.depthWrite = !mat.transparent }
        if (!u.alive && !s.dead) { s.dead = true; s.body.visible = false; s.glow!.visible = false; s.rubble.visible = true; fx.burst(u.x / UNIT, 3, u.y / UNIT, '#d8c9a8', 60, 12, 10, 1); fx.ring(u.x / UNIT, u.y / UNIT, '#f0d9a8', 1, 9, 0.9); fx.pillar(u.x / UNIT, u.y / UNIT, '#f0d9a8', 2.4, 12, 0.8) }
        if (u.alive) {
          s.glow!.scale.setScalar(1 + Math.sin(time * 4 + u.id) * 0.12)
          if (near(u) && (u.hp < u.maxHp || u.kind === 'base')) this.bar(`s${u.id}`, at(u, u.kind === 'base' ? 7.4 : 8.3), `struct ${u.team === 0 ? 'ally' : 'foe'}`, u.hp / u.maxHp, 0, u.kind === 'base' ? '鼎' : '')
        }
      } else if (u.kind === 'monster') {
        let mesh = this.beasts.get(u.id)
        if (!mesh) { mesh = new T.Mesh(this.beastGeometry, paint); mesh.castShadow = true; mesh.scale.setScalar(u.sub === 'boss' ? 2.1 : 1.05); this.scene.add(mesh); this.beasts.set(u.id, mesh) }
        mesh.visible = u.alive && near(u)
        if (!mesh.visible) continue
        mesh.position.copy(at(u, Math.abs(Math.sin(time * 5 + u.id)) * (u.moving ? 0.18 : 0.04))); mesh.rotation.y = u.heading
        mesh.rotation.x = u.windup > 0 ? -0.25 : 0
        this.bar(`m${u.id}`, at(u, u.sub === 'boss' ? 5.4 : 3), 'beast', u.hp / u.maxHp, 0, u.sub === 'boss' ? '镇河铁牛' : '')
      }
    }
    this.drawMinions(time, near)
    this.drawShots(dt)
    this.drawZones(time, dt)
    this.drawAim(aim, time)
    fx.update(dt)
    this.renderer.render(this.scene, this.camera)
    this.floats = this.floats.filter(f => {
      f.life -= dt; f.at.y += dt * 2.4
      const spot = this.project(f.at)
      if (f.life <= 0 || !spot) { f.el.remove(); return false }
      f.el.style.transform = `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px) translate(-50%, -50%)`; f.el.style.opacity = `${Math.min(1, f.life * 2.5)}`
      return true
    })
    for (const [key, label] of this.labels) if (!this.used.has(key)) { label.el.remove(); this.labels.delete(key) }
  }
  private drawMinions(time: number, near: (u: Vec, range?: number) => boolean) {
    const counts: Record<string, number> = {}
    let bars = 0
    // Bars face the fixed camera, so one shared orientation serves every instance.
    const facing = this.camera.quaternion, right = new T.Vector3(1, 0, 0).applyQuaternion(facing)
    for (const u of this.sim.units) {
      if (u.kind !== 'minion' || !u.alive || !near(u, 1700)) continue
      const key = `${u.team}${u.sub}`, mesh = this.minions[key], i = counts[key] ?? 0
      if (i >= 70) continue
      const lunge = u.windup > 0 ? 0.3 : 0, hop = u.moving ? Math.abs(Math.sin(time * 9 + u.id)) * 0.12 : 0
      this.q.setFromEuler(new T.Euler(lunge, u.heading, 0, 'YXZ'))
      const size = (u.maxHp > 800 && u.sub !== 'siege' ? 1.25 : 1) * MINION_SCALE
      this.m.compose(at(u, hop), this.q, this.v.set(size, size, size)); mesh.setMatrixAt(i, this.m)
      counts[key] = i + 1
      if (bars < 260 && u.hp < u.maxHp) {
        const w = 1.5, k = Math.max(0, u.hp / u.maxHp), top = at(u, 1.75 * MINION_SCALE)
        this.m.compose(top, facing, this.v.set(w, 0.16, 1)); this.bars[0].setMatrixAt(bars, this.m)
        this.m.compose(top.addScaledVector(right, -w * (1 - k) / 2), facing, this.v.set(w * k, 0.11, 1)); this.bars[1].setMatrixAt(bars, this.m)
        this.bars[1].setColorAt(bars, this.color.set(u.team === 0 ? '#6fd08a' : '#e06a55'))
        bars++
      }
    }
    for (const [key, mesh] of Object.entries(this.minions)) { mesh.count = counts[key] ?? 0; mesh.instanceMatrix.needsUpdate = true }
    for (const bar of this.bars) { bar.count = bars; bar.instanceMatrix.needsUpdate = true }
    if (this.bars[1].instanceColor) this.bars[1].instanceColor.needsUpdate = true
  }
  private drawShots(dt: number) {
    let n = 0
    for (const s of this.sim.shots) {
      if (n >= 160) break
      const big = s.kind === 'skill' ? Math.max(0.9, s.width / UNIT * 0.9) : s.kind === 'tower' ? 0.8 : 0.45
      this.q.setFromEuler(new T.Euler(0, Math.atan2(s.dx, s.dy), 0))
      this.m.compose(at(s, s.kind === 'tower' ? 3 : 2.2), this.q, this.v.set(big * 0.55, big * 0.55, big * (s.kind === 'tower' ? 1 : 2.6))); this.shots.setMatrixAt(n, this.m)
      const tint = s.kind === 'tower' ? TEAM_LIGHT[s.team === 1 ? 1 : 0] : s.color
      this.shots.setColorAt(n, this.color.set(tint).multiplyScalar(s.kind === 'skill' ? 1.5 : 1.1))
      n++
      const x = s.x / UNIT, z = s.y / UNIT, y = s.kind === 'tower' ? 3 : 2.2
      if (s.kind === 'skill' && dt > 0) { this.vfx.glow(x, y, z, big * 3.2, tint, 0.9); this.vfx.ghost(x, y, z, big * 2.1, tint, 0.26, -0.5); if (Math.random() < 0.5) this.vfx.burst(x, y, z, tint, 1, 2, 1, 0.35, 3) }
      else if (s.kind === 'tower' && dt > 0) { this.vfx.glow(x, y, z, 2.6, tint, 0.9); this.vfx.ghost(x, y, z, 1.5, tint, 0.18, -0.5) }
      else this.vfx.glow(x, y, z, s.heavy ? 2 : 1.1, tint, 0.7)
    }
    this.shots.count = n; this.shots.instanceMatrix.needsUpdate = true
    if (this.shots.instanceColor) this.shots.instanceColor.needsUpdate = true
  }
  // Blasts telegraph: an outline of the full area, and a disc that fills as the delay runs out.
  private drawZones(time: number, dt: number) {
    const zones = this.sim.zones
    while (this.zoneDiscs.length < Math.max(2, zones.length)) {
      const disc = new T.Mesh(new T.CircleGeometry(1, 40), flat('#fff', 0.3)), ring = new T.Mesh(new T.RingGeometry(0.96, 1, 56), flat('#fff', 0.85))
      for (const mesh of [disc, ring]) { mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 2; this.scene.add(mesh) }
      this.zoneDiscs.push(disc); this.zoneRings.push(ring)
    }
    // Detonations: a blast that was counting down and is now gone, or has just gone off, explodes.
    const live = new Set<number>()
    for (const z of zones) {
      live.add(z.id)
      const seen = this.zonesSeen.get(z.id)
      if (!seen) this.zonesSeen.set(z.id, { x: z.x, y: z.y, r: z.r, foe: z.team !== 0, armed: z.wait > 0 })
      else if (seen.armed && z.wait <= 0) { seen.armed = false; this.explode(seen) }
      if (z.wait <= 0 && z.left > 0 && Math.random() < dt * 30) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * z.r / UNIT
        this.vfx.burst(z.x / UNIT + Math.cos(a) * r, 0.2, z.y / UNIT + Math.sin(a) * r, z.team !== 0 ? '#ff7a5c' : '#9fdcff', 1, 0.6, 6, 0.7, -1)
      }
    }
    for (const [id, seen] of this.zonesSeen) if (!live.has(id)) { if (seen.armed) this.explode(seen); this.zonesSeen.delete(id) }
    this.zoneDiscs.forEach((disc, i) => {
      const z = zones[i], ring = this.zoneRings[i]
      disc.visible = ring.visible = Boolean(z)
      if (!z) return
      // Friendly areas are always cool blue and hostile ones red, whatever the caster's own colour.
      const r = z.r / UNIT, foe = z.team !== 0, color = foe ? '#ff5a45' : '#8fd0ff'
      const fill = z.wait > 0 ? 1 - z.wait / z.delay : 1
      disc.position.copy(at(z, 0.09)); ring.position.copy(at(z, 0.1)); ring.scale.setScalar(r); disc.scale.setScalar(r * Math.max(0.05, fill))
      ;(disc.material as T.MeshBasicMaterial).color.set(color); (ring.material as T.MeshBasicMaterial).color.set(color)
      ;(disc.material as T.MeshBasicMaterial).opacity = z.wait > 0 ? 0.28 + fill * 0.25 : 0.22 + Math.sin(time * 9) * 0.07
    })
  }
  private adapt(ms: number) {
    this.frameMs += (ms - this.frameMs) * 0.08
    let next = this.pixels
    if (this.frameMs > 19 && this.pixels > 1) { next = Math.max(1, this.pixels - 0.25); this.calm = 0; this.frameMs = 16.7 }
    else if (this.frameMs < 17.2) { if ((this.calm += ms) > 4000 && this.pixels < this.maxPixels) { next = Math.min(this.maxPixels, this.pixels + 0.25); this.calm = 0 } }
    else this.calm = 0
    if (next !== this.pixels) { this.pixels = next; this.renderer.setPixelRatio(next); this.resize() }
  }
  private explode(z: { x: number; y: number; r: number; foe: boolean }) {
    const x = z.x / UNIT, zz = z.y / UNIT, r = z.r / UNIT, color = z.foe ? '#ff6a4a' : '#8fd8ff'
    this.vfx.ring(x, zz, color, r * 0.25, r * 1.12, 0.5); this.vfx.ring(x, zz, '#fff4d0', r * 0.1, r * 0.7, 0.3)
    this.vfx.pillar(x, zz, color, r * 0.45, 9, 0.5); this.vfx.ghost(x, 1.2, zz, r * 1.5, color, 0.25, 0.4)
    this.vfx.burst(x, 0.6, zz, color, 40, r * 3.2, 10, 0.8)
    const me = this.sim.player
    if (Math.hypot(z.x - me.x, z.y - me.y) < 800) this.shake = Math.max(this.shake, 0.4)
  }
  private drawAim(aim: AimPreview, time: number) {
    const sim = this.sim, me = sim.player
    this.aimArrow.visible = this.aimCircle.visible = this.aimRange.visible = false
    if (aim && me.alive) {
      const skill = aim.skill, range = skill.range / UNIT
      this.aimRange.visible = true; this.aimRange.position.copy(at(me, 0.11)); this.aimRange.scale.setScalar(range)
      if (skill.aim === 'dir' && aim.dir) {
        const first = skill.fx.find(f => f.t === 'shot' || f.t === 'dash' || f.t === 'cone')
        const width = first?.t === 'shot' ? first.width : first?.t === 'dash' ? Math.max(60, first.width ?? 60) : first?.t === 'cone' ? first.radius * 1.1 : 60
        this.aimArrow.visible = true; this.aimArrow.position.copy(at(me, 0.12)); this.aimArrow.scale.set(width / UNIT, range, 1)
        this.aimArrow.rotation.set(-Math.PI / 2, 0, -Math.atan2(aim.dir.x, -aim.dir.y))
      } else if (skill.aim === 'point' && aim.point) {
        const area = skill.fx.find(f => f.t === 'blast' || f.t === 'zone')
        this.aimCircle.visible = true; this.aimCircle.position.copy(at(aim.point, 0.12)); this.aimCircle.scale.setScalar((area && 'radius' in area ? area.radius : 70) / UNIT)
      } else if (skill.aim === 'self') {
        this.aimCircle.visible = true; this.aimCircle.position.copy(at(me, 0.12)); this.aimCircle.scale.setScalar(range)
      }
    }
    // A solid ring on the locked target; a lighter one on who the attack button would lock next.
    const locked = sim.byId(sim.stickyTarget), target = locked ?? (me.alive ? sim.lockCandidate() : undefined)
    this.targetRing.visible = Boolean(target && me.alive)
    ;(this.targetRing.material as T.MeshBasicMaterial).opacity = locked ? 0.95 : 0.45
    if (target) { this.targetRing.position.copy(at(target, 0.13)); this.targetRing.scale.setScalar((target.r + 16) / UNIT * (1 + Math.sin(time * 8) * 0.05)) }
    // Warn before the player walks into a tower: its reach, and a line once it has locked on.
    const tower = me.alive ? sim.units.find(u => u.alive && (u.kind === 'tower' || u.kind === 'base') && u.team !== me.team && Math.hypot(u.x - me.x, u.y - me.y) < u.range + 320) : undefined
    this.dangerRing.visible = Boolean(tower); this.dangerLine.visible = Boolean(tower && tower.targetId === me.id)
    if (tower) {
      this.dangerRing.position.copy(at(tower, 0.1)); this.dangerRing.scale.setScalar(tower.range / UNIT)
      if (this.dangerLine.visible) {
        const dx = me.x - tower.x, dy = me.y - tower.y
        this.dangerLine.position.copy(at(tower, 0.14)); this.dangerLine.scale.set(0.35, Math.hypot(dx, dy) / UNIT, 1); this.dangerLine.rotation.set(-Math.PI / 2, 0, -Math.atan2(dx, -dy))
      }
    }
    this.recallRing.visible = me.alive && me.recallT > 0
    if (this.recallRing.visible) { this.recallRing.position.copy(at(me, 0.16)); this.recallRing.scale.setScalar(1.2 + (me.recallT / 3.5) * 2.2); this.recallRing.rotation.z = time * 3 }
  }
  get loaded() { return this.ready }
  destroy() {
    this.cleanup.forEach(fn => fn()); this.cleanup = []
    this.overlay.remove(); this.vfx.dispose()
    disposeObject(this.scene)
    this.renderer.dispose()
  }
}
