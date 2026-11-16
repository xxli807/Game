import { BASE, FOUNTAIN, LANES, LANE_IDS, MAP, MAX_ITEMS, ULT_LEVEL, itemById, type ItemDef, type Vec } from './data'
import { ArenaRenderer, type AimPreview } from './render'
import { ArenaSim, type ArenaEvent, type ArenaOptions, type Hero } from './sim'
import type { Link, Msg } from './net'
import { apply, encode, interpolate, type Snapshot } from './sync'
import { ArenaSound } from './sound'
import { AUTOS, PERKS, describe } from './growth'

// Owns one match: advances the sim with bounded frame-time steps, feeds it input, turns its events into
// announcements and sound, and pushes a HUD snapshot to React a few times a second.
// React never touches per-frame state.

export type Tone = 'good' | 'bad' | 'plain'
export type ArenaHud = {
  status: 'loading' | 'playing' | 'paused' | 'ended' | 'lost'
  /** Online role, and the side this player is on (0 blue, 1 red). */
  online: 'host' | 'guest' | null; team: number; friend: { name: string; alive: boolean; left: boolean } | null
  time: number; kills: [number, number]; towers: [number, number]; winner: number | null; auto: boolean; boss: [number, number]
  me: {
    name: string; level: number; xp: number; hp: number; maxHp: number; shield: number; gold: number; k: number; d: number; a: number
    alive: boolean; respawn: number; items: ItemDef[]; recall: number; heal: number; flash: number; combo: number; dealt: number; bestStreak: number
    skills: { name: string; glyph: string; desc: string; left: number; total: number; locked: boolean; rank: number }[]
    offer: ReturnType<typeof describe>[] | null; picks: number
    autos: { glyph: string; name: string; rank: number; color: string }[]; perks: { glyph: string; name: string; count: number }[]
  }
  next: (ItemDef & { can: boolean }) | null
  announce: { id: number; text: string; tone: Tone } | null
  /** The player's ultimate: a full-width name card for a beat. */
  cutin: { id: number; glyph: string; name: string; color: string } | null
  feed: { id: number; text: string; tone: Tone }[]
  board: { name: string; team: number; level: number; k: number; d: number; a: number; me: boolean; alive: boolean; cls: string }[]
}
// The sim advances by the real frame time, so the world moves the same amount every frame.
// (A fixed 60 Hz step drifts against the display and made the hero stall or jump on 28% of frames.)
const MAX_STEP = 1 / 30
const SNAP_EVERY = 0.05 // host → guest snapshots, 20 a second
export type NetRole = { role: 'host' | 'guest'; link: Link }

export class ArenaGame {
  sim: ArenaSim
  sound = new ArenaSound()
  private renderer: ArenaRenderer
  private frame = 0
  private previous = 0
  private slowLeft = 0
  private slowScale = 1
  private cutin: ArenaHud['cutin'] = null
  private cutinLeft = 0
  private hudTimer = 0
  private paused = false
  private keys = new Set<string>()
  private stick: Vec = { x: 0, y: 0 }
  private holdAttack = false
  private mouseAttack = false
  private mouse: { x: number; y: number } | null = null
  private aiming: { slot: number; drag: Vec | null; mouse: boolean; at: number } | null = null
  private announce: ArenaHud['announce'] = null
  private announceLeft = 0
  private feed: ArenaHud['feed'] = []
  private noteId = 1
  private bestStreak = 0
  private mapBase?: HTMLCanvasElement
  private cleanup: (() => void)[] = []
  private destroyed = false
  private outbox: ArenaEvent[] = []
  private snapTimer = 0
  private inbox: Snapshot[] = []
  private friendLeft = false
  private gotSnapshot = false
  private finalSent = false

  constructor(canvas: HTMLCanvasElement, options: ArenaOptions, private onHud: (hud: ArenaHud) => void, private net?: NetRole) {
    this.sim = new ArenaSim(options)
    // The guest's copy is a mirror: same options and seed give the same map, ids and heroes; snapshots move it.
    if (net?.role === 'guest' && this.sim.guest) this.sim.player = this.sim.guest
    if (net) {
      this.cleanup.push(net.link.onMessage(message => this.receive(message)))
      this.cleanup.push(net.link.onClose(() => {
        this.friendLeft = true
        if (net.role === 'host') { this.sim.releaseGuest(); this.say('好友已断开 · 其英雄由 AI 接管', 'bad', 4) }
        this.emit()
      }))
    }
    this.sound.warm()
    this.renderer = new ArenaRenderer(canvas, this.sim)
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return
      const key = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'j', 'q', 'e', 'r', 'b', 'f', 'g', 'c', 'tab', '1', '2', '3'].includes(key)) e.preventDefault()
      if (key === ' ' && (e.target as HTMLElement).closest('button')) return
      if (key === 'escape' || key === 'p') { if (!e.repeat) this.togglePause(); return }
      if (!this.active) return
      this.keys.add(key)
      if (e.repeat) return
      const slot = ['q', 'e', 'r'].indexOf(key)
      if (slot >= 0) this.aimStart(slot, true)
      if (key === 'b') this.recall()
      if (key === 'f') this.heal()
      if (key === 'c') this.flash()
      if (key === '1' || key === '2' || key === '3') this.pick(Number(key) - 1)
      if (key === 'g') this.buyNext()
    }
    const up = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      this.keys.delete(key)
      const slot = ['q', 'e', 'r'].indexOf(key)
      if (slot >= 0 && this.aiming?.slot === slot) this.aimRelease(slot)
    }
    const pointer = (e: PointerEvent) => { if (e.pointerType === 'mouse') this.mouse = { x: e.clientX, y: e.clientY } }
    const press = (e: PointerEvent) => { if (this.active && e.pointerType === 'mouse' && e.button === 0) this.mouseAttack = true }
    const release = (e: PointerEvent) => { if (e.pointerType === 'mouse' && e.button === 0) this.mouseAttack = false }
    const away = () => { this.resetInput(); if (!this.paused && this.sim.winner === null) this.togglePause() }
    const hidden = () => { if (document.hidden) away() }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    canvas.addEventListener('pointermove', pointer); canvas.addEventListener('pointerdown', press)
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release); window.addEventListener('blur', away); document.addEventListener('visibilitychange', hidden)
    this.cleanup.push(() => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up)
      canvas.removeEventListener('pointermove', pointer); canvas.removeEventListener('pointerdown', press)
      window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); window.removeEventListener('blur', away); document.removeEventListener('visibilitychange', hidden)
    })
    this.say('全军出击 · 推掉一路两塔，击毁敌方大鼎', 'plain', 5)
    this.emit()
    this.frame = requestAnimationFrame(this.loop)
  }

  // ---------- commands from the HUD ----------
  private get active() { return !this.destroyed && !this.paused && this.renderer.loaded && this.sim.winner === null && !(this.guestSide && this.friendLeft) }
  private get guestSide() { return this.net?.role === 'guest' }
  private get friendHero(): Hero | undefined { return this.net ? (this.guestSide ? this.sim.heroes.find(h => h.isPlayer && h !== this.sim.player) : this.sim.guest) : undefined }
  /** Online: the guest's commands go to the host's match; offline (and on the host) they act directly. */
  private order(message: Msg, local: () => boolean | void) {
    if (this.guestSide) { this.net!.link.send(message); return true }
    return local()
  }
  // Host: apply a command from the guest to the guest's hero. Everything is validated; nothing is trusted blindly.
  private receive(message: Msg) {
    if (this.guestSide) { if (message.t === 'snap') this.inbox.push(message.s as Snapshot); return }
    const h = this.sim.guest, num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0
    const vec = (v: unknown) => v && typeof v === 'object' ? { x: num((v as Vec).x, -1e4, 1e4), y: num((v as Vec).y, -1e4, 1e4) } : undefined
    if (!h || this.sim.winner !== null) return
    const seat = this.sim.seat(h)
    if (message.t === 'in') Object.assign(seat.input, { mx: num(message.mx, -1, 1), my: num(message.my, -1, 1), attack: Boolean(message.attack), prefer: ['auto', 'minion', 'tower'].includes(message.prefer as string) ? message.prefer : 'auto' })
    else if (message.t === 'cast') this.sim.cast(h, num(message.slot, 0, 2) | 0, vec(message.aim))
    else if (message.t === 'pick') this.sim.pick(num(message.i, 0, 2) | 0, h)
    else if (message.t === 'flash') this.sim.flash(h, vec(message.dir))
    else if (message.t === 'recall') this.sim.recall(h)
    else if (message.t === 'heal') this.sim.useHeal(h)
    else if (message.t === 'buy') { const item = this.sim.nextItem(h); if (item) this.sim.buy(h, item.id) }
    else if (message.t === 'auto') seat.auto = Boolean(message.on)
  }
  private resetInput() {
    this.keys.clear(); this.holdAttack = this.mouseAttack = false; this.aiming = null; this.stick = { x: 0, y: 0 }
    Object.assign(this.sim.input, { mx: 0, my: 0, attack: false, prefer: 'auto' })
  }
  setStick(x: number, y: number) { if (this.active) this.stick = { x, y } }
  setAttack(held: boolean, prefer: 'auto' | 'minion' | 'tower' = 'auto') { if (!this.active) return; this.holdAttack = held; this.sim.input.prefer = held ? prefer : 'auto' }
  aimStart(slot: number, mouse = false) {
    if (!this.active || !this.sim.skillReady(this.sim.player, slot)) return
    this.aiming = { slot, drag: null, mouse, at: performance.now() }
  }
  /** Drag vector in button radii: (0,0) is the button centre, length 1 is full reach. */
  aimDrag(slot: number, x: number, y: number) {
    if (!this.active || this.aiming?.slot !== slot) return
    const len = Math.hypot(x, y)
    this.aiming.drag = len < 0.22 ? null : { x: x / Math.max(1, len), y: y / Math.max(1, len) }
  }
  aimCancel() { this.aiming = null }
  aimRelease(slot: number) {
    if (!this.active || this.aiming?.slot !== slot) return
    const me = this.sim.player, skill = me.def.skills[slot], manual = this.manual(), preview = this.preview()
    this.aiming = null
    // A tap leaves aiming to the sim, which re-picks the target at the moment of the cast.
    const aim = !manual ? undefined : skill.aim === 'dir' ? preview?.dir : skill.aim === 'point' ? preview?.point : undefined
    if (this.order({ t: 'cast', slot, aim }, () => this.sim.cast(me, slot, aim))) this.sound.play(slot === 2 ? 'ult' : 'cast')
  }
  /** 闪现 toward the stick / keys, else toward the mouse, else straight ahead. */
  flash() {
    if (!this.active) return
    const { mx, my } = this.movement(), me = this.sim.player
    let dir: Vec | undefined = Math.hypot(mx, my) > 0.12 ? { x: mx, y: my } : undefined
    if (!dir && this.mouse) { const world = this.renderer.ground(this.mouse.x, this.mouse.y); dir = { x: world.x - me.x, y: world.y - me.y } }
    if (this.order({ t: 'flash', dir }, () => this.sim.flash(me, dir))) this.sound.play('whoosh', 1.3)
  }
  /** Slow the world for a beat: hit-stop on big moments. */
  private slow(seconds: number, scale: number) { if (this.net) return; if (seconds > this.slowLeft) { this.slowLeft = seconds; this.slowScale = scale } } // online, slow motion would slow the shared world
  /** Take one of the offered level-up cards. */
  pick(index: number) {
    if (!this.active || !this.sim.player.offer?.[index]) return
    if (this.guestSide) this.sim.player.offer = null // hide the cards now; the host's snapshot confirms
    if (this.order({ t: 'pick', i: index }, () => this.sim.pick(index))) { this.sound.play('level'); this.emit() }
  }
  recall() { if (this.active) this.order({ t: 'recall' }, () => this.sim.recall()) }
  heal() { if (this.active && this.order({ t: 'heal' }, () => this.sim.useHeal())) this.sound.play('level') }
  buyNext() {
    if (!this.active) return
    const item = this.sim.nextItem(this.sim.player)
    if (item && this.sim.player.gold >= item.cost && this.order({ t: 'buy' }, () => this.sim.buy(this.sim.player, item.id))) { this.sound.play('buy'); this.emit() }
  }
  togglePause() {
    if (this.destroyed || this.sim.winner !== null) return
    this.paused = !this.paused; this.resetInput(); this.emit()
  }
  toggleAuto() {
    if (!this.active) return
    this.resetInput(); this.sim.autopilot = !this.sim.autopilot
    if (this.guestSide) this.net!.link.send({ t: 'auto', on: this.sim.autopilot })
    this.emit()
  }
  setMuted(muted: boolean) { this.sound.muted = muted }

  /** A key tapped (released within this time) or a skill button tapped without dragging auto-aims. */
  private static readonly TAP = 0.22
  private manual() {
    const a = this.aiming
    if (!a) return false
    return a.mouse ? Boolean(this.mouse) && (performance.now() - a.at) / 1000 >= ArenaGame.TAP : Boolean(a.drag)
  }
  private preview(): AimPreview {
    if (!this.aiming) return null
    const me = this.sim.player, skill = me.def.skills[this.aiming.slot]
    let dir: Vec | undefined, point: Vec | undefined
    if (!this.manual()) {
      // Show where the auto-aim will send it, so a tap is never a surprise.
      const auto = this.sim.autoAim(me, this.aiming.slot)
      if (auto && skill.aim === 'dir') dir = auto
      else if (auto) { point = auto; dir = { x: auto.x - me.x, y: auto.y - me.y } }
    } else if (this.aiming.mouse && this.mouse) {
      const world = this.renderer.ground(this.mouse.x, this.mouse.y)
      dir = { x: world.x - me.x, y: world.y - me.y }; point = world
    } else if (this.aiming.drag) {
      const d = this.aiming.drag
      dir = d; point = { x: me.x + d.x * skill.range, y: me.y + d.y * skill.range }
    }
    if (point) { const len = Math.hypot(point.x - me.x, point.y - me.y); if (len > skill.range) point = { x: me.x + (point.x - me.x) / len * skill.range, y: me.y + (point.y - me.y) / len * skill.range } }
    return { skill, dir, point }
  }

  // ---------- events and snapshots (solo and host) ----------
  private dispatch() {
    const guest = this.net && !this.friendLeft ? this.sim.guest : undefined
    for (const event of this.sim.events.splice(0)) {
      const mine = this.net ? this.sim.localize(event, this.sim.player) : event
      if (mine) this.handle(mine)
      const theirs = guest && this.sim.localize(event, guest)
      // Effects far off the friend's screen are not worth the bandwidth; results (kills, towers, the end) always go.
      const far = theirs && 'x' in theirs && !['kill', 'tower', 'end', 'boss'].includes(theirs.type) && Math.hypot((theirs as { x: number }).x - guest!.x, (theirs as { y: number }).y - guest!.y) > 1700
      if (theirs && !far) this.outbox.push(theirs)
    }
  }
  private sendSnapshot() { const guest = this.sim.guest; if (guest) this.net!.link.send({ t: 'snap', s: encode(this.sim, guest, this.outbox.splice(0)) }) }

  // ---------- loop ----------
  private movement() {
    const k = this.keys
    const mx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0) + this.stick.x
    const my = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0) + this.stick.y
    const len = Math.max(1, Math.hypot(mx, my))
    return { mx: mx / len, my: my / len }
  }
  private loop = (now: number) => {
    if (this.destroyed) return
    const dt = this.previous ? Math.min(0.1, (now - this.previous) / 1000) : 0
    this.previous = now
    // Online the match never pauses: the menu only stops this player's own input.
    const live = (!this.paused || Boolean(this.net)) && this.renderer.loaded && this.sim.winner === null
    let simDt = 0
    if (live) {
      const k = this.keys, attack = this.active && (this.holdAttack || this.mouseAttack || k.has('j') || k.has(' '))
      const move = this.active ? this.movement() : { mx: 0, my: 0 }
      Object.assign(this.sim.input, move); this.sim.input.attack = attack
      if (this.guestSide) {
        // Guest: show the host's match. Apply every snapshot that arrived, then glide between them.
        for (const snap of this.inbox.splice(0)) { this.gotSnapshot = true; for (const event of apply(this.sim, snap, now)) this.handle(event) }
        interpolate(this.sim, now)
        if ((this.snapTimer -= dt) <= 0) { this.snapTimer = SNAP_EVERY; if (!this.friendLeft) this.net!.link.send({ t: 'in', ...move, attack, prefer: this.sim.input.prefer }) }
        simDt = this.gotSnapshot ? dt : 0
      } else {
        const scale = this.slowLeft > 0 ? this.slowScale : 1
        this.slowLeft = Math.max(0, this.slowLeft - dt)
        simDt = dt * scale
        for (let left = simDt; left > 1e-5; left -= MAX_STEP) this.sim.step(Math.min(left, MAX_STEP))
        this.dispatch()
        if (this.net && !this.friendLeft && (this.snapTimer -= dt) <= 0) { this.snapTimer = SNAP_EVERY; this.sendSnapshot() }
      }
    }
    // However the match ended, the host drains the last events and sends one final snapshot with the result.
    if (this.net?.role === 'host' && this.sim.winner !== null && !this.finalSent) { this.dispatch(); if (!this.friendLeft) this.sendSnapshot(); this.finalSent = true }
    this.announceLeft -= this.paused ? 0 : dt
    if (this.announceLeft <= 0) this.announce = null
    if ((this.cutinLeft -= this.paused ? 0 : dt) <= 0) this.cutin = null
    if (live || !this.renderer.loaded) this.renderer.draw(simDt, this.preview())
    if ((this.hudTimer -= dt) <= 0) { this.hudTimer = 0.1; this.emit() }
    this.frame = requestAnimationFrame(this.loop)
  }
  private say(text: string, tone: Tone, seconds = 2.6) { this.announce = { id: this.noteId++, text, tone }; this.announceLeft = seconds }
  private handle(event: ArenaEvent) {
    this.renderer.handle(event)
    const me = this.sim.player
    if (event.type === 'kill') {
      const ours = event.killerTeam === me.team
      this.feed = [{ id: this.noteId++, text: event.killer ? `${event.killer} 击败 ${event.victim}` : `${event.victim} 阵亡`, tone: (ours ? 'good' : 'bad') as Tone }, ...this.feed].slice(0, 4)
      if (event.role === 'killer') {
        this.bestStreak = Math.max(this.bestStreak, event.streak)
        const text = event.first ? '先登！拿下首杀' : event.multi >= 5 ? '五连斩 · 全歼敌将！' : event.multi === 4 ? '四连斩！' : event.multi === 3 ? '三连斩！' : event.multi === 2 ? '连斩！' : event.streak >= 7 ? '天下无双' : event.streak >= 5 ? '万人敌' : event.streak >= 3 ? '锐不可当' : `击败 ${event.victim}`
        this.say(text, 'good', 3); this.sound.play('kill', 1.4); this.slow(0.45, 0.3)
      } else if (event.role === 'victim') { this.say(event.killer ? `你被 ${event.killer} 击败` : '你阵亡了', 'bad', 3); this.sound.play('death') }
      else if (event.role === 'assist') { this.say(`助攻 · ${event.victim} 倒下`, 'good', 2); this.sound.play('kill', 0.8) }
      else if (event.first) this.say(`${event.killer} 拿下首杀`, ours ? 'good' : 'bad', 2)
    } else if (event.type === 'tower') {
      const lane = { top: '上路', mid: '中路', bot: '下路' }[event.lane]
      const theirs = event.team !== me.team
      this.say(theirs ? `攻破敌方${lane}防御塔！` : `我方${lane}防御塔失守`, theirs ? 'good' : 'bad', 3.2); this.sound.play('tower')
    } else if (event.type === 'bossSpawn') { this.say('镇河铁牛现身下游河道', 'plain', 3.2); this.sound.play('horn') }
    else if (event.type === 'boss') { const ours = event.team === me.team; this.say(ours ? '我方降服铁牛 · 全军增益' : '敌方降服了铁牛', ours ? 'good' : 'bad', 3.2); this.sound.play('horn') }
    else if (event.type === 'grow' && event.mine) {
      const card = event.card
      if (event.awake && card.kind === 'skill') { this.say(`「${me.def.skills[card.slot].name}」觉醒！`, 'good', 3); this.sound.play('ult', 0.8) }
      else if (card.kind === 'auto' && me.autos.find(a => a.id === card.id)?.rank === 1) this.say(`习得武学「${AUTOS[card.id].name}」`, 'good', 2.4)
    } else if (event.type === 'zap' || event.type === 'nova' || event.type === 'summon') { if (Math.hypot(event.x - me.x, event.y - me.y) < 700) this.sound.play(event.type === 'zap' ? 'slash' : 'whoosh', 0.6) }
    else if (event.type === 'levelup' && event.mine) { this.sound.play('level'); if (me.level === ULT_LEVEL) this.say(`大招「${me.def.skills[2].name}」已解锁`, 'good', 3) }
    else if (event.type === 'cast') {
      const near = Math.hypot(event.x - me.x, event.y - me.y) < 800
      if (event.mine && event.slot === 2) {
        const skill = me.def.skills[2]
        this.cutin = { id: this.noteId++, glyph: skill.glyph, name: skill.name, color: me.def.color }; this.cutinLeft = 1.1
        this.slow(0.22, 0.25); this.sound.play('boom', 1.4)
      } else if (!event.mine && near) this.sound.play(event.slot === 2 ? 'boom' : 'whoosh', event.slot === 2 ? 1 : 0.5)
    } else if (event.type === 'hit') { if (Math.hypot(event.x - me.x, event.y - me.y) < 500) this.sound.play(event.big ? 'slash' : 'hit', event.big ? 0.9 : 0.5) }
    else if (event.type === 'dmg') { if (event.mine && event.heavy) this.slow(0.06, 0.15) }
    else if (event.type === 'gold') this.sound.play('coin', 0.6)
    else if (event.type === 'flash') { if (Math.hypot(event.x - me.x, event.y - me.y) < 800) this.sound.play('whoosh', 0.8) }
    else if (event.type === 'end') { const won = event.winner === me.team; this.say(won ? '敌鼎已破 · 胜利！' : '我方大鼎被毁', won ? 'good' : 'bad', 6); this.sound.play(won ? 'win' : 'lose', 1.5); this.emit() }
  }
  private emit() {
    const sim = this.sim, me = sim.player, next = sim.nextItem(me)
    const towers = [0, 1].map(team => sim.units.filter(u => u.kind === 'tower' && u.team === team && u.alive).length) as [number, number]
    this.onHud({
      status: sim.winner !== null ? 'ended' : this.guestSide && this.friendLeft ? 'lost' : !this.renderer.loaded || (this.guestSide && !this.gotSnapshot) ? 'loading' : this.paused ? 'paused' : 'playing',
      online: this.net?.role ?? null, team: me.team,
      friend: this.friendHero ? { name: this.friendHero.def.name, alive: this.friendHero.alive, left: this.friendLeft } : null,
      time: sim.time, kills: [sim.kills[0], sim.kills[1]], towers, winner: sim.winner, auto: sim.autopilot, boss: [sim.bossBuff[0], sim.bossBuff[1]],
      me: {
        name: me.def.name, level: me.level, xp: Math.min(1, me.xp / (100 + 62 * me.level)), hp: Math.max(0, Math.round(me.hp)), maxHp: Math.round(me.maxHp), shield: Math.round(me.shield), gold: Math.floor(me.gold),
        k: me.k, d: me.d, a: me.a, alive: me.alive, respawn: Math.max(0, me.respawnAt - sim.time), items: me.items.map(itemById), recall: me.recallT > 0 ? 1 - me.recallT / 3.5 : 0, heal: me.healCd, flash: me.flashCd, dealt: Math.round(me.dealt), bestStreak: this.bestStreak,
        combo: me.alive && sim.time - me.chainAt < 2.6 ? me.chain : 0,
        skills: me.def.skills.map((s, i) => ({ name: s.name, glyph: s.glyph, desc: s.desc, left: me.cds[i], total: s.cd * (1 - 0.08 * me.ranks[i]) * (1 - me.cdr), locked: i === 2 && me.level < ULT_LEVEL, rank: me.ranks[i] })),
        offer: me.offer ? me.offer.map(c => describe(c, { ranks: me.ranks, autos: me.autos, perks: me.perks }, me.def)) : null, picks: me.picks,
        autos: me.autos.map(a => ({ glyph: AUTOS[a.id].glyph, name: AUTOS[a.id].name, rank: a.rank, color: AUTOS[a.id].color })),
        perks: Object.entries(me.perks).map(([id, count]) => ({ glyph: PERKS[id as keyof typeof PERKS].glyph, name: PERKS[id as keyof typeof PERKS].name, count: count ?? 0 })),
      },
      next: next && me.items.length < MAX_ITEMS ? { ...next, can: me.gold >= next.cost } : null,
      announce: this.announce, cutin: this.cutin, feed: this.feed,
      board: sim.heroes.map(h => ({ name: h.def.name, team: h.team, level: h.level, k: h.k, d: h.d, a: h.a, me: h === me, alive: h.alive, cls: h.def.cls })),
    })
  }

  // ---------- minimap ----------
  drawMinimap(ctx: CanvasRenderingContext2D, size: number) {
    const k = size / MAP, sim = this.sim
    if (!this.mapBase || this.mapBase.width !== size) {
      const base = document.createElement('canvas'); base.width = base.height = size
      const g = base.getContext('2d')!
      g.fillStyle = '#263a2c'; g.fillRect(0, 0, size, size)
      g.strokeStyle = '#3f6d74'; g.lineWidth = 9 * size / 150; g.beginPath(); g.moveTo(0, 0); g.lineTo(size, size); g.stroke()
      g.strokeStyle = '#8d7b5a'; g.lineWidth = 5 * size / 150; g.lineJoin = 'round'
      for (const lane of LANE_IDS) { const pts = [BASE[0], ...LANES[lane], BASE[1]]; g.beginPath(); g.moveTo(pts[0].x * k, pts[0].y * k); for (const p of pts.slice(1)) g.lineTo(p.x * k, p.y * k); g.stroke() }
      for (const team of [0, 1]) { g.fillStyle = team ? '#7a3a32' : '#2f5f8a'; g.beginPath(); g.arc(FOUNTAIN[team].x * k, FOUNTAIN[team].y * k, 11 * size / 150, 0, Math.PI * 2); g.fill() }
      this.mapBase = base
    }
    ctx.clearRect(0, 0, size, size); ctx.drawImage(this.mapBase, 0, 0)
    const unit = size / 150
    for (const u of sim.units) {
      if (!u.alive) continue
      const x = u.x * k, y = u.y * k, blue = u.team === 0
      if (u.kind === 'minion') { ctx.fillStyle = blue ? '#8cc4ee' : '#ee9a8c'; ctx.fillRect(x - unit * 0.8, y - unit * 0.8, unit * 1.6, unit * 1.6) }
      else if (u.kind === 'tower' || u.kind === 'base') {
        const s = (u.kind === 'base' ? 5 : 3.2) * unit
        ctx.fillStyle = blue ? '#4f9ae0' : '#e0604f'; ctx.fillRect(x - s, y - s, s * 2, s * 2); ctx.strokeStyle = '#10140f'; ctx.lineWidth = 1; ctx.strokeRect(x - s, y - s, s * 2, s * 2)
      } else if (u.kind === 'monster') { ctx.fillStyle = u.sub === 'boss' ? '#e8c860' : '#a7a58a'; ctx.beginPath(); ctx.arc(x, y, (u.sub === 'boss' ? 3.4 : 2) * unit, 0, Math.PI * 2); ctx.fill() }
    }
    for (const h of sim.heroes) {
      if (!h.alive) continue
      const x = h.x * k, y = h.y * k, mine = h === sim.player
      ctx.beginPath(); ctx.arc(x, y, (mine ? 5 : 4) * unit, 0, Math.PI * 2)
      ctx.fillStyle = mine ? '#ffd76a' : h.team === 0 ? '#58a8f0' : '#f0604c'; ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = mine ? 2 : 1; ctx.stroke()
    }
  }
  destroy() {
    this.destroyed = true; cancelAnimationFrame(this.frame)
    this.cleanup.forEach(fn => fn()); this.renderer.destroy(); this.sound.destroy()
  }
}
