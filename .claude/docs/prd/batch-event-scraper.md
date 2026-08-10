# PRD: Batch Event Scraper

**Date:** 2026-08-10
**Size:** Small
**Status:** Draft

---

## Problem

The event-scraper Edge Function processes ALL venues in one call with NDJSON streaming. With 135 venues, it runs for minutes. iOS Safari doesn't support streaming fetch responses — the browser buffers the entire response and the user sees "0 scraped, 0 events" until it finishes (or times out). Same problem we solved for enrichment.

## Solution

New `event-scrape-batch` Edge Function that processes **3 venues per call** and returns plain JSON: `{ scraped, events_found, events_created, remaining }`. Frontend loops from the "Run Scraper" button until `remaining = 0`. Proven pattern — identical to venue-enrich.

A `scraped_at` column on `venues` tracks when each venue was last scraped. The batch endpoint picks the 3 oldest-scraped (or never-scraped) venues each call.

## Functional Requirements

### FR-1: event-scrape-batch Edge Function

**Trigger:** POST to `/functions/v1/event-scrape-batch` with admin JWT or `x-scraper-key`.

**Behavior:**
1. Query `venues` for 3 rows where `calendar_url IS NOT NULL`, ordered by `scraped_at ASC NULLS FIRST` (never-scraped first, then oldest).
2. For each venue, call the existing `processVenue(venue, runId)` function from `event-scraper/index.ts`. This fetches the venue's calendar page, sends it to DeepSeek V4 Flash, and upserts events.
3. After processing each venue, update `venues.scraped_at = now()` for that venue.
4. Count remaining: `SELECT count(*) FROM venues WHERE calendar_url IS NOT NULL AND (scraped_at IS NULL OR scraped_at < now() - interval '1 day')`.
5. Return JSON: `{ scraped: N, events_found: M, events_created: C, remaining: R }`.

**Error state per venue:** `processVenue()` already handles errors internally — it catches fetch failures, DeepSeek API errors, and parse errors, logs them to `scrape_logs`, and returns a `ScrapeResult` with the error. The batch function continues to the next venue.

**Error state for the function:** If the function itself crashes, return `{ error: "message" }` with status 500. Frontend stops the loop.

**Scope boundary:** No enrichment phase. No photo checks. Event scraping only. Does NOT modify the existing `event-scraper` function — that stays as-is for future cron use. This is a NEW function.

### FR-2: scraped_at Column on Venues

**Trigger:** Migration.

**Behavior:** Add `scraped_at timestamptz` to `venues`. Default null. Updated by `event-scrape-batch` after processing each venue. Used to determine which venues need scraping (oldest first) and what "remaining" means (venues not scraped in the last 24 hours).

### FR-3: Frontend Scraper Loop

**Trigger:** Admin presses "Run Scraper" on Coverage tab.

**Behavior:** Same loop pattern as enrichment:
1. Button shows "Scraping..." 
2. Call `event-scrape-batch`. On response, update progress: "Scraping... 3 venues, 12 events found"
3. If `remaining > 0`, call again automatically.
4. If `remaining = 0`, show "Done — N events found across M venues." Refetch metrics.

**Status text:** "Scanning for events... 15 scraped, 42 events found"

**Error state:** If batch returns error, stop loop, show error. Re-pressing resumes from remaining venues.

## Architecture

### New file

**`supabase/functions/event-scrape-batch/index.ts`**
- Copy CORS + auth from `venue-enrich/index.ts`
- Import `processVenue` from `../event-scraper/index.ts` (need to export it)
- Query 3 venues ordered by `scraped_at ASC NULLS FIRST`
- Call `processVenue()` for each (sequentially, not parallel — DeepSeek rate limits)
- Update `venues.scraped_at` after each
- Count remaining where `scraped_at IS NULL OR scraped_at < now() - interval '1 day'`
- Return JSON

### Modified files

**`supabase/functions/event-scraper/index.ts`**
- Add `export` to `processVenue()` function declaration (currently not exported)

**`supabase/migrations/20260810000002_scraped_at.sql`**
- `ALTER TABLE venues ADD COLUMN IF NOT EXISTS scraped_at timestamptz`

**`src/pages/Docs.tsx`**
- Replace `handleRunScraper` NDJSON reader with batch loop (same pattern as enrichment loop)

### No other changes needed
