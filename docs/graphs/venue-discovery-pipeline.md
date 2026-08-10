# Graph Engineering: Venue Discovery Pipeline

**Date:** 2026-08-09
**Version:** 1.0
**Feature:** Venue Discovery Pipeline
**PRD:** `.claude/docs/prd/venue-discovery-pipeline.md`
**ADR:** `docs/adr/0002-venue-discovery-pipeline.md`

This document is the executable build specification for the Venue Discovery Pipeline feature. It defines the task graph, node specifications, loop patterns, and build phases that Claude Code agents execute to implement the feature node-by-node.

**How to use this document:** Read Section 5 (Build Phases) to find the starting node. Read the node spec and its loop spec. Execute. Mark the node complete. Advance to the next node in the phase.

---

## Section 1: Task Graph Topology

### Nodes

```
FOUNDATION:   vdp-types, vdp-migration
SCRAPER:      vdp-edge-scaffold, vdp-chicagoplays-parser
PIPELINE:     vdp-dedup, vdp-enrichment
ADMIN UI:     vdp-coverage-hook, vdp-coverage-tab
PROMOTION:    vdp-promote-flow
SCHEDULING:   vdp-cron
```

### Edges (→ = "must complete before")

```
vdp-types
    │
    ├──→ vdp-migration
    │         │
    │         └──→ vdp-edge-scaffold
    │                     │
    │               vdp-chicagoplays-parser
    │                     │
    │               vdp-dedup
    │                     │
    │               vdp-enrichment
    │                     │
    │         ┌───────────┴────────────┐
    │         │                        │
    │   vdp-coverage-hook        vdp-promote-flow
    │         │
    │   vdp-coverage-tab ──────────────┘
    │         │
    └──→ vdp-cron
```

### ASCII DAG

```
Phase 1 (Foundation):
  [vdp-types] → [vdp-migration]

Phase 2 (Edge Function):
  [vdp-edge-scaffold] → [vdp-chicagoplays-parser] → [vdp-dedup] → [vdp-enrichment]

Phase 3 (Admin UI — parallel after vdp-enrichment):
  Track A: [vdp-coverage-hook] → [vdp-coverage-tab]
  Track B: [vdp-promote-flow]
  (vdp-coverage-tab depends on both tracks — merge point)

Phase 4 (Schedule):
  [vdp-cron]
```

---

## Section 2: Node Specifications

### Node: vdp-types

- **Type**: types
- **Agent**: backend-architect
- **Depends on**: (none — root node)
- **Inputs**: `.claude/docs/prd/venue-discovery-pipeline.md` §3 (all FR data schemas), `supabase/functions/_shared/scraper/types.ts` (existing interfaces for pattern consistency)
- **Outputs**:
  - `supabase/functions/_shared/scraper/types.ts` — append new interfaces (`DiscoveredVenue`, `EnrichmentCandidate`, `DiscoveryRunSummary`, `QueuedVenueRow`, `VenueCoverageMetrics`) without modifying existing exports
- **Loop pattern**: one-shot
- **Success criteria**: TypeScript compiles without errors; existing types unchanged; all new interfaces used by downstream nodes resolve without import errors
- **Estimated effort**: Small (1–2 hours)

**New interfaces to add:**

```typescript
// Parsed result from ChicagoPlays directory scrape
export interface DiscoveredVenue {
  raw_name: string;
  raw_address: string | null;
  raw_website_url: string | null;
  raw_genre_tags: string[];
  raw_neighborhood: string | null;
  raw_category: string | null;
}

// A queue row ready for enrichment (after dedup marks it 'new')
export interface EnrichmentCandidate {
  id: string;
  raw_name: string;
  raw_address: string | null;
  raw_website_url: string | null;
  raw_genre_tags: string[];
  raw_category: string | null;
}

// Output of the venue type rule-based + AI classifier
export interface VenueTypeResult {
  venue_type: 'storefront' | 'institutional' | 'experimental' | 'school';
  confidence: number;         // 0.0 – 1.0
  method: 'rule' | 'ai';
}

// Per-run summary emitted in the NDJSON stream
export interface DiscoveryRunSummary {
  run_id: string;
  source_id: string;
  venues_found: number;
  venues_new: number;
  venues_matched: number;
  enrichment_success: number;
  enrichment_failed: number;
  ai_input_tokens: number;
  ai_output_tokens: number;
  fetch_status: 'success' | 'fetch_error' | 'parse_error' | 'parse_warning';
  alert_admin: boolean;
  error_message: string | null;
}

// Shape returned by the get_venue_coverage_metrics() RPC
export interface VenueCoverageMetrics {
  total_aoa_venues: number;
  total_known_chicago: number;
  coverage_pct: number;
  venues_with_calendar_url: number;
  venues_with_photo: number;
  venues_zero_events: number;
  pending_in_queue: number;
  last_discovery_run: string | null;    // ISO timestamp
  last_run_alert: boolean;
}
```

---

### Node: vdp-migration

- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: vdp-types
- **Inputs**: `.claude/docs/prd/venue-discovery-pipeline.md` §6 (Migration Plan, Technical Considerations), `supabase/migrations/20260809000001_cost_rpcs.sql` (RPC function pattern), existing `venues` table schema
- **Outputs**:
  - `supabase/migrations/20260809000002_venue_discovery.sql` — single migration file containing all DDL for this feature
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `supabase db push` exits 0
  - Tables exist: `venue_sources`, `venue_discovery_queue`, `discovery_runs`
  - `venues` table has new columns: `source text DEFAULT 'manual'`, `discovered_from_source_id uuid`
  - `pg_trgm` extension active (verify via `SELECT * FROM pg_extension WHERE extname = 'pg_trgm'`)
  - `get_venue_coverage_metrics()` RPC callable, returns correct shape
  - RLS active on all three new tables; anon role cannot select from any of them
  - Seed row for ChicagoPlays present in `venue_sources`
- **Estimated effort**: Medium (3–4 hours)

**Migration contents (ordered):**

1. `CREATE EXTENSION IF NOT EXISTS pg_trgm`
2. `CREATE TABLE venue_sources (...)` with all columns from FR-1
3. `CREATE TABLE venue_discovery_queue (...)` with raw columns (FR-2) and enrichment columns (FR-4)
4. `CREATE TABLE discovery_runs (...)` with all columns from FR-8
5. `ALTER TABLE venues ADD COLUMN source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'discovered', 'scraped'))`
6. `ALTER TABLE venues ADD COLUMN discovered_from_source_id uuid REFERENCES venue_sources(id)`
7. `UPDATE venues SET source = 'manual' WHERE source IS NULL` (backfill)
8. RLS policies for `venue_sources`: service role full access; authenticated + admin role SELECT only; anon no access
9. RLS policies for `venue_discovery_queue`: same as above
10. RLS policies for `discovery_runs`: same as above
11. Seed: `INSERT INTO venue_sources (name, source_type, base_url, scrape_frequency) VALUES ('ChicagoPlays Member Directory', 'directory', 'https://chicagoplays.com/member-theaters/', 'weekly')`
12. `CREATE OR REPLACE FUNCTION get_venue_coverage_metrics()` — SECURITY DEFINER, returns `VenueCoverageMetrics` shape

**`get_venue_coverage_metrics()` query logic:**

```sql
SELECT
  (SELECT COUNT(*) FROM venues) AS total_aoa_venues,
  (SELECT COALESCE(venues_found, 0) FROM discovery_runs ORDER BY created_at DESC LIMIT 1) AS total_known_chicago,
  -- coverage_pct computed from above two values
  (SELECT COUNT(*) FROM venues WHERE calendar_url IS NOT NULL) AS venues_with_calendar_url,
  (SELECT COUNT(*) FROM venues WHERE photo_url IS NOT NULL) AS venues_with_photo,
  (SELECT COUNT(*) FROM venues v WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.venue_id = v.id)) AS venues_zero_events,
  (SELECT COUNT(*) FROM venue_discovery_queue WHERE promoted = false AND dedup_status = 'new') AS pending_in_queue,
  (SELECT started_at FROM discovery_runs ORDER BY created_at DESC LIMIT 1) AS last_discovery_run,
  (SELECT alert_admin FROM discovery_runs ORDER BY created_at DESC LIMIT 1) AS last_run_alert
```

---

### Node: vdp-edge-scaffold

- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: vdp-migration
- **Inputs**: `supabase/functions/event-scraper/index.ts` (NDJSON streaming pattern, shared secret auth, batch loop structure), `supabase/functions/_shared/scraper/types.ts` (new interfaces from vdp-types)
- **Outputs**:
  - `supabase/functions/venue-discovery/index.ts` — scaffolded Edge Function with auth guard, NDJSON stream, phase stubs, and `discovery_runs` insert/update lifecycle
- **Loop pattern**: one-shot
- **Success criteria**:
  - `supabase functions serve venue-discovery` starts without TypeScript errors
  - `curl -H "x-scraper-key: test" http://localhost:54321/functions/v1/venue-discovery` returns 401 for wrong key and a valid NDJSON stream for correct key (stream may be empty stubs at this stage)
  - `discovery_runs` row created on invocation, `completed_at` set on stream close
- **Estimated effort**: Small (1–2 hours)

**Scaffold structure:**

```typescript
// supabase/functions/venue-discovery/index.ts
// Auth: x-scraper-key header (SCRAPER_SECRET env var)
// Stream: NDJSON, Content-Type: application/x-ndjson
// Phases emitted:
//   { type: 'parse',  data: { venues_found: N } }
//   { type: 'dedup',  data: { venue_id, dedup_status, matched_venue_id? } }
//   { type: 'enrich', data: { venue_id, enrichment_status, steps_failed } }
//   { type: 'summary', data: DiscoveryRunSummary }

// Env vars consumed:
//   SCRAPER_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   DEEPSEEK_API_KEY (for venue type AI fallback),
//   GOOGLE_PLACES_API_KEY (optional — falls back to Nominatim if absent)
```

The scaffold inserts a `discovery_runs` row at start and updates it with final counts and `completed_at` after the stream closes. Concurrent-run guard: if a `discovery_runs` row with `completed_at IS NULL` and `started_at > now() - interval '10 minutes'` exists for the same source, return `{ status: 'already_running' }`.

---

### Node: vdp-chicagoplays-parser

- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: vdp-edge-scaffold
- **Inputs**: `supabase/functions/venue-discovery/index.ts` (scaffold), `supabase/functions/_shared/scraper/html-cleaner.ts` (HTML preprocessing), chicagoplays.com HTML structure (must inspect page source before implementing — resolve OQ-1)
- **Outputs**:
  - `supabase/functions/venue-discovery/chicagoplays-parser.ts` — `parseChicagoPlays(html: string): DiscoveredVenue[]`
  - `supabase/functions/venue-discovery/index.ts` — modified to call parser, write results to `venue_discovery_queue`, emit `{ type: 'parse' }` NDJSON events
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - Parser returns > 0 results from real chicagoplays.com HTML (manually verified)
  - Each result has at minimum: `raw_name` (non-empty string), `raw_website_url` (URL or null)
  - Zero-result guard fires: if `results.length < 20`, `alert_admin = true` written to `discovery_runs`
  - Idempotency: re-running with identical HTML does not create duplicate `venue_discovery_queue` rows (ON CONFLICT on `(source_id, raw_name, raw_address)`)
  - Rate limit respected: 1 request to chicagoplays.com; no parallel fetches of sub-pages
- **Estimated effort**: Medium (3–5 hours — depends on chicagoplays.com HTML complexity)

**Implementation notes:**

- Fetch chicagoplays.com with User-Agent `ArtOfArt-EventBot/1.0` (consistent with event-scraper)
- If page returns non-200: set `fetch_status = 'fetch_error'`, increment `consecutive_failures` on `venue_sources` row, return early
- Use `deno-dom` (`https://deno.land/x/deno_dom/deno-dom-wasm.ts`) for DOM parsing if the page structure is class-based; fall back to regex if `deno-dom` is too slow for the runtime budget
- Extract per-member: name (heading text), address (address element text), website (anchor href), any category/tag labels
- Strip whitespace, normalize encoding before writing to queue
- Insert `venue_discovery_queue` rows with `dedup_status = 'pending'`, `enrichment_status = 'pending'`, `source_id`, `run_id`

---

### Node: vdp-dedup

- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: vdp-chicagoplays-parser
- **Inputs**: `supabase/functions/venue-discovery/index.ts` (current state), `.claude/docs/prd/venue-discovery-pipeline.md` §3 FR-3 (three-signal dedup cascade), `pg_trgm` extension (already enabled by vdp-migration)
- **Outputs**:
  - `supabase/functions/venue-discovery/dedup.ts` — `deduplicateQueue(supabase, runId: string): Promise<DedupStats>`
  - `supabase/functions/venue-discovery/index.ts` — modified to call `deduplicateQueue` after parse phase, emit `{ type: 'dedup' }` NDJSON events per resolved row
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - A queue row whose `raw_website_url` exactly matches an existing `venues.website_url` (after normalization) is marked `dedup_status = 'matched'` with correct `matched_venue_id`
  - A queue row whose `raw_address` street + number matches an existing `venues.address` is marked `dedup_status = 'matched'`
  - A queue row whose `raw_name` has trigram similarity > 0.85 against any `venues.name` is marked `dedup_status = 'matched'`
  - A queue row with trigram similarity 0.70–0.85 remains `dedup_status = 'pending'` (requires manual review — no auto-match)
  - A queue row with no signal match is marked `dedup_status = 'new'`
  - A known AOA venue (e.g., "Steppenwolf Theatre" from the 37 seeded venues) is always matched, never appears as `new`
- **Estimated effort**: Medium (3–4 hours)

**Dedup cascade (executed in order, stops at first match):**

```typescript
// Signal 1: Exact URL match (normalize: lowercase, strip trailing slash, strip 'www.')
// Signal 2: Address match (parse street number + street name, case-insensitive, normalize St/Street/Ave/Avenue)
// Signal 3: Trigram similarity via RPC or direct SQL:
//   SELECT id, name, similarity(name, $1) AS sim FROM venues WHERE similarity(name, $1) > 0.70
//   ORDER BY sim DESC LIMIT 1
```

The trigram query uses a Postgres function call (RPC or `supabase.rpc('match_venue_by_name', { candidate: rawName })`) rather than a raw SQL string in the Edge Function. The RPC is defined in the migration as a SECURITY DEFINER function.

---

### Node: vdp-enrichment

- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: vdp-dedup
- **Inputs**:
  - `supabase/functions/venue-discovery/index.ts` (current state with parse + dedup)
  - `supabase/functions/_shared/scraper/og-image-extractor.ts` (reuse `extractOgImage`)
  - `supabase/functions/_shared/scraper/html-cleaner.ts` (reuse `cleanHtml` before calendar URL scan)
  - `supabase/functions/_shared/logUsage.ts` (reuse for DeepSeek AI classification calls)
  - `.claude/docs/prd/venue-discovery-pipeline.md` §3 FR-4 (four enrichment steps)
- **Outputs**:
  - `supabase/functions/venue-discovery/enrichment.ts` — `enrichCandidate(supabase, candidate: EnrichmentCandidate): Promise<EnrichmentUpdate>`
  - `supabase/functions/venue-discovery/geocoder.ts` — `geocode(address: string): Promise<{ lat: number; lng: number; source: string } | null>` (Nominatim default, Google Places if `GOOGLE_PLACES_API_KEY` set)
  - `supabase/functions/venue-discovery/calendar-finder.ts` — `findCalendarUrl(html: string, baseUrl: string): string | null`
  - `supabase/functions/venue-discovery/venue-type-classifier.ts` — `classifyVenueType(candidate: EnrichmentCandidate, websiteText: string | null): Promise<VenueTypeResult>`
  - `supabase/functions/venue-discovery/index.ts` — modified to call enrichment in batches of 10, emit `{ type: 'enrich' }` NDJSON events
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - A new queue row with a valid address gets `enriched_latitude` and `enriched_longitude` set and `geocode_source` recorded
  - A queue row with a website URL gets `enriched_calendar_url` set if any navigation link contains calendar keywords
  - A queue row with a website gets `enriched_photo_url` set from og:image (or null if not found)
  - `enriched_venue_type` is set for all new rows; `method = 'rule'` for clear cases, `method = 'ai'` with DeepSeek call for ambiguous cases
  - Enrichment failure in one step does not block other steps — `enrichment_steps_failed` records which steps errored
  - `enrichment_status = 'complete'` when all steps have been attempted; `'failed'` only if website unreachable and zero data extracted
  - AI calls logged via `logUsage` with `feature = 'venue-discovery'`
  - Batch rate: 10 venues per batch, 200ms delay between venues (Nominatim compliance), 500ms delay between batches
- **Estimated effort**: Large (6–8 hours — four sub-steps with external API calls)

**Geocoder implementation (Nominatim):**

```typescript
// URL: https://nominatim.openstreetmap.org/search
// Params: q=<address>, format=json, limit=1, countrycodes=us
// User-Agent header required: 'ArtOfArt-EventBot/1.0'
// Google Places fallback: https://maps.googleapis.com/maps/api/geocode/json?address=<>&key=<GOOGLE_PLACES_API_KEY>
```

**Calendar URL heuristic (in order of priority):**

1. Link href contains path segment matching: `calendar`, `tickets`, `shows`, `season`, `events`, `productions`
2. Internal links preferred over external
3. Shorter path depth preferred (e.g., `/calendar` beats `/theater/shows/2026/calendar`)
4. If tie: prefer href closest to the top of the HTML document (first match in navigation region)

**Venue type rule-based classifier:**

```typescript
// Rule 1: name contains 'school' | 'training' | 'academy' | 'conservatory' → 'school'
// Rule 2: raw_category === 'Storefront Theater' → 'storefront'
// Rule 3: raw_category contains 'Institutional' → 'institutional'
// Rule 4: genre tags contain 'experimental' or 'devised' and no school indicators → 'experimental'
// Rule 5: Default → 'storefront'
// Ambiguous (confidence < 0.7 after rules): DeepSeek V4 Flash call
//   Prompt: "Classify this Chicago theater: name={name}, tags={tags}, category={category},
//            website text excerpt={excerpt}. Return JSON: {venue_type, confidence}"
```

---

### Node: vdp-coverage-hook

- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: vdp-enrichment
- **Inputs**: `src/hooks/useCostDashboard.ts` (RPC-based hook pattern), `supabase/functions/_shared/scraper/types.ts` (VenueCoverageMetrics interface), `.claude/docs/prd/venue-discovery-pipeline.md` §3 FR-6, FR-7
- **Outputs**:
  - `src/hooks/useVenueCoverage.ts` — hook returning `VenueCoverageMetrics + loading + error + refetch()`
  - `src/hooks/useDiscoveryQueue.ts` — hook returning paginated list of `venue_discovery_queue` rows with `dedup_status = 'new'` and `promoted = false`, plus `dismiss(id, note)` mutation
  - `src/hooks/useVenueAudit.ts` — hook returning paginated venue audit rows (join of `venues` + event count + source provenance), with sort/filter state
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `useVenueCoverage` returns correct metrics when called from a test component; `loading` transitions from true to false; `refetch` triggers a new RPC call
  - `useDiscoveryQueue` returns all pending queue rows; `dismiss(id, note)` updates `dedup_status = 'skipped'` and removes the row from the hook's local state optimistically
  - `useVenueAudit` returns venue rows with event count; sort by `event_count ASC` returns zero-event venues first; filter `has_calendar_url = false` reduces the result set correctly
  - None of the hooks expose data to the anon role — all calls require an authenticated session (enforced by RLS)
- **Estimated effort**: Medium (3–4 hours)

**Hook shapes:**

```typescript
// useVenueCoverage.ts
interface UseCoverageResult {
  metrics: VenueCoverageMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// useDiscoveryQueue.ts
interface QueueItem {
  id: string;
  raw_name: string;
  raw_address: string | null;
  raw_website_url: string | null;
  enriched_venue_type: string | null;
  enriched_calendar_url: string | null;
  enriched_photo_url: string | null;
  enriched_latitude: number | null;
  enriched_longitude: number | null;
  enriched_venue_type_confidence: number | null;
  enrichment_status: string;
  created_at: string;
}
interface UseDiscoveryQueueResult {
  items: QueueItem[];
  loading: boolean;
  dismiss: (id: string, note?: string) => Promise<void>;
  refetch: () => void;
}

// useVenueAudit.ts
interface AuditVenue {
  id: string;
  name: string;
  neighborhood: string | null;
  venue_type: string;
  has_calendar_url: boolean;
  has_photo: boolean;
  event_count: number;
  source: string;
  source_provenance: string;       // 'ChicagoPlays Member Directory' | 'Manual'
  website_url_checked_at: string | null;
}
interface UseVenueAuditResult {
  venues: AuditVenue[];
  loading: boolean;
  sort: 'event_count_asc' | 'event_count_desc' | 'source' | 'neighborhood';
  setSort: (s: UseVenueAuditResult['sort']) => void;
  filters: { missingCalendar: boolean; missingPhoto: boolean; zeroEvents: boolean };
  setFilters: (f: Partial<UseVenueAuditResult['filters']>) => void;
  page: number;
  setPage: (n: number) => void;
}
```

The audit query is a Supabase `from('venues')` join that uses a subquery or computed column for `event_count`. Source provenance is resolved client-side by checking `source === 'discovered'` and fetching the corresponding `venue_sources.name` via the queue row's `source_id` (or the `discovered_from_source_id` on the `venues` row — added in the migration).

---

### Node: vdp-coverage-tab

- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: vdp-coverage-hook, vdp-promote-flow
- **Inputs**: `src/pages/Docs.tsx` (tab pattern, `const tabs`, component organization), `src/hooks/useVenueCoverage.ts`, `src/hooks/useDiscoveryQueue.ts`, `src/hooks/useVenueAudit.ts`
- **Outputs**:
  - `src/pages/Docs.tsx` — modified to add `'Coverage'` to the `tabs` array and render `<CoverageTab />` for that tab
  - `src/components/admin/CoverageMetricsCards.tsx` — summary metric cards (8 metrics from FR-6)
  - `src/components/admin/VenueAuditTable.tsx` — sortable, filterable venue audit table (FR-7)
  - `src/components/admin/DiscoveryQueueSection.tsx` — pending queue items list with Promote/Dismiss actions (FR-7)
  - `src/components/admin/RunDiscoveryButton.tsx` — "Run Discovery Now" button that POSTs to the venue-discovery Edge Function with auth header
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - Navigating to `/app/admin` and clicking the Coverage tab renders without errors
  - Metrics cards display correct values from `useVenueCoverage` (loading state visible while fetching)
  - Venue audit table renders with correct columns; sort by event count works; filters toggle correctly; pagination at 50 rows
  - Discovery queue section shows pending items; Dismiss sets `dedup_status = 'skipped'` and removes from UI
  - "Promote" button on a queue item opens the promotion form (from vdp-promote-flow)
  - "Run Discovery Now" button triggers the Edge Function and shows a progress/loading indicator; on completion, `refetch()` is called on both hooks
  - Admin-only gate enforced: non-admin users cannot access `/app/admin` (existing `isAdmin` check in AppShell covers this at the route level)
  - WCAG 2.1 AA: table `<th>` elements have `scope` attributes; sort buttons announce `aria-sort`; action buttons have descriptive `aria-label`
- **Estimated effort**: Large (6–8 hours — multiple sub-components, table interactions, live trigger button)

**Tab integration in `Docs.tsx`:**

```typescript
// Change:
const tabs = ['Design', 'AI Prompts', 'Costs'] as const
// To:
const tabs = ['Design', 'AI Prompts', 'Costs', 'Coverage'] as const

// Add Coverage case in render:
{tab === 'Coverage' && <CoverageTab />}
```

`CoverageTab` is a local component in `Docs.tsx` that imports and composes the four new admin components. It does not hold state — all state lives in the hooks.

**"Run Discovery Now" flow:**

```typescript
// POST to: ${VITE_SUPABASE_URL}/functions/v1/venue-discovery
// Headers: { 'x-scraper-key': import.meta.env.VITE_SCRAPER_KEY_PUBLIC }
// Note: VITE_SCRAPER_KEY_PUBLIC is a read-only trigger key — separate from the
//       full SCRAPER_SECRET used by the actual cron. The Edge Function accepts
//       both. See vdp-cron node for the cron-only secret vs admin-trigger key
//       discussion.
// On response: read NDJSON stream, update a local progress counter per event type,
//              call refetch() on hooks after stream closes.
```

The "Run Discovery Now" button requires special consideration: the `SCRAPER_SECRET` must not be in a VITE_ env var (anti-patterns.md). The solution is that the admin UI calls the function via the Supabase client using the user's JWT as a Bearer token, and the Edge Function has a second auth path: if the caller has a valid JWT from an admin user (checked via `supabase.auth.getUser(token)` → `profiles.is_admin`), the function proceeds. This keeps the secret server-side while allowing admin-triggered runs.

---

### Node: vdp-promote-flow

- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: vdp-enrichment
- **Inputs**: `supabase/functions/_shared/scraper/slug-generator.ts` (slug generation logic for reference — reimplemented client-side), `.claude/docs/prd/venue-discovery-pipeline.md` §3 FR-5 (promotion behavior, form fields, bulk promotion)
- **Outputs**:
  - `src/components/admin/VenuePromoteModal.tsx` — modal form pre-filled with enriched data, editable fields, slug collision handling, lat/lng validation gate, "Geocode Now" inline retry, Confirm/Cancel actions
  - `src/hooks/useVenuePromotion.ts` — `promote(queueId: string, overrides: Partial<VenueInsert>): Promise<{ venueId: string }>` — executes atomic insert to `venues` + update to `venue_discovery_queue`
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - Clicking "Promote" on a queue item opens `VenuePromoteModal` with all enriched fields pre-populated
  - `name`, `slug` (auto-generated, editable), `venue_type`, `address`, `latitude`, `longitude`, `website_url`, `calendar_url`, `genre_tags` are pre-filled from queue row enriched data
  - `description` and `price_range` fields are blank (admin fills in)
  - Confirming with null `latitude` or `longitude` is blocked — validation error displayed inline
  - Slug collision handled: if the generated slug already exists in `venues`, a numeric suffix (`-2`, `-3`) is appended automatically
  - On successful confirm: `venues` row inserted with `source = 'discovered'`, `discovered_from_source_id` set; `venue_discovery_queue.promoted = true`, `promoted_venue_id` set
  - New venue appears on the map without a page reload (Supabase Realtime or refetch of map venue query — whichever is consistent with existing `useMap` pattern)
  - "Dismiss" button on a queue item calls `dismiss(id, note)` from `useDiscoveryQueue` hook — no modal needed
  - Slug generation client-side mirrors `slug-generator.ts` logic: `{name}-{normalized}` lowercased, non-alphanumeric → hyphens, max 80 chars
  - Nearby-venues check: after geocoding resolves lat/lng, display a text list of any existing venues within 0.1° (~11km) — warns admin of potential duplicate before confirming
- **Estimated effort**: Medium (4–5 hours — form validation, slug collision, nearby check)

---

### Node: vdp-cron

- **Type**: config
- **Agent**: devops-engineer
- **Depends on**: vdp-coverage-tab (all feature nodes complete)
- **Inputs**: `supabase/functions/event-scraper/index.ts` (existing cron setup reference), `.claude/docs/prd/venue-discovery-pipeline.md` §3 FR-8 (schedule spec), `supabase/functions/venue-discovery/index.ts` (deployed URL)
- **Outputs**:
  - External cron service configuration (same service used for `event-scraper`) — new entry for `venue-discovery`, weekly schedule, Sunday 02:00 CST
  - Documentation update in `CLAUDE.md` or a new `docs/runbooks/venue-discovery-cron.md` recording the cron URL, header, and schedule
- **Loop pattern**: one-shot
- **Success criteria**:
  - `supabase functions deploy venue-discovery` exits 0
  - Manual `curl -H "x-scraper-key: $SCRAPER_SECRET" {SUPABASE_FUNCTION_URL}/venue-discovery` returns 200 with NDJSON stream
  - Cron service entry created with correct URL, `x-scraper-key` header, and Sunday 02:00 CST schedule
  - A test manual trigger via the Admin Coverage tab ("Run Discovery Now") succeeds without the cron secret — confirming the dual-auth path works
- **Estimated effort**: Small (1–2 hours)

---

## Section 3: Loop Specifications

### Loop: vdp-migration

- **Trigger**: vdp-types complete
- **Inner cycle**:
  1. Discover: read existing migration files for naming conventions; read PRD §6 Migration Plan; read cost_rpcs.sql for RPC function pattern
  2. Plan: draft all DDL in sequence; review RLS policies for each table; draft `get_venue_coverage_metrics()` with correct return columns
  3. Execute: write `20260809000002_venue_discovery.sql`; run `supabase db push`
  4. Verify: confirm all tables exist via Supabase MCP `list_tables`; execute `get_venue_coverage_metrics()` via MCP `execute_sql`; confirm RLS via `execute_sql` with anon role simulation; confirm seed row in `venue_sources`
- **Evaluator**: all success criteria pass without manual intervention
- **Retry**: on failure → read error output → identify specific DDL issue → fix → re-push → re-verify (max 3 cycles)
- **Stop condition**: all tables present, RPC callable, RLS active, seed data loaded

### Loop: vdp-chicagoplays-parser

- **Trigger**: vdp-edge-scaffold complete
- **Inner cycle**:
  1. Discover: `curl https://chicagoplays.com/member-theaters/` and inspect HTML structure; identify CSS classes or patterns for member listing items, name, address, website, category
  2. Plan: write `parseChicagoPlays(html)` targeting discovered HTML structure; decide between `deno-dom` and regex based on DOM complexity; plan idempotency key
  3. Execute: implement parser; integrate into Edge Function; add zero-result guard
  4. Verify: deploy function locally; trigger with real chicagoplays.com HTML; inspect `venue_discovery_queue` rows; confirm > 20 rows created; confirm idempotent re-run produces no duplicates
- **Evaluator**: parser extracts > 100 venues from live chicagoplays.com; all rows have non-empty `raw_name`; zero duplicates on second run
- **Retry**: on failure → inspect HTML structure change → update selectors → re-verify (max 3 cycles)
- **Stop condition**: > 100 venues parsed from live site, dedup-safe

### Loop: vdp-dedup

- **Trigger**: vdp-chicagoplays-parser complete
- **Inner cycle**:
  1. Discover: read FR-3 cascade; check which existing venues are in the seed data that chicagoplays.com would also list
  2. Plan: write `deduplicateQueue(supabase, runId)` — URL normalization function, address parsing function, trigram RPC call
  3. Execute: implement three-signal cascade; add Postgres RPC `match_venue_by_name` to migration (may require a migration amendment)
  4. Verify: after a parser run, manually inspect queue rows — known venues (Steppenwolf, Goodman, etc.) should be `matched`; novel venues should be `new`; confirm no `pending` rows remain for the test run
- **Evaluator**: zero false-new results for the 37 known AOA venues; trigram query resolves within 200ms for 200 candidates
- **Retry**: on failure → inspect misclassified rows → tune normalization or similarity threshold → re-verify (max 3 cycles)
- **Stop condition**: all 37 known venues correctly matched; novel venues marked new

### Loop: vdp-enrichment

- **Trigger**: vdp-dedup complete
- **Inner cycle**:
  1. Discover: read FR-4 enrichment steps; identify 3 queue rows with `dedup_status = 'new'` from a real discovery run for testing
  2. Plan: implement each sub-module in order (geocoder → calendar-finder → og-image → classifier); plan batch loop with 200ms delay
  3. Execute: implement all four sub-modules; integrate into Edge Function phase 3
  4. Verify: run enrichment against the 3 test queue rows; confirm `enriched_latitude/longitude` populated; `enriched_calendar_url` found where links exist; `enriched_photo_url` extracted; `enriched_venue_type` set; `enrichment_status = 'complete'` on all rows; AI usage logged in `ai_usage`
- **Evaluator**: all four enrichment fields populated for at least 2 of 3 test venues; `logUsage` called for any AI classification; no unhandled exceptions
- **Retry**: on failure per step → log `enrichment_steps_failed`, continue to next step → fix in isolation → re-run → re-verify (max 3 cycles per step)
- **Stop condition**: enrichment completes for a batch of 10 real queue rows with correct field population

### Loop: vdp-coverage-tab

- **Trigger**: vdp-coverage-hook and vdp-promote-flow both complete
- **Inner cycle**:
  1. Discover: read `Docs.tsx` tab architecture; inspect existing admin route protection in AppShell; read all three hook return shapes
  2. Plan: design `CoverageTab` component tree; plan metric card layout (8 cards); plan audit table column widths for mobile
  3. Execute: add `'Coverage'` to tabs array in `Docs.tsx`; build `CoverageMetricsCards`, `VenueAuditTable`, `DiscoveryQueueSection`, `RunDiscoveryButton`
  4. Verify: navigate to `/app/admin` → Coverage tab; confirm metrics render; sort audit table by event count; filter by missing calendar; dismiss a queue item; run "Run Discovery Now" and observe NDJSON progress
- **Evaluator**: all success criteria pass; no console errors; WCAG spot check on table headers and action buttons
- **Retry**: on failure → fix specific component → re-verify in browser → (max 3 cycles)
- **Stop condition**: full Coverage tab renders, all interactions work, Promote/Dismiss functional

### Loop: vdp-promote-flow

- **Trigger**: vdp-enrichment complete
- **Inner cycle**:
  1. Discover: read FR-5 promotion behavior; read existing `venues` table schema from migration files; inspect `supabase/functions/_shared/scraper/slug-generator.ts` for slug logic to mirror client-side
  2. Plan: design `VenuePromoteModal` field layout; plan slug collision loop; plan lat/lng validation gate; plan nearby-venues query
  3. Execute: build `VenuePromoteModal` and `useVenuePromotion`; implement atomic venue insert + queue update
  4. Verify: promote a real queue row in staging; verify it appears in `venues` with `source = 'discovered'`; verify `venue_discovery_queue.promoted = true`; verify slug collision handling with manually forced collision; verify lat/lng null block
- **Evaluator**: venue promoted successfully; appears on map without reload; queue row marked promoted; slug collision resolved automatically
- **Retry**: on failure → fix specific validation or DB error → re-verify (max 3 cycles)
- **Stop condition**: full promote flow works end-to-end; dismiss works; no console errors

---

## Section 4: Shared State Schema

| Key | Type | Set by | Consumed by |
|-----|------|--------|-------------|
| `chicagoplays_source_id` | `uuid` | vdp-migration (seed row) | vdp-chicagoplays-parser (source_id FK), vdp-coverage-hook (provenance display) |
| `run_id` | `uuid` | vdp-edge-scaffold (per invocation) | vdp-chicagoplays-parser, vdp-dedup, vdp-enrichment (groups all queue rows per run), vdp-coverage-hook (last run display) |
| `dedup_threshold_high` | `float` | vdp-dedup (0.85 constant) | vdp-dedup only — tunable if false positive rate too high |
| `dedup_threshold_ambiguous` | `float` | vdp-dedup (0.70 constant) | vdp-dedup only |
| `enrichment_batch_size` | `int` | vdp-enrichment (10 constant) | vdp-enrichment only |
| `geocode_provider` | `'nominatim' \| 'google'` | vdp-enrichment (runtime: env var present?) | vdp-coverage-hook (provenance on queue rows) |
| `admin_jwt` | `string` | vdp-coverage-tab (Supabase session) | vdp-coverage-tab "Run Discovery Now" auth path |

---

## Section 5: Build Phases

Nodes within a phase can run in parallel (fan out via Claude Code subagents). All nodes in a phase must pass verification before advancing to the next phase.

### Phase 1: Foundation

- [ ] vdp-types
- [ ] vdp-migration

Run sequentially. vdp-types must complete before vdp-migration because the migration's `get_venue_coverage_metrics()` RPC return shape is informed by the TypeScript interfaces. In practice this is a 30-minute sequential dependency.

### Phase 2: Edge Function Pipeline

Run sequentially — each node builds on the previous node's output in the same file.

- [ ] vdp-edge-scaffold
- [ ] vdp-chicagoplays-parser
- [ ] vdp-dedup
- [ ] vdp-enrichment

After this phase, the full discovery pipeline is functional end-to-end. A manual trigger via `curl` produces a populated `venue_discovery_queue` with enriched rows.

### Phase 3: Admin UI

Run in parallel after Phase 2. Both tracks must complete before vdp-coverage-tab.

**Track A (data layer):**
- [ ] vdp-coverage-hook

**Track B (promotion flow):**
- [ ] vdp-promote-flow

**Merge (depends on both tracks):**
- [ ] vdp-coverage-tab

### Phase 4: Scheduling

- [ ] vdp-cron

Run after Phase 3 is fully verified. Cron setup is the last step because it requires the deployed function URL, which is only stable after all function code is finalized and deployed.

---

## Appendix: File Index

All files created or modified by this feature, organized by layer.

### Database

| File | Node | Action |
|------|------|--------|
| `supabase/migrations/20260809000002_venue_discovery.sql` | vdp-migration | Create |

### Edge Function

| File | Node | Action |
|------|------|--------|
| `supabase/functions/venue-discovery/index.ts` | vdp-edge-scaffold | Create; modified by parser, dedup, enrichment |
| `supabase/functions/venue-discovery/chicagoplays-parser.ts` | vdp-chicagoplays-parser | Create |
| `supabase/functions/venue-discovery/dedup.ts` | vdp-dedup | Create |
| `supabase/functions/venue-discovery/enrichment.ts` | vdp-enrichment | Create |
| `supabase/functions/venue-discovery/geocoder.ts` | vdp-enrichment | Create |
| `supabase/functions/venue-discovery/calendar-finder.ts` | vdp-enrichment | Create |
| `supabase/functions/venue-discovery/venue-type-classifier.ts` | vdp-enrichment | Create |
| `supabase/functions/_shared/scraper/types.ts` | vdp-types | Modify (append) |

### React / Frontend

| File | Node | Action |
|------|------|--------|
| `src/hooks/useVenueCoverage.ts` | vdp-coverage-hook | Create |
| `src/hooks/useDiscoveryQueue.ts` | vdp-coverage-hook | Create |
| `src/hooks/useVenueAudit.ts` | vdp-coverage-hook | Create |
| `src/hooks/useVenuePromotion.ts` | vdp-promote-flow | Create |
| `src/components/admin/CoverageMetricsCards.tsx` | vdp-coverage-tab | Create |
| `src/components/admin/VenueAuditTable.tsx` | vdp-coverage-tab | Create |
| `src/components/admin/DiscoveryQueueSection.tsx` | vdp-coverage-tab | Create |
| `src/components/admin/RunDiscoveryButton.tsx` | vdp-coverage-tab | Create |
| `src/components/admin/VenuePromoteModal.tsx` | vdp-promote-flow | Create |
| `src/pages/Docs.tsx` | vdp-coverage-tab | Modify (add Coverage tab) |

### Documentation / Config

| File | Node | Action |
|------|------|--------|
| `docs/adr/0002-venue-discovery-pipeline.md` | (this design phase) | Create |
| `docs/graphs/venue-discovery-pipeline.md` | (this design phase) | Create |
| `docs/runbooks/venue-discovery-cron.md` | vdp-cron | Create |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-09 | Sashiko (code-architect) | Initial draft |
