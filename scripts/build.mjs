// Build both games into one dist/ for GitHub Pages:
//   dist/index.html  → launcher (served at /Game/)
//   dist/v1/         → game1    (served at /Game/v1/)
//   dist/v2/         → game2    (served at /Game/v2/)
import { execSync } from 'node:child_process'
import { copyFileSync, rmSync } from 'node:fs'

const run = (cmd, env = {}) =>
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } })

// Start from a clean dist so no stale files linger between builds.
rmSync('dist', { recursive: true, force: true })

// Type-check both games once (tsconfig includes all of src/).
run('tsc --noEmit')

// Build each game with its own root/outDir (see vite.config.ts).
run('vite build', { TARGET: 'game1' })
run('vite build', { TARGET: 'game2' })

// Drop the launcher at the site root.
copyFileSync('launcher.html', 'dist/index.html')

console.log('\n✓ built dist/index.html (launcher) + dist/v1 + dist/v2')
