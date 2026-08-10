// v3《鼎革》平衡回归测试：无头浏览器随机乱选 N 局，统计胜率与结局分布。
//
//   node .claude/skills/v3-balance/balance.mjs [局数] [--url http://localhost:8080/v3/] [--fresh]
//
// 为什么要「随机乱选」：v3 的数值散布在 107 个手写事件里，肉眼看代码判断不了强弱。
// 一个不动脑子的玩家的胜率，是唯一稳定、可复现的整体强度指标。
// 当前基准见 SKILL.md（AGENTS.md 里也记着这个数）。
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const runs = Number(args.find((a) => /^\d+$/.test(a)) ?? 45)
const url = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:8080/v3/'
const fresh = args.includes('--fresh') // 每局清空 localStorage：只用初始 4 位君王，不累计解锁

const PHASES = ['蛰伏', '立足', '逐鹿', '问鼎', '建国']
const pick = (n) => Math.floor(Math.random() * n)
// 卡片有 hover 动效，而且第 4/8/12/16/20 次抉择后 React 的 effect 会把普通事件
// 换成阶段挑战——刚读到的按钮可能下一刻就没了。所以：force 点击（跳过稳定性检查），
// 点不到就返回 false，让主循环重新读一次界面状态。
const tap = async (locator) => {
  try { await locator.click({ force: true, timeout: 4_000 }); return true } catch { return false }
}
// 同理，读文字也可能扑空（元素刚被换掉）。读不到就返回空串，交给调用方决定怎么办，
// 绝不要用默认的 30 秒超时把整批测试拖死。
const read = async (page, sel) => {
  try { return (await page.locator(sel).first().innerText({ timeout: 2_000 })).trim() } catch { return '' }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })

const endings = new Map()
const titles = new Set()
const monarchsPlayed = new Map()
let wins = 0, losses = 0, collapses = 0, stuck = 0
// 第 N 次抉择放的一定是 deck[N-1]（挑战也会推进 cursor），所以两个计数都应当是 0。
let phaseAhead = 0, phaseBehind = 0
const templateLeftovers = new Set()
const crashed = []
const crashDir = process.env.TMPDIR ?? '/tmp'

await page.goto(url, { waitUntil: 'domcontentloaded' })

for (let run = 1; run <= runs; run++) {
 try {
  if (fresh) await page.evaluate(() => localStorage.removeItem('dingge:v3:meta'))
  // 回不到大厅（上一局卡住了、或返回按钮没点上）就直接重新加载——存档在 localStorage 里，不会丢
  if (fresh || !(await page.locator('.monarch-grid').count())) {
    await page.reload({ waitUntil: 'domcontentloaded' })
  }
  try {
    await page.waitForSelector('.monarch-grid', { timeout: 5_000 })
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.monarch-grid', { timeout: 10_000 })
  }

  const open = page.locator('.monarch-pick:not(.locked)')
  const count = await open.count()
  const chosen = open.nth(pick(count))
  const monarchName = (await chosen.innerText()).trim()
  monarchsPlayed.set(monarchName, (monarchsPlayed.get(monarchName) ?? 0) + 1)
  await tap(chosen)
  await tap(page.locator(".start-btn"))

  // 21 次抉择，但读界面失败 / 点击落空也各占一步，所以预算给宽一点
  let settled = false
  for (let step = 0; step < 150 && !settled; step++) {
    // 1) 终局面板
    if (await page.locator('.result-overlay').count()) {
      const win = await page.locator('.result-card.victory').count() > 0
      // 结算面板出现的那一帧可能还没画好文字，读空了就等一下再读一次
      let title = await read(page, '.result-card h2')
      if (!title) { await page.waitForTimeout(200); title = await read(page, '.result-card h2') }
      title ||= '（未读到结局标题）'
      endings.set(title, (endings.get(title) ?? 0) + 1)
      win ? wins++ : losses++
      settled = true
      break
    }
    // 2) 中道崩殂（不是终局面板，是另一块界面）
    if (await page.locator('.lobby-seal', { hasText: '殁' }).count()) {
      endings.set('中道崩殂', (endings.get('中道崩殂') ?? 0) + 1)
      collapses++
      settled = true
      break
    }
    // 3) 阶段挑战
    if (await page.locator('.challenge-screen').count()) {
      const opts = page.locator('.challenge-options .choice')
      const n = await opts.count()
      if (n) await tap(opts.nth(pick(n)))
      continue
    }
    // 4) 普通事件：顺手校验幕次与事件文案
    if (await page.locator('.event-card').count()) {
      // 界面随时可能被挑战 effect 换掉，读不到就跳过这一轮统计，不算错误
      const title = await read(page, '.event-card h2')
      if (!title) continue
      titles.add(title)
      if (/乱世传闻\s*·\s*\d+/.test(title)) templateLeftovers.add(title)

      const meta = await read(page, '.event-meta span')
      const nth = Number(meta.match(/第\s*(\d+)/)?.[1] ?? 0)
      const cardPhase = (await read(page, '.event-card .eyebrow')).split(' · ')[0].trim()
      if (nth > 0 && PHASES.includes(cardPhase)) {
        const expected = Math.min(4, Math.floor((nth - 1) / 4))
        const actual = PHASES.indexOf(cardPhase)
        if (actual > expected) phaseAhead++
        else if (actual < expected) phaseBehind++
      }

      const opts = page.locator('.event-card .choices .choice')
      const n = await opts.count()
      if (n) await tap(opts.nth(pick(n)))
      continue
    }
    await page.waitForTimeout(50)
  }
  if (!settled) stuck++

  // 回大厅：胜负面板与崩殂界面都用 .start-btn 返回（点不上也没关系，下一轮会重新加载）
  const back = page.locator('.start-btn')
  if (await back.count()) await tap(back.first())
  process.stdout.write(`\r  已跑 ${run}/${runs} 局`)
 } catch (e) {
  // 一局出岔子不该把整批测试打断：留一张截图，重新加载，接着跑
  crashed.push(`第 ${run} 局：${e.message.split('\n')[0]}`)
  await page.screenshot({ path: `${crashDir}/balance-crash-${run}.png` }).catch(() => {})
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {})
 }
}

await browser.close()

const decided = wins + losses + collapses
const pct = (n) => `${((n / decided) * 100).toFixed(0)}%`
console.log(`\n=== v3 平衡回归 · ${runs} 局随机乱选${fresh ? '（每局清档）' : ''} ===`)
console.log(`胜 ${wins} · 败 ${losses} · 崩殂 ${collapses}   →  胜率 ${pct(wins)}`)
console.log(`\n结局分布：`)
for (const [name, n] of [...endings].sort((a, b) => b[1] - a[1])) console.log(`  ${name.padEnd(12, '　')} ${n}`)
console.log(`\n事件覆盖：${titles.size} 个不同标题 · 模板残留 ${templateLeftovers.size}`)
console.log(`幕次错配：靠后 ${phaseAhead} · 靠前 ${phaseBehind}（两者都应为 0；非 0 说明某幕的牌不够用，prepareDeck 回退到了全池）`)
console.log(`君王：${[...monarchsPlayed].map(([m, n]) => `${m}×${n}`).join(' ')}`)
if (stuck) console.log(`⚠ ${stuck} 局在 150 步内没有结束（可能卡住了）`)
if (crashed.length) console.log(`⚠ ${crashed.length} 局中途异常（截图在 ${crashDir}）：\n  ${crashed.slice(0, 5).join('\n  ')}`)
console.log(errors.length ? `\n⚠ 控制台报错 ${errors.length} 条：\n  ${[...new Set(errors)].slice(0, 5).join('\n  ')}` : `\n控制台零报错 ✓`)
