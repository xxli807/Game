import * as T from 'three'
import type { DynastyBattle } from './engine'
import { UNIT } from './layout'

// A single instanced draw call for low dust kicked up around the moving ranks.
export class BattleDust {
  readonly mesh: T.InstancedMesh
  private matrix = new T.Matrix4()
  private position = new T.Vector3()
  private scale = new T.Vector3()
  private time = 0
  constructor() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64
    const ctx = canvas.getContext('2d')!, gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31)
    gradient.addColorStop(0, 'rgba(193,167,121,.25)'); gradient.addColorStop(.45, 'rgba(173,149,108,.13)'); gradient.addColorStop(1, 'rgba(173,149,108,0)')
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64)
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace
    this.mesh = new T.InstancedMesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }), 28)
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1
  }
  update(game: DynastyBattle, camera: T.Camera, dt: number, reduced: boolean) {
    this.mesh.visible = game.order?.kind === 'assault' && game.enemies.length > 0 && !reduced
    if (!this.mesh.visible) return
    if (game.status === 'playing') this.time += dt
    const units = [...game.allies, ...game.enemies]
    for (let i = 0; i < 28; i++) {
      const unit = units[i % units.length], phase = (this.time * .32 + i * .618) % 1
      const angle = i * 2.4, size = .9 + Math.sin(phase * Math.PI) * 2.2
      this.position.set(unit.x / UNIT + Math.cos(angle) * .7 + phase * .9, .18 + phase * .8, unit.y / UNIT + Math.sin(angle) * .8)
      this.scale.set(size, size * .55, 1).multiplyScalar(Math.sin(phase * Math.PI))
      this.matrix.compose(this.position, camera.quaternion, this.scale); this.mesh.setMatrixAt(i, this.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
