# QA: Venue Enrichment Pipeline

**Date:** 2026-08-10
**Scope:** `supabase/functions/venue-enrich/`, `supabase/functions/venue-discovery/`, `src/pages/Docs.tsx`
**Entry:** `/app/admin` → Coverage tab → Run Discovery button

## Discovery Phase
- [ ] Pressing "Run Discovery" shows "Discovering..." with subtitle "Parsing ChicagoPlays..."
- [ ] After 2-3 seconds, discovery completes and shows "Found N new theaters" (or "No new theaters found" if N=0)
- [ ] Discovery does NOT attempt enrichment — it returns immediately after parse + dedup

## Enrichment Loop
- [ ] If new theaters were found, enrichment starts automatically — no second button press
- [ ] Button shows "Enriching 5/195" and updates every ~20 seconds as batches complete
- [ ] Progress increases by ~5 each iteration (the batch size)
- [ ] When remaining reaches 0, button returns to "Run Discovery" with subtitle "195 venues enriched"
- [ ] The discovery queue in the Coverage tab shows enriched data (addresses, photos, venue types) after completion

## Inactive Theater Handling
- [ ] A theater with a dead ChicagoPlays detail page (404/500) gets `enrichment_status = 'complete'` with null enrichment fields
- [ ] A theater with an unreachable website gets `enriched_website_reachable = false`, no calendar URL, no photo
- [ ] A theater with no address gets no geocoding — `enriched_latitude/longitude` stay null
- [ ] Dead theaters do NOT crash or stall the enrichment loop — the batch continues to the next venue

## Error Recovery
- [ ] If the venue-enrich function returns a 500 error, the frontend stops the loop and shows the error message
- [ ] Pressing "Run Discovery" again after an error resumes enrichment from remaining pending rows (doesn't re-parse ChicagoPlays)
- [ ] If the admin navigates away mid-enrichment, the loop stops. Pressing "Run Discovery" again resumes from remaining pending rows
- [ ] Already-enriched venues are not re-processed (they have `enrichment_status = 'complete'`)

## Idempotency
- [ ] Running discovery twice does not create duplicate queue rows (unique index on source_id + raw_name)
- [ ] Running enrichment on an already-fully-enriched queue returns `{ enriched: 0, remaining: 0 }`

## Regression Risks
- **Medium:** venue-discovery function — verify it still parses and deduplicates correctly after enrichment removal
- **Low:** Coverage metrics — verify `pending_in_queue` count reflects enrichment progress
- **Low:** Discovery queue UI — verify enriched fields (address, photo thumbnail, venue type badge) display correctly on queue items
