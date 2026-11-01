// v2「边玩边学」回归：题库自检 + 真实界面跑一遍答题流程。
// 用法：先 npm run build 并起好 dist 静态服务器，然后
//   node .claude/skills/verify/v2-learn.mjs [--url http://localhost:8080]
import { build } from 'esbuild'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const args = process.argv.slice(2)
const base = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:8080'

// ---------- 1. 题库自检（纯逻辑，不开浏览器） ----------
const bundle = await build({
  stdin: { contents: "export * from './src/game2/game/quiz'", resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node',
})
const { QUESTIONS, QuizRunner, TIER_NAMES, QUIZ_INTERVAL, shouldAskNow } = await import('data:text/javascript,' + encodeURIComponent(bundle.outputFiles[0].text))

const ids = new Set()
for (const q of QUESTIONS) {
  assert.ok(!ids.has(q.id), `题号重复：${q.id}`)
  ids.add(q.id)
  assert.ok(q.tier >= 1 && q.tier <= TIER_NAMES.length, `${q.id} 难度档越界`)
  assert.equal(q.choices.length, 4, `${q.id} 应该是四个选项`)
  assert.ok(q.answer >= 0 && q.answer < q.choices.length, `${q.id} 正确答案下标越界`)
  assert.equal(new Set(q.choices).size, 4, `${q.id} 选项有重复`)
  assert.ok(q.explain.length > 4, `${q.id} 缺少讲解`)
  assert.ok(q.prompt.length > 0 && q.sub, `${q.id} 缺少题面或中英对照`)
}
// 每档都要同时有数学和英语，否则「由易到难」中间会断档
for (let tier = 1; tier <= TIER_NAMES.length; tier++) {
  for (const subject of ['math', 'english']) {
    const n = QUESTIONS.filter((q) => q.tier === tier && q.subject === subject).length
    assert.ok(n >= 4, `第 ${tier} 档 ${subject} 只有 ${n} 题，太少`)
  }
}

// 全对的孩子应该被一路推到最高档
const ace = new QuizRunner(1)
for (let i = 0; i < 6; i++) { const q = ace.next(); ace.record(q, q.answer) }
assert.equal(ace.tier, TIER_NAMES.length, '连续答对没有升到最高难度')
assert.equal(ace.correct, 6)
assert.equal(ace.bestStreak, 6)

// 一直答错应该退回第 1 档，并且永远有题可出（不会抛异常 / 不会重复出同一题）
const struggling = new QuizRunner(2)
const seen = new Set()
for (let i = 0; i < 30; i++) {
  const q = struggling.next()
  assert.ok(!seen.has(q.id) || seen.size >= QUESTIONS.length, `重复出题：${q.id}`)
  seen.add(q.id)
  struggling.record(q, (q.answer + 1) % 4)
}
assert.equal(struggling.tier, 1, '连续答错没有降回最简单的一档')
assert.equal(struggling.correct, 0)

// 答对升档、连错两题降一档
const mixed = new QuizRunner(3)
let q = mixed.next(); mixed.record(q, q.answer)
assert.equal(mixed.tier, 2, '答对应该升一档')
q = mixed.next(); mixed.record(q, (q.answer + 1) % 4)
assert.equal(mixed.tier, 2, '只错一题不该降档')
q = mixed.next(); mixed.record(q, (q.answer + 1) % 4)
assert.equal(mixed.tier, 1, '连错两题应该降一档')
console.log(`✓ 题库 ${QUESTIONS.length} 题自检通过（${TIER_NAMES.length} 档，数学 + 英语），难度升降正常`)

// 定时提问的规则：到点才问，而且绝不插别的弹窗的队
const playing = { learnMode: true, status: 'playing', time: QUIZ_INTERVAL, nextAt: QUIZ_INTERVAL, quizOpen: false, storyActive: false }
assert.equal(QUIZ_INTERVAL, 180, '间隔应该是 3 分钟')
assert.equal(shouldAskNow(playing), true, '到点了应该提问')
assert.equal(shouldAskNow({ ...playing, time: QUIZ_INTERVAL - 1 }), false, '没到点不该提问')
assert.equal(shouldAskNow({ ...playing, learnMode: false }), false, '普通模式永远不提问')
assert.equal(shouldAskNow({ ...playing, quizOpen: true }), false, '已经在答题时不该再弹一道')
assert.equal(shouldAskNow({ ...playing, storyActive: true }), false, '剧情播放时不插队')
for (const status of ['skillselect', 'paused', 'dead', 'victory', 'menu']) {
  assert.equal(shouldAskNow({ ...playing, status }), false, `${status} 状态下不该提问`)
}
console.log('✓ 定时提问规则通过：每 3 分钟一题，选技能 / 剧情 / 暂停 / 死亡时都不插队')

// ---------- 2. 真实界面：开场答题 → 进入游戏 → 奖励生效 ----------
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })

  await page.goto(`${base}/v2/`)
  await page.waitForSelector('.learn-btn')

  // 普通「下潜」不应该弹题，学习模式才弹
  await page.click('.descend-btn')
  await page.waitForSelector('.game-canvas')
  await page.waitForTimeout(600)
  assert.equal(await page.locator('.quiz-card').count(), 0, '普通模式不该出现答题框')
  await page.click('.exit-btn')

  await page.waitForSelector('.learn-btn')
  await page.click('.learn-btn')
  await page.waitForSelector('.quiz-card', { timeout: 5000 })

  // 开场题：必须先作答才能继续
  assert.ok(await page.locator('.quiz-go').isDisabled(), '没作答时「继续」应该是禁用的')
  assert.ok((await page.locator('.quiz-prompt').innerText()).length > 0, '题面为空')
  assert.equal(await page.locator('.quiz-choice').count(), 4, '应该有四个选项按钮')
  await page.locator('.quiz-choice').nth(0).click()
  await page.waitForSelector('.quiz-feedback')
  assert.equal(await page.locator('.quiz-choice.right').count(), 1, '作答后应该标出正确答案')
  assert.ok(!(await page.locator('.quiz-go').isDisabled()), '作答后应该可以继续')
  await page.click('.quiz-go')

  // 继续后进入游戏：答题框消失，画布在跑
  await page.waitForSelector('.quiz-card', { state: 'detached' })
  await page.waitForTimeout(900)
  assert.equal(await page.locator('.game-canvas').count(), 1, '答完题应该进入游戏')
  assert.ok(!(await page.locator('.death-card').isVisible().catch(() => false)), '不该直接出现暂停/死亡框')

  // 退出回大厅，两个按钮都还在
  await page.click('.exit-btn')
  await page.waitForSelector('.learn-btn')

  assert.deepEqual(errors, [], `控制台有报错：\n${errors.join('\n')}`)
  console.log('✓ 界面流程通过：普通模式不弹题，学习模式开场必答、有讲解、答完进入游戏，控制台零报错')
} finally {
  await browser.close()
}
