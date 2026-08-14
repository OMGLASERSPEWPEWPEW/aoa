# PRD: Comprehensive Play Catalog

**Feature:** Play seed expansion, event-to-play matching, and backfill pipeline  
**Tickets:** F40, F41, F42  
**Design frames:** None — backend infrastructure only  
**Status:** Planned  
**Priority:** P0  
**Date:** 2026-08-14  
**Author:** prd-specialist  

---

## 1. Executive Summary

### Problem Statement

AOA's Discovery experience is functionally empty. The app has 59 hand-curated plays in the catalog and 135+ venues being scraped weekly — yet `events.play_id` is always NULL. Every event record is an orphan. A user who lands on a play page sees "No productions tracked yet" for nearly every title. A user who searches for "The Children's Hour," "God of Carnage," or "Purpose" finds nothing, because those plays don't exist in the catalog and no event was ever linked to a play even when a match existed.

The gap has two compounding causes:

1. **Catalog is too thin.** 59 plays covers a fraction of what Chicago stages. Any show with a playwright whose name does not appear in those 59 rows is permanently invisible.
2. **Scraper never links.** The two-pass AI extraction pipeline produces event titles but never attempts to identify whether an event is a production of a known canonical work. `play_id` is never set by any code path.

The downstream cost: the play detail page (frames 4a/4b, which is live) is a dead end for most users. Play interest tracking (`play_interest` table from play-page PRD) is measuring demand for plays nobody can find. Discovery feels broken.

### Solution Overview

Three sequential parts that together make the catalog feel full and keep it full automatically:

**Part 1 — Seed migration:** A single SQL migration that INSERTs 200+ canonical plays using `ON CONFLICT (slug) DO NOTHING`, covering American classics, international canon, Chicago-connected playwrights, commonly produced musicals, and recent award winners. No existing records are touched.

**Part 2 — Play-matcher module:** A new shared utility (`supabase/functions/_shared/scraper/play-matcher.ts`) that runs as a post-processing step after each scraper batch. For each event without a `play_id`, it runs: exact title match → fuzzy word-overlap match → AI identification via DeepSeek. On match, it sets `events.play_id`. When AI identifies a production of a canonical work not yet in the catalog, it creates a new play record with `synopsis = null` (marking it as AI-sourced, not curated). Events for workshops, classes, festivals, and open-calls are skipped. Devised/original works receive no forced match.

**Part 3 — Backfill:** A one-time invocable endpoint (or direct SQL call) that runs the play-matcher against all existing events where `play_id IS NULL`, processing in batches to stay within DeepSeek token budgets.

### Business Impact

- Play detail pages go from dead ends to live production trackers for 90%+ of scraped events
- `play_interest` demand signals become accurate — users can now find and want works before they are staged
- Discovery search returns relevant results for common searches ("God of Carnage," "Purpose," "Clyde's")
- The catalog grows automatically with each scraper run — no manual curation required for new works
- Sets the foundation for the "318 Chicago users want Marisol and nobody has staged it since 2004" demand-signal story (play-page PRD, business impact section)

### Resource Requirements

- 1 migration file (`20260815000001_seed_plays_v2.sql`) — 200+ canonical play INSERTs
- 1 new shared module (`supabase/functions/_shared/scraper/play-matcher.ts`) — matching logic + AI fallback
- 1 update to `supabase/functions/_shared/scraper/process-venue.ts` — post-processing hook call
- 1 new Edge Function (`supabase/functions/play-catalog-backfill/index.ts`) — one-time backfill runner
- Schema addition: `source` column on `plays` table to distinguish curated vs. AI-created records
- No frontend changes — play pages already consume `events.play_id` correctly

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| AI creates duplicate plays with slightly different slugs | Medium | Medium | Exact title match runs before AI; AI prompt instructs canonical title normalization; slug uniqueness constraint causes insert to fail gracefully |
| AI misidentifies devised work as known canonical play | Medium | Low | AI prompt includes explicit devised/original work detection; `play_id` stays null on uncertainty |
| Backfill runs out of DeepSeek budget mid-run | Low | Low | Batch processing with configurable batch size; partial runs are safe — any matched `play_id` persists; re-run is idempotent |
| Scraper throughput slows due to matcher overhead | Medium | Low | Matcher is append-only after venue loop; runs after all events for a batch are written; timeout is separate |
| Fuzzy match links wrong play (e.g., "Hamlet" matches "Ham") | Low | High | Word-overlap threshold is 0.8; single-word titles require exact match only |
| New plays added by AI lack synopsis/playwright data | High | Low | `synopsis = null` and `playwright` extracted from AI response; editorial team can enrich via admin |

---

## 2. Product Overview

### Product Vision

The play catalog is a living index of theatrical works produced in Chicago. It does not require manual maintenance to stay current. Every time a venue calendar announces a production, the catalog either recognizes the work and links the event, or recognizes it as new and creates a record. Over 12 months of scraping, the catalog becomes a comprehensive map of what Chicago stages.

### Target Users

**Primary — Theatergoers using Discovery:** Users who search for a play by name, browse a venue's history, or follow a playwright. They need the catalog to be complete enough that the works they know by name are findable.

**Secondary — Admin/editorial team:** Deric and any future collaborators who curate the catalog. AI-sourced play records are marked and visible in admin, enabling editorial enrichment without blocking user-facing functionality.

**Tertiary — The scraper pipeline itself:** `process-venue.ts` is a consumer of the matcher. The matcher must not increase scraper latency beyond 500ms per event batch.

### Value Proposition

For theatergoers: the plays you know are in the app, and the shows happening right now are connected to them.

For the catalog: it grows without manual labor, automatically filling gaps as the scraper discovers new productions.

### Success Criteria

| Metric | Baseline (now) | Target (30 days post-launch) |
|--------|---------------|------------------------------|
| Plays in catalog | 59 | 260+ |
| Events with `play_id` set | 0% | ≥ 70% of `event_type = 'show'` events |
| "Not found" rate for common searches | ~100% | < 20% for Pulitzer/Tony winners last 20 years |
| AI-created play records (auto-growth rate) | 0/week | 5–15 new plays/week from scraper |

### Assumptions

1. `events.play_id` is already a nullable FK to `plays.id` (confirmed — `20260731100001_plays.sql` line 21)
2. `event_type` is already set by the scraper (confirmed — `process-venue.ts` line 55)
3. DeepSeek V4 Flash is available and the API key is set as a Supabase secret (`DEEPSEEK_API_KEY`)
4. The scraper runs against 135+ venues weekly; each venue produces 1–20 events per run
5. `match_decisions` table exists and its pattern can be extended for play matching

---

## 3. Functional Requirements

### FR1 — Seed migration adds 200+ plays without duplicating existing entries

The migration uses `INSERT INTO plays (...) VALUES (...) ON CONFLICT (slug) DO NOTHING`. All 59 existing slugs are safe. The migration covers all categories listed in Part 1 of the brief. The schema does not change — only rows are added.

**Plays to cover by category:**

- American classics (pre-1970): Williams (5+ works), Miller (4+ works), Albee (3+ works), O'Neill (3+ works), Wilder, Inge, Hellman
- Chicago-connected canon: Mamet (6+ works), Letts (5+ works), Shepard (4+ works), Jacobs-Jenkins (3+ works)
- Black American canon: Wilson (all 10 Pittsburgh Cycle plays), Hansberry (2 works), Parks (4+ works), McCraney, Nottage, Ijames
- International canon: Shakespeare (10+ additional works), Chekhov (4 works), Ibsen (4 works), Beckett (3 works), Stoppard (4 works), Pinter (3 works), Brecht (3 works), Churchill, Fugard
- Contemporary American (post-2000): Karam, Lopez, Booth, Vogel, Hudes, Ruhl, Oh, Yee, Miranda, Mitchell, Adjmi
- Musicals commonly produced: Sondheim (8+ shows), Kander/Ebb (3+ shows), Larson, Lloyd Webber hits, recent Tony winners
- Recent Pulitzer/Tony winners (2005–2025): All winners not yet in catalog
- Chicago premiere works: Plays that had their world or US premiere at Steppenwolf, Goodman, Victory Gardens, Chicago Shakespeare

### FR2 — Play-matcher runs after each scraper batch

After `processVenue` completes its event loop, the caller in `index.ts` passes the list of newly created/updated event IDs to `runPlayMatcher`. The matcher processes only `event_type = 'show'` events. It does not block the venue loop — it runs as a separate async step after all venues in a batch complete.

### FR3 — Exact title match (case-insensitive, prefix normalization, punctuation stripping)

Normalization rules applied before exact comparison:

- Lowercase
- Strip leading "The ", "A ", "An " (article prefix only)
- Remove possessive apostrophes and curly quotes
- Strip all punctuation except hyphens within words
- Collapse multiple spaces to single space
- Trim

Example mappings:
- Event `"The Children's Hour"` → normalized `"childrens hour"` → matches play `"The Children's Hour"` → normalized `"childrens hour"` ✓
- Event `"God of Carnage"` → normalized `"god of carnage"` → exact match ✓
- Event `"AUGUST: OSAGE COUNTY"` → normalized `"august osage county"` → matches `"August: Osage County"` ✓

### FR4 — Fuzzy match with word-overlap confidence threshold of 0.8

After exact match fails, run word-overlap scoring using the same algorithm as `venue-name-matcher.ts` (`wordOverlap` function). Score = shared words / max(setA.size, setB.size). Threshold is 0.8. Words of length 1 are excluded from sets (same as existing filter `w.length > 1`).

Single-word play titles (e.g., "Hamlet," "Topdog") skip fuzzy match and go directly to AI fallback to avoid false positives.

### FR5 — AI fallback for unmatched events — identifies canonical work, extracts playwright, creates play record if needed

For events that fail exact and fuzzy match, call DeepSeek V4 Flash with the play identification prompt (see Section 6). The AI response includes:

```json
{
  "is_canonical_work": true,
  "canonical_title": "The Children's Hour",
  "playwright": "Lillian Hellman",
  "year_written": 1934,
  "is_devised_or_original": false,
  "confidence": 0.92
}
```

If `is_canonical_work = true` and `confidence >= 0.85`:
1. Attempt exact + fuzzy match against catalog using the AI-returned `canonical_title`
2. If match found, set `play_id`
3. If no match, INSERT new play record with `synopsis = null`, `source = 'ai'`, and the AI-extracted fields
4. Set `play_id` to the new play's id

If `is_devised_or_original = true` or `confidence < 0.85`, leave `play_id = null`.

### FR6 — Skip non-show event types

Events where `event_type` is `'class'`, `'workshop'`, `'festival'`, or `'open-call'` are not processed by the matcher. Only `event_type = 'show'` events are candidates for `play_id` assignment.

### FR7 — Devised and original works do not receive a forced match

The AI prompt explicitly identifies devised ensemble works, "An Evening of Short Plays," improv formats, and world premieres with unknown canonicity as `is_devised_or_original = true`. These receive no `play_id`. Examples:
- "The Infinite Wrench" (Neo-Futurists) → devised → `play_id = null`
- "An Evening of One-Acts" → collection → `play_id = null`
- Any title explicitly containing "World Premiere" or "New Work" → flagged for AI adjudication

### FR8 — Backfill processes all existing events with `play_id IS NULL` in configurable batches

The backfill Edge Function (`play-catalog-backfill`) accepts an optional `batch_size` parameter (default: 50). It queries events where `play_id IS NULL AND event_type = 'show'`, ordered by `created_at DESC` (most recent first, since recent events are most likely to match current catalog). Processes one batch per invocation. Returns a summary of matches made, plays created, and events skipped.

Backfill is idempotent — re-running on already-matched events is safe because the matcher checks for existing `play_id` first.

### FR9 — `play_id` linkage survives re-scrapes

The scraper's event dedup is slug-based (`title + venue_slug`). When a re-scrape updates an existing event via `events.update(row).eq('id', existing.id)`, the `row` object does not include `play_id` (the matcher sets `play_id` in a separate step). Therefore, re-scrapes never overwrite a previously set `play_id`. This is enforced by construction — `play_id` is never part of the `row` object in `process-venue.ts`.

### FR10 — Source tracking distinguishes curated from AI-created plays

Add a `source` column to the `plays` table:

```sql
ALTER TABLE public.plays ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'curated'
  CHECK (source IN ('curated', 'ai'));
```

All 59 existing plays retain `source = 'curated'` (default). New plays created by the matcher have `source = 'ai'`. This enables an admin view showing AI-created plays pending editorial review, and prevents AI-created records from being confused with hand-curated ones in any future quality checks.

---

## 4. Non-Functional Requirements

### Performance

- Matcher must complete in < 500ms per event batch for batches up to 20 events (typical scraper venue output)
- Exact and fuzzy matching runs in-memory against the full plays catalog loaded once per invocation (not per event)
- AI calls are batched: up to 10 unmatched events per AI request, not 1 call per event
- Backfill batch of 50 events must complete within the Supabase Edge Function timeout (30s for non-premium, 400s for premium). Use 50-event batches for safety.

### Reliability

- Matcher failures must not cause scraper failures. All matcher logic is wrapped in try/catch; a matcher error logs a warning and returns without setting `play_id`, but does not throw
- AI timeout set to 15 seconds (matching venue-name-matcher.ts pattern)
- Play INSERT failures (e.g., duplicate slug from concurrent run) are caught and logged, not thrown

### Data Integrity

- `ON CONFLICT (slug) DO NOTHING` on all seed INSERTs
- `play_id` FK constraint is already in place (not added by this feature)
- Fuzzy match threshold of 0.8 is intentionally conservative — false positives are worse than misses
- AI confidence threshold of 0.85 provides an additional guard layer

### Observability

- Each matcher invocation logs: events processed, exact matches, fuzzy matches, AI matches, plays created, events skipped, AI tokens used
- AI calls logged to `ai_usage` table using existing `logUsage` pattern (feature name: `'play-matcher'`)
- New play records created by AI are queryable via `SELECT * FROM plays WHERE source = 'ai' ORDER BY created_at DESC`

### Security

- Matcher uses Supabase service role key (same as scraper functions) — never the anon key
- No new secrets required — uses existing `DEEPSEEK_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
- Backfill endpoint should be protected by a bearer token check matching the scraper pattern

---

## 5. Technical Considerations

### Architecture Overview

The matcher is additive — it plugs into the existing scraper pipeline as a post-processing step without modifying core extraction logic.

```
event-scraper/index.ts
  └── processVenue() [per venue, unchanged]
        ├── executeStrategyTree() [unchanged]
        ├── event upsert loop [unchanged]
        └── [NEW] runPlayMatcherBatch(eventIds, supabase)
              └── play-matcher.ts
                    ├── loadPlayCatalog() [one query, cached in memory]
                    ├── exactMatch(eventTitle, catalog)
                    ├── fuzzyMatch(eventTitle, catalog, threshold=0.8)
                    └── aiIdentifyBatch(unmatched[], supabase)
                          └── DeepSeek V4 Flash (batched, max 10 events/call)
```

The backfill function is a standalone Edge Function that calls the same `play-matcher.ts` logic in a loop:

```
play-catalog-backfill/index.ts
  └── fetchUnmatchedShowEvents(batchSize, supabase)
  └── runPlayMatcherBatch(events, supabase)
  └── return summary
```

### Technology Stack

- Runtime: Deno (same as all other Edge Functions)
- AI: DeepSeek V4 Flash via direct fetch (same pattern as `venue-name-matcher.ts` lines 156–171)
- DB: `@supabase/supabase-js@2.39.0` service role client
- No new npm/esm dependencies

### Data Model

**Schema change — `plays` table:**

```sql
ALTER TABLE public.plays 
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'curated'
  CHECK (source IN ('curated', 'ai'));

-- Optional: track which scraper run created the play
ALTER TABLE public.plays
ADD COLUMN IF NOT EXISTS scraper_run_id text;
```

**Full `plays` table shape after migration:**

```
plays (
  id              uuid          PK
  title           text          NOT NULL
  slug            text          UNIQUE NOT NULL
  playwright      text          NOT NULL
  year_written    int
  awards          text[]        NOT NULL DEFAULT '{}'
  synopsis        text          -- NULL for AI-created records
  premise         text
  read_prompt     text
  library_url     text
  adjacent_event_id uuid        FK → events
  source          text          NOT NULL DEFAULT 'curated'  [NEW]
  scraper_run_id  text                                      [NEW, optional]
  created_at      timestamptz   NOT NULL DEFAULT now()
)
```

**No change to `events` table** — `play_id` FK is already in place.

### File Paths

```
supabase/
  migrations/
    20260815000001_plays_source_column.sql          [schema: ADD COLUMN source]
    20260815000002_seed_plays_v2.sql                [200+ play INSERTs]
  functions/
    _shared/
      scraper/
        play-matcher.ts                             [NEW — core matching logic]
        process-venue.ts                            [MODIFIED — add post-process hook]
        types.ts                                    [MODIFIED — PlayMatchResult type]
    play-catalog-backfill/
      index.ts                                      [NEW — backfill Edge Function]
```

### Function Signatures

**`play-matcher.ts` exports:**

```typescript
// Primary entry point called by process-venue.ts after event upsert loop
export async function runPlayMatcherBatch(
  eventIds: string[],
  supabase: SupabaseClient,
  runId?: string,
): Promise<PlayMatchSummary>

// Load all plays into memory for a single matching session
export async function loadPlayCatalog(
  supabase: SupabaseClient,
): Promise<PlayRecord[]>

// Exact title match after normalization
export function exactMatch(
  eventTitle: string,
  catalog: PlayRecord[],
): PlayRecord | null

// Fuzzy word-overlap match
export function fuzzyMatch(
  eventTitle: string,
  catalog: PlayRecord[],
  threshold?: number,         // default 0.8
): { play: PlayRecord; score: number } | null

// AI batch identification for events that failed exact + fuzzy
export async function aiIdentifyBatch(
  events: Array<{ id: string; title: string; description: string | null }>,
  catalog: PlayRecord[],
  supabase: SupabaseClient,
): Promise<Map<string, AiPlayIdentification>>

// Normalize a title for comparison
export function normalizePlayTitle(title: string): string
```

**TypeScript interfaces to add to `types.ts`:**

```typescript
export interface PlayRecord {
  id: string;
  title: string;
  slug: string;
  playwright: string;
  year_written: number | null;
  source: "curated" | "ai";
}

export interface AiPlayIdentification {
  is_canonical_work: boolean;
  is_devised_or_original: boolean;
  canonical_title: string | null;
  playwright: string | null;
  year_written: number | null;
  confidence: number;
}

export interface PlayMatchSummary {
  events_processed: number;
  exact_matches: number;
  fuzzy_matches: number;
  ai_matches: number;
  plays_created: number;
  events_skipped: number;       // non-show event_type
  events_unmatched: number;     // no match + left as null
  ai_input_tokens: number;
  ai_output_tokens: number;
  duration_ms: number;
}
```

**`process-venue.ts` modification:**

Add after the event upsert loop (after line 77, before the catch block) — the post-processing hook. The modification is two lines + an import:

```typescript
// After event upsert loop — run play matcher as post-processing step
const createdOrUpdatedIds = /* collect ids from upsert loop */;
const matchSummary = await runPlayMatcherBatch(createdOrUpdatedIds, supabase, runId);
// Log matcher summary alongside scrape_logs (best-effort, non-throwing)
```

The `row` object in the upsert loop must NOT gain a `play_id` field — the matcher sets it in a separate UPDATE after the upsert.

**`play-catalog-backfill/index.ts` entry point:**

```typescript
// POST /play-catalog-backfill
// Body: { batch_size?: number, dry_run?: boolean }
// Auth: Bearer token = SUPABASE_SERVICE_ROLE_KEY or a dedicated BACKFILL_SECRET
serve(async (req) => {
  // verify auth
  // parse { batch_size = 50, dry_run = false }
  // query events WHERE play_id IS NULL AND event_type = 'show'
  //   ORDER BY created_at DESC LIMIT batch_size
  // call runPlayMatcherBatch(ids, supabase)
  // return PlayMatchSummary as JSON
})
```

### Integration Requirements

**Scraper integration point — `supabase/functions/event-scraper/index.ts`:**

The scraper's main loop calls `processVenue` for each venue. After all venues in the batch complete, collect all event IDs that were created or updated in this run and pass them to `runPlayMatcherBatch`. This is preferable to calling matcher per-venue to allow batching AI requests across venues.

Alternative (simpler): call `runPlayMatcherBatch` at the end of each `processVenue` call, with only that venue's event IDs. This is lower-risk (stays inside existing per-venue isolation) at the cost of more AI calls. The PRD accepts this simpler approach for v1.

**Catalog load strategy:**

The catalog (plays table) grows to ~300 records. A full SELECT at scraper start is ~50KB in memory. Load once per Edge Function invocation, not once per event. Pass the in-memory catalog array to `exactMatch` and `fuzzyMatch`. AI calls receive only the events that failed local matching.

### Infrastructure Needs

- New Edge Function `play-catalog-backfill` — deploy once, invoke manually for backfill, then decommission or leave as admin utility
- No cron required — matcher runs inline with the existing weekly scraper cron
- No additional Supabase secrets — existing `DEEPSEEK_API_KEY` covers matcher AI calls

---

## 6. AI Prompt — Play Identification

This prompt is used in `aiIdentifyBatch` for events that fail exact and fuzzy matching. It follows the same structure as the venue AI prompt in `venue-name-matcher.ts`.

**Model:** `deepseek-v4-flash`  
**Response format:** `json_object`  
**Temperature:** 0.1  
**Max tokens:** 1024  
**Timeout:** 15 seconds  
**Batch size:** Up to 10 events per call  

```typescript
function buildPlayIdentificationPrompt(
  events: Array<{ index: number; title: string; description: string | null }>,
): string {
  const eventList = events
    .map(e => `${e.index}. Title: "${e.title}"${e.description ? `\n   Description: "${e.description.slice(0, 200)}"` : ""}`)
    .join("\n\n");

  return `You are identifying whether theater event titles represent productions of known canonical plays, or original/devised works.

For each event, determine:
1. Is this a production of a known, published play by a specific playwright?
2. Or is it an original work, devised ensemble piece, improv format, or work of unknown canonicity?

SKIP RULES — if any apply, set is_devised_or_original: true:
- Title contains "World Premiere", "New Work", "New Play", "World Premiere"
- Event appears to be a revue, cabaret, or "An Evening of..."
- Known devised companies' signature shows (e.g., "The Infinite Wrench")
- Improv, sketch comedy, or clown formats
- Any title where you are not confident of the playwright (confidence < 0.85)

For canonical works, provide the NORMALIZED canonical title exactly as it appears in published scripts (not the marketing title):
- "A Streetcar Named Desire" not "Streetcar"
- "August: Osage County" not "August Osage County"
- "Who's Afraid of Virginia Woolf?" with the question mark

Events:
${eventList}

Return valid JSON:
{
  "identifications": [
    {
      "index": 1,
      "is_canonical_work": true,
      "is_devised_or_original": false,
      "canonical_title": "The Children's Hour",
      "playwright": "Lillian Hellman",
      "year_written": 1934,
      "confidence": 0.95
    }
  ]
}`;
}
```

**Response handling:**

```typescript
const identifications: AiPlayIdentification[] = parsed.identifications ?? [];
for (const id of identifications) {
  const event = events[id.index - 1];
  if (!event) continue;
  results.set(event.id, {
    is_canonical_work: id.is_canonical_work,
    is_devised_or_original: id.is_devised_or_original,
    canonical_title: id.canonical_title ?? null,
    playwright: id.playwright ?? null,
    year_written: id.year_written ?? null,
    confidence: id.confidence ?? 0,
  });
}
```

---

## 7. Seed Migration — Structure

**Migration file 1:** `20260815000001_plays_source_column.sql`

```sql
-- Add source column to distinguish curated vs AI-created play records
ALTER TABLE public.plays 
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'curated'
  CHECK (source IN ('curated', 'ai'));

-- Optional: track which scraper run created an AI play record
ALTER TABLE public.plays
  ADD COLUMN IF NOT EXISTS scraper_run_id text;

-- Index for admin queries: "show me all AI-created plays"
CREATE INDEX IF NOT EXISTS idx_plays_source ON public.plays(source);
```

**Migration file 2:** `20260815000002_seed_plays_v2.sql`

The migration covers these categories. A representative sample of the INSERT pattern is shown; the full file must include all 200+ entries.

```sql
-- Comprehensive play catalog expansion — v2
-- Targets: American classics, international canon, Chicago-connected works,
-- musicals, Pulitzer/Tony winners 2005-2025, Chicago premiere works
-- Uses ON CONFLICT (slug) DO NOTHING to preserve existing 59 entries

INSERT INTO plays (title, slug, playwright, year_written, awards, synopsis) VALUES

-- ============================================================
-- AUGUST WILSON PITTSBURGH CYCLE (currently missing from catalog)
-- ============================================================
('Gem of the Ocean', 'gem-of-the-ocean', 'August Wilson', 1984, '{}', 'Citizen Barlow seeks spiritual cleansing from 285-year-old Aunt Ester in 1904 Pittsburgh, the first play of Wilson''s Century Cycle chronologically.'),
('Joe Turner''s Come and Gone', 'joe-turners-come-and-gone', 'August Wilson', 1988, '{}', 'Residents of a Pittsburgh boarding house in 1911 search for identity and belonging in the years after the Great Migration.'),
('Ma Rainey''s Black Bottom', 'ma-raineys-black-bottom', 'August Wilson', 1984, ARRAY['New York Drama Critics'' Circle Award, 1985'], 'In a 1927 Chicago recording studio, blues singer Ma Rainey battles her white producers while her band simmers with tension and ambition.'),
('The Piano Lesson', 'the-piano-lesson', 'August Wilson', 1987, ARRAY['Pulitzer Prize for Drama, 1990'], 'A brother and sister in 1936 Pittsburgh fight over a family heirloom piano — sell it for farmland or preserve it as history.'),
('Two Trains Running', 'two-trains-running', 'August Wilson', 1990, '{}', 'Regulars at a Pittsburgh diner in 1969 debate how to navigate a turbulent era of civil rights and Black Power.'),
('Seven Guitars', 'seven-guitars', 'August Wilson', 1995, '{}', 'Friends of a blues guitarist gather after his funeral and piece together the story of his brief moment of success and sudden death.'),
('King Hedley II', 'king-hedley-ii', 'August Wilson', 1999, '{}', 'King Hedley II tries to rebuild his life after prison in 1980s Pittsburgh while the city around him decays.'),
('Radio Golf', 'radio-golf', 'August Wilson', 2005, '{}', 'An ambitious Black developer in 1997 Pittsburgh plans to demolish a historic home — the final play of Wilson''s Century Cycle.'),
('Jitney', 'jitney', 'August Wilson', 1982, '{}', 'Drivers at an unlicensed Pittsburgh cab station in 1977 face the threat of demolition while family secrets surface.'),

-- ============================================================
-- TENNESSEE WILLIAMS (additional works)
-- ============================================================
('Cat on a Hot Tin Roof', 'cat-on-a-hot-tin-roof', 'Tennessee Williams', 1955, ARRAY['Pulitzer Prize for Drama, 1955'], 'Brick Pollitt''s marriage to Maggie unravels as his wealthy father''s terminal cancer forces the family to reckon with lies and desire.'),
('Suddenly Last Summer', 'suddenly-last-summer', 'Tennessee Williams', 1958, '{}', 'A young woman witnesses the death of her cousin Sebastian and is threatened with a lobotomy to silence her account.'),
('The Night of the Iguana', 'the-night-of-the-iguana', 'Tennessee Williams', 1961, '{}', 'A defrocked minister running tours in Mexico finds himself among three lost souls at a ramshackle hotel.'),
('Summer and Smoke', 'summer-and-smoke', 'Tennessee Williams', 1948, '{}', 'Alma Winemiller and John Buchanan circle each other across a Mississippi town square for years, always reaching each other too late.'),

-- ============================================================
-- ARTHUR MILLER (additional works)
-- ============================================================
('All My Sons', 'all-my-sons', 'Arthur Miller', 1947, ARRAY['New York Drama Critics'' Circle Award, 1947'], 'A manufacturer who sold faulty aircraft parts during World War II faces a reckoning when his son learns the truth.'),
('The Price', 'the-price', 'Arthur Miller', 1968, '{}', 'Two brothers meet in their dead father''s apartment to sell off furniture and confront a lifetime of different choices.'),
('Incident at Vichy', 'incident-at-vichy', 'Arthur Miller', 1964, '{}', 'A group of men wait in a Vichy detention center, unsure which of them will be freed and which will be sent to the camps.'),

-- ============================================================
-- EDWARD ALBEE (additional works)
-- ============================================================
('Three Tall Women', 'three-tall-women', 'Edward Albee', 1991, ARRAY['Pulitzer Prize for Drama, 1994'], 'Three women — the same woman at different ages — confront life, compromise, and death in a two-act meditation on identity.'),
('The Zoo Story', 'the-zoo-story', 'Edward Albee', 1958, '{}', 'A lonely man accosts a stranger in Central Park, pulling him into a confrontation that ends in violence.'),
('A Delicate Balance', 'a-delicate-balance', 'Edward Albee', 1966, ARRAY['Pulitzer Prize for Drama, 1967'], 'A couple arrive unannounced at their friends'' home, fleeing an unnamed terror, testing the limits of hospitality and love.'),

-- ============================================================
-- EUGENE O'NEILL
-- ============================================================
('Long Day''s Journey into Night', 'long-days-journey-into-night', 'Eugene O''Neill', 1956, ARRAY['Pulitzer Prize for Drama, 1957'], 'The Tyrone family spends a single fog-bound day confronting addiction, regret, and the dreams they sacrificed.'),
('A Moon for the Misbegotten', 'a-moon-for-the-misbegotten', 'Eugene O''Neill', 1952, '{}', 'Josie Hogan shelters the broken Jim Tyrone in a night of tenderness and mourning on a Connecticut farm.'),
('Ah, Wilderness!', 'ah-wilderness', 'Eugene O''Neill', 1933, '{}', 'A nostalgic, comedic portrait of a Connecticut family during Fourth of July 1906, O''Neill''s only true comedy.'),
('The Hairy Ape', 'the-hairy-ape', 'Eugene O''Neill', 1922, '{}', 'Stoker Yank Smith''s sense of belonging is shattered when a wealthy passenger calls him a hairy ape.'),

-- ============================================================
-- SAM SHEPARD
-- ============================================================
('True West', 'true-west', 'Sam Shepard', 1980, '{}', 'Two brothers — one a Hollywood screenwriter, one a petty thief — swap roles and descend into chaos in their mother''s kitchen.'),
('Buried Child', 'buried-child', 'Sam Shepard', 1978, ARRAY['Pulitzer Prize for Drama, 1979'], 'A young man brings his girlfriend home to his decaying Illinois family and uncovers a buried secret in the backyard.'),
('Curse of the Starving Class', 'curse-of-the-starving-class', 'Sam Shepard', 1977, '{}', 'A dysfunctional California farming family falls apart as parents and children each scheme to escape their fate.'),
('Fool for Love', 'fool-for-love', 'Sam Shepard', 1983, '{}', 'A violent, obsessive reunion between half-siblings who share a father but not a mother, set in a Mojave Desert motel.'),

-- ============================================================
-- DAVID MAMET (additional works)
-- ============================================================
('Speed-the-Plow', 'speed-the-plow', 'David Mamet', 1988, '{}', 'Two Hollywood producers are temporarily derailed by a temp secretary who advocates for a serious literary film.'),
('Oleanna', 'oleanna', 'David Mamet', 1992, '{}', 'A college student and her professor find themselves in an escalating power struggle over a sexual harassment accusation.'),
('The Cryptogram', 'the-cryptogram', 'David Mamet', 1994, '{}', 'A boy''s insomnia on the night before a camping trip becomes the surface beneath which his family''s collapse is revealed.'),
('Sexual Perversity in Chicago', 'sexual-perversity-in-chicago', 'David Mamet', 1974, '{}', 'Two male friends and two female friends navigate dating, sex, and intimacy in 1970s Chicago with Mamet''s signature staccato dialogue.'),

-- ============================================================
-- BRANDEN JACOBS-JENKINS
-- ============================================================
('Gloria', 'gloria', 'Branden Jacobs-Jenkins', 2015, '{}', 'A slow morning at a New York magazine office is shattered by violence, and the survivors must decide what to do with the story.'),
('An Octoroon', 'an-octoroon', 'Branden Jacobs-Jenkins', 2014, '{}', 'A manic deconstruction of Dion Boucicault''s 1859 melodrama about a woman of mixed race on a Louisiana plantation.'),
('Everybody', 'everybody', 'Branden Jacobs-Jenkins', 2017, '{}', 'A contemporary adaptation of the medieval morality play Everyman, in which Death summons a random audience member.'),

-- ============================================================
-- SUZAN-LORI PARKS (additional works)
-- ============================================================
('Father Comes Home from the Wars (Parts 1, 2 & 3)', 'father-comes-home-from-the-wars', 'Suzan-Lori Parks', 2014, '{}', 'An enslaved man in Texas faces a choice: fight for the Confederacy with his master in exchange for freedom, or stay home.'),
('In the Blood', 'in-the-blood', 'Suzan-Lori Parks', 1999, '{}', 'Hester La Negrita and her five fatherless children survive on the street while each of the fathers passes through her life again.'),
('Venus', 'venus', 'Suzan-Lori Parks', 1996, '{}', 'The story of Saartjie Baartman, the South African woman exhibited as the "Venus Hottentot" in early 19th-century Europe.'),

-- ============================================================
-- LYNN NOTTAGE (additional works)
-- ============================================================
('Ruined', 'ruined', 'Lynn Nottage', 2008, ARRAY['Pulitzer Prize for Drama, 2009'], 'A bar and brothel in the Democratic Republic of Congo becomes a refuge and a front line for women caught in civil war.'),
('Intimate Apparel', 'intimate-apparel', 'Lynn Nottage', 2003, '{}', 'Esther, a Black seamstress in 1905 New York, navigates loneliness, desire, and the constraints of race and gender.'),

-- ============================================================
-- LORRAINE HANSBERRY (additional works)
-- ============================================================
('The Sign in Sidney Brustein''s Window', 'the-sign-in-sidney-brusteins-window', 'Lorraine Hansberry', 1964, '{}', 'A disillusioned Greenwich Village intellectual is pulled back into political engagement by his neighbors and his own conscience.'),

-- ============================================================
-- TARELL ALVIN MCCRANEY
-- ============================================================
('Hamlet: Prince of Cuba (Antony & Cleopatra)', 'hamlet-prince-of-cuba', 'Tarell Alvin McCraney', 2009, '{}', 'McCraney''s recasting of Shakespeare in a Caribbean setting exploring identity, colonialism, and lineage.'),
('In the Red and Brown Water', 'in-the-red-and-brown-water', 'Tarell Alvin McCraney', 2009, '{}', 'Oya gives up a track scholarship to care for her mother in a Louisiana housing project, set to Yoruba mythology.'),
('The Brothers Size', 'the-brothers-size', 'Tarell Alvin McCraney', 2007, '{}', 'Two brothers and a friend navigate freedom, loyalty, and Yoruba mythology in rural Louisiana.'),

-- ============================================================
-- PAULA VOGEL
-- ============================================================
('How I Learned to Drive', 'how-i-learned-to-drive', 'Paula Vogel', 1997, ARRAY['Pulitzer Prize for Drama, 1998'], 'L''il Bit looks back at her relationship with her Uncle Peck, who taught her to drive and sexually abused her throughout her teens.'),
('Indecent', 'indecent', 'Paula Vogel', 2015, '{}', 'The true story of Sholem Asch''s 1906 Yiddish play "God of Vengeance" and the Broadway obscenity trial it triggered.'),

-- ============================================================
-- SARAH RUHL
-- ============================================================
('In the Next Room (or the Vibrator Play)', 'in-the-next-room', 'Sarah Ruhl', 2009, '{}', 'In 1880s suburban America, a doctor''s new medical device — designed to treat female hysteria — changes the lives of his wife and patients.'),
('The Clean House', 'the-clean-house', 'Sarah Ruhl', 2004, ARRAY['Susan Smith Blackburn Prize, 2004'], 'A Brazilian cleaning woman who dreams of finding the perfect joke becomes entangled in her employer''s messy love life.'),
('Eurydice', 'eurydice', 'Sarah Ruhl', 2003, '{}', 'The myth of Orpheus and Eurydice told from Eurydice''s point of view, in a dreamy underworld where memory and love compete.'),
('Passion Play', 'passion-play', 'Sarah Ruhl', 2005, '{}', 'Three Passion Plays — in Elizabethan England, Nazi Germany, and Reagan''s South Dakota — explore faith, politics, and performance.'),

-- ============================================================
-- QUIARA ALEGRÍA HUDES
-- ============================================================
('Water by the Spoonful', 'water-by-the-spoonful', 'Quiara Alegría Hudes', 2011, ARRAY['Pulitzer Prize for Drama, 2012'], 'A Philadelphia man copes with PTSD from Iraq while an online recovery chat room becomes a community of second chances.'),
('Elliot, A Soldier''s Fugue', 'elliot-a-soldiers-fugue', 'Quiara Alegría Hudes', 2006, '{}', 'Three generations of Puerto Rican marines from Philadelphia find their stories intertwined across Korea, Vietnam, and Iraq.'),

-- ============================================================
-- DOMINIQUE MORISSEAU
-- ============================================================
('Skeleton Crew', 'skeleton-crew', 'Dominique Morisseau', 2016, '{}', 'Workers at a Detroit auto stamping plant in 2008 grapple with layoffs, loyalty, and survival as the factory closes.'),
('Pipeline', 'pipeline', 'Dominique Morisseau', 2017, '{}', 'A Black public school teacher fights to keep her son out of the school-to-prison pipeline while examining her own complicity.'),
('Detroit ''67', 'detroit-67', 'Dominique Morisseau', 2012, '{}', 'A brother and sister are forced to confront their different visions for the future when they convert their Detroit basement into a speakeasy on the eve of the 1967 riots.'),

-- ============================================================
-- HANSOL JUNG / YOUNG JEAN LEE
-- ============================================================
('Lear', 'lear', 'Young Jean Lee', 2010, '{}', 'A deconstructed King Lear in which the play''s characters reflect on their own suffering outside the action of the play.'),
('We''re Gonna Die', 'were-gonna-die', 'Young Jean Lee', 2012, '{}', 'A performance piece about human suffering and coping, featuring original songs and direct address.'),
('Straight White Men', 'straight-white-men', 'Young Jean Lee', 2014, '{}', 'Three grown brothers visit their widowed father at Christmas and interrogate what it means to be a straight white man today.'),

-- ============================================================
-- CHEKHOV
-- ============================================================
('The Cherry Orchard', 'the-cherry-orchard', 'Anton Chekhov', 1904, '{}', 'An aristocratic Russian family loses their beloved estate to a former serf who has become a wealthy merchant.'),
('Three Sisters', 'three-sisters', 'Anton Chekhov', 1901, '{}', 'Three educated sisters in provincial Russia yearn for Moscow while their lives pass them by in longing and inaction.'),
('The Seagull', 'the-seagull', 'Anton Chekhov', 1896, '{}', 'Artists, lovers, and dreamers collide at a Russian country estate, each pursuing an ideal they cannot reach.'),
('Uncle Vanya', 'uncle-vanya', 'Anton Chekhov', 1898, '{}', 'A provincial professor''s return to his estate with his young wife ignites frustrated desires in those who have sacrificed their lives to his comfort.'),

-- ============================================================
-- IBSEN (additional works)
-- ============================================================
('Hedda Gabler', 'hedda-gabler', 'Henrik Ibsen', 1890, '{}', 'A brilliant, bored general''s daughter destroys the lives around her in a bourgeois household that cannot contain her.'),
('The Master Builder', 'the-master-builder', 'Henrik Ibsen', 1892, '{}', 'An aging architect''s ambition and guilt are stirred by a young woman from his past who challenges him to build higher.'),
('Ghosts', 'ghosts', 'Henrik Ibsen', 1881, '{}', 'Mrs. Alving''s attempt to shield her son from the sins of his father collapses when the past returns in physical form.'),

-- ============================================================
-- BRECHT
-- ============================================================
('Mother Courage and Her Children', 'mother-courage-and-her-children', 'Bertolt Brecht', 1939, '{}', 'A canteen woman follows armies across the Thirty Years'' War, profiting from conflict while losing all three of her children to it.'),
('The Good Person of Szechwan', 'the-good-person-of-szechwan', 'Bertolt Brecht', 1943, '{}', 'Three gods search for a good person and find only Shen Teh, a prostitute, who must invent a male alter-ego to survive her own goodness.'),
('Life of Galileo', 'life-of-galileo', 'Bertolt Brecht', 1943, '{}', 'Galileo Galilei''s scientific discoveries and his eventual recantation under Inquisition pressure become an epic parable about truth and power.'),
('The Caucasian Chalk Circle', 'the-caucasian-chalk-circle', 'Bertolt Brecht', 1948, '{}', 'A servant girl flees with an abandoned royal infant through a war-torn landscape, and a roguish judge must determine who the true mother is.'),

-- ============================================================
-- BECKETT
-- ============================================================
('Waiting for Godot', 'waiting-for-godot', 'Samuel Beckett', 1953, '{}', 'Two tramps wait by a tree for Godot, who never arrives, filling the void with vaudeville, argument, and endurance.'),
('Endgame', 'endgame', 'Samuel Beckett', 1957, '{}', 'In a bare room at the end of the world, a blind tyrant in a wheelchair and his servant Clov pass time in ritualistic futility.'),
('Happy Days', 'happy-days', 'Samuel Beckett', 1961, '{}', 'Winnie is buried to her waist — then her neck — in a scorching mound of earth and maintains relentless cheerfulness throughout.'),

-- ============================================================
-- STOPPARD (additional works)
-- ============================================================
('Rosencrantz and Guildenstern Are Dead', 'rosencrantz-and-guildenstern-are-dead', 'Tom Stoppard', 1967, '{}', 'Two minor characters from Hamlet find themselves swept through events they cannot understand or control, waiting for a cue that never comes.'),
('Arcadia', 'arcadia', 'Tom Stoppard', 1993, '{}', 'Two storylines — a Derbyshire estate in 1809 and the same house in the present — illuminate the second law of thermodynamics through love, mathematics, and gardening.'),
('The Real Thing', 'the-real-thing', 'Tom Stoppard', 1982, '{}', 'A playwright who writes brilliantly about love discovers he cannot control his own feelings when they become real.'),
('Travesties', 'travesties', 'Tom Stoppard', 1974, '{}', 'A minor British consular official''s faulty memory of Zurich 1917 weaves Lenin, James Joyce, and Tristan Tzara through an Importance of Being Earnest framework.'),

-- ============================================================
-- HAROLD PINTER
-- ============================================================
('Betrayal', 'betrayal', 'Harold Pinter', 1978, '{}', 'A love triangle between a publisher, his wife, and his best friend, told in reverse chronological order.'),
('The Birthday Party', 'the-birthday-party', 'Harold Pinter', 1958, '{}', 'Two mysterious men arrive at a seaside boarding house and terrorize the only resident in a menacing birthday celebration.'),
('The Homecoming', 'the-homecoming', 'Harold Pinter', 1965, '{}', 'A philosophy professor brings his American wife home to his father''s North London house for the first time, with disturbing results.'),

-- ============================================================
-- CARYL CHURCHILL
-- ============================================================
('Top Girls', 'top-girls', 'Caryl Churchill', 1982, '{}', 'Marlene celebrates her promotion with a dinner party of historical and fictional women, then returns to her family in Suffolk.'),
('Cloud Nine', 'cloud-nine', 'Caryl Churchill', 1979, '{}', 'Act One: British colonialism in Africa. Act Two: The same characters in London 1979, having aged only 25 years. A play about sexual and political liberation.'),
('Escaped Alone', 'escaped-alone', 'Caryl Churchill', 2016, '{}', 'Four old women meet in a back garden for tea while one of them periodically describes scenes of apocalyptic catastrophe.'),
('Far Away', 'far-away', 'Caryl Churchill', 2000, '{}', 'In three short scenes across decades, a world slips from the familiar into the totalitarian and then into total war.'),

-- ============================================================
-- SONDHEIM MUSICALS
-- ============================================================
('Sweeney Todd: The Demon Barber of Fleet Street', 'sweeney-todd', 'Stephen Sondheim', 1979, ARRAY['Tony Award for Best Musical, 1979'], 'A wrongly imprisoned barber returns to London seeking revenge, partnering with a pie-maker to dispose of his victims.'),
('Sunday in the Park with George', 'sunday-in-the-park-with-george', 'Stephen Sondheim', 1984, ARRAY['Pulitzer Prize for Drama, 1985'], 'Georges Seurat creates his masterwork "A Sunday Afternoon on the Island of La Grande Jatte" while his lover Dot drifts away.'),
('Into the Woods', 'into-the-woods', 'Stephen Sondheim', 1987, '{}', 'Fairy-tale characters collide in a forest where wishes come true but their consequences ripple outward.'),
('Company', 'company', 'Stephen Sondheim', 1970, ARRAY['Tony Award for Best Musical, 1971'], 'Bobby, a confirmed bachelor in New York, examines his relationships with five married couples and three girlfriends.'),
('Follies', 'follies', 'Stephen Sondheim', 1971, '{}', 'Former showgirls and their husbands reunite at a crumbling theatre the night before its demolition, haunted by their younger selves.'),
('A Little Night Music', 'a-little-night-music', 'Stephen Sondheim', 1973, ARRAY['Tony Award for Best Musical, 1973'], 'Romantic misunderstandings among the aristocratic and bourgeois at a country estate in turn-of-the-century Sweden.'),
('Passion', 'passion', 'Stephen Sondheim', 1994, ARRAY['Tony Award for Best Musical, 1994'], 'A soldier''s affair with a beautiful woman is disrupted by the overwhelming love of a homely, ill woman in 19th-century Italy.'),
('Assassins', 'assassins', 'Stephen Sondheim', 1990, '{}', 'Nine people who attempted or succeeded in assassinating a US President gather in a surreal shooting gallery to share their stories.'),

-- ============================================================
-- KANDER AND EBB
-- ============================================================
('Chicago', 'chicago-musical', 'John Kander & Fred Ebb', 1975, ARRAY['Tony Award for Best Musical Revival, 1997'], 'Murderesses Roxie Hart and Velma Kelly compete for fame in 1920s Chicago''s corrupt criminal justice system.'),
('Cabaret', 'cabaret', 'John Kander & Fred Ebb', 1966, ARRAY['Tony Award for Best Musical, 1966'], 'An American writer in the Weimar Republic''s Berlin nightclub scene watches fascism rise while pursuing love and life.'),
('Kiss of the Spider Woman', 'kiss-of-the-spider-woman', 'John Kander & Fred Ebb', 1993, ARRAY['Tony Award for Best Musical, 1993'], 'Two cellmates in a Latin American prison — a window dresser and a political prisoner — escape through Hollywood fantasy.'),

-- ============================================================
-- RECENT TONY/PULITZER WINNERS NOT YET IN CATALOG
-- ============================================================
('Children of a Lesser God', 'children-of-a-lesser-god', 'Mark Medoff', 1979, ARRAY['Tony Award for Best Play, 1980'], 'A speech teacher at a school for the deaf falls in love with a former student who refuses to speak or lip-read.'),
('The Curious Incident of the Dog in the Night-Time', 'the-curious-incident', 'Simon Stephens', 2012, ARRAY['Tony Award for Best Play, 2015'], 'A 15-year-old with Asperger''s investigates the murder of his neighbor''s dog and uncovers a far more disturbing truth.'),
('The Ferryman', 'the-ferryman', 'Jez Butterworth', 2017, ARRAY['Tony Award for Best Play, 2019'], 'A farmer in 1981 Northern Ireland is visited by a detective carrying news of a body found in a bog — the body of his brother.'),
('Cost of Living', 'cost-of-living', 'Martyna Majok', 2017, ARRAY['Pulitzer Prize for Drama, 2018'], 'Two pairs of damaged people — caregiver and cared-for — find surprising intimacy while navigating the costs of need.'),
('Fairview', 'fairview', 'Jackie Sibblies Drury', 2018, ARRAY['Pulitzer Prize for Drama, 2019'], 'A Black family prepares for a grandmother''s birthday while the play''s own racial dynamics are exposed and ruptured.'),
('A Strange Loop', 'a-strange-loop', 'Michael R. Jackson', 2019, ARRAY['Pulitzer Prize for Drama, 2020', 'Tony Award for Best Musical, 2022'], 'A queer Black writer writing a musical about a queer Black writer is tormented by his "Thoughts" onstage in a meta-theatrical spiral.'),
('Lackawanna Blues', 'lackawanna-blues', 'Ruben Santiago-Hudson', 2001, '{}', 'A one-man show in which the author portrays every resident of his landlady Nanny''s boarding house in 1950s upstate New York.'),
('Topdog/Underdog', 'topdog-underdog', 'Suzan-Lori Parks', 2001, ARRAY['Pulitzer Prize for Drama, 2002'], 'Two brothers named Lincoln and Booth hustle to survive in a seedy rooming house, their rivalry echoing the nation''s original fratricide.'),

-- ============================================================
-- COMMONLY PRODUCED PLAYS NOT YET IN CATALOG
-- ============================================================
('God of Carnage', 'god-of-carnage', 'Yasmina Reza', 2006, ARRAY['Tony Award for Best Play, 2009'], 'Two couples meet to discuss a playground fight between their sons; the civilized meeting rapidly degenerates into chaos.'),
('The Children''s Hour', 'the-childrens-hour', 'Lillian Hellman', 1934, '{}', 'A troubled student''s malicious lie about two teachers at her boarding school destroys their lives and careers.'),
('Purpose', 'purpose', 'Branden Jacobs-Jenkins', 2024, '{}', 'A Black family reckons with legacy, ambition, and the meaning of success across a weekend reunion.'),
('Doubt: A Parable', 'doubt-a-parable', 'John Patrick Shanley', 2004, ARRAY['Pulitzer Prize for Drama, 2005', 'Tony Award for Best Play, 2005'], 'A Catholic school principal confronts a popular priest with a suspicion of impropriety — and no proof either way.'),
('Proof', 'proof', 'David Auburn', 2000, ARRAY['Pulitzer Prize for Drama, 2001', 'Tony Award for Best Play, 2001'], 'The daughter of a brilliant but mentally ill mathematician must prove whether a groundbreaking notebook belongs to her father or herself.'),
(''night, Mother', 'night-mother', 'Marsha Norman', 1983, ARRAY['Pulitzer Prize for Drama, 1983'], 'A daughter informs her mother she plans to kill herself that evening; the play unfolds in real time as the mother tries to stop her.'),
('The Importance of Being Earnest', 'the-importance-of-being-earnest', 'Oscar Wilde', 1895, '{}', 'Two bachelors maintain fictional alter egos to escape social obligations, creating romantic complications when both fall in love.'),
('An Inspector Calls', 'an-inspector-calls', 'J.B. Priestley', 1945, '{}', 'A mysterious police inspector reveals how each member of a prosperous family contributed to a young woman''s death.'),
('Marisol', 'marisol', 'José Rivera', 1992, '{}', 'A Puerto Rican woman''s guardian angel leaves her to fight in a cosmic war, leaving her to navigate an apocalyptic New York alone.'),
('Mud', 'mud', 'María Irene Fornés', 1983, '{}', 'Mae struggles to educate herself and escape two men who depend on her in a stark, dirt-floor room.'),
('The Colored Museum', 'the-colored-museum', 'George C. Wolfe', 1986, '{}', 'Eleven satirical exhibits skewering Black American cultural myths, stereotypes, and clichés.'),
('Topsy-Turvy', 'topsy-turvy', 'Mike Leigh', 1999, '{}', 'Gilbert and Sullivan''s creative partnership during the making of The Mikado.'),
('Middletown', 'middletown', 'Will Eno', 2010, '{}', 'Residents of a generic American town navigate daily life and approaching death in Wilder-esque episodes.'),
('The Wolves', 'the-wolves', 'Sarah DeLappe', 2016, '{}', 'A girls'' indoor soccer team warms up before games; their conversations reveal the texture of adolescence.'),
('What the Constitution Means to Me', 'what-the-constitution-means-to-me', 'Heidi Schreck', 2019, '{}', 'A woman''s teenage speeches about the Constitution frame an examination of what it has meant for women in her family.'),
('Dana H.', 'dana-h', 'Lucas Hnath', 2019, '{}', 'The playwright''s mother recounts being held captive by a violent member of a Christian motorcycle gang, told through lip-synced audio.'),
('A Christmas Carol', 'a-christmas-carol', 'Charles Dickens (adapted)', 1843, '{}', 'Miser Ebenezer Scrooge is visited by three spirits on Christmas Eve and transformed into a man of generosity.'),
('Steel Magnolias', 'steel-magnolias', 'Robert Harling', 1987, '{}', 'Six women in a Louisiana beauty salon support each other through a devastating loss.'),
('The Diary of Anne Frank', 'the-diary-of-anne-frank', 'Frances Goodrich & Albert Hackett', 1955, '{}', 'Anne Frank and her family hide from the Nazis in an Amsterdam attic for two years.'),
('Lysistrata', 'lysistrata', 'Aristophanes', 411, '{}', 'The women of Greece go on a sex strike to force their husbands to end the Peloponnesian War.'),
('Tartuffe', 'tartuffe', 'Molière', 1664, '{}', 'A pious fraud manipulates his way into a wealthy family''s home and affections.'),
('The Miser', 'the-miser', 'Molière', 1668, '{}', 'The hypocritical miser Harpagon''s obsession with money wrecks his family and loses him his lover.'),
('Miss Julie', 'miss-julie', 'August Strindberg', 1888, '{}', 'An aristocratic woman and her father''s valet engage in a seduction that destroys them both.'),
('M. Butterfly', 'm-butterfly', 'David Henry Hwang', 1988, ARRAY['Tony Award for Best Play, 1988'], 'A French diplomat falls in love with a Chinese opera singer who may be a spy — and a man.'),
('The Laramie Project', 'the-laramie-project', 'Moisés Kaufman & Members of Tectonic Theater Project', 2000, '{}', 'Interviews with residents of Laramie, Wyoming, about the 1998 murder of gay student Matthew Shepard.'),
('Rent', 'rent', 'Jonathan Larson', 1996, ARRAY['Pulitzer Prize for Drama, 1996', 'Tony Award for Best Musical, 1996'], 'A year in the lives of bohemian artists in New York''s East Village during the AIDS crisis, inspired by La Bohème.'),
('Spring Awakening', 'spring-awakening', 'Frank Wedekind (music by Duncan Sheik)', 2006, ARRAY['Tony Award for Best Musical, 2007'], 'Teenage sexuality, repression, and rebellion in 19th-century Germany with a rock score.'),
('Fun Home', 'fun-home', 'Jeanine Tesori & Lisa Kron', 2013, ARRAY['Tony Award for Best Musical, 2015'], 'Cartoonist Alison Bechdel examines her complex relationship with her closeted father through her coming-of-age and his death.'),
('Next to Normal', 'next-to-normal', 'Tom Kitt & Brian Yorkey', 2008, ARRAY['Pulitzer Prize for Drama, 2010', 'Tony Award for Best Musical Revival', 'Tony Award for Best Score, 2009'], 'A suburban mother''s bipolar disorder fractures her family while her grief over a dead child goes unresolved.'),
('The Band''s Visit', 'the-bands-visit', 'David Yazbek', 2016, ARRAY['Tony Award for Best Musical, 2018'], 'An Egyptian police band accidentally stranded in a small Israeli desert town discovers unexpected connection over one night.'),
('Come From Away', 'come-from-away', 'Irene Sankoff & David Hein', 2013, ARRAY['Tony Award for Best Direction of a Musical, 2017'], '7,000 airline passengers are grounded in Gander, Newfoundland on September 11, 2001.'),
('Be More Chill', 'be-more-chill', 'Joe Iconis', 2015, '{}', 'A social outcast swallows a pill that puts a supercomputer in his brain to guide him toward popularity with disastrous results.'),
('Mean Girls', 'mean-girls', 'Tina Fey', 2017, '{}', 'Cady Heron enters public school for the first time and navigates the treacherous world of high school cliques, adapted from the film.'),
('Beetlejuice', 'beetlejuice', 'Eddie Perfect', 2018, '{}', 'A recently deceased couple enlists the help of bio-exorcist Betelgeuse to scare away the new family in their home, adapted from the film.'),
('The Prom', 'the-prom', 'Bob Martin & Chad Beguelin', 2018, '{}', 'Broadway stars in career decline descend on a small Indiana town to support a gay student barred from bringing her girlfriend to prom.'),
('Caroline, or Change', 'caroline-or-change', 'Tony Kushner & Jeanine Tesori', 2003, '{}', 'A Black maid in 1963 Louisiana and the young son of the Jewish family she works for share a world about to change.'),
('Falsettos', 'falsettos', 'William Finn & James Lapine', 1992, '{}', 'Marvin''s post-divorce life weaves together his ex-wife, his psychiatrist, his son, his gay lover, and eventually the AIDS crisis.'),
('The Mystery of Edwin Drood', 'the-mystery-of-edwin-drood', 'Rupert Holmes', 1985, ARRAY['Tony Award for Best Musical, 1986'], 'The audience votes to choose the ending of Dickens''s unfinished murder mystery in this interactive musical comedy.'),
('Little Women', 'little-women', 'Jason Howland & Mindi Dickstein', 2004, '{}', 'Louisa May Alcott''s semi-autobiographical story of the four March sisters growing up in Civil War-era Massachusetts, adapted as a musical.'),
('Ragtime', 'ragtime', 'Stephen Flaherty & Lynn Ahrens', 1996, ARRAY['Tony Award for Best Score, 1998'], 'Three groups — a wealthy White family, Black ragtime musician Coalhouse Walker, and Eastern European immigrant Tateh — collide in early 20th-century America.'),

ON CONFLICT (slug) DO NOTHING;
```

---

## 8. User Stories

### Epic F40 — Seed Migration

**F40-1** As a user searching for "God of Carnage," I want to find the play in the catalog so that I can see which Chicago theaters have produced it.
- Given: the seed migration has been applied
- When: user searches for "God of Carnage"
- Then: the play page renders with playwright "Yasmina Reza" and any linked events

**F40-2** As the system, I want seed INSERTs to be idempotent so that re-running the migration never overwrites curated data.
- Given: the 59 existing plays are in the table
- When: migration runs again
- Then: `ON CONFLICT (slug) DO NOTHING` prevents any duplicate insert; existing data is unchanged

### Epic F41 — Play-Matcher Module

**F41-1** As the scraper pipeline, I want newly scraped events to have their `play_id` set automatically so that play detail pages show current productions.
- Given: a scrape run completes for a venue with events including "Sweeney Todd"
- When: the play-matcher post-processing step runs
- Then: `events.play_id` is set to the UUID of the "Sweeney Todd: The Demon Barber of Fleet Street" play record

**F41-2** As the system, I want workshop and class events to be excluded from play matching so that non-performance events are never incorrectly linked to plays.
- Given: a venue has events with `event_type` of "class" and "show"
- When: the play-matcher runs
- Then: only the "show" event is evaluated; the "class" event is skipped

**F41-3** As the system, I want devised works to remain unlinked so that original productions are not incorrectly attributed to canonical plays.
- Given: "The Infinite Wrench" is scraped from the Neo-Futurists
- When: the play-matcher runs (exact fails, fuzzy fails, AI identifies as devised)
- Then: `play_id` remains null for this event

**F41-4** As the system, I want AI-created play records to be marked so that editorial staff can find and enrich them.
- Given: the scraper finds a production of "Marisol" by José Rivera, not yet in the catalog
- When: the AI fallback creates a new play record
- Then: the new record has `source = 'ai'` and `synopsis = null`

**F41-5** As the system, I want `play_id` to survive re-scrapes so that the link is not lost when the scraper updates an event.
- Given: an event has `play_id` set from a previous matcher run
- When: the scraper re-scrapes the same event and updates it
- Then: `play_id` is unchanged (the update row object never includes `play_id`)

### Epic F42 — Backfill

**F42-1** As an admin, I want to backfill all existing events in one invocation so that historical events gain play links without requiring a full re-scrape.
- Given: the backfill function is invoked with `{ batch_size: 50 }`
- When: it runs
- Then: it returns a JSON summary of matches made, plays created, and events left unmatched

**F42-2** As an admin, I want the backfill to be safe to run multiple times so that a partial run (due to timeout) can be continued.
- Given: the backfill was interrupted after 50 events
- When: it is invoked again
- Then: events already matched (non-null `play_id`) are skipped; only remaining `play_id IS NULL` events are processed

---

## 9. Development Roadmap

### Phase 1 — Schema (Day 1)

1. Write and apply `20260815000001_plays_source_column.sql` (add `source` and `scraper_run_id` columns)
2. Write and apply `20260815000002_seed_plays_v2.sql` (200+ play INSERTs)
3. Verify: `SELECT count(*) FROM plays` returns 260+; `SELECT count(*) FROM plays WHERE source = 'ai'` returns 0

### Phase 2 — Play Matcher Module (Days 2–3)

1. Add `PlayRecord`, `AiPlayIdentification`, `PlayMatchSummary` interfaces to `types.ts`
2. Write `play-matcher.ts` with `normalizePlayTitle`, `exactMatch`, `fuzzyMatch`, `aiIdentifyBatch`, `runPlayMatcherBatch`
3. Unit-test normalization with edge cases: "The Children's Hour" → "childrens hour", "AUGUST: OSAGE COUNTY" → "august osage county"
4. Integration-test against seed catalog with known titles (Sweeney Todd, God of Carnage, Purpose)

### Phase 3 — Scraper Integration (Day 4)

1. Modify `process-venue.ts`: collect event IDs from upsert loop, call `runPlayMatcherBatch` after loop
2. Verify: `play_id` is not in the `row` object (regression check)
3. Deploy event-scraper function: `supabase functions deploy event-scraper`
4. Smoke test: trigger scraper for one venue, verify events gain `play_id`

### Phase 4 — Backfill (Day 5)

1. Write `play-catalog-backfill/index.ts`
2. Deploy: `supabase functions deploy play-catalog-backfill`
3. Invoke with `batch_size: 50`, repeat until all shows processed
4. Verify: `SELECT count(*) FROM events WHERE play_id IS NULL AND event_type = 'show'` approaches 0

### Phase 5 — Validation (Day 6)

1. Search "The Children's Hour" in app UI — confirm play page loads with linked events
2. Search "God of Carnage" — confirm
3. Search "Purpose" — confirm
4. Check play detail pages for Sweeney Todd, August: Osage County — confirm events shown
5. Verify no "workshop" or "class" events have `play_id` set
6. Verify "The Infinite Wrench" (if present) has `play_id = null`

---

## 10. Acceptance Criteria (Feature Complete)

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC1 | `SELECT count(*) FROM plays` ≥ 260 | SQL query |
| AC2 | All 59 original plays unchanged (spot-check 5 slugs) | SQL SELECT on known slugs |
| AC3 | `source` column exists on `plays` with default 'curated' | `\d plays` in psql |
| AC4 | After a scraper run, ≥ 70% of new `event_type='show'` events have non-null `play_id` | `SELECT count(*) FROM events WHERE event_type='show' AND play_id IS NOT NULL` / total |
| AC5 | "God of Carnage," "The Children's Hour," and "Purpose" are findable by search | UI smoke test |
| AC6 | No `event_type IN ('class','workshop','festival','open-call')` events have `play_id` set | SQL check: zero rows |
| AC7 | Re-scraping an event preserves its `play_id` | Manual test: scrape → set play_id → re-scrape → play_id unchanged |
| AC8 | AI-created plays have `source = 'ai'` and `synopsis IS NULL` | SQL: `SELECT title, synopsis FROM plays WHERE source = 'ai'` |
| AC9 | Backfill returns valid JSON summary with counts | Invoke backfill, check response |
| AC10 | Matcher errors do not cause scraper failures | Simulate matcher error (mock), verify venue still succeeds |

---

[timestamp] 2026-08-14 00:00 CST
