# Sword of the Depths — 仓库指南

一个仓库承载**三个独立的游戏**，一次推送同时部署全部三个。

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
src/game3/   朝代文字游戏（App.tsx 单文件 + rules.ts 机制层）
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
- **tim.lu (tim.lu@highlimitstudio.com)** 拥有 `src/game1/` 与 `src/game3/` 的内容创作。
- 我们的主线是 `src/game2/`。
- 动 v3 时，机制写在 `src/game3/rules.ts`，**不要改他的事件文案**
  （`authoredEvents` / `generatedEvents` / `CHALLENGES`），把冲突面压到最小。
- 他会不定期推送，**开工前先 `git pull --rebase origin main`**，冲突时 rebase 而非覆盖。

## v2 现状要点
- 剧情：凯尔（附在武器中的挚友）叙事，四层下潜（沉没要塞→腐林→冰封典藏→熔心），
  每层一位层主（罗德林/玛伦/伊尔/空蚀之王），击败必得该层遗物；第 12 关通关。
- 每关是**击杀指标**而非固定刷怪数，怪物持续涌来；宝箱给一次额外技能选择。
- 「最后的余烬」营地：余烬货币 + 六项永久升级，存档键 `sword-of-the-depths:v2:meta`。
- 音效为 Web Audio 程序化合成（无音频文件，离线可用），营地有「🔊 音效试听」面板。
- **全中文**。注意：UI 逻辑不要拿显示文字做判断，用 `HudState.classId` 这类稳定字段
  （之前就因为比较英文职业名而踩过坑）。

## 验证方式
```bash
npx tsc --noEmit && npm run build
```
再用 Playwright 无头浏览器实际跑一局（本仓库已装 playwright）：
起 `python3 -m http.server 8080 --directory dist`，脚本放在**仓库根目录**（`_*.mjs` 已被 gitignore），
截图与断言并检查 `pageerror` / console error。音效可通过包装 `AudioContext` 计数验证。

## 已知注意事项
- macOS 文件系统大小写不敏感：不要用 `dist/v1` 与 `dist/V1` 这类同名不同例的目录。
- 大图不要提交进 `public/arts/`（会拖垮推送）；原始素材放 `art-source/`（已 gitignore）。
