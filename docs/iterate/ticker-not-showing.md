# Ticker Not Showing

**Category:** bug
**Status:** pending
**Phase:** 2
**Priority:** P1

## User's Original Request
> The ticker is not showing up in the app.

## Diagnosis
MarqueeTicker.tsx exists and renders unconditionally in Tonight.tsx (line 123-127). No CSS hiding, no conditional render. The component accepts `tonightCount`, `under20Count`, `openingsCount` and displays them in a scrolling marquee.

The ticker IS rendering — but if all three counts are 0, the marquee shows "0 curtains up tonight · 0 under $20 · 0 openings" which may look blank or empty depending on styling. The real issue is likely that `isUpTonight()` filters out all events for the current day (either no events have today's day-of-week in show_times, or date range doesn't include today).

**Root cause:** Either (a) no events in DB match today's date/day, so counts are 0 and the ticker appears empty, or (b) the ticker height/visibility is too subtle to notice. Need to verify with actual data.

**Files involved:**
- `src/components/MarqueeTicker.tsx` — check rendering with 0 counts
- `src/lib/tonight.ts` — verify isUpTonight logic
- `src/pages/Tonight.tsx` lines 34, 48 — count calculation

## Graph

### Node 1: explore
- **Loop:** discover → assess → check live data
- **Steps:** Query events table for today's date/day, run isUpTonight against them, check if counts > 0
- **Output:** diagnosis section above
- **Tokens:** in / out / $

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. Verify ticker renders visibly even with 0 counts (dev server check)
  2. If counts are 0 due to no matching events: ensure scraper populates show_times correctly
  3. If ticker renders but is invisible: fix height/padding/color contrast
  4. Consider: show ticker only when counts > 0, or show "No shows tonight" message
- **Files:** src/components/MarqueeTicker.tsx, src/lib/tonight.ts
- **Tokens:** in / out / $

### Node 3: test
- **Loop:** write tests → run → fix failures
- **Tests:** unit test for MarqueeTicker with various count values, e2e for ticker visibility
- **Tokens:** in / out / $

### Node 4: verify
- **Loop:** build → dev-server → visual confirm ticker is visible
- **Tokens:** in / out / $

## Commit
- **Hash:**
- **Message:**
- **Version:**

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| | user | request | Ticker not showing up in the app |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | | | |
| implement | | | |
| test | | | |
| verify | | | |
| **Total** | | | |
