# QA: Batch Event Scraper

**Date:** 2026-08-10
**Scope:** `supabase/functions/event-scrape-batch/`, `src/pages/Docs.tsx`
**Entry:** `/app/admin` → Coverage tab → Run Scraper button

## Scraper Button
- [ ] "Run Scraper" button visible on Coverage tab
- [ ] Tapping shows "Scraping..." on button
- [ ] Status text updates incrementally: "Scanning for events... 6 scraped, 18 events found"
- [ ] Progress increases by ~3 each iteration (batch size)
- [ ] When remaining reaches 0: "Done — N events found across M venues"
- [ ] ZERO EVENTS metric decreases after scraping (venues now have events)
- [ ] Both buttons disabled while either is running

## Batch Processing
- [ ] Each batch call processes exactly 3 venues (or fewer if less remain)
- [ ] Venues with no `scraped_at` (never scraped) are processed first
- [ ] After a venue is scraped, its `scraped_at` column is updated
- [ ] Re-running scraper skips venues scraped in the last 24 hours
- [ ] A venue with a dead calendar URL gets logged as `fetch_error` and the batch continues
- [ ] A venue where DeepSeek fails gets logged as `ai_error` and the batch continues
- [ ] AI costs from scraping appear in the Costs tab under feature "event-scraper"

## Error Recovery
- [ ] If the batch function returns 500, the loop stops and error is shown
- [ ] Re-pressing "Run Scraper" after error resumes from remaining venues
- [ ] Already-scraped venues (scraped_at within 24h) are not re-processed

## Regression
- **Medium:** Existing event-scraper function unchanged — cron can still call it
- **Low:** processVenue export doesn't break existing event-scraper imports
