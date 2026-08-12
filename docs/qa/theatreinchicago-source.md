# QA: TheatreInChicago.com Aggregator Source

**Date:** 2026-08-12
**Scope:** `supabase/functions/_shared/scraper/`, `supabase/functions/tic-crossref/`
**Entry:** Admin → Coverage → Run Scraper; Admin → Coverage → Run TIC Cross-Reference

## Per-Venue Strategy Integration (FR-1, FR-2, FR-3)
- [ ] Running the scraper on a venue listed on TIC (e.g., Cadillac Palace) fills in missing dates from TIC when the venue's own site doesn't have them
- [ ] The strategy trace shows an `aggregator_crossref` step with fields filled (e.g., `["start_date", "end_date"]`)
- [ ] The aggregator step uses 0 AI calls — only HTTP fetches
- [ ] If TIC doesn't have the venue, the scraper continues without error
- [ ] Existing non-NULL fields are never overwritten by TIC data
- [ ] The progress ribbon shows the aggregator step (e.g., "cross-referenced TIC, found 2 dates")

## TIC Parser (FR-2)
- [ ] Coming Soon listing page parses ~90 shows with titles, venue names, and dates
- [ ] Now Playing listing page parses ~24 shows with titles and venue names
- [ ] Detail page parses run dates (both "Through {date}" and "{start} - {end}" formats)
- [ ] Detail page parses performance schedule into show_times format (day → times array)
- [ ] Detail page extracts ticket URL from the "Tickets" link
- [ ] Detail page extracts cast in `{name, role}` format
- [ ] Venue page parses shows listed under "Currently Playing" and "Coming Soon"

## Venue Name Matching (FR-4)
- [ ] "Steppenwolf Theatre" matches "Steppenwolf Theatre Company" on TIC
- [ ] "Court Theatre" matches "Court Theatre - University of Chicago"
- [ ] Exact venue names match with highest confidence
- [ ] Venues not on TIC return no match (not a false positive)

## Bulk Cross-Reference (FR-5)
- [ ] Triggering bulk cross-reference fetches all TIC Now Playing + Coming Soon pages
- [ ] Events in our DB with NULL start_date that match TIC shows get their dates updated
- [ ] Response reports: X events enriched, Y unmatched, Z new shows not in our DB
- [ ] Bulk operation completes without timing out (only HTTP fetches, no AI)
- [ ] Events enriched by bulk cross-ref have `extraction_status` updated to `complete`

## Data Source Registration (FR-6)
- [ ] `venue_sources` table has a row for "Theatre in Chicago" with type `listing_site`

## Regression
- **High:** Existing per-venue scraper still works identically for venues NOT on TIC
- **High:** AI cost per venue is unchanged (TIC adds 0 AI calls)
- **Medium:** Strategy trace format is backward-compatible (new step type added, existing steps unchanged)
- **Low:** Rate limiting: TIC fetches include 500ms delays between requests
