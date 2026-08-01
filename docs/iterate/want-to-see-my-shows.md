# Want to See Buggy + My Shows Gaps

**Category:** bug
**Status:** complete
**Phase:** 2
**Priority:** P1

## User's Original Request
> 'Want to see' doesn't seem to work or at least it seems slow or buggy. But it did work and in my shows that lists want to see, booked and seen... we don't have the dates on the left side as in the design spec 1b - my shows - the ledger. I don't have an easy way to get back to 1a my shows - the marquee from 1b.

## Diagnosis
Three sub-issues:

**A) Want to See button:** useWatchlist.ts has optimistic UI (lines 37-40) — state updates immediately before the Supabase round-trip. Should feel instant. If it feels slow, the issue may be that the UI doesn't provide visual feedback (no animation, no state change indicator). The button in TonightHero.tsx toggles between "Want to see" and "View show" based on status.

**B) Dates in ledger:** The ledger view (Take B) DOES show dates — MyShows.tsx lines 222-223 extract `seen_date` as day-of-month, rendered in a 34px first column (line 234). However, this only works for the "seen" tab. The "want" and "booked" tabs may not show dates because those items don't have a `seen_date`.

**C) No marquee view (Take A):** Only the ledger view exists. The design spec (§3.2) defines two takes: Take A "The Marquee" with poster cards, and Take B "The Ledger" with month-grouped rows. No toggle or navigation between them exists.

**Root cause:** Missing Take A view, incomplete date display for non-seen tabs, and possibly insufficient button feedback.

**Files involved:**
- `src/pages/MyShows.tsx` — add Take A view, add view toggle, fix dates for all tabs
- `src/hooks/useWatchlist.ts` — verify optimistic UI works correctly
- `src/components/TonightHero.tsx` — verify button state change feedback

## Graph

### Node 1: explore
- **Loop:** discover → assess
- **Output:** diagnosis section above
- **Tokens:** in / out / $

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. Add view toggle (marquee/ledger) to MyShows header
  2. Build Take A "marquee" view with poster cards per design spec §3.2.1
  3. Fix date column: show `created_at` date for "want" tab, booking date for "booked" tab
  4. Add visual feedback to "Want to see" button (brief animation or state change)
- **Files:** src/pages/MyShows.tsx, src/components/TonightHero.tsx
- **Tokens:** in / out / $

### Node 3: test
- **Loop:** write tests → run → fix failures
- **Tests:** e2e for view toggle, date display per tab, button feedback
- **Tokens:** in / out / $

### Node 4: verify
- **Loop:** build → dev-server → test all three tabs in both views
- **Tokens:** in / out / $

## Commit
- **Hash:**
- **Message:**
- **Version:**

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| | user | request | Want to See buggy, dates missing, no marquee view |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | | | |
| implement | | | |
| test | | | |
| verify | | | |
| **Total** | | | |
