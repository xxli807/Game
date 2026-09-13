import { BattleSound } from './sound'
import { BattleRenderer } from './render'
import { WorldRenderer } from './render3d'
import { City, Enemy, FloatText, Particle, Projectile, Skill, Slash, Snapshot, Status, Vec, clamp, distance } from './model'
import { eventPlace, Order, PLACES, WorldEvent } from './orders'
import { convoyRoute, ENVOYS, freeSpot, HOMES, moveWithCollisions } from './layout'
import { Village } from './village'
import { Resources } from '../rules'

export { ENVOYS }
export const HOUSEHOLDS = HOMES
type Renderer = { draw(game: DynastyBattle): void; destroy(): void }
// Three.js needs WebGL2; without it the original 2D map still plays the same rules.
function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const gl = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' })
  return gl ? new WorldRenderer(canvas, gl) : new BattleRenderer(canvas)
}
export class DynastyBattle {
  status: Status = 'playing'
  player = { x: 900, y: 590, hp: 150, maxHp: 150, facing: 1, step: 0, invulnerable: 0, heading: Math.PI, swing: 0, hurt: 0 }
  enemies: Enemy[] = []
  particles: Particle[] = []
  projectiles: Projectile[] = []
  texts: FloatText[] = []
  slashes: Slash[] = []
  heals: (Vec & { life: number })[] = []
  cities: City[] = Object.values(PLACES).map(p => ({ ...p, progress: 0, owned: false }))
  cooldowns: Record<Skill, number> = { dash: 0, storm: 0, volley: 0 }
  sound = new BattleSound()
  kills = 0
  seconds = 0
  notice = '在同一片天下中行走、决策、施政。靠近金色标记，听取当地消息。'
  shake = 0
  order: Order | null = null
  event: WorldEvent | null = null
  orderProgress = 0
  orderSuccess = true
  carrying = false
  completed = new Set<number>()
  wagon = { x: 1290, y: 430, active: false, hp: 100 }
  route: Vec[] = []
  routeIndex = 0
  village = new Village()
  /** Written by the 3D renderer each frame; movement input is relative to it. Zero keeps W = north. */
  cameraYaw = 0
  cameraTurn = 0
  worldChange = ''
  ritual = 0
  ritualHolding = false
  audience = 0
  trust = 0
  damage = 30
  speed = 235
  range = 120
  attackTimer = .2
  private keys = new Set<string>()
  private stick: Vec = { x: 0, y: 0 }
  private lastMove: Vec = { x: 0, y: 1 }
  private dashDirection: Vec = { x: 0, y: 1 }
  private dashTime = 0
  private hudTimer = 0
  private noticeTime = 9
  private captureTime = 0
  private id = 0
  private frame = 0
  private previous = 0
  private destroyed = false
  private renderer: Renderer
  private cleanup: (() => void)[] = []
  constructor(canvas: HTMLCanvasElement, private onState: (state: Snapshot) => void) {
    this.renderer = createRenderer(canvas)
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input, textarea, summary')) return
      const key = event.key.toLowerCase()
      if (key === ' ' && (event.target as HTMLElement).closest('button')) return
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd', 'q', 'e', 'r', 'z', 'c', 'escape'].includes(key)) event.preventDefault()
      this.keys.add(key)
      if (!event.repeat) {
        if (key === 'escape') this.togglePause()
        if (key === ' ') this.cast('dash')
        if (key === 'q') this.cast('storm')
        if (key === 'r') this.cast('volley')
        if (key === 'e') this.interact()
      }
    }
    const onKeyUp = (event: KeyboardEvent) => { this.keys.delete(event.key.toLowerCase()); if (event.key.toLowerCase() === 'e') this.releaseInteract() }
    const pauseAway = () => { this.clearInput(); if (this.status === 'playing') this.togglePause() }
    const onVisibility = () => { if (document.hidden) pauseAway() }
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', pauseAway); document.addEventListener('visibilitychange', onVisibility)
    this.cleanup.push(() => {
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', pauseAway); document.removeEventListener('visibilitychange', onVisibility)
    })
    this.emit(); this.frame = requestAnimationFrame(this.loop)
  }
  private loop = (time: number) => {
    if (this.destroyed) return
    const dt = this.previous ? Math.min((time - this.previous) / 1000, .04) : 0
    this.previous = time
    if (this.status === 'playing') this.update(dt)
    this.renderer.draw(this)
    this.hudTimer -= dt
    if (this.hudTimer <= 0) { this.emit(); this.hudTimer = .08 }
    this.frame = requestAnimationFrame(this.loop)
  }
  setEvent(event: WorldEvent) {
    this.event = event; this.order = null; this.status = 'playing'; this.completed.clear(); this.carrying = false
    this.enemies = []; this.projectiles = []; this.wagon.active = false
    this.player.hp = this.player.maxHp; this.clearInput()
    this.say(`${event.phase} · ${event.title}。前往${eventPlace(event).name}听取消息。`); this.emit()
  }
  setRealm(res: Resources) { this.village.setRealm(res) }
  beginOrder(order: Order) {
    this.order = order; this.orderProgress = 0; this.orderSuccess = true; this.captureTime = 0; this.worldChange = ''
    this.status = 'playing'; this.completed.clear(); this.trust = 0; this.carrying = false
    this.wagon = { ...(order.pickup ?? { x: 1290, y: 430 }), active: false, hp: 100 }; this.clearInput()
    this.route = order.kind === 'escort' ? convoyRoute(this.wagon, order.target) : []; this.routeIndex = 1
    this.player.invulnerable = 1.2
    this.say(order.brief)
    if (order.kind === 'assault') {
      for (let i = 0; i < 5; i++) this.spawn(i === 3 ? 'archer' : i === 4 ? 'brute' : 'soldier', { x: order.target.x + Math.cos(i * 1.26) * 145, y: order.target.y + Math.sin(i * 1.26) * 145 })
    }
    if (order.kind === 'escort') {
      // The ambush waits at the midpoint of the road the convoy will actually take.
      const mid = this.route[Math.floor(this.route.length / 2)]
      for (let i = 0; i < 4; i++) this.spawn(i === 2 ? 'archer' : 'soldier', { x: mid.x - 80 + i * 55, y: mid.y - 60 + (i % 2) * 110 })
    }
    this.emit()
  }
  clearInput() { this.keys.clear(); this.stick = { x: 0, y: 0 }; this.ritualHolding = false }
  setStick(x: number, y: number) { this.stick = { x, y } }
  togglePause() {
    if (this.status !== 'playing' && this.status !== 'paused') return
    this.status = this.status === 'playing' ? 'paused' : 'playing'; this.clearInput(); this.emit()
  }
  closeDecision() { if (this.status === 'decision') { this.status = 'playing'; this.emit() } }
  freeze() { this.status = 'paused'; this.clearInput(); this.emit() }
  destroy() { this.destroyed = true; cancelAnimationFrame(this.frame); this.cleanup.forEach(fn => fn()); this.renderer.destroy(); this.sound.destroy() }
  private spawn(kind: Enemy['kind'], at: Vec) {
    const scale = { soldier: [50, 82, 15], archer: [36, 67, 14], brute: [110, 57, 23] }[kind], point = freeSpot(at, scale[2])
    this.enemies.push({ ...point, id: this.id++, kind, hp: scale[0], maxHp: scale[0], speed: scale[1], radius: scale[2], cooldown: 1.3, windup: 0, target: { ...point }, flash: 0, step: 0 })
  }
  private say(text: string) { this.notice = text; this.noticeTime = 7 }
  private burst(point: Vec, color: string, count = 12) {
    for (let i = 0; i < count && this.particles.length < 240; i++) {
      const angle = Math.random() * Math.PI * 2, speed = 30 + Math.random() * 160
      this.particles.push({ ...point, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .5, maxLife: .5, color, size: 2 + Math.random() * 3 })
    }
  }
  private damageEnemy(enemy: Enemy, damage: number) {
    if (enemy.hp <= 0) return
    enemy.hp -= damage; enemy.flash = .14
    const d = Math.max(1, distance(enemy, this.player))
    Object.assign(enemy, moveWithCollisions(enemy, (enemy.x - this.player.x) / d * 14, (enemy.y - this.player.y) / d * 14, enemy.radius))
    this.texts.push({ x: enemy.x, y: enemy.y - 36, text: `${Math.round(damage)}`, life: .65, color: '#ffe1a3' })
    this.burst(enemy, '#ecc68b', 5)
    if (enemy.hp <= 0) { this.kills++; this.burst(enemy, '#c5ad78', 10); this.heals.push({ x: enemy.x, y: enemy.y, life: 20 }) }
  }
  private hurt(damage: number) {
    if (this.player.invulnerable > 0 || this.status !== 'playing') return
    this.player.hp = Math.max(0, this.player.hp - damage * .8)
    this.player.invulnerable = .6; this.player.hurt = .35; this.shake = 5; this.sound.play('hurt'); this.burst(this.player, '#dd735e', 10)
    if (!this.player.hp) this.finish(false)
  }
  private finish(success: boolean) {
    this.orderSuccess = success; this.status = 'orderdone'; this.clearInput()
    if (success && this.order) {
      const city = this.cities.find(c => distance(c, this.order!.target) < 20)
      if (city) { city.owned = true; city.progress = 100 }
      this.sound.play('capture')
    }
    if (this.order) { this.worldChange = this.village.record(this.order, this.event, success, this.wagon); if (this.worldChange) this.say(this.worldChange) }
    this.emit()
  }
  cast(skill: Skill) {
    if (this.status !== 'playing' || this.cooldowns[skill] > 0) return
    if (skill === 'dash') {
      this.dashDirection = { ...this.lastMove }; this.dashTime = .22; this.player.invulnerable = .35; this.cooldowns.dash = 2.4; this.sound.play('dash')
    } else if (skill === 'storm') {
      if (!this.enemies.length) return
      this.cooldowns.storm = 7
      this.slashes.push({ ...this.player, angle: 0, radius: 190, life: .5, maxLife: .5, circle: true })
      for (const enemy of this.enemies) if (distance(enemy, this.player) < 190 + enemy.radius) this.damageEnemy(enemy, this.damage * 2.8)
      this.shake = 4; this.sound.play('hit')
    } else {
      if (!this.enemies.length) return
      this.cooldowns.volley = 10
      const target = this.nearest(), angle = target ? Math.atan2(target.y - this.player.y, target.x - this.player.x) : Math.atan2(this.lastMove.y, this.lastMove.x)
      for (let i = -3; i <= 3; i++) this.projectiles.push({ ...this.player, vx: Math.cos(angle + i * .15) * 560, vy: Math.sin(angle + i * .15) * 560, life: 1.3, damage: this.damage * 2.5, friendly: true })
      this.sound.play('dash')
    }
    this.emit()
  }
  interactionTarget(): Vec {
    if (!this.order) return this.event ? eventPlace(this.event) : PLACES.court
    switch (this.order.kind) {
      case 'assault': return this.order.target
      case 'escort': return this.wagon
      case 'relief': return this.carrying ? (this.order.deliveries ?? HOUSEHOLDS).find((_, i) => !this.completed.has(i)) ?? PLACES.town : PLACES.granary
      case 'council': return ENVOYS.find((_, i) => !this.completed.has(i)) ?? PLACES.court
      case 'ceremony': return this.carrying ? PLACES.altar : PLACES.court
    }
  }
  objectiveReady() { return this.status === 'playing' && distance(this.player, this.interactionTarget()) < 105 && this.order?.kind !== 'assault' }
  private listener() { return this.status === 'playing' ? this.village.near(this.player, 80) : undefined }
  canInteract() { return this.objectiveReady() || Boolean(this.listener()) }
  interact() {
    if (!this.objectiveReady()) {
      // Away from the objective, E talks to whoever is closest; what they say follows the realm and past orders.
      const villager = this.listener()
      if (villager) { this.say(this.village.talk(villager, this, this.order?.cargo)); this.emit() }
      return
    }
    if (!this.order) { this.status = 'decision'; this.clearInput(); this.emit(); return }
    if (this.order.kind === 'escort') { this.wagon.active = true; this.say('队伍已启程。沿路护送，勿与队伍相距太远。') }
    if (this.order.kind === 'relief') {
      if (!this.carrying) { this.carrying = true; this.say(`已领取${this.order.cargo ?? '物资'}。跟随指引送到标记处。`) }
      else { const index = (this.order.deliveries ?? HOUSEHOLDS).findIndex((_, i) => !this.completed.has(i)); this.completed.add(index); this.village.deliver(this.order, index); this.carrying = false; this.orderProgress++; this.burst(this.player, '#badea6', 18); this.sound.play('capture'); if (this.orderProgress === 3) this.finish(true) }
    }
    if (this.order.kind === 'council') {
      this.audience = ENVOYS.findIndex((_, i) => !this.completed.has(i)); this.status = 'audience'; this.clearInput()
    }
    if (this.order.kind === 'ceremony') {
      if (!this.carrying) { this.carrying = true; this.say('文书已备。前往祭坛，把诏令昭告天下。') }
      else { this.ritualHolding = true; this.ritual = 0 }
    }
    this.emit()
  }
  releaseInteract() {
    if (!this.ritualHolding || this.status !== 'playing') return
    this.ritualHolding = false
    if (this.ritual >= .3 && this.ritual <= .78) { this.orderProgress++; this.sound.play('capture'); this.burst(this.player, '#f4dba3', 20); if (this.orderProgress >= 3) this.finish(true); else this.say('礼成一节，再校准下一节。') }
    else this.say('节奏未合，再试一次。金色区间内松开交互。')
    this.emit()
  }
  answerAudience(supported: boolean) {
    if (this.status !== 'audience') return
    if (supported) this.trust++
    this.completed.add(this.audience); this.orderProgress++; this.status = 'playing'
    this.say(supported ? '对方愿意支持你的决定。继续拜访下一方代表。' : '对方暂未信服。继续争取其他代表。')
    if (this.orderProgress >= 3) this.finish(this.trust >= 2)
    this.emit()
  }
  private nearest() {
    let closest: Enemy | undefined, d = Infinity
    for (const enemy of this.enemies) if (enemy.hp > 0 && distance(enemy, this.player) < d) { d = distance(enemy, this.player); closest = enemy }
    return closest
  }
  private attack() {
    const target = this.nearest()
    if (!target || distance(target, this.player) > this.range + target.radius) return
    this.attackTimer = .58
    const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x)
    this.player.facing = Math.cos(angle) >= 0 ? 1 : -1; this.player.heading = Math.atan2(Math.cos(angle), Math.sin(angle)); this.player.swing = .26
    this.slashes.push({ ...this.player, angle, radius: this.range, life: .22, maxLife: .22, circle: false })
    for (const enemy of this.enemies) {
      const a = Math.atan2(enemy.y - this.player.y, enemy.x - this.player.x) - angle
      if (distance(enemy, this.player) < this.range + enemy.radius && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 1.3) this.damageEnemy(enemy, this.damage)
    }
    this.sound.play('hit')
  }
  private update(dt: number) {
    this.seconds += dt; this.noticeTime -= dt
    if (this.noticeTime < 0) this.notice = ''
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt); this.shake = Math.max(0, this.shake - dt * 25)
    this.player.swing = Math.max(0, this.player.swing - dt); this.player.hurt = Math.max(0, this.player.hurt - dt)
    this.cameraTurn = (this.keys.has('c') ? 1 : 0) - (this.keys.has('z') ? 1 : 0)
    if (this.ritualHolding) this.ritual = (this.ritual + dt * .6) % 1
    for (const skill of ['dash', 'storm', 'volley'] as Skill[]) this.cooldowns[skill] = Math.max(0, this.cooldowns[skill] - dt)
    const ix = (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0) + this.stick.x
    const iy = (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) - (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0) + this.stick.y
    // Screen-space input turned by the camera yaw: "up" always walks away from the camera.
    const cos = Math.cos(this.cameraYaw), sin = Math.sin(this.cameraYaw)
    let dx = cos * ix + sin * iy, dy = -sin * ix + cos * iy
    const length = Math.hypot(dx, dy)
    if (length > 1) { dx /= length; dy /= length }
    if (length > .08) { const l = Math.hypot(dx, dy); this.lastMove = { x: dx / l, y: dy / l }; this.player.facing = dx < 0 ? -1 : dx > 0 ? 1 : this.player.facing; this.player.step += dt * 12; if (this.player.swing <= 0) this.player.heading = Math.atan2(dx, dy) }
    if (this.dashTime > 0) { dx = this.dashDirection.x * 3.6; dy = this.dashDirection.y * 3.6; this.dashTime -= dt; this.burst(this.player, '#cde6d2', 2) }
    Object.assign(this.player, moveWithCollisions(this.player, dx * this.speed * dt, dy * this.speed * dt))
    this.attackTimer -= dt
    if (this.attackTimer <= 0) this.attack()
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue
      enemy.flash = Math.max(0, enemy.flash - dt); enemy.cooldown -= dt
      const d = Math.max(1, distance(enemy, this.player)), archer = enemy.kind === 'archer'
      if (enemy.windup > 0) {
        enemy.windup -= dt
        if (enemy.windup <= 0) {
          if (archer) {
            const angle = Math.atan2(enemy.target.y - enemy.y, enemy.target.x - enemy.x)
            this.projectiles.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 280, vy: Math.sin(angle) * 280, life: 2.5, damage: 12, friendly: false })
          } else {
            const radius = enemy.kind === 'brute' ? 65 : 44
            this.slashes.push({ ...enemy.target, angle: 0, radius, life: .25, maxLife: .25, circle: true })
            if (distance(this.player, enemy.target) < radius) this.hurt(enemy.kind === 'brute' ? 19 : 10)
            this.burst(enemy.target, '#df7557', 5)
          }
          enemy.cooldown = archer ? 2.5 : 1.2
        }
      } else if (d < (archer ? 380 : enemy.radius + 30) && enemy.cooldown <= 0) {
        enemy.windup = archer ? .7 : .55; enemy.target = { x: this.player.x, y: this.player.y }
      } else if (d < 600 && d > (archer ? 240 : enemy.radius + 22)) {
        Object.assign(enemy, moveWithCollisions(enemy, (this.player.x - enemy.x) / d * enemy.speed * dt, (this.player.y - enemy.y) / d * enemy.speed * dt, enemy.radius)); enemy.step += dt * 9
      }
      for (const other of this.enemies) {
        if (other.id <= enemy.id || other.hp <= 0) continue
        const separation = distance(enemy, other), minimum = enemy.radius + other.radius
        if (separation > 0 && separation < minimum) {
          const push = (minimum - separation) * .5, sx = (enemy.x - other.x) / separation * push, sy = (enemy.y - other.y) / separation * push
          Object.assign(enemy, moveWithCollisions(enemy, sx, sy, enemy.radius)); Object.assign(other, moveWithCollisions(other, -sx, -sy, other.radius))
        }
      }
    }
    if (this.status !== 'playing') return
    for (const shot of this.projectiles) {
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt
      if (shot.friendly) { for (const enemy of this.enemies) if (enemy.hp > 0 && distance(shot, enemy) < enemy.radius + 9 && shot.life > 0) { this.damageEnemy(enemy, shot.damage); shot.life = 0 } }
      else if (distance(shot, this.player) < 22) { this.hurt(shot.damage); shot.life = 0 }
    }
    if (this.status !== 'playing') return
    this.projectiles = this.projectiles.filter(p => p.life > 0); this.enemies = this.enemies.filter(e => e.hp > 0)
    for (const heal of this.heals) {
      heal.life -= dt
      const d = distance(heal, this.player)
      if (d < 100) { heal.x += (this.player.x - heal.x) * dt * 7; heal.y += (this.player.y - heal.y) * dt * 7 }
      if (d < 25 && heal.life > 0) { this.player.hp = Math.min(this.player.maxHp, this.player.hp + 12); heal.life = 0; this.texts.push({ ...this.player, text: '+12', life: .8, color: '#a6e1b3' }) }
    }
    this.heals = this.heals.filter(h => h.life > 0)
    if (this.order?.kind === 'assault' && !this.enemies.length && distance(this.player, this.order.target) < 115) {
      this.captureTime += dt; const site = this.cities.find(c => distance(c, this.order!.target) < 20); if (site) site.progress = clamp(this.captureTime / 3 * 100, 0, 100)
      if (this.captureTime >= 3) { this.orderProgress = 1; this.finish(true) }
    }
    if (this.order?.kind === 'escort' && this.wagon.active) {
      const d = distance(this.wagon, this.order.target), waypoint = this.route[this.routeIndex] ?? this.order.target, w = distance(this.wagon, waypoint)
      if (distance(this.wagon, this.player) < 180 && d > 65) {
        const step = Math.min(w, dt * 78)
        if (w > 0) { this.wagon.x += (waypoint.x - this.wagon.x) / w * step; this.wagon.y += (waypoint.y - this.wagon.y) / w * step }
        if (w < 4 && this.routeIndex < this.route.length - 1) this.routeIndex++
      }
      if (this.enemies.some(e => distance(e, this.wagon) < 75)) this.wagon.hp = Math.max(0, this.wagon.hp - dt * 9)
      if (this.wagon.hp <= 0) this.finish(false)
      else if (d <= 65) { this.orderProgress = 1; this.finish(true) }
    }
    this.village.update(dt, this)
    for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .95; p.vy *= .95 }
    this.particles = this.particles.filter(p => p.life > 0)
    for (const t of this.texts) { t.life -= dt; t.y -= dt * 32 }; this.texts = this.texts.filter(t => t.life > 0)
    for (const s of this.slashes) s.life -= dt; this.slashes = this.slashes.filter(s => s.life > 0)
  }
  snapshot(): Snapshot {
    let objective = this.event ? `前往${eventPlace(this.event).name} · ${this.event.title}` : '探索天下'
    if (this.order) objective = this.order.kind === 'assault' ? this.enemies.length ? `击退守军 · 尚余 ${this.enemies.length} 人` : '靠近目标旗帜 · 接管防务' : this.order.kind === 'escort' ? this.wagon.active ? `护送到目的地 · 队伍状况 ${Math.ceil(this.wagon.hp)}%` : '到标记处接应队伍' : this.order.kind === 'relief' ? this.carrying ? '把携带物资送到标记处' : '到粮仓领取物资' : this.order.kind === 'council' ? `拜访${['行宫文官', '城镇乡老', '关隘军官'][this.orderProgress] ?? '代表'}` : this.carrying ? '到祭坛颁诏 · 按住交互，金区松开' : '到行宫领取文书'
    return {
      status: this.status, hp: Math.ceil(this.player.hp), maxHp: this.player.maxHp, kills: this.kills, seconds: this.seconds,
      cities: this.cities.map(c => ({ ...c })), captured: this.cities.filter(c => c.owned).length, cooldowns: { ...this.cooldowns }, notice: this.notice,
      objective, orderProgress: this.orderProgress, orderRequired: this.order?.required ?? 0, orderKind: this.order?.kind ?? '', orderSuccess: this.orderSuccess,
      carrying: this.carrying, canInteract: this.canInteract(), interactLabel: this.objectiveReady() || !this.listener() ? '交互' : '交谈', worldChange: this.worldChange, ritual: this.ritual, audience: this.audience,
      player: { x: this.player.x, y: this.player.y }, facing: this.player.facing, enemyCount: this.enemies.length,
    }
  }
  private emit() { this.onState(this.snapshot()) }
}
