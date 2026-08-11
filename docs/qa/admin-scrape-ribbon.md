# QA: Admin Scrape Ribbon

**Date:** 2026-08-11
**Scope:** `src/contexts/ScrapeContext.tsx`, `src/components/AdminScrapeRibbon.tsx`, `src/pages/Docs.tsx`
**Entry:** `/app/admin` → Coverage tab → Run Scraper/Discovery, then navigate away

## Ribbon Visibility
- [ ] Ribbon only appears for admin users (darklight, matti) — regular users never see it
- [ ] Ribbon shows when scraper or discovery is running
- [ ] Ribbon hides when on the Coverage tab (no double progress UI)
- [ ] Ribbon shows on Tonight, Map, Discover, Profile, and all other pages while running
- [ ] Ribbon auto-hides 5 seconds after completion
- [ ] Ribbon shows error message in red if the loop fails, then hides after 5 seconds

## Persistent Background Loop
- [ ] Starting "Run Scraper" on Coverage tab, then navigating to Tonight — scraper continues running
- [ ] Navigating back to Coverage tab — progress reflects current state (not reset to 0)
- [ ] Starting "Run Discovery" on Coverage tab, then navigating to Map — discovery + enrichment continues
- [ ] Closing and reopening the Coverage tab does not restart a running loop

## Ribbon Content
- [ ] During scraping: "Scraping... 15 venues, 42 events found" (updates every batch)
- [ ] During discovery: "Discovering... Adding 30 venues" (updates every batch)
- [ ] On completion: "Done — N events found" or "Done — N venues added"
- [ ] Shimmer bar animates while running, stops on completion
- [ ] Text uses Courier Prime monospace, matches app design system

## CoverageTab Integration
- [ ] "Run Discovery" and "Run Scraper" buttons still work from Coverage tab
- [ ] Button states (disabled while running, progress text) still display correctly
- [ ] Metrics still refresh during and after loops
- [ ] Both buttons disabled while either loop is running

## Regression
- **Medium:** UpdateBanner — ribbon must not interfere with PWA update toast
- **Low:** Navigation — bottom tab bar must not be covered by ribbon
- **Low:** Non-admin users — zero visual or behavioral changes
