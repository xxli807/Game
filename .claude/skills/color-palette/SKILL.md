---
name: color-palette
description: 三个游戏各自的配色约定与色值放在哪。改任何颜色时使用——CSS、canvas 绘制代码、内联 style、渐变、阴影；看到组件里出现裸 hex 时也用。三套配色互相独立，不要串味。
---

# 配色

**三个游戏是三套独立的视觉体系，绝对不要互相借色。**
一个游戏一份 `styles.css`，没有共享主题层，也没有 `theme/palette.ts` 这种集中文件。

| 游戏 | 气质 | 底色 | 主色 |
|---|---|---|---|
| v1《Sword of the Depths》 | 暗黑地牢 | 深色 | 见 `src/game1/styles.css` |
| v2《深渊之剑》 | 下潜四层，逐层变冷/变热 | 深色 | `--gold` / `--purple`（`:root`） |
| v3《鼎革》 | 明清纸面、印章朱红 | `#efe1c4` 宣纸 | `#8e2e25` 朱红、`#5e1d19` 印泥深红 |

## 色值现在放在哪（如实记录，不是理想状态）

- **v2** 在 `src/game2/styles.css` 的 `:root` 里有 4 个变量：`--font` `--gold` `--gold-dark` `--purple`，
  被 `var()` 引用 28 处。**这是仓库里唯一的 token 化尝试**。
- **v1 / v3** 没有 CSS 变量，全是字面量（v1 58 处、v3 86 处）。
- **canvas 绘制代码里的颜色最多**：`game1/game/engine.ts` 145 处、`game2/game/engine.ts` 137 处、
  两个 `sprites.ts` 各 101 处。canvas 用不了 CSS 变量，只能是 JS 里的字符串。
- **v3 的君王主题色**写在 `App.tsx` 的 `MONARCHS` 数组里（每位君王一个 `color`），
  通过内联 `style={{ borderColor: monarch.color }}` 用出去——这是数据，不是样式，**留在原地**。

## 规矩

1. **改色先搜同一个值**：`grep -rn "#8e2e25" src/game3/` ——同一个红在按钮、边框、阴影里
   出现好几次，只改一处会让界面花掉。
2. **同一个游戏内部要复用已有色**，不要引入第 5 个相近的棕色。改之前先看这个文件里已经有什么。
3. **不要跨游戏共用色值**，也不要为了「统一」把三套配色合并到一个共享文件里——
   三个游戏刻意保持互不 import，合并配色等于把它们焊死在一起。
4. **改了颜色就要过对比度**：v3 的纸面配色已经有实际不合格的地方
   （`.fine-print #967757` on `#efe1c4` = 3.2:1）。用
   `node .claude/skills/a11y-review/contrast.mjs "#前景" "#背景"` 验一下，细则见 `/a11y-review`。
5. **要不要 token 化？** 想给某个游戏加 CSS 变量是好事，但**一次只动一个游戏**，
   并且照 v2 的写法来（`:root` 里定义，`var()` 引用）。不要顺手把另外两个也改了——
   那会把改动面铺到 tim.lu 正在改的文件上。

## canvas 里的颜色

`engine.ts` / `sprites.ts` 里的 `ctx.fillStyle = '#...'` 没法用 CSS 变量。
要抽的话就在该游戏的 `game/` 目录里建一个模块常量，**别抽到仓库根**——
三个游戏各有全套模块、互不 import，这条边界比消除重复更重要。
