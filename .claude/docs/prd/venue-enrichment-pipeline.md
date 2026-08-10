# PRD: Venue Enrichment Pipeline

**Feature:** Venue Enrichment Pipeline
**Date:** 2026-08-10
**Size:** Small (< 1 day, 3 files modified, 1 file created)
**Status:** Draft
**Supersedes:** Enrichment logic previously embedded in venue-discovery Edge Function

---

## 1. Problem

The venue-discovery function tries to parse ChicagoPlays (2s), deduplicate (2s), AND enrich 195 venues (~600 HTTP requests) in a single Edge Function call with a 50-second timeout. It times out every time. The admin presses "Run Discovery," sees "Running..." for a second, and nothing happens. The 195 queue items sit unenriched — no addresses, no coordinates, no photos.

Enrichment is not AI. It's four HTTP fetches per venue:
1. Fetch the theater's ChicagoPlays detail page → address, website, phone, description
2. Geocode the address → lat/lng for the map marker
3. Fetch the theater's own website → find their shows/calendar URL
4. Extract og:image from their website → photo

Some theaters are inactive — dead websites, no address listed, defunct companies. The pipeline must handle these gracefully and move on.

## 2. Solution

Split enrichment into its own Edge Function (`venue-enrich`) that processes **5 venues per call** and returns how many remain. The frontend drives a loop: one button press calls discovery (fast), then auto-loops enrichment calls showing progress until the queue is drained.

```
User presses "Run Discovery"
  ↓
[1] Call venue-discovery → parse 231 theaters, dedup → "Found 195 new" (2-3 seconds)
  ↓
[2] Call venue-enrich → enrich 5 venues → returns { enriched: 5, remaining: 190 }
  ↓  (frontend auto-calls again)
[3] Call venue-enrich → enrich 5 venues → returns { enriched: 5, remaining: 185 }
  ↓  ... repeats ~39 times ...
[N] Call venue-enrich → enrich 5 venues → returns { enriched: 5, remaining: 0 }
  ↓
Done. "Enriched 195/195 venues" shown. Queue populated with addresses, coordinates, photos.
```

Each venue-enrich call takes ~15-25 seconds (5 venues × 3 HTTP fetches each with 10s timeouts). Well within the Edge Function limit.

## 3. Functional Requirements

### FR-1: venue-enrich Edge Function

**Trigger:** POST to `/functions/v1/venue-enrich` with either `x-scraper-key` header or admin JWT in `Authorization: Bearer` header.

**Behavior:**
1. Query `venue_discovery_queue` for up to 5 rows where `dedup_status = 'new'` AND `enrichment_status = 'pending'`, ordered by `created_at ASC` (oldest first).
2. For each row, run the enrichment steps in sequence:
   - **Detail page fetch**: If `detail_page_url` is set, fetch it (10s timeout). Extract address, website URL, description, phone, neighborhood. Update `raw_address`, `raw_website_url`, `raw_description`, `raw_phone`, `raw_neighborhood` on the queue row. If fetch fails (timeout, non-200), log the failure and continue to next step with whatever data is available.
   - **Geocode**: If address was found, geocode via Nominatim (200ms delay, 8s timeout). Set `enriched_latitude`, `enriched_longitude`, `geocode_source`. If fails, set `geocode_source = 'failed'`, add `'geocoding'` to `enrichment_steps_failed`.
   - **Website fetch**: If website URL was found, fetch venue's own website (10s timeout). If unreachable, set `enriched_website_reachable = false` and skip calendar/photo steps.
   - **Calendar URL**: If website HTML available, run `findCalendarUrl()` heuristic. Set `enriched_calendar_url` or add `'calendar_url'` to `enrichment_steps_failed`.
   - **Photo**: If website HTML available, run `extractOgImage()`. Set `enriched_photo_url`.
   - **Venue type**: Run `classifyVenueType()` (rule-based). Set `enriched_venue_type`, `enriched_venue_type_confidence`.
3. Set `enrichment_status = 'complete'` if at least address or website was found. Set `'failed'` only if the detail page was completely unreachable AND no data could be extracted at all.
4. Return JSON: `{ enriched: N, remaining: M, failed: F }` where `remaining` is the count of rows still `enrichment_status = 'pending'` AND `dedup_status = 'new'`.

**Error state per venue:** Each enrichment step failure is non-blocking. If the ChicagoPlays detail page returns 404, the venue gets `enrichment_status = 'complete'` with empty enrichment fields — it's marked as an inactive/defunct theater. The admin sees it in the queue with no address/website and can dismiss it.

**Error state for the function:** If the function itself errors (DB connection failure, unexpected crash), return `{ error: "message" }` with status 500. The frontend stops the loop and shows the error.

**Scope boundary:** This function does NOT parse or dedup. It ONLY enriches. It does NOT write to the `venues` table. It does NOT touch `discovery_runs`.

### FR-2: Strip enrichment from venue-discovery

**Trigger:** This is a code change, not a user-facing trigger.

**Behavior:** Remove the enrichment phase (Phase 3) from `venue-discovery/index.ts`. The function now only does:
- Phase 1: Fetch ChicagoPlays directory, parse theater names
- Phase 2: Insert into queue, deduplicate against existing venues
- Return summary with `venues_found`, `venues_new`, `venues_matched`

The `enrichBatch` import, the enrichment loop, and the enrichment tracking variables are removed. The discovery_runs record no longer tracks enrichment counts (those fields stay 0 — enrichment is tracked on queue rows now).

**Scope boundary:** Only `venue-discovery/index.ts` changes. All enrichment modules (`enrichment.ts`, `geocoder.ts`, `calendar-finder.ts`, `venue-type-classifier.ts`) stay as-is — they're imported by the new `venue-enrich` function.

### FR-3: Frontend discovery + enrichment loop

**Trigger:** Admin presses "Run Discovery" button on the Coverage tab.

**Behavior:**
1. Button shows "Discovering..." — call `venue-discovery`. On response, show "Found N new theaters."
2. If `venues_new > 0`, immediately begin enrichment loop:
   - Button shows "Enriching 0/N..."
   - Call `venue-enrich`. On response, update progress: "Enriching 5/N... 10/N..."
   - If `remaining > 0`, call again automatically (no user action needed).
   - If `remaining = 0`, show "Done — N venues enriched." Refetch metrics and queue.
3. If `venues_new = 0`, show "No new theaters found." Skip enrichment.

**Error state:** If any enrichment call returns an error (status 500), stop the loop and show the error message below the button. The admin can press "Run Discovery" again to retry — the loop resumes from wherever it left off (processes remaining `pending` rows).

**State displayed:**
```
Idle:        [Run Discovery]
Discovering: [Discovering...]     "Parsing ChicagoPlays..."
Discovered:  [Enriching 5/195]   "Found 195 new theaters"
Enriching:   [Enriching 40/195]  progress updates every ~20 seconds
Done:        [Run Discovery]     "195 venues enriched"
Error:       [Run Discovery]     "Error: <message>. Tap to retry."
```

**Scope boundary:** The loop is fire-and-forget — if the admin navigates away mid-enrichment, the loop stops. The next "Run Discovery" press picks up remaining `pending` rows. No background processing.

### FR-4: Graceful handling of inactive theaters

**Trigger:** Enrichment encounters a theater with a dead website, no ChicagoPlays detail page, or no address.

**Behavior:** The venue-enrich function does NOT skip inactive theaters. It processes them the same way:
- Detail page returns 404/500 → `enrichment_status = 'complete'`, all enriched fields null, `enrichment_steps_failed = ['detail_page']`
- Website unreachable → `enriched_website_reachable = false`, no calendar URL or photo
- No address found → no geocoding attempted, `enriched_latitude/longitude` stay null

These venues appear in the discovery queue with minimal data. The admin sees them and can:
- **Dismiss** — the theater is defunct, skip it
- **Promote anyway** — manually fill in address/coordinates if they know them

**Scope boundary:** The function never retries a failed venue on subsequent calls. Once `enrichment_status = 'complete'` or `'failed'`, it's done. The admin handles it from there.

## 4. Architecture

### Prior art reuse

| What | File | Reuse |
|------|------|-------|
| Enrichment logic | `supabase/functions/venue-discovery/enrichment.ts` | Import `enrichBatch` directly — it already handles per-step failures, timeouts, delays |
| CORS pattern | `supabase/functions/venue-discovery/index.ts` | Copy the `ALLOWED_ORIGINS` + `getCorsHeaders()` block |
| Auth pattern | `supabase/functions/venue-discovery/index.ts` | Copy the dual-auth (scraper key OR admin JWT) block |
| Frontend pattern | `src/pages/Docs.tsx` `handleRunDiscovery` | Extend with enrichment loop and progress state |

### New file

**`supabase/functions/venue-enrich/index.ts`**

```typescript
// Auth: same dual-auth as venue-discovery (x-scraper-key OR admin JWT)
// CORS: same ALLOWED_ORIGINS pattern
// Query: SELECT id, raw_name, raw_address, raw_website_url, raw_genre_tags,
//        raw_category, detail_page_url
//        FROM venue_discovery_queue
//        WHERE dedup_status = 'new' AND enrichment_status = 'pending'
//        ORDER BY created_at ASC LIMIT 5
// Process: call enrichBatch(supabase, candidates)
// Count remaining: SELECT count(*) FROM venue_discovery_queue
//                  WHERE dedup_status = 'new' AND enrichment_status = 'pending'
// Response: { enriched: N, remaining: M, failed: F }
```

### Modified files

**`supabase/functions/venue-discovery/index.ts`** — Remove:
- `import { enrichBatch }` line
- Variables: `enrichSuccess`, `enrichFailed`, `totalAiIn`, `totalAiOut`
- Phase 3 enrichment block (the `if (candidates && candidates.length > 0)` section)
- Enrichment fields from the final summary NDJSON event and discovery_runs update

**`src/pages/Docs.tsx`** — Replace `handleRunDiscovery` with a two-phase handler:
- Phase 1: call venue-discovery, parse response
- Phase 2: loop calls to venue-enrich, update progress state
- New state: `discoveryProgress: { phase: 'idle' | 'discovering' | 'enriching' | 'done' | 'error', found: number, enriched: number, total: number, error?: string }`

### No database changes

All columns already exist on `venue_discovery_queue`. No migration needed.

## 5. QA

See `docs/qa/venue-enrichment-pipeline.md`.

## 6. Risks

| Risk | Mitigation |
|------|-----------|
| Admin navigates away mid-enrichment | Loop stops. Next press resumes from remaining `pending` rows. |
| Nominatim rate limiting | 200ms delay between geocode calls. 5 venues per batch = 5 geocode calls max per invocation. |
| All 195 venues have dead websites | Each still gets `enrichment_status = 'complete'`. Admin sees them with no data and dismisses. |
| venue-enrich returns error mid-loop | Frontend stops, shows error, admin retries. Completed venues stay enriched. |
