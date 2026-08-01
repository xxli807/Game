---
name: tailwind-vite
description: Conventions for Tailwind CSS v4 with Vite via the @tailwindcss/vite plugin. Use when adding/changing Tailwind setup, editing CSS that imports Tailwind, touching vite.config.ts, or debugging why Tailwind classes aren't applying. This repo runs Tailwind v4 + Vite 8 but still has v3-style config — see "Current repo state".
---

# Tailwind CSS v4 + Vite

Adapted from github/awesome-copilot `tailwind-v4-vite.instructions.md` for this repo (Vite 8, `@tailwindcss/vite` v4, MUI as the primary styling layer with Tailwind utilities used sparingly).

## v4 is CSS-first — the key changes

- The `@tailwindcss/vite` plugin replaces the PostCSS-based pipeline. **No `postcss.config.js` needed** for Tailwind.
- **No `tailwind.config.js` needed** — configuration moves into CSS via the `@theme` directive, and content paths are auto-detected.
- The old `@tailwind base; @tailwind components; @tailwind utilities;` directives are **replaced by a single import**:
  ```css
  @import "tailwindcss";
  ```

## Correct v4 setup

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```
```css
/* src/styles/tailwind.css */
@import "tailwindcss";

/* optional theme customization — replaces tailwind.config.js theme.extend */
@theme {
  --color-brand: #1976d2;
}
```
Ensure the CSS file is imported once in the entry (`src/main.tsx`).

## Current repo state (mismatch to be aware of)

This project is **half-migrated** and a cleanup is worthwhile if Tailwind utilities misbehave:

- `vite.config.ts` correctly uses the v4 plugin (`@tailwindcss/vite`). ✅
- `src/styles/tailwind.css` still uses the **v3** `@tailwind base/components/utilities` directives — the v4 plugin expects `@import "tailwindcss";`. ⚠️
- A `tailwind.config.js` (v3-style `content`, `theme.extend`, `corePlugins.preflight: false`, `important: '#root'`) still exists. ⚠️

Two settings in that config exist **on purpose** so Tailwind coexists with MUI, and must be preserved if migrating to CSS-first:
- `preflight: false` — stops Tailwind's reset from fighting MUI's baseline.
- `important: '#root'` — raises Tailwind utility specificity so they can override MUI `sx`.

In v4 these map to CSS:
```css
@import "tailwindcss" important;          /* ~ important: true; scope manually if needed */
/* import only the layers you want to skip preflight, e.g.: */
@layer theme, base, components, utilities; /* then @import "tailwindcss/utilities"; selectively */
```
**Do not migrate this blind.** Preflight-off + MUI interplay is easy to break. If asked to clean it up, change it in a branch, run `yarn build`, and visually check a couple of screens before committing.

## When classes aren't applying
1. Confirm the Tailwind CSS file is imported in `main.tsx`.
2. Confirm `@tailwindcss/vite` is in `vite.config.ts` plugins.
3. Check for the v3/v4 directive mismatch above.
4. Remember `preflight: false` + `important: '#root'` here — utilities only win inside `#root`.

## Don't
- Don't add `autoprefixer`/`postcss` config for Tailwind in v4 — the plugin handles it.
- Don't introduce new `@tailwind` directives — use `@import "tailwindcss";`.
- Don't remove `preflight: false` or `important: '#root'` without checking MUI components still render correctly.
