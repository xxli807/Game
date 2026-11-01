// Deterministic checks for consequential rules; no browser or production test hooks.
import { build } from 'esbuild'
import assert from 'node:assert/strict'
const bundle = await build({ stdin: { contents: "export * from './src/game3/rules'; export * from './src/game3/action/diplomacy'", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node' })
const { activityFailure, checkMandate, foundingReadiness, resolveEnding, councilAudience, payCouncilCost, challengeOdds } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const realm = Object.freeze({ military: 58, politics: 58, economy: 30, destiny: 45 })
const warning = checkMandate(realm, false, 0, 0)
assert.equal(warning.fatal, false, 'the first random reversal gives a chance to recover')
assert.equal(warning.warned, true)
assert.equal(warning.res.destiny, 39)
assert.equal(realm.destiny, 45, 'rules never mutate their inputs')
assert.equal(checkMandate(warning.res, true, 0, 0).fatal, true, 'another reversal before recovery remains dangerous')
assert.equal(checkMandate(warning.res, true, 0, .99).warned, true, 'a quiet turn does not silently clear a warning')
const recovery = checkMandate({ ...realm, destiny: 56 }, true, .2, 0)
assert.equal(recovery.warned, false, 'recovery happens before the next random check')
assert.equal(recovery.fatal, false)
assert.equal(checkMandate(recovery.res, false, 0, 0).fatal, false, 'a recovered dynasty gets a fresh warning')
assert.equal(checkMandate({ ...realm, destiny: 0 }, false, 0, .99).fatal, true)
assert.equal(checkMandate({ ...realm, destiny: 1 }, false, 0, 0).res.destiny, 1, 'the warning itself does not cause instant death')
assert.equal(checkMandate({ ...realm, destiny: 86 }, false, 0, 0).warned, false, 'a healthy dynasty does not receive a misleading recovery warning')
const neutral = { military: 50, politics: 50, economy: 50, destiny: 50 }
const failedMarriage = activityFailure({ spouse: '江南商帮继承人', silver: 18 }, neutral)
assert.equal(failedMarriage.spouse, undefined, 'a failed marriage activity cannot award a permanent court bonus')
assert.ok(failedMarriage.economy < 0, 'failed activities lose the promised positive reward')
const failedReform = activityFailure({ armyType: '火器新军', economy: -8, city: '关隘', talent: '张居正' }, neutral)
assert.equal(failedReform.armyType, undefined, 'a failed reform cannot unlock an army upgrade')
assert.equal(failedReform.city, undefined)
assert.equal(failedReform.talent, undefined)
assert.ok(failedReform.economy <= -8, 'authored costs still apply on failure')
const strongFailure = activityFailure({}, { military: 90, politics: 90, economy: 90, destiny: 90 })
assert.ok(strongFailure.economy > activityFailure({}, neutral).economy, 'a stronger realm absorbs setbacks better')
assert.equal(challengeOdds(.55, '冒险夜渡', neutral).odds, .55, 'neutral preparations preserve the authored challenge odds')
assert.ok(challengeOdds(.55, '冒险夜渡', { ...neutral, military: 75 }).odds > .55)
assert.ok(challengeOdds(.55, '冒险夜渡', { ...neutral, military: 25 }).odds < .55)
assert.ok(challengeOdds(.88, '说服守军', neutral).odds > challengeOdds(.5, '强攻粮仓', neutral).odds, 'the cautious route actually reduces risk')
for (const military of [57, 58]) for (const politics of [57, 58]) for (const economy of [54, 55]) for (const destiny of [0, 37, 38]) {
  const res = { military, politics, economy, destiny }
  const expected = [military >= 58, politics >= 58, economy >= 55].filter(Boolean).length >= 2 && destiny >= 38
  assert.equal(foundingReadiness(res).ready, expected)
  assert.equal(resolveEnding(res, 0, 0).win, expected, 'the visible goal and the ending agree at each boundary')
}
const event = { id: 't-granary', source: '民生', title: '仓粮', phase: '蛰伏', body: '', options: [] }
const order = { kind: 'council', title: '赈济', brief: '', target: { x: 0, y: 0 }, required: 3 }
const weak = { military: 30, politics: 30, economy: 30, destiny: 30 }
assert.equal(councilAudience(event, order, 0, weak).supported, false)
assert.equal(councilAudience(event, order, 0, { ...weak, politics: 56 }).supported, true)
assert.equal(councilAudience(event, { ...order, proposal: { politics: 10 } }, 0, weak).supported, true, 'a policy that meets this representative’s needs earns support')
assert.equal(councilAudience(event, { ...order, proposal: { economy: 10 } }, 0, weak).supported, false, 'benefiting a different group is insufficient')
assert.notEqual(councilAudience(event, order, 0, weak).concern, councilAudience({ ...event, id: 't-veteran' }, order, 0, weak).concern)
assert.equal(payCouncilCost(realm, 2).economy, 22, 'two funded promises deduct eight treasury after the outcome')
assert.equal(payCouncilCost({ ...realm, economy: 3 }, 2).economy, 0)
assert.equal(payCouncilCost(realm, NaN).economy, 30)
assert.equal(payCouncilCost(realm, -1).economy, 30)
assert.equal(payCouncilCost(realm, 20).economy, 22)
console.log('PASS: mandate warning/recovery, failed-activity rewards/costs, zero mandate, ending/checklist boundaries, event-specific support, treasury settlement')
