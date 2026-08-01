# Scraper Data Completeness

**Category:** data-issue
**Status:** pending
**Phase:** 1
**Priority:** P1

## User's Original Request
> The DeepSeek Flash bot needs to gather ALL needed info (cast, times, photos, etc.) even if that takes multiple prompts.

## Diagnosis
The scraper extracts: title, description, event_type, genre_tags, dates, prices, ticket_url, hottix, photo_url, show_times. Missing: cast/performers. The design spec (README.md §3.3 line 230) calls for "THE COMPANY" section with headshots and names. No `cast` column exists in the events table. The extraction prompt doesn't ask for cast. The ScrapedEvent type doesn't include it.

Multi-prompt approach: currently one prompt per venue page. Large venues exhaust the token budget (see truncated-scraper-responses.md). Chunking or multi-pass extraction would solve both issues.

**Root cause:** Schema and scraper were built before the design spec's cast requirement was defined. No cast field was ever added.

**Files involved:**
- `supabase/functions/_shared/scraper/extraction-prompt.ts` — add cast field to prompt
- `supabase/functions/_shared/scraper/types.ts` — add cast to ScrapedEvent
- `supabase/functions/event-scraper/index.ts` — upsert cast
- `supabase/migrations/` — add cast column to events table
- `src/lib/types.ts` — add cast to Event type

## Graph

### Node 1: explore
- **Loop:** discover → assess
- **Output:** diagnosis section above
- **Tokens:** in / out / $

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. Migration: `ALTER TABLE events ADD COLUMN cast_members jsonb;` (array of {name, role, photo_url})
  2. Update ScrapedEvent type with `cast_members` field
  3. Update extraction prompt to ask for cast/ensemble
  4. Update upsert row in event-scraper to include cast_members
  5. Update frontend Event type
- **Files:** migrations/, types.ts (scraper + frontend), extraction-prompt.ts, event-scraper/index.ts
- **Tokens:** in / out / $

### Node 3: test
- **Loop:** write tests → run → fix failures
- **Tests:** unit test for extraction prompt output, e2e test for scraper round-trip
- **Tokens:** in / out / $

### Node 4: verify
- **Loop:** build → deploy scraper → trigger scrape → check DB
- **Tokens:** in / out / $

## Commit
- **Hash:**
- **Message:**
- **Version:**

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| | user | request | Scraper needs to gather ALL needed info including cast |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | | | |
| implement | | | |
| test | | | |
| verify | | | |
| **Total** | | | |
