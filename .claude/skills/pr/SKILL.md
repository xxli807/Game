---
name: pr
description: 为当前分支开一个 Pull Request，描述按真实 diff 写。用户说「开个 PR」「提个 pull request」或输入 /pr 时使用。注意：本仓库平时是直推 main（见 /ship），只有需要 tim.lu 过目时才走 PR。
---

# 开 PR

⚠ **本仓库的常态是直推 `main`**（推上去就自动部署，见 `/ship`），历史上没有分支也没有 PR。
所以先确认用户真的想要 PR——通常是这两种情况：

- 改动落在 **tim.lu 负责的 `src/game1/` / `src/game3/`** 上，想让他先看一眼；
- 改动大、想留个可讨论的记录。

否则建议直接走 `/ship`。

## 1. 先看真实 diff

```bash
git status
git fetch origin main
git log origin/main..HEAD --oneline
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
```

- 在 `main` 上就先开分支：`git switch -c <名字>`，**不要直接对 main 开 PR**。
- 没有 upstream 就 `git push -u origin HEAD`。
- `git status` 不干净：停下来问清楚这些改动进不进这个 PR。

## 2. 标题

跟仓库的提交信息风格保持一致——**中文，前缀点明是哪个游戏**：

```
v3: 朝堂加成、军需消耗、君王解锁，并修好两处真实 bug
v2: 让每关变成击杀指标而不是固定刷怪数
LICENSE: 统一 license 拼写（原文混用了英式 licence）
```

只有一个提交、且信息已经合规的，直接拿来当标题。不要用 `feat:` / `chore:` 这类前缀。

## 3. 正文

```markdown
## 改了什么
- <按玩家/维护者能感知的影响写，不要复述文件清单>
- <第二条，确实是另一件事才写>

## 为什么
<动机不显然时才写；标题已经说清楚就省掉>

## 验收
- [ ] `npx tsc --noEmit && npm run build` 全绿（三个游戏共用一次类型检查）
- [ ] `node .claude/skills/verify/smoke.mjs` 三个游戏都跑通、控制台零报错
- [ ] <针对本次改动的具体操作路径，例如「选嬴政开局 → 看威望收益是否 +50%」>
```

改动涉及 v3 数值 / 机制 / 结局判定时，**验收里必须有平衡测试的结果**：

```markdown
- [x] `node .claude/skills/v3-balance/balance.mjs 45` → 胜率 xx%（基准见 /v3-balance）
```

按需增加：`## 截图`（视觉改动，用 `<截图占位>` 让用户补）、`## 兼容性`
（改了 `localStorage` 存档结构 —— `sword-of-the-depths:v2:meta` / `dingge:v3:meta` 一旦变了，
老玩家的存档会怎样，必须交代）。

## 4. 创建

```bash
gh pr create --title "<标题>" --body "$(cat <<'EOF'
## 改了什么
- ...

## 验收
- [ ] ...

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

完成后把 PR 链接给用户。

## 别做的事

- 别编验收步骤——每一条都要能从 diff 推出来。
- 别列文件清单当「改动说明」，diff 自己会说。
- 别用 `--no-verify`。
- 别忘了 PR 合进 `main` 就等于**发布**，三个游戏一起重新部署。
