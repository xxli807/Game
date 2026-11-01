// Real GLB loading and skeletal animation, with no debug hooks in the shipped app.
import { build } from 'esbuild'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const bundle = await build({ stdin: { contents: "export { loadHumans, makeHuman } from './src/game3/action/animatedHumans'; export { disposeObject } from './src/game3/action/models3d'; export { DynastyBattle } from './src/game3/action/engine'", resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', globalName: 'AnimationTest' })
const browser = await chromium.launch()
try {
  const page = await browser.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('http://localhost:8080/v3/')
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  console.log(await page.evaluate(async () => {
    const check = (ok, message) => { if (!ok) throw Error(message) }
    check(await AnimationTest.loadHumans(), 'the shipped GLB loads')
    const first = AnimationTest.makeHuman('player', '#593b31'), second = AnimationTest.makeHuman('player', '#593b31')
    const archer = AnimationTest.makeHuman('archer', '#3d6661'), soldier = AnimationTest.makeHuman('soldier', '#3d6661')
    const pose = { moving: false, attacking: 0, battle: true }
    const bone = rig => rig.body.getObjectByName('hand_r')
    const rotations = rig => { const values = []; rig.body.traverse(o => { if (o.isBone) values.push(...o.quaternion.toArray()) }); return JSON.stringify(values) }
    check(bone(first) !== bone(second), 'soldiers have independent skeletons')
    check(first.sword.parent === bone(first), 'the saber follows its hand')
    check(first.body.getObjectByName('war-armour').isSkinnedMesh, 'armour follows the authored skeleton')
    const untouched = rotations(second), initial = rotations(first)
    first.human.update({ ...pose, attacking: .48, combo: 1 }, .02)
    for (let i = 0; i < 8; i++) first.human.update({ ...pose, attacking: .46 - i * .02, combo: 1 }, .02)
    check(rotations(first) !== initial, 'authored sword motion changes the body')
    check(rotations(second) === untouched, 'animating one soldier cannot move another')
    const frozen = rotations(first), cloth = Array.from(first.cape.geometry.attributes.position.array)
    for (let i = 0; i < 100; i++) first.human.update({ ...pose, moving: true }, 0)
    check(rotations(first) === frozen, 'pause freezes skeletal animation')
    check(JSON.stringify(Array.from(first.cape.geometry.attributes.position.array)) === JSON.stringify(cloth), 'pause freezes cloak motion')
    const preparing = rotations(soldier)
    soldier.human.update({ ...pose, windup: .55 }, .02)
    for (let i = 0; i < 9; i++) soldier.human.update({ ...pose, windup: .53 - i * .02 }, .02)
    check(rotations(soldier) !== preparing, 'infantry prepares its attack before contact')
    archer.human.update({ ...pose, windup: .6 }, .02)
    const aim = rotations(archer)
    for (let i = 0; i < 100; i++) archer.human.update({ ...pose, windup: .6 }, 0)
    check(rotations(archer) === aim, 'paused bow offsets do not accumulate')
    first.human.dispose(); AnimationTest.disposeObject(first.root)
    second.human.update({ ...pose, moving: true }, .1)
    check(bone(second).quaternion.toArray().every(Number.isFinite), 'surviving clones remain valid after another is disposed')
    for (const rig of [second, archer, soldier]) { rig.human.dispose(); AnimationTest.disposeObject(rig.root) }
    return 'PASS: shipped animated mesh, independent soldiers, fitted armour, weapon attachment, sword motion, pre-contact infantry motion, frozen pause/cloth/bow and clone disposal'
  }))
  // A missing character download must leave the existing playable renderer intact.
  const fallback = await browser.newPage()
  fallback.on('pageerror', e => errors.push(e.message))
  await fallback.route('**/warrior-base.glb', route => route.abort())
  await fallback.goto('http://localhost:8080/v3/')
  await fallback.locator('[data-mode="world"]').click()
  await fallback.waitForSelector('.world-canvas[data-characters="fallback"]')
  await fallback.locator('.battle-launch').click()
  await fallback.waitForSelector('.army-controls')
  assert.deepEqual(errors, [])
  console.log('PASS: a failed character download still starts a playable battle with fallback soldiers')
} finally { await browser.close() }
