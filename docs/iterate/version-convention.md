# Version Convention Wrong

**Category:** change
**Status:** complete
**Phase:** 4
**Priority:** P3

## User's Original Request
> Right now our version in the app is not following the convention we follow in Glyffiti. This should be fixed in this app but also in the /new-app skill in /development/patterns and in this project.

## Diagnosis
Current version display in Header.tsx (line 31): `v{__APP_VERSION__}` with build timestamp (e.g., "v0.4.4 · Aug 1, 2026"). Vite injects `__APP_VERSION__` from package.json and `__BUILD_TIME__` at build time.

The Glyffiti project was not found at `~/Development/glyffiti/` so the exact convention difference is unknown. The user says it's wrong, which means the format, placement, or behavior differs from their preferred standard.

**Root cause:** Version display doesn't match the user's preferred convention (Glyffiti's pattern). Need user clarification on what Glyffiti does differently.

**Files involved:**
- `src/components/Header.tsx` line 31 — update version display format
- `~/Development/patterns/claudeskills/new-app/skill.md` — update version convention in scaffold
- `~/.claude/skills/new-app/skill.md` — keep in sync

## Graph

### Node 1: explore
- **Loop:** discover → assess → ask user
- **Steps:** Find Glyffiti's version display (may be at different path), compare format
- **Output:** diagnosis section above
- **Tokens:** in / out / $

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. Identify Glyffiti's version convention (ask user if project not found)
  2. Update Header.tsx version display to match
  3. Update /new-app skill to scaffold the correct convention
  4. Sync both skill locations
- **Files:** src/components/Header.tsx, ~/Development/patterns/claudeskills/new-app/skill.md, ~/.claude/skills/new-app/skill.md
- **Tokens:** in / out / $

### Node 3: test
- **Loop:** write tests → run → fix failures
- **Tests:** verify version renders correctly in Header
- **Tokens:** in / out / $

### Node 4: verify
- **Loop:** build → dev-server → confirm version format matches Glyffiti
- **Tokens:** in / out / $

## Commit
- **Hash:**
- **Message:**
- **Version:**

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| | user | request | Version convention should match Glyffiti |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | | | |
| implement | | | |
| test | | | |
| verify | | | |
| **Total** | | | |
