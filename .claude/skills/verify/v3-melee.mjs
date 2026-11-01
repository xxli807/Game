import { build } from 'esbuild'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const bundle = await build({ stdin: { contents: "export { DynastyBattle } from './src/game3/action/engine'", resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', globalName: 'MeleeTest' })
const browser = await chromium.launch()
try {
  const page = await browser.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('http://localhost:8080/v3/')
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  console.log(await page.evaluate(() => {
    const check = (condition, message) => { if (!condition) throw Error(message) }
    const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:900px;height:600px'; document.body.append(canvas)
    const game = new MeleeTest.DynastyBattle(canvas, () => {}); game.sound.muted = true
    game.setEvent({ id: 'oath', title: '军阵', phase: '蛰伏', source: '外交', body: '', options: [] }, 0)
    game.startFieldBattle(); game.allies = []; game.enemies = [game.enemies.find(e => e.kind === 'soldier')]
    const enemy = game.enemies[0]
    const reset = () => {
      game.clearInput(); game.attackTimer = 0; game.comboWindow = 0; game.counterWindow = 0
      Object.assign(game.player, { x: 900, y: 570, hp: 150, stamina: 100, swing: 0, heading: Math.PI, invulnerable: 0, combo: 0 })
      Object.assign(enemy, { x: 900, y: 500, hp: 1000, maxHp: 1000, speed: 0, cooldown: 100, windup: 0 })
    }
    const step = n => { for (let i = 0; i < n; i++) game.update(.02) }
    reset(); step(40)
    check(enemy.hp === 1000, 'standing near a soldier does not auto-attack')
    game.setAttack(true); game.setAttack(false)
    check(enemy.hp === 1000, 'a strike has a visible wind-up before damage')
    step(5); check(enemy.hp === 1000, 'damage cannot precede the contact window')
    step(5); check(enemy.hp < 1000, 'sword contact damages a target in the arc')
    const afterContact = enemy.hp; step(8)
    check(enemy.hp === afterContact, 'one swing cannot damage repeatedly during recovery')
    reset(); game.setAttack(true); step(65); game.setAttack(false)
    check(game.player.combo === 3, 'holding attack reaches the third combo strike')
    check(enemy.hp < 940, 'third strike breaks through a frontal shield')
    reset(); game.setAttack(true); game.setAttack(false); game.player.heading = 0; step(12)
    check(enemy.hp === 1000, 'a committed strike misses when facing away')
    reset(); game.setAttack(true); game.cast('dash'); step(12)
    check(enemy.hp === 1000, 'dodging cancels pending sword damage')
    game.cooldowns.dash = 0; game.dashTime = 0
    reset(); game.setGuard(true); game.hurt(20, enemy)
    check(game.player.hp === 150 && game.snapshot().combat.counter, 'timed frontal guard parries and opens a counter')
    check(game.player.stamina < 100, 'parry consumes stamina')
    reset(); game.setGuard(true); step(20); game.hurt(20, enemy)
    check(game.player.hp < 150 && game.player.hp > 140, 'late frontal guard reduces, rather than cancels, damage')
    reset(); game.setGuard(true); Object.assign(enemy, { y: 640 }); game.hurt(20, enemy)
    check(game.player.hp === 134, 'a rear attack bypasses the guard')
    reset(); game.setGuard(true); game.player.stamina = .1; step(2)
    check(!game.player.guarding, 'exhausted guard drops')
    step(50); check(game.player.stamina > 20, 'stamina recovers after dropping guard')
    reset(); game.setAttack(true); game.setGuard(true); game.togglePause()
    check(!game.player.guarding && !game.attackHeld && !game.strikePending, 'pause releases held inputs and pending attacks')
    game.destroy(); canvas.remove()
    return 'PASS: manual attack, wind-up/contact/recovery, third-hit shield break, arc miss, dodge cancel, timed parry, late/rear hits, stamina recovery and pause input cleanup'
  }))
  assert.deepEqual(errors, [])
} finally { await browser.close() }
