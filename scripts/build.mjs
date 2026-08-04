// Build all games into one dist/ for GitHub Pages:
//   dist/index.html  → launcher (served at /Game/)
//   dist/v1/         → game1    (served at /Game/v1/)
//   dist/v2/         → game2    (served at /Game/v2/)
//   dist/v3/         → game3    (served at /Game/v3/)
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
run('vite build', { TARGET: 'game3' })

// Drop the launcher at the site root.
copyFileSync('launcher.html', 'dist/index.html')
// 404 handler forwards any other spelling to the canonical path — /Game/V2,
// /Game/game2 etc. all land on /Game/v2. (Duplicating the folders instead would
// break on case-insensitive filesystems like macOS, and double the artifact.)
copyFileSync('404.html', 'dist/404.html')

console.log('\n✓ built dist/index.html (launcher) + dist/v1 + dist/v2 + dist/v3')
