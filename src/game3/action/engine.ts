import { musterAllies, updateAllies, type Ally, type ArmyCommand } from './army'
import { VillageStories, CONTACTS, type ContactId } from './stories'
import { BattleSound } from './sound'
import { BattleRenderer } from './render'
import { WorldRenderer } from './render3d'
import { City, Enemy, FloatText, Particle, Projectile, Skill, Slash, Snapshot, Status, Vec, clamp, distance } from './model'
import { eventPlace, Order, PLACES, WorldEvent } from './orders'
import { convoyRoute, ENVOYS, freeSpot, HOMES, moveWithCollisions } from './layout'
import { Village } from './village'
import { Resources } from '../rules'
import { CONCESSION_COST, councilAudience, type CouncilChoice } from './diplomacy'

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
  player = { x: 900, y: 590, hp: 150, maxHp: 150, facing: 1, step: 0, invulnerable: 0, heading: Math.PI, swing: 0, hurt: 0, guarding: false, stamina: 100, combo: 0 }
  private guardTime = 0
  private guardHeld = false
  private attackHeld = false
  private strikePending = false
  private comboWindow = 0
  private counterWindow = 0
  enemies: Enemy[] = []
  allies: Ally[] = []
  armyCommand: ArmyCommand = 'advance'
  fieldBattle = false
  private fieldBattleTurn = -1
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
  cargoCount = 0
  private deliveryTarget: number | null = null
  completed = new Set<number>()
  wagon = { x: 1290, y: 430, active: false, hp: 100 }
  route: Vec[] = []
  routeIndex = 0
  village = new Village()
  stories = new VillageStories()
  turn = -1
  private storyContact: ContactId | null = null
  private trackedContact: ContactId | null = null
  /** Written by the 3D renderer each frame; movement input is relative to it. Zero keeps W = north. */
  cameraYaw = 0
  closeCombatCamera = true
  cameraTurn = 0
  worldChange = ''
  ritual = 0
  ritualHolding = false
  audience = 0
  trust = 0
  councilSpent = 0
  private realm: Resources = { military: 50, politics: 50, economy: 50, destiny: 50 }
  damage = 30
  speed = 235
  range = 92
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
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd', 'q', 'e', 'r', 'j', 'k', 'z', 'c', 'escape'].includes(key)) event.preventDefault()
      this.keys.add(key)
      if (!event.repeat) {
        if (key === 'escape') this.togglePause()
        if (key === ' ') this.cast('dash')
        if (key === 'q') this.cast('storm')
        if (key === 'r') this.cast('volley')
        if (key === 'e') this.interact()
        if (key === 'j') this.setAttack(true)
        if (key === 'k') this.setGuard(true)
        if (key === 'v') this.toggleCombatCamera()
        if (['1', '2', '3'].includes(key)) this.commandArmy(key === '1' ? 'advance' : key === '2' ? 'follow' : 'hold')
      }
    }
    const onKeyUp = (event: KeyboardEvent) => { const key = event.key.toLowerCase(); this.keys.delete(key); if (key === 'e') this.releaseInteract(); if (key === 'j') this.setAttack(false); if (key === 'k') this.setGuard(false) }
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
  setEvent(event: WorldEvent, turn = this.turn + 1) {
    this.allies = []; this.fieldBattle = false
    this.turn = turn; this.storyContact = null; this.trackedContact = null
    this.event = event; this.order = null; this.status = 'playing'; this.completed.clear(); this.carrying = false
    this.enemies = []; this.projectiles = []; this.wagon.active = false; this.cargoCount = 0; this.deliveryTarget = null; this.councilSpent = 0
    this.player.hp = this.player.maxHp; this.clearInput()
    this.say(`${event.phase} · ${event.title}。前往${eventPlace(event).name}听取消息。`); this.emit()
  }
  commandArmy(command: ArmyCommand) {
    if (this.status !== 'playing' || !this.allies.length || !['advance', 'follow', 'hold'].includes(command)) return
    this.armyCommand = command
    this.sound.play(command === 'hold' ? 'gong' : 'drum')
    if (command === 'hold') for (const ally of this.allies) ally.home = { x: ally.x, y: ally.y }
    this.say(command === 'advance' ? '全军进攻！步卒接敌，弓手掩护。' : command === 'follow' ? '随我突进！带队包抄敌阵。' : '原地坚守！弓手射击，步卒守住阵线。'); this.emit()
  }
  startFieldBattle() {
    if (!['playing', 'decision'].includes(this.status) || this.order || this.fieldBattleTurn === this.turn || this.stories.active) return
    this.fieldBattle = true; this.fieldBattleTurn = this.turn; this.trackedContact = null
    Object.assign(this.player, freeSpot({ x: 580, y: 535 })); this.player.hp = this.player.maxHp
    this.beginOrder({ kind: 'assault', title: '关隘争夺 · 列阵迎敌', brief: '长枪在前，弓手在后。J 挥刀连击 · K 招架（迎击瞬间可反击） · 空格闪避。击溃敌阵后夺取关旗。', target: PLACES.gate, required: 1 })
  }
  returnFromBattle() {
    if (!this.fieldBattle || this.status !== 'orderdone') return
    this.fieldBattle = false; this.allies = []; this.enemies = []; this.projectiles = []; this.order = null; this.status = 'playing'
    this.orderProgress = 0; this.player.hp = Math.max(50, this.player.hp); this.clearInput()
    this.say('军报已记。返回村中，继续处理等待中的政务。'); this.emit()
  }
  trackContact(id: ContactId) {
    if (this.status !== 'playing' || this.order || !CONTACTS.some(c => c.id === id)) return
    this.trackedContact = this.trackedContact === id ? null : id; this.emit()
  }
  closeStory() { if (this.status === 'story') { this.status = 'playing'; this.storyContact = null; this.emit() } }
  beginStory(choiceId: string) {
    if (this.status !== 'story' || !this.storyContact || this.order) return
    const choice = this.stories.begin(this.storyContact, choiceId, this.turn)
    if (!choice) return
    this.trackedContact = null; this.storyContact = null; this.beginOrder(choice.order)
  }
  finishStory() {
    if (this.status !== 'orderdone' || !this.stories.current || this.stories.current.state !== 'completed') return
    this.allies = []; this.stories.acknowledge(); this.order = null; this.status = 'playing'; this.completed.clear()
    this.enemies = []; this.projectiles = []; this.wagon.active = false; this.carrying = false; this.cargoCount = 0; this.orderProgress = 0
    this.player.hp = Math.max(35, this.player.hp); this.clearInput()
    this.say('乡里之事已记下。继续巡视，原来的政务仍在等候。'); this.emit()
  }
  setRealm(res: Resources) { this.realm = { ...res }; this.village.setRealm(res) }
  beginOrder(order: Order) {
    this.enemies = []; this.allies = []; this.projectiles = []; this.armyCommand = 'advance'
    this.order = order; this.orderProgress = 0; this.orderSuccess = true; this.captureTime = 0; this.worldChange = ''
    this.status = 'playing'; this.completed.clear(); this.trust = 0; this.carrying = false
    this.cargoCount = 0; this.deliveryTarget = null; this.councilSpent = 0
    this.wagon = { ...(order.pickup ?? { x: 1290, y: 430 }), active: false, hp: 100 }; this.clearInput()
    this.route = order.kind === 'escort' ? convoyRoute(this.wagon, order.target) : []; this.routeIndex = 1
    this.player.invulnerable = 1.2
    this.player.stamina = 100; this.player.combo = 0; this.player.swing = 0; this.attackTimer = 0; this.counterWindow = 0; this.comboWindow = 0
    this.say(order.brief)
    if (order.kind === 'assault') {
      this.allies = musterAllies({ x: order.target.x, y: order.target.y + 195 })
      this.sound.play('drum')
      for (let i = 0; i < 12; i++) this.spawn(i < 4 ? 'archer' : i === 5 || i === 6 ? 'brute' : 'soldier', { x: order.target.x + (i % 4 - 1.5) * 58, y: order.target.y + Math.floor(i / 4) * 52 })
    }
    if (order.kind === 'escort') {
      // The ambush waits at the midpoint of the road the convoy will actually take.
      const mid = this.route[Math.floor(this.route.length / 2)]
      for (let i = 0; i < 4; i++) this.spawn(i === 2 ? 'archer' : 'soldier', { x: mid.x - 80 + i * 55, y: mid.y - 60 + (i % 2) * 110 })
    }
    this.emit()
  }
  clearInput() { this.keys.clear(); this.stick = { x: 0, y: 0 }; this.ritualHolding = false; this.attackHeld = false; this.guardHeld = false; this.player.guarding = false; this.strikePending = false }
  setAttack(held: boolean) { this.attackHeld = held && this.status === 'playing'; if (this.attackHeld) this.attack() }
  setGuard(held: boolean) {
    this.guardHeld = held && this.status === 'playing'
    if (!this.guardHeld) this.player.guarding = false
    else if (!this.player.guarding && this.player.stamina >= 15 && this.player.swing <= 0) { this.player.guarding = true; this.guardTime = 0 }
  }
  setStick(x: number, y: number) { this.stick = { x, y } }
  toggleCombatCamera() { if (this.status === 'playing') { this.closeCombatCamera = !this.closeCombatCamera; this.emit() } }
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
  private damageEnemy(enemy: Enemy, damage: number, source: Vec = this.player, breakGuard = false) {
    if (enemy.hp <= 0) return
    const facing = enemy.windup > 0 ? enemy.target : this.allies.reduce<Vec>((best, ally) => distance(enemy, ally) < distance(enemy, best) ? ally : best, this.player)
    const incoming = Math.atan2(source.x - enemy.x, source.y - enemy.y), direction = Math.atan2(facing.x - enemy.x, facing.y - enemy.y)
    const shield = enemy.kind === 'soldier' && enemy.windup <= 0 && !breakGuard && Math.cos(incoming - direction) > .5
    if (shield) damage *= .55
    enemy.hp -= damage; enemy.flash = .14
    const d = Math.max(1, distance(enemy, source)), push = source === this.player ? breakGuard ? 25 : 9 : 3
    Object.assign(enemy, moveWithCollisions(enemy, (enemy.x - source.x) / d * push, (enemy.y - source.y) / d * push, enemy.radius))
    if (source === this.player) { this.texts.push({ x: enemy.x, y: enemy.y - 36, text: shield ? '格挡' : `${Math.round(damage)}`, life: .65, color: '#ffe1a3' }); this.shake = Math.max(this.shake, breakGuard ? 3 : 1.2); this.sound.play(shield ? 'parry' : 'hit') }
    this.burst(enemy, '#ecc68b', 5)
    if (source !== this.player && distance(enemy, this.player) < 400) this.sound.play('hit')
    if (enemy.hp <= 0) { this.kills++; this.burst(enemy, '#c5ad78', 10); this.heals.push({ x: enemy.x, y: enemy.y, life: 20 }) }
  }
  private hurtAlly(ally: Ally, damage: number, source?: Vec) {
    if (ally.hp <= 0) return
    if (source && ally.kind === 'soldier' && ally.windup <= 0 && Math.cos(Math.atan2(source.x - ally.x, source.y - ally.y) - ally.heading) > .4) damage *= this.armyCommand === 'hold' ? .4 : .7
    ally.hp = Math.max(0, ally.hp - damage); ally.flash = .18
    if (distance(ally, this.player) < 400) this.sound.play('hit')
    this.burst(ally, ally.hp > 0 ? '#bad8b5' : '#877961', ally.hp > 0 ? 4 : 12)
  }
  private hurt(damage: number, source?: Vec) {
    if (this.player.invulnerable > 0 || this.status !== 'playing') return
    if (this.player.guarding && this.player.stamina >= 12 && source && Math.cos(Math.atan2(source.x - this.player.x, source.y - this.player.y) - this.player.heading) > .15) {
      const perfect = this.guardTime < .23
      this.player.stamina = Math.max(0, this.player.stamina - (perfect ? 8 : 18))
      this.sound.play('parry'); this.burst(this.player, '#fff1c2', 12)
      this.texts.push({ ...this.player, text: perfect ? '架开 · 可反击' : '招架', life: .75, color: '#ffe1a3' })
      if (perfect) {
        this.counterWindow = 1.1
        if ('windup' in source) { const enemy = source as Enemy; enemy.windup = 0; enemy.cooldown = 1.6; enemy.flash = .2 }
        this.player.invulnerable = .15; return
      }
      damage *= .2
    }
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
    if (this.order) {
      this.worldChange = this.village.record(this.order, this.event, success, this.wagon)
      if (this.stories.active) {
        this.stories.finish(success)
        const story = this.stories.current!
        if (success && story.id === 'an' && story.choice === 'goods' && this.order.kind === 'assault') { this.village.recoverGoods(this.order.title); this.worldChange += '追回的货物已卸在集市旁。' }
        if (story.result) this.village.rememberContact(story.id, story.result)
      } else this.stories.record(this.order, success, this.turn)
      if (this.worldChange) this.say(this.worldChange)
    }
    this.emit()
  }
  cast(skill: Skill) {
    if (this.status !== 'playing' || this.cooldowns[skill] > 0) return
    this.player.guarding = false; this.guardHeld = false
    if (skill === 'dash') {
      this.player.swing = 0; this.strikePending = false
      this.dashDirection = { ...this.lastMove }; this.dashTime = .22; this.player.invulnerable = .35; this.cooldowns.dash = 2.4; this.sound.play('dash')
    } else if (skill === 'storm') {
      if (!this.enemies.length) return
      this.cooldowns.storm = 7
      this.slashes.push({ ...this.player, angle: 0, radius: 190, life: .5, maxLife: .5, circle: true })
      this.player.swing = .48; this.player.combo = 3; this.strikePending = false
      for (const enemy of this.enemies) if (distance(enemy, this.player) < 190 + enemy.radius) this.damageEnemy(enemy, this.damage * 2.8, this.player, true)
      this.shake = 4; this.sound.play('hit')
    } else {
      if (!this.enemies.length) return
      this.cooldowns.volley = 10
      const target = this.nearest(), angle = target ? Math.atan2(target.y - this.player.y, target.x - this.player.x) : Math.atan2(this.lastMove.y, this.lastMove.x)
      const archers = this.allies.filter(ally => ally.kind === 'archer')
      for (let i = -3; i <= 3; i++) { const origin = archers.length ? archers[(i + 3) % archers.length] : this.player; const aim = target ? Math.atan2(target.y - origin.y, target.x - origin.x) : angle; this.projectiles.push({ x: origin.x, y: origin.y, vx: Math.cos(aim + i * .09) * 560, vy: Math.sin(aim + i * .09) * 560, life: 1.3, damage: this.damage * 2.5, friendly: true }) }
      this.sound.play('volley')
    }
    this.emit()
  }
  deliverySites() { return this.order?.deliveries ?? HOUSEHOLDS }
  deliveryIndex() {
    const open = this.deliverySites().map((p, i) => ({ p, i })).filter(s => !this.completed.has(s.i))
    open.sort((a, b) => distance(this.player, a.p) - distance(this.player, b.p))
    const nearby = open[0]
    if (!nearby) return -1
    // Walking up to a different unserved household always permits delivery there.
    if (distance(this.player, nearby.p) < 105) return nearby.i
    return open.some(s => s.i === this.deliveryTarget) ? this.deliveryTarget! : nearby.i
  }
  selectDelivery(index: number) {
    if (this.status !== 'playing' || this.order?.kind !== 'relief' || !Number.isInteger(index) || !this.deliverySites()[index] || this.completed.has(index)) return
    this.deliveryTarget = index; this.emit()
  }
  deliveryName(index: number) { return this.order?.deliveryNames?.[index] ?? ['西坊', '东坊', '南坊'][index] ?? `第${index + 1}处` }
  interactionTarget(): Vec {
    if (!this.order) return this.village.people.find(p => p.contactId === this.trackedContact) ?? (this.event ? eventPlace(this.event) : PLACES.court)
    switch (this.order.kind) {
      case 'assault': return this.order.target
      case 'escort': return this.wagon
      case 'relief': return this.carrying ? this.deliverySites()[this.deliveryIndex()] ?? PLACES.town : PLACES.granary
      case 'council': return ENVOYS.find((_, i) => !this.completed.has(i)) ?? PLACES.court
      case 'ceremony': return this.carrying ? PLACES.altar : PLACES.court
    }
  }
  objectiveReady() { return this.status === 'playing' && distance(this.player, this.interactionTarget()) < (!this.order && this.trackedContact ? 80 : 105) && this.order?.kind !== 'assault' }
  private listener() { return this.status === 'playing' ? this.village.near(this.player, 80) : undefined }
  canInteract() { return this.objectiveReady() || Boolean(this.listener()) }
  interact() {
    if (this.status === 'playing' && !this.order) {
      const person = this.village.people.find(p => p.contactId === this.trackedContact && distance(p, this.player) < 80) ?? this.village.near(this.player, 80)
      if (person?.contactId) {
        if (this.stories.offer(person.contactId, this.turn)) { this.storyContact = person.contactId; this.status = 'story'; this.clearInput() }
        else {
          const memory = this.stories.memory(person.contactId)
          if (memory) { person.line = memory; person.talk = 4; this.say(memory) }
          else this.say(this.village.talk(person, this))
          this.trackedContact = null
        }
        this.emit(); return
      }
    }
    if (!this.objectiveReady()) {
      // Away from the objective, E talks to whoever is closest; what they say follows the realm and past orders.
      const villager = this.listener()
      if (villager) { this.say(this.village.talk(villager, this, this.order?.cargo)); this.emit() }
      return
    }
    if (!this.order) { this.status = 'decision'; this.clearInput(); this.emit(); return }
    if (this.order.kind === 'escort') { this.wagon.active = true; this.say('队伍已启程。沿路护送，勿与队伍相距太远。') }
    if (this.order.kind === 'relief') {
      if (!this.carrying) {
        this.cargoCount = this.deliverySites().length - this.completed.size; this.carrying = this.cargoCount > 0
        this.say(`已备齐${this.cargoCount}份${this.order.cargo ?? '物资'}。可自选配送顺序，不必往返领料。`)
      } else {
        const index = this.deliveryIndex()
        if (index < 0 || this.completed.has(index)) return
        this.completed.add(index); this.village.deliver(this.order, index); this.cargoCount--; this.carrying = this.cargoCount > 0
        this.deliveryTarget = null; this.orderProgress++; this.burst(this.player, '#badea6', 18); this.sound.play('capture')
        this.say(`${this.deliveryName(index)}已收到物资。${this.carrying ? `尚有${this.cargoCount}份，继续送往下一处。` : '此行配送完毕。'}`)
        if (this.orderProgress >= this.deliverySites().length) this.finish(true)
      }
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
  councilBudget() { return Math.max(0, Math.min(2, Math.floor(this.realm.economy / CONCESSION_COST)) - this.councilSpent) }
  answerAudience(choice: CouncilChoice) {
    if (this.status !== 'audience' || this.order?.kind !== 'council' || !['appeal', 'concede', 'defer'].includes(choice)) return
    if (choice === 'concede' && this.councilBudget() <= 0) return
    const audience = councilAudience(this.event, this.order, this.audience, this.realm)
    const supported = choice === 'concede' || (choice === 'appeal' && audience.supported)
    if (choice === 'concede') this.councilSpent++
    if (supported) this.trust++
    this.completed.add(this.audience); this.orderProgress++; this.status = 'playing'
    this.say(supported ? `${audience.name}愿意支持。已得 ${this.trust} 方支持${choice === 'concede' ? '，府库拨款将在政令结算时扣除' : '，未动用额外府库'}。` : `${audience.name}保留意见。继续争取其他代表。`)
    if (this.orderProgress >= 3) this.finish(this.trust >= 2)
    this.emit()
  }
  private nearest() {
    let closest: Enemy | undefined, d = Infinity
    for (const enemy of this.enemies) if (enemy.hp > 0 && distance(enemy, this.player) < d) { d = distance(enemy, this.player); closest = enemy }
    return closest
  }
  private attack() {
    if (this.status !== 'playing' || this.attackTimer > 0 || this.player.guarding || this.dashTime > 0) return
    const target = this.nearest()
    this.player.combo = this.comboWindow > 0 ? this.player.combo % 3 + 1 : 1
    this.comboWindow = 1.05; this.attackTimer = this.player.combo === 3 ? .68 : .48
    const angle = target && distance(target, this.player) < 170 ? Math.atan2(target.y - this.player.y, target.x - this.player.x) : Math.PI / 2 - this.player.heading
    this.player.facing = Math.cos(angle) >= 0 ? 1 : -1; this.player.heading = Math.atan2(Math.cos(angle), Math.sin(angle)); this.player.swing = .48
    this.strikePending = true; this.sound.play('swing')
  }
  private resolveStrike() {
    this.strikePending = false
    const angle = Math.PI / 2 - this.player.heading, heavy = this.player.combo === 3 || this.counterWindow > 0
    this.slashes.push({ ...this.player, angle, radius: this.range, life: .22, maxLife: .22, circle: false })
    for (const enemy of this.enemies) {
      const a = Math.atan2(enemy.y - this.player.y, enemy.x - this.player.x) - angle
      if (distance(enemy, this.player) < this.range + enemy.radius && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 1.3) this.damageEnemy(enemy, this.damage * (heavy ? 1.75 : 1), this.player, heavy)
    }
    this.counterWindow = 0
  }
  private update(dt: number) {
    this.seconds += dt; this.noticeTime -= dt
    if (this.noticeTime < 0) this.notice = ''
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt); this.shake = Math.max(0, this.shake - dt * 25)
    this.player.swing = Math.max(0, this.player.swing - dt); this.player.hurt = Math.max(0, this.player.hurt - dt)
    this.comboWindow = Math.max(0, this.comboWindow - dt); this.counterWindow = Math.max(0, this.counterWindow - dt)
    if (this.guardHeld && !this.player.guarding) this.setGuard(true)
    if (this.player.guarding) { this.guardTime += dt; this.player.stamina = Math.max(0, this.player.stamina - dt * 11); if (this.player.stamina < 1) { this.player.guarding = false; this.guardHeld = false } }
    else this.player.stamina = Math.min(100, this.player.stamina + dt * 22)
    if (this.strikePending && this.player.swing <= (this.player.combo === 3 ? .22 : .32)) this.resolveStrike()
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
    const pace = this.player.guarding ? .42 : this.player.swing > .1 ? .65 : 1
    Object.assign(this.player, moveWithCollisions(this.player, dx * this.speed * dt * pace, dy * this.speed * dt * pace))
    if (this.player.guarding) { const foe = this.nearest(); if (foe) this.player.heading = Math.atan2(foe.x - this.player.x, foe.y - this.player.y) }
    updateAllies(this.allies, this.enemies, this.player, this.armyCommand, dt, (enemy, amount, source) => this.damageEnemy(enemy, amount, source), this.projectiles, this.slashes)
    this.attackTimer -= dt
    if (this.attackHeld) this.attack()
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue
      enemy.flash = Math.max(0, enemy.flash - dt); enemy.cooldown -= dt
      const target = this.allies.filter(a => a.hp > 0).reduce<Vec>((closest, ally) => distance(enemy, ally) < distance(enemy, closest) ? ally : closest, this.player)
      const d = Math.max(1, distance(enemy, target)), archer = enemy.kind === 'archer'
      if (enemy.windup > 0) {
        enemy.windup -= dt
        if (enemy.windup <= 0) {
          if (archer) {
            const angle = Math.atan2(enemy.target.y - enemy.y, enemy.target.x - enemy.x)
            this.projectiles.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 280, vy: Math.sin(angle) * 280, life: 2.5, damage: 12, friendly: false })
          } else {
            const radius = enemy.kind === 'brute' ? 65 : 36
            this.slashes.push({ ...enemy.target, angle: 0, radius, life: .25, maxLife: .25, circle: true })
            if (distance(this.player, enemy.target) < radius) this.hurt(enemy.kind === 'brute' ? 19 : 10, enemy)
            for (const ally of this.allies) if (distance(ally, enemy.target) < radius + ally.radius) this.hurtAlly(ally, enemy.kind === 'brute' ? 25 : 14, enemy)
            this.burst(enemy.target, '#df7557', 5)
          }
          enemy.cooldown = archer ? 2.5 : 1.2
        }
      } else if (d < (archer ? 380 : 98) && enemy.cooldown <= 0) {
        enemy.windup = archer ? .7 : .55; enemy.target = { x: target.x, y: target.y }
      } else if (archer && d < 120) {
        Object.assign(enemy, moveWithCollisions(enemy, (enemy.x - target.x) / d * enemy.speed * dt, (enemy.y - target.y) / d * enemy.speed * dt, enemy.radius)); enemy.step += dt * 9
      } else if (d < 600 && d > (archer ? 265 : 76)) {
        Object.assign(enemy, moveWithCollisions(enemy, (target.x - enemy.x) / d * enemy.speed * dt, (target.y - enemy.y) / d * enemy.speed * dt, enemy.radius)); enemy.step += dt * 9
      }
      for (const other of this.enemies) {
        if (other.id <= enemy.id || other.hp <= 0) continue
        const separation = distance(enemy, other), minimum = enemy.radius + other.radius + 10
        if (separation > 0 && separation < minimum) {
          const push = (minimum - separation) * .5, sx = (enemy.x - other.x) / separation * push, sy = (enemy.y - other.y) / separation * push
          Object.assign(enemy, moveWithCollisions(enemy, sx, sy, enemy.radius)); Object.assign(other, moveWithCollisions(other, -sx, -sy, other.radius))
        }
      }
    }
    if (this.status !== 'playing') return
    for (const shot of this.projectiles) {
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt
      if (shot.friendly) { for (const enemy of this.enemies) if (enemy.hp > 0 && distance(shot, enemy) < enemy.radius + 9 && shot.life > 0) { this.damageEnemy(enemy, shot.damage, { x: shot.x - shot.vx * .1, y: shot.y - shot.vy * .1 }); shot.life = 0 } }
      else if (shot.life > 0) {
        const ally = this.allies.find(a => a.hp > 0 && distance(shot, a) < a.radius + 9)
        const origin = { x: shot.x - shot.vx * .1, y: shot.y - shot.vy * .1 }
        if (ally) { this.hurtAlly(ally, shot.damage, origin); shot.life = 0 }
        else if (distance(shot, this.player) < 22) { this.hurt(shot.damage, origin); shot.life = 0 }
      }
    }
    if (this.status !== 'playing') return
    this.allies = this.allies.filter(a => a.hp > 0)
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
    if (!this.order && this.trackedContact) objective = `拜访${CONTACTS.find(c => c.id === this.trackedContact)!.name} · 走近按 E 交谈`
    if (this.order) objective = this.order.kind === 'assault' ? this.enemies.length ? `击退守军 · 尚余 ${this.enemies.length} 人` : '靠近目标旗帜 · 接管防务' : this.order.kind === 'escort' ? this.wagon.active ? `护送到目的地 · 队伍状况 ${Math.ceil(this.wagon.hp)}%` : '到标记处接应队伍' : this.order.kind === 'relief' ? this.carrying ? `携带 ${this.cargoCount} 份 · 前往${this.deliveryName(this.deliveryIndex())}（可自选路线）` : '到粮仓一次备齐本次物资' : this.order.kind === 'council' ? `拜访${['行宫文官', '城镇乡老', '关隘军官'][this.orderProgress] ?? '代表'}` : this.carrying ? '到祭坛颁诏 · 按住交互，金区松开' : '到行宫领取文书'
    return {
      status: this.status, hp: Math.ceil(this.player.hp), maxHp: this.player.maxHp, kills: this.kills, seconds: this.seconds,
      cities: this.cities.map(c => ({ ...c })), captured: this.cities.filter(c => c.owned).length, cooldowns: { ...this.cooldowns }, notice: this.notice,
      objective, orderProgress: this.orderProgress, orderRequired: this.order?.required ?? 0, orderKind: this.order?.kind ?? '', orderSuccess: this.orderSuccess,
      storyLog: this.stories.all().flatMap(s => s.result ? [s.result] : []),
      story: this.storyContact ? this.stories.offer(this.storyContact, this.turn) ?? null : null,
      activeStory: this.stories.current ? { ...this.stories.current } : null,
      contacts: CONTACTS.map(c => { const p = this.village.people.find(v => v.contactId === c.id) ?? c.at; return { x: p.x, y: p.y, id: c.id, name: c.name, available: Boolean(this.stories.offer(c.id, this.turn)), completed: Boolean(this.stories.memory(c.id)), tracked: this.trackedContact === c.id } }),
      carrying: this.carrying, cargoCount: this.cargoCount,
      councilBudget: this.councilBudget(), councilSpent: this.councilSpent, councilSupport: this.trust,
      councilAudience: this.order?.kind === 'council' ? councilAudience(this.event, this.order, this.audience, this.realm) : null,
      deliveries: this.order?.kind === 'relief' ? this.deliverySites().map((p, i) => ({ ...p, name: this.deliveryName(i), complete: this.completed.has(i), target: this.deliveryIndex() === i })) : [],
      canInteract: this.canInteract(), interactLabel: this.objectiveReady() ? this.order?.kind === 'relief' ? this.carrying ? '交付物资' : '备齐物资' : '交互' : this.listener() ? '交谈' : '交互', worldChange: this.worldChange, ritual: this.ritual, audience: this.audience,
      army: { allies: this.allies.length, enemies: this.enemies.length, command: this.armyCommand, field: this.fieldBattle, available: !this.order && this.fieldBattleTurn !== this.turn, units: [...this.allies.map(a => ({ x: a.x, y: a.y, friendly: true })), ...this.enemies.map(e => ({ x: e.x, y: e.y, friendly: false }))] },
      player: { x: this.player.x, y: this.player.y }, facing: this.player.facing, enemyCount: this.enemies.length,
      combat: { stamina: Math.ceil(this.player.stamina), guarding: this.player.guarding, combo: this.player.combo, counter: this.counterWindow > 0, closeCamera: this.closeCombatCamera },
    }
  }
  private emit() { this.onState(this.snapshot()) }
}
