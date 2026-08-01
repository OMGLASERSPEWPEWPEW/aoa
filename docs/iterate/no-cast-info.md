# No Cast Info on Event Detail

**Category:** feature
**Status:** pending
**Phase:** 1
**Priority:** P2

## User's Original Request
> When we click on an event like Infinite Watch, and we go in, I don't see any actors and such the cast.

## Diagnosis
The design spec (README.md §3.3 line 230) calls for "THE COMPANY" section on ProductionDetail: row of 56px circular headshots with names in Newsreader 12.5px, trailing "+2 · ALL ENSEMBLE" in Courier Prime 10.5px, cap at three faces.

Currently: no cast column in events table, scraper doesn't extract cast, ProductionDetail.tsx doesn't render it. Only playwright/director credit exists (lines 135-147).

**Depends on:** scraper-data-completeness.md (cast must be scraped first)

**Files involved:**
- `src/pages/ProductionDetail.tsx` — add "THE COMPANY" section
- `src/lib/types.ts` — Event type needs cast_members field
- Schema + scraper changes handled by scraper-data-completeness.md

## Graph

### Node 1: explore
- **Loop:** discover → assess
- **Output:** diagnosis section above
- **Tokens:** in / out / $

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. After scraper-data-completeness delivers cast data to DB
  2. Add cast_members to Event type in src/lib/types.ts
  3. Add "THE COMPANY" section to ProductionDetail.tsx after the play credit block
  4. Style per design spec: 56px circles, Newsreader 12.5px names, cap at 3
- **Files:** src/pages/ProductionDetail.tsx, src/lib/types.ts
- **Tokens:** in / out / $

### Node 3: test
- **Loop:** write tests → run → fix failures
- **Tests:** e2e test for cast section rendering on ProductionDetail
- **Tokens:** in / out / $

### Node 4: verify
- **Loop:** build → dev-server → visual confirm cast shows on event detail
- **Tokens:** in / out / $

## Commit
- **Hash:**
- **Message:**
- **Version:**

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| | user | request | No cast info shown on event detail page |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | | | |
| implement | | | |
| test | | | |
| verify | | | |
| **Total** | | | |
