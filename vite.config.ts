import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base is '/Game/' for the GitHub Pages build, '/' for local dev
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Game/' : '/',
  plugins: [react()],
}))
