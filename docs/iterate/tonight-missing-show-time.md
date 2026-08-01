# Tonight Missing Show Date/Time

**Category:** bug
**Status:** pending
**Phase:** 1
**Priority:** P1

## User's Original Request
> On the tonight page, we're missing the date and time of the show. Are we even storing the time? We need to if we're not.

## Diagnosis
Good news: `show_times` data IS stored in the database as jsonb (e.g., `{"thu": ["19:30"], "fri": ["19:30", "22:00"]}`). The scraper extracts it. The `isUpTonight()` function uses it to determine which events play tonight. The problem is purely UI — neither TonightHero.tsx nor TonightFree.tsx render the actual curtain time.

**Root cause:** The Tonight page components display price, venue, and description but never extract or display today's show time from the `show_times` jsonb field.

**Files involved:**
- `src/components/TonightHero.tsx` — add curtain time display
- `src/components/TonightFree.tsx` — add time to event list items
- `src/lib/tonight.ts` — add helper to extract today's times from show_times

## Graph

### Node 1: explore
- **Loop:** discover → assess
- **Output:** diagnosis section above
- **Tokens:** in / out / $

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. Add `getTonightTimes(show_times)` helper to `src/lib/tonight.ts` — returns today's times as formatted strings
  2. TonightHero: display curtain time in the venue line (e.g., "STEPPENWOLF · THEATER · 7:30 PM")
  3. TonightFree: append time after venue name
- **Files:** src/lib/tonight.ts, src/components/TonightHero.tsx, src/components/TonightFree.tsx
- **Tokens:** in / out / $

### Node 3: test
- **Loop:** write tests → run → fix failures
- **Tests:** unit test for getTonightTimes helper, e2e for Tonight page time display
- **Tokens:** in / out / $

### Node 4: verify
- **Loop:** build → dev-server check → visual confirm
- **Tokens:** in / out / $

## Commit
- **Hash:**
- **Message:**
- **Version:**

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| | user | request | Tonight page missing show date/time |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | | | |
| implement | | | |
| test | | | |
| verify | | | |
| **Total** | | | |
