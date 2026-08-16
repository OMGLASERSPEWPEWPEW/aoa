# Graph Engineering: Intelligent Event Scraper (v2)

**Version:** 2.2.0
**Generated:** 2026-08-16
**Supersedes:** v2.1.0 (added configurable StrategyProfile for class domain support)
**Nodes:** 11 | **Phases:** 4 | **Loop specs:** 3

> **Note (v2.2.0):** `executeStrategyTree()` now accepts an optional `StrategyProfile` parameter
> that controls domain behavior (theater vs class), field weights, TIC integration, and log prefixes.
> This allows `class-discovery` to reuse the same pipeline with class-specific completeness scoring
> (instructor_name: 15, skill_level: 10), TIC skip, and play-matcher skip.
> See `docs/graphs/art-classes-discovery.md` node `acd-strategy-tree-config` for the class configuration.

---

## Section 1: Task Graph Topology

### Nodes
```
FOUNDATION:  ies-types, ies-migration
MODULES:     ies-cost-budget, ies-completeness, ies-link-extractor, ies-targeted-prompt
CORE:        ies-tic-detail-fetch, ies-strategy-agent, ies-process-venue-refactor
BATCH:       ies-batch-query, ies-batch-size
```

### Edges
```
ies-types → ies-cost-budget
ies-types → ies-completeness
ies-types → ies-link-extractor
ies-types → ies-targeted-prompt
ies-migration → ies-strategy-agent
ies-cost-budget → ies-strategy-agent
ies-completeness → ies-strategy-agent
ies-link-extractor → ies-strategy-agent
ies-targeted-prompt → ies-strategy-agent
ies-strategy-agent → ies-process-venue-refactor
ies-process-venue-refactor → ies-batch-query
ies-batch-size (independent)
```

### DAG
```
Phase 1 (parallel):   ies-types ──┬── ies-migration
                                   │
Phase 2 (parallel):   ies-cost-budget ── ies-completeness ── ies-link-extractor ── ies-targeted-prompt
                          │                    │                    │                    │
Phase 3 (sequential): ies-strategy-agent ◄─────┴────────────────────┴────────────────────┘
                          │
                      ies-process-venue-refactor
                          │
Phase 4 (parallel):   ies-batch-query ── ies-batch-size
```

---

## Section 2: Node Specifications

#### Node: ies-types
- **Type**: types
- **Depends on**: (none)
- **Outputs**: `supabase/functions/_shared/scraper/types.ts`
- **Loop pattern**: one-shot
- **Success criteria**: Build passes, new types importable by all modules
- **Estimated effort**: Small

Add these types to the existing file:

```typescript
export interface EventCompleteness {
  eventIndex: number
  title: string
  score: number           // 0-85
  missingFields: string[]
  needsFollow: boolean    // true if start_date missing
}

export interface CandidateLink {
  url: string
  anchorText: string
  score: number
  matchedEventTitles: string[]
}

export interface StrategyTrace {
  steps: StrategyStep[]
  totalAiCalls: number
  totalFetches: number
  budgetUsed: number
  budgetLimit: number
  linksFollowed: string[]
  completenessBeforeFollows: number
  completenessAfterFollows: number
  stopReason: string
}

export interface StrategyStep {
  step: 'initial_extract' | 'link_follow' | 'website_fallback' | 'verify'
  url: string
  aiCalls: number
  inputTokens: number
  outputTokens: number
  eventsAffected: number
  fieldsFilledIn: string[]
  durationMs: number
}

export interface TargetedEnrichment {
  title: string
  start_date?: string | null
  end_date?: string | null
  price_min?: number | null
  price_max?: number | null
  ticket_url?: string | null
  show_times?: Record<string, string[]> | null
}
```

#### Node: ies-migration
- **Type**: migration
- **Depends on**: (none)
- **Outputs**: `supabase/migrations/20260812000001_scraper_v2_metadata.sql`
- **Loop pattern**: one-shot
- **Success criteria**: `supabase db push` succeeds, columns exist
- **Estimated effort**: Trivial

```sql
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS extraction_status text
    DEFAULT 'partial'
    CHECK (extraction_status IN ('complete', 'partial', 'no_dates_on_site', 'dates_in_past', 'unreachable', 'budget_exhausted'));

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS missing_fields jsonb DEFAULT '[]';

ALTER TABLE public.scrape_logs
  ADD COLUMN IF NOT EXISTS strategy_trace jsonb;
```

#### Node: ies-cost-budget
- **Type**: feature
- **Depends on**: ies-types
- **Outputs**: `supabase/functions/_shared/scraper/cost-budget.ts`
- **Loop pattern**: one-shot
- **Success criteria**: Budget class correctly tracks calls, fetches, cost, and wall-clock
- **Estimated effort**: Small

```typescript
interface BudgetOpts {
  maxAiCalls: number       // default 6
  maxFetches: number       // default 5
  maxUsd: number           // default 0.012
  wallClockMs: number      // default 120_000
}

export class CostBudget {
  constructor(opts?: Partial<BudgetOpts>)
  isExhausted(): boolean
  canAffordAiCall(): boolean
  canAffordFetch(): boolean
  recordAiCall(inputTokens: number, outputTokens: number, model?: string): void
  recordFetch(): void
  get spent(): number
  get aiCallsMade(): number
  get fetchesMade(): number
  get stopReason(): string | null  // returns first limit hit, or null
}
```

Uses the same `MODEL_PRICING` from `logUsage.ts` for cost estimation. Default model: `deepseek-v4-flash`.

#### Node: ies-completeness
- **Type**: feature
- **Depends on**: ies-types
- **Outputs**: `supabase/functions/_shared/scraper/completeness-evaluator.ts`
- **Loop pattern**: one-shot
- **Success criteria**: Pure function scores events correctly, gate triggers on missing start_date
- **Estimated effort**: Small

```typescript
const FIELD_WEIGHTS: Record<string, number> = {
  start_date: 40,
  end_date: 10,
  price: 15,      // price_min OR price_max
  ticket_url: 10,
  show_times: 10,
}
// Total possible: 85

export function evaluateCompleteness(event: Pass1Event): EventCompleteness

export function shouldFollowLinks(
  events: Pass1Event[],
  candidateLinks: CandidateLink[],
): { shouldFollow: boolean; reason: string; incompleteEvents: EventCompleteness[] }

export function mergeTargetedExtraction(
  existingEvents: Pass1Event[],
  enrichments: TargetedEnrichment[],
): { events: Pass1Event[]; fieldsFilledIn: string[] }
```

`shouldFollowLinks` returns true if:
- ANY event has `needsFollow: true` (missing start_date) AND `candidateLinks.length > 0`

`mergeTargetedExtraction` matches by fuzzy title (case-insensitive substring). Only fills NULL fields. Returns list of field names that were filled.

#### Node: ies-link-extractor
- **Type**: feature
- **Depends on**: ies-types
- **Outputs**: `supabase/functions/_shared/scraper/link-extractor.ts`
- **Loop pattern**: one-shot
- **Success criteria**: Extracts links from raw HTML, scores heuristically, filters nav/social/external
- **Estimated effort**: Small

```typescript
export function extractCandidateLinks(
  rawHtml: string,
  baseUrl: string,
  eventTitles: string[],
): CandidateLink[]

export function prioritizeLinks(
  links: CandidateLink[],
  incompleteEvents: EventCompleteness[],
  visitedUrls: Set<string>,
  maxLinks: number,
): CandidateLink[]
```

Reuses regex from `venue-discovery/calendar-finder.ts:8`:
```typescript
const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
```

Filter lists:
```typescript
const EXCLUDED_PATHS = ['/about', '/contact', '/donate', '/careers', '/privacy', '/terms', '/login', '/cart', '/press', '/accessibility', '/faq', '/board', '/staff']
const EXCLUDED_DOMAINS = ['facebook.com', 'twitter.com', 'instagram.com', 'youtube.com', 'tiktok.com', 'linkedin.com']
const SHOW_KEYWORDS = ['show', 'production', 'event', 'ticket', 'performance', 'season', 'play', 'musical']
```

#### Node: ies-targeted-prompt
- **Type**: feature
- **Depends on**: ies-types
- **Outputs**: `supabase/functions/_shared/scraper/targeted-prompt.ts`
- **Loop pattern**: one-shot
- **Success criteria**: Prompt is focused, asks only for missing fields, produces smaller output
- **Estimated effort**: Trivial

```typescript
export function buildTargetedExtractionPrompt(
  venueName: string,
  incompleteEvents: Array<{ title: string; missingFields: string[] }>,
): string
```

Prompt template:
```
You are extracting SPECIFIC missing data for known events at "${venueName}".

We already identified these events but are missing data for them:
${events.map(e => `- "${e.title}" — MISSING: ${e.missingFields.join(", ")}`)}

From the webpage text below, find ONLY the missing data for these specific events.
Do NOT discover new events. Only fill in what's missing.

Return JSON:
{
  "enrichments": [
    {
      "title": "exact title from above",
      "start_date": "YYYY-MM-DD or null if not found on this page",
      "end_date": "YYYY-MM-DD or null",
      "price_min": number or null,
      "price_max": number or null,
      "ticket_url": "URL or null",
      "show_times": { "thu": ["19:30"], ... } or null
    }
  ]
}

RULES:
- Only return data you actually find on the page — never guess
- If a field is not on this page, set it to null
- If an event from the list above is not mentioned on this page, omit it entirely
- Prices: null if not listed, 0 only if explicitly free
- Dates: YYYY-MM-DD format only, future dates only
```

#### Node: ies-tic-detail-fetch
- **Type**: feature
- **Depends on**: ies-types
- **Outputs**: `supabase/functions/_shared/scraper/strategy-agent.ts`, `supabase/functions/_shared/scraper/tic-lookup.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: TIC shows with no dates on listing page get detail pages fetched. Abuela's Follies at Red Orchid gets dates from `/abuelas-follies/13476/`. TIC-only shows without listing dates are no longer silently dropped.
- **Estimated effort**: Small

**Context:** TIC Now Playing listings have NO dates (no `<span class="open-date">`). Only Coming Soon has dates. This means ~24 Now Playing shows are silently dropped by `ticShowsToEnrichments()` which filters `startDate || endDate`. The detail pages at `/show-slug/ID/` DO have dates, show times, and ticket URLs — `parseTicDetailPage` already exists but is never called.

**Where in the strategy tree:** After TIC merge, before completeness check. New decision:
```
TIC returns shows ──► show has dates from listing? ──► YES: merge as-is (current)
                                                   ──► NO: fetch detail page
                                                          parse with parseTicDetailPage (regex, no AI)
                                                          merge dates + show_times + ticket_url
```

**Changes:**
1. In `strategy-agent.ts` TIC merge section: for TIC shows where `!startDate && !endDate`, call `enrichFromTicDetail(show.detailUrl)` to fetch the detail page
2. In `tic-lookup.ts`: `ticShowsToEnrichments()` should NOT filter out dateless shows — instead return them with null dates so the caller can decide to fetch details
3. In `tic-crossref/index.ts`: same pattern — when a matched TIC show has no dates, fetch its detail page before skipping
4. Budget: each detail page fetch costs 1 HTTP request (no AI). Cap at 5 detail fetches per venue to stay within budget.

**Reuse:** `enrichFromTicDetail()` and `parseTicDetailPage()` already exist in `tic-lookup.ts` and `tic-parser.ts` — they just need to be called.

#### Node: ies-strategy-agent
- **Type**: feature
- **Depends on**: ies-cost-budget, ies-completeness, ies-link-extractor, ies-targeted-prompt, ies-tic-detail-fetch, ies-migration
- **Outputs**: `supabase/functions/_shared/scraper/strategy-agent.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Orchestrates the full strategy tree; venues with detail-page dates get them filled in; budget respected; strategy trace logged
- **Estimated effort**: Medium

```typescript
export async function executeStrategyTree(
  venue: VenueTarget,
  runId: string,
): Promise<{
  mergedEvents: MergedEvent[]
  trace: StrategyTrace
}>
```

This is the core orchestrator. Flow:

1. Create `CostBudget`
2. Fetch `calendar_url` raw HTML → extract links → clean → Pass 1
3. If 0 events → website fallback (FR-5)
4. Evaluate completeness
5. If needs follow → prioritize links → follow loop (max 3, with no-progress check)
6. Conditional verify (FR-6)
7. Merge all results
8. Annotate gaps (FR-7)
9. Return merged events + trace

Uses existing functions: `fetchVenueHtml`, `cleanHtml`, `extractEventsPass1`, `verifyEventsPass2`, `mergeExtractionResults`, `callDeepSeek`, `logUsage`.

#### Node: ies-process-venue-refactor
- **Type**: feature
- **Depends on**: ies-strategy-agent
- **Outputs**: `supabase/functions/_shared/scraper/process-venue.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: processVenue delegates to executeStrategyTree, upserts with gap annotations, same return signature
- **Estimated effort**: Small

Replace the body of `processVenue` to:
1. Call `executeStrategyTree(venue, runId)`
2. Run the existing upsert loop (lines 193-219 of current file) with the merged events
3. Add `extraction_status` and `missing_fields` to each upserted row
4. Add `strategy_trace` to the scrape_logs insert
5. Return `ScrapeResult` (unchanged type)

#### Node: ies-batch-query
- **Type**: feature
- **Depends on**: ies-process-venue-refactor
- **Outputs**: `supabase/functions/event-scrape-batch/index.ts`
- **Loop pattern**: one-shot
- **Success criteria**: Gap-priority query returns venues with NULL-date events first
- **Estimated effort**: Small

Replace the venue selection query (lines 57-63) with a gap-priority query:

```typescript
// Priority 1: venues with events missing start_date
const { data: gapVenues } = await supabase
  .from('venues')
  .select('id, name, slug, calendar_url, website_url, photo_url, photo_url_source')
  .not('calendar_url', 'is', null)
  .in('id', gapVenueIds)  // subquery: venues that have events with start_date IS NULL
  .limit(BATCH_SIZE)

// If none, fall back to: never scraped, then stale
if (!gapVenues?.length) {
  // existing query logic
}
```

The `remaining` count should include all three tiers.

#### Node: ies-batch-size
- **Type**: config
- **Depends on**: (none)
- **Outputs**: `supabase/functions/event-scrape-batch/index.ts`
- **Loop pattern**: one-shot
- **Success criteria**: BATCH_SIZE = 1
- **Estimated effort**: Trivial

Change line 26: `const BATCH_SIZE = 2` → `const BATCH_SIZE = 1`

---

## Section 3: Loop Specifications

### Loop: ies-tic-detail-fetch
- **Trigger**: TIC merge returns shows with no dates on listing page
- **Inner cycle**:
  1. Plan: Identify TIC shows where `!startDate && !endDate` and `detailUrl` exists
  2. Execute: For each (up to 5), call `enrichFromTicDetail(detailUrl)` → parse with `parseTicDetailPage` (regex, no AI) → merge dates/times/ticket into event
  3. Verify: Check that "Abuela's Follies" at Red Orchid gets dates from its TIC detail page. Check that Now Playing shows no longer get silently dropped.
- **Evaluator**: TIC Now Playing shows appear in our events with dates. Strategy trace shows `aggregator_detail` steps.
- **Retry**: Fix detail page regex if parsing fails (max 1 cycle)
- **Stop condition**: All fetchable TIC detail pages processed or budget exhausted

### Loop: ies-strategy-agent
- **Trigger**: All module nodes complete (cost-budget, completeness, link-extractor, targeted-prompt) + migration applied
- **Inner cycle**:
  1. Plan: Read all module files + existing process-venue.ts. Design the orchestration flow matching the strategy tree in the PRD.
  2. Execute: Implement `executeStrategyTree` importing all modules. Wire up: budget creation → fetch → extract links → clean → Pass 1 → completeness check → link follow loop → conditional verify → gap annotation → return.
  3. Verify: Deploy `event-scrape-batch`. Test with curl on 3 venues: one with dates on calendar page (should skip follows), one where dates are on detail pages (should follow links and find them), one with a dead website (should annotate `unreachable`). Check `scrape_logs.strategy_trace` for correct step recording.
- **Evaluator**: Venue with detail-page dates has `extraction_status: "complete"` and non-NULL `start_date`. Strategy trace shows link_follow steps with fields_filled. Budget not exceeded.
- **Retry**: Fix orchestration logic or prompt (max 2 cycles)
- **Stop condition**: 3 test venues produce correctly annotated events with strategy traces

### Loop: ies-process-venue-refactor
- **Trigger**: strategy-agent node complete
- **Inner cycle**:
  1. Plan: Read current process-venue.ts. Identify what stays (upsert loop, error handling, scrape_logs insert) and what delegates (everything before upsert).
  2. Execute: Replace extraction/verification logic with `executeStrategyTree` call. Add `extraction_status` and `missing_fields` to event upsert rows. Add `strategy_trace` to scrape_logs insert.
  3. Verify: Run the full batch loop via the frontend "Run Scraper" button. Verify events get updated with dates, strategy traces appear in scrape_logs, and the frontend progress counter works correctly.
- **Evaluator**: Frontend batch loop works identically. Events with gaps get annotated. No regression in existing functionality.
- **Retry**: Fix upsert or annotation logic (max 1 cycle)
- **Stop condition**: Full batch loop completes without error, events have dates filled in

---

## Section 4: Shared State

| Key | Type | Set by | Consumed by |
|-----|------|--------|-------------|
| `Pass1Event[]` | in-memory | extractEventsPass1 | completeness-evaluator, strategy-agent |
| `CandidateLink[]` | in-memory | link-extractor | strategy-agent |
| `EventCompleteness[]` | in-memory | completeness-evaluator | strategy-agent, link-extractor |
| `CostBudget` | in-memory | strategy-agent (init) | all steps within strategy-agent |
| `StrategyTrace` | in-memory → jsonb | strategy-agent | process-venue (writes to scrape_logs) |
| `extraction_status` | DB column | process-venue upsert | admin UI, debugging |
| `missing_fields` | DB column (jsonb) | process-venue upsert | admin UI, gap-priority query |

---

## Section 5: Build Phases

### Phase 1: Foundation (parallel)
- [ ] ies-types
- [ ] ies-migration
- [ ] ies-batch-size

### Phase 2: Modules (parallel — all depend only on ies-types)
- [ ] ies-cost-budget
- [ ] ies-completeness
- [ ] ies-link-extractor
- [ ] ies-targeted-prompt

### Phase 3: Core (sequential)
- [ ] ies-strategy-agent (depends on all Phase 2 modules + migration)
- [ ] ies-process-venue-refactor (depends on strategy-agent)

### Phase 4: Batch Integration
- [ ] ies-batch-query (depends on process-venue-refactor)

---

## File Index

| File | Node | Action |
|------|------|--------|
| `supabase/functions/_shared/scraper/types.ts` | ies-types | Modify |
| `supabase/migrations/20260812000001_scraper_v2_metadata.sql` | ies-migration | Create |
| `supabase/functions/_shared/scraper/cost-budget.ts` | ies-cost-budget | Create |
| `supabase/functions/_shared/scraper/completeness-evaluator.ts` | ies-completeness | Create |
| `supabase/functions/_shared/scraper/link-extractor.ts` | ies-link-extractor | Create |
| `supabase/functions/_shared/scraper/targeted-prompt.ts` | ies-targeted-prompt | Create |
| `supabase/functions/_shared/scraper/strategy-agent.ts` | ies-strategy-agent | Create |
| `supabase/functions/_shared/scraper/process-venue.ts` | ies-process-venue-refactor | Modify |
| `supabase/functions/event-scrape-batch/index.ts` | ies-batch-query, ies-batch-size | Modify |
