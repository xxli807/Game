---
name: a11y-review
description: 按 WCAG 2.2 AA 审查这三个游戏的可访问性——canvas 生存游戏（v1/v2）的键盘操作与动效，文字选择游戏（v3）的对比度与焦点可见性。用户说「a11y」「可访问性」「无障碍」「色盲/弱视能不能玩」，或改完 UI/CSS 之后使用。
---

# 可访问性审查（WCAG 2.2 AA）

针对本仓库的实际形态：**v1/v2 是 canvas 生存游戏**（键盘操作，画面全在 `<canvas>` 里，
屏幕阅读器什么也读不到），**v3 是纯文字选择游戏**（DOM 按钮，明清纸面配色）。
没有 MUI、没有组件库，样式是每个游戏各自的 `styles.css`（纯手写 CSS）。

审查改动过的部分即可。结论分三档：**必改**（能用性问题）/ **应改**（这次一起改）/ **建议**。
每条给出 `文件:行` 和改法。

## 现状（2026-08 扫描，写清楚是为了不重复报同一批老问题）

| 项 | 现状 |
|---|---|
| `prefers-reduced-motion` | 三个游戏**一处都没有** |
| `:focus` / `:focus-visible` 样式 | **没有**（键盘用户看不到焦点在哪） |
| `aria-*` | 全仓库只有 2 处（v1/v2 的职业选择器） |
| `<html lang>` | v3 是 `zh-CN`；**v1/v2 写的是 `en`，但 v2 已经全中文了** |
| 最小字号 | `10px` / `.66rem`（v3 侧栏、`.fine-print`） |

## 检查项（按本仓库的价值排序）

### 1. 对比度 — 必改
v3 的纸面配色很容易踩线。已知实例：`.fine-print { color: #967757 }` 落在
`#efe1c4` 的背景上 → **3.2:1**，正文要求 4.5:1，不合格。

```bash
node .claude/skills/a11y-review/contrast.mjs "#967757" "#efe1c4"
```

正文 ≥ 4.5:1；≥18.66px 粗体或 ≥24px 的大字 ≥ 3:1；按钮边框等非文字元素 ≥ 3:1。
**改颜色时不要只改这一处**——先看 `/color-palette`，同一个色值在别处也可能用到。

### 2. 焦点可见 — 必改
仓库里所有 `.choice` / `.monarch-pick` / `.play-btn` 都只写了 `:hover`。
只用键盘的玩家（以及不用鼠标的玩家）完全看不出焦点在哪。

```css
/* 每个 styles.css 里加一条兜底就够，不要逐个按钮写 */
:focus-visible { outline: 3px solid #8e2e25; outline-offset: 2px; }
```

不要用 `outline: none` 关掉默认焦点圈而不给替代物。

### 3. `prefers-reduced-motion` — 应改
v2 有屏幕震动 / hit-stop / 击杀连击特效，v3 的 `.timer.urgent` 是 `animation: pulse 1.2s infinite`。
前庭敏感的人会不舒服。

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
```

canvas 里的震动要在 JS 里读：`matchMedia('(prefers-reduced-motion: reduce)').matches`，
命中就把 shake 幅度设为 0。**不要**顺手把游戏性动画（角色、投射物）也停掉。

### 4. `<html lang>` 要和实际语言一致 — 应改
v2 已经全中文，`src/game2/index.html` 却还是 `lang="en"`：屏幕阅读器会用英语发音读中文。
改成 `zh-CN`。v1 仍是英文界面，保持 `en` 正确。

### 5. 键盘可达 —— canvas 游戏的现实边界
v1/v2 本来就是键盘游戏（WASD 移动，Q/E/R/F 技能），这点没问题。真正的缺口是：

- 操作说明只在开始界面用文字列出，**游戏中无处可查**；
- `<canvas>` 对屏幕阅读器是黑箱。至少给它一个 `aria-label` 说明这是游戏画面，
  并在旁边放一段 `.sr-only` 文本说明操作键位；
- 升级弹窗（`LevelUpModal`）已经监听了键盘，确认它出现时**焦点会移进去**、Esc 能关，
  且背后的画面不会继续吃走按键。

v3 全是原生 `<button>`，Tab / Enter 天然可用——**不要**把它们换成 `<div onClick>`。

### 6. 只靠颜色传达信息 — 应改
v3 的 `.stat-warn`（粮草告急）、`.choice-risk`（阵亡风险）目前主要靠红色区分。
危险选项已经有 `☠ 阵亡风险 30%` 的文字，保持住；`.stat-warn` 建议也加一个符号或文字，
不要只有变红。

### 7. 点击目标大小
WCAG 2.2 的 24×24 CSS px 下限。v3 的 `.monarch-pick` 是 12 格网格，
移动端窄屏时容易掉到线下——改布局时顺手量一下。

## 怎么快速验证

```bash
node .claude/skills/a11y-review/contrast.mjs "#前景" "#背景"     # 单对颜色
```

真要看效果就按 `/verify` 起 `dist`，用 Playwright 截图；
测键盘则在脚本里连续 `page.keyboard.press('Tab')` 并截图看焦点圈走到哪。
