# Sword of the Depths — 仓库指南

> 这份文件是 **AGENTS.md**，`CLAUDE.md` 是指向它的符号链接。
> tim.lu 用 **Codex**（读 `AGENTS.md`），我们用 **Claude Code**（读 `CLAUDE.md`）——
> 两边读的是同一份字节，改这一份就好，**不要另外新建一份**，否则两个 AI 会拿到互相矛盾的指南。

一个仓库承载**三个独立的游戏**，一次推送同时部署全部三个。

**授权：专有，保留所有权利**（见根目录 `LICENSE`）。仓库公开只是因为 GitHub Pages 要托管游戏，
不等于授予任何许可——他人可以玩、可以看代码，但不得复制、修改、再分发或另作他用。

## 线上地址
| 路径 | 内容 |
|---|---|
| https://xxli807.github.io/Game/ | 启动页（三选一） |
| `/Game/v1/` | game1 — 原版横冲survivor（**tim.lu 维护**） |
| `/Game/v2/` | game2 — 《深渊之剑》剧情下潜版（全中文） |
| `/Game/v3/` | game3 — 《鼎革：王朝崛起》中国朝代文字选择游戏（**tim.lu 创建**） |

URL 大小写不敏感：`/game/v2`、`/Game/V2`、`/GAME/game2` 都能到达
（仓库内 `404.html` 处理版本段；仓库名段由 `xxli807/xxli807.github.io` 用户站点的 404 转发）。

## 目录结构
```
src/game1/   原版（自带 index.html + main.tsx + App.tsx + game/ + components/ + styles.css）
src/game2/   剧情版（结构同上，另有 game/story.ts 剧情、game/audio.ts 程序化音效）
src/game3/   朝代文字游戏
             ├ App.tsx     界面 + 流程 + tim.lu 手写的 authoredEvents / CHALLENGES
             ├ rules.ts    机制层：君王被动、朝堂加成、军需、资源危机、挑战修正、结局判定
             ├ meta.ts     跨局存档：君王解锁（localStorage `dingge:v3:meta`）
             └ events.ts   90 个手写事件（分五幕）
public/arts/ 三者共用的贴图
Plan/        设计文档：plan.md（v2 总体规划）、game3-improvements.md（v3 诊断与计划）
```
每个游戏**各自拥有全套模块**，互不 import → 改一个不会影响另一个。

## 构建与部署
```bash
npm run build     # 一次构建全部三个 → dist/v1 dist/v2 dist/v3 + 启动页 + 404
npm run dev       # 默认 game1
npm run dev:v2    # 调试 v2
npm run dev:v3    # 调试 v3
```
- `vite.config.ts` 由 `--mode game1|game2|game3` 或 `TARGET` 选择目标，`base` 为相对路径。
- **推送到 `main` 即自动部署**（`.github/workflows/deploy.yml` → GitHub Pages），无需本地构建。
- ⚠️ `npm run build` 先跑 `tsc --noEmit`，**覆盖整个 `src/`**：任一游戏有类型错误，三个都发不出去。

## 协作约定（重要）
两边都在用 AI 改这个仓库，所以约定的重点是**减少冲突面**，而不是划禁区。

- **tim.lu (tim.lu@highlimitstudio.com)** 主要做 `src/game1/` 与 `src/game3/` 的内容创作；
  我们的主线是 `src/game2/`。
- **可以改对方的文件**，但优先考虑「能不能放进新文件」：
  例如 v3 的机制没有塞进 `App.tsx`，而是拆成 `rules.ts` / `meta.ts` / `events.ts`，
  `App.tsx` 只留少数几行接入点——这样两边同时开工也很少真正撞车。
- **开工前先 `git pull --rebase origin main`**，冲突时 rebase 而非覆盖。
- 改动别人负责的部分时，在 commit message 里写清楚**改了什么、为什么**，方便对方回溯。

## v2 现状要点
- 剧情：凯尔（附在武器中的挚友）叙事，四层下潜（沉没要塞→腐林→冰封典藏→熔心），
  每层一位层主（罗德林/玛伦/伊尔/空蚀之王），击败必得该层遗物；第 12 关通关。
- 每关是**击杀指标**而非固定刷怪数，怪物持续涌来；宝箱给一次额外技能选择。
- 「最后的余烬」营地：余烬货币 + 六项永久升级，存档键 `sword-of-the-depths:v2:meta`。
- 音效为 Web Audio 程序化合成（无音频文件，离线可用），营地有「🔊 音效试听」面板。
- **全中文**。注意：UI 逻辑不要拿显示文字做判断，用 `HudState.classId` 这类稳定字段
  （之前就因为比较英文职业名而踩过坑）。

## v3 现状要点
- 12 位君王各有**被动 + 每局一次的专属抉择**；初始解锁 4 位，每通关一次解锁下一位。
- 六种资源全部参与判定；**军需**让军队每回合吃粮，粮草是真约束。
- **朝堂加成**：人才 / 军制 / 配偶各带常驻效果（`TALENT_BOONS` 等），侧栏会列出生效条目。
  新增人才名字必须同时在 `rules.ts` 里补加成，否则又会变成没用的收集物。
- 事件共 107 个（tim.lu 手写 17 + `events.ts` 手写 90），**按幕抽牌**：
  每个抉择位置只从当幕（蛰伏/立足/逐鹿/问鼎/建国）的事件里抽。
- 立国要求**三根柱子里立住两根**（兵力 75 / 民心 70 / 威望 60）+ 稳定 ≥35 + 粮草 >0；
  七种结局：万世之基 / 马上得天下 / 民心所归 / 万邦来朝 / 乱世吞没了你 / 天命未成 / 中道崩殂。
- ⚠️ **改事件数值必须重跑平衡测试**：`events.ts` 的数值尺度远大于最初的模板事件，
  当初直接换上去后随机胜率从 50% 飙到 77%，是靠抬高立国门槛拉回来的。
  当前基准：**随机乱选 45 局 ≈ 38% 胜率**。

## 验证方式
```bash
npx tsc --noEmit && npm run build
```
再用 Playwright 无头浏览器实际跑一局（本仓库已装 playwright）：
起 `python3 -m http.server 8080 --directory dist`，脚本放在**仓库根目录**（`_*.mjs` 已被 gitignore），
截图与断言并检查 `pageerror` / console error。音效可通过包装 `AudioContext` 计数验证。

v3 特有：脚本里跑 20–45 局随机乱选，统计胜/负/崩殂、结局种类、幕次是否错配。
数值一改就看胜率漂移，比肉眼看代码可靠得多。

## 已知注意事项
- macOS 文件系统大小写不敏感：不要用 `dist/v1` 与 `dist/V1` 这类同名不同例的目录。
- 大图不要提交进 `public/arts/`（会拖垮推送）；原始素材放 `art-source/`（已 gitignore）。
- `tsconfig.json` 开了 `noUnusedLocals`：删掉一处引用后，原来的常量可能立刻变成编译错误。
