import * as T from 'three'
import type { DynastyBattle } from './engine'
import { clamp, distance, Vec, WORLD } from './model'
import { BUILDINGS, ENVOYS, GROVE, HOMES, POND, ROAD_EDGES, ROAD_NODES, STALLS, UNIT, WELL } from './layout'
import { ActorRig, disposeObject, makeActor, makeBanner, makeBuilding, makeCart, makeLegacy, makeStall, makeVillager, makeWell, materials, mergeStatic, Rig, straw } from './models3d'
import type { Villager } from './village'
import { loadVillageSurfaces, makeCarriedSupplies, makeDistrictDetails } from './districtArt'

// Engine pixels → world units on the ground plane (engine y is the 3D z axis).
const at = (p: Vec, h = 0) => new T.Vector3(p.x / UNIT, h, p.y / UNIT)
const W = WORLD.width / UNIT, H = WORLD.height / UNIT
// Destiny sets the weather: an uncertain mandate is overcast, a firm one is golden afternoon.
const LIGHT = [
  { sun: '#b4bfca', sunI: 1.7, sky: '#a4aeb4', ground: '#46453b', hemiI: 1.2, fog: '#8c9598', top: '#6f7f8c', horizon: '#a9b0b2' },
  { sun: '#ffe3b5', sunI: 2.5, sky: '#dfe6d0', ground: '#554d38', hemiI: 1.2, fog: '#bcc3ad', top: '#86a8c0', horizon: '#e2dcc4' },
  { sun: '#ffd08a', sunI: 3, sky: '#f3e5c2', ground: '#5c4f33', hemiI: 1.3, fog: '#e0cfa2', top: '#7fa3c6', horizon: '#f3d9a3' },
]
type Placed = { root: T.Group; born: number; count: number; puffs: T.Mesh[]; flames: T.Mesh[] }

export class WorldRenderer {
  private renderer: T.WebGLRenderer
  private scene = new T.Scene()
  private camera = new T.PerspectiveCamera(42, 1, .3, 420)
  private sun = new T.DirectionalLight('#ffe3b5', 2.5)
  private hemi = new T.HemisphereLight('#dfe6d0', '#554d38', 1.2)
  private sky: T.Mesh<T.SphereGeometry, T.ShaderMaterial>
  private fog = new T.Fog('#bcc3ad', 50, 200)
  private overlay = document.createElement('div')
  private labels = new Map<string, HTMLDivElement>()
  private used = new Set<string>()
  private player = makeActor('player')
  private playerRing: T.Mesh
  private carried = makeCarriedSupplies()
  private surfaces: ReturnType<typeof loadVillageSurfaces>
  private enemies = new Map<number, ActorRig>()
  private villagers = new Map<number, { rig: Rig | ActorRig; heading: number }>()
  private envoys: ActorRig[] = []
  private legacy = new Map<number, Placed>()
  private effects = new Map<object, T.Mesh>()
  private textOrigins = new Map<object, T.Vector3>()
  private enemyCloth = new Map<number, T.MeshStandardMaterial>()
  private buildings: { box: T.Box3; mats: T.Material[]; fade: number }[] = []
  private banners: (ReturnType<typeof makeBanner> & { owned?: boolean })[] = []
  private rings: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>[] = []
  private capture: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>
  private stalls: T.Group[] = []
  private cart = makeCart()
  private porter = makeVillager('farmer', '#7d6a4f')
  private convoy: Rig[] = []
  private beacon = new T.Group()
  private discs: T.Mesh[] = []
  private lines: T.Mesh[] = []
  private particles: T.Points<T.BufferGeometry, T.PointsMaterial>
  private particleHeight = new WeakMap<object, number>()
  private ids = new WeakMap<object, number>()
  private nextId = 0
  private heading = Math.PI
  private yaw = 0; private yawTarget = 0; private pitch = .76; private pitchTarget = .76; private zoom = 21; private zoomTarget = 21
  private focus = new T.Vector3(900 / UNIT, 0, 590 / UNIT)
  private pointers = new Map<number, { x: number; y: number }>()
  private clock = 0
  private last = performance.now()
  private lastWagon = new T.Vector3()
  private lastStep = 0
  private cleanup: (() => void)[] = []
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private temp = new T.Vector3()
  private ray = new T.Ray()
  constructor(private canvas: HTMLCanvasElement, context: WebGL2RenderingContext) {
    this.renderer = new T.WebGLRenderer({ canvas, context, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2))
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFShadowMap
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05
    canvas.dataset.renderer = '3d'
    this.scene.fog = this.fog
    this.sky = new T.Mesh(new T.SphereGeometry(300, 32, 16), new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new T.Color('#86a8c0') }, horizon: { value: new T.Color('#e2dcc4') } },
      vertexShader: 'varying float h; void main() { h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying float h; void main() { gl_FragColor = vec4(mix(horizon, top, smoothstep(-0.05, 0.45, h)), 1.0); }',
    }))
    this.scene.add(this.sky, this.hemi, this.sun, this.sun.target)
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048)
    Object.assign(this.sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 110 })
    this.sun.shadow.bias = -.0004; this.sun.shadow.normalBias = .03
    this.surfaces = loadVillageSurfaces(this.renderer.capabilities.getMaxAnisotropy())
    this.buildTerrain(); this.buildVillage()
    this.player.root.add(this.carried.root)
    this.scene.add(this.player.root)
    this.playerRing = new T.Mesh(new T.RingGeometry(.62, .74, 36), new T.MeshBasicMaterial({ color: '#f4d68e', transparent: true, opacity: .75, depthWrite: false }))
    this.playerRing.rotation.x = -Math.PI / 2; this.scene.add(this.playerRing)
    ENVOYS.forEach((p, i) => { const rig = makeActor('civilian', ['#4f7d7e', '#9a8c58', '#8a5140'][i]); rig.root.position.copy(at(p)); this.scene.add(rig.root); this.envoys.push(rig) })
    this.scene.add(this.cart.root, this.porter.root)
    for (let i = 0; i < 4; i++) { const rig = makeVillager(i % 2 ? 'settler' : 'elder', ['#8d8069', '#766b58'][i % 2]); this.convoy.push(rig); this.scene.add(rig.root) }
    this.buildBeacon()
    this.capture = new T.Mesh(new T.RingGeometry(4.3, 4.6, 48, 1, 0, .01), new T.MeshBasicMaterial({ color: '#f1d39a', transparent: true, depthWrite: false }))
    this.capture.rotation.x = -Math.PI / 2; this.scene.add(this.capture)
    const count = 260
    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(count * 3), 3))
    geometry.setAttribute('color', new T.BufferAttribute(new Float32Array(count * 3), 3))
    this.particles = new T.Points(geometry, new T.PointsMaterial({ size: .24, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }))
    this.particles.frustumCulled = false; this.scene.add(this.particles)
    Object.assign(this.overlay.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' })
    this.overlay.className = 'world-labels'; canvas.after(this.overlay)
    this.bindInput()
    const observer = new ResizeObserver(() => this.resize()); observer.observe(canvas); this.resize()
    this.cleanup.push(() => observer.disconnect())
  }
  private resize() {
    const rect = this.canvas.getBoundingClientRect(), w = Math.max(320, rect.width), h = Math.max(300, rect.height)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h; this.camera.fov = w / h < .8 ? 54 : 42; this.camera.updateProjectionMatrix()
  }
  // Drag to orbit, wheel or pinch to zoom. The joystick is a separate element, so touches here only steer the camera.
  private bindInput() {
    const canvas = this.canvas
    const down = (e: PointerEvent) => { this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture?.(e.pointerId) }
    const move = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId)
      if (!p) return
      if (this.pointers.size === 1) { this.yawTarget -= (e.clientX - p.x) * .0065; this.pitchTarget = clamp(this.pitchTarget + (e.clientY - p.y) * .004, .5, 1.25) }
      else {
        const [a, b] = [...this.pointers.values()], before = Math.hypot(a.x - b.x, a.y - b.y)
        p.x = e.clientX; p.y = e.clientY
        const after = Math.hypot(a.x - b.x, a.y - b.y)
        if (before > 0) this.zoomTarget = clamp(this.zoomTarget * before / Math.max(1, after), 13, 42)
      }
      p.x = e.clientX; p.y = e.clientY
    }
    const up = (e: PointerEvent) => { this.pointers.delete(e.pointerId) }
    const wheel = (e: WheelEvent) => { e.preventDefault(); this.zoomTarget = clamp(this.zoomTarget * (1 + e.deltaY * .0012), 13, 42) }
    const menu = (e: Event) => e.preventDefault()
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('contextmenu', menu)
    this.cleanup.push(() => {
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('contextmenu', menu)
    })
  }
  private paintGround(grassImage?: HTMLImageElement, earthImage?: HTMLImageElement) {
    const scale = 2048 / WORLD.width, canvas = document.createElement('canvas')
    canvas.width = 2048; canvas.height = Math.round(WORLD.height * scale)
    const g = canvas.getContext('2d')!
    g.scale(scale, scale)
    let seed = 7
    const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647
    const pattern = (image: HTMLImageElement) => {
      const tile = document.createElement('canvas'); tile.width = tile.height = 160
      tile.getContext('2d')!.drawImage(image, 0, 0, 160, 160)
      return g.createPattern(tile, 'repeat')!
    }
    g.fillStyle = grassImage ? pattern(grassImage) : '#5b6641'; g.fillRect(0, 0, WORLD.width, WORLD.height)
    const grass = ['#63704a', '#525d3b', '#6b7450', '#4c5638', '#707048']
    // Broad soft patches, then fine tufts, so the field reads as grass at any zoom.
    for (let i = 0; i < 260; i++) {
      const x = rand() * WORLD.width, y = rand() * WORLD.height, r = 40 + rand() * 110, patch = g.createRadialGradient(x, y, 0, x, y, r)
      patch.addColorStop(0, i % 3 ? 'rgba(112,116,72,.35)' : 'rgba(64,78,48,.35)'); patch.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = patch; g.fillRect(x - r, y - r, r * 2, r * 2)
    }
    for (let i = 0; i < 16000; i++) {
      g.globalAlpha = .18 + rand() * .22; g.fillStyle = grass[i % grass.length]
      g.fillRect(rand() * WORLD.width, rand() * WORLD.height, 1.5 + rand() * 3, 1 + rand() * 2)
    }
    g.globalAlpha = 1
    // Terraced fields east of the granary.
    for (let y = 390; y < 700; y += 14) { g.fillStyle = y % 28 ? '#6a5a3d' : '#5e5236'; g.fillRect(1450, y, 310, 10) }
    const road = (width: number, color: string | CanvasPattern) => {
      g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = color; g.lineWidth = width
      for (const [a, b] of ROAD_EDGES) { g.beginPath(); g.moveTo(ROAD_NODES[a].x, ROAD_NODES[a].y); g.lineTo(ROAD_NODES[b].x, ROAD_NODES[b].y); g.stroke() }
    }
    const earth = earthImage ? pattern(earthImage) : '#8b7b5e'
    g.globalAlpha = .2; road(62, earth)
    g.globalAlpha = .35; road(53, earth)
    g.globalAlpha = .65; road(44, earth)
    g.globalAlpha = 1; road(34, earth)
    for (let i = 0; i < (earthImage ? 0 : 900); i++) {
      const [a, b] = ROAD_EDGES[i % ROAD_EDGES.length], t = rand(), p = ROAD_NODES[a], q = ROAD_NODES[b]
      g.fillStyle = rand() < .5 ? '#8a7757' : '#b09c78'; g.globalAlpha = .6
      g.fillRect(p.x + (q.x - p.x) * t + (rand() - .5) * 40, p.y + (q.y - p.y) * t + (rand() - .5) * 40, 3, 2)
    }
    g.globalAlpha = 1
    const paved = (x: number, y: number, w: number, h: number) => {
      g.fillStyle = '#8f8876'; g.fillRect(x, y, w, h)
      g.strokeStyle = 'rgba(58,52,42,.35)'; g.lineWidth = 1.5
      for (let i = x; i <= x + w; i += 32) { g.beginPath(); g.moveTo(i, y); g.lineTo(i, y + h); g.stroke() }
      for (let j = y; j <= y + h; j += 22) { g.beginPath(); g.moveTo(x, j); g.lineTo(x + w, j); g.stroke() }
      g.strokeStyle = '#6f6857'; g.lineWidth = 5; g.strokeRect(x, y, w, h)
    }
    paved(820, 190, 260, 130); paved(700, 875, 400, 200); paved(340, 290, 220, 90)
    g.fillStyle = '#978a6c'; g.fillRect(1265, 280, 230, 110)
    g.fillStyle = '#8d8672'; g.beginPath(); g.arc(390, 790, 150, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#6f6857'; g.lineWidth = 4
    for (const r of [60, 105, 150]) { g.beginPath(); g.arc(390, 790, r, 0, Math.PI * 2); g.stroke() }
    g.fillStyle = '#4b4632'; g.beginPath(); g.arc(POND.x, POND.y, POND.r + 22, 0, Math.PI * 2); g.fill()
    const texture = new T.CanvasTexture(canvas)
    texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    return texture
  }
  private buildTerrain() {
    const ground = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshStandardMaterial({ map: this.paintGround(), roughness: 1 }))
    ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, H / 2); ground.receiveShadow = true; this.scene.add(ground)
    // Load detail asynchronously: the playable world is available immediately.
    // If assets fail, the painted terrain remains a usable fallback.
    let disposed = false
    this.cleanup.push(() => { disposed = true })
    const terrain = ['grass', 'earth'].map(name => {
      const image = new Image(); image.src = `arts/v3-ui/${name}-v1.jpg`
      return image.decode().then(() => image)
    })
    Promise.all(terrain).then(([grass, earth]) => {
      if (disposed) return
      ground.material.map?.dispose(); ground.material.map = this.paintGround(grass, earth)
      ground.material.needsUpdate = true
      this.canvas.dataset.terrain = 'textured'
    }).catch(() => { /* retain the procedural ground */ })
    const outer = new T.Mesh(new T.PlaneGeometry(700, 700), new T.MeshStandardMaterial({ color: '#46523a', roughness: 1 }))
    outer.rotation.x = -Math.PI / 2; outer.position.set(W / 2, -.05, H / 2); this.scene.add(outer)
    let seed = 11
    const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647
    // Forest band beyond the palisade, plus the solid grove trees inside it.
    const trees: { x: number; z: number; s: number; pine: boolean }[] = GROVE.map(t => ({ x: t.x / UNIT, z: t.y / UNIT, s: 1 + rand() * .3, pine: rand() < .3 }))
    while (trees.length < 260) {
      const x = -14 + rand() * (W + 28), z = -14 + rand() * (H + 28)
      // Keep the band south of the palisade (between camera and village) clear of tall trees.
      if ((x > 1.2 && x < W - 1.2 && z > 1.2 && z < H - 1.2) || (z > H - 1.2 && z < H + 6 && x > 0 && x < W)) continue
      trees.push({ x, z, s: .9 + rand() * .8, pine: rand() < .45 })
    }
    const trunk = new T.InstancedMesh(new T.CylinderGeometry(.16, .26, 1.8, 6), materials.wood, trees.length)
    const leafGeometry = new T.IcosahedronGeometry(1.35, 1), pineGeometry = new T.ConeGeometry(1.3, 3.2, 7)
    const broad = trees.filter(t => !t.pine), pines = trees.filter(t => t.pine)
    const leaves = new T.InstancedMesh(leafGeometry, new T.MeshStandardMaterial({ roughness: 1, flatShading: true }), broad.length * 2)
    const needles = new T.InstancedMesh(pineGeometry, new T.MeshStandardMaterial({ roughness: 1, flatShading: true }), pines.length)
    const m = new T.Matrix4(), q = new T.Quaternion(), color = new T.Color(), palette = ['#5f7948', '#6d8150', '#4f683e', '#87925c', '#566f45']
    trees.forEach((t, i) => { m.compose(new T.Vector3(t.x, .9 * t.s, t.z), q, new T.Vector3(t.s, t.s, t.s)); trunk.setMatrixAt(i, m) })
    broad.forEach((t, i) => {
      q.setFromEuler(new T.Euler(0, rand() * 3, 0))
      m.compose(new T.Vector3(t.x, 2.5 * t.s, t.z), q, new T.Vector3(t.s * 1.1, t.s, t.s * 1.1)); leaves.setMatrixAt(i * 2, m)
      m.compose(new T.Vector3(t.x + .3, 3.4 * t.s, t.z - .2), q, new T.Vector3(t.s * .75, t.s * .7, t.s * .75)); leaves.setMatrixAt(i * 2 + 1, m)
      leaves.setColorAt(i * 2, color.set(palette[i % palette.length])); leaves.setColorAt(i * 2 + 1, color.set(palette[(i + 2) % palette.length]))
    })
    pines.forEach((t, i) => { m.compose(new T.Vector3(t.x, 2.6 * t.s, t.z), q.identity(), new T.Vector3(t.s, t.s, t.s)); needles.setMatrixAt(i, m); needles.setColorAt(i, color.set(i % 2 ? '#3f5a3e' : '#4b6644')) })
    for (const im of [trunk, leaves, needles]) { im.castShadow = true; im.receiveShadow = true; this.scene.add(im) }
    // Palisade on the edge of the walkable field.
    const posts: T.Vector3[] = []
    for (let x = 1.2; x <= W - 1.2; x += .9) posts.push(new T.Vector3(x, 0, 1.2), new T.Vector3(x, 0, H - 1.2))
    for (let z = 2.1; z < H - 1.2; z += .9) posts.push(new T.Vector3(1.2, 0, z), new T.Vector3(W - 1.2, 0, z))
    const fence = new T.InstancedMesh(new T.CylinderGeometry(.1, .12, 1.5, 5), materials.wood, posts.length)
    posts.forEach((p, i) => { m.compose(new T.Vector3(p.x, .75 + (i % 3) * .06, p.z), q.identity(), new T.Vector3(1, 1, 1)); fence.setMatrixAt(i, m) })
    fence.castShadow = true; this.scene.add(fence)
    for (const [x, z, w, d] of [[W / 2, 1.2, W - 2.4, .08], [W / 2, H - 1.2, W - 2.4, .08], [1.2, H / 2, .08, H - 2.4], [W - 1.2, H / 2, .08, H - 2.4]]) {
      for (const y of [.55, 1.1]) { const rail = new T.Mesh(new T.BoxGeometry(w, .08, d), materials.wood); rail.position.set(x, y, z); rail.castShadow = true; this.scene.add(rail) }
    }
    // Fields, pond, rocks and far mountains.
    const crops: T.Vector3[] = []
    const nearRoad = (x: number, y: number) => ROAD_EDGES.some(([a, b]) => { const p = ROAD_NODES[a], r = ROAD_NODES[b], dx = r.x - p.x, dy = r.y - p.y, t = clamp(((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(x - p.x - dx * t, y - p.y - dy * t) < 42 })
    for (let y = 395; y < 700; y += 14) for (let x = 1460; x < 1755; x += 19) if (!nearRoad(x, y) && !GROVE.some(g => distance(g, { x, y }) < 40)) crops.push(new T.Vector3(x / UNIT, 0, y / UNIT))
    const crop = new T.InstancedMesh(new T.ConeGeometry(.13, .55, 5), new T.MeshStandardMaterial({ color: '#8b9a4f', roughness: 1, flatShading: true }), crops.length)
    crops.forEach((p, i) => { m.compose(new T.Vector3(p.x + (rand() - .5) * .1, .27, p.z), q.identity(), new T.Vector3(1, .8 + rand() * .5, 1)); crop.setMatrixAt(i, m) })
    crop.receiveShadow = true; this.scene.add(crop)
    const water = new T.Mesh(new T.CircleGeometry(POND.r / UNIT, 40), new T.MeshStandardMaterial({ color: '#4d6d68', roughness: .08, metalness: .3, transparent: true, opacity: .9 }))
    water.rotation.x = -Math.PI / 2; water.position.copy(at(POND, .05)); water.receiveShadow = true; this.scene.add(water)
    const stones = new T.InstancedMesh(new T.DodecahedronGeometry(.35, 0), materials.stone, 64)
    for (let i = 0; i < 64; i++) {
      const edge = i < 22, a = i / 22 * Math.PI * 2, r = POND.r / UNIT + .2
      const p = edge ? new T.Vector3(POND.x / UNIT + Math.cos(a) * r, .1, POND.y / UNIT + Math.sin(a) * r) : new T.Vector3(rand() < .5 ? rand() * 1.5 : W - rand() * 1.5, .1, rand() * H)
      q.setFromEuler(new T.Euler(rand(), rand(), rand())); const s = .6 + rand() * .9
      m.compose(p, q, new T.Vector3(s, s * .6, s)); stones.setMatrixAt(i, m)
    }
    stones.castShadow = true; stones.receiveShadow = true; this.scene.add(stones)
    const lotus = new T.InstancedMesh(new T.CylinderGeometry(.35, .35, .03, 10), new T.MeshStandardMaterial({ color: '#5f7d4a', roughness: .8 }), 9)
    for (let i = 0; i < 9; i++) { const a = rand() * 6.28, r = rand() * 2.8; m.compose(new T.Vector3(POND.x / UNIT + Math.cos(a) * r, .08, POND.y / UNIT + Math.sin(a) * r), q.identity(), new T.Vector3(1, 1, 1)); lotus.setMatrixAt(i, m) }
    this.scene.add(lotus)
    const hills = new T.MeshStandardMaterial({ color: '#56655d', roughness: 1, flatShading: true })
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + rand() * .3, r = 120 + rand() * 60, peak = new T.Mesh(new T.ConeGeometry(28 + rand() * 30, 18 + rand() * 26, 6), hills)
      peak.position.set(W / 2 + Math.cos(a) * r, 6, H / 2 + Math.sin(a) * r); peak.rotation.y = rand() * 3; this.scene.add(peak)
    }
  }
  private buildVillage() {
    for (const b of BUILDINGS) {
      const group = makeBuilding(b, this.surfaces)
      group.add(makeDistrictDetails(b, this.surfaces))
      const merged = mergeStatic(group), mats: T.Material[] = []
      for (const child of merged.children) { const item = child as T.Mesh, own = (item.material as T.Material).clone(); item.material = own; mats.push(own) }
      this.scene.add(merged, group) // group keeps only the name sign sprite
      this.buildings.push({ box: new T.Box3().setFromObject(merged).expandByScalar(.2), mats, fade: 1 })
    }
    const well = makeWell(); well.position.copy(at(WELL)); this.scene.add(well)
    STALLS.forEach((s, i) => { const stall = makeStall(['#8e3930', '#365e59', '#b58a3c', '#5b4a7a', '#8e3930'][i]); stall.position.copy(at(s)); stall.rotation.y = Math.PI; this.scene.add(stall); this.stalls.push(stall) })
    for (const [x, y] of [[1520, 250], [1560, 300], [1250, 250]]) { const hay = new T.Mesh(new T.ConeGeometry(1, 1.6, 9), straw); hay.position.set(x / UNIT, .8, y / UNIT); hay.castShadow = true; this.scene.add(hay) }
    for (const city of [{ x: 450, y: 330 }, { x: 1380, y: 320 }, { x: 900, y: 915 }, { x: 950, y: 240 }, { x: 390, y: 850 }]) {
      const banner = makeBanner(); banner.root.position.copy(at({ x: city.x + 78, y: city.y - 22 })); this.scene.add(banner.root); this.banners.push(banner)
      const ring = new T.Mesh(new T.RingGeometry(4.45, 4.6, 64), new T.MeshBasicMaterial({ color: '#edc989', transparent: true, opacity: .32, depthWrite: false }))
      ring.rotation.x = -Math.PI / 2; ring.position.copy(at(city, .04)); this.scene.add(ring); this.rings.push(ring)
    }
  }
  private buildBeacon() {
    const gradient = document.createElement('canvas'); gradient.width = 4; gradient.height = 64
    const g = gradient.getContext('2d')!, fill = g.createLinearGradient(0, 0, 0, 64)
    fill.addColorStop(0, 'rgba(255,225,160,0)'); fill.addColorStop(1, 'rgba(255,225,160,.55)'); g.fillStyle = fill; g.fillRect(0, 0, 4, 64)
    const texture = new T.CanvasTexture(gradient)
    const beam = new T.Mesh(new T.CylinderGeometry(.32, .32, 22, 16, 1, true), new T.MeshBasicMaterial({ map: texture, color: '#ffd27a', opacity: .45, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }))
    beam.position.y = 11; beam.name = 'beam'
    const ring = new T.Mesh(new T.RingGeometry(1.2, 1.55, 40), new T.MeshBasicMaterial({ color: '#ffe1a0', transparent: true, opacity: .85, depthWrite: false }))
    ring.rotation.x = -Math.PI / 2; ring.position.y = .06; ring.name = 'ring'
    this.beacon.add(beam, ring); this.scene.add(this.beacon)
  }
  private idFor(object: object) { let id = this.ids.get(object); if (id === undefined) { id = this.nextId++; this.ids.set(object, id) } return id }
  private label(key: string, text: string, position: T.Vector3, kind: string, bar?: number) {
    this.used.add(key)
    let el = this.labels.get(key)
    if (!el) { el = document.createElement('div'); el.className = `wl wl-${kind}`; if (bar !== undefined) el.append(document.createElement('i')); this.overlay.append(el); this.labels.set(key, el) }
    const v = this.temp.copy(position).project(this.camera), w = this.overlay.clientWidth, h = this.overlay.clientHeight
    if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { el.style.display = 'none'; return }
    el.style.display = ''
    if (bar !== undefined) (el.firstChild as HTMLElement).style.width = `${Math.max(0, bar) * 100}%`
    else if (el.textContent !== text) el.textContent = text
    el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`
  }
  private pose(rig: Rig | ActorRig, moving: boolean, step: number, time: number, mood?: string) {
    const s = moving ? Math.sin(step) : 0, lift = mood === 'afraid' ? -1.1 : 0
    rig.leftLeg.rotation.x = s * .75; rig.rightLeg.rotation.x = -s * .75
    rig.leftArm.rotation.x = -s * .6 + lift; rig.rightArm.rotation.x = s * .6 + lift
    rig.leftArm.rotation.z = 0; rig.rightArm.rotation.z = 0
    const body = 'body' in rig ? rig.body : rig.root
    body.position.y = moving ? Math.abs(Math.sin(step)) * .07 : Math.sin(time * 2) * .012
    if (mood === 'cheer') {
      body.position.y = Math.abs(Math.sin(time * 7)) * .28
      rig.leftArm.rotation.x = rig.rightArm.rotation.x = -2.7 + Math.sin(time * 9) * .25
    }
  }
  private turn(current: number, target: number, dt: number) {
    const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current))
    return current + delta * Math.min(1, dt * 12)
  }
  private setLighting(destiny: number, dt: number) {
    const t = clamp((destiny - 1) / 4, 0, 1), a = LIGHT[t < .5 ? 0 : 1], b = LIGHT[t < .5 ? 1 : 2], k = t < .5 ? t * 2 : (t - .5) * 2, blend = Math.min(1, dt * 1.5)
    const mix = (from: T.Color, x: string, y: string) => from.lerp(new T.Color(x).lerp(new T.Color(y), k), blend)
    mix(this.sun.color, a.sun, b.sun); mix(this.hemi.color, a.sky, b.sky); mix(this.hemi.groundColor, a.ground, b.ground)
    mix(this.fog.color, a.fog, b.fog); mix(this.sky.material.uniforms.top.value, a.top, b.top); mix(this.sky.material.uniforms.horizon.value, a.horizon, b.horizon)
    this.sun.intensity += (a.sunI + (b.sunI - a.sunI) * k - this.sun.intensity) * blend
    this.hemi.intensity += (a.hemiI + (b.hemiI - a.hemiI) * k - this.hemi.intensity) * blend
  }
  draw(game: DynastyBattle) {
    const now = performance.now(), dt = Math.min(.05, (now - this.last) / 1000); this.last = now; this.clock += dt
    const time = this.clock, village = game.village, playing = game.status === 'playing'
    this.used.clear()
    // Camera: orbit target follows the hero; the engine reads the yaw back so W always walks "into" the screen.
    this.yawTarget -= game.cameraTurn * dt * 1.9
    const ease = 1 - Math.exp(-dt * 10)
    this.yaw += (this.yawTarget - this.yaw) * ease; this.pitch += (this.pitchTarget - this.pitch) * ease; this.zoom += (this.zoomTarget - this.zoom) * ease
    game.cameraYaw = this.yaw
    this.setLighting(village.realm.destiny, dt)
    // Hero.
    const p = game.player, hero = this.player
    hero.root.position.copy(at(p))
    this.heading = this.turn(this.heading, p.heading, dt)
    hero.root.rotation.y = this.heading
    const moving = playing && this.lastStep !== p.step
    this.lastStep = p.step
    this.pose(hero, moving, p.step, time)
    const carrying = game.carrying, papers = game.order?.kind === 'ceremony'
    const medicine = /药|医/.test(game.order?.cargo ?? '')
    this.carried.root.visible = carrying
    this.carried.scroll.visible = papers
    this.carried.medicine.visible = !papers && medicine
    this.carried.parcel.visible = !papers && !medicine
    if (carrying) { hero.leftArm.rotation.x = -.95; hero.rightArm.rotation.x = -.95 }
    if (p.swing > 0) { const k = 1 - p.swing / .26; hero.rightArm.rotation.x = -2.2 + k * 2.9; hero.rightArm.rotation.z = -.3 }
    hero.cape.rotation.x = -.15 - (moving ? .35 : 0) - Math.sin(time * 3) * .04
    hero.root.visible = !(p.hurt > 0 && Math.floor(time * 20) % 2)
    this.playerRing.position.copy(at(p, .04))
    // Enemies.
    const alive = new Set<number>()
    for (const e of game.enemies) {
      alive.add(e.id)
      let rig = this.enemies.get(e.id)
      if (!rig) {
        rig = makeActor(e.kind, '#7c3b32'); this.enemies.set(e.id, rig); this.scene.add(rig.root)
        rig.root.traverse(o => { if (o instanceof T.Mesh && o.material instanceof T.MeshStandardMaterial && o.material.color.getHexString() === '7c3b32') this.enemyCloth.set(e.id, o.material) })
      }
      rig.root.position.copy(at(e)); rig.root.rotation.y = Math.atan2(p.x - e.x, p.y - e.y)
      this.pose(rig, playing && e.windup <= 0 && distance(e, p) > e.radius + 30, e.step, time)
      if (e.windup > 0) rig.rightArm.rotation.x = -2.4
      this.enemyCloth.get(e.id)?.emissive.setScalar(e.flash > 0 ? .6 : 0)
      if (e.hp < e.maxHp) this.label(`hp${e.id}`, '', at(e, e.kind === 'brute' ? 3 : 2.45), 'hp', e.hp / e.maxHp)
    }
    for (const [id, rig] of this.enemies) if (!alive.has(id)) { this.scene.remove(rig.root); disposeObject(rig.root); this.enemies.delete(id); this.enemyCloth.delete(id) }
    // Villagers: the same crowd that reacts to orders, flees fighting and remembers past choices.
    const present = new Set<number>()
    for (const v of village.people) {
      present.add(v.id)
      let entry = this.villagers.get(v.id)
      if (!entry) { entry = { rig: v.role === 'guard' ? makeActor('soldier', v.tint) : makeVillager(v.role, v.tint), heading: v.heading }; this.villagers.set(v.id, entry); this.scene.add(entry.rig.root) }
      this.placeVillager(entry, v, dt, time)
      if (v.talk > 0) this.label(`say${v.id}`, v.line, at(v, 2.5), 'say')
    }
    for (const [id, entry] of this.villagers) if (!present.has(id)) { this.scene.remove(entry.rig.root); disposeObject(entry.rig.root); this.villagers.delete(id) }
    const names = ['行宫文官', '城镇乡老', '关隘军官']
    this.envoys.forEach((rig, i) => {
      rig.root.rotation.y = this.turn(rig.root.rotation.y, distance(ENVOYS[i], p) < 260 ? Math.atan2(p.x - ENVOYS[i].x, p.y - ENVOYS[i].y) : 0, dt)
      this.pose(rig, false, 0, time + i)
      const next = game.order?.kind === 'council' && !game.completed.has(i) && ENVOYS.findIndex((_, j) => !game.completed.has(j)) === i
      if (distance(ENVOYS[i], p) < 700 || next) this.label(`envoy${i}`, next ? `${names[i]} · 待拜访` : names[i], at(ENVOYS[i], 2.55), next ? 'name wl-next' : 'name')
    })
    this.drawConvoy(game, dt, time)
    this.drawEffects(game, time)
    this.drawLegacy(game, time)
    // Places: banners switch from the old garrison's 守 to your 鼎 as orders land there.
    const band = village.realm.economy
    this.stalls.forEach((s, i) => { s.getObjectByName('open')!.visible = i < band; s.getObjectByName('closed')!.visible = i >= band })
    game.cities.forEach((city, i) => {
      const banner = this.banners[i], mat = banner.cloth.material as T.MeshStandardMaterial
      if (banner.owned !== city.owned) { banner.owned = city.owned; mat.map = city.owned ? banner.textures.owned : banner.textures.held; mat.needsUpdate = true }
      const pos = banner.cloth.geometry.attributes.position as T.BufferAttribute
      for (let j = 0; j < pos.count; j++) { const x = banner.base[j * 3]; pos.setZ(j, Math.sin(x * 3 - time * 4 + i) * .12 * x) }
      pos.needsUpdate = true
      this.rings[i].material.color.set(city.owned ? '#93c7aa' : '#edc989')
    })
    const site = game.order?.kind === 'assault' ? game.cities.find(c => distance(c, game.order!.target) < 20) : undefined
    this.capture.visible = Boolean(site && site.progress > 0 && !site.owned)
    if (site && this.capture.visible) {
      this.capture.geometry.dispose(); this.capture.geometry = new T.RingGeometry(4.25, 4.7, 48, 1, Math.PI / 2, -site.progress / 100 * Math.PI * 2)
      this.capture.position.copy(at(site, .06))
    }
    // Objective beacon, interaction prompts and HUD-like labels.
    const target = game.interactionTarget(), beam = this.beacon.getObjectByName('beam')!, ring = this.beacon.getObjectByName('ring')!
    this.beacon.position.copy(at(target)); beam.visible = distance(target, p) > 160
    ring.scale.setScalar(1 + Math.sin(time * 3) * .08)
    if (game.objectiveReady()) this.label('prompt', game.carrying ? 'E · 送达 / 办理' : game.order?.kind === 'relief' ? 'E · 领取物资' : 'E · 交互', at(target, 3.4), 'prompt')
    else { const v = village.near(p, 80); if (v && v.talk <= 0) this.label('prompt', 'E · 交谈', at(v, 2.6), 'prompt') }
    if (game.carrying) this.label('carry', game.order?.kind === 'ceremony' ? '携带文书' : game.order?.cargo ?? '携带物资', at(p, 2.7), 'name')
    if (game.order?.kind === 'relief') (game.order.deliveries ?? HOMES).forEach((home, i) => this.label(`home${i}`, game.completed.has(i) ? '已送达' : '待送达', at(home, 1.4), game.completed.has(i) ? 'name' : 'name wl-next'))
    // Camera placement, shake, sun follows the hero so shadows stay crisp nearby.
    const focusTarget = at(p, .9)
    this.focus.lerp(focusTarget, 1 - Math.exp(-dt * 8))
    // Portrait screens look down more steeply so nearby roofs do not fill the lower half.
    const portrait = this.camera.aspect < .8, pitch = Math.min(1.32, this.pitch + (portrait ? .14 : 0)), flat = Math.cos(pitch) * this.zoom * (portrait ? 1.12 : 1)
    this.camera.position.set(this.focus.x + Math.sin(this.yaw) * flat, this.focus.y + Math.sin(pitch) * this.zoom, this.focus.z + Math.cos(this.yaw) * flat)
    if (game.shake > 0 && !this.reduced) this.camera.position.add(new T.Vector3((Math.random() - .5) * game.shake * .04, (Math.random() - .5) * game.shake * .04, 0))
    this.camera.lookAt(this.focus)
    this.sky.position.copy(this.camera.position)
    this.sun.position.set(this.focus.x - 18, 34, this.focus.z + 14); this.sun.target.position.copy(this.focus)
    this.fadeOccluders(dt)
    this.offscreenArrow(target, game.order ? '目的地' : '新消息')
    this.renderer.render(this.scene, this.camera)
    for (const [key, el] of this.labels) if (!this.used.has(key)) { el.remove(); this.labels.delete(key) }
  }
  private placeVillager(entry: { rig: Rig | ActorRig; heading: number }, v: Villager, dt: number, time: number) {
    entry.rig.root.position.copy(at(v))
    entry.heading = this.turn(entry.heading, v.heading, dt)
    entry.rig.root.rotation.y = entry.heading
    this.pose(entry.rig, v.moving, v.step, time + v.id, v.mood)
  }
  private drawConvoy(game: DynastyBattle, dt: number, time: number) {
    const escort = game.order?.kind === 'escort', people = game.order?.convoy === 'people', w = game.wagon
    this.cart.root.visible = this.porter.root.visible = escort && !people
    this.convoy.forEach(rig => { rig.root.visible = escort && people })
    if (!escort) return
    const pos = at(w), moved = pos.distanceTo(this.lastWagon), waypoint = game.route[game.routeIndex] ?? game.order!.target
    const heading = Math.atan2(waypoint.x - w.x, waypoint.y - w.y)
    this.lastWagon.copy(pos)
    const going = moved > .001 && moved < 1
    if (!people) {
      this.cart.root.position.copy(pos); this.cart.root.rotation.y = this.turn(this.cart.root.rotation.y, heading, dt)
      for (const wheel of this.cart.wheels) wheel.rotation.x += moved / .55
      const front = this.temp.set(Math.sin(heading) * 2.1, 0, Math.cos(heading) * 2.1)
      this.porter.root.position.copy(pos).add(front); this.porter.root.rotation.y = heading
      this.pose(this.porter, going, time * 7, time)
      this.label('wagon', w.active ? `辎重车 · ${Math.ceil(w.hp)}%` : '辎重车 · 待接应', at(w, 2.6), w.hp < 50 ? 'name wl-next' : 'name')
    } else {
      this.convoy.forEach((rig, i) => {
        rig.root.position.copy(at({ x: w.x + (i % 2) * 34 - 17, y: w.y + Math.floor(i / 2) * 34 - 17 })); rig.root.rotation.y = heading
        this.pose(rig, going, time * 7 + i, time + i, !going && game.enemies.length ? 'afraid' : undefined)
      })
      this.label('wagon', w.active ? `随行队伍 · ${Math.ceil(w.hp)}%` : '随行队伍 · 待接应', at(w, 2.4), w.hp < 50 ? 'name wl-next' : 'name')
    }
  }
  private drawEffects(game: DynastyBattle, time: number) {
    // Telegraphs: red discs where a slam will land, a line where an arrow will fly.
    let discs = 0, lines = 0
    for (const e of game.enemies) {
      if (e.windup <= 0) continue
      if (e.kind === 'archer') {
        const line = this.lines[lines++] ?? this.pooled(this.lines, new T.Mesh(new T.PlaneGeometry(1, .18), new T.MeshBasicMaterial({ color: '#ff8b62', transparent: true, opacity: .6, depthWrite: false, side: T.DoubleSide })))
        const a = at(e, .07), b = at(e.target, .07), len = a.distanceTo(b)
        line.visible = true; line.position.copy(a).lerp(b, .5); line.scale.set(len, 1, 1)
        line.rotation.set(-Math.PI / 2, 0, -Math.atan2(b.z - a.z, b.x - a.x))
      } else {
        const disc = this.discs[discs++] ?? this.pooled(this.discs, new T.Mesh(new T.CircleGeometry(1, 32), new T.MeshBasicMaterial({ color: '#c13a23', transparent: true, opacity: .35, depthWrite: false })))
        const r = (e.kind === 'brute' ? 65 : 44) / UNIT
        disc.visible = true; disc.position.copy(at(e.target, .06)); disc.rotation.x = -Math.PI / 2; disc.scale.setScalar(r * (1.05 - e.windup * .4))
      }
    }
    for (let i = discs; i < this.discs.length; i++) this.discs[i].visible = false
    for (let i = lines; i < this.lines.length; i++) this.lines[i].visible = false
    const live = new Set<object>()
    for (const slash of game.slashes) {
      live.add(slash)
      let fx = this.effects.get(slash)
      const enemySlam = slash.circle && slash.radius < 100, r = slash.radius / UNIT
      if (!fx) {
        const geometry = slash.circle ? new T.RingGeometry(r * .82, r, 48) : new T.RingGeometry(r * .55, r, 24, 1, -slash.angle - 1.1, 2.2)
        fx = new T.Mesh(geometry, new T.MeshBasicMaterial({ color: enemySlam ? '#e0785a' : slash.circle ? '#a8ddd0' : '#fff0c0', transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }))
        fx.rotation.x = -Math.PI / 2; this.scene.add(fx); this.effects.set(slash, fx)
      }
      const k = slash.life / slash.maxLife
      fx.position.copy(at(slash, slash.circle ? .15 : 1)); fx.scale.setScalar(1 - k * .18)
      ;(fx.material as T.MeshBasicMaterial).opacity = k
    }
    for (const shot of game.projectiles) {
      live.add(shot)
      let fx = this.effects.get(shot)
      if (!fx) { fx = new T.Mesh(new T.BoxGeometry(.06, .06, .9), new T.MeshBasicMaterial({ color: shot.friendly ? '#ffedb3' : '#f2a080' })); this.scene.add(fx); this.effects.set(shot, fx) }
      fx.position.copy(at(shot, 1.25)); fx.rotation.y = Math.atan2(shot.vx, shot.vy)
    }
    for (const heal of game.heals) {
      live.add(heal)
      let fx = this.effects.get(heal)
      if (!fx) { fx = new T.Mesh(new T.IcosahedronGeometry(.16, 1), new T.MeshStandardMaterial({ color: '#a7d9a6', emissive: '#6fc57a', emissiveIntensity: 1.4 })); this.scene.add(fx); this.effects.set(heal, fx) }
      fx.position.copy(at(heal, .45 + Math.sin(time * 4 + this.idFor(heal)) * .12))
    }
    for (const [key, fx] of this.effects) if (!live.has(key)) { this.scene.remove(fx); fx.geometry.dispose(); (fx.material as T.Material).dispose(); this.effects.delete(key) }
    // Damage numbers rise from where they were struck, not along the map's y axis.
    const texts = new Set<object>(game.texts)
    for (const text of game.texts) {
      let origin = this.textOrigins.get(text)
      if (!origin) { origin = at({ x: text.x, y: text.y + 36 }); this.textOrigins.set(text, origin) }
      this.label(`t${this.idFor(text)}`, text.text, origin.clone().setY(2.3 + (1 - text.life) * 1.2), text.color === '#a6e1b3' ? 'heal' : 'dmg')
    }
    for (const key of this.textOrigins.keys()) if (!texts.has(key)) this.textOrigins.delete(key)
    // Sparks and dust share one additive point cloud.
    const position = this.particles.geometry.attributes.position as T.BufferAttribute, color = this.particles.geometry.attributes.color as T.BufferAttribute, c = new T.Color()
    const list = game.particles.slice(0, position.count)
    list.forEach((particle, i) => {
      let h = this.particleHeight.get(particle)
      if (h === undefined) { h = .5 + Math.random() * 1.3; this.particleHeight.set(particle, h) }
      const k = particle.life / particle.maxLife
      position.setXYZ(i, particle.x / UNIT, h + (1 - k) * .6, particle.y / UNIT)
      c.set(particle.color).multiplyScalar(k); color.setXYZ(i, c.r, c.g, c.b)
    })
    this.particles.geometry.setDrawRange(0, list.length); position.needsUpdate = true; color.needsUpdate = true
  }
  private pooled(pool: T.Mesh[], item: T.Mesh) { pool.push(item); this.scene.add(item); return item }
  private drawLegacy(game: DynastyBattle, time: number) {
    for (const item of game.village.legacy) {
      let placed = this.legacy.get(item.id)
      if (placed && placed.count !== item.count) { this.scene.remove(placed.root); disposeObject(placed.root); placed = undefined }
      if (!placed) {
        const root = makeLegacy(item.kind, item.title, item.count), puffs: T.Mesh[] = [], flames: T.Mesh[] = []
        root.traverse(o => { if (o instanceof T.Mesh && o.userData.puff) puffs.push(o); if (o instanceof T.Mesh && o.userData.flicker) flames.push(o) })
        root.position.copy(at(item)); root.rotation.y = item.kind === 'stele' ? 0 : (item.id * 1.3) % 1 - .5
        this.scene.add(root)
        placed = { root, born: time, count: item.count, puffs, flames }; this.legacy.set(item.id, placed)
      }
      // New structures rise out of the ground so the change is noticed.
      const grow = clamp((time - placed.born) / .8, 0, 1)
      placed.root.scale.set(1, .05 + grow * .95, 1)
      for (const puff of placed.puffs) {
        const d = puff.userData.puff, k = (time * .35 + d.phase) % 1
        puff.position.set(d.x + Math.sin(k * 6 + d.phase * 9) * .25, d.y + k * 2.4, d.z)
        puff.scale.setScalar(.2 + k * .5); (puff.material as T.MeshStandardMaterial).opacity = .45 * (1 - k)
      }
      for (const f of placed.flames) f.scale.set(1, .8 + Math.sin(time * 17 + item.id) * .2, 1)
    }
  }
  // Walls between camera and hero turn translucent instead of hiding the player.
  private fadeOccluders(dt: number) {
    const head = new T.Vector3(this.player.root.position.x, 1.3, this.player.root.position.z)
    const toHero = head.clone().sub(this.camera.position), length = toHero.length()
    this.ray.set(this.camera.position, toHero.normalize())
    for (const b of this.buildings) {
      const hit = this.ray.intersectBox(b.box, this.temp)
      const target = hit && hit.distanceTo(this.camera.position) < length - .6 ? .24 : 1
      b.fade += (target - b.fade) * Math.min(1, dt * 8)
      for (const m of b.mats) { m.opacity = b.fade; m.transparent = b.fade < .99; m.depthWrite = b.fade >= .99 }
    }
  }
  private offscreenArrow(target: Vec, text: string) {
    const v = at(target, 1).project(this.camera), w = this.overlay.clientWidth, h = this.overlay.clientHeight
    const inside = v.z < 1 && Math.abs(v.x) < .92 && Math.abs(v.y) < .85
    if (inside) return
    let x = v.x, y = v.y
    if (v.z > 1) { x = -x; y = -y }
    const scale = 1 / Math.max(Math.abs(x) / .86, Math.abs(y) / .72, 1e-3), sx = (x * scale + 1) / 2 * w, sy = (1 - y * scale) / 2 * h
    this.used.add('arrow')
    let el = this.labels.get('arrow')
    if (!el) { el = document.createElement('div'); el.className = 'wl wl-arrow'; el.innerHTML = '<b>➤</b><span></span>'; this.overlay.append(el); this.labels.set('arrow', el) }
    el.style.display = ''; (el.lastChild as HTMLElement).textContent = text
    el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`
    ;(el.firstChild as HTMLElement).style.transform = `rotate(${Math.atan2(-y, x)}rad)`
  }
  destroy() {
    this.cleanup.forEach(fn => fn())
    this.overlay.remove()
    disposeObject(this.scene)
    for (const key of ['stone', 'wood', 'roof', 'plaster'] as const) {
      this.surfaces[key].map?.dispose(); this.surfaces[key].dispose()
    }
    this.renderer.dispose()
  }
}
