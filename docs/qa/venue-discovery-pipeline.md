# QA: Venue Discovery Pipeline

**Date:** 2026-08-09
**Scope:** `supabase/functions/venue-discovery/`, `src/pages/Docs.tsx` (Coverage tab), `src/components/admin/`
**Entry:** `/app/admin` → Coverage tab
**PRD:** `.claude/docs/prd/venue-discovery-pipeline.md`

## Discovery Pipeline (Edge Function)

- [ ] Calling the `venue-discovery` function with valid `x-scraper-key` returns 200 with NDJSON stream
- [ ] Calling without `x-scraper-key` returns 401 Unauthorized
- [ ] A successful run creates a `discovery_runs` row with `fetch_status = 'success'`
- [ ] Discovered venues appear in `venue_discovery_queue` with `dedup_status = 'pending'`
- [ ] Re-running discovery for the same source does not create duplicate queue rows (idempotency key: source_id + raw_name + raw_address)
- [ ] If ChicagoPlays returns HTTP error, the run logs `fetch_error` and increments `consecutive_failures` on the source
- [ ] If the parser finds zero venues, the run logs `parse_error` with `alert_admin = true`
- [ ] If the parser finds fewer than 20 venues (when historically 150+), the run logs `parse_warning` with `alert_admin = true`
- [ ] If a run is already in progress (started within 10 minutes), a new invocation exits with `{ "status": "already_running" }`

## Deduplication

- [ ] A venue with an exact website URL match against `venues` is marked `dedup_status = 'matched'` with the correct `matched_venue_id`
- [ ] A venue with a matching street address (case-insensitive, abbreviation-normalized) is marked `matched`
- [ ] A venue with name trigram similarity > 0.85 is marked `matched`
- [ ] A venue with name trigram similarity 0.70–0.85 stays `dedup_status = 'pending'` (flagged for admin review, not auto-matched)
- [ ] A venue with no match on any signal is marked `dedup_status = 'new'`
- [ ] Matched venues do NOT cause any updates to existing `venues` records

## Enrichment

- [ ] Venues with `dedup_status = 'new'` have enrichment attempted automatically
- [ ] Geocoding populates `enriched_latitude` and `enriched_longitude` from the venue's address
- [ ] If geocoding fails, `geocode_source = 'failed'` is set and enrichment continues to next step
- [ ] Calendar URL discovery scans the venue's website for links containing "calendar", "tickets", "shows", "season", "events", "productions"
- [ ] Photo extraction reuses `extractOgImage` and populates `enriched_photo_url`
- [ ] Venue type classification uses rule-based logic first; DeepSeek V4 Flash only if rules are ambiguous
- [ ] AI usage is logged via `logUsage` with `feature = 'venue-discovery'`
- [ ] A venue where all enrichment steps fail still gets `enrichment_status = 'complete'` (steps attempted)
- [ ] A venue where the website is completely unreachable gets `enrichment_status = 'failed'`

## Admin Coverage Tab

- [ ] The Coverage tab appears in the Admin page tab bar alongside Design, AI Prompts, and Costs
- [ ] Coverage metrics card loads showing: total known theaters, AOA count, coverage %, venues with calendar_url, venues with photo, zero-event venues, queue depth, last run timestamp
- [ ] If the metrics RPC fails, an error message with retry button is displayed
- [ ] Venue audit table shows all venues with: name, neighborhood, type, has calendar_url, has photo, event count, data source
- [ ] Audit table is sortable by event count (ascending default reveals zero-event venues)
- [ ] Audit table is filterable by: missing calendar_url, missing photo, zero events
- [ ] Discovery queue section shows pending venues (promoted = false, dedup_status = 'new')
- [ ] Each queue item shows: raw_name, raw_address, enriched venue_type, enriched calendar_url, enriched photo thumbnail

## Admin Promotion

- [ ] Clicking "Promote" on a queue item opens a form pre-populated with enriched data
- [ ] The promotion form includes: name, slug (auto-generated, editable), description, venue_type, address, neighborhood, latitude, longitude, price_range, website_url, calendar_url, genre_tags, accessibility_info
- [ ] Promotion is blocked if latitude or longitude is null — form shows a warning and a "Geocode Now" button
- [ ] On confirmation, a new row is inserted into `venues` with `source = 'discovered'`
- [ ] The queue item is updated with `promoted = true` and `promoted_venue_id`
- [ ] The new venue appears on the Mapbox map immediately (no deploy needed)
- [ ] If slug collision occurs, a numeric suffix is auto-appended
- [ ] A "nearby venues" list shows existing venues within ~0.1km to warn of potential duplicates

## Admin Dismiss

- [ ] Clicking "Dismiss" on a queue item sets `dedup_status = 'skipped'`
- [ ] Dismissed items disappear from the pending queue view
- [ ] Admin can optionally enter a note before dismissing

## Scheduling

- [ ] Cron fires weekly (Sunday 2:00 AM CST) and calls the venue-discovery function
- [ ] "Run Discovery Now" button in Admin Coverage tab triggers the function manually
- [ ] Manual trigger uses admin JWT authentication (not the cron shared secret)

## Regression Risks

- **Medium:** Map markers — new venues must render correctly on Mapbox after promotion. Verify venue type icons match.
- **Medium:** Event scraper — promoted venues with `calendar_url` should be picked up on the next scraper run automatically.
- **Low:** AI mentor — newly promoted venues should be available in the mentor's venue knowledge.
- **Low:** Existing admin tabs (Design, AI Prompts, Costs) — adding the Coverage tab must not break existing tab switching.
