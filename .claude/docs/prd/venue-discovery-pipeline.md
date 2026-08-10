# PRD: Venue Discovery Pipeline

**Feature:** Venue Discovery Pipeline
**Date:** 2026-08-09
**Version:** 1.0
**Status:** Draft
**Author:** PRD Specialist
**Parent PRD:** `.claude/docs/prd/app-prd.md`

---

## 1. Executive Summary

### Problem Statement

The Art of Art covers approximately 18% of the Chicago theater landscape. The application has 37 hand-curated venues, while the League of Chicago Theatres (chicagoplays.com) lists 200+ member theaters and HotTix lists 150+ venues. The existing event scraper (`event-scraper` Edge Function) is constrained to venues already in the database — it scrapes events from known venues but has no mechanism to discover new ones. Adding a venue today requires a developer to write a SQL INSERT migration. This is not sustainable and creates a growing data quality gap as Chicago's theater scene continues to evolve.

This PRD covers the first of two data strategy problems:

- **Problem 1 (this feature):** What theaters exist? — Venue Discovery Pipeline
- **Problem 2 (already solved):** What's playing at each one? — Event scraper (built, deployed)

### Solution Overview

Build an automated venue discovery pipeline consisting of: a source registry table tracking where venues come from, a ChicagoPlays ingestion Edge Function that scrapes the canonical member directory, a deduplication layer matching discovered venues against the existing database, an enrichment sub-pipeline that geocodes addresses and extracts metadata for new venues, and an Admin UI tab surfacing coverage metrics and venue audit data. The pipeline runs on a weekly or monthly schedule, decoupled from the nightly event scraper.

### Business Impact

| Metric | Current | Target (6 months post-launch) |
|--------|---------|-------------------------------|
| Venue coverage | 37 venues / ~18% | 180+ venues / ~85% |
| New venues added per month (manual) | ~2-3 | 0 (automated) |
| Venues with calendar_url | Partial | 90%+ of discovered venues |
| Venues with photo | Partial | 70%+ of discovered venues |
| AI mentor recommendation surface | 37 venues | 180+ venues |

### Resource Requirements

- 1 Edge Function: `venue-discovery` (new)
- 1 Supabase migration: `venue_sources` table + `venue_discovery_queue` table + columns on `venues`
- 1 Admin UI tab: "Coverage" (new tab in `/app/admin`)
- External API dependency: Google Places API (or Nominatim fallback) for geocoding
- Secrets: `GOOGLE_PLACES_API_KEY` (new) or use free Nominatim (no key required)
- Schedule: Weekly cron via existing cron infrastructure (same mechanism as event-scraper)

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ChicagoPlays changes HTML structure | Medium | High | Structured parsing with fallback selectors; alert on zero results |
| Geocoding API rate limits or cost | Low | Medium | Batch geocoding; Nominatim free tier as fallback |
| Duplicate venues slipping through | Medium | Medium | Multi-signal deduplication (name + address + URL); manual review queue |
| AI venue type classification errors | Low | Low | Classification is soft — admin can correct; not user-visible until promoted |
| User-visible venues degraded by bad enrichment | Low | High | New venues stay in `pending` status until promoted by admin |

---

## 2. Product Overview

### Product Vision

The venue database is a living map of the Chicago theater scene. Venues should be discovered automatically from authoritative sources, validated to prevent duplicates, enriched with geocoordinates and metadata, and surface to administrators for approval — with no developer SQL migrations required for routine venue additions.

### Target Users for This Feature

This feature has two user segments:

**Primary: Admin (Founder / Deric)** — The sole administrator who reviews discovered venues, promotes them to live status, and monitors pipeline health from the Admin UI.

**Indirect: AOA End Users** — Benefit from a richer venue map and better AI mentor recommendations. Never interact with the pipeline directly.

### Value Proposition

For the admin: venue additions go from a manual SQL migration taking 20-30 minutes to a weekly automated sweep that surfaces new theaters in a review queue, requiring 2-3 minutes of approval per venue. For end users: the AI mentor's recommendation surface grows from 37 venues to 180+ venues, covering the full storefront ecosystem that is AOA's core differentiation.

### Assumptions

1. ChicagoPlays.com (chicagoplays.com) maintains a structured HTML member directory that is scrapable without JavaScript rendering requirements. If the page requires JavaScript, a fallback to their League API (if available) or a headless approach must be evaluated separately.
2. The admin is the only user who interacts with the discovery pipeline UI.
3. New venues are not immediately visible to end users — they enter a `pending` state requiring admin promotion.
4. Google Places API is used for geocoding. If cost is a concern, Nominatim (OpenStreetMap) is a free fallback with lower accuracy.
5. Venue type classification (`storefront | institutional | experimental | school`) is AI-assisted but admin-correctable.
6. The pipeline does not scrape events for newly discovered venues — that is handled by the existing `event-scraper` once a venue is promoted and has a `calendar_url`.

---

## 3. Functional Requirements

Each requirement specifies: trigger, behavior, error state, data produced, and scope boundary.

---

### FR-1: Venue Source Registry

**Trigger:** System initialization (migration deploys). Source records are created manually by admin or seeded in migration.

**Behavior:** A new `venue_sources` table tracks all data sources the pipeline knows about. Each source has a type, scrape frequency, reliability score, and timestamp of last successful check. The table is the registry for the discovery scheduler — only sources with `is_active = true` are scraped during discovery runs.

**Error State:** No error state applicable to the table itself. If a source becomes unreachable (tracked in discovery runs), `last_error` is written and `consecutive_failures` is incremented. Admin can deactivate a source without deleting it.

**Data:**

```
venue_sources
  id                    uuid PRIMARY KEY
  name                  text NOT NULL                -- "ChicagoPlays Member Directory"
  source_type           text NOT NULL                -- CHECK IN ('directory', 'listing_site', 'google_places', 'manual')
  base_url              text NOT NULL                -- "https://chicagoplays.com/member-theaters/"
  scrape_frequency      text NOT NULL DEFAULT 'weekly' -- CHECK IN ('daily', 'weekly', 'monthly')
  reliability_score     numeric(3,2) DEFAULT 1.00   -- 0.00 to 1.00, updated per run
  is_active             boolean NOT NULL DEFAULT true
  last_checked_at       timestamptz
  last_success_at       timestamptz
  last_error            text
  consecutive_failures  int NOT NULL DEFAULT 0
  created_at            timestamptz DEFAULT now()
  updated_at            timestamptz DEFAULT now()
```

**Scope Boundary:** This table is metadata only. It does not store scraped venue data. Discovery run results are stored in `venue_discovery_queue` (FR-3).

---

### FR-2: ChicagoPlays Ingestion

**Trigger:** Either (a) a cron call to the `venue-discovery` Edge Function with `{ "source": "chicagoplays" }` in the request body, or (b) a manual trigger from the Admin Coverage tab ("Run Discovery Now" button).

**Behavior:** The Edge Function fetches the ChicagoPlays member directory page and parses the HTML to extract all member theater listings. For each theater found, it extracts: name, address (street + city + state + zip), website URL, genre/category tags, and neighborhood (if listed). No AI is used for the directory parse — this is structured HTML extraction via regex or DOM parsing. After parsing, each discovered venue is written to `venue_discovery_queue` with `status = 'pending_dedup'`.

The function logs a `discovery_runs` record (see FR-7) on completion.

**Error States:**

| Error | Behavior |
|-------|----------|
| HTTP non-200 from chicagoplays.com | Log `fetch_error` to `discovery_runs`. Do not write partial results. Increment `consecutive_failures` on the source. Return 200 with `{ "status": "fetch_error" }` to cron caller to avoid cron retry thrashing. |
| Zero venues parsed (structure changed) | Log `parse_error` with a `zero_venues_parsed` flag. This is treated as a hard failure — the HTML structure has likely changed. Admin is alerted via `discovery_runs.alert_admin = true`. |
| Partial parse (< 20 venues on a source that previously returned 150+) | Log `parse_warning`. Write discovered venues to queue. Set `alert_admin = true` on the run. |
| Function timeout (Deno 50s wall time) | If the page is too large to parse in one invocation, paginate. ChicagoPlays uses a single-page directory; paginate only if a multi-page structure is detected. |

**Data Written Per Discovered Venue:**

```
venue_discovery_queue
  id                    uuid PRIMARY KEY
  source_id             uuid REFERENCES venue_sources(id)
  run_id                uuid                         -- groups all rows from one discovery run
  raw_name              text NOT NULL
  raw_address           text
  raw_website_url       text
  raw_genre_tags        text[]
  raw_neighborhood      text
  raw_category          text                         -- ChicagoPlays category label (e.g., "Member Theater")
  dedup_status          text NOT NULL DEFAULT 'pending'
                        -- CHECK IN ('pending', 'matched', 'new', 'skipped')
  matched_venue_id      uuid REFERENCES venues(id)  -- set if dedup_status = 'matched'
  enrichment_status     text NOT NULL DEFAULT 'pending'
                        -- CHECK IN ('pending', 'complete', 'failed', 'skipped')
  promoted              boolean NOT NULL DEFAULT false
  promoted_venue_id     uuid REFERENCES venues(id)
  admin_notes           text
  created_at            timestamptz DEFAULT now()
  updated_at            timestamptz DEFAULT now()
```

**Scope Boundary:** This function only scrapes ChicagoPlays. HotTix and other sources are separate functions or future scope. The function does NOT enrich (geocode, classify) — that is FR-4. The function does NOT write to the `venues` table — only to `venue_discovery_queue`.

---

### FR-3: Deduplication

**Trigger:** Fires automatically immediately after ingestion completes within the same Edge Function invocation (or as a second pass if runtime permits). Can also be re-triggered manually from the Admin UI.

**Behavior:** For each row in `venue_discovery_queue` with `dedup_status = 'pending'`, the deduplication step attempts to match against existing `venues` using a three-signal cascade:

1. **Exact website URL match** — If `raw_website_url` normalized (lowercase, stripped trailing slash, stripped `www.`) matches any `venues.website_url` normalized identically, it is a definitive match. Set `dedup_status = 'matched'`, `matched_venue_id = <existing venue id>`.

2. **Address match** — If the street number and street name parsed from `raw_address` match a venue's `address` field (case-insensitive, ignoring `St` vs `Street` abbreviations), it is a strong match. Apply the same `matched` result.

3. **Name fuzzy match** — Compute trigram similarity between `raw_name` and all `venues.name` values. If similarity > 0.85, treat as a match. If similarity is 0.70–0.85, flag as `dedup_status = 'pending'` with a note that admin review is required (do not auto-match ambiguous names).

If no signal produces a match, set `dedup_status = 'new'`. New venues proceed to enrichment (FR-4).

Matched venues are NOT updated — the existing `venues` record is authoritative. Deduplication's only output is flagging what is genuinely new.

**Error State:** If the dedup step fails for a row (e.g., DB query error), leave `dedup_status = 'pending'` and log the error. The row is retried on the next run.

**Data:** Updates `dedup_status` and `matched_venue_id` on `venue_discovery_queue` rows. No writes to `venues`.

**Scope Boundary:** Deduplication runs only on `venue_discovery_queue`. It does not merge or update existing venue records. Name fuzzy matching uses trigram similarity computed in Postgres (`pg_trgm` extension, already available in Supabase). The 0.85 threshold is a starting point and should be tunable via an admin setting or environment variable.

---

### FR-4: Enrichment Pipeline

**Trigger:** Runs automatically for all rows where `dedup_status = 'new'` and `enrichment_status = 'pending'` after deduplication completes. Also re-triggerable from the Admin UI for specific queue rows.

**Behavior:** For each new venue candidate, the enrichment pipeline runs the following steps in sequence:

**Step 1: Geocoding**
- Input: `raw_address` (e.g., "5153 N Ashland Ave, Chicago, IL 60640")
- Call Google Places Geocoding API (or Nominatim as fallback) with the address string
- Extract: `latitude`, `longitude`
- If geocoding fails (address not found, API error), log the failure and continue — a venue can be promoted without coordinates (admin fills them in)
- Store in `venue_discovery_queue` as enrichment columns: `enriched_latitude`, `enriched_longitude`, `geocode_source` ('google_places' | 'nominatim' | 'failed')

**Step 2: Calendar URL Discovery**
- Fetch the venue's `raw_website_url` (if present)
- Scan the HTML for navigation links containing keywords: "calendar", "tickets", "shows", "season", "events", "productions"
- Select the most likely calendar link using heuristic scoring (path depth, keyword density, internal link preference)
- Store as `enriched_calendar_url` in the queue row
- If the website is unreachable: log, store `enriched_website_reachable = false`, skip remaining steps

**Step 3: Photo Extraction**
- Extract `og:image` meta tag from the venue's website HTML (reuse `extractOgImage` from `_shared/scraper/og-image-extractor.ts`)
- Store as `enriched_photo_url`, `enriched_photo_url_source = 'og_image'`

**Step 4: Venue Type Classification**
- Input: `raw_name`, `raw_genre_tags`, `raw_category`, `enriched_calendar_url`, and any description text found on the website
- Use a simple rule-based classifier first (no AI needed for most cases):
  - Contains "school", "training", "academy" → `school`
  - ChicagoPlays category = "Storefront" → `storefront`
  - ChicagoPlays category = "Institutional" or budget is `$$$` → `institutional`
  - Genre tags contain "experimental", "devised" with no school indicators → `experimental`
  - Default: `storefront`
- If the rule-based classifier cannot confidently assign a type (ambiguous input), fall back to a DeepSeek V4 Flash call with a structured prompt returning `{ "venue_type": "storefront|institutional|experimental|school", "confidence": 0-1 }`. Log AI usage via `logUsage`.
- Store as `enriched_venue_type` and `enriched_venue_type_confidence` (0-1 float)

**Error State:** Enrichment failures are non-blocking. If any step fails, log the specific step failure on the queue row and continue to the next step. A venue where geocoding failed but photos and calendar URL succeeded is still enriched enough for admin review. `enrichment_status` is set to `'complete'` when all steps have been attempted (regardless of individual step failures) and to `'failed'` only if the website was completely unreachable and no data could be extracted at all.

**Data Schema Additions to `venue_discovery_queue`:**

```
  enriched_latitude         numeric(9,6)
  enriched_longitude        numeric(9,6)
  geocode_source            text        -- 'google_places' | 'nominatim' | 'failed'
  enriched_calendar_url     text
  enriched_website_reachable boolean
  enriched_photo_url        text
  enriched_photo_url_source text        -- 'og_image'
  enriched_venue_type       text        -- CHECK IN ('storefront','institutional','experimental','school')
  enriched_venue_type_confidence numeric(3,2)
  enrichment_steps_failed   text[]      -- ['geocoding', 'calendar_url', 'photo', 'venue_type']
  ai_input_tokens           int DEFAULT 0
  ai_output_tokens          int DEFAULT 0
```

**Scope Boundary:** Enrichment runs only on queue rows with `dedup_status = 'new'`. It does not touch the `venues` table. All enriched data stays in `venue_discovery_queue` until admin promotion (FR-5). The geocoding step calls an external API — rate limiting is enforced by processing a maximum of 10 venues per enrichment batch with a 200ms delay between calls.

---

### FR-5: Admin Venue Promotion

**Trigger:** Admin clicks "Promote" on a venue card in the Admin Coverage tab's discovery queue view.

**Behavior:** When the admin promotes a venue from the discovery queue, the following occurs atomically:

1. A new row is inserted into `venues` using the enriched data from `venue_discovery_queue` as defaults. All enriched values are pre-populated but admin can edit any field in a promotion form before confirming.
2. The promotion form exposes: name, slug (auto-generated, editable), description (blank, admin fills in), venue_type (pre-filled from enrichment), address, neighborhood, latitude, longitude, price_range (blank, admin fills in), website_url, calendar_url, genre_tags (from raw_genre_tags), accessibility_info (blank).
3. On confirmation, `venues.source = 'discovered'` is set (new value in the source enum alongside 'manual' and 'scraped').
4. `venue_discovery_queue.promoted = true` and `promoted_venue_id = <new venue id>` are written.
5. The new venue immediately appears on the Mapbox map and in the AI mentor's venue knowledge.

**Error State:** If the insert fails (e.g., slug collision), surface the error in the promotion form. Slug collisions are resolved by appending a numeric suffix (`-2`, `-3`, etc.) — this is handled automatically.

**Bulk Promotion:** Admin can select multiple queue items and promote them with shared defaults (e.g., all venues from a single discovery run can be bulk-promoted after a brief review, each still generating a unique slug). Bulk promotion skips individual description and price_range fields — those must be filled in later.

**Scope Boundary:** Promotion is always admin-initiated. No auto-promotion. The `venues` table is never written by the discovery pipeline functions directly — only through the admin promotion action.

---

### FR-6: Coverage Metrics

**Trigger:** Displayed in the Admin Coverage tab (loaded when admin navigates to `/app/admin` and clicks the Coverage tab).

**Behavior:** A set of computed metrics displayed in a summary card:

| Metric | Calculation |
|--------|------------|
| Total known theaters in Chicago | Count of all active source venue totals (from latest discovery runs). e.g., "ChicagoPlays: 212 members" |
| Venues in AOA database | `SELECT COUNT(*) FROM venues` |
| Coverage percentage | (AOA venues / total known) * 100 |
| Venues with calendar_url | `SELECT COUNT(*) FROM venues WHERE calendar_url IS NOT NULL` |
| Venues with photo | `SELECT COUNT(*) FROM venues WHERE photo_url IS NOT NULL` |
| Venues with zero events ever | Count of venue IDs not present in any events row |
| Pending in discovery queue | Count of queue rows with `promoted = false AND dedup_status = 'new'` |
| Last discovery run | Timestamp of most recent `discovery_runs` record |

These metrics are computed on page load via a Postgres RPC function (`get_venue_coverage_metrics`) to keep logic server-side and the query efficient. No client-side calculation.

**Error State:** If the RPC fails, display a "Could not load coverage metrics" error state with a retry button.

**Scope Boundary:** Read-only display. No mutations from the metrics view.

---

### FR-7: Venue Audit View

**Trigger:** Displayed in the Admin Coverage tab below the summary metrics.

**Behavior:** A table of all venues in the `venues` table with the following columns per row:

| Column | Source |
|--------|--------|
| Name | `venues.name` |
| Neighborhood | `venues.neighborhood` |
| Type | `venues.venue_type` |
| Has calendar_url | Boolean indicator |
| Has photo | Boolean indicator |
| Event count | Count of events for this venue |
| Data source | `venues.source` ('manual' \| 'discovered') |
| Source provenance | `venue_sources.name` (via `venue_discovery_queue.source_id`) if discovered, "Manual" otherwise |
| Website reachable | `venues.website_url_checked_at` (green if checked within 30 days, yellow if older, red if null) |

The table is sortable by event count (ascending first — reveals zero-event venues needing attention), by source, and by neighborhood. Filterable by: has calendar_url (boolean), has photo (boolean), event count = 0.

Below the audit table: a "Discovery Queue" section showing all `venue_discovery_queue` rows with `promoted = false` and `dedup_status = 'new'`, ordered by `created_at` descending. Each queue item shows:
- raw_name, raw_address, enriched venue_type, enriched_calendar_url (if found), enriched_photo_url (thumbnail), confidence scores
- "Promote" button (opens promotion form)
- "Dismiss" button (sets `dedup_status = 'skipped'` with an optional admin note)

**Error State:** Table loads via a Supabase query with RLS bypassed (admin-only RPC). If query fails, show inline error. Pagination at 50 rows per page for the audit table. Queue section shows all pending items (typically small, < 50 per run).

**Scope Boundary:** Read operations and promotion/dismiss actions only. The audit view does not edit existing venue records inline — that remains the venue edit form (out of scope for this feature).

---

### FR-8: Discovery Scheduling

**Trigger:** Automated cron schedule. Manual trigger from Admin Coverage tab ("Run Discovery Now" button).

**Behavior:** The `venue-discovery` Edge Function is called on a weekly schedule (every Sunday at 2:00 AM CST) using the same cron mechanism as the `event-scraper`. The function accepts a shared secret via `x-scraper-key` header (reusing `SCRAPER_SECRET` — same secret, different function endpoint).

The discovery pipeline runs less frequently than event scraping because new theaters open rarely (vs. events which change weekly). The default schedule is weekly. The admin can adjust frequency by toggling the source's `scrape_frequency` in the Coverage tab (updating the `venue_sources` table — no code deploy required).

**Discovery Run Log:**

```
discovery_runs
  id                  uuid PRIMARY KEY
  source_id           uuid REFERENCES venue_sources(id)
  run_id              uuid
  started_at          timestamptz
  completed_at        timestamptz
  venues_found        int            -- total parsed from source
  venues_new          int            -- dedup_status = 'new'
  venues_matched      int            -- dedup_status = 'matched'
  venues_skipped      int            -- dedup_status = 'skipped'
  enrichment_success  int
  enrichment_failed   int
  ai_input_tokens     int DEFAULT 0
  ai_output_tokens    int DEFAULT 0
  ai_cost_usd         numeric(10,6)
  fetch_status        text           -- 'success' | 'fetch_error' | 'parse_error' | 'parse_warning'
  alert_admin         boolean DEFAULT false
  error_message       text
  created_at          timestamptz DEFAULT now()
```

**Error State:** If the cron fires and the function is already running (previous run still in progress), the new invocation detects an in-progress `discovery_runs` row started within the last 10 minutes and exits early with `{ "status": "already_running" }`.

**Scope Boundary:** Scheduling is handled by the same external cron mechanism that calls `event-scraper`. No Supabase pg_cron is used (consistent with existing pattern). The `venue-discovery` function URL and the `SCRAPER_SECRET` secret are sufficient to wire up the schedule.

---

## 4. User Stories

### Admin Stories

**US-VD-1:** As an admin, I want to see what percentage of Chicago theaters are in the AOA database so I understand the data coverage gap.
- Acceptance Criteria: Given I am on the Admin Coverage tab, when the page loads, then I see a coverage percentage card showing (AOA venues / total known Chicago theaters) with the total from the latest discovery run.

**US-VD-2:** As an admin, I want to run the venue discovery pipeline manually so I can trigger a sweep without waiting for the weekly schedule.
- Acceptance Criteria: Given I am on the Admin Coverage tab, when I click "Run Discovery Now", then an Edge Function invocation is triggered, a progress indicator appears, and on completion the discovery queue updates to show newly found venues.

**US-VD-3:** As an admin, I want to see a queue of venues discovered but not yet in the database so I can review and approve them.
- Acceptance Criteria: Given a discovery run has completed, when I open the Admin Coverage tab, then I see a "Discovery Queue" section listing all pending venues with enriched data (type, address, photo thumbnail, calendar URL). Each row has a Promote and a Dismiss action.

**US-VD-4:** As an admin, I want to promote a discovered venue to the live database with pre-filled enrichment data so I can add a new venue in under 3 minutes.
- Acceptance Criteria: Given a queue item shows enriched data, when I click Promote, then a form opens pre-populated with name, address, venue_type, calendar_url, and photo_url. When I confirm, the venue appears on the map and is available to the AI mentor immediately.

**US-VD-5:** As an admin, I want to dismiss a discovered venue from the queue so I can remove false positives or venues not appropriate for AOA.
- Acceptance Criteria: Given a queue item is pending, when I click Dismiss and optionally enter a note, then the item is marked `skipped` and disappears from the pending queue view.

**US-VD-6:** As an admin, I want to see a venue audit table showing which venues are missing calendar URLs or photos so I can prioritize data completeness work.
- Acceptance Criteria: Given I am on the Admin Coverage tab, when I filter by "missing calendar_url", then only venues without a calendar_url are shown, sorted by event count ascending, so the most data-complete venues that need calendar URLs are easiest to identify.

**US-VD-7:** As an admin, I want to know which venues have been discovered automatically vs. added manually so I can track data provenance.
- Acceptance Criteria: Given a venue was added via the discovery pipeline, when I view it in the audit table, then its "Data source" column shows "Discovered" and its provenance shows "ChicagoPlays" (or the relevant source).

### End User Stories (Indirect)

**US-VD-8:** As a newcomer to Chicago theater, I want the AI mentor to know about the full range of Chicago theaters — not just the 37 biggest ones — so recommendations feel comprehensive and locally authentic.
- Acceptance Criteria: Given the discovery pipeline has populated 180+ venues, when I ask the mentor for "small storefront theaters in my neighborhood", then the mentor has enough venue data to give specific, neighborhood-accurate recommendations beyond the initial seed set.

---

## 5. Non-Functional Requirements

### Performance

| Requirement | Target |
|-------------|--------|
| Discovery run duration (ChicagoPlays + dedup + enrichment for 200 venues) | < 8 minutes total. Achieved by batching enrichment (10 venues/batch, 200ms delay) and running dedup synchronously after parse. |
| Admin Coverage tab load time | < 1.5s for metrics card (RPC). < 3s for full audit table (50 rows). |
| Promotion form open to confirmation | < 500ms (client-side form, single INSERT on confirm). |
| Edge Function wall-clock limit | Stay under Supabase's 50s timeout. Emit NDJSON stream (same pattern as `event-scraper`) to keep the connection alive for longer runs. |

### Security

- The `venue-discovery` Edge Function authenticates via `x-scraper-key` header (shared secret, `SCRAPER_SECRET` env var). No JWT verification for the function endpoint itself (consistent with `event-scraper` pattern — server-to-server cron call).
- The Admin Coverage tab enforces admin-only access at the React route level (existing `isAdmin` check in `AppShell`) and at the RPC level (RLS policy: `auth.jwt() ->> 'role' = 'admin'` or equivalent admin flag on profiles).
- The `venue_discovery_queue` table has RLS enabled. Only the service role key (used by Edge Functions) and admin users (via authenticated RLS policy) can read it. Regular authenticated users cannot access the queue.
- The `venue_sources` table has the same RLS policy.
- Geocoding API keys are stored as Supabase secrets (`supabase secrets set GOOGLE_PLACES_API_KEY=...`). Never in VITE_ env vars.
- External HTML fetches use the same User-Agent string as the event scraper: `ArtOfArt-EventBot/1.0`.

### Reliability

- Idempotency: Re-running discovery for the same source on the same day produces no duplicate queue rows. Idempotency key = `(source_id, raw_name, raw_address)`. If a row with this key exists and is `pending`, skip the insert.
- The pipeline is append-only to `venue_discovery_queue`. It never deletes rows. Admin dismissals set `dedup_status = 'skipped'`, not a hard delete.
- If enrichment fails for a venue, the un-enriched queue row remains available for admin review. Admin can promote with missing enrichment fields and fill them manually.

### Accessibility

- Admin Coverage tab follows existing Admin UI patterns. All tables have proper `<th>` scope, sortable column headers announce sort state via `aria-sort`, action buttons have descriptive `aria-label` ("Promote Neo-Futurists to live database").
- WCAG 2.1 AA compliance on all new UI components.

### Compliance and Legal

- Scraping chicagoplays.com is consistent with the League of Chicago Theatres' public mission of promoting member theaters. The scraped data (venue names, addresses, websites) is publicly listed and used to increase venue visibility — not to compete with the League.
- User-Agent string identifies AOA as the requester, consistent with polite bot behavior.
- Rate limiting: maximum 1 request per second to chicagoplays.com during scraping. No more than 10 concurrent geocoding calls.
- No personal data is scraped or stored in the discovery pipeline. All data is venue-level (public business information).

---

## 6. Technical Considerations

### Architecture Overview

```
[Cron / Admin UI "Run Now"]
         |
         v
[venue-discovery Edge Function]
         |
    +----+-----+
    |          |
[Scrape     [Dedup]
ChicagoPlays]   |
    |      [Enrichment]
    v          |
[venue_discovery_queue] <-- admin reviews here
         |
    [Admin Promotes]
         |
         v
     [venues] <-- existing table, unchanged schema
```

The `venue-discovery` Edge Function is a single Deno function with three internal phases (scrape → dedup → enrich), emitting NDJSON progress events in the same streaming pattern as `event-scraper`.

### New Database Objects

**Tables (new):**
- `venue_sources` — source registry
- `venue_discovery_queue` — discovered venue candidates
- `discovery_runs` — per-run audit log

**Column additions to `venues` (new):**
- `source text DEFAULT 'manual' CHECK IN ('manual', 'discovered', 'scraped')` — provenance
- `discovered_from_source_id uuid REFERENCES venue_sources(id)` — which source produced this venue

**Postgres extensions required:**
- `pg_trgm` — for trigram similarity in fuzzy name matching. Already available in Supabase Postgres.

**New RPC functions:**
- `get_venue_coverage_metrics()` — returns the metrics card data (admin-only)

### Shared Code Reuse

The following existing utilities are reused without modification:
- `_shared/scraper/og-image-extractor.ts` — Step 3 of enrichment (photo extraction)
- `_shared/scraper/html-cleaner.ts` — Pre-processing HTML before calendar URL detection
- `_shared/scraper/slug-generator.ts` — Generating slugs for new venues on promotion
- `_shared/logUsage.ts` — Logging DeepSeek API usage for AI classification calls

### External API Dependencies

| API | Purpose | Cost Estimate | Fallback |
|-----|---------|--------------|---------|
| Google Places Geocoding API | Address → lat/lng | ~$0.005/request × 150 new venues/month = $0.75/month | Nominatim (free, OSM) — lower accuracy but no cost |
| DeepSeek V4 Flash | Venue type classification (fallback only when rules insufficient) | ~$0.10/1M tokens × estimated 50 calls/month = negligible | Rule-based classifier handles ~80% of cases |

### Migration Plan

Migration `20260809000002_venue_discovery.sql` creates:
1. `venue_sources` table with initial seed row for ChicagoPlays
2. `venue_discovery_queue` table
3. `discovery_runs` table
4. `pg_trgm` extension enable (if not already enabled)
5. `source` column addition to `venues` with backfill `UPDATE venues SET source = 'manual'`
6. `discovered_from_source_id` column addition to `venues`
7. RLS policies for all new tables
8. `get_venue_coverage_metrics()` RPC function

### Infrastructure

- Edge Function: `supabase/functions/venue-discovery/index.ts` (new)
- Shared types: extend `_shared/scraper/types.ts` with `DiscoveryResult`, `QueuedVenue` interfaces
- Secrets: `GOOGLE_PLACES_API_KEY` (new) or none if using Nominatim
- Cron schedule: added to the same external cron service calling `event-scraper`, targeting `{SUPABASE_URL}/functions/v1/venue-discovery`

---

## 7. Success Metrics

### 90-Day Targets

| Metric | Baseline | Target | Measurement |
|--------|---------|--------|------------|
| Venue coverage % | 18% (37/~200) | 75% (150+/200) | `get_venue_coverage_metrics()` RPC |
| Venues with calendar_url | Partial (~60%) | 85% of all venues | Audit table filter |
| Venues with photo | Partial (~40%) | 70% of all venues | Audit table filter |
| Manual venue additions | 2-3/month (SQL migration) | 0 SQL migrations | Git commit log |
| Admin time to add a discovered venue | 20-30 min | < 3 min | Admin self-report |
| False positive rate in discovery queue | — | < 5% (dismissed without promoting) | `dedup_status = 'skipped'` count / total |
| Dedup accuracy (no duplicate venues in live DB) | — | 100% | Manual spot check monthly |

### Monitoring

- `discovery_runs.alert_admin = true` rows trigger a review on the next admin session
- Coverage percentage displayed prominently in the Admin Coverage tab header — visible on every admin visit

---

## 8. Risks and Mitigations

### R-1: ChicagoPlays HTML Structure Change

**Risk:** ChicagoPlays redesigns their member directory, breaking the HTML parser. The pipeline silently returns zero results.

**Mitigation:** The zero-result guard in FR-2 (parsing fewer than 20 venues when the source historically returns 150+) fires `alert_admin = true`. Admin sees the alert in the Coverage tab on their next visit. Parser is updated manually. This is a maintenance task, not a data quality incident — the existing 37+ venues are never affected.

**Recovery Time Objective:** 1 week (next admin session after alert).

### R-2: Geocoding API Cost Escalation

**Risk:** If multi-city expansion occurs rapidly, geocoding costs scale linearly with new venues.

**Mitigation:** Nominatim fallback is built in from day one. If Google Places costs exceed $5/month, switch to Nominatim. Geocoding only runs once per new venue (results cached in `venue_discovery_queue`). For existing venues, re-geocoding is never triggered automatically.

### R-3: Duplicate Venues in Live Database

**Risk:** A venue in AOA under a different name variation than ChicagoPlays slips past all three deduplication signals and gets promoted as a duplicate.

**Mitigation:** The admin promotion form displays the venue's address prominently. A nearby-venues check (show venues within 0.1km of the enriched lat/lng) surfaces potential duplicates during promotion. This is a UI safeguard, not a database-level constraint — the admin is the final gate.

### R-4: Venue Promoted Without Complete Enrichment

**Risk:** Admin promotes a venue with no lat/lng, placing it on the map at 0,0 (null island).

**Mitigation:** The promotion form blocks confirmation if `latitude` or `longitude` is null. It displays a warning if enrichment failed and requires the admin to manually enter coordinates before promoting. A "Geocode Now" button in the form re-triggers the geocoding step inline.

### R-5: New Venues Visible to End Users Before Admin Review

**Risk:** The pipeline writes directly to `venues` and new theaters appear on the map before admin review.

**Mitigation:** By design, the pipeline never writes to `venues` directly. Only admin promotion does. The `venue_discovery_queue` table is invisible to end users via RLS. This constraint is enforced at the database level, not just the application level.

---

## 9. Open Questions

| # | Question | Owner | Resolution Path |
|---|---------|-------|----------------|
| OQ-1 | Does ChicagoPlays require JavaScript rendering for their member directory, or is it static HTML? | Engineering | Inspect the page source before implementing. If JS-required, evaluate a Deno headless alternative or fall back to manually exported CSV from the League. |
| OQ-2 | Should the HotTix source be added in this iteration or deferred? HotTix lists 150+ theaters and cross-referencing with ChicagoPlays would improve coverage further. | Product | Defer to v1.1. ChicagoPlays alone covers the gap. HotTix adds complexity without proportional new venue yield. |
| OQ-3 | Nominatim vs. Google Places: which geocoding provider? Cost vs. accuracy tradeoff. | Engineering | Default to Nominatim (free, no API key) for MVP. Add Google Places support behind a feature flag (env var). |
| OQ-4 | Should the discovery pipeline also update existing venue records when new data is found (e.g., updated website URL)? | Product | No for MVP. Dedup matches are read-only — existing venues are authoritative. Consider a "suggest update" queue for existing venues in v1.2. |
| OQ-5 | What is the admin experience for the "nearby venues" duplicate check during promotion? A map-based picker or a text list? | Design | Text list for MVP (simpler). Map picker in a future iteration. |

---

## 10. Out of Scope

The following are explicitly not part of this feature:

- **HotTix ingestion** — Deferred to v1.1
- **Google Places venue discovery** (as a discovery source, not geocoding) — Deferred. ChicagoPlays is the authoritative source.
- **Automatic updates to existing venue records** — Discovery pipeline is append-only to the queue; existing venues are never auto-updated
- **Venue edit form in Admin UI** — The existing venue management UI (if any) handles this; promotion form is for new venues only
- **End-user venue submission** — Users cannot suggest venues in this iteration
- **Event scraping for newly promoted venues** — The existing `event-scraper` picks up promoted venues automatically on its next run (they appear in `venues` with a `calendar_url`)
- **Multi-city discovery** — Pipeline is Chicago-scoped; city filtering is a future concern

---

## 11. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-09 | PRD Specialist | Initial draft |
