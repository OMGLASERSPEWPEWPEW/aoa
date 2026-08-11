# QA: Multi-Pass AI Event Extraction

**Date:** 2026-08-10
**Scope:** `supabase/functions/event-scraper/`, `supabase/functions/_shared/scraper/`, `src/pages/Docs.tsx`
**Entry:** Admin → Coverage → Run Scraper; Admin → AI Prompts tab

## Price Accuracy (Bug #1 Fix)
- [ ] A venue with paid shows but no price on their calendar page has events with `price_min = null` (not 0)
- [ ] Events with null prices show "$ TBD" in the UI, NOT "Free"
- [ ] Events explicitly marked "free" on the venue page have `price_min = 0` and show "Free"
- [ ] Events with "pay what you can" have `price_min = 0` with a non-zero `price_max`

## Venue Attribution (Bug #2 Fix)
- [ ] Events listed on a venue's page but performed at a DIFFERENT venue are rejected by Pass 2 and not inserted
- [ ] Touring shows and guest productions that happen AT the venue ARE included
- [ ] The `events_rejected` count in scrape_logs reflects how many events Pass 2 filtered out

## Date Sanity (Bug #3 Fix)
- [ ] Year-long programs do not have a 365+ day date range — dates are corrected or event is excluded
- [ ] Single performances have `end_date = null`
- [ ] Events with past start dates are rejected

## Two-Pass Pipeline
- [ ] Pass 1 extracts structural data only (title, dates, prices, ticket URL, show times) — no descriptions or genres
- [ ] Pass 2 receives the Pass 1 JSON (not the full HTML) and returns verification + enrichment
- [ ] Events have descriptions and genre_tags populated by Pass 2
- [ ] Each event has an `extraction_confidence` score between 0 and 1
- [ ] If Pass 2 fails (DeepSeek error), Pass 1 data is still inserted with confidence = 0.5
- [ ] AI costs show two separate features in the Costs tab: "event-scraper-extract" and "event-scraper-verify"

## Admin AI Prompts Tab
- [ ] Two prompt cards replace the single "Event Scraper" card: "Pass 1: Extract" and "Pass 2: Verify & Enrich"
- [ ] Each card shows the full prompt text with ${venue_name} and ${events_json} placeholders
- [ ] Expanding/collapsing works independently for each card

## Regression
- **Medium:** processVenue still works correctly when called from event-scrape-batch (the batch loop)
- **Medium:** Events with `source = 'manual'` are still never overwritten
- **Low:** scrape_logs still records all fields correctly
- **Low:** Existing events in the database are not affected until re-scraped
