# QA: Intelligent Event Scraper (v2)

**Date:** 2026-08-11
**Scope:** `supabase/functions/_shared/scraper/`, `supabase/functions/event-scrape-batch/`
**Entry:** Admin → Coverage → Run Scraper
**Supersedes:** `multi-pass-extraction.md` (v1 QA)

## Gap-Priority Scraping (FR-9)
- [ ] Pressing "Run Scraper" processes venues with NULL-date events FIRST, before stale venues
- [ ] Events that previously had NULL `start_date` get updated with real dates (not duplicated)
- [ ] After all gap venues are processed, the scraper continues with unscraped/stale venues
- [ ] The `remaining` counter reflects total venues needing work (gaps + stale + unscraped)

## Completeness Evaluation (FR-1)
- [ ] A venue whose calendar page has dates for all events skips link following entirely
- [ ] A venue whose calendar page lists titles without dates triggers link following
- [ ] A venue with 0 events from calendar triggers website fallback (FR-5)

## Link Extraction & Following (FR-2, FR-3)
- [ ] Links are extracted from raw HTML — social media, nav links, external domains are filtered out
- [ ] Links whose anchor text matches event titles score highest
- [ ] The scraper follows up to 3 detail page links per venue
- [ ] Each detail page gets a targeted prompt asking specifically for missing fields
- [ ] Dates found on detail pages are merged into existing events (NULL fields filled, non-NULL preserved)
- [ ] If a link fetch fails (404, timeout), the scraper continues to the next link without stopping
- [ ] If 2 consecutive link follows add zero new fields, the scraper stops following links

## Budget & Circuit Breakers (FR-4)
- [ ] Scraper stops link following after 6 total AI calls
- [ ] Scraper stops after 5 total HTTP fetches
- [ ] Scraper stops if wall-clock exceeds 120 seconds
- [ ] Scraper stops if estimated cost exceeds $0.012
- [ ] Budget exhaustion is logged as a normal stop reason, not an error

## Website Fallback (FR-5)
- [ ] If calendar_url returns 0 events, the scraper tries website_url as a fallback
- [ ] If website_url also returns 0 events, the venue is marked with `extraction_status: "unreachable"`
- [ ] If website_url === calendar_url, fallback is skipped

## Conditional Verification (FR-6)
- [ ] If budget has AI calls remaining after link following, Pass 2 (verify+enrich) runs normally
- [ ] If budget was exhausted on link following, Pass 2 is skipped and events get confidence = 0.4
- [ ] Skipping Pass 2 does not cause errors — events are still inserted correctly

## Gap Annotation (FR-7)
- [ ] Complete events have `extraction_status = 'complete'` and `missing_fields = '[]'`
- [ ] Events missing only dates have `extraction_status = 'no_dates_on_site'` (if follows were tried)
- [ ] Events from unreachable venues have `extraction_status = 'unreachable'`
- [ ] Events where budget ran out have `extraction_status = 'budget_exhausted'`
- [ ] `missing_fields` accurately lists which fields remain NULL

## Strategy Trace (FR-7)
- [ ] `scrape_logs.strategy_trace` contains a JSON object with steps, links followed, and stop reason
- [ ] Each step records: URL, AI calls used, tokens, fields filled, duration
- [ ] Stop reason is one of: `complete`, `budget_calls`, `budget_time`, `budget_cost`, `no_progress`, `no_links`

## Batch Size (FR-8)
- [ ] Each batch call processes 1 venue (not 2)
- [ ] Frontend progress counter still increments correctly

## Regression
- **High:** `processVenue` still returns the same `ScrapeResult` type — frontend batch loop works without changes
- **High:** Events with `source = 'manual'` are never overwritten
- **Medium:** AI costs logged to `ai_usage` with correct feature strings (`event-scraper-extract`, `event-scraper-follow`, `event-scraper-verify`)
- **Medium:** Existing Pass 1 + Pass 2 extraction quality unchanged for venues that don't need link following
- **Low:** Admin scrape ribbon still shows progress across pages
