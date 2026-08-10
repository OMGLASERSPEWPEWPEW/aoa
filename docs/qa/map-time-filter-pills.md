# QA: Map Time Filter Pills

**Date:** 2026-08-10
**Scope:** `src/components/MapView.tsx`, `src/components/MapTimePills.tsx`, `src/lib/tonight.ts`
**Entry:** `/app/map`

## Pill Row Display
- [ ] Three pills visible below header, above existing filter chips: TODAY, THIS WEEK, THIS MONTH
- [ ] "THIS WEEK" is selected by default on page load
- [ ] Each pill shows a venue count in parentheses, e.g. "THIS WEEK (18)"
- [ ] Exactly one pill is selected at all times — tapping one deselects the others
- [ ] Pills match MapFilterChips styling (Courier Prime mono, gold active state, rule-color inactive)

## Marker Filtering
- [ ] With "TODAY" selected, only venues with events happening tonight show markers
- [ ] With "THIS WEEK" selected, only venues with events between today and end of Sunday show markers
- [ ] With "THIS MONTH" selected, only venues with events between today and end of calendar month show markers
- [ ] Venues with zero events in the selected window have NO marker on the map (not dimmed — absent)
- [ ] Switching pills immediately updates markers (no delay, no loading state)
- [ ] Counts on pills match the number of visible markers

## Edge Cases
- [ ] If zero venues have events today, "TODAY (0)" is shown and the map has no markers
- [ ] A venue with an event spanning a date range (start_date to end_date) appears in all time windows that overlap with that range
- [ ] A venue with recurring show_times (e.g. Thu/Fri/Sat weekly) appears for "TODAY" only on those days

## Interaction with Existing Filter Chips
- [ ] Existing filter chips (storefront, under20, tonight, never) still work when a time pill is active
- [ ] Filter chips dim markers within the time-filtered set — they don't bring back hidden venues
- [ ] Selecting "TODAY" pill and then toggling the "tonight" chip doesn't cause errors

## Regression Risks
- **Medium:** Venue card popup — tapping a marker should still show the venue popup with correct data
- **Medium:** Selected venue animation — selected marker should still scale up with glow
- **Low:** Map basemap interaction — zoom, pan, rotate should not be affected by pill state
