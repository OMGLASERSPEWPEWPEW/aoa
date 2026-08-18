# PRD: Class Discovery Pipeline Fix

**Version:** 1.0
**Date:** 2026-08-18
**Status:** Ready for Implementation
**PRD Author:** prd-specialist
**Supersedes:** Portions of `.claude/docs/prd/art-classes-discovery.md` (FR-4 only)
**Related Graph:** `docs/graphs/class-discovery-pipeline.md` (to be written before implementation)
**Related QA:** `docs/qa/class-discovery-pipeline-fix.md` (to be written before implementation)

---

## 1. Executive Summary

### Problem Statement

The `class-discovery` Edge Function has never successfully discovered a new theater school. Thirteen schools exist in the database because they were manually seeded. The discovery queue (`venue_discovery_queue`) is empty. The SerpAPI key is confirmed set. The function deploys and returns 200 but produces no results.

A four-model diagnosis panel identified three compounding root causes, confirmed by reading the live source code at `supabase/functions/class-discovery/index.ts`:

1. **SerpAPI never executes.** The function uses a self-chaining architecture (one school per invocation, each invocation fires HTTP POST to itself for the next). `runSerpSearch()` is called only when all schools are exhausted — i.e., in the final chain link where `remaining === 0`. Each chain link uses an 8-second `AbortController` timeout to fire-and-forget the next invocation. The final invocation — the one that would reach `remaining === 0` — is the target of a fire-and-forget call that gets aborted by the *previous* link's 8-second timer before it can complete school processing and execute the SerpAPI block. Result: SerpAPI never runs.

2. **Aggregator domain poisoning.** When SerpAPI does run (in manual tests), results from Yelp, ClassPass, CourseHorse, Facebook, and Eventbrite are treated as candidate school domains. These domains are immediately added to the `existingDomains` dedup set. Every subsequent school that has a Yelp listing, a ClassPass page, or a Facebook page is marked "already_known." A legitimate school that has a Yelp profile appears after Yelp itself in results — it is permanently suppressed even though its own domain has never been queued.

3. **Queries too narrow and year-anchored.** Five queries, all with "2026" appended, each returning 10 results. "2026" anchors results to current-year news and listings, crowding out evergreen school pages. All five queries target the same three well-known disciplines (improv, acting, theater workshops), consuming all 50 result slots with Second City, iO, Annoyance, and the same aggregators. No coverage for scene study, Meisner, voiceover, on-camera, comedy writing, conservatory, continuing education, or movement.

4. **No queue promotion flow.** Even if schools were correctly discovered and queued in `venue_discovery_queue` with `raw_category = 'school'`, there is no path from a queue entry to a `schools` table row (the data model that the class map actually uses). No admin UI exists for reviewing and promoting school candidates.

### Solution Overview

This PRD specifies four targeted fixes that do not require rewriting the function from scratch:

1. **Decouple SerpAPI discovery from the scrape chain** — add a standalone `action: "discover"` invocation path that runs SerpAPI immediately, independent of how many schools are being scraped.
2. **Add an aggregator domain blocklist** — applied before dedup, so Yelp/ClassPass/Facebook never pollute the `existingDomains` set.
3. **Expand and improve queries** — 12 discipline-specific queries, no year suffix, 20 results each (240 total, vs. 50 today).
4. **Add observability logging** — every raw SerpAPI result is logged with its disposition (blocked by aggregator filter, blocked by dedup, or queued), so the pipeline is auditable without reading Supabase logs.
5. **Fix the iO Theater duplicate** — a stale `io-theater` venue row with the wrong `calendar_url` is preventing the correct `io-chicago` school from being properly indexed.
6. **Build a queue promotion flow** — an admin UI panel in the Coverage tab of `Docs.tsx` to review discovered schools and promote them to the `schools` and `venues` tables with one click.

### Business Impact

A theater newcomer in Chicago (Deric's exact profile) cannot find acting classes outside the three schools he already knows about. The discovery pipeline was the mechanism designed to surface hidden gems — Interrobang Theatre Project, the Neo-Futurists' training programs, Writers Theatre workshops, and the dozens of smaller studios that teach Meisner, on-camera, or voiceover in Chicago neighborhoods. With discovery broken, the class map stays at 13 manually-entered schools and never grows.

Fixing discovery is a prerequisite for the map fulfilling its stated purpose: surfacing every legitimate adult-facing theater class in Chicago, not just the famous ones.

### Resource Requirements

- 1 Edge Function modification (`supabase/functions/class-discovery/index.ts`)
- 1 SQL migration (delete `io-theater` duplicate, canonicalize `io-chicago`)
- 1 optional SQL migration (add `discovery_logs` table for observability, if scrape_logs is insufficient)
- Frontend: 1 new admin panel section in `src/pages/Docs.tsx` Coverage tab (queue promotion UI)
- No new Edge Functions
- No new external dependencies (SerpAPI already integrated)

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SerpAPI rate limits triggered by 12 queries × 20 results | Low | Medium | SerpAPI free tier = 100 searches/month. 12 queries = 12 searches per run. 8 runs/month stay within free tier. Cost: ~$0 at free tier. |
| Aggregator blocklist over-broad (blocks a legitimate school hosted on a major platform) | Low | Low | Blocklist is domain-level only. `theannoyance.com` is not on the list. A school that has `yelp.com` as its only web presence is not a school with its own website and is not a candidate for our DB anyway. |
| iO duplicate deletion breaks existing FK references | Low | Medium | Run `SELECT COUNT(*) FROM class_sessions WHERE school_id = (SELECT id FROM schools WHERE slug = 'io-theater')` before deleting. If > 0, migrate sessions to `io-chicago` first. |
| Queue promotion creates duplicate `schools` rows | Low | Low | Promotion UI checks `slug` uniqueness before insert. The `schools` table has a `UNIQUE` constraint on `slug`. |

---

## 2. Product Overview

### Product Vision

The class discovery pipeline becomes a self-maintaining system: weekly, it scans the web for new Chicago theater schools, routes legitimate candidates into a human-reviewable queue, and gives the admin a one-click path to promote them to the live map. The admin's job is review and judgment, not manual data entry.

### Target Users

**Primary: Deric (Chicago actor, Acting 2).** Wants to find the next class to take — not just Second City and iO, but the Meisner studio in Wicker Park, the voiceover workshop in the Loop, the physical theater intensive in Logan Square. These schools exist. Discovery is broken. He cannot find them.

**Secondary: Admin (also Deric).** Needs to trust that the pipeline is working without reading raw Supabase logs. Needs a UI that shows what was found, why each result was accepted or rejected, and a one-click promote path for legitimate schools.

### Success Criteria

| Metric | Target | Measured By |
|--------|--------|-------------|
| SerpAPI executes on every `action: "discover"` call | 100% | `discovery_logs` table shows rows for each query |
| New schools queued after one discovery run | ≥ 3 | `SELECT COUNT(*) FROM venue_discovery_queue WHERE raw_category = 'school' AND created_at > now() - interval '1 hour'` |
| Aggregator domains blocked (not queued) | yelp, classpass, coursehorse, facebook, eventbrite never appear as queue entries | `SELECT COUNT(*) FROM venue_discovery_queue WHERE raw_website_url ILIKE '%yelp%' OR raw_website_url ILIKE '%classpass%'` returns 0 |
| `io-theater` duplicate removed | 1 row deleted from `venues` | `SELECT COUNT(*) FROM venues WHERE slug = 'io-theater'` returns 0 |
| Queue promotion flow works | Admin can promote a queue entry to `schools` table in ≤ 3 clicks | Manual QA |
| Observability: every discovery result has a logged disposition | 100% of SerpAPI results logged | `discovery_logs` entries = SerpAPI results returned |

### Assumptions

- `SERPAPI_KEY` is set in Supabase secrets (confirmed by user).
- The `venue_discovery_queue` table exists with the schema created in `20260809000002_venue_discovery.sql`.
- The `schools` table exists with the schema created in `20260820000001_class_schema.sql`.
- The Coverage tab in `Docs.tsx` already exists and has space for a new section.
- `io-theater` (if it exists as a row) has no class_sessions rows attached to it (verify before migration).

---

## 3. Functional Requirements

Every FR specifies: trigger, exact behavior, error state, data changes, and scope boundary. An implementing agent must be able to write code without asking questions.

---

### FR-1: Decouple SerpAPI Discovery from the Scrape Chain

**The bug:** `runSerpSearch()` is called inside `processFirstSchool()` at the `else` branch when `remaining === 0`. The last school is processed inside a fire-and-forget chain link with an 8-second abort timer. SerpAPI requires ~2 seconds per query × 12 queries = ~24 seconds minimum. This runs inside the function that is being aborted at 8 seconds. SerpAPI never completes.

**Fix: Add a first-class `action: "discover"` request path.**

**Trigger:** Admin presses "Discover Classes" button in the Coverage tab, OR a cron job fires, OR an explicit curl call:
```
curl -X POST https://rytjrterecygirttvtdn.supabase.co/functions/v1/class-discovery \
  -H "x-scraper-key: $SCRAPER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "discover"}'
```

**Behavior:**

In the main handler in `serve()`, add a branch at the top of the request handling logic (before the existing `action === "start"` check):

```typescript
if (action === "discover") {
  // Run SerpAPI discovery immediately, do NOT process any school venues
  const runId = crypto.randomUUID();
  const result = await runSerpSearch(runId);
  return new Response(
    JSON.stringify({ action: "discover", run_id: runId, ...result }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
}
```

Change `runSerpSearch()` signature from `async function runSerpSearch(jobId: string): Promise<void>` to `async function runSerpSearch(runId: string): Promise<{ queued: number; known: number; blocked: number; queries_run: number }>`.

Remove the call to `runSerpSearch()` from inside `processFirstSchool()`. The school scrape chain (`action: "start"` / continuation) no longer triggers discovery. Discovery is a separate operation.

**Data changes:** `venue_discovery_queue` rows inserted for newly discovered schools. `discovery_logs` rows inserted for all results (see FR-4).

**Error state:** If `SERPAPI_KEY` is not set, return `{ action: "discover", queued: 0, known: 0, blocked: 0, queries_run: 0, warning: "SERPAPI_KEY not set" }` with HTTP 200. Do not return 500.

**Scope boundary:** The existing `action: "start"` school scraping path is unchanged. The self-chaining architecture for processing school venues continues to function. Only the SerpAPI invocation is moved.

---

### FR-2: Add Aggregator Domain Blocklist

**The bug:** `searchForSchools()` returns URLs from Yelp, ClassPass, CourseHorse, Facebook, and Eventbrite. `deduplicateAndQueue()` adds those domains to `existingDomains`. Every later result from the same domain (including legitimate schools that *also* have Yelp listings) is treated as "already_known."

**Fix: Pre-filter aggregator domains before dedup.**

**Trigger:** Every call to `deduplicateAndQueue()` (which is called from `runSerpSearch()`).

**Exact implementation — add this constant at the top of the file, after the `SERPAPI_KEY` declaration:**

```typescript
const AGGREGATOR_DOMAINS = new Set([
  "yelp.com",
  "classpass.com",
  "coursehorse.com",
  "facebook.com",
  "eventbrite.com",
  "goldstar.com",
  "groupon.com",
  "timeout.com",
  "choosechicago.com",
  "dochub.com",
  "meetup.com",
  "thumbtack.com",
  "bark.com",
  "lessons.com",
  "takelessons.com",
]);
```

**Exact implementation — modify `deduplicateAndQueue()`:**

Before the existing dedup loop over `results`, add a pre-filter step:

```typescript
const filtered: SerpSearchResult[] = [];
let blockedCount = 0;

for (const result of results) {
  // Check if domain matches any aggregator suffix (e.g., "chicago.yelp.com" → "yelp.com")
  const isAggregator = [...AGGREGATOR_DOMAINS].some(agg =>
    result.domain === agg || result.domain.endsWith(`.${agg}`)
  );
  if (isAggregator) {
    blockedCount++;
    // Log the block for observability (FR-4)
    await logDiscoveryResult({
      run_id: runId,
      query: result.query,
      raw_url: result.link,
      raw_title: result.title,
      domain: result.domain,
      disposition: "blocked_aggregator",
      reason: `Domain matched aggregator blocklist`,
    });
    continue;
  }
  filtered.push(result);
}

// Continue dedup logic using `filtered`, not `results`
```

Update `deduplicateAndQueue()` return type to include `blocked: blockedCount`.

**Data changes:** Aggregator results are never inserted into `venue_discovery_queue`. They appear only in `discovery_logs` with `disposition: "blocked_aggregator"`.

**Error state:** If `AGGREGATOR_DOMAINS` is empty (misconfiguration), all results pass through. This is safe — dedup still prevents known venues from being re-queued.

**Scope boundary:** The blocklist is applied only in `deduplicateAndQueue()`. The school scraper (`processFirstSchool`) is unaffected.

---

### FR-3: Expand Search Queries

**The bug:** 5 queries × 10 results = 50 slots. "2026" suffix anchors to news/current-year listings. All 5 queries target improv, acting, and "theater" — same schools dominate all queries.

**Fix: Replace `CLASS_SEARCH_QUERIES` with 12 discipline-specific queries, remove year suffix, increase to 20 results per query.**

**Exact implementation — replace the `CLASS_SEARCH_QUERIES` constant:**

```typescript
const CLASS_SEARCH_QUERIES = [
  // Improv track
  "chicago improv classes adults",
  "chicago long-form improv training",
  // Acting track
  "chicago Meisner technique classes adults",
  "chicago scene study acting classes",
  "chicago on-camera acting classes adults",
  "chicago audition technique workshop",
  // Voice & specialty
  "chicago voiceover training classes adults",
  "chicago sketch comedy writing classes",
  // Musical & movement
  "chicago musical theater classes adults",
  "chicago physical theater movement classes",
  // Broader catch-alls
  "chicago theater conservatory adult programs",
  "chicago continuing education theater arts",
];
```

**Change `num` parameter in `searchForSchools()` from `"10"` to `"20"`:**

```typescript
const params = new URLSearchParams({
  q: query,
  location: "Chicago, Illinois, United States",
  hl: "en",
  gl: "us",
  num: "20",   // was "10"
  api_key: SERPAPI_KEY,
  engine: "google",
});
```

**Do not change the inter-query delay** — keep `delay(500)` between queries.

**Data changes:** Up to 240 raw results per discovery run (12 queries × 20 results), before aggregator filtering and dedup. After filtering, expect 20–60 genuinely new candidate school URLs per run.

**Error state:** If SerpAPI returns fewer than 20 results for a query (common for niche queries), the function processes whatever is returned. No error.

**Scope boundary:** Query list and `num` parameter only. SERPAPI endpoint, location, and all other params are unchanged.

---

### FR-4: Add Discovery Observability Logging

**The problem:** When SerpAPI runs (in manual tests), there is no way to audit what happened. Did it return 50 results? How many were blocked by aggregator filter? How many were already in the DB? How many were actually queued? The only signal is `console.log()` which disappears into Supabase function logs.

**Fix: Log every SerpAPI result with its disposition to a persistent table.**

**Step 1 — Create migration `supabase/migrations/20260818000010_discovery_logs.sql`:**

```sql
-- Discovery pipeline observability: log every SerpAPI result with disposition
CREATE TABLE IF NOT EXISTS public.discovery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  query text NOT NULL,
  raw_url text NOT NULL,
  raw_title text,
  domain text NOT NULL,
  disposition text NOT NULL CHECK (disposition IN (
    'queued',
    'blocked_aggregator',
    'already_known_venue',
    'already_in_queue',
    'insert_error'
  )),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_discovery_logs_run_id ON public.discovery_logs (run_id);
CREATE INDEX idx_discovery_logs_created_at ON public.discovery_logs (created_at);

ALTER TABLE public.discovery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on discovery_logs"
  ON public.discovery_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read discovery_logs"
  ON public.discovery_logs FOR SELECT TO authenticated USING (true);
```

**Step 2 — Add `logDiscoveryResult()` helper in `class-discovery/index.ts`:**

```typescript
interface DiscoveryLogEntry {
  run_id: string;
  query: string;
  raw_url: string;
  raw_title: string;
  domain: string;
  disposition: "queued" | "blocked_aggregator" | "already_known_venue" | "already_in_queue" | "insert_error";
  reason?: string;
}

async function logDiscoveryResult(entry: DiscoveryLogEntry): Promise<void> {
  try {
    await supabase.from("discovery_logs").insert(entry);
  } catch {
    // Log failures must never crash the pipeline
    console.warn("[class-discovery] Failed to write discovery_log entry for", entry.raw_url);
  }
}
```

**Step 3 — Call `logDiscoveryResult()` at each disposition point in `deduplicateAndQueue()`:**

- When a result passes dedup and is inserted: `disposition: "queued"`
- When a result hits the aggregator blocklist (from FR-2): `disposition: "blocked_aggregator"`
- When a result's domain matches an existing venue: `disposition: "already_known_venue"`
- When a result's domain is already in `venue_discovery_queue`: `disposition: "already_in_queue"`
- When `supabase.from("venue_discovery_queue").insert(...)` returns an error: `disposition: "insert_error"`, `reason: error.message`

**Data changes:** `discovery_logs` table populated after every discovery run. Rows are append-only. No deletion or update logic.

**Error state:** `logDiscoveryResult()` is wrapped in a try/catch and never throws. A logging failure is logged to `console.warn()` and does not affect the pipeline.

**Scope boundary:** `discovery_logs` is read-only from the frontend (authenticated role). The admin Coverage tab displays a summary (total queued, blocked, known) derived from the most recent run's rows. Full log rows are accessible via Supabase dashboard for debugging.

---

### FR-5: Fix iO Theater Duplicate

**The problem:** Two venues exist for the same physical school:
- `io-theater` (slug) — stale row, incorrect `calendar_url` pointing to `/shows/`
- `io-chicago` (slug) — correct row, `calendar_url` = `https://www.ioimprov.com/chicago/classes/`

The `io-theater` row confuses the dedup logic (its domain `ioimprov.com` may already be in `existingDomains`), and may be generating empty class sessions if the scraper hits `/shows/` and finds show events, not classes.

**Pre-condition check (run before writing the migration):**

```sql
-- Check for class_sessions attached to io-theater school
SELECT COUNT(*)
FROM class_sessions cs
JOIN schools s ON cs.school_id = s.id
JOIN venues v ON s.venue_id = v.id
WHERE v.slug = 'io-theater';

-- Check for schools row attached to io-theater venue
SELECT s.id, s.slug FROM schools s JOIN venues v ON s.venue_id = v.id WHERE v.slug = 'io-theater';
```

**Migration: `supabase/migrations/20260818000011_fix_io_theater_duplicate.sql`**

The migration logic depends on the pre-condition check result:

**Case A: `io-theater` has no class_sessions and no schools row** (expected):
```sql
-- Safe to delete directly
DELETE FROM public.venues WHERE slug = 'io-theater';
```

**Case B: `io-theater` has a schools row with class_sessions** (requires data migration):
```sql
-- Step 1: Get the io-chicago school id
-- Step 2: Re-parent class_sessions to io-chicago school
UPDATE public.class_sessions
SET school_id = (SELECT id FROM public.schools WHERE slug = 'io-chicago')
WHERE school_id = (SELECT s.id FROM public.schools s JOIN public.venues v ON s.venue_id = v.id WHERE v.slug = 'io-theater');

-- Step 3: Delete the io-theater school row
DELETE FROM public.schools WHERE slug = 'io-theater';

-- Step 4: Delete the io-theater venue row
DELETE FROM public.venues WHERE slug = 'io-theater';
```

The implementing agent must run the pre-condition check first and apply the correct case.

**After deletion — verify `io-chicago` has the correct calendar_url:**

```sql
-- This should already be set from 20260820000009_fix_school_urls_verified.sql
SELECT slug, calendar_url FROM venues WHERE slug = 'io-chicago';
-- Expected: slug='io-chicago', calendar_url='https://www.ioimprov.com/chicago/classes/'
```

If not, add to the migration:
```sql
UPDATE public.venues
SET calendar_url = 'https://www.ioimprov.com/chicago/classes/'
WHERE slug = 'io-chicago';
```

**Data changes:** 1 row deleted from `venues` (and potentially 1 row from `schools`). `io-chicago` is the surviving canonical record.

**Error state:** If the DELETE fails due to FK constraint violations not caught by the pre-condition check, the migration will error. The implementing agent must resolve all FK dependencies before deleting `io-theater`. Use `ON DELETE CASCADE` was not set on all downstream tables — cascade manually via the Case B pattern.

**Scope boundary:** Only `io-theater` is affected. No other venues are touched. No frontend changes required — the UI already uses `io-chicago` for its display.

---

### FR-6: Queue Promotion Flow (Admin UI)

**The problem:** Schools discovered by SerpAPI land in `venue_discovery_queue` with `raw_category = 'school'`. There is no interface to review them and no one-click path to promote them to the `schools` and `venues` tables. They sit in the queue indefinitely.

**Trigger:** Admin visits Coverage tab in `Docs.tsx` and sees the "School Discovery Queue" section.

**New section in the Coverage tab — below the existing "Venue Coverage" metrics:**

The section must show:
1. A count badge: "X schools awaiting review"
2. A list of queue entries where `raw_category = 'school'` and `promoted = false` (or the column that tracks promotion status — check the `venue_discovery_queue` schema from migration `20260809000002_venue_discovery.sql`)
3. For each entry: raw_name, domain, snippet (raw_description truncated to 120 chars), a "Promote" button, and a "Reject" button

**Data fetch — add to `src/hooks/useScrape.ts` or a new `useDiscoveryQueue.ts` hook:**

```typescript
// Fetch school discovery queue entries not yet promoted or rejected
const { data: schoolQueue } = await supabase
  .from("venue_discovery_queue")
  .select("id, raw_name, raw_website_url, raw_description, created_at")
  .eq("raw_category", "school")
  .eq("promoted", false)           // check actual column name in schema
  .is("rejected_at", null)         // check actual column name in schema
  .order("created_at", { ascending: false })
  .limit(20);
```

If the `venue_discovery_queue` schema uses different column names for the promoted/rejected flags (check `20260809000002_venue_discovery.sql`), use those exact column names.

**Promote action — clicking "Promote" for a queue entry:**

Step 1: Look up whether a `venues` row already exists with matching domain. If yes, skip venues insert and go to Step 3.

Step 2: Insert a new row into `public.venues`:
```typescript
const slug = generateSlug(entry.raw_name); // use existing slug-generator util from _shared/scraper/slug-generator.ts — but call from frontend means implementing slug logic inline: entry.raw_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const { data: newVenue, error: venueError } = await supabase.from("venues").insert({
  name: entry.raw_name,
  slug,
  venue_type: "school",
  website_url: entry.raw_website_url,
  calendar_url: entry.raw_website_url,  // admin should edit this manually after promotion
  city: "chicago",
  source: "discovery",
  // latitude, longitude, neighborhood, address: null — admin fills these in
}).select("id").single();
```

If `venueError` — slug conflict is most likely. Show the error inline: "Slug already exists — check if this school is already in the database."

Step 3: Insert a new row into `public.schools`:
```typescript
const { error: schoolError } = await supabase.from("schools").insert({
  name: entry.raw_name,
  short_name: entry.raw_name.slice(0, 14).toUpperCase(),
  slug,
  latitude: 41.8781,    // Chicago centroid — admin must update
  longitude: -87.6298,
  neighborhood: "Chicago",
  discipline: "acting",  // default — admin must update
  venue_id: newVenue.id,
  url: entry.raw_website_url,
});
```

Step 4: Mark the queue entry as promoted:
```typescript
await supabase.from("venue_discovery_queue")
  .update({ promoted: true, promoted_at: new Date().toISOString() })
  .eq("id", entry.id);
```

Step 5: Show success toast: "School promoted. Edit latitude, longitude, neighborhood, and discipline in Supabase dashboard."

**Reject action — clicking "Reject":**

```typescript
await supabase.from("venue_discovery_queue")
  .update({ rejected_at: new Date().toISOString() })
  .eq("id", entry.id);
// Remove the entry from the UI list immediately (optimistic update)
```

**Discovery log summary — add a "Last Discovery Run" card:**

Below the queue list, show a summary of the most recent discovery run from `discovery_logs`:

```typescript
const { data: lastRunSummary } = await supabase
  .from("discovery_logs")
  .select("run_id, disposition, created_at")
  .order("created_at", { ascending: false })
  .limit(200);

// Group by most recent run_id, count dispositions
```

Display as:
```
LAST DISCOVERY RUN: [date]
  Queued: X  |  Blocked (aggregator): Y  |  Already known: Z
```

**Error state:** If `supabase.from("venues").insert(...)` fails with slug conflict, show the error inline next to the "Promote" button. The queue entry is not modified. The admin must resolve the conflict manually.

**Scope boundary:** Promotion creates a `venues` row and a `schools` row with placeholder coordinates. It does NOT scrape the school's calendar URL. The admin must manually trigger class scraping after promotion, or wait for the next scheduled run. No automatic enrichment on promotion.

---

## 4. Non-Functional Requirements

### Performance

- The `action: "discover"` call must return a response within 60 seconds. Budget: 12 queries × 2 seconds per SerpAPI call = 24 seconds + dedup DB queries + logging inserts. 60 seconds leaves 36 seconds of headroom for slow SerpAPI responses.
- `logDiscoveryResult()` calls must not be awaited in a blocking loop. Use `Promise.allSettled()` or fire-and-forget for log writes to avoid adding latency per result. However, given 240 potential results × ~5ms per insert = ~1.2 seconds, sequential awaiting is acceptable. Implement sequentially for simplicity; optimize if discovery consistently approaches the 60-second budget.
- The queue promotion UI must not block the page. The `schoolQueue` fetch should be in a separate hook that loads independently from the rest of the Coverage tab metrics.

### Security

- The `action: "discover"` path uses the same auth check as the rest of the function (`x-scraper-key` OR authenticated JWT). No additional auth needed.
- `discovery_logs` table: readable by `authenticated` role, writable only by `service_role`. The service_role key is used inside the Edge Function. The frontend reads via the anon key with the RLS policy.
- The Promote action writes to `venues` and `schools` via the client-side Supabase call. These tables must have RLS policies that allow writes from `authenticated` users (specifically admin users). Verify that `venues` and `schools` RLS policies include an admin write policy. If not, add:
  ```sql
  -- Only if not already present
  CREATE POLICY "Admin can insert venues"
    ON public.venues FOR INSERT TO authenticated
    WITH CHECK (auth.jwt() ->> 'email' = 'deric.o.ortiz@gmail.com');
  ```
  Check existing RLS policies on `venues` and `schools` before adding. If a broader admin pattern exists, follow it.

### Reliability

- All SerpAPI HTTP calls must have a 15-second `AbortController` timeout per query. If a query times out, log it to `console.warn()` and continue to the next query.
- A SerpAPI quota exhaustion (429 response) must be caught: log `console.warn("[class-discovery] SerpAPI quota exhausted")`, stop querying, return a partial result with `queries_run: N` for the queries that completed.
- `logDiscoveryResult()` must never throw. All Supabase errors inside it are swallowed.

### Observability

- Every discovery run produces rows in `discovery_logs` for every SerpAPI result processed (not just successful inserts).
- The `run_id` column links all log rows from a single discovery run. The admin can filter by `run_id` to audit a specific run.
- The `action: "discover"` response body includes the run_id, so the admin can paste it into a Supabase query if needed.

---

## 5. Technical Considerations

### Architecture: Why Decouple Discovery

The self-chaining pattern (each chain link processes one school, fires HTTP POST to the next) was inherited from the event scraper. For event scraping, each school is independent and the chain can be broken at any point without data loss. For discovery, there is exactly one block of work (run SerpAPI, dedup, insert). Encoding it as the "last thing in the chain" guarantees it runs in the most vulnerable position — the final fire-and-forget target.

Making `action: "discover"` a first-class invocation path means:
- The cron job can call it directly, not dependent on school scraping completing
- The admin button can call it independently
- The school scrape chain (`action: "start"`) becomes simpler — it never calls `runSerpSearch()`, it just processes schools

### Data Model Impact

**`venue_discovery_queue`** — no schema changes. The existing columns (`raw_name`, `raw_website_url`, `raw_description`, `raw_category`, `promoted`) are sufficient. Verify `promoted` column name against `20260809000002_venue_discovery.sql`.

**`discovery_logs`** — new table (FR-4 migration). Append-only. No FKs to other tables (run_id is a string UUID, not a FK to `scrape_jobs`, because discovery runs are independent of school scraping jobs).

**`schools` and `venues`** — the Promote action in FR-6 writes to both. Schema is unchanged. Promoted schools have placeholder latitude/longitude (Chicago centroid) that the admin must update.

### Integration Points

| Component | Change |
|-----------|--------|
| `supabase/functions/class-discovery/index.ts` | Add `action: "discover"` path (FR-1), aggregator blocklist (FR-2), expanded queries (FR-3), logging calls (FR-4) |
| `supabase/migrations/` | New migration for `discovery_logs` table (FR-4), new migration for iO duplicate fix (FR-5) |
| `src/pages/Docs.tsx` | New "School Discovery Queue" section in Coverage tab (FR-6) |
| `src/hooks/useScrape.ts` or new hook | Fetch school queue, promote/reject handlers (FR-6) |

No changes to:
- `supabase/functions/_shared/` (no shared code changes needed)
- `event-scraper` (unaffected)
- `MapView.tsx`, `VenueSheet.tsx`, `MapMarker.tsx` (class display logic already in place from prior PRD)

### Implementation Order

1. **FR-5 first** (iO duplicate fix) — run pre-condition query, write migration, push. Unblocks correct dedup for `ioimprov.com` domain.
2. **FR-4 migration** (create `discovery_logs` table) — must exist before the Edge Function can write to it.
3. **FR-1 + FR-2 + FR-3 + FR-4 Edge Function changes** — implement together in one pass of `class-discovery/index.ts`.
4. **FR-6** (admin UI) — implement last. Depends on the queue having entries to display.

After step 3, trigger a manual discovery run:
```bash
curl -X POST https://rytjrterecygirttvtdn.supabase.co/functions/v1/class-discovery \
  -H "x-scraper-key: $SCRAPER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "discover"}'
```

Verify the response includes `queued > 0`. Then verify with:
```sql
SELECT raw_name, raw_website_url, disposition
FROM venue_discovery_queue vdq
JOIN discovery_logs dl ON dl.run_id::text = vdq.run_id::text
WHERE vdq.raw_category = 'school'
ORDER BY vdq.created_at DESC
LIMIT 20;
```

---

## 6. Acceptance Criteria (Testable, Binary)

These criteria are written in Given/When/Then format. Every criterion must pass before the feature is considered complete.

### AC-1: SerpAPI Executes on `action: "discover"`

**Given** the `class-discovery` Edge Function is deployed with FR-1 changes and `SERPAPI_KEY` is set.
**When** a POST request is sent with `{"action": "discover"}` and a valid `x-scraper-key`.
**Then** the response body contains `queries_run >= 1` AND `discovery_logs` contains at least 1 row with a `created_at` within the last 60 seconds.

### AC-2: Aggregator Domains Blocked

**Given** a discovery run completes (AC-1 passes).
**When** querying `SELECT COUNT(*) FROM discovery_logs WHERE disposition = 'blocked_aggregator' AND created_at > now() - interval '5 minutes'`.
**Then** the count is >= 1 (SerpAPI reliably returns at least one aggregator result for these queries).

**AND:** `SELECT COUNT(*) FROM venue_discovery_queue WHERE raw_website_url ILIKE '%yelp.com%' OR raw_website_url ILIKE '%classpass.com%'` returns 0.

### AC-3: New Schools Queued

**Given** a discovery run completes with the expanded 12-query set.
**When** querying `SELECT COUNT(*) FROM venue_discovery_queue WHERE raw_category = 'school' AND created_at > now() - interval '1 hour'`.
**Then** the count is >= 1 on the first run (at least one school not previously in the DB or queue is found).

### AC-4: iO Duplicate Removed

**Given** the FR-5 migration has been applied.
**When** querying `SELECT slug FROM venues WHERE slug = 'io-theater'`.
**Then** the query returns 0 rows.

**AND:** `SELECT slug, calendar_url FROM venues WHERE slug = 'io-chicago'` returns `calendar_url = 'https://www.ioimprov.com/chicago/classes/'`.

### AC-5: Promote Flow Creates Schools Row

**Given** at least 1 entry exists in `venue_discovery_queue` with `raw_category = 'school'` and `promoted = false`.
**When** the admin presses "Promote" for that entry in the Coverage tab.
**Then** a new row appears in `schools` with the correct `name` and `venue_id`.

**AND:** The queue entry is updated: `promoted = true`.

**AND:** The UI removes the entry from the pending list.

### AC-6: Reject Flow Hides Entry

**Given** at least 1 entry exists in `venue_discovery_queue` with `raw_category = 'school'` and `promoted = false`.
**When** the admin presses "Reject" for that entry.
**Then** the queue entry is updated with `rejected_at IS NOT NULL`.

**AND:** The entry no longer appears in the pending list in the Coverage tab.

### AC-7: Discovery Logs Surface in Coverage Tab

**Given** a discovery run has completed (AC-1 passes).
**When** the admin views the Coverage tab.
**Then** the "Last Discovery Run" card shows: the run date, a count of queued results, a count of blocked results, and a count of already-known results.

---

## 7. Out of Scope

The following are explicitly NOT part of this fix. They may be addressed in future PRDs:

- **Auto-enrichment of promoted schools** — promoted schools get placeholder coordinates. Geocoding and enrichment are separate features.
- **Automatic scraping of newly promoted schools** — the admin triggers school scraping manually after promotion.
- **SerpAPI result ranking or confidence scoring** — all non-aggregator, non-known results are queued with equal priority.
- **Frontend search for `discovery_logs`** — logs are accessible via Supabase dashboard only. No frontend log viewer.
- **Bulk promotion** — promote one school at a time. Bulk promote is future work.
- **School deduplication against fuzzy name matches** — dedup is domain-exact only. A school with two different domains would appear as two queue entries. This is acceptable for the current volume.

---

## 8. Rollout Plan

**Session 1 — Database**
1. Run pre-condition query for iO Theater.
2. Write and push FR-5 migration (iO duplicate fix).
3. Write and push FR-4 migration (`discovery_logs` table).
4. Verify: `SELECT COUNT(*) FROM venues WHERE slug = 'io-theater'` = 0. `SELECT COUNT(*) FROM discovery_logs` = 0 (empty but exists).

**Session 2 — Edge Function**
1. Implement FR-1 (decouple discovery), FR-2 (aggregator blocklist), FR-3 (expanded queries), FR-4 (logging calls) in `class-discovery/index.ts`.
2. Deploy: `supabase functions deploy class-discovery`.
3. Curl test the `action: "discover"` path.
4. Verify AC-1, AC-2, AC-3.

**Session 3 — Admin UI**
1. Implement FR-6 queue promotion section in `Docs.tsx`.
2. Implement the `useDiscoveryQueue` hook (or extend `useScrape`).
3. Test promote and reject flows.
4. Verify AC-5, AC-6, AC-7.

**Commit convention:** use `/cap` after each session. Bump minor version for Sessions 2 and 3 (Edge Function and frontend changes).

---

## 9. Open Questions for Implementing Agent

These are questions the implementing agent must resolve by reading source code before writing any code. They are not questions for the product owner.

| # | Question | How to Resolve |
|---|----------|----------------|
| Q1 | What is the exact column name for the "promoted" flag in `venue_discovery_queue`? | Read `supabase/migrations/20260809000002_venue_discovery.sql` — look for the column that tracks whether a discovery entry has been promoted to a venue |
| Q2 | What is the exact column name for the "rejected" flag in `venue_discovery_queue`? | Same migration — look for a timestamp column like `rejected_at` or a boolean `is_rejected` |
| Q3 | Does `io-theater` exist in the live DB? | Run `SELECT id, slug, calendar_url FROM venues WHERE slug = 'io-theater'` via MCP or Supabase dashboard |
| Q4 | Does `io-theater` have any class_sessions attached? | Run the pre-condition query in FR-5 |
| Q5 | Does the `venues` table have an admin write policy or a broader "authenticated can insert" policy? | Read existing RLS policies via `SELECT * FROM pg_policies WHERE tablename = 'venues'` — do not add a duplicate policy |
| Q6 | Is the `useScrape` hook the correct place for discovery queue fetch, or does a separate hook exist? | Read `src/hooks/useScrape.ts` — check if it already fetches from `venue_discovery_queue` |

---

[timestamp] 2026-08-18 00:00 CST
