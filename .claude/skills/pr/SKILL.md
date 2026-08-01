---
name: pr
description: Create a pull request with a high-quality description for the current branch. Use when the user says "raise a PR", "open a PR", "create a pull request", or types /pr. Inspects the branch diff against main and writes a Summary + Test Plan tailored to what actually changed.
---

# Create a Pull Request

Generate a focused, accurate PR description for the current branch — never a generic template. Read the actual diff first; the description must describe what really changed.

## Steps

Run these in parallel up front:

```bash
git status
git fetch origin main
git log origin/main..HEAD --oneline
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
gh repo view --json defaultBranchRef -q .defaultBranchRef.name   # confirm base branch name
```

If `gh` returns no remote tracking, ask the user before pushing. If the branch has no upstream, push with `git push -u origin HEAD` first.

If `git status` is dirty, stop and ask whether to commit those changes into the PR or leave them aside.

## Writing the Title

- Lowercase, imperative, **under 70 characters**. Match this repo's style: `improve the math sections`, `update GitHub Actions to Node.js 24`, `fix GitHub Pages deployment by enabling Pages via workflow`.
- Lead with a verb: `add` (new feature), `update` (enhance existing), `fix` (bug), `refactor`, `remove`.
- No conventional-commit prefixes (`feat:`, `chore:`) — this repo doesn't use them.
- If the branch has one commit and its message already follows the style, reuse it verbatim.

## Writing the Body

Use this skeleton and fill from the actual diff:

```markdown
## Summary
- <what changed, framed by user-visible impact, not implementation>
- <second bullet only if there's a distinct change>
- <third bullet only if needed — three is the ceiling, not the goal>

## Test Plan
- [ ] <concrete action that exercises the change>
- [ ] <edge case worth poking>
- [ ] `yarn build` passes
```

Add these sections **only when warranted**:

- `## Breaking Changes` — when public API, DB schema, env vars, or CLI flags change in a non-backwards-compatible way
- `## Screenshots` — for UI changes; write `<add screenshot>` as a placeholder for the user to fill in
- `## Migration` — when consumers need to do something to adopt (rerun migration, set new env var, etc.)
- `## Related` — link issues or prior PRs by number when relevant

Skip sections that don't apply. A two-bullet summary + one-line test plan is fine for small PRs.

## Rules for the Summary

- Frame as outcome, not changeset: "math section now mixes standard/advanced/challenge in one tab" beats "modified MathSection.tsx to combine difficulty levels".
- Don't enumerate every file — that's what the diff is for.
- Don't restate the obvious from the title.
- Mention motivation only when non-obvious from the change itself.

## Rules for the Test Plan

- Each item must be something a reviewer can actually do — "open `/math` and switch tabs" not "verify it works".
- Always include `yarn build` since this repo has no test suite.
- For UI changes, include the navigation path: "log in → dashboard → math → competitions tab".
- For routing/auth changes, include the negative path: "log out → confirm redirect to `/login`".

## Creating the PR

Use HEREDOC so multi-line markdown isn't mangled:

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
- ...

## Test Plan
- [ ] ...

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL to the user when finished.

## Don't

- Don't invent test steps you didn't derive from the diff.
- Don't write `## Changes` listing every file — the diff already shows that.
- Don't force a "Why" section when the title already conveys it.
- Don't push to `main` directly — confirm the branch name first.
- Don't bypass hooks (`--no-verify`) unless the user asks.
