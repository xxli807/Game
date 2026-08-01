---
name: color-palette
description: Conventions for managing colours in this app via the central palette at src/theme/palette.ts. Use whenever adding or changing a colour anywhere in the UI — MUI `sx` props, `<canvas>` drawing code, CSS gradients, borders, shadows — or when you see a raw hex/rgba literal in a component. All colours must come from the palette; never hardcode them in components.
---

# Colour management

This app keeps **every colour in one file**: [`src/theme/palette.ts`](../../../src/theme/palette.ts). Components, canvas code, and gradients reference named tokens from it instead of hardcoding hex/rgba. This makes the whole colour scheme reviewable and tweakable in one place.

## The rule

**Never write a raw colour literal in a component.** No `'#ef5350'`, no `'rgba(0,0,0,0.4)'`, no `'#ffffff33'` in `.tsx`/`.ts` files. Always reference the palette.

```tsx
import { palette, withAlpha } from '../theme/palette'; // adjust relative depth

// solid colours
sx={{ color: palette.red425, bgcolor: palette.navy500 }}

// colours with opacity -> withAlpha(token, 0..1)
sx={{ boxShadow: `0 4px 16px ${withAlpha(palette.black, 0.4)}` }}

// embedded in a string (border, gradient) -> template literal
sx={{ border: `2px solid ${palette.amber450}` }}
background: `linear-gradient(135deg, ${palette.navy500} 0%, ${palette.purple500} 100%)`

// canvas works too — palette values are plain strings, withAlpha returns rgba()
ctx.fillStyle = palette.white;
ctx.strokeStyle = withAlpha(palette.black, 0.2);

// JSX attribute values need braces
<PlayButton color={palette.teal375} />
```

## How the palette is organised

Colours are grouped by **hue family** and ordered light → dark by a numeric scale suffix (lower = lighter), Tailwind-style. Families: `red, orange, amber, gold, brown, green, teal, cyan, blue, indigo, purple, magenta, pink, slate, navy, gray`, plus `white`/`black`.

```ts
export const palette = {
  white: '#ffffff',
  black: '#000000',
  // Reds / danger
  red25: '#ffcdd2',   // lightest
  red425: '#ef5350',  // the main danger red
  red950: '#1a0000',  // darkest
  // ...
};
```

`navy*` are the dark UI surface backgrounds; `slate*` are the blue-grey neutral text/borders. There is no semantic alias layer (e.g. `danger`) — name tokens by hue+scale and let usage give them meaning.

## Adding or changing a colour

1. **Reusing a shade?** Pick the closest existing token. Browse `palette.ts` by family.
2. **Need a genuinely new shade?** Add it to the right family in `palette.ts`, keeping the scale order roughly monotonic (lighter = lower number). Pick a scale number between its neighbours (the steps are spaced, so there's room, e.g. `green375` between `green350` and `green400`).
3. **Changing the scheme?** Edit the value in `palette.ts` once — every usage updates.
4. Run `yarn build` to typecheck.

## Conventions & gotchas

- `palette` is intentionally **not** `as const` — values are typed `string` so a `let x = palette.a; x = palette.b` reassignment (common for conditional colours) typechecks. Key autocomplete still works.
- `withAlpha(hex, alpha)` only accepts 6-digit hex (all palette values are). It returns an `rgba()` string usable anywhere, including `<canvas>`.
- Don't reach for CSS custom properties (`var(--x)`) for colours: canvas code can't read them, so the TS palette is the single source of truth across `sx` and canvas.
- Keep `palette.ts` import paths relative (this repo has no path alias).

## Verifying no colours leaked out

After any colour work, confirm nothing is hardcoded outside the palette:

```bash
# raw hex in components (should be 0)
grep -rnE "['\"\`][^'\"\`]*#[0-9a-fA-F]{3,8}\b" src --include="*.tsx" --include="*.ts" | grep -v theme/palette.ts
# raw rgb/rgba in components (should be 0)
grep -rnE "rgba?\([0-9]" src --include="*.tsx" --include="*.ts" | grep -v theme/palette.ts
```
