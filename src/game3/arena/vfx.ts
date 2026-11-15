import * as T from 'three'

// Skill and combat effects for the arena. Everything bright is additive and batched:
// one instanced mesh for all glow sprites, one point cloud for all sparks, and a short list of
// timed meshes (shockwave rings, light pillars, slash arcs) that share three unit geometries.

type Ghost = { p: T.Vector3; size: number; c: T.Color; life: number; max: number; grow: number; rise: number }
type Spark = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; g: number; c: T.Color }
type Timed = { mesh: T.Mesh; life: number; max: number; from: T.Vector3; to: T.Vector3; own?: T.BufferGeometry }
const GLOWS = 520, SPARKS = 700

function radialTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64
  const g = canvas.getContext('2d')!, fill = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  fill.addColorStop(0, 'rgba(255,255,255,1)'); fill.addColorStop(0.25, 'rgba(255,255,255,.55)'); fill.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = fill; g.fillRect(0, 0, 64, 64)
  return new T.CanvasTexture(canvas)
}
function fadeTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 64
  const g = canvas.getContext('2d')!, fill = g.createLinearGradient(0, 0, 0, 64)
  fill.addColorStop(0, 'rgba(255,255,255,0)'); fill.addColorStop(1, 'rgba(255,255,255,.9)')
  g.fillStyle = fill; g.fillRect(0, 0, 4, 64)
  return new T.CanvasTexture(canvas)
}

export class Vfx {
  private glows: T.InstancedMesh
  private count = 0
  private ghosts: Ghost[] = []
  private sparks: Spark[] = []
  private points: T.Points<T.BufferGeometry, T.PointsMaterial>
  private timed: Timed[] = []
  private ringGeometry = new T.RingGeometry(0.84, 1, 56)
  private pillarGeometry = new T.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, 0.5, 0)
  private fade = fadeTexture()
  private m = new T.Matrix4()
  private v = new T.Vector3()
  private s = new T.Vector3()
  private c = new T.Color()
  private facing = new T.Quaternion()

  constructor(private scene: T.Scene) {
    this.glows = new T.InstancedMesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: radialTexture(), transparent: true, blending: T.AdditiveBlending, depthWrite: false }), GLOWS)
    this.glows.frustumCulled = false; this.glows.count = 0; this.glows.renderOrder = 8
    // Touch every colour slot once so the instance colour buffer exists before the first frame.
    for (let i = 0; i < GLOWS; i++) this.glows.setColorAt(i, this.c.set('#000'))
    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(SPARKS * 3), 3)); geometry.setAttribute('color', new T.BufferAttribute(new Float32Array(SPARKS * 3), 3))
    this.points = new T.Points(geometry, new T.PointsMaterial({ size: 0.42, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }))
    this.points.frustumCulled = false; this.points.renderOrder = 8
    scene.add(this.glows, this.points)
  }
  /** Call at the start of a frame, before any glow(). */
  begin(camera: T.Camera) { this.count = 0; this.facing.copy(camera.quaternion) }
  /** A glow for this frame only (auras, projectile heads). */
  glow(x: number, y: number, z: number, size: number, color: T.ColorRepresentation, alpha = 1) {
    if (this.count >= GLOWS) return
    this.m.compose(this.v.set(x, y, z), this.facing, this.s.set(size, size, 1)); this.glows.setMatrixAt(this.count, this.m)
    this.glows.setColorAt(this.count++, this.c.set(color).multiplyScalar(alpha))
  }
  /** A glow that stays behind and fades: trails, flashes, afterimages. */
  ghost(x: number, y: number, z: number, size: number, color: T.ColorRepresentation, life: number, grow = 0, rise = 0) {
    if (this.ghosts.length < 320) this.ghosts.push({ p: new T.Vector3(x, y, z), size, c: new T.Color(color), life, max: life, grow, rise })
  }
  burst(x: number, y: number, z: number, color: T.ColorRepresentation, count: number, speed = 6, up = 4, life = 0.45, gravity = 14) {
    for (let i = 0; i < count && this.sparks.length < SPARKS; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65)
      this.sparks.push({ x, y, z, vx: Math.cos(a) * s, vy: up * (0.3 + Math.random() * 0.7), vz: Math.sin(a) * s, life, max: life, g: gravity, c: new T.Color(color) })
    }
  }
  private add(mesh: T.Mesh, life: number, from: T.Vector3, to: T.Vector3, own?: T.BufferGeometry) {
    if (this.timed.length >= 96) { (mesh.material as T.Material).dispose(); own?.dispose(); return }
    mesh.scale.copy(from); mesh.renderOrder = 7; this.scene.add(mesh); this.timed.push({ mesh, life, max: life, from, to, own })
  }
  private basic(color: T.ColorRepresentation, map?: T.Texture) { return new T.MeshBasicMaterial({ color, map, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }) }
  /** Shockwave on the ground, growing from one radius to another. */
  ring(x: number, z: number, color: T.ColorRepresentation, from: number, to: number, life = 0.45) {
    const mesh = new T.Mesh(this.ringGeometry, this.basic(color)); mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0.16, z)
    this.add(mesh, life, new T.Vector3(from, from, 1), new T.Vector3(to, to, 1))
  }
  /** Column of light. */
  pillar(x: number, z: number, color: T.ColorRepresentation, radius: number, height: number, life = 0.5) {
    const mesh = new T.Mesh(this.pillarGeometry, this.basic(color, this.fade)); mesh.position.set(x, 0, z)
    this.add(mesh, life, new T.Vector3(radius, height * 0.4, radius), new T.Vector3(radius * 0.35, height, radius * 0.35))
  }
  /** Slash arc in a direction (dx, dz are a unit vector on the ground). */
  arc(x: number, z: number, dx: number, dz: number, radius: number, angle: number, color: T.ColorRepresentation, life = 0.28) {
    for (const [inner, start, delay] of [[0.3, 1, 0], [0.62, 0.82, 0.06]] as const) {
      const geometry = new T.RingGeometry(radius * inner, radius * start, 30, 1, -Math.atan2(dz, dx) - angle / 2, angle)
      const mesh = new T.Mesh(geometry, this.basic(color)); mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 1 + delay * 4, z)
      this.add(mesh, life + delay, new T.Vector3(0.75, 0.75, 1), new T.Vector3(1.12, 1.12, 1), geometry)
    }
  }
  update(dt: number) {
    this.ghosts = this.ghosts.filter(g => {
      if ((g.life -= dt) <= 0) return false
      const k = g.life / g.max
      g.p.y += g.rise * dt
      this.glow(g.p.x, g.p.y, g.p.z, g.size * (1 + (1 - k) * g.grow), g.c, k)
      return true
    })
    this.glows.count = this.count; this.glows.instanceMatrix.needsUpdate = true
    if (this.glows.instanceColor) this.glows.instanceColor.needsUpdate = true
    const position = this.points.geometry.attributes.position as T.BufferAttribute, color = this.points.geometry.attributes.color as T.BufferAttribute
    let n = 0
    this.sparks = this.sparks.filter(s => {
      if ((s.life -= dt) <= 0) return false
      s.x += s.vx * dt; s.y = Math.max(0.05, s.y + s.vy * dt); s.z += s.vz * dt; s.vy -= s.g * dt
      const k = s.life / s.max
      position.setXYZ(n, s.x, s.y, s.z); color.setXYZ(n, s.c.r * k, s.c.g * k, s.c.b * k); n++
      return true
    })
    this.points.geometry.setDrawRange(0, n); position.needsUpdate = true; color.needsUpdate = true
    this.timed = this.timed.filter(t => {
      t.life -= dt
      const k = Math.max(0, t.life / t.max)
      t.mesh.scale.lerpVectors(t.to, t.from, k); (t.mesh.material as T.MeshBasicMaterial).opacity = k
      if (t.life > 0) return true
      this.scene.remove(t.mesh); (t.mesh.material as T.Material).dispose(); t.own?.dispose()
      return false
    })
  }
  dispose() {
    for (const t of this.timed) { this.scene.remove(t.mesh); (t.mesh.material as T.Material).dispose(); t.own?.dispose() }
    this.timed = []; this.ghosts = []; this.sparks = []
    // These geometries may no longer belong to a live mesh when the match ends.
    this.ringGeometry.dispose(); this.pillarGeometry.dispose(); this.fade.dispose()
  }
}
