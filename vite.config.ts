import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// One repo, two games. TARGET picks which game to serve/build:
//   game1 → deployed at /Game/v1/   (dist/v1)
//   game2 → deployed at /Game/v2/   (dist/v2)
// Relative base ('./') keeps asset URLs correct under either subpath; both
// games share the repo-level public/ (arts, etc.).
const target = process.env.TARGET === 'game2' ? 'game2' : 'game1'
const ver = target === 'game2' ? 'v2' : 'v1'
const abs = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig(({ command }) => ({
  root: abs(`./src/${target}`),
  base: command === 'build' ? './' : '/',
  publicDir: abs('./public'),
  build: {
    outDir: abs(`./dist/${ver}`),
    emptyOutDir: true,
  },
  plugins: [react()],
}))
