# Plan: "Sword of the Depths" → a story-driven roguelite that stands out

## Context
Mechanically the game is a solid Vampire-Survivors-style run — which is the problem: that market is flooded. The differentiator the user wants is a **story**, delivered so a tired commuter gets a satisfying bite each trip and *wants tomorrow's beat*. Survivors normally have no narrative; a run-based story works with the **"Hades model"**: the menu becomes a *place* you return to, **death is part of the plot**, and the story unspools in short beats across runs.

**Creative direction (locked):** tone = **snarky & heartfelt**; narrator = **a talking sword that holds your fallen comrade**; core = **reclaim your fallen kingdom**; run = **a hybrid descent you can win** + **ascension tiers**; platform = **phone-first, installable & offline**.

## Repository layout — keep `game1`, build `game2`
This story redesign ships as a **separate second game** so the working game stays untouched and risk-free (and clear of tim.lu's ongoing work on the current game).

**Structure** — each game is a self-contained mini-app:
- `src/game1/` — the current game (`index.html` + `main.tsx` + `App.tsx` + `game/` + `components/` + `styles.css`), moved as-is.
- `src/game2/` — the new story game (this plan). **Starts as a copy of `game1`**, then evolves.
- `public/arts/` — shared static assets served by both; any `game2`-only assets go in `public/game2/`.

**Build & deploy — both ship on every push, at clean subpaths**
- Deploy paths: **`game1 → /Game/v1/`** and **`game2 → /Game/v2/`** (plus an optional launcher at `/Game/` linking both).
- `vite.config.ts` is env-driven (`TARGET=game1|game2` → `root: src/<target>`, `base: /Game/v1|v2/`, `build.outDir: dist/v1|v2`, shared repo `publicDir`). `npm run build` runs vite **twice** (once per target) into `dist/v1` + `dist/v2`.
- `.github/workflows/deploy.yml` builds **both** on every push, assembles one `dist/` (`v1/`, `v2/`, launcher `index.html`), and uploads once to Pages — a single push publishes both. (An optional `workflow_dispatch` `target` input can still rebuild just one.)
- **Feasibility: yes.** Each game's own `base` makes its asset URLs resolve correctly under its subfolder; GitHub Pages serves the whole `dist/`. No extra hosting or second repo needed.

**Benefit:** because `game2` has its own `game/` module, the story overhaul **cannot clobber `game1`/tim.lu's code** — the coordination risk drops to just the shared `public/arts` + repo config.

## Narrative is the spine
Story is not a phase — it threads through audio (Cael's voice + reactive music), challenge (each layer is a chapter; the final boss is the climax), and retention (you return to the campfire to hear what happens next and reclaim more of Aldermere). Everything below serves that.

### Story bible (starter — names are placeholders, easy to rename)
- **The realm:** *Aldermere*, the sunlit kingdom, hollowed out by **the Hollowing** — a rot from the Depths that emptied its people into "the Hollow" (the enemies).
- **You:** the last of the **Oathbound**, the royal guard sworn to the throne. You cannot stay dead while the oath is unfulfilled.
- **Cael — the sword, your narrator:** a **fellow Oathbound who swore the oath at your side and fell beside you**; his spirit caught in the blade you now carry. Snarky, grieving, fiercely loyal. Every death he hauls you back to **the Last Ember** (Aldermere's final unhollowed spark): *"we're not done."*
- **The descent (reframes the 4 biomes as layers):** Sunken Keep (dungeon) → Rotwood (forest) → Frozen Vaults (snow) → Molten Heart (volcano).
- **Layer-lords = fallen champions you both knew** — story beats, not just HP bars: *Sir Roderin, the First to Fall* (knight-commander who knighted you both); *Maren the Green* (ranger-warden); *Archivist Yll* (court mage); then the **Hollow King** on the corrupted throne — the climax. Reclaim = lay them to rest and retake the throne.
- **Sample voice (snarky & heartfelt, comrade dynamic):**
  - Opening — *"Up you get. We swore this oath together, remember? Not letting you break it alone. Ninth time's the charm."*
  - Enter Rotwood — *"The queen's gardens. We trained here. Gods, look at it now. Keep moving."*
  - Boss intro — *"Roderin. He knighted us both, and they got him too. …Try not to enjoy this. I mean it, a little."*
  - Low HP — *"Bleeding out is a TERRIBLE look on you. I am NOT doing this alone — MOVE."*
  - Evolve a skill — *"Now THAT'S old Aldermere steel. Just like the drills. Feels good, doesn't it?"*
  - Death → hub — *"Back to the Ember. I know. I hate it too. Rest — then we finish what we started. Together."*
  - Victory — *"It's done. The throne's ours to give back. We did it — like we always said we would."*

## Design principles
- **Text-driven & self-contained:** authored text (cheap, offline, no voice files); procedural Web Audio (no downloaded sound) — plays on a signal-less train and caches as a PWA.
- **Incremental & deployable:** each phase ships on its own (auto-deploys to GitHub Pages on push to `main`); the user playtests on their phone after every phase.
- **Reuse existing systems:** `shake()`, `flash`, `floatText()`, `rings`/`particles`, `damageEnemy()`, `activateSkill()`, `doLevelUp()`, `endRun()`, `scale()`, `spawnEnemy()`, `spawnMegaBoss()`, `regionAt()`/`drawFloor()` biome theming, `emit()`, and the `HudState`/`MetaState`/`loadMeta`/`saveMeta` pipeline.

## ⚠️ Team coordination note
The `game1`/`game2` split mostly removes the clobber risk: all story work happens inside `src/game2/`, which has its own copy of `types.ts`/`meta.ts`/`App.tsx`/`MetaScreen.tsx`, so **tim.lu keeps owning `game1` and we own `game2`** with no code collisions. Only the shared `public/arts` and repo config (`vite.config.ts`, `deploy.yml`) are common — coordinate on those. Before the split, grab tim.lu's latest so `game1` starts from a green build.

---

## Phase 0 — Split into `game1` / `game2` (do first)
Move the current app into a self-contained `src/game1/` (own `index.html` + `main.tsx`); duplicate it to `src/game2/`; make `vite.config.ts` env-driven per target; add the two-pass build (`dist/v1` + `dist/v2`) + a root launcher; update `deploy.yml` to build both and publish **`/Game/v1/`** and **`/Game/v2/`** on every push. Verify `npx tsc --noEmit && npm run build` and that both URLs load. Every phase below targets `src/game2/` only.

## Phase 1 — Voice & Vibe (the differentiator, felt in 30 seconds)
Make it *a story game* immediately.
- **Talking-sword dialogue system** — new `src/game/story.ts` (opening, `BEATS` with trigger + lines + `once`, boss intros, biome titles, endings) + `src/components/Dialogue.tsx` (bottom dialogue box: speaker "CAEL" + text, tap/click to advance; ember/parchment styling).
- **Event hooks** — engine fires story events via an `onStory` callback in `Opts`: `run-start`, `layer-enter` (titled card, e.g. "II · THE ROTWOOD"), `boss-intro`, `low-hp`, `evolve` (in `levelUpOptions`), `revive`/`death`, `layer-cleared`, `win`. `src/App.tsx` maps event → beat and shows `Dialogue`.
- **Campfire hub** — reframe `MetaScreen` as **the Last Ember**: the sword in the ground, the ember, a one-line "chapter so far" recap, **▶ Descend**. Beats gated by `MetaState.chapter`/`seenBeats`.
- **Procedural audio** — new `src/game/audio.ts` (`AudioKit`): SFX (hit, crit, kill, pickup, level-up, cast, evolve, boss-roar, hurt, victory, death, ui) + a light reactive music bed + persisted mute; init `AudioContext` on the **Descend** gesture in `App.tsx`.
- **PWA + mobile** — `vite-plugin-pwa` in `vite.config.ts` (manifest + icons in `public/`, respect `base:'/Game/'`; precache app shell + `public/arts/*`); confirm `index.html` viewport + theme-color. Installable & offline.
- *MetaState adds:* `chapter`, `seenBeats: string[]`.

## Phase 2 — The Descent (challenge + climax)
Give the run a shape and an end that pays off the story.
- **Hybrid descent (open arena per layer)** — each layer is an open survival arena themed to one biome. After a per-layer objective (survive a timer / clear a quota), the named **layer-lord** appears (Cael intro); defeating it **collapses the floor** — a short transition (crack + `shake()`/`flash`/fade + a Cael line) drops you to the next, deeper layer, re-theming the arena (single-biome override of today's 2×2 theming via the `regionAt`/`drawFloor` path) and raising difficulty. Four layers, then the Hollow King. Keeps the swarm feel; delivers a clear, story-shaped descent.
- **Win condition** — new `GameStatus 'victory'`; defeating the **Hollow King** at the Molten Heart → victory epilogue overlay in `App.tsx` + big coin reward. A run is beatable in ~12 min.
- **Ascension tiers** — "the Depths deepen": `Opts.ascension` feeds `scale()` + spawn rates (more enemy HP/dmg/speed, more elites, faster leveling, less healing). Persist `MetaState.maxAscension`; tier picker at the Ember; each tier win advances the plot.
- **Boss mechanics** — small state machine with **telegraphed** attacks (warning ring → AoE via `rings`/`meteors`; projectile fan via the ranged path) for layer-lords + the Hollow King.
- **Combo + hit-stop juice** — kill-streak multiplier (`comboCount`/`comboTimer`, boosts gold/XP, escalates SFX pitch) shown in `HUD.tsx`; tiny hit-stop on crits/boss hits/evolves in the `loop`.

## Phase 3 — Reclamation (retention + endings)
Reasons to return, tied to the story.
- **Coins + permanent upgrades at the Ember** — expand `MetaState` (`coins`, `upgrades`, `achievements`, `endingsSeen`); `META_UPGRADES` + `statsFromMeta(meta, baseStats())` in `types.ts`; `App.tsx` passes `statsFromMeta(meta)` and awards coins on run end. Upgrade panel on `MetaScreen` (max HP, damage, move speed, luck, starting level, one revive) — framed as "rekindling Aldermere."
- **Achievements** — story-flavored ("Lay Roderin to rest", "Reach the Heart", "No-hit the Hollow King"); award coins + a Cael toast.
- **Daily Challenge** — new `src/game/rng.ts` seedable PRNG (mulberry32) seeded by date; route run-defining rolls (`spawnEnemy` kind, `buildChoices`, sword style, elites) through `this.rng`; "Today's Descent" at the Ember + `dailyBest` by `YYYYMMDD`.
- **Multiple endings** — gated by ascension: a bittersweet first victory → the **true reclamation** ending after the final tier, resolving Cael's arc (`endingsSeen`).

## Phase 4 — Polish & stretch
- Mobile one-handed tuning in `styles.css` (bigger touch targets, safe-area insets, block pinch/scroll, portrait); optional **auto-cast** toggle for tired one-thumb play.
- Stretch: a simple **Cael portrait** in the dialogue box; **hub NPCs** (other survivors at the Ember); risk/reward **curse altars**; extra **Oathbound heroes** (distinct starting skill + stats).

---

## Verification (per phase, on the deployed build)
- `npx tsc --noEmit && npm run build` after each change set.
- Playwright headless (existing `_*.mjs` + dev-server flow): start a run, assert no console errors, screenshot: opening dialogue + Ember hub + a layer title card (P1); layer-lord telegraph + floor-collapse + victory overlay + ascension picker + combo meter (P2); coin reward + upgrade panel + Daily button (P3).
- **Audio** needs a real gesture — confirm SFX after the Descend click, then verify audibly in a real browser.
- **PWA/offline** — after deploy, on a phone: Add to Home Screen → airplane mode → still launches and plays. Lighthouse PWA pass.
- Push each phase to `main`, wait for the Pages deploy to go green, hard-refresh on device.
