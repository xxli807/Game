import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative asset URLs work both in a local production preview and when the
// finished bundle is hosted from the /Game/ GitHub Pages subdirectory.
export default defineConfig({
  base: './',
  plugins: [react()],
})
