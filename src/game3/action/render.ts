import { DynastyBattle, ENVOYS, HOUSEHOLDS } from './engine'
import { Enemy, WORLD, clamp, distance } from './model'

export class BattleRenderer {
  private ctx: CanvasRenderingContext2D
  private terrain = new Image()
  private hero = new Image()
  private settlements = new Image()
  private observer: ResizeObserver
  private width = 960
  private height = 640
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!
    this.terrain.src = 'arts/v3-ui/battlefield.jpg'
    this.hero.src = 'arts/v3-ui/general.png'
    this.settlements.src = 'arts/v3-ui/settlements.png'
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(canvas); this.resize()
  }
  private resize() {
    const rect = this.canvas.getBoundingClientRect()
    this.width = Math.max(320, rect.width); this.height = Math.max(300, rect.height)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.canvas.width = this.width * dpr; this.canvas.height = this.height * dpr
  }
  destroy() { this.observer.disconnect() }
  draw(game: DynastyBattle) {
    const c = this.ctx, w = this.width, h = this.height, dpr = this.canvas.width / w
    // Portrait keeps enemies readable; the camera follows the player through the same world.
    const scale = w < 600 ? .77 : Math.min(1.15, w / 1100)
    const vw = w / scale, vh = h / scale
    const cx = clamp(game.player.x - vw / 2, 0, Math.max(0, WORLD.width - vw))
    const cy = clamp(game.player.y - vh / 2, 0, Math.max(0, WORLD.height - vh))
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.fillStyle = '#293528'; c.fillRect(0, 0, w, h)
    c.save(); c.scale(scale, scale)
    c.translate(-cx + (this.reduced ? 0 : (Math.random() - .5) * game.shake), -cy)
    if (this.terrain.complete && this.terrain.naturalWidth) c.drawImage(this.terrain, 0, 0, WORLD.width, WORLD.height)
    else { c.fillStyle = '#526046'; c.fillRect(0, 0, WORLD.width, WORLD.height) }
    c.fillStyle = 'rgba(12,22,20,.18)'; c.fillRect(0, 0, WORLD.width, WORLD.height)
    for (const city of game.cities) {
      const color = city.owned ? '#93c7aa' : '#ebbe74'
      c.beginPath(); c.arc(city.x, city.y, 115, 0, Math.PI * 2)
      c.fillStyle = city.owned ? 'rgba(86,171,123,.13)' : 'rgba(233,185,95,.08)'; c.fill()
      c.setLineDash([6, 9]); c.lineWidth = 2; c.strokeStyle = city.owned ? '#93c7aa80' : '#edc98980'; c.stroke(); c.setLineDash([])
      if (city.progress > 0 && !city.owned) {
        c.beginPath(); c.arc(city.x, city.y, 112, -Math.PI / 2, -Math.PI / 2 + city.progress / 100 * Math.PI * 2)
        c.lineWidth = 6; c.strokeStyle = color; c.stroke()
      }
      this.building(city.x, city.y - 20, city.name === '关隘' ? 'gate' : city.name === '祭坛' ? 'altar' : city.name === '粮仓' ? 'granary' : 'hall')
      this.shadow(city.x, city.y + 5, 42)
      // Fort marker is an original live structure, not part of the ground texture.
      c.fillStyle = '#d4bd8b'; c.fillRect(city.x - 2, city.y - 96, 4, 83)
      c.fillStyle = city.owned ? '#396b54' : '#922f2c'
      c.beginPath(); c.moveTo(city.x + 2, city.y - 94); c.lineTo(city.x + 42, city.y - 88 + Math.sin(game.seconds * 3) * 3); c.lineTo(city.x + 35, city.y - 53); c.lineTo(city.x + 2, city.y - 58); c.fill()
      this.text(city.owned ? '鼎' : '守', city.x + 19, city.y - 70, '#f6d99c', 17)
      this.text(city.name, city.x, city.y + 41, '#fff1cf', 18)
      this.text(city.owned ? '政令已达 · ' + city.title : city.title, city.x, city.y + 61, color, 11)
    }
    for (const [index, home] of (game.order?.deliveries ?? HOUSEHOLDS).entries()) {
      this.building(home.x, home.y - 20, 'house')
      this.civilian(home.x - 24, home.y + 20, '#a99a6b', game.seconds + index)
      if (game.order?.kind === 'relief') this.text(game.completed.has(index) ? '已领物资' : '待发放', home.x, home.y + 48, '#f3dfb0', 12)
    }
    for (const [index, envoy] of ENVOYS.entries()) {
      this.civilian(envoy.x, envoy.y, ['#608f90', '#a79b64', '#985e48'][index], game.seconds)
      this.text(['文官', '乡老', '军官'][index], envoy.x, envoy.y - 59, '#ecddba', 12)
    }
    for (let i = 0; i < 10; i++) {
      const x = 800 + i * 32 + Math.sin(game.seconds * .25 + i) * 38, y = 700 + (i % 3) * 100 + Math.cos(game.seconds * .2 + i) * 32
      this.civilian(x, y, ['#9c875e', '#647c70', '#916f61'][i % 3], game.seconds * 2 + i)
    }
    if (game.order?.kind === 'escort') {
      const v = game.wagon
      if (game.order.convoy === 'people') {
        for (let i = 0; i < 4; i++) this.civilian(v.x + (i % 2) * 25 - 12, v.y + Math.floor(i / 2) * 25, '#b29d73', game.seconds * 2 + i)
        this.text('随行队伍', v.x, v.y - 61, '#f5ddb1', 14)
      } else {
      this.shadow(v.x, v.y, 35)
      c.fillStyle = '#3f3323'; c.fillRect(v.x - 31, v.y - 22, 62, 42)
      c.fillStyle = '#b29158'; c.fillRect(v.x - 27, v.y - 28, 54, 39)
      for (let i = 0; i < 3; i++) { c.fillStyle = '#d0b681'; c.beginPath(); c.ellipse(v.x - 17 + i * 17, v.y - 21, 10, 18, .2, 0, Math.PI * 2); c.fill() }
      c.fillStyle = '#2a2920'; for (const x of [-31, 31]) { c.beginPath(); c.ellipse(v.x + x, v.y + 10, 6, 16, 0, 0, Math.PI * 2); c.fill() }
      this.text('辎重车', v.x, v.y - 51, '#f5ddb1', 14)
      }
    }
    const interaction = game.interactionTarget()
    c.save(); c.strokeStyle = '#ffe1a0'; c.lineWidth = 3; c.setLineDash([5, 5])
    c.beginPath(); c.ellipse(interaction.x, interaction.y + 12, 41 + Math.sin(game.seconds * 3) * 3, 19, 0, 0, Math.PI * 2); c.stroke(); c.restore()
    if (distance(game.player, interaction) < 105 && game.order?.kind !== 'assault') this.text('E · 交互', interaction.x, interaction.y - 105, '#fff5d4', 15)
    for (const enemy of game.enemies) if (enemy.windup > 0) {
      c.strokeStyle = '#ffb68d'; c.fillStyle = 'rgba(193,58,35,.3)'; c.lineWidth = 2
      if (enemy.kind === 'archer') {
        c.beginPath(); c.moveTo(enemy.x, enemy.y); c.lineTo(enemy.target.x, enemy.target.y); c.stroke()
      } else {
        const radius = enemy.kind === 'brute' ? 65 : 44
        c.beginPath(); c.arc(enemy.target.x, enemy.target.y, radius, 0, Math.PI * 2); c.fill(); c.stroke()
      }
    }
    for (const heal of game.heals) {
      c.save(); c.shadowColor = '#b7edb8'; c.shadowBlur = 14
      c.fillStyle = '#a7d9a6'; c.beginPath(); c.arc(heal.x, heal.y + Math.sin(game.seconds * 4) * 3, 6, 0, Math.PI * 2); c.fill(); c.restore()
    }
    const actors = [...game.enemies.map(e => ({ y: e.y, enemy: e })), { y: game.player.y, enemy: null }].sort((a, b) => a.y - b.y)
    for (const actor of actors) {
      if (actor.enemy) this.soldier(actor.enemy, game)
      else {
        const p = game.player
        this.shadow(p.x, p.y + 9, 27)
        c.beginPath(); c.ellipse(p.x, p.y + 10, 27, 13, 0, 0, Math.PI * 2); c.strokeStyle = '#f4d68e'; c.lineWidth = 2; c.stroke()
        c.save(); c.translate(p.x, p.y - 24 + Math.sin(p.step) * 2); c.scale(p.facing, 1)
        if (p.invulnerable > 0) { c.shadowColor = '#dbedd9'; c.shadowBlur = 14 }
        if (this.hero.complete && this.hero.naturalWidth) c.drawImage(this.hero, -55, -61, 110, 118)
        else { c.fillStyle = '#6ba489'; c.fillRect(-13, -30, 26, 45) }
        c.restore()
        this.text(game.carrying ? (game.order?.kind === 'ceremony' ? '携带文书' : game.order?.cargo ?? '携带物资') : '你', p.x, p.y - 95, '#ffe7ae', 12)
      }
    }
    for (const slash of game.slashes) {
      const alpha = slash.life / slash.maxLife
      c.save(); c.globalAlpha = alpha; c.lineCap = 'round'
      c.strokeStyle = slash.circle ? '#a8ddd0' : '#fff0c0'; c.lineWidth = 5 + alpha * 9
      c.shadowColor = '#f7ce8a'; c.shadowBlur = 12
      c.beginPath(); c.arc(slash.x, slash.y - 12, slash.radius * (1 - alpha * .18), slash.circle ? 0 : slash.angle - 1.1, slash.circle ? Math.PI * 2 : slash.angle + 1.1); c.stroke(); c.restore()
    }
    for (const shot of game.projectiles) {
      c.strokeStyle = shot.friendly ? '#ffedb3' : '#f2a080'; c.lineWidth = shot.friendly ? 4 : 3
      c.beginPath(); c.moveTo(shot.x, shot.y); c.lineTo(shot.x - shot.vx * .045, shot.y - shot.vy * .045); c.stroke()
    }
    for (const p of game.particles) { c.globalAlpha = p.life / p.maxLife; c.fillStyle = p.color; c.fillRect(p.x, p.y, p.size, p.size) }
    c.globalAlpha = 1
    for (const t of game.texts) { c.globalAlpha = Math.min(1, t.life * 3); this.text(t.text, t.x, t.y, t.color, 17) }
    c.globalAlpha = 1
    // Point toward the nearest uncaptured objective when it is offscreen.
    const target = { ...game.interactionTarget(), name: game.order ? '目的地' : '新消息' }
    if (target && (target.x < cx + 50 || target.x > cx + vw - 50 || target.y < cy + 90 || target.y > cy + vh - 80)) {
      const x = clamp(target.x, cx + 50, cx + vw - 50), y = clamp(target.y, cy + 140, cy + vh - 140)
      c.save(); c.translate(x, y); c.rotate(Math.atan2(target.y - game.player.y, target.x - game.player.x))
      c.fillStyle = '#f1d69c'; c.beginPath(); c.moveTo(13, 0); c.lineTo(-7, -8); c.lineTo(-7, 8); c.fill(); c.restore()
      this.text(target.name, x, y + 29, '#fff2c7', 13)
    }
    c.restore()
    const vignette = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .2, w / 2, h / 2, Math.max(w, h) * .65)
    vignette.addColorStop(0, 'transparent'); vignette.addColorStop(1, 'rgba(5,15,12,.52)')
    c.fillStyle = vignette; c.fillRect(0, 0, w, h)
    if (game.player.hp < game.player.maxHp * .3) { c.strokeStyle = '#a13d36'; c.lineWidth = 10; c.strokeRect(0, 0, w, h) }
  }
  private building(x: number, y: number, kind: 'gate' | 'hall' | 'house' | 'altar' | 'granary') {
    const c = this.ctx, size = kind === 'house' ? .65 : 1
    if (kind !== 'altar' && this.settlements.complete && this.settlements.naturalWidth) {
      const sw = this.settlements.naturalWidth / 2, sh = this.settlements.naturalHeight / 2
      const index = { gate: 0, hall: 1, granary: 2, house: 3 }[kind]
      c.drawImage(this.settlements, (index % 2) * sw, Math.floor(index / 2) * sh, sw, sh, x - 150 * size, y - 165 * size, 300 * size, 200 * size)
      return
    }
    c.save(); c.translate(x, y); c.scale(size, size)
    c.fillStyle = 'rgba(13,24,14,.3)'; c.fillRect(-80, -53, 180, 106)
    c.fillStyle = '#a89b79'; c.fillRect(-86, -3, 172, 40)
    c.fillStyle = '#756c55'; c.fillRect(-80, -45, 160, 57)
    if (kind !== 'altar') {
      c.fillStyle = '#9f9171'; c.fillRect(-65, -65, 130, 58)
      c.fillStyle = '#3b3329'; c.fillRect(-16, -53, 32, 47)
      c.fillStyle = '#413f35'; c.beginPath(); c.moveTo(-104, -49); c.quadraticCurveTo(-75, -55, -66, -89); c.lineTo(66, -89); c.quadraticCurveTo(75, -55, 104, -49); c.lineTo(0, -26); c.closePath(); c.fill()
      c.strokeStyle = '#99917a'; c.lineWidth = 2
      for (let i = -65; i <= 65; i += 13) { c.beginPath(); c.moveTo(i, -88); c.lineTo(i * 1.45, -47 + Math.abs(i) * .02); c.stroke() }
      c.strokeStyle = '#baa77b'; c.lineWidth = 3; c.beginPath(); c.moveTo(-69, -89); c.lineTo(69, -89); c.stroke()
      c.fillStyle = '#b96e3c'; c.fillRect(-44, -30, 9, 15); c.fillRect(35, -30, 9, 15)
    } else {
      c.fillStyle = '#b7a986'; c.fillRect(-60, -28, 120, 42)
      c.fillStyle = '#586953'; c.fillRect(-22, -57, 44, 35)
      c.strokeStyle = '#a5925f'; c.lineWidth = 5; c.strokeRect(-26, -67, 52, 27)
      c.fillStyle = '#d6be7a'; c.fillRect(-17, -28, 7, 16); c.fillRect(10, -28, 7, 16)
    }
    c.restore()
  }
  private civilian(x: number, y: number, color: string, time: number) {
    const c = this.ctx; this.shadow(x, y + 5, 12)
    c.save(); c.translate(x, y + Math.sin(time) * 1.2)
    const step = Math.sin(time * 2) * 2
    c.fillStyle = '#292b24'; c.beginPath(); c.ellipse(-5, 5 + step, 4, 7, -.2, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(5, 5 - step, 4, 7, .2, 0, Math.PI * 2); c.fill()
    const robe = c.createLinearGradient(-14, 0, 14, 0); robe.addColorStop(0, '#344136'); robe.addColorStop(.45, color); robe.addColorStop(1, '#4c4d3a')
    c.fillStyle = robe; c.beginPath(); c.moveTo(-6, -32); c.quadraticCurveTo(-15, -28, -17, -12); c.lineTo(-10, -10); c.lineTo(-13, 1); c.quadraticCurveTo(0, 6, 13, 1); c.lineTo(10, -10); c.lineTo(17, -12); c.quadraticCurveTo(15, -28, 6, -32); c.closePath(); c.fill()
    c.strokeStyle = '#c2b087'; c.lineWidth = 1; c.beginPath(); c.moveTo(-5, -30); c.lineTo(6, -18); c.lineTo(4, 0); c.stroke()
    c.fillStyle = '#66543b'; c.fillRect(-11, -15, 22, 3)
    c.fillStyle = '#c3a27b'; c.beginPath(); c.ellipse(0, -37, 6.5, 8, 0, 0, Math.PI * 2); c.fill(); c.fillRect(-16, -13, 4, 5); c.fillRect(12, -13, 4, 5)
    c.fillStyle = '#30392f'; c.beginPath(); c.arc(0, -40, 7, Math.PI, Math.PI * 2); c.fill(); c.fillRect(-4, -49, 8, 5)
    c.fillStyle = '#5a4934'; c.fillRect(-3, -37, 1, 1); c.fillRect(3, -37, 1, 1); c.restore()
  }
  private shadow(x: number, y: number, radius: number) {
    const c = this.ctx; c.fillStyle = 'rgba(10,15,10,.4)'; c.beginPath(); c.ellipse(x + 5, y + 3, radius, radius * .38, -.15, 0, Math.PI * 2); c.fill()
  }
  private text(text: string, x: number, y: number, color: string, size: number) {
    const c = this.ctx; c.font = `600 ${size}px "Songti SC", serif`; c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = '#17261ee0'; c.strokeText(text, x, y); c.fillStyle = color; c.fillText(text, x, y)
  }
  private soldier(e: Enemy, game: DynastyBattle) {
    const c = this.ctx, s = e.kind === 'brute' ? 1.25 : 1
    this.shadow(e.x, e.y + 7, 19 * s)
    c.save(); c.translate(e.x, e.y); c.scale(e.x < game.player.x ? s : -s, s)
    const step = Math.sin(e.step) * 4
    c.fillStyle = '#262c27'; c.fillRect(-10, -2 + step, 8, 17); c.fillRect(3, -2 - step, 8, 17)
    c.fillStyle = e.flash > 0 ? '#f4dfad' : e.kind === 'archer' ? '#847251' : '#764641'
    c.beginPath(); c.moveTo(-16, -30); c.lineTo(13, -30); c.lineTo(18, 5); c.lineTo(-19, 5); c.fill()
    c.fillStyle = e.flash > 0 ? '#fff7ce' : '#48514c'; c.fillRect(-11, -32, 23, 27)
    c.strokeStyle = '#a6a08a'; c.lineWidth = 1
    for (let row = 0; row < 4; row++) { c.beginPath(); c.moveTo(-10, -26 + row * 6); c.lineTo(11, -26 + row * 6); c.stroke() }
    c.fillStyle = '#b39869'; c.fillRect(-12, -4, 26, 4)
    c.fillStyle = '#c6a27c'; c.beginPath(); c.arc(0, -40, 9, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#3a4540'; c.beginPath(); c.arc(0, -44, 11, Math.PI, Math.PI * 2); c.fill(); c.fillRect(-12, -44, 24, 4)
    c.fillStyle = '#973d32'; c.fillRect(-2, -62, 4, 12)
    c.strokeStyle = '#baa478'; c.lineWidth = 3; c.beginPath(); c.moveTo(20, 12); c.lineTo(20, -48); c.stroke()
    if (e.kind === 'archer') { c.strokeStyle = '#d7ba80'; c.beginPath(); c.arc(18, -17, 24, -Math.PI / 2, Math.PI / 2); c.stroke() }
    else { c.fillStyle = '#cdd0be'; c.beginPath(); c.moveTo(20, -62); c.lineTo(27, -42); c.lineTo(19, -46); c.fill() }
    c.restore()
    if (e.hp < e.maxHp) { c.fillStyle = '#281b17'; c.fillRect(e.x - 20, e.y - 70 * s, 40, 4); c.fillStyle = '#d3886d'; c.fillRect(e.x - 20, e.y - 70 * s, 40 * Math.max(0, e.hp / e.maxHp), 4) }
  }
}
