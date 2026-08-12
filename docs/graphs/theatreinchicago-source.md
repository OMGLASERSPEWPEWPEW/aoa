# Graph Engineering: TheatreInChicago.com Aggregator Source

**Version:** 1.0.0
**Generated:** 2026-08-12
**Nodes:** 7 | **Phases:** 3 | **Loop specs:** 2

---

## Section 1: Task Graph Topology

### Nodes
```
FOUNDATION:  tic-types, tic-migration
PARSERS:     tic-parser, tic-lookup, tic-venue-matcher
INTEGRATION: tic-strategy-integration, tic-bulk-crossref
```

### Edges
```
tic-types → tic-parser
tic-types → tic-venue-matcher
tic-venue-matcher → tic-lookup
tic-parser → tic-lookup
tic-lookup → tic-strategy-integration
tic-parser → tic-bulk-crossref
tic-venue-matcher → tic-bulk-crossref
tic-migration (independent)
```

---

## Section 2: Node Specifications

#### Node: tic-types
- **Type**: types
- **Depends on**: (none)
- **Outputs**: `supabase/functions/_shared/scraper/types.ts`
- **Loop pattern**: one-shot
- **Success criteria**: New types importable, build passes
- **Estimated effort**: Trivial

Add `"aggregator_crossref"` to the `StrategyStep.step` union type.

Add:
```typescript
export interface TicShow {
  title: string;
  venueName: string;
  detailUrl: string;
  startDate: string | null;
  endDate: string | null;
}

export interface TicDetailData {
  title: string;
  startDate: string | null;
  endDate: string | null;
  showTimes: Record<string, string[]> | null;
  ticketUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  cast: Array<{ name: string; role: string | null }> | null;
  genre: string | null;
}
```

#### Node: tic-migration
- **Type**: migration
- **Depends on**: (none)
- **Outputs**: `supabase/migrations/20260812000002_tic_source.sql`
- **Loop pattern**: one-shot
- **Success criteria**: `supabase db push` succeeds
- **Estimated effort**: Trivial

```sql
INSERT INTO public.venue_sources (id, name, source_type, base_url, scrape_frequency, reliability_score)
VALUES (gen_random_uuid(), 'Theatre in Chicago', 'listing_site', 'https://www.theatreinchicago.com', 'weekly', 0.90);
```

#### Node: tic-parser
- **Type**: feature
- **Depends on**: tic-types
- **Outputs**: `supabase/functions/_shared/scraper/tic-parser.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Parses Now Playing, Coming Soon listing pages and detail pages. Returns structured data.
- **Estimated effort**: Medium

```typescript
export function parseTicListingPage(html: string): TicShow[]
// Parses /nowplayingrs.php or /comingsoonrs.php
// Coming Soon has dates on the listing: "Aug 13 - Nov 8, 2026"
// Now Playing may have "Thru Aug 16" format
// Returns: title, venueName, detailUrl, startDate, endDate

export function parseTicDetailPage(html: string): TicDetailData
// Parses /show-slug/ID/ detail pages
// Extracts: run dates, performance schedule, ticket URL, cast, genre
// Date format: "Through August 16, 2026" → "2026-08-16"
// Schedule format: "Wed, Aug 12: 1:00pm & 7:00pm" → {"wed": ["13:00", "19:00"]}
// Cast format: "Nolan White (Ponyboy Curtis)" → {name, role}

export function parseTicVenuePage(html: string): TicShow[]
// Parses /theatre/venue-slug/ID/ venue pages
// "The Outsiders - Thru Aug 16, 2026" format
// Returns same TicShow[] as listing parser
```

All parsing is regex-based — no AI needed. TIC pages are editorially structured.

#### Node: tic-venue-matcher
- **Type**: feature
- **Depends on**: tic-types
- **Outputs**: `supabase/functions/_shared/scraper/venue-name-matcher.ts`
- **Loop pattern**: one-shot
- **Success criteria**: Correctly matches our venue names to TIC venue names with >90% accuracy
- **Estimated effort**: Small

```typescript
export function matchVenueName(ourName: string, ticName: string): number
// Returns similarity score 0-1
// Strategy: normalize both (lowercase, strip "theatre/theater/company/chicago"),
// then compute word overlap ratio

export function findBestMatch(ourName: string, ticVenues: string[]): { name: string; score: number } | null
// Returns best match above 0.6 threshold, or null
```

#### Node: tic-lookup
- **Type**: feature
- **Depends on**: tic-parser, tic-venue-matcher
- **Outputs**: `supabase/functions/_shared/scraper/tic-lookup.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Given a venue name, returns TIC shows with dates. Falls back gracefully if venue not found.
- **Estimated effort**: Medium

```typescript
export async function lookupVenueOnTic(
  venueName: string,
): Promise<{ shows: TicShow[]; venueUrl: string | null }>
// 1. Fetch /comingsoonrs.php?viewall=1 (has dates on listing — best source)
// 2. Parse all shows with parseTicListingPage
// 3. Filter shows where venueName fuzzy-matches our venue
// 4. If matches found, return them (dates from listing page, no detail fetch needed)
// 5. If no matches, try /nowplayingrs.php?viewall=1
// 6. If still no matches, return empty

export async function enrichFromTicDetail(
  detailUrl: string,
): Promise<TicDetailData | null>
// Fetch a TIC detail page and parse it
// Only called when we need show_times/cast/ticket_url beyond dates
```

**Caching strategy**: Cache the Coming Soon and Now Playing pages in memory for the duration of a batch run (they're shared across all venues). Fetch once, parse once, filter per venue.

#### Node: tic-strategy-integration
- **Type**: feature
- **Depends on**: tic-lookup
- **Outputs**: `supabase/functions/_shared/scraper/strategy-agent.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Strategy tree uses TIC as Step 3.5 fallback. Events with NULL dates get filled from TIC. Strategy trace includes aggregator step.
- **Estimated effort**: Small

In `strategy-agent.ts`, after link following (Step 3) and before verification (Step 4), insert:

```typescript
// STEP 3.5: Aggregator cross-reference
const stillIncomplete = events.filter((e, i) => evaluateCompleteness(e, i).needsFollow);
if (stillIncomplete.length > 0 && budget.canAffordFetch()) {
  const ticStart = Date.now();
  try {
    const { shows } = await lookupVenueOnTic(venue.name);
    // Convert TicShow[] to TargetedEnrichment[]
    const enrichments = shows.map(s => ({
      title: s.title,
      start_date: s.startDate,
      end_date: s.endDate,
    }));
    const { events: updated, fieldsFilledIn } = mergeTargetedExtraction(events, enrichments);
    events = updated;
    steps.push({
      step: "aggregator_crossref", url: "theatreinchicago.com",
      aiCalls: 0, inputTokens: 0, outputTokens: 0,
      eventsAffected: fieldsFilledIn.length, fieldsFilledIn,
      durationMs: Date.now() - ticStart,
    });
  } catch (e) {
    console.warn(`[scraper-v2] TIC lookup failed for ${venue.name}:`, e);
  }
}
```

#### Node: tic-bulk-crossref
- **Type**: feature
- **Depends on**: tic-parser, tic-venue-matcher
- **Outputs**: `supabase/functions/tic-crossref/index.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Standalone Edge Function that bulk-enriches events from TIC. Admin can trigger manually.
- **Estimated effort**: Medium

New Edge Function: `supabase/functions/tic-crossref/index.ts`

```typescript
// POST /functions/v1/tic-crossref
// Auth: admin JWT or SCRAPER_SECRET
// Response: { enriched: number, unmatched: number, new_shows: number }
//
// Flow:
// 1. Fetch all TIC Coming Soon pages (/comingsoonrs.php?viewall=1)
// 2. Fetch all TIC Now Playing pages (/nowplayingrs.php?viewall=1)
// 3. Parse all shows
// 4. For each show, fuzzy-match title+venue to our events table
// 5. For matched events with NULL start_date, update with TIC dates
// 6. Return summary
```

CORS headers: same pattern as event-scrape-batch.

---

## Section 3: Loop Specifications

### Loop: tic-parser
- **Trigger**: tic-types complete
- **Inner cycle**:
  1. Plan: Fetch sample TIC pages (Coming Soon, Now Playing, one detail page). Study HTML structure for regex patterns.
  2. Execute: Write parsers for listing pages (title, venue, dates, detail URL) and detail pages (dates, times, cast, tickets).
  3. Verify: Run parsers against cached HTML samples. Verify Coming Soon page yields ~90 shows with dates. Verify detail page yields complete TicDetailData.
- **Evaluator**: Parsed show count within 10% of actual page count. Dates parse to valid YYYY-MM-DD. Show times parse to valid HH:MM.
- **Retry**: Fix regex patterns (max 2 cycles)
- **Stop condition**: Parsers produce correct structured data from sample pages

### Loop: tic-strategy-integration
- **Trigger**: tic-lookup complete
- **Inner cycle**:
  1. Plan: Read strategy-agent.ts, identify insertion point between Step 3 and Step 4.
  2. Execute: Add Step 3.5 with TIC lookup, merge, and trace logging.
  3. Verify: Deploy event-scrape-batch. Test with a venue known to be on TIC (e.g., Cadillac Palace). Verify strategy_trace shows aggregator_crossref step with fields filled.
- **Evaluator**: Venue with NULL dates gets dates filled from TIC. Strategy trace records the step. AI call count unchanged (TIC adds 0 AI calls).
- **Retry**: Fix lookup or merge logic (max 1 cycle)
- **Stop condition**: Events get TIC dates, strategy trace is correct

---

## Section 5: Build Phases

### Phase 1: Foundation (parallel)
- [ ] tic-types
- [ ] tic-migration

### Phase 2: Parsers + Matcher (parallel)
- [ ] tic-parser
- [ ] tic-venue-matcher

### Phase 3: Integration (sequential)
- [ ] tic-lookup (depends on parser + matcher)
- [ ] tic-strategy-integration (depends on lookup)
- [ ] tic-bulk-crossref (depends on parser + matcher)

---

## File Index

| File | Node | Action |
|------|------|--------|
| `supabase/functions/_shared/scraper/types.ts` | tic-types | Modify |
| `supabase/migrations/20260812000002_tic_source.sql` | tic-migration | Create |
| `supabase/functions/_shared/scraper/tic-parser.ts` | tic-parser | Create |
| `supabase/functions/_shared/scraper/venue-name-matcher.ts` | tic-venue-matcher | Create |
| `supabase/functions/_shared/scraper/tic-lookup.ts` | tic-lookup | Create |
| `supabase/functions/_shared/scraper/strategy-agent.ts` | tic-strategy-integration | Modify |
| `supabase/functions/tic-crossref/index.ts` | tic-bulk-crossref | Create |
