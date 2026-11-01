---
name: verify
description: 本仓库的验收流程——类型检查 + 构建三个游戏 + 无头浏览器实跑冒烟。改完 src/game1、src/game2、src/game3 的任何代码后使用；用户说「验证一下」「跑一下看看有没有问题」「能发吗」时也用。
---

# 验收：改完之后怎么确认没坏

三个游戏共用**一次** `tsc --noEmit`（`tsconfig.json` 的 `include` 是整个 `src`）。
所以**任何一个游戏有类型错误，三个都发不出去**——这是本仓库最容易踩的坑。

## 完整流程

```bash
npx tsc --noEmit                                  # 覆盖 src/ 全部三个游戏
npm run build                                     # 内部会再跑一次 tsc，然后构建 v1/v2/v3 + 启动页 + 404
(python3 -m http.server 8080 --directory dist &)  # 起在 dist 上，不是源码目录
node .claude/skills/verify/smoke.mjs --shots /tmp/shots
node .claude/skills/verify/world.mjs              # v3 五种活动、道路、交涉预算与村庄结果
node .claude/skills/verify/v3-rules.mjs            # v3 天命恢复、立国边界、交涉结算
node .claude/skills/verify/v3-stories.mjs          # 人物委托触发、分支、记忆与防重复
node .claude/skills/verify/v3-story-ui.mjs         # 桌面/手机委托流程与 2D 回退
node .claude/skills/verify/v3-army.mjs             # 两军交锋、军令、胜败与返回主线
node .claude/skills/verify/v3-melee.mjs            # 手动连击、命中窗口、破盾、招架与反击
node .claude/skills/verify/v3-battle-ui.mjs         # 桌面、手机横竖屏的战斗按钮与截图
node .claude/skills/verify/v3-campaign.mjs 1,0.9,0.8 10 # 活动结果进入真实 App 后的整局结算
pkill -f "http.server 8080"
```

`smoke.mjs` 对每个游戏：打开页面 → 点开始 → v1/v2 用键盘走位放技能、v3 点几次抉择 →
断言 `pageerror` / `console.error` 为空。有一个游戏出问题就 `exit 1`。

**只跑冒烟不够的情况**：改了 v3 的事件数值、机制或结局判定 → 还要跑 `/v3-balance`。

## 为什么一定要真的跑一次

这个仓库的 bug 大多不是类型错误，而是**逻辑上编译得过、跑起来才炸**：

- v3 之前 `death` 字段从头到尾没被读取，「可能阵亡」其实是必死——类型完全合法。
- v2 曾经拿显示用的中文职业名做判断，翻译一改就失效。UI 逻辑要用 `HudState.classId`
  这类**稳定字段**，不要用显示文字。
- `noUnusedLocals` 是开着的：删掉一处引用后，原来的常量会立刻变成编译错误。

## 关于 Playwright

已装在 `node_modules`，但**不在 `package.json` 里**——它是本地验收工具，不是构建依赖。
不要把它加进 `dependencies`，也不要让 `npm run build` 或 CI 依赖它，
否则 `npm ci` 之后 GitHub Actions 会直接挂掉。

## 临时脚本放哪

一次性的调试脚本放**仓库根目录**并命名成 `_something.mjs`（`.gitignore` 里 `_*.mjs` 已经忽略了）。
反过来，会重复用到的脚本就该像 `smoke.mjs` / `balance.mjs` 一样进 `.claude/skills/` 提交掉——
下一个会话就不用重写一遍。

## 线上确认

推送后 Pages 会自动构建（`.github/workflows/deploy.yml`）：

```bash
gh run watch                                      # 等这次部署跑完
curl -sI https://xxli807.github.io/Game/v3/ | head -1
```

## v3 骨骼角色

`node .claude/skills/verify/v3-animation.mjs` 读取实际 GLB，验证独立骨骼、甲胄蒙皮、刀具绑定、出手前动作、暂停时披风/弓姿不漂移、释放后其他角色仍正常，以及下载失败后的可玩回退。角色、动作、资源释放改动必跑；画面还需用 `v3-battle-ui.mjs` 的截图人工检查。
