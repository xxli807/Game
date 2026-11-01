// 3D 整局难度回归：把真实 App 挂进隔离页面，连续打完多局「Start Playing」，
// 统计胜率随「活动成功率 p」的变化。p 是模拟玩家完成一次世界活动的概率。
//
//   node .claude/skills/verify/v3-campaign.mjs 1,0.9,0.8 10
//
// 基准（2026-10-21，activityFailure 改动后）：p=1 → 90%，0.9 → 70%，0.8 → 50%，0.7 → 0%。
// 改动前为 89% / 50% / 20% / 0%，失手两次就必败。改 App 结算、rules 失败惩罚、
// 时限或危机代价后必须重跑。
//
// 实现说明：原型补丁只存在于这个 esbuild 包里，生产代码没有任何测试开关；
// 强制走 2D 回退渲染器只是为了跑得快，规则与 3D 完全相同。
// 每局之间回到大厅复用同一个页面——频繁开关页面会让无头浏览器吃满内存。
import { build } from 'esbuild'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const PS = (process.argv[2] ?? '1').split(',').map(Number), RUNS = Number(process.argv[3] ?? 12)
const bundle = await build({ stdin: { contents: `
import React from 'react'; import { createRoot } from 'react-dom/client';
import App from './src/game3/App';
import { DynastyBattle } from './src/game3/action/engine';
const orig = DynastyBattle.prototype.setEvent;
DynastyBattle.prototype.setEvent = function(...a){ window.g = this; this.sound.muted = true; return orig.apply(this, a) };
document.getElementById('root').remove();
const host = document.createElement('div'); document.body.append(host);
createRoot(host).render(React.createElement(App));`, resolveDir: process.cwd() },
  bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"' } })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.addInitScript(() => { const gc = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (t, ...a) { return t === 'webgl2' ? null : gc.call(this, t, ...a) } })
await page.goto('http://localhost:8080/v3/')
await page.evaluate(() => localStorage.clear())
await page.addScriptTag({ content: bundle.outputFiles[0].text })
await page.waitForSelector('.start-playing-btn')
for (const P of PS) {
  const rows = await page.evaluate(async ({ p, runs }) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const out = []
    for (let run = 0; run < runs; run++) {
      const start = document.querySelector('.start-playing-btn')
      if (!start) { out.push({ error: 'no lobby' }); break }
      start.click(); await sleep(120)
      let picks = 0, fails = 0, pending = null, done = null
      for (let step = 0; step < 400 && !done; step++) {
        await sleep(12)
        const g = window.g, d = document.querySelector('.world-dialog')
        const small = d?.querySelector('small')?.textContent ?? ''
        if (small.includes('史官落笔')) { done = { end: d.querySelector('h2').textContent, win: small.includes('新朝已立'), picks, fails }; break }
        const opts = [...document.querySelectorAll('.world-options button')]
        if (opts.length && /蛰伏|立足|逐鹿|问鼎|建国/.test(small)) {
          opts[Math.floor(Math.random() * opts.length)].click(); picks++
          pending = Math.random() < p; if (!pending) fails++; continue
        }
        if (g?.order && g.status !== 'orderdone') { g.finish(pending ?? true); continue }
        const cont = [...document.querySelectorAll('.world-dialog button')].find(b => b.textContent.includes('记入起居注'))
        if (cont) { cont.click(); pending = null; continue }
        if (g && !g.order) { Object.assign(g.player, g.interactionTarget()); g.interact() }
      }
      out.push(done ?? { error: 'no ending', picks, fails })
      const back = [...document.querySelectorAll('.world-dialog button')].find(b => b.textContent.includes('返回君王选择'))
      if (back) back.click()
      await sleep(200)
    }
    return out
  }, { p: P, runs: RUNS })
  const done = rows.filter(r => r.end), wins = done.filter(r => r.win).length
  const tally = {}; for (const r of done) tally[r.end] = (tally[r.end] ?? 0) + 1
  console.log(`p=${String(P).padEnd(5)} completed ${done.length}/${rows.length}  WINS ${wins} (${(wins / Math.max(1, done.length) * 100).toFixed(0)}%)  avg decisions ${(done.reduce((s, r) => s + r.picks, 0) / Math.max(1, done.length)).toFixed(1)}`)
  console.log(`      endings: ${JSON.stringify(tally)}`)
  assert.equal(done.length, RUNS, `p=${P}: every campaign must reach an ending; ${JSON.stringify(rows.filter(r => !r.end))}`)
}
console.log('console errors:', errs.length)
await browser.close()
assert.deepEqual(errs, [], 'campaigns must not produce browser errors')
