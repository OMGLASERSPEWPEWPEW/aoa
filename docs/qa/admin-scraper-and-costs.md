# QA: Admin Scraper Button + Costs Date Filter

**Date:** 2026-08-10
**Scope:** `src/pages/Docs.tsx`, `src/hooks/useCostDashboard.ts`, `supabase/functions/event-scraper/`
**Entry:** `/app/admin` → Coverage tab, Costs tab

## Run Scraper Button
- [ ] "Run Scraper" button visible below "Run Discovery" on Coverage tab
- [ ] Tapping shows "Scraping..." on button, "Scanning venues for events..." in status
- [ ] Status updates incrementally as venues are scraped: "15 scraped, 42 events found"
- [ ] When done: "Done — N events found across M venues"
- [ ] ZERO EVENTS metric decreases after scraping (venues now have events)
- [ ] If scraper errors, error message shown, button returns to "Run Scraper"
- [ ] Both buttons can't run simultaneously — disable scraper while discovery is running and vice versa

## Costs Date Filter
- [ ] Four pills at top of Costs tab: TODAY, 7 DAYS (default selected), 30 DAYS, ALL TIME
- [ ] Selecting a pill updates all cost sections (summary cards, chart, by-feature, by-model)
- [ ] TODAY shows only today's costs
- [ ] ALL TIME shows all costs ever recorded
- [ ] Daily chart row count matches the window (7 rows for 7 Days, 30 for 30 Days)
- [ ] Pills match the visual style of MapTimePills (Courier Prime, gold active state)

## Regression
- **Medium:** Event scraper functionality — CORS addition must not break cron-triggered scraper runs
- **Low:** Existing cost data — changing hook params must not lose data display
