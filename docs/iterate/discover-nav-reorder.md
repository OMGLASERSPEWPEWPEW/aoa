# Discover Page + Nav Reorder

**Category:** feature
**Status:** pending
**Phase:** 3
**Priority:** P1

## User's Original Request
> In the bottom nav bar, we don't have the discover page. Let's have the colored center button be 'my shows' and so the my shows icon in the bottom nav bar is 'discover' instead. Is the discover page specced out like in the design doc?

## Diagnosis
Current Navigation.tsx (lines 3-8) has 4 tabs + 1 center FAB:
- Slot 1: TONIGHT
- Slot 2: MAP
- Slot 3: FAB (gold, hardcoded to `/app/watchlist`)
- Slot 4: MY SHOWS
- Slot 5: YOU

Discover.tsx page EXISTS and is routable at `/app/discover`, but has no nav tab.

The design spec (README.md lines 112-130) keeps the current 5-slot layout with Discover reachable from "search in the Tonight masthead" rather than a dedicated nav slot. But the user wants a different arrangement:
- Center FAB → MY SHOWS
- Old MY SHOWS slot → DISCOVER

The FAB currently navigates to `/app/watchlist` (same as MY SHOWS). The user wants it to be the primary My Shows entry point with a distinctive colored button, and the old slot becomes Discover.

**Root cause:** Discover not in nav, FAB not serving the right purpose.

**Files involved:**
- `src/components/Navigation.tsx` — reorder tabs, change FAB destination
- `src/pages/Discover.tsx` — verify it's fully functional

## Graph

### Node 1: explore
- **Loop:** discover → assess
- **Output:** diagnosis section above
- **Tokens:** in / out / $

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. Navigation.tsx: change tabs array:
     - Slot 1: TONIGHT `/app`
     - Slot 2: MAP `/app/map`
     - Slot 3: FAB → MY SHOWS `/app/watchlist` (gold center button)
     - Slot 4: DISCOVER `/app/discover` (replaces old MY SHOWS slot)
     - Slot 5: YOU `/app/profile`
  2. Update FAB to navigate to `/app/watchlist` with "MY SHOWS" purpose
  3. Verify Discover page renders correctly
- **Files:** src/components/Navigation.tsx
- **Tokens:** in / out / $

### Node 3: test
- **Loop:** write tests → run → fix failures
- **Tests:** e2e for nav tab order, routing, FAB behavior
- **Tokens:** in / out / $

### Node 4: verify
- **Loop:** build → dev-server → verify all 5 nav destinations work
- **Tokens:** in / out / $

## Commit
- **Hash:**
- **Message:**
- **Version:**

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| | user | request | Add Discover to nav, center button = My Shows |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | | | |
| implement | | | |
| test | | | |
| verify | | | |
| **Total** | | | |
