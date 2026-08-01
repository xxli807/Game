---
name: a11y-review
description: Review React/MUI UI for accessibility (WCAG 2.2 AA). Use when the user says "a11y review", "accessibility check", "is this accessible", or after building/changing UI components, forms, animations, or canvas interactions. Adapted for this repo's stack — React 19, MUI 7, dark theme, heavy keyframe/canvas animation, draggable whiteboard, kids audience.
---

# Accessibility Review (WCAG 2.2 AA)

Adapted from github/awesome-copilot `a11y.instructions.md` for this codebase. Review changed components against the checks below. Report findings as **CRITICAL** (blocks merge), **IMPORTANT** (fix this PR), or **SUGGESTION**. Quote the file:line and give the corrected code.

This is a learning app for a young child, so favour large targets, clear focus, and motion that respects user preferences.

## How to run a review

1. `git diff origin/main...HEAD --stat` to find changed `.tsx` files, then read them.
2. Walk each check below against the changed UI. Skip checks that don't apply.
3. Group findings by severity, each with `file:line`, the rule, and a fix.

## The checks (highest-value first for this repo)

### 1. Icon-only buttons need an accessible name — CRITICAL
This repo has many MUI icon usages. A `<Button>` with only an icon (or `<IconButton>`) and no visible text is unreadable by screen readers.
```tsx
// BAD — no accessible name
<IconButton onClick={erase}><EraseIcon /></IconButton>
// GOOD
<IconButton aria-label="Clear whiteboard" onClick={erase}><EraseIcon /></IconButton>
```
Buttons that already have visible text (e.g. the whiteboard "Clear" / "Minimize") are fine. Emoji inside a label (`▶ ASSEMBLE!`) counts as text but add `aria-label` if the emoji carries the only meaning.

### 2. Respect `prefers-reduced-motion` — IMPORTANT
The login screen runs infinite animations (`shieldSpin`, `reactorPulse`, `titleBob`) and an animated canvas; sections use hover scale transforms. Vestibular users need an opt-out (WCAG 2.3.3).
```tsx
<style>{`
  @keyframes shieldSpin { /* ... */ }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
`}</style>
```
For the canvas `requestAnimationFrame` loop, check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and render a single static frame instead of looping.

### 3. Colour contrast on the dark theme — IMPORTANT
Text must hit 4.5:1 (3:1 for large/bold ≥18pt). Watch low-opacity greys on dark backgrounds — `#78909c`, `#90a4ae`, and `rgba(255,255,255,0.x)` hint text often fail. Never rely on colour alone to signal correct/incorrect — this repo already pairs a `CheckIcon`/`WrongIcon` with text, which is the correct pattern; keep it.

### 4. Form controls need labels — IMPORTANT
MUI `TextField label="…"` is good. A bare `<Select>` needs an associated label or `aria-label` (e.g. the math answer dropdowns, science year/topic selectors).
```tsx
<Select aria-label="Choose your answer" value={...}>…</Select>
```

### 5. Target size ≥ 24×24 px (kids audience → aim 44×44) — SUGGESTION
Small `size="small"` buttons with `py: 0.3` can fall under the minimum. Give interactive controls enough padding/spacing.

### 6. Keyboard operability — IMPORTANT
- Every interactive element reachable and operable by keyboard (Tab/Enter/Space). Prefer native `<button>`/MUI `Button` over `onClick` on a `<Box>`/`<div>`.
- The draggable whiteboard is mouse/touch only. Dragging is non-essential (it's a decorative position), so this is acceptable, but the open/erase/minimize actions must be keyboard-reachable buttons (they are). Don't add drag as the *only* way to do something meaningful.
- Don't remove the focus ring. If custom `sx` overrides outlines, add a visible `:focus-visible` style (WCAG 2.4.7).

### 7. Don't put `aria-hidden` on focusable elements, and prefer native semantics — CRITICAL
Use `<button>` not `<div role="button">`. Don't `aria-hidden="true"` a focusable node.

### 8. Page has a title and a single `<h1>` per view — SUGGESTION
Each route/view should have a clear heading hierarchy; decorative emoji headings should still be real `<Typography variant="h*">`.

## Output format
```
## Accessibility Review

### CRITICAL
- `src/components/Foo.tsx:42` — Icon-only button has no accessible name. Add `aria-label="…"`.

### IMPORTANT
- ...

### SUGGESTION
- ...

No issues found in: <files reviewed with no problems>
```

## Don't
- Don't rewrite components wholesale — report findings and the minimal fix unless asked to apply them.
- Don't invent issues to pad the list; "No issues found" is a valid result.
- Don't target WCAG 3.0 — it's still a draft; target 2.2 AA.
