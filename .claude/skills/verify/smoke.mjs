// 三个游戏的无头冒烟测试：能起、能开局、能操作、控制台不报错。
//
//   npm run build && python3 -m http.server 8080 --directory dist &
//   node .claude/skills/verify/smoke.mjs [--url http://localhost:8080] [--shots <目录>]
//
// 只回答「有没有当场炸掉」。玩法层面的回归看 /v3-balance。
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const base = (args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:8080').replace(/\/$/, '')
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : ''
if (shots) mkdirSync(shots, { recursive: true })

// v1/v2 是 canvas 生存游戏（键盘操作），v3 是文字选择游戏（点按钮）。
const GAMES = [
  { ver: 'v1', start: '.play-btn', kind: 'canvas' },
  { ver: 'v2', start: '.play-btn', kind: 'canvas' },
  { ver: 'v3', start: '.start-btn', kind: 'choices' },
]

const browser = await chromium.launch()
let failed = 0

for (const game of GAMES) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 780 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  const notes = []

  try {
    const res = await page.goto(`${base}/${game.ver}/`, { waitUntil: 'domcontentloaded' })
    if (!res?.ok()) throw new Error(`HTTP ${res?.status()}`)

    await page.waitForSelector(game.start, { timeout: 10_000 })
    await page.locator(game.start).first().click({ force: true })

    if (game.kind === 'canvas') {
      await page.waitForSelector('canvas', { timeout: 10_000 })
      // 走一会儿、打一会儿：跑到实际的游戏循环里，光加载成功不算数
      for (let i = 0; i < 40; i++) {
        const key = ['w', 'a', 's', 'd'][i % 4]
        await page.keyboard.down(key); await page.waitForTimeout(40); await page.keyboard.up(key)
        if (i % 4 === 0) await page.keyboard.press(['q', 'e', 'r', 'f'][(i / 4 | 0) % 4]).catch(() => {})
        // 升级弹窗会挡住输入，随手选一张卡
        const cards = page.locator('[class*=card] button, .upgrade-card, .level-card')
        if (await cards.count()) await cards.first().click({ force: true }).catch(() => {})
      }
      const alive = await page.locator('canvas').count()
      notes.push(alive ? 'canvas 在跑' : '⚠ canvas 消失了')
    } else {
      for (let i = 0; i < 6; i++) {
        const opts = page.locator('.choice')
        const n = await opts.count()
        if (!n) break
        await opts.nth(Math.floor(Math.random() * n)).click({ force: true }).catch(() => {})
        await page.waitForTimeout(60)
      }
      notes.push(`推进到：${await page.locator('.event-meta span').first().innerText().catch(() => '未知')}`)
    }

    if (shots) await page.screenshot({ path: `${shots}/${game.ver}.png` })
  } catch (e) {
    errors.push(`fatal: ${e.message}`)
  }

  const bad = errors.length > 0
  if (bad) failed++
  console.log(`${bad ? '✗' : '✓'} ${game.ver}  ${notes.join(' · ')}`)
  if (bad) for (const line of [...new Set(errors)].slice(0, 5)) console.log(`    ${line}`)
  await page.close()
}

await browser.close()
console.log(failed ? `\n${failed}/3 有问题` : `\n三个游戏都跑通了，控制台零报错 ✓`)
process.exit(failed ? 1 : 0)
