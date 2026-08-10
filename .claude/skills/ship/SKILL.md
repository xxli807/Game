---
name: ship
description: 把改动推上线：拉取变基 → 验收 → 提交 → 推送 main → 盯 GitHub Pages 部署 → 确认线上可访问。用户说「发布」「推上去」「上线」「部署」时使用。注意推送到 main 会立刻部署三个游戏。
---

# 发布

**推送到 `main` 就是发布**——没有预发环境，`.github/workflows/deploy.yml` 会把
`dist/` 整个推到 GitHub Pages，三个游戏一起换新。所以顺序不能反：先验收，再推。

## 步骤

### 1. 先拉，再动手

```bash
git pull --rebase origin main
```

tim.lu 用 Codex 在同一个仓库里改 `src/game1/` 和 `src/game3/`。
**冲突用 rebase 解决，不要覆盖对方的提交。**

### 2. 验收（不可跳过）

按 `/verify` 跑完：`npx tsc --noEmit` → `npm run build` → 冒烟。
动过 v3 事件数值 / 机制 / 结局判定的，再跑一遍 `/v3-balance`。

### 3. 提交信息

仓库的提交信息是**中文**，格式看得出改的是哪个游戏：

```
v3: 朝堂加成、军需消耗、君王解锁，并修好两处真实 bug
v2: 让每关变成击杀指标而不是固定刷怪数
LICENSE: 统一 license 拼写（原文混用了英式 licence）
```

写**做了什么 + 为什么**。改到 tim.lu 负责的部分（`src/game1/`、`src/game3/`）时，
这一条尤其重要——他要靠 commit message 回溯我们动了什么。

正文里带上验收结果，例如「45 局随机乱选：胜率 38%，控制台零报错」。

### 4. 推送并盯着部署

```bash
git push origin main
gh run watch                                        # 构建 + 部署大约 1–2 分钟
curl -sI https://xxli807.github.io/Game/v3/ | head -1
```

部署失败最常见的原因是**另一个游戏的类型错误**——本地 `npm run build` 通过就不会出现，
所以别省第 2 步。

## 不要做的事

- 不要提交 `dist/`（`.gitignore` 已忽略）。
- 不要把大图放进 `public/arts/`；原始素材留在 `art-source/`（已忽略）。
- 不要 `git push --force`（settings.json 里已禁用）。
- 不要新建 `CLAUDE.md`——它是指向 `AGENTS.md` 的符号链接，两边 AI 读的是同一份字节。
