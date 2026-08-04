import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// One repo, three games. TARGET picks which game to serve/build:
//   game1 → deployed at /Game/v1/   (dist/v1)
//   game2 → deployed at /Game/v2/   (dist/v2)
//   game3 → deployed at /Game/v3/   (dist/v3)
// Relative base ('./') keeps asset URLs correct under either subpath; both
// games share the repo-level public/ (arts, etc.).
const targets = ['game1', 'game2', 'game3'] as const
type Target = (typeof targets)[number]
const abs = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig(({ command, mode }) => {
  const requestedTarget = process.env.TARGET ?? process.env.npm_config_target ?? process.argv.find((arg) => targets.includes(arg as Target)) ?? mode
  const target: Target = targets.includes(requestedTarget as Target) ? requestedTarget as Target : 'game1'
  const ver = `v${target.slice(-1)}`
  return {
  root: abs(`./src/${target}`),
  base: command === 'build' ? './' : '/',
  publicDir: abs('./public'),
  build: {
    outDir: abs(`./dist/${ver}`),
    emptyOutDir: true,
  },
  plugins: [react()],
  }
})
