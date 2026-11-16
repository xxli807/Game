// v3「逐鹿」联机回归：两个标签页，一个开房、一个加入，走真实大厅界面，双方各自出操作。
//   node --import ./.claude/skills/verify/gpu.mjs .claude/skills/verify/v3-arena-online.mjs [--url http://localhost:8080]
// 用 ?net=local（同一浏览器内的 BroadcastChannel）代替 PeerJS，测试不依赖任何外部服务；
// 该模式下两页的对局对象挂在 window.__arena 上供检查，正式页面没有这个句柄。
// 覆盖：开房 / 加入 / 互见所选君王、同队与对战两种模式、好友的移动 / 技能 / 抽卡在房主的对局里生效、
// 好友画面跟得上房主、各自看到自己的伤害、胜负按各自阵营判定、任一方离开时另一方的处理。
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const args = process.argv.slice(2)
const url = (args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:8080') + '/v3/?net=local'
const browser = await chromium.launch()
const errors = []
const page = async () => {
  const p = await context.newPage()
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await p.goto(url); await p.click('.arena-start-btn'); await p.waitForSelector('.arena-friends')
  return p
}
const sim = (p, fn, arg) => p.evaluate(([f, a]) => new Function('g', 'a', `return (${f})(g, a)`)(window.__arena, a), [fn.toString(), arg])
const context = await browser.newContext({ viewport: { width: 1100, height: 700 } })

async function round(mode) {
  const host = await page(), guest = await page()
  await host.getByRole('button', { name: /李世民/ }).first().click()
  await guest.getByRole('button', { name: /武曌/ }).first().click()
  await host.getByRole('button', { name: mode === 'coop' ? /开房 · 同队合作/ : /开房 · 对战/ }).click()
  const code = (await host.locator('.arena-code').innerText()).trim()
  assert.match(code, /^[A-Z2-9]{4}$/, '应显示四位房间号')
  await guest.fill('.arena-join input', code.toLowerCase()) // 小写也能加入
  await guest.getByRole('button', { name: '加入', exact: true }).click()
  await host.waitForFunction(() => /选了 武曌/.test(document.querySelector('.arena-room')?.textContent ?? ''), null, { timeout: 8000 })
  await guest.waitForFunction(() => /房主选了 李世民/.test(document.querySelector('.arena-room')?.textContent ?? ''), null, { timeout: 8000 })
  await host.getByRole('button', { name: /开始联机对局/ }).click()
  for (const p of [host, guest]) await p.waitForFunction(() => document.querySelector('.arena-hud') && !document.querySelector('.arena-loading') && window.__arena, null, { timeout: 40000 })
  const info = await sim(host, g => ({ guestId: g.sim.guest.id, guestHero: g.sim.guest.def.name, guestTeam: g.sim.guest.team, hostTeam: g.sim.player.team }))
  assert.equal(info.guestHero, '武曌', '好友选的君王应出现在房主的对局里')
  assert.equal(info.guestTeam, mode === 'coop' ? 0 : 1, mode === 'coop' ? '同队合作：好友应在蓝方' : '对战：好友应在红方')
  assert.equal(await sim(guest, g => g.sim.player.id), info.guestId, '好友的画面应以自己的英雄为主角')
  // 好友按住 D：房主对局里好友的英雄移动，好友画面也跟上
  await sim(host, g => { g.sim.guest.offer = null; g.sim.guest.picks = 0 })
  const start = await sim(host, g => g.sim.guest.x)
  await guest.locator('.arena-canvas').focus(); await guest.keyboard.down('d'); await guest.waitForTimeout(1500); await guest.keyboard.up('d')
  const moved = await sim(host, g => g.sim.guest.x)
  assert.ok(moved > start + 80, `好友的移动应作用于房主的对局（${start.toFixed(0)} → ${moved.toFixed(0)}）`)
  await guest.waitForTimeout(300)
  const seen = await sim(guest, g => g.sim.player.x), truth = await sim(host, g => g.sim.guest.x)
  assert.ok(Math.abs(seen - truth) < 60, `好友画面应跟上房主（差 ${Math.abs(seen - truth).toFixed(0)}）`)
  // 好友轻点技能：自动瞄准打中房主对局里的敌将，伤害数字只出现在好友那边
  const foe = await sim(host, g => { const me = g.sim.guest, f = g.sim.heroes.find(h => h.team !== me.team && !h.isPlayer); Object.assign(f, { x: me.x + 260, y: me.y, stun: 30, hp: 20000, maxHp: 20000 }); return f.id })
  await guest.waitForTimeout(200)
  // Damage numbers fade within a second, so count them as they appear rather than looking afterwards.
  await guest.evaluate(() => { window.__mine = 0; new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) if (n.classList?.contains('al-mine')) window.__mine++ }).observe(document.body, { childList: true, subtree: true }) })
  await guest.keyboard.press('q'); await guest.waitForTimeout(1200)
  const foeHp = await sim(host, (g, id) => g.sim.heroes.find(h => h.id === id).hp, foe)
  assert.ok(foeHp < 20000, '好友轻点 Q 应在房主的对局里命中敌将')
  const mineOnGuest = await guest.evaluate(() => window.__mine)
  assert.ok(mineOnGuest > 0, '好友应看到自己打出的伤害数字')
  // 好友的天命卷：卡牌从房主那里来，选择回到房主那里结算
  await sim(host, g => { g.sim.guest.picks = 1; g.sim.guest.offer = null })
  await guest.waitForSelector('.arena-offer .arena-card', { timeout: 4000 })
  const before = await sim(host, g => JSON.stringify([g.sim.guest.ranks, g.sim.guest.autos.map(a => a.id), g.sim.guest.perks]))
  await guest.keyboard.press('1'); await guest.waitForTimeout(400)
  const after = await sim(host, g => JSON.stringify([g.sim.guest.ranks, g.sim.guest.autos.map(a => a.id), g.sim.guest.perks]))
  assert.notEqual(after, before, '好友选的卡应在房主的对局里生效')
  // 联机不暂停：好友打开菜单，世界照常运行
  const t0 = await sim(host, g => g.sim.time)
  await guest.getByRole('button', { name: '暂停' }).click(); await guest.waitForTimeout(800)
  assert.ok(await sim(host, g => g.sim.time) > t0 + 0.4, '联机时打开菜单不应让对局停下')
  await guest.getByRole('button', { name: '继续对战' }).click()
  // 结局：按各自阵营判输赢
  await sim(host, g => { const base = g.sim.units.find(u => u.kind === 'base' && u.team === 1); for (const u of g.sim.units) if (u.kind === 'tower' && u.team === 1 && u.lane === 'mid') u.alive = false; g.sim.damage(base, 1e7, g.sim.player, true) })
  for (const p of [host, guest]) await p.waitForSelector('.arena-dialog.win, .arena-dialog.lose', { timeout: 8000 })
  const hostWon = await host.locator('.arena-dialog.win').count(), guestWon = await guest.locator('.arena-dialog.win').count()
  assert.equal(hostWon, 1, '蓝方击毁红鼎，房主应获胜')
  assert.equal(guestWon, mode === 'coop' ? 1 : 0, mode === 'coop' ? '同队的好友也应获胜' : '对战中的好友（红方）应判负')
  if (mode === 'coop') {
    // 再战一局走同一条连接；好友那边等待房主开局
    assert.ok(await guest.getByText('等待房主开始下一局').count(), '好友端应提示等待房主')
    await host.getByRole('button', { name: /再战一局/ }).click()
    for (const p of [host, guest]) await p.waitForFunction(() => document.querySelector('.arena-hud') && !document.querySelector('.arena-dialog') && !document.querySelector('.arena-loading'), null, { timeout: 40000 })
    assert.ok(await sim(guest, g => g.sim.time < 30 && g.sim.winner === null), '再战一局应双方同时开始新的一局')
    // 好友离开：房主那边 AI 接管其英雄，对局继续
    await guest.close()
    await host.waitForFunction(() => /已断开/.test(document.querySelector('.arena-online')?.textContent ?? '') || /好友已断开/.test(document.querySelector('.arena-announce')?.textContent ?? ''), null, { timeout: 15000 })
    assert.ok(await sim(host, g => g.sim.seat(g.sim.guest).auto), '好友断开后其英雄应由 AI 接管')
    await host.close()
  } else {
    // 房主离开：好友那边提示连接已断开
    await host.getByRole('button', { name: '离开房间' }).click()
    await guest.waitForFunction(() => /断开/.test(document.body.textContent ?? ''), null, { timeout: 15000 })
    await guest.close(); if (!host.isClosed()) await host.close()
  }
}

try {
  await round('coop')
  console.log('✓ 同队合作通过：开房 / 加入 / 互见君王、好友移动与技能作用于房主对局、画面同步、各自的伤害数字、好友抽卡、联机不暂停、同胜、再战一局、好友断开后 AI 接管')
  await round('versus')
  console.log('✓ 对战通过：好友在红方、操作与抽卡生效、胜负按各自阵营判定、房主离开时好友收到断开提示')
  assert.deepEqual(errors, [], `控制台有报错：${errors.slice(0, 3).join(' | ')}`)
  console.log('✓ 两种联机模式控制台零报错')
} finally { await browser.close() }
