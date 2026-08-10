# PRD: Admin Scraper Button + Costs Date Filter

**Date:** 2026-08-10
**Size:** Small
**Status:** Draft

---

## Changes

### FR-1: Run Scraper Button on Coverage Tab

**Trigger:** Admin taps "Run Scraper" button on the Coverage tab, below the existing "Run Discovery" button.

**Behavior:** Calls the `event-scraper` Edge Function with the admin's JWT. The scraper processes all venues with `calendar_url` in batches of 3, returning NDJSON. The frontend reads the stream and shows progress:
- Button: "Scraping..." while running
- Status text: "Scanning venues for events... 15 scraped, 42 events found"
- Updates after each NDJSON `{ type: "venue" }` line
- On stream close (summary line): "Done — 87 events found across 111 venues"
- Refetches coverage metrics (ZERO EVENTS count should decrease)

**Error state:** If the scraper returns 401, show "Auth failed." If the stream errors, show the error and stop. Button returns to "Run Scraper."

**Prerequisite:** The `event-scraper` Edge Function needs CORS headers added (same pattern as venue-discovery) and must be deployed with `--no-verify-jwt`. The function already has dual auth (x-scraper-key OR Bearer JWT).

**Scope boundary:** Does not modify scraper logic. Only adds CORS headers to the Edge Function and a button + stream reader to the frontend.

### FR-2: CORS Headers on Event Scraper

**Trigger:** Deploy change.

**Behavior:** Add the same `ALLOWED_ORIGINS` + `getCorsHeaders()` pattern from venue-discovery to `event-scraper/index.ts`. Apply `cors` headers to all responses (OPTIONS, 401, streaming).

**Files:** `supabase/functions/event-scraper/index.ts`

### FR-3: Costs Tab Date Range Filter

**Trigger:** Admin navigates to Admin → Costs tab.

**Behavior:** A row of pills at the top of the Costs tab: **Today**, **7 Days** (default), **30 Days**, **All Time**. Selecting a pill changes the time window for ALL cost data: summary cards, daily bar chart, by-feature breakdown, by-model breakdown.

The `useCostDashboard` hook accepts a `days` parameter. The pills control this parameter:
- Today: `days = 1`
- 7 Days: `days = 7`
- 30 Days: `days = 30`
- All Time: `days = 3650`

The daily chart adjusts its row count to match the window (1 row for Today, 7 for 7 Days, etc., capped at 30).

**Error state:** None — pills always work.

**Scope boundary:** No new RPCs needed — existing `get_ai_cost_total`, `get_ai_cost_by_model`, `get_ai_cost_by_feature`, `get_ai_daily_cost` already accept `p_days`.

## Architecture

### Prior art

| Pattern | File | Reuse |
|---------|------|-------|
| CORS headers | `supabase/functions/venue-discovery/index.ts` lines 6-19 | Copy exactly |
| NDJSON stream reading | New — but uses standard `response.body.getReader()` | |
| Run Discovery button + progress | `src/pages/Docs.tsx` CoverageTab | Follow same state pattern |
| Cost pills | `src/components/MapTimePills.tsx` | Match pill styling |
| Cost hook | `src/hooks/useCostDashboard.ts` | Add `days` param |

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/event-scraper/index.ts` | Add CORS headers (ALLOWED_ORIGINS + getCorsHeaders + apply to all responses) |
| `src/pages/Docs.tsx` | Add "Run Scraper" button + NDJSON progress in CoverageTab. Add date pills to CostsTab. |
| `src/hooks/useCostDashboard.ts` | Accept `days` param instead of hardcoded values |

### No new files. No database changes.
