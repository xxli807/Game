// 让任何验收脚本改用真实 GPU 跑（macOS Metal）：
//   node --import ./.claude/skills/verify/gpu.mjs .claude/skills/verify/smoke.mjs
// 默认的无头 Chromium 用 SwiftShader 在 CPU 上渲染 WebGL。v3 的 3D 世界与逐鹿越来越重，
// 在 CPU 上首帧可能要一分多钟，smoke / v3-battle-ui 会因 30 秒超时而失败——那不是代码坏了。
import { chromium } from 'playwright'
const launch = chromium.launch.bind(chromium)
chromium.launch = (options = {}) => launch({ ...options, args: [...(options.args ?? []), '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
