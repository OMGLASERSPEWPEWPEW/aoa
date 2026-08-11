# PRD: Intelligent Event Scraper (Multi-Pass Extraction v2)

**Date:** 2026-08-11
**Status:** Draft
**Priority:** P0
**Supersedes:** `multi-pass-extraction.md` (v1 — two-pass extract+verify)

## Executive Summary

The current event scraper fetches ONE URL per venue, calls DeepSeek twice (extract then verify), and stops. Result: **134 of 224 events (60%) have NULL start_date** because many theater calendar pages list show titles without dates — the actual dates live on linked detail pages the scraper never follows.

This v2 replaces the linear pipeline with a **deterministic mini-crawler with AI-assisted extraction**. The scraper follows links from the calendar page to individual show pages, uses targeted prompts to fill missing fields, and annotates exactly why any data remains incomplete. Decision logic (completeness scoring, link ranking, loop control) is pure code — the LLM is reserved exclusively for HTML→JSON extraction.

## User Stories

1. As an **admin**, I want the scraper to find dates for every event it discovers, so that the map's time filters actually show the full Chicago theater landscape instead of 7 venues.
2. As an **admin**, I want to know WHY an event has missing data (venue website down? no dates on site? budget exhausted?), so I can decide whether to manually fix it or wait for the next scrape.
3. As a **user**, I want the map to show all active theaters this week/month, so I can discover shows near me — not just the 6 venues whose websites happened to list dates on their calendar page.

## Functional Requirements

### FR-1: Completeness Evaluation After Initial Extraction

**Trigger:** After Pass 1 extraction returns events from the calendar page.

**Behavior:** A pure-code function scores each event's completeness using weighted fields:
- `start_date` present: +40 points
- `end_date` present: +10
- `price_min` OR `price_max` present: +15
- `ticket_url` present: +10
- `show_times` present: +10
- Total possible: 85

If ANY event is missing `start_date` AND candidate links exist on the page, trigger link following. This is a **required-field gate**, not just a score threshold — `start_date` is always worth pursuing.

If all events score >= 65 (have dates + at least one other field), skip link following and proceed to verification.

**Error state:** If Pass 1 returns 0 events, attempt the website fallback (FR-5) before stopping.

**Data:** No database writes. Returns `EventCompleteness[]` with `{ score, missingFields, needsFollow }` per event.

**Scope:** Pure function, no side effects, no AI calls.

### FR-2: Link Extraction and Heuristic Ranking

**Trigger:** Completeness evaluation determines link following is needed.

**Behavior:** Extract `<a>` tags from the **raw HTML** (before `cleanHtml` strips tag structure). For each link:

1. **Resolve** relative URLs against the calendar page's origin
2. **Filter out:**
   - External domains (different origin)
   - Anchor-only links (`#section`)
   - `mailto:`, `tel:` links
   - Social media (facebook, twitter, instagram, youtube, tiktok)
   - Common non-event paths: `/about`, `/contact`, `/donate`, `/careers`, `/privacy`, `/terms`, `/login`, `/cart`, `/press`, `/accessibility`
   - Asset URLs (`.jpg`, `.png`, `.pdf`, `.css`, `.js`)
3. **Score** remaining links heuristically (no LLM):
   - Anchor text contains substring of an incomplete event's title: **+10**
   - URL path contains show/production/event/ticket/performance keyword: **+5**
   - URL path contains date-like segment (month name, year): **+3**
   - Same origin as calendar URL: **+3**
   - Penalize deep paths (>4 segments): **-1 per extra**
   - Deduplicate by normalized URL
4. **Return** top N candidates sorted by score descending

Reuse the regex pattern from `venue-discovery/calendar-finder.ts:8`: `/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi`

**Error state:** If no candidate links survive filtering, skip link following entirely.

**Data:** Returns `CandidateLink[]` with `{ url, anchorText, score, matchedEventTitles }`.

**Scope:** Pure function. Link extraction happens from raw HTML, NOT from the cleaned text.

### FR-3: Link Following with Targeted Extraction

**Trigger:** Link ranking returns at least one candidate AND budget allows.

**Behavior:** For each of the top N links (N = min(3, remaining budget)):

1. **Fetch** the link's URL (same `fetchVenueHtml` with 15s timeout)
2. **Clean** the HTML with `cleanHtml`
3. **Skip** if cleaned text < 100 characters
4. **Call DeepSeek** with a **targeted extraction prompt** that:
   - Lists the specific event titles with missing fields
   - Asks ONLY for the missing fields (not full event discovery)
   - Uses a smaller output budget (4096 tokens vs 8192)
   - Returns `{ enrichments: [{ title, start_date, end_date, price_min, price_max, ticket_url, show_times }] }`
5. **Merge** results: for each enrichment, find the matching event by title (fuzzy substring match). Fill NULL fields only — never overwrite existing non-NULL values.
6. **Re-evaluate** completeness. If all events now score >= 65, stop early even if budget remains.
7. **No-progress check:** If this link follow added zero new field values, increment a `noProgressCount`. Stop after 2 consecutive no-progress follows.

**Error state:** If a link fetch fails (404, timeout, etc.), log a warning and continue to the next link. One failed link does not abort the venue.

**Data:** Updates the in-memory events array. Logs each follow to `ai_usage` with `feature: "event-scraper-follow"` and metadata `{ venue_id, url_followed, fields_filled }`.

**Scope:** Each follow costs ~$0.001 and ~10 seconds. Max 3 follows = ~$0.003 and ~30s.

### FR-4: Budget and Circuit Breakers

**Trigger:** Created at the start of `processVenue`, checked before every fetch and AI call.

**Behavior:** Budget enforces these limits:

| Limit | Default | Check |
|-------|---------|-------|
| Max AI calls | 6 | Before each `callDeepSeek` |
| Max HTTP fetches | 5 | Before each `fetchVenueHtml` |
| Max USD | $0.012 | After each AI call (cumulative) |
| Wall-clock deadline | 120 seconds from start | Before each fetch+AI pair |
| No-progress | 2 consecutive follows with 0 new fields | After each merge |

When any limit is hit, stop the current phase and proceed to the next (e.g., stop link following, proceed to verification if budget allows, else skip verification and upsert with lower confidence).

**Error state:** Budget exhaustion is not an error — it's a normal stop condition. Logged as `stop_reason: "budget_calls" | "budget_time" | "budget_cost" | "no_progress"`.

**Data:** `CostBudget` class tracks spent/remaining. Included in `StrategyTrace` for auditing.

**Scope:** Pure class, no side effects.

### FR-5: Website Fallback

**Trigger:** Pass 1 extraction from `calendar_url` returns 0 events AND `venue.website_url` exists AND `website_url !== calendar_url`.

**Behavior:**
1. Fetch `website_url`
2. Clean and run Pass 1 extraction
3. If events found, continue to completeness evaluation (FR-1) and link following (FR-3)
4. If still 0 events, return empty result

**Error state:** If website_url fetch fails, return empty result with `extraction_status: "unreachable"`.

**Data:** Logs the fallback attempt in `ai_usage` with `feature: "event-scraper-fallback"`.

**Scope:** One extra fetch + one extra AI call max. Only triggered when primary extraction yields nothing.

### FR-6: Conditional Verification

**Trigger:** After link following (or skip), before upsert.

**Behavior:** Run the existing Pass 2 (verify + enrich) ONLY if:
- Budget has at least 1 AI call remaining
- At least 1 event has `start_date` (worth verifying)

If budget was exhausted on link following, skip verification — insert Pass 1 data with `extraction_confidence: 0.4`.

**Error state:** Same as current — if Pass 2 fails, fall back to Pass 1 data with confidence 0.5.

**Data:** Same as current verification pass.

**Scope:** Saves ~$0.002 and ~10s when budget is tight.

### FR-7: Gap Annotation

**Trigger:** After all extraction attempts, before upsert.

**Behavior:** For each event, set:

- `extraction_status` enum: `complete` | `partial` | `no_dates_on_site` | `dates_in_past` | `unreachable` | `budget_exhausted`
- `missing_fields` jsonb array: e.g., `["start_date", "price_min"]`
- Events with `extraction_status = "complete"` have no missing critical fields

For the venue-level scrape_logs entry, store a `strategy_trace` JSONB containing:
- Which steps executed (initial, follow x N, fallback, verify)
- URLs followed
- Fields filled per step
- Stop reason
- Total AI calls and cost

**Error state:** N/A — annotation is always written.

**Data:** New columns on `events`: `extraction_status text`, `missing_fields jsonb`. New column on `scrape_logs`: `strategy_trace jsonb`.

**Scope:** Migration + upsert logic changes.

### FR-8: Batch Size Reduction

**Trigger:** Always (v2 default).

**Behavior:** Change `BATCH_SIZE` from 2 to 1 in `event-scrape-batch/index.ts`. With link following, a single venue can take up to 80s worst case. Processing 2 venues risks hitting the 150s Edge Function timeout.

**Error state:** N/A.

**Data:** Frontend batch loop makes more calls but each completes reliably.

**Scope:** One constant change.

### FR-9: Gap-Priority Batch Query

**Trigger:** Every batch call to `event-scrape-batch`.

**Behavior:** Change the venue selection query to prioritize venues with incomplete events:

1. **First priority:** Venues that have events with `start_date IS NULL` — regardless of `scraped_at`. These are the venues the v2 link-following can fix right now.
2. **Second priority:** Venues with `scraped_at IS NULL` and `calendar_url IS NOT NULL` — never scraped.
3. **Third priority:** Venues with `scraped_at` older than 24 hours — stale data refresh.

This means hitting "Run Scraper" after v2 deploys immediately targets the 134 events with NULL dates. The existing event rows stay in the DB — the upsert matches by slug and fills in the blanks (updates NULL `start_date` to the real date found on detail pages).

**Error state:** If the priority query returns 0 venues in all tiers, return `{ remaining: 0 }`.

**Data:** Modifies the batch query in `event-scrape-batch/index.ts`. No schema changes.

**Scope:** Query logic change only. The `remaining` count in the response should reflect total venues with gaps + stale + unscraped.

## Non-Functional Requirements

- **Latency per venue:** Best case ~22s (no follows needed), worst case ~80s (3 follows + verify). Must complete within 120s to leave 30s buffer.
- **Cost per venue:** Average ~$0.004, max ~$0.008. Budget cap $0.012 prevents runaway.
- **Backward compatibility:** `processVenue` signature unchanged. `ScrapeResult` return type unchanged. Frontend batch loop works identically.
- **Observability:** Every AI call logged to `ai_usage` with distinct feature strings. Strategy trace in scrape_logs enables debugging "why did venue X get no dates?"

## Technical Considerations

### Data Model Changes

```sql
-- New columns on events
ALTER TABLE events ADD COLUMN IF NOT EXISTS extraction_status text
  DEFAULT 'partial'
  CHECK (extraction_status IN ('complete', 'partial', 'no_dates_on_site', 'dates_in_past', 'unreachable', 'budget_exhausted'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS missing_fields jsonb DEFAULT '[]';

-- New column on scrape_logs
ALTER TABLE scrape_logs ADD COLUMN IF NOT EXISTS strategy_trace jsonb;
```

### New Files

| File | Purpose |
|------|---------|
| `_shared/scraper/cost-budget.ts` | Budget tracking class |
| `_shared/scraper/completeness-evaluator.ts` | Score events, decide if follows needed |
| `_shared/scraper/link-extractor.ts` | Parse and rank links from raw HTML |
| `_shared/scraper/targeted-prompt.ts` | Focused follow-up extraction prompt |
| `_shared/scraper/strategy-agent.ts` | Orchestrate the strategy tree |

### Modified Files

| File | Change |
|------|--------|
| `_shared/scraper/process-venue.ts` | Delegate to strategy agent |
| `_shared/scraper/types.ts` | Add new type definitions |
| `event-scrape-batch/index.ts` | BATCH_SIZE 2 → 1 |

### Reuse

- `calendar-finder.ts:8` regex for link extraction
- `extractEventsPass1`, `verifyEventsPass2`, `mergeExtractionResults` unchanged
- `fetchVenueHtml`, `cleanHtml`, `callDeepSeek` unchanged
- `logUsage` called with new feature strings

## Success Metrics

- NULL `start_date` rate drops from 60% to under 15%
- Average completeness score across all events > 70
- No increase in per-venue cost beyond $0.01 average
- Strategy trace shows which steps recovered which fields — enables data-driven prompt tuning

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Wall-clock timeout | Budget enforces 120s deadline with 30s buffer |
| Cost runaway | Per-venue $0.012 cap, per-call budget checks |
| Merge/matching errors (wrong event gets wrong dates) | Fuzzy title match with substring threshold; never overwrite non-NULL |
| Infinite loops | Max 3 link follows, no-progress circuit breaker, wall-clock deadline |
| JS-rendered sites (dates only visible after JavaScript runs) | Not addressed in v2 — annotated as `no_dates_on_site` for manual review |
| Link following fetches irrelevant pages | Heuristic scoring filters aggressively; worst case wastes one AI call |
