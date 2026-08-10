---
name: react
description: 本仓库的 React 写法与边界——canvas 引擎（v1/v2）和 React 之间怎么交接状态，v3 的单一 Run 对象怎么更新，以及 strict/noUnusedLocals 下常踩的坑。改 App.tsx、components/、engine.ts 与 React 的接口时使用。
---

# 这个仓库的 React

React 18.3 + TypeScript + Vite。**没有** 状态库、路由、CSS-in-JS、组件库、测试框架。
三个游戏各有全套模块，互不 import。

## 两种完全不同的架构，别混着写

### v1 / v2：命令式引擎 + React 外壳

`game/engine.ts`（3400+ 行）是一个 class，自己跑 `requestAnimationFrame`、自己画 canvas。
**React 不参与每帧渲染**，只做外壳：菜单、HUD、弹窗。

交接口就这一处（`src/game2/App.tsx:150` 附近）：

```tsx
const engine = new GameEngine(canvasRef.current, {
  stats: statsFromMeta(meta),
  classId,
  onState: setHud,        // 引擎按自己的节奏把 HudState 推给 React
  onStageCleared, onStory: pushStory, onRunEnd,
})
engineRef.current = engine
return () => engine.destroy()
```

规矩：

- **每帧变化的东西（坐标、血量、投射物）绝不进 React state。** 引擎自己持有，
  只在 HUD 需要时通过 `onState` 推一份快照出来。想加 HUD 字段就加进 `HudState`。
- **React → 引擎走命令**：`engineRef.current?.castAbility(key)`、`chooseCard(id)`、
  `pause()` / `resume()`。不要试图用 props 驱动引擎。
- 引擎实例只在挂载时建一次（`useEffect(..., [])`，`exhaustive-deps` 是特意关掉的）。
  改这个 effect 的依赖数组前先想清楚：重建引擎 = 这一局重开。
- 会连续触发的东西（剧情弹窗）用 ref 队列，不要用 state 数组——
  见 `storyQueue` / `storyActive` 的写法。
- 一局只能结算一次：`endedRef` 这类哨兵别删。

### v3：纯 React，单一 Run 对象

整局状态是一个 `Run` 对象（`src/game3/App.tsx`），所有变更走**函数式更新**：

```tsx
const choose = (option: EventOption) => setRun((current) => {
  if (!current || current.status !== 'running') return current
  ...
  return next
})
```

规矩：

- **一定用 `setRun(current => ...)`**，不要读闭包里的 `run`——抉择会连续触发。
- **数值规则不写在 `App.tsx` 里**，写进 `rules.ts` / `meta.ts` / `events.ts`。
  `App.tsx` 是 tim.lu 的地盘，接入点保持在几行以内，这样两边同时开工也很少撞车。
- 那两个 `useEffect`（阶段挑战插入、通关结算解锁）都靠 `run` 的字段做幂等
  （`settled`、`eventCount` 比对）。它们会在同一次渲染后打断当前事件——
  写 Playwright 脚本时刚读到的按钮可能下一刻就没了，参见 `/v3-balance` 里的处理。

## 全仓库通用

- **UI 逻辑不要拿显示文字做判断。** 用 `HudState.classId` 这类稳定字段。
  之前就因为比较英文职业名，翻译一改就失效。
- `tsconfig` 开了 `strict` + `noUnusedLocals` + `noUnusedParameters`：
  删掉一处引用后，原来的常量会立刻变成编译错误——而且**会连累另外两个游戏发不出去**。
- **写代码要像周围的代码。** v3 的 `App.tsx` 有大量超长单行 JSX，
  别把整个文件重排成自己的风格，改动会因此变得没法 review。
- 没有测试框架。验收靠 `/verify`（类型检查 + 构建 + 无头实跑），v3 数值改动另加 `/v3-balance`。
- 性能上真正要盯的是引擎循环，不是 React 重渲染。加 `memo` / `useMemo` 之前
  先确认那部分真的每帧重渲——HUD 一秒钟更新几次而已。
