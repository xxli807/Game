// v3「逐鹿」三路对战回归。
//   node .claude/skills/verify/v3-arena.mjs [--url http://localhost:8080] [--quick]
// 前两部分只测 src/game3/arena/sim.ts 与 data.ts——纯逻辑，不开浏览器：
//   1. 地图与数据自检（镜像对称、每位君王三个技能、出装表）
//   2. 规则断言（移动、碰撞、塔的仇恨、偷塔减伤、大鼎保护、回城、击杀重生、装备、36 个技能逐个生效）
//   3. 固定种子的整局 AI 对战：每局都要分出胜负，两边都能赢，时长在合理区间
// 第三部分开浏览器：真实键盘事件驱动 ArenaGame，再走一遍大厅 → 赛前 → 对战界面。
// 改了 sim.ts / data.ts 的任何数值或规则后必须重跑；整局结果是确定性的（固定种子），漂移就是改动造成的。
import { build } from 'esbuild'
import assert from 'node:assert/strict'

const args = process.argv.slice(2)
const url = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:8080'
const quick = args.includes('--quick')
const bundle = async (contents, options = {}) => (await build({ stdin: { contents, resolveDir: process.cwd() }, bundle: true, write: false, logLevel: 'silent', ...options })).outputFiles[0].text
const A = await import('data:text/javascript,' + encodeURIComponent(await bundle("export * from './src/game3/arena/sim'; export * from './src/game3/arena/data'", { format: 'esm', platform: 'node' })))
const { ArenaSim, HEROES, TOWERS, LANES, LANE_IDS, TREES, FOUNTAIN, BUILDS, ITEMS, ULT_LEVEL, CLASS_STATS, MAP } = A
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// ---------- 1. 数据 ----------
for (const t of TOWERS.filter(t => t.team === 0)) assert.ok(TOWERS.some(r => r.team === 1 && r.lane === t.lane && r.tier === t.tier && r.at.x === t.at.y && r.at.y === t.at.x), `${t.lane} ${t.tier} 塔没有镜像`)
for (const lane of LANE_IDS) {
  const pts = LANES[lane], flipped = [...pts].reverse().map(p => ({ x: p.y, y: p.x }))
  assert.deepEqual(flipped, pts, `${lane} 路不是沿河道镜像对称`)
}
assert.equal(new Set(HEROES.map(h => h.name)).size, 12, '应有 12 位不重名的君王')
for (const h of HEROES) {
  assert.ok(CLASS_STATS[h.cls], `${h.name} 职业未知`)
  assert.equal(h.skills.length, 3, `${h.name} 应有三个技能`)
  assert.ok(h.skills[2].cd >= 30, `${h.name} 大招冷却过短`)
  for (const s of h.skills) assert.ok(s.fx.length && s.name && s.glyph.length === 1 && s.desc, `${h.name}·${s.name} 定义不完整`)
}
for (const [cls, list] of Object.entries(BUILDS)) for (const id of list) assert.ok(ITEMS.some(i => i.id === id), `${cls} 出装表里的 ${id} 不存在`)
for (const lane of LANE_IDS) for (const p of LANES[lane]) assert.ok(!TREES.some(t => dist(t, p) < t.r + 60), `${lane} 路上有树挡道`)
console.log(`✓ 数据自检通过：12 位君王 36 个技能、${TOWERS.length} 座塔镜像对称、${TREES.length} 丛林木不挡兵线`)

// ---------- 2. 规则 ----------
const SPOT = { x: 1250, y: 1250 } // 上游河道：离塔、野怪、泉水都够远
const fresh = (hero = '李世民', extra = {}) => new ArenaSim({ hero, seed: 42, ...extra })
const run = (sim, seconds) => { for (let t = 0; t < seconds; t += 1 / 60) sim.step(1 / 60) }
const duel = (hero) => {
  const sim = fresh(hero), me = sim.player, foe = sim.heroes.find(h => h.team === 1)
  Object.assign(me, SPOT); Object.assign(foe, { x: SPOT.x + 150, y: SPOT.y, stun: 99 })
  return { sim, me, foe }
}
{ // 移动、树木碰撞
  const sim = fresh(), me = sim.player, x = me.x
  sim.input.mx = 1; run(sim, 0.5)
  assert.ok(me.x > x + 120, '向右输入应让君王向右移动')
  const tree = TREES[0]
  Object.assign(me, { x: tree.x - tree.r - 80, y: tree.y }); run(sim, 1.5)
  assert.ok(dist(me, tree) >= tree.r + me.r - 1, '君王不应走进树丛')
}
{ // 普攻：按住攻击会锁定并打掉血
  const { sim, me, foe } = duel('李世民')
  sim.input.attack = true; run(sim, 2)
  assert.ok(foe.hp < foe.maxHp && sim.stickyTarget === foe.id, '按住攻击应锁定并打中面前的敌将')
}
{ // 站着不动时自动还击射程内的敌人，但不会主动去打没有兵线的塔
  const { sim, me, foe } = duel('李世民')
  run(sim, 2)
  assert.ok(foe.hp < foe.maxHp, '站定时应自动攻击射程内的敌将')
  const lone = fresh(), hero = lone.player, tower = lone.units.find(u => u.kind === 'tower' && u.team === 1 && u.lane === 'top' && u.sub === 'outer')
  Object.assign(hero, { x: tower.x, y: tower.y + 150 }); hero.hp = hero.maxHp = 1e6; run(lone, 2)
  assert.equal(tower.hp, tower.maxHp, '没有兵线时不应自动去打防御塔')
}
{ // 大招等级锁
  const { sim, me } = duel('李世民')
  assert.equal(sim.cast(me, 2), false, `${ULT_LEVEL} 级前不能放大招`)
  me.level = ULT_LEVEL
  assert.equal(sim.cast(me, 2), true, `${ULT_LEVEL} 级应解锁大招`)
  assert.equal(sim.cast(me, 2), false, '冷却中不能再放')
}
let skills = 0
for (const def of HEROES) for (let slot = 0; slot < 3; slot++) { // 36 个技能逐个生效
  const { sim, me, foe } = duel(def.name)
  me.level = ULT_LEVEL; me.hp = me.maxHp * 0.5
  const before = { hp: foe.hp, mine: me.hp, x: me.x, y: me.y }, skill = def.skills[slot]
  assert.ok(sim.cast(me, slot, skill.aim === 'dir' ? { x: 1, y: 0 } : skill.aim === 'point' ? { x: foe.x, y: foe.y } : undefined), `${def.name}·${skill.name} 放不出来`)
  run(sim, 2)
  const did = foe.hp < before.hp || me.shield > 0 || me.hp > before.mine + 50 || Object.values(me.buffs).some(b => b.t > 0) || dist(me, before) > 60
  assert.ok(did, `${def.name}·${skill.name} 放出后什么也没发生`)
  skills++
}
{ // 塔的仇恨、偷塔减伤
  const sim = fresh(), me = sim.player, foe = sim.heroes.find(h => h.team === 1)
  const tower = sim.units.find(u => u.kind === 'tower' && u.team === 1 && u.lane === 'top' && u.sub === 'outer')
  Object.assign(me, { x: tower.x, y: tower.y + 330 }); Object.assign(foe, { x: tower.x + 60, y: tower.y + 420, stun: 99 })
  const bare = sim.damage(tower, 100, me)
  const minion = sim.unit({ team: 0, kind: 'minion', sub: 'melee', x: tower.x, y: tower.y + 200, r: 20, hp: 9000, atk: 1, range: 70, interval: 1.15, speed: 0, ranged: false, lane: 'top', wp: 99 })
  sim.units.push(minion)
  const sieged = sim.damage(tower, 100, me)
  assert.ok(bare < sieged * 0.4, '没有己方小兵时防御塔应大幅减伤')
  run(sim, 0.6)
  assert.equal(tower.targetId, minion.id, '塔应先打进入射程的小兵')
  sim.damage(foe, 10, me)
  assert.equal(tower.targetId, me.id, '在塔下打敌将，塔应转火攻击者')
}
{ // 大鼎保护与胜负
  const sim = fresh(), me = sim.player, base = sim.units.find(u => u.kind === 'base' && u.team === 1)
  assert.equal(sim.damage(base, 500, me), 0, '一路两塔未破时大鼎不可被攻击')
  for (const u of sim.units) if (u.kind === 'tower' && u.team === 1 && u.lane === 'mid') u.alive = false
  assert.ok(sim.baseOpen(1) && sim.damage(base, 500, me) > 0, '推掉一路两塔后大鼎应可被攻击')
  sim.damage(base, 1e6, me, true)
  assert.equal(sim.winner, 0, '击毁敌鼎应判我方胜')
  assert.ok(sim.events.some(e => e.type === 'end' && e.winner === 0), '应发出结束事件')
}
{ // 回城
  const { sim, me } = duel('李世民')
  sim.recall(); run(sim, 1); sim.damage(me, 10, null, true)
  assert.ok(me.recallT === 0 && dist(me, FOUNTAIN[0]) > 500, '回城读条应被伤害打断')
  sim.recall(); run(sim, 3.7)
  assert.ok(dist(me, FOUNTAIN[0]) < 5, '读条完成应回到泉水')
}
{ // 击杀、赏金、重生
  const { sim, me, foe } = duel('李世民'), gold = me.gold
  sim.damage(foe, 1e6, me, true)
  assert.ok(!foe.alive && me.k === 1 && foe.d === 1 && me.gold > gold + 150 && sim.kills[0] === 1, '击杀应计数并发赏金')
  run(sim, 8)
  assert.ok(foe.alive && dist(foe, FOUNTAIN[1]) < 400 && foe.hp === foe.maxHp, '阵亡后应在己方泉水满血重生')
}
{ // 装备
  const sim = fresh('李世民'), me = sim.player, atk = me.atk
  assert.equal(sim.nextItem(me).id, BUILDS.fighter[0], '推荐装备应按出装表')
  assert.ok(sim.buy(me, 'sword') && me.atk > atk && me.items.length === 1, '买装备应加属性')
  assert.equal(sim.buy(me, 'sword'), false, '同一件装备不能买两次')
  me.gold = 0
  assert.equal(sim.buy(me, 'boots'), false, '钱不够不能买')
}
{ // 确定性：同一个种子，同一局
  const a = fresh('刘邦', { allAi: true }), b = fresh('刘邦', { allAi: true })
  run(a, 45); run(b, 45)
  assert.deepEqual(a.heroes.map(h => [h.x, h.y, h.hp, h.gold]), b.heroes.map(h => [h.x, h.y, h.hp, h.gold]), '同种子的两局应完全一致')
}
{ // 连续第三击确实增伤，停手后重新计数；远程重击保留在弹道上。
  for (const name of ['李世民', HEROES.find(h => h.cls === 'marksman').name]) {
    const { sim, me, foe } = duel(name)
    foe.hp = foe.maxHp = 1e6; foe.armor = 0
    const hits = []
    for (let frame = 0; frame < 600 && hits.length < 3; frame++) {
      sim.step(1 / 120)
      hits.push(...sim.events.splice(0).filter(e => e.type === 'dmg' && e.mine))
    }
    assert.equal(hits.length, 3, `${name} 应连续命中三次`)
    assert.deepEqual(hits.map(e => e.heavy), [false, false, true])
    assert.ok(Math.abs(hits[2].amount / hits[0].amount - 1.6) < 0.001, '第三击应造成 1.6 倍普攻伤害')
    me.stun = 3; run(sim, 3.1)
    assert.equal(me.chain, 1, '超过连击窗口后应从第一击开始')
  }
}
{ // 闪现：方向、冷却、控制状态、打断回城/起手、障碍物中心与边界。
  const { sim, me } = duel('李世民')
  me.recallT = 3; me.windup = 0.2; me.swingId = sim.heroes[5].id
  const from = { x: me.x, y: me.y }
  assert.ok(sim.flash(me, { x: 1, y: 0 }))
  assert.equal(me.x, from.x + 330); assert.equal(me.y, from.y)
  assert.equal(me.flashCd, 75); assert.equal(me.recallT, 0); assert.equal(me.windup, 0)
  assert.equal(sim.flash(me), false, '冷却中不能闪现')
  me.flashCd = 0; me.stun = 1
  assert.equal(sim.flash(me), false, '眩晕中不能闪现')
  me.stun = 0
  for (const obstacle of [TREES[0], sim.units.find(u => u.kind === 'tower')]) {
    Object.assign(me, { x: obstacle.x - 330, y: obstacle.y, flashCd: 0 })
    assert.ok(sim.flash(me, { x: 1, y: 0 }))
    assert.ok(dist(me, obstacle) >= obstacle.r + me.r, '不能落在障碍物中心')
  }
  Object.assign(me, { x: MAP - 70, y: 1250, flashCd: 0 })
  assert.ok(sim.flash(me, { x: 1, y: 0 }))
  assert.ok(me.x <= MAP - 60)
  me.flashCd = 0
  assert.equal(sim.flash(me, { x: 1, y: 0 }), false, '撞边界未位移不应消耗闪现')
  me.alive = false
  assert.equal(sim.flash(me), false, '阵亡中不能闪现')
}
{ // 补刀奖励只提示一次，不把被动金币刷成飘字。
  const { sim, me } = duel('李世民')
  const minion = sim.unit({ team: 1, kind: 'minion', sub: 'melee', ...SPOT, r: 20, hp: 1, atk: 1, range: 70, interval: 1 })
  sim.units.push(minion)
  const before = me.gold
  sim.damage(minion, 100, me, true); sim.damage(minion, 100, me, true)
  assert.equal(me.gold - before, 23)
  assert.deepEqual(sim.events.filter(e => e.type === 'gold').map(e => e.amount), [23])
}
console.log(`✓ 规则断言通过：移动与碰撞、普攻锁定、大招等级锁、${skills} 个技能逐个生效、塔的仇恨与偷塔减伤、大鼎保护、回城、击杀重生、装备、确定性`)
console.log('✓ 新战斗规则通过：近战/远程三连重击与超时、闪现方向/冷却/碰撞/边界、补刀金币')

// ---------- 2a. 自动锁定：普攻键与技能轻点 ----------
{
  const minionAt = (sim, team, x, y) => { const m = sim.unit({ team, kind: 'minion', sub: 'melee', x, y, r: 20, hp: 5000, atk: 1, range: 70, interval: 1, speed: 0, ranged: false, lane: 'mid', wp: 99 }); sim.units.push(m); return m }
  // 普攻键：英雄优先于更近的小兵
  {
    const { sim, me, foe } = duel('李世民')
    Object.assign(foe, { x: me.x + 260, y: me.y }); const m = minionAt(sim, 1, me.x + 90, me.y)
    sim.input.attack = true; run(sim, 0.1)
    assert.equal(sim.stickyTarget, foe.id, '普攻键应优先锁定射程附近的敌将，而不是更近的小兵')
    void m
  }
  // 已锁小兵时，敌将走进范围会被改锁
  {
    const { sim, me, foe } = duel('李世民')
    const m = minionAt(sim, 1, me.x + 90, me.y); Object.assign(foe, { x: me.x + 2000, y: me.y })
    sim.input.attack = true; run(sim, 0.1); assert.equal(sim.stickyTarget, m.id, '没有敌将时应锁小兵')
    Object.assign(foe, { x: me.x + 250, y: me.y }); run(sim, 0.1)
    assert.equal(sim.stickyTarget, foe.id, '敌将进入范围应改锁敌将')
  }
  // 不会把你拖进无兵线的敌塔下去追人
  {
    const { sim, me, foe } = duel('李世民')
    const tower = sim.units.find(u => u.kind === 'tower' && u.team === 1 && u.lane === 'top' && u.sub === 'outer')
    Object.assign(foe, { x: tower.x, y: tower.y + 150 }); Object.assign(me, { x: tower.x, y: tower.y + 150 + 380 })
    assert.notEqual(sim.lockCandidate()?.id, foe.id, '躲在无兵线敌塔下、又不在攻击范围内的敌将不应被自动锁定')
  }
  // 技能轻点：不给方向也会打向敌将；移动中的目标会提前量
  for (const name of ['武曌', '刘彻', '司马懿']) {
    const { sim, me, foe } = duel(name)
    Object.assign(foe, { x: me.x - 200, y: me.y + 320 }); me.heading = 0 // 背对着敌人
    const before = foe.hp
    assert.ok(sim.cast(me, 0)); run(sim, 1.5)
    assert.ok(foe.hp < before, `${name} 轻点技能应自动打中敌将`)
  }
  {
    const { sim, me, foe } = duel('武曌')
    Object.assign(foe, { x: me.x + 500, y: me.y, vx: 0, vy: 300 })
    const aim = sim.autoAim(me, 0), still = Math.atan2(0, 500), led = Math.atan2(aim.y, aim.x)
    assert.ok(led - still > 0.2, '移动中的敌将应被提前量瞄准')
  }
  console.log('✓ 自动锁定通过：普攻键英雄优先、敌将入范围改锁、不追进无兵线敌塔、轻点技能背身也能命中、移动目标提前量')
}

// ---------- 2b. 天命卷：升级三选一 ----------
{
  const G = await import('data:text/javascript,' + encodeURIComponent(await bundle("export * from './src/game3/arena/growth'", { format: 'esm', platform: 'node' })))
  const { tuneSkill, drawOffer, AUTO_IDS, PERK_IDS, SKILL_RANKS } = G
  // 开局就有一次选择，三张不重复，第一张必是技能或武学；大招解锁前不出大招卡
  const sim = fresh('武曌'), me = sim.player
  sim.step(1 / 60)
  assert.equal(me.offer?.length, 3, '开局应给三张卡')
  assert.notEqual(me.offer[0].kind, 'perk', '第一张卡应是技能或武学')
  assert.equal(new Set(me.offer.map(c => JSON.stringify(c))).size, 3, '三张卡不应重复')
  for (let i = 0; i < 300; i++) { const offer = drawOffer({ ranks: [0, 0, 0], autos: [], perks: {} }, false, Math.random); assert.ok(!offer.some(c => c.kind === 'skill' && c.slot === 2), '大招解锁前不应出现大招卡') }
  // 升级会补一次选择；选完托盘清空
  const picks = me.picks
  sim.pay(me, 0, 400)
  assert.ok(me.picks > picks, '升级应增加一次选择')
  assert.ok(sim.pick(0)) ; assert.equal(me.offer, null)
  // 技能精进真的变强；三阶觉醒改变形态
  for (const def of HEROES) def.skills.forEach(skill => {
    const base = tuneSkill(skill, 0), top = tuneSkill(skill, SKILL_RANKS), dmg = fx => fx.reduce((n, f) => n + ('dmg' in f && f.dmg ? f.dmg[0] : 0), 0)
    assert.ok(dmg(top) >= dmg(base), `${def.name}·${skill.name} 觉醒后伤害不应下降`)
    assert.notDeepEqual(top, base, `${def.name}·${skill.name} 觉醒后应与原版不同`)
  })
  const shot = HEROES.find(h => h.name === '武曌').skills[0], awake = tuneSkill(shot, 3)[0]
  assert.ok(awake.count >= 3 && awake.pierce, '弹道技能觉醒应多射并贯穿')
  // 八门自动武学各自起作用
  for (const id of AUTO_IDS) {
    const { sim: s, me: m, foe } = duel('李世民')
    m.autos = [{ id, rank: 3, t: 0 }]; m.offer = null; m.picks = 0
    const ally = s.heroes.find(h => h.team === 0 && h !== m); Object.assign(ally, { x: m.x - 80, y: m.y })
    const before = { foe: foe.hp, minions: s.units.filter(u => u.kind === 'minion' && u.team === 0).length }
    run(s, 6)
    const did = foe.hp < before.foe || m.shield > 0 || ally.buffs.aspd.t > 0 || s.units.filter(u => u.kind === 'minion' && u.team === 0).length > before.minions
    assert.ok(did, `自动武学 ${id} 六秒内毫无作用`)
  }
  // 心法改属性
  const { sim: s2, me: m2 } = duel('李世民'), hp = m2.maxHp, speed = m2.baseSpeed
  m2.offer = [{ kind: 'perk', id: 'vigor' }, { kind: 'perk', id: 'swift' }]; s2.pick(0); m2.offer = [{ kind: 'perk', id: 'swift' }]; s2.pick(0)
  assert.ok(m2.maxHp > hp * 1.09 && m2.baseSpeed === speed + 20, '强体 / 疾行应改变属性')
  // AI 也抽卡：整局后每位 AI 都学到了东西
  const whole = new ArenaSim({ hero: '刘邦', seed: 77, allAi: true }); while (whole.winner === null && whole.time < 1500) whole.step(0.05)
  assert.ok(whole.heroes.every(h => h.autos.length + h.ranks.reduce((a, b) => a + b, 0) + Object.keys(h.perks).length >= 5), 'AI 英雄应在整局中持续成长')
  console.log(`✓ 天命卷通过：开局三选一、升级补选、大招前不出大招卡、36 个技能精进与觉醒、${AUTO_IDS.length} 门自动武学各自生效、心法改属性、AI 同样成长`)
}

// ---------- 3. 整局 ----------
const play = (options, limit = 1500) => { const sim = new ArenaSim(options); while (sim.winner === null && sim.time < limit) sim.step(0.05); return sim }
const matches = quick ? 6 : 16
const results = Array.from({ length: matches }, (_, i) => play({ hero: HEROES[(i + 1) % HEROES.length].name, seed: (i + 1) * 7919, allAi: true }))
const wins = [0, 1].map(team => results.filter(s => s.winner === team).length)
const minutes = results.map(s => s.time / 60), average = minutes.reduce((a, b) => a + b, 0) / matches
assert.ok(results.every(s => s.winner !== null), `有对局在 25 分钟内没分出胜负（最长 ${Math.max(...minutes).toFixed(1)} 分钟）`)
assert.ok(wins[0] >= matches * 0.25 && wins[1] >= matches * 0.25, `AI 对 AI 应大致五五开，实际蓝 ${wins[0]} : 红 ${wins[1]}`)
assert.ok(average > 6 && average < 15, `平均时长 ${average.toFixed(1)} 分钟，超出 6–15 分钟的目标区间`)
console.log(`✓ 整局通过：${matches} 局 AI 对战全部分出胜负，蓝 ${wins[0]} : 红 ${wins[1]}，平均 ${average.toFixed(1)} 分钟（${Math.min(...minutes).toFixed(1)}–${Math.max(...minutes).toFixed(1)}），场均 ${(results.reduce((n, s) => n + s.kills[0] + s.kills[1], 0) / matches).toFixed(0)} 次击杀`)
if (!quick) { // 难度确实有区别：同样的托管打法，新兵局应比名将局好赢
  const auto = difficulty => Array.from({ length: 8 }, (_, i) => { const sim = new ArenaSim({ hero: '李世民', seed: (i + 3) * 104729, difficulty }); sim.autopilot = true; while (sim.winner === null && sim.time < 1500) sim.step(0.05); return sim.winner === 0 ? 1 : 0 }).reduce((a, b) => a + b, 0)
  const easy = auto(0), hard = auto(2)
  assert.ok(easy > hard, `新兵难度（${easy}/8）应比名将难度（${hard}/8）好赢`)
  console.log(`✓ 难度分档有效：同样的托管打法，新兵 ${easy}/8 胜、名将 ${hard}/8 胜`)
}

// ---------- 4. 浏览器 ----------
const { chromium } = await import('playwright')
const browser = await chromium.launch()
try {
  const errors = []
  const watch = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) }) }
  // 4a. 真实键盘事件 → ArenaGame → sim
  const harness = await bundle("export { ArenaGame } from './src/game3/arena/game'", { format: 'iife', globalName: 'ArenaTest', platform: 'browser', loader: { '.css': 'empty' } })
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } }); watch(page)
  await page.goto(`${url}/v3/`); await page.addScriptTag({ content: harness })
  await page.evaluate(() => {
    document.body.innerHTML = '<div style="position:fixed;inset:0"><canvas id="c" style="width:100%;height:100%"></canvas></div>'
    window.game = new ArenaTest.ArenaGame(document.getElementById('c'), { hero: '李世民', seed: 5 }, hud => { window.hud = hud })
    window.game.sound.muted = true
  })
  await page.waitForFunction(() => window.hud?.status === 'playing', null, { timeout: 40000 })
  const me = () => page.evaluate(() => ({ x: game.sim.player.x, y: game.sim.player.y, cd: game.sim.player.cds[0], items: game.sim.player.items.length, time: game.sim.time }))
  const start = await me()
  await page.keyboard.down('d'); await page.waitForTimeout(1200); await page.keyboard.up('d')
  const moved = await me()
  assert.ok(moved.x > start.x + 60, `按住 D 应向右走（${start.x.toFixed(0)} → ${moved.x.toFixed(0)}）`)
  await page.keyboard.press('q')
  assert.ok((await me()).cd > 0, '按 Q 应放出一技能并进入冷却')
  await page.keyboard.press('g')
  assert.equal((await me()).items, 1, '按 G 应买下推荐装备')
  await page.keyboard.press('p')
  await page.waitForFunction(() => window.hud?.status === 'paused')
  const frozen = (await me()).time; await page.waitForTimeout(500)
  assert.equal((await me()).time, frozen, '暂停时对局时间应停住')
  await page.keyboard.press('p'); await page.waitForFunction(() => window.hud?.status === 'playing')
  await page.evaluate(() => game.destroy()); await page.close()
  // 4b. 真实界面：大厅 → 赛前 → 对战
  for (const [name, viewport, touch] of [['桌面', { width: 1280, height: 760 }, false], ['手机横屏', { width: 844, height: 390 }, true]]) {
    const view = await browser.newPage({ viewport, hasTouch: touch, isMobile: touch }); watch(view)
    await view.goto(`${url}/v3/`)
    await view.click('.arena-start-btn')
    await view.waitForSelector('.arena-kit li')
    assert.equal(await view.locator('.arena-kit li').count(), 3, `${name}：赛前应列出三个技能`)
    await view.getByRole('button', { name: /新兵/ }).click()
    await view.click('.arena-go')
    await view.waitForFunction(() => document.querySelector('.arena-hud') && !document.querySelector('.arena-loading'), null, { timeout: 40000 })
    assert.equal(await view.getAttribute('.arena-canvas', 'data-renderer'), 'arena', `${name}：战场渲染器应启动`)
    assert.equal(await view.locator('.arena-skill').count(), 3, `${name}：应有三个技能键`)
    if (touch) assert.ok(await view.locator('.arena-stick').isVisible(), '触屏应显示摇杆')
    await view.locator('.arena-skill.s0').click()
    await view.waitForFunction(() => /\d/.test(document.querySelector('.arena-skill.s0 small')?.textContent ?? ''), null, { timeout: 8000 })
    await view.locator('.arena-shop').click()
    await view.waitForFunction(() => document.querySelectorAll('.arena-items i').length === 6 && document.querySelector('.arena-items i')?.textContent !== '', null, { timeout: 8000 })
    await view.getByRole('button', { name: '暂停' }).click()
    await view.getByRole('button', { name: '继续对战' }).click()
    await view.getByRole('button', { name: '托管' }).click()
    const before = await view.locator('.arena-score time').innerText()
    await view.waitForFunction(t => document.querySelector('.arena-score time')?.textContent !== t, before, { timeout: 15000 })
    const overflow = await view.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    assert.ok(!overflow, `${name}：页面不应横向溢出`)
    await view.close()
  }
  assert.deepEqual(errors, [], `控制台有报错：${errors.slice(0, 3).join(' | ')}`)
  console.log('✓ 界面通过：键盘移动 / 技能 / 买装 / 暂停均由真实事件驱动；桌面与手机横屏都能从大厅走到对战并操作，控制台零报错')
} finally { await browser.close() }
