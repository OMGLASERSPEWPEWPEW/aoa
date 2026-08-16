# Graph Engineering: Art Classes Discovery

**Version:** 0.2.0
**Generated:** 2026-08-16 (updated from 0.1.0)
**Nodes:** 16 | **Phases:** 5 | **Loop specs:** 12
**PRD:** `.claude/docs/prd/art-classes-discovery.md`
**ADR:** `docs/adr/0006-art-classes-discovery.md`
**QA:** `docs/qa/art-classes-discovery.md`

---

## Section 1: Task Graph Topology

### Nodes

```
SCHEMA:       acd-class-fields, acd-school-venues-seed, acd-class-coverage-rpc
SCRAPER:      acd-extraction-prompt, acd-verification-prompt, acd-types, acd-strategy-tree-config
DISCOVERY:    acd-class-discovery-fn
MAP:          acd-map-marker, acd-map-view-integration, acd-map-filter-chip, acd-map-key
VENUE SHEET:  acd-venue-sheet-class-section
ADMIN:        acd-admin-button, acd-admin-stats
CRON:         acd-cron
```

### Edges (→ = "must complete before")

```
acd-class-fields
    │
    ├──→ acd-school-venues-seed
    │         │
    │         └──→ acd-class-coverage-rpc
    │
    ├──→ acd-types
    │         │
    │         ├──→ acd-extraction-prompt
    │         │         │
    │         │         └──→ acd-verification-prompt
    │         │                     │
    │         │               acd-strategy-tree-config
    │         │
    │         └──→ acd-class-discovery-fn
    │                     │
    │               acd-admin-button
    │
    ├──→ acd-map-marker
    │         │
    │         └──→ acd-map-view-integration
    │                     │
    │         ┌───────────┘
    │         │
    │   acd-map-filter-chip ──→ acd-map-key
    │
    └──→ acd-venue-sheet-class-section

[acd-admin-stats depends on acd-class-coverage-rpc + acd-admin-button]
[acd-cron depends on acd-class-discovery-fn]
```

### ASCII DAG

```
Phase 1 (Schema — must run first):
  [acd-class-fields] → [acd-school-venues-seed] → [acd-class-coverage-rpc]

Phase 2 (Scraper Extension — parallel tracks after Phase 1):
  Track A: [acd-types] → [acd-extraction-prompt] → [acd-verification-prompt] → [acd-strategy-tree-config]
  Track B: [acd-types] → [acd-class-discovery-fn]

Phase 3 (Frontend — parallel with Phase 2, depends on Phase 1 types):
  Track C: [acd-map-marker] → [acd-map-view-integration]
  Track D: [acd-map-filter-chip] → [acd-map-key]
  Track E: [acd-venue-sheet-class-section]

Phase 4 (Admin — depends on Phase 1 + Phase 2B):
  [acd-admin-button] → [acd-admin-stats]

Phase 5 (Schedule — depends on Phase 2B):
  [acd-cron]
```

---

## Section 2: Node Specifications

### Node: acd-class-fields

- **Type**: schema
- **Agent**: backend-architect
- **Depends on**: (none — root node)
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §FR-1
- **Outputs**:
  - `supabase/migrations/20260815000010_class_fields.sql` (new file)
  - `src/lib/types.ts` (modified — add 4 fields to `Event` interface)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `SELECT column_name FROM information_schema.columns WHERE table_name = 'events' AND column_name IN ('instructor_name', 'skill_level', 'session_count', 'class_format')` returns 4 rows
- **Estimated effort**: Trivial

---

### Node: acd-school-venues-seed

- **Type**: schema
- **Agent**: backend-architect
- **Depends on**: acd-class-fields
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §FR-2 (exact SQL provided)
- **Outputs**:
  - `supabase/migrations/20260815000011_seed_class_venues.sql` (new file)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `SELECT COUNT(*) FROM venues WHERE venue_type = 'school'` returns ≥ 8
- **Estimated effort**: Trivial

---

### Node: acd-class-coverage-rpc

- **Type**: schema
- **Agent**: backend-architect
- **Depends on**: acd-school-venues-seed
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §FR-8 (exact SQL for RPC provided)
- **Outputs**:
  - `supabase/migrations/20260815000012_class_coverage_rpc.sql` (new file)
- **Loop pattern**: one-shot
- **Success criteria**: `SELECT public.get_class_coverage_metrics()` returns JSON with keys `class_venue_count`, `class_event_count`, `class_with_instructor`, `class_with_level`
- **Estimated effort**: Trivial

---

### Node: acd-types

- **Type**: types
- **Agent**: backend-architect
- **Depends on**: acd-class-fields
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §FR-3, `supabase/functions/_shared/scraper/types.ts`
- **Outputs**:
  - `supabase/functions/_shared/scraper/types.ts` (modified)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: All four interfaces updated — `Pass1Event`, `ScrapedEvent`, `Pass2Verification`, plus new `MergedEvent` fields; TypeScript compilation succeeds with `npm run build`
- **Estimated effort**: Small

**Exact changes:**

Add to `Pass1Event` (after `show_times`):
```typescript
instructor_name?: string | null;
skill_level?: string | null;
session_count?: number | null;
class_format?: string | null;
```

Add to `ScrapedEvent` (after `cast_members`):
```typescript
instructor_name: string | null;
skill_level: string | null;
session_count: number | null;
class_format: string | null;
```

Add to `Pass2Verification` (after `photo_url`):
```typescript
instructor_name?: string | null;
skill_level?: string | null;
session_count?: number | null;
class_format?: string | null;
```

---

### Node: acd-extraction-prompt

- **Type**: config
- **Agent**: backend-architect
- **Depends on**: acd-types
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §FR-3, `supabase/functions/_shared/scraper/extraction-prompt.ts`
- **Outputs**:
  - `supabase/functions/_shared/scraper/extraction-prompt.ts` (modified)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Call `buildExtractionPrompt("iO Chicago")` and confirm the returned string contains "instructor_name", "skill_level", "session_count", "class_format"
- **Estimated effort**: Small

**Exact change:** Append the CLASS-SPECIFIC FIELDS block (as specified in PRD §FR-3) immediately before the final closing backtick of the return string. The block starts with `\nCLASS-SPECIFIC FIELDS` and ends with `For show events, omit these keys entirely`.

---

### Node: acd-verification-prompt

- **Type**: config
- **Agent**: backend-architect
- **Depends on**: acd-extraction-prompt
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §FR-3, `supabase/functions/_shared/scraper/verification-prompt.ts`
- **Outputs**:
  - `supabase/functions/_shared/scraper/verification-prompt.ts` (modified)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `buildVerificationPrompt("iO Chicago", [{title: "Improv 101", event_type: "class"}])` returns string containing "instructor_name", "skill_level", "session_count", "class_format"
- **Estimated effort**: Small

**Exact changes:**

1. In the ENRICHMENT section (after `photo_url` line), append the 4-field block specified in PRD §FR-3.
2. Add the four fields to the example JSON output in the prompt (inside the `"events"` array object).

---

### Node: acd-strategy-tree-config

- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: acd-verification-prompt
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §FR-3, `docs/graphs/multi-pass-extraction.md`
- **Outputs**:
  - `supabase/functions/_shared/scraper/types.ts` (modified — add `StrategyProfile` interface, extend `TargetedEnrichment` with class fields)
  - `supabase/functions/_shared/scraper/completeness-evaluator.ts` (modified — add `CLASS_FIELD_WEIGHTS`, make functions accept optional weights, threshold-based `needsFollow`, class field merging)
  - `supabase/functions/_shared/scraper/targeted-prompt.ts` (modified — add optional `includeClassFields` param)
  - `supabase/functions/_shared/scraper/strategy-agent.ts` (modified — accept `StrategyProfile`, skip TIC for classes, carry class fields through merge, export `MergedEvent`)
  - `supabase/functions/_shared/scraper/process-venue.ts` (modified — accept `ProcessVenueOptions`, conditional play matcher, class field validation in upsert)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `npm run build` clean. Existing event-scraper still works (backward compat — all new params optional with defaults). Class-discovery can call `processVenue(school, runId, { profile: CLASS_PROFILE, defaultEventType: "class" })`.
- **Estimated effort**: Medium

**Architecture**: Makes the v2 deterministic strategy tree configurable via `StrategyProfile`:
- `domain: "theater" | "class"` — controls TIC skip, play matcher skip
- `fieldWeights` — class weights: start_date(30), end_date(10), price(15), ticket_url(10), show_times(5), instructor_name(15), skill_level(10)
- `logFeaturePrefix` — "class-discovery" for usage logs
- `needsFollow` changed from `!event.start_date` to `score < 50%` (threshold-based, configurable via weights)
- `mergeExtractionResults` carries class fields from Pass1/Pass2
- `process-venue.ts` validates skill_level/class_format against allowlists, skips play matcher for class domain

---

### Node: acd-class-discovery-fn

- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: acd-strategy-tree-config
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §FR-4, `supabase/functions/_shared/scraper/process-venue.ts`
- **Outputs**:
  - `supabase/functions/class-discovery/index.ts` (rewritten — ~307 lines, down from 680)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `curl -X POST $SUPABASE_URL/functions/v1/class-discovery -H "x-scraper-key: $SCRAPER_SECRET"` returns 200 with NDJSON stream containing at least one `{"type":"school_scrape",...}` line (with `extraction_status` and `missing_fields`) and a final `{"type":"summary",...}` line
- **Estimated effort**: Small (v0.2.0 — mostly deletion of duplicated code)

**Architecture (v0.2.0):**
- Imports `processVenue` from `_shared/scraper/process-venue.ts` — NO duplicated scraper code
- Defines `CLASS_PROFILE: StrategyProfile` with `domain: "class"`, `CLASS_FIELD_WEIGHTS`, `logFeaturePrefix: "class-discovery"`
- Calls `processVenue(school, runId, { profile: CLASS_PROFILE, defaultEventType: "class" })` per school
- Gets link following, completeness evaluation, budget enforcement, gap annotations, and strategy traces for free via the shared strategy tree
- Retains unique SerpAPI discovery phase: `searchForSchools()` + `deduplicateAndQueue()`
- CORS, auth, NDJSON streaming — same pattern as all Edge Functions

---

### Node: acd-map-marker

- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: acd-class-fields (for `hasClassEvents` prop)
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §FR-5, `src/components/MapMarker.tsx`
- **Outputs**:
  - `src/components/MapMarker.tsx` (modified)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: In the dev browser, a venue with `venue_type = 'school'` renders a 38×44px amber diamond marker. A venue with `venue_type = 'storefront'` renders the existing 34×40px marker unchanged.
- **Estimated effort**: Small

**Exact changes (2 locations in `src/components/MapMarker.tsx`):**

Location 1 — Props interface: add `hasClassEvents: boolean` after `dimmed`.

Location 2 — After `chip.style.transition = 'transform 120ms'` and the `chip.style.transform = ...` line, insert the class marker override block per PRD §FR-5 spec. The block uses `if (hasClassEvents)` to override container dimensions, chip dimensions, glyph, and colors. Must come AFTER the existing relationship-based coloring so it fully overrides.

---

### Node: acd-map-view-integration

- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: acd-map-marker
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §FR-5, `src/components/MapView.tsx`
- **Outputs**:
  - `src/components/MapView.tsx` (modified)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: With 8 school venues in DB and class events loaded, the map renders amber diamond markers at those venue locations. Toggling the CLASSES filter chip dims non-school markers.
- **Estimated effort**: Small

**Exact changes (2 locations in `src/components/MapView.tsx`):**

Location 1 — Inside the `for (const venue of timeFilteredVenues)` loop, add before `createMarkerElement`:
```typescript
const hasClassEvents = venueEvents.some(e => e.event_type === 'class' || e.event_type === 'workshop')
```

Location 2 — Pass `hasClassEvents` to `createMarkerElement`.

Also add `'classes'` case to `isVenueDimmed` and `filterCounts` per PRD §FR-7.

---

### Node: acd-map-filter-chip

- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: acd-class-fields
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §FR-7, `src/components/MapFilterChips.tsx`
- **Outputs**:
  - `src/components/MapFilterChips.tsx` (modified)
- **Loop pattern**: one-shot
- **Success criteria**: The map filter chip row displays a "CLASSES" chip. Tapping it dims all venues that have no class events. Untapping restores all markers.
- **Estimated effort**: Trivial

**Exact change:** Append `{ key: 'classes', label: 'CLASSES' }` to the `FILTERS` array in `MapFilterChips.tsx`. No other changes to this file — the display/active logic is already generic.

---

### Node: acd-map-key

- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: acd-map-filter-chip
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §FR-5, `src/components/MapKey.tsx`
- **Outputs**:
  - `src/components/MapKey.tsx` (modified)
- **Loop pattern**: one-shot
- **Success criteria**: The map key (visible bottom-left on the map) includes a `◇  Classes & Workshops` entry in amber `#D4A017`.
- **Estimated effort**: Trivial

**Exact change:** Read `MapKey.tsx` to understand current structure. Add a legend row with glyph `◇`, color `#D4A017`, label `Classes & Workshops`. Follow the exact same element style as existing key rows.

---

### Node: acd-venue-sheet-class-section

- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: acd-class-fields (for new Event fields in types)
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §FR-6, `src/components/VenueSheet.tsx`
- **Outputs**:
  - `src/components/VenueSheet.tsx` (modified)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Open a school venue on the map (e.g., iO Chicago). The VenueSheet shows a "CLASSES AT THIS VENUE" section with amber border. Each class shows title, instructor (if present), skill level chip, format chip, session count, price, dates, and ENROLL link. A non-school venue (e.g., a storefront theater) shows NO classes section.
- **Estimated effort**: Small

**Exact changes (2 locations in `src/components/VenueSheet.tsx`):**

Location 1 — After the `upcomingEvents` useMemo (after line ~132), add the `classEvents` useMemo per PRD §FR-6 spec.

Location 2 — In the JSX, insert the class events block per PRD §FR-6 spec. Position: after the PWYC/Usher block and before the action buttons (WEBSITE + directions). This exact position matters — class info is more important than navigation.

---

### Node: acd-admin-button

- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: acd-class-discovery-fn
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §FR-8, `src/components/ScraperDashboard.tsx`
- **Outputs**:
  - `src/components/ScraperDashboard.tsx` (modified)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Admin panel Coverage tab shows a "DISCOVER CLASSES" button. Pressing it fires a POST to `class-discovery` Edge Function. The NDJSON stream output appears in the log panel (same as the existing scraper stream). Button is disabled while discovery is running.
- **Estimated effort**: Small

**Implementation note:** Read `ScraperDashboard.tsx` to understand the existing `handleRunScraper` function and NDJSON stream reading loop. Copy that exact pattern for `handleDiscoverClasses`. The streaming UI (log lines appearing in real-time) is already implemented — reuse it.

---

### Node: acd-admin-stats

- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: acd-class-coverage-rpc, acd-admin-button
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §FR-8, `src/components/ScraperDashboard.tsx`, `src/components/admin/CoverageMetricsCards.tsx`
- **Outputs**:
  - `src/components/ScraperDashboard.tsx` (modified)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Admin Coverage tab shows a "CLASS COVERAGE" row with 4 stat boxes: SCHOOLS (count), CLASSES (count), W/ INSTRUCTOR (count), W/ LEVEL (count). Values match `SELECT public.get_class_coverage_metrics()`.
- **Estimated effort**: Small

**Implementation note:** Call `supabase.rpc('get_class_coverage_metrics')` on mount (same pattern as `get_venue_coverage_metrics` call in `CoverageMetricsCards.tsx`). Display results in inline stat boxes styled with the same `mono` font and small-number + label pattern as existing coverage cards.

---

### Node: acd-cron

- **Type**: config
- **Agent**: backend-architect
- **Depends on**: acd-class-discovery-fn
- **Inputs**: `.claude/docs/prd/art-classes-discovery.md` §5 Infrastructure, `supabase/migrations/` (check for existing cron migrations)
- **Outputs**:
  - `supabase/migrations/20260815000013_class_discovery_cron.sql` (new file)
- **Loop pattern**: one-shot
- **Success criteria**: `SELECT * FROM cron.job WHERE jobname = 'class-discovery-weekly'` returns one row with `schedule = '0 13 * * 1'`
- **Estimated effort**: Trivial

**Exact SQL:**
```sql
-- Art Classes Discovery: weekly cron trigger for class-discovery Edge Function
SELECT cron.schedule(
  'class-discovery-weekly',
  '0 13 * * 1',  -- Mondays 7 AM CST = 13:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://rytjrterecygirttvtdn.supabase.co/functions/v1/class-discovery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scraper-key', current_setting('app.settings.scraper_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## Section 3: Loop Specifications

### Loop: acd-class-fields

- **Trigger**: Implementing agent starts Phase 1
- **Inner cycle**:
  1. Plan: Write `20260815000010_class_fields.sql` with exact SQL from PRD §FR-1
  2. Execute: `supabase db push` (or push via MCP)
  3. Verify: `SELECT column_name FROM information_schema.columns WHERE table_name = 'events' AND column_name IN ('instructor_name','skill_level','session_count','class_format')` — expect 4 rows
- **Evaluator**: 4 rows returned = pass. Fewer than 4 = fail (re-check migration SQL)
- **Retry**: Fix SQL, re-push. Max 2 cycles.
- **Stop condition**: 4 columns exist in `events` table

---

### Loop: acd-school-venues-seed

- **Trigger**: acd-class-fields complete
- **Inner cycle**:
  1. Plan: Verify each `calendar_url` returns 200 (`curl -sI <url>`) before writing migration
  2. Execute: Write `20260815000011_seed_class_venues.sql` and push
  3. Verify: `SELECT name, calendar_url FROM venues WHERE venue_type = 'school' ORDER BY name` — confirm 8 rows, all with non-null `calendar_url`
- **Evaluator**: 8 rows with calendar URLs = pass
- **Retry**: If a `calendar_url` returns non-200, update to the venue's homepage URL. Max 1 retry per venue.
- **Stop condition**: 8 school venues in DB with valid URLs

---

### Loop: acd-types

- **Trigger**: acd-class-fields complete
- **Inner cycle**:
  1. Plan: Read `supabase/functions/_shared/scraper/types.ts` in full
  2. Execute: Add 4 fields to 3 interfaces (`Pass1Event`, `ScrapedEvent`, `Pass2Verification`)
  3. Verify: `npm run build` completes without TypeScript errors on `types.ts` changes
- **Evaluator**: Build succeeds = pass
- **Retry**: Fix TypeScript errors. Max 2 cycles.
- **Stop condition**: `npm run build` clean

---

### Loop: acd-extraction-prompt

- **Trigger**: acd-types complete
- **Inner cycle**:
  1. Plan: Read current `extraction-prompt.ts`, identify insertion point (before final closing backtick)
  2. Execute: Insert CLASS-SPECIFIC FIELDS block exactly as specified in PRD §FR-3
  3. Verify: Call `buildExtractionPrompt("iO Chicago")` in a test script and assert the returned string includes "instructor_name" and "class_format"
- **Evaluator**: String contains both field names = pass
- **Retry**: Re-read and reinsert. Max 1 retry.
- **Stop condition**: Prompt string contains all 4 class field names

---

### Loop: acd-verification-prompt

- **Trigger**: acd-extraction-prompt complete
- **Inner cycle**:
  1. Plan: Read current `verification-prompt.ts`, identify the ENRICHMENT section
  2. Execute: Append class-field instructions to ENRICHMENT section and add fields to return schema
  3. Verify: Call `buildVerificationPrompt("iO Chicago", [{title:"Improv 101", event_type:"class"}])` — assert returned string includes "instructor_name" and "class_format"
- **Evaluator**: String contains both field names = pass
- **Retry**: Max 1 retry.
- **Stop condition**: Prompt string contains all 4 class field names

---

### Loop: acd-strategy-tree-config

- **Trigger**: acd-verification-prompt complete
- **Inner cycle**:
  1. Plan: Read all 5 shared scraper modules (`types.ts`, `completeness-evaluator.ts`, `targeted-prompt.ts`, `strategy-agent.ts`, `process-venue.ts`) — identify every function signature and `evaluateCompleteness` call site
  2. Execute: Add `StrategyProfile` type, `CLASS_FIELD_WEIGHTS`, optional params to all functions, class field merge logic, conditional TIC/play-matcher skip
  3. Verify: `npm run build` clean. Deploy `event-scraper` → trigger scrape of a theater venue → confirm it still works with default profile (no regressions). Deploy `class-discovery` → trigger against iO Chicago → confirm `extraction_status` and `missing_fields` present in scrape_logs.
- **Evaluator**: Build clean + both functions return valid results = pass. Regression in event scraper = fail (check optional param defaults).
- **Retry**: Fix TypeScript errors or missing defaults. Max 2 cycles.
- **Stop condition**: Both scrapers use the shared strategy tree with correct domain-specific behavior

---

### Loop: acd-class-discovery-fn

- **Trigger**: acd-strategy-tree-config complete
- **Inner cycle**:
  1. Plan: Delete duplicated code from `class-discovery/index.ts` (fetchHtml, callDeepSeek, extractEventsPass1, verifyEventsPass2, mergeExtractionResults, processSchool, MergedEvent interface). Import `processVenue` from shared module.
  2. Execute: Rewrite to call `processVenue(school, runId, { profile: CLASS_PROFILE, defaultEventType: "class" })`. Keep SerpAPI discovery + dedup + CORS + auth + streaming.
  3. Verify: `supabase functions deploy class-discovery && curl -sX POST $SUPABASE_URL/functions/v1/class-discovery -H "x-scraper-key: $SCRAPER_SECRET"` — expect 200 with valid NDJSON including `{"type":"school_scrape",...}` with strategy trace data and `{"type":"summary",...}`
- **Evaluator**: 200 response with parseable NDJSON, scrape results include `extraction_status` = pass. 401 = auth issue. 500 = runtime error (check import paths for Deno compatibility).
- **Retry**: Fix import paths or missing env vars. Max 2 cycles.
- **Stop condition**: curl test returns 200 with strategy-tree-powered scrape results

---

### Loop: acd-map-marker

- **Trigger**: Phase 3 begins
- **Inner cycle**:
  1. Plan: Read `MapMarker.tsx` in full — understand current Props interface and coloring logic
  2. Execute: Add `hasClassEvents` to Props, add class marker override block per PRD §FR-5 spec
  3. Verify: In dev browser with VITE_MAPBOX_TOKEN set, navigate to map — confirm iO Chicago marker is amber diamond, Second City is amber diamond, and Steppenwolf (performing venue, not education) uses its normal storefront/institutional marker
- **Evaluator**: 8 amber diamonds visible for school venues = pass
- **Retry**: If diamonds not appearing, verify `hasClassEvents` is being passed from MapView. If wrong color, recheck the color override order (must come after relationship-coloring block). Max 2 cycles.
- **Stop condition**: All school venues with class events show amber diamonds

---

### Loop: acd-venue-sheet-class-section

- **Trigger**: Phase 3, Track E
- **Inner cycle**:
  1. Plan: Read `VenueSheet.tsx` — understand `upcomingEvents` useMemo (line ~125) and JSX section ordering
  2. Execute: Add `classEvents` useMemo and render the class section JSX per PRD §FR-6 spec
  3. Verify: Tap iO Chicago marker on map — VenueSheet opens. Confirm amber-bordered "CLASSES AT THIS VENUE" section appears. Tap a storefront venue marker — confirm no classes section appears.
- **Evaluator**: Class section visible for school venues, absent for others = pass
- **Retry**: If section doesn't appear, console.log `classEvents` to verify data is being returned. Max 2 cycles.
- **Stop condition**: Class section renders correctly for school venues only

---

### Loop: acd-admin-button

- **Trigger**: acd-class-discovery-fn complete, Phase 4 begins
- **Inner cycle**:
  1. Plan: Read `ScraperDashboard.tsx` — understand `handleRunScraper` and the NDJSON streaming pattern
  2. Execute: Add `handleDiscoverClasses` function and button per PRD §FR-8 spec
  3. Verify: In admin panel, press "DISCOVER CLASSES" — stream log lines appear in the UI, button is disabled during run, final summary line appears
- **Evaluator**: Stream visible in UI with summary line = pass
- **Retry**: If stream doesn't appear, check CORS headers on `class-discovery` function. Max 2 cycles.
- **Stop condition**: Full discovery run visible in admin UI

---

### Loop: acd-admin-stats

- **Trigger**: acd-class-coverage-rpc complete, acd-admin-button complete
- **Inner cycle**:
  1. Plan: Identify where coverage metrics are displayed in `ScraperDashboard.tsx` and `CoverageMetricsCards.tsx`
  2. Execute: Call `get_class_coverage_metrics()` RPC on mount, render 4 stat boxes below existing coverage
  3. Verify: Admin panel shows CLASS COVERAGE section with correct numbers matching DB
- **Evaluator**: 4 stat boxes visible with correct values = pass
- **Retry**: If RPC fails, check `GRANT EXECUTE` was applied in migration. Max 1 retry.
- **Stop condition**: Stats display correctly

---

## Section 4: Shared State

| State | Set by | Consumed by |
|-------|--------|-------------|
| 8 school venue records in `venues` table | acd-school-venues-seed | acd-strategy-tree-config, acd-class-discovery-fn, acd-map-view-integration, acd-venue-sheet-class-section |
| `instructor_name`, `skill_level`, `session_count`, `class_format` columns on `events` | acd-class-fields | acd-strategy-tree-config, acd-venue-sheet-class-section, acd-admin-stats |
| `StrategyProfile` + `CLASS_FIELD_WEIGHTS` in shared scraper modules | acd-strategy-tree-config | acd-class-discovery-fn |
| Class events in `events` table | acd-class-discovery-fn | acd-map-view-integration (hasClassEvents), acd-venue-sheet-class-section (classEvents), acd-admin-stats |
| `get_class_coverage_metrics()` RPC | acd-class-coverage-rpc | acd-admin-stats |
| `hasClassEvents` boolean (frontend) | acd-map-view-integration (computed from events array) | acd-map-marker |
| `classEvents` array (frontend) | acd-venue-sheet-class-section (computed from allEvents) | VenueSheet render |

---

## Section 5: Build Phases

### Phase 1: Schema Foundation

- [ ] acd-class-fields → `supabase/migrations/20260815000010_class_fields.sql`, `src/lib/types.ts`
- [ ] acd-school-venues-seed → `supabase/migrations/20260815000011_seed_class_venues.sql`
- [ ] acd-class-coverage-rpc → `supabase/migrations/20260815000012_class_coverage_rpc.sql`

**Gate:** `SELECT COUNT(*) FROM venues WHERE venue_type = 'school'` = 8 before Phase 2.

---

### Phase 2: Scraper Extension

Track A (configurable strategy tree):
- [x] acd-types → `supabase/functions/_shared/scraper/types.ts`
- [x] acd-extraction-prompt → `supabase/functions/_shared/scraper/extraction-prompt.ts`
- [x] acd-verification-prompt → `supabase/functions/_shared/scraper/verification-prompt.ts`
- [x] acd-strategy-tree-config → `types.ts`, `completeness-evaluator.ts`, `targeted-prompt.ts`, `strategy-agent.ts`, `process-venue.ts`

Track B (class discovery using shared pipeline):
- [x] acd-class-discovery-fn → `supabase/functions/class-discovery/index.ts` (rewritten, 307 lines)

**Gate (Track A):** `npm run build` clean. Event-scraper backward compatible (optional params with defaults).
**Gate (Track B):** curl test class-discovery returns 200 with NDJSON including `extraction_status` and strategy traces.

---

### Phase 3: Frontend

Track C (map markers):
- [ ] acd-map-marker → `src/components/MapMarker.tsx`
- [ ] acd-map-view-integration → `src/components/MapView.tsx`

Track D (map filter):
- [ ] acd-map-filter-chip → `src/components/MapFilterChips.tsx`
- [ ] acd-map-key → `src/components/MapKey.tsx`

Track E (venue sheet):
- [ ] acd-venue-sheet-class-section → `src/components/VenueSheet.tsx`

**Gate:** All school venues show amber diamonds on map. Tapping a school venue shows class section in VenueSheet. CLASSES filter chip dims non-school venues.

---

### Phase 4: Admin Tools

- [ ] acd-admin-button → `src/components/ScraperDashboard.tsx`
- [ ] acd-admin-stats → `src/components/ScraperDashboard.tsx`

**Gate:** Admin can trigger class discovery from UI and see live results. CLASS COVERAGE stats display correctly.

---

### Phase 5: Scheduling

- [ ] acd-cron → `supabase/migrations/20260815000013_class_discovery_cron.sql`

**Gate:** `SELECT * FROM cron.job WHERE jobname = 'class-discovery-weekly'` returns one row.
