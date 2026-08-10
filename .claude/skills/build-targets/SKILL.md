---
name: build-targets
description: 一个仓库三个游戏是怎么构建和部署的——vite 的 TARGET 机制、dist 布局、GitHub Pages 与大小写不敏感的 URL 转发。改 vite.config.ts、scripts/build.mjs、index.html、404.html、启动页，或调试「为什么资源 404 / 为什么部署出来是另一个游戏」时使用。
---

# 三合一构建

一个仓库承载三个**互不 import** 的游戏，一次推送同时部署三个。

```
src/game1/ → dist/v1/ → https://xxli807.github.io/Game/v1/   原版横冲 survivor（tim.lu 维护）
src/game2/ → dist/v2/ → /Game/v2/                            《深渊之剑》剧情下潜版
src/game3/ → dist/v3/ → /Game/v3/                            《鼎革：王朝崛起》（tim.lu 创建）
launcher.html → dist/index.html                              三选一启动页
404.html      → dist/404.html                                URL 大小写/别名转发
```

## TARGET 怎么选游戏

`vite.config.ts` 按这个顺序取目标：`process.env.TARGET` → `npm_config_target` → 命令行里出现的
`game1|game2|game3` → `mode`，认不出就退回 `game1`。选中之后：

- `root` = `src/<target>/`（**每个游戏自带 index.html + main.tsx**）
- `outDir` = `dist/v<n>/`
- `publicDir` = 仓库根的 `public/`（三个游戏共用贴图）
- `base` = 构建时 `'./'`，开发时 `'/'`

`base` 用相对路径是刻意的：同一份产物挂在 `/Game/v1/`、`/Game/v2/` 下都能正确取到资源。
**改成绝对路径会让线上资源全部 404。**

```bash
npm run dev      # game1
npm run dev:v2
npm run dev:v3
npm run build    # 三个一起
```

## `npm run build` 做了什么

`scripts/build.mjs`：清掉 `dist/` → **跑一次 `tsc --noEmit`** → 依次三次 `vite build`
→ 复制 `launcher.html` 和 `404.html`。

⚠ 那一次 `tsc` 覆盖整个 `src/`（`tsconfig.json` 的 `include: ["src"]`）。
**任何一个游戏有类型错误，三个都发不出去。** 这是本仓库最常见的发布失败原因。

## 部署

推送到 `main` 即部署（`.github/workflows/deploy.yml`：Node 24 → `npm ci` → `npm run build`
→ upload `dist/` → Pages）。没有预发环境。**不要提交 `dist/`**，它在 `.gitignore` 里。

## 大小写不敏感的 URL

`/game/v2`、`/Game/V2`、`/GAME/game2` 都要能到 `/Game/v2/`：
仓库内 `404.html` 负责版本段，仓库名那一段由 `xxli807/xxli807.github.io` 用户站点的 404 转发。

**为什么不直接复制出 `dist/V1` 这种目录**：macOS 文件系统大小写不敏感，
`dist/v1` 和 `dist/V1` 会互相覆盖，产物还会翻倍。转发是唯一可行解。

## 加第四个游戏时

1. `src/game4/` 放全套（`index.html` / `main.tsx` / `App.tsx` / `styles.css`），**不要 import 别的游戏**；
2. `vite.config.ts` 的 `targets` 数组加 `'game4'`；
3. `scripts/build.mjs` 加一行 `run('vite build', { TARGET: 'game4' })`；
4. `package.json` 加 `dev:v4` / `build:v4`；
5. `launcher.html` 加入口，`404.html` 加转发分支。

## 依赖

运行时依赖只有 `react` / `react-dom`。**Playwright 装在本地但不在 `package.json` 里**，
它是验收工具——别把它加进 `dependencies`，否则 CI 的 `npm ci` 会直接失败。
本仓库**没有** Tailwind、没有 MUI、没有 PostCSS，样式是每个游戏各自手写的 `styles.css`。
