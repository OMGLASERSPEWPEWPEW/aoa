# Graph Engineering: Class Discovery Pipeline Fix

**Version:** 1.0
**Generated:** 2026-08-18
**Nodes:** 10 | **Phases:** 4 | **Loop specs:** 8
**PRD:** `.claude/docs/prd/class-discovery-pipeline-fix.md`
**ADR:** `docs/adr/0008-class-discovery-pipeline-fix.md`
**QA:** `docs/qa/class-discovery-pipeline-fix.md`

---

## Section 1: Task Graph Topology

### Nodes

```
DATA CLEANUP:   cdpf-io-duplicate-fix
DISCOVERY:      cdpf-aggregator-blocklist, cdpf-expanded-queries,
                cdpf-decouple-discover-action, cdpf-discovery-logs
QUEUE:          cdpf-promote-rpc, cdpf-admin-review-ui
INTEGRATION:    cdpf-client-discover-button, cdpf-observability, cdpf-deploy-verify
```

### Edges (→ = "must complete before")

```
cdpf-io-duplicate-fix
    │
    ├──→ cdpf-aggregator-blocklist
    │         │
    │         └──→ cdpf-expanded-queries
    │                   │
    │                   └──→ cdpf-decouple-discover-action
    │
    └──→ cdpf-discovery-logs
              │
              ├──→ cdpf-promote-rpc
              │         │
              │         └──→ cdpf-admin-review-ui
              │
              └──→ cdpf-client-discover-button
                        │
                        └──→ cdpf-observability
                                  │
                                  └──→ cdpf-deploy-verify
```

Note: `cdpf-decouple-discover-action` and `cdpf-discovery-logs` both depend on `cdpf-io-duplicate-fix`. `cdpf-decouple-discover-action` must complete before `cdpf-deploy-verify` since the Edge Function must be coherent before deploying.

### ASCII DAG

```
Phase 0 (Data Cleanup — must run first):
  [cdpf-io-duplicate-fix]

Phase 1 (Discovery Pipeline — all depend on Phase 0):
  Track A: [cdpf-aggregator-blocklist] → [cdpf-expanded-queries] → [cdpf-decouple-discover-action]
  Track B: [cdpf-discovery-logs]

Phase 2 (Queue Promotion — depends on Phase 1 Track B):
  [cdpf-promote-rpc] → [cdpf-admin-review-ui]

Phase 3 (Integration — depends on Phase 1 complete):
  [cdpf-client-discover-button] → [cdpf-observability] → [cdpf-deploy-verify]
```

---

## Section 2: Node Specifications

### Node: cdpf-io-duplicate-fix

- **Type**: schema
- **Agent**: backend-architect
- **Depends on**: (none — root node)
- **Inputs**: `.claude/docs/prd/class-discovery-pipeline-fix.md` §FR-5, live DB state
- **Outputs**:
  - `supabase/migrations/20260819000001_merge_io_duplicate.sql` (new file)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `SELECT COUNT(*) FROM venues WHERE slug = 'io-theater'` returns 0. `SELECT slug, calendar_url FROM venues WHERE slug = 'io-chicago'` returns `calendar_url = 'https://www.ioimprov.com/chicago/classes/'`.
- **Estimated effort**: Trivial

**Pre-condition checks (run via MCP before writing migration):**

```sql
-- Q1: Does io-theater exist?
SELECT id, slug, calendar_url FROM venues WHERE slug = 'io-theater';

-- Q2: Does io-theater have an attached schools row?
SELECT s.id, s.slug FROM schools s JOIN venues v ON s.venue_id = v.id WHERE v.slug = 'io-theater';

-- Q3: Does io-theater have class_sessions attached?
SELECT COUNT(*) FROM class_sessions cs
JOIN schools s ON cs.school_id = s.id
JOIN venues v ON s.venue_id = v.id
WHERE v.slug = 'io-theater';
```

**Case A (expected): `io-theater` exists with no schools row and no class_sessions**

```sql
DELETE FROM public.venues WHERE slug = 'io-theater';
```

**Case B: `io-theater` has a schools row with class_sessions**

```sql
-- Re-parent sessions to io-chicago school, then delete io-theater
UPDATE public.class_sessions
SET school_id = (SELECT id FROM public.schools WHERE slug = 'io-chicago')
WHERE school_id = (
  SELECT s.id FROM public.schools s
  JOIN public.venues v ON s.venue_id = v.id
  WHERE v.slug = 'io-theater'
);

DELETE FROM public.schools WHERE slug = 'io-theater';
DELETE FROM public.venues WHERE slug = 'io-theater';
```

**Always append — ensure canonical calendar_url:**

```sql
UPDATE public.venues
SET calendar_url = 'https://www.ioimprov.com/chicago/classes/'
WHERE slug = 'io-chicago'
  AND (calendar_url IS NULL OR calendar_url != 'https://www.ioimprov.com/chicago/classes/');
```

---

### Node: cdpf-aggregator-blocklist

- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: cdpf-io-duplicate-fix
- **Inputs**: `.claude/docs/prd/class-discovery-pipeline-fix.md` §FR-2, `supabase/functions/class-discovery/index.ts`
- **Outputs**:
  - `supabase/functions/class-discovery/index.ts` (modified — add `AGGREGATOR_DOMAINS` constant and pre-filter logic in `deduplicateAndQueue()`)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: The constant is present at module scope. `deduplicateAndQueue()` applies the pre-filter before the existing dedup loop. A unit test (or manual log inspection) confirms that `yelp.com` and `classpass.com` URLs do not appear in `venue_discovery_queue` after a discovery run.
- **Estimated effort**: Small

**Exact implementation — constant at top of file after `SERPAPI_KEY` declaration:**

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

**Pre-filter block at top of `deduplicateAndQueue()`, before the existing dedup loop:**

```typescript
const filtered: SerpSearchResult[] = [];
let blockedCount = 0;

for (const result of results) {
  const isAggregator = [...AGGREGATOR_DOMAINS].some(agg =>
    result.domain === agg || result.domain.endsWith(`.${agg}`)
  );
  if (isAggregator) {
    blockedCount++;
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
// Replace `results` with `filtered` throughout the rest of deduplicateAndQueue()
```

Note: `logDiscoveryResult()` is defined in `cdpf-discovery-logs`. Since both nodes modify the same file, implement them together in one pass. The constant and pre-filter logic in this node must be written to call `logDiscoveryResult()` — that function will be defined in the same file edit.

---

### Node: cdpf-expanded-queries

- **Type**: config
- **Agent**: backend-architect
- **Depends on**: cdpf-aggregator-blocklist
- **Inputs**: `.claude/docs/prd/class-discovery-pipeline-fix.md` §FR-3, `supabase/functions/class-discovery/index.ts`
- **Outputs**:
  - `supabase/functions/class-discovery/index.ts` (modified — replace `CLASS_SEARCH_QUERIES` constant, change `num` from `"10"` to `"20"`)
- **Loop pattern**: one-shot
- **Success criteria**: `CLASS_SEARCH_QUERIES` array contains exactly 12 entries. No entry contains "2026". The `num` parameter in `searchForSchools()` reads `"20"`. `npm run build` succeeds (TypeScript, not Deno — confirms no syntax errors introduced).
- **Estimated effort**: Trivial

**Replacement `CLASS_SEARCH_QUERIES` constant:**

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

**Change in `searchForSchools()`:**

```typescript
num: "20",   // was "10"
```

The inter-query `delay(500)` is not changed.

---

### Node: cdpf-decouple-discover-action

- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: cdpf-expanded-queries
- **Inputs**: `.claude/docs/prd/class-discovery-pipeline-fix.md` §FR-1, `supabase/functions/class-discovery/index.ts`
- **Outputs**:
  - `supabase/functions/class-discovery/index.ts` (modified — add `action: "discover"` branch, change `runSerpSearch()` return type, remove `runSerpSearch()` call from `processFirstSchool()`)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `curl -X POST $SUPABASE_URL/functions/v1/class-discovery -H "x-scraper-key: $SCRAPER_SECRET" -d '{"action":"discover"}'` returns HTTP 200 with a JSON body containing `queries_run >= 1`. `discovery_logs` contains rows from the run. The `action: "start"` path still returns 200 and processes school venues (no regression).
- **Estimated effort**: Small

**New `action: "discover"` branch at top of request handler (before `action === "start"` check):**

```typescript
if (action === "discover") {
  const runId = crypto.randomUUID();
  const result = await runSerpSearch(runId);
  return new Response(
    JSON.stringify({ action: "discover", run_id: runId, ...result }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
}
```

**`runSerpSearch()` signature change:**

```typescript
// Before:
async function runSerpSearch(jobId: string): Promise<void>

// After:
async function runSerpSearch(runId: string): Promise<{ queued: number; known: number; blocked: number; queries_run: number }>
```

The function must return the aggregated counts from `deduplicateAndQueue()` calls across all queries.

**Remove from `processFirstSchool()`:** Delete the block that calls `runSerpSearch()` when `remaining === 0`. The school scrape chain no longer triggers discovery.

**Error state for missing `SERPAPI_KEY`:**

```typescript
if (!SERPAPI_KEY) {
  return new Response(
    JSON.stringify({ action: "discover", queued: 0, known: 0, blocked: 0, queries_run: 0, warning: "SERPAPI_KEY not set" }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
}
```

---

### Node: cdpf-discovery-logs

- **Type**: schema + feature
- **Agent**: backend-architect
- **Depends on**: cdpf-io-duplicate-fix
- **Inputs**: `.claude/docs/prd/class-discovery-pipeline-fix.md` §FR-4
- **Outputs**:
  - `supabase/migrations/20260819000002_discovery_logs.sql` (new file)
  - `supabase/functions/class-discovery/index.ts` (modified — add `DiscoveryLogEntry` interface, `logDiscoveryResult()` helper, logging calls at each disposition point)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `SELECT COUNT(*) FROM discovery_logs` after a discovery run returns a count equal to the number of SerpAPI results processed (one row per result, not just queued results). Every row has a non-null `disposition` from the allowed enum set.
- **Estimated effort**: Small

**Migration SQL (`20260819000002_discovery_logs.sql`):**

```sql
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

**`logDiscoveryResult()` in `class-discovery/index.ts`:**

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
    console.warn("[class-discovery] Failed to write discovery_log entry for", entry.raw_url);
  }
}
```

**Disposition call sites in `deduplicateAndQueue()`:**

- Passes aggregator filter, passes dedup, inserted: `disposition: "queued"`
- Fails aggregator filter: `disposition: "blocked_aggregator"` (called from cdpf-aggregator-blocklist pre-filter block)
- Domain matches existing venue in DB: `disposition: "already_known_venue"`
- Domain already in `venue_discovery_queue`: `disposition: "already_in_queue"`
- `supabase.from("venue_discovery_queue").insert(...)` returns error: `disposition: "insert_error"`, `reason: error.message`

**Implementation note:** `cdpf-aggregator-blocklist`, `cdpf-expanded-queries`, `cdpf-decouple-discover-action`, and `cdpf-discovery-logs` all modify `class-discovery/index.ts`. Implement all four in a single editing pass to avoid conflicts. The dependency ordering (blocklist → queries → decouple → logs in the graph) reflects the logical dependency between them, not that they must be written in separate edits.

---

### Node: cdpf-promote-rpc

- **Type**: schema
- **Agent**: backend-architect
- **Depends on**: cdpf-discovery-logs
- **Inputs**: `.claude/docs/prd/class-discovery-pipeline-fix.md` §FR-6, `supabase/migrations/20260809000002_venue_discovery.sql` (for exact column names)
- **Outputs**:
  - `supabase/migrations/20260819000003_promote_school_rpc.sql` (new file)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `SELECT public.promote_school_candidate('<valid-queue-id>')` returns a JSON object with `venue_id` and `school_id`. A new row appears in `venues` with `venue_type = 'school'`. A new row appears in `schools` with `venue_id` matching the new venue. The queue entry is updated with `promoted = true` (or the correct column name from the schema).
- **Estimated effort**: Small

**Pre-read required:** Read `supabase/migrations/20260809000002_venue_discovery.sql` to determine the exact column names for the promoted and rejected flags before writing this migration.

**Migration creates a Postgres function `promote_school_candidate(queue_id uuid)`:**

The function encapsulates the multi-step promotion in a single atomic transaction:
1. Fetch the queue entry by `queue_id` — error if not found or already promoted/rejected.
2. Generate a slug from `raw_name` using `lower(regexp_replace(raw_name, '[^a-z0-9]+', '-', 'gi'))`.
3. Check if a `venues` row already exists with matching domain (extracted from `raw_website_url`). If yes, use that `venue_id`. If no, insert a new `venues` row with `venue_type = 'school'`, `source = 'discovery'`, and Chicago centroid coordinates (`41.8781, -87.6298`) as placeholders.
4. Insert a new `schools` row referencing the venue.
5. Mark the queue entry as promoted (use exact column name from schema).
6. Return `json_build_object('venue_id', venue_id, 'school_id', school_id)`.

The function runs with `SECURITY DEFINER` so that authenticated users can call it without needing direct insert permissions on `venues` and `schools`. Grant execute to `authenticated`:

```sql
GRANT EXECUTE ON FUNCTION public.promote_school_candidate(uuid) TO authenticated;
```

Wrap with admin email guard inside the function body:
```sql
IF auth.jwt() ->> 'email' != 'deric.o.ortiz@gmail.com' THEN
  RAISE EXCEPTION 'Admin access required';
END IF;
```

---

### Node: cdpf-admin-review-ui

- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: cdpf-promote-rpc
- **Inputs**: `.claude/docs/prd/class-discovery-pipeline-fix.md` §FR-6, `src/pages/Docs.tsx`, `supabase/migrations/20260809000002_venue_discovery.sql`
- **Outputs**:
  - `src/components/admin/SchoolCandidatesSection.tsx` (new file)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: The Coverage tab in `Docs.tsx` renders a "SCHOOL DISCOVERY QUEUE" section. It shows a count badge ("X schools awaiting review"). Each pending queue entry renders: raw_name, domain extracted from raw_website_url, truncated description (120 chars), a "Promote" button, and a "Reject" button. Pressing "Promote" calls `supabase.rpc('promote_school_candidate', { queue_id: entry.id })`, shows a success toast on completion ("School promoted. Edit latitude, longitude, neighborhood, and discipline in Supabase dashboard."), and removes the entry from the list. Pressing "Reject" updates the queue entry with the rejected timestamp and removes it from the list optimistically.
- **Estimated effort**: Small

**Data fetch hook — `useDiscoveryQueue` (co-locate in `src/hooks/` or inline in component):**

```typescript
const { data: schoolQueue, refetch } = useQuery({
  queryKey: ["school-discovery-queue"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("venue_discovery_queue")
      .select("id, raw_name, raw_website_url, raw_description, created_at")
      .eq("raw_category", "school")
      .eq("promoted", false)          // verify exact column name
      .is("rejected_at", null)        // verify exact column name
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data;
  },
});
```

**Promote handler:**

```typescript
const handlePromote = async (entry: QueueEntry) => {
  const { data, error } = await supabase.rpc("promote_school_candidate", { queue_id: entry.id });
  if (error) {
    setPromoteError(entry.id, error.message);
    return;
  }
  toast("School promoted. Edit latitude, longitude, neighborhood, and discipline in Supabase dashboard.");
  refetch();
};
```

**Reject handler:**

```typescript
const handleReject = async (entry: QueueEntry) => {
  await supabase.from("venue_discovery_queue")
    .update({ rejected_at: new Date().toISOString() })
    .eq("id", entry.id);
  // Optimistic: remove from local list immediately
  setQueue(prev => prev.filter(e => e.id !== entry.id));
};
```

**Import and render** `SchoolCandidatesSection` in `Docs.tsx` within the Coverage tab, below the existing venue coverage metrics.

---

### Node: cdpf-client-discover-button

- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: cdpf-discovery-logs (table must exist before the button triggers a run)
- **Inputs**: `.claude/docs/prd/class-discovery-pipeline-fix.md` §FR-1, `src/pages/Docs.tsx`
- **Outputs**:
  - `src/pages/Docs.tsx` (modified — add "Discover Schools" button in the Coverage tab)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: The Coverage tab shows a "DISCOVER SCHOOLS" button styled consistently with existing admin action buttons. Pressing it fires a POST to `class-discovery` with `{"action": "discover"}` using the existing `callEdgeFunction` or fetch pattern. The button is disabled while the request is in flight. On success, the response JSON (including `queued`, `blocked`, `known`, `queries_run`) is displayed inline below the button. On error, an error message is shown.
- **Estimated effort**: Trivial

**Implementation:** Read `Docs.tsx` to understand the existing admin button pattern (used for existing scraper triggers). Replicate that exact pattern for the discover action. The response is a single JSON object (not an NDJSON stream), so no streaming reader is needed — a simple `await response.json()` suffices.

**Display after successful run:**

```
Run complete: queued [X] | blocked [Y] | already known [Z] | queries run [N]
```

If the response contains `warning: "SERPAPI_KEY not set"`, display: "Warning: SERPAPI_KEY is not configured. No results were returned."

---

### Node: cdpf-observability

- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: cdpf-client-discover-button
- **Inputs**: `.claude/docs/prd/class-discovery-pipeline-fix.md` §FR-6 (discovery log summary card), `src/components/admin/`
- **Outputs**:
  - `src/components/admin/DiscoveryStatsCard.tsx` (new file)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: The Coverage tab shows a "LAST DISCOVERY RUN" card. After a discovery run completes, the card displays: the run date, a count of queued results, a count of blocked (aggregator) results, and a count of already-known results. All values match `SELECT disposition, COUNT(*) FROM discovery_logs WHERE run_id = '<most-recent-run-id>' GROUP BY disposition`.
- **Estimated effort**: Small

**Data fetch — most recent run summary:**

```typescript
const { data: recentLogs } = await supabase
  .from("discovery_logs")
  .select("run_id, disposition, created_at")
  .order("created_at", { ascending: false })
  .limit(200);

// Derive: most recent run_id from recentLogs[0].run_id
// Group by disposition for that run_id only
// Display: run date, queued count, blocked_aggregator count, already_known_venue + already_in_queue count
```

**Display format:**

```
LAST DISCOVERY RUN: [date]
Queued: X  |  Blocked (aggregator): Y  |  Already known: Z
```

If no rows in `discovery_logs`, show: "No discovery runs recorded yet."

**Import and render** `DiscoveryStatsCard` in `Docs.tsx` Coverage tab, below the "Discover Schools" button and above the school queue list.

---

### Node: cdpf-deploy-verify

- **Type**: deployment
- **Agent**: devops-engineer
- **Depends on**: cdpf-decouple-discover-action, cdpf-discovery-logs, cdpf-promote-rpc, cdpf-admin-review-ui, cdpf-client-discover-button, cdpf-observability
- **Inputs**: All Edge Function changes in `supabase/functions/class-discovery/index.ts`, all migrations in `supabase/migrations/`
- **Outputs**: (deployment step, no file output)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: (see verification steps below)
- **Estimated effort**: Small

**Deploy sequence:**

```bash
# 1. Push all migrations
supabase db push

# 2. Deploy the Edge Function
supabase functions deploy class-discovery

# 3. Verify action: "discover"
curl -sX POST https://rytjrterecygirttvtdn.supabase.co/functions/v1/class-discovery \
  -H "x-scraper-key: $SCRAPER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "discover"}' | jq .

# Expected: {"action":"discover","run_id":"<uuid>","queued":<n>,"known":<n>,"blocked":<n>,"queries_run":12}

# 4. Verify discovery_logs populated
# (via Supabase MCP or dashboard)
# SELECT COUNT(*), disposition FROM discovery_logs WHERE run_id = '<run_id from step 3>' GROUP BY disposition;

# 5. Verify iO duplicate removed
# SELECT COUNT(*) FROM venues WHERE slug = 'io-theater';  -- must return 0

# 6. Verify action: "start" still works (no regression)
curl -sX POST https://rytjrterecygirttvtdn.supabase.co/functions/v1/class-discovery \
  -H "x-scraper-key: $SCRAPER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}' | head -c 500
# Expected: NDJSON stream with school scrape results
```

**Acceptance gate:** `queries_run` in the discover response equals 12. At least 1 row in `discovery_logs` with `disposition = 'blocked_aggregator'` (confirming aggregator filter is active). At least 1 row with `disposition = 'queued'` (confirming new schools were found).

---

## Section 3: Loop Specifications

### Loop: cdpf-io-duplicate-fix

- **Trigger**: Session begins — run this before any other node
- **Inner cycle**:
  1. Plan: Run all three pre-condition queries via Supabase MCP. Determine Case A or Case B.
  2. Execute: Write the appropriate migration SQL. Push via `supabase db push`.
  3. Verify: `SELECT COUNT(*) FROM venues WHERE slug = 'io-theater'` = 0. `SELECT calendar_url FROM venues WHERE slug = 'io-chicago'` = `'https://www.ioimprov.com/chicago/classes/'`.
- **Evaluator**: Both verify queries pass = done. `io-theater` still exists = migration failed (check FK constraint violations, apply Case B if Case A failed).
- **Retry**: If Case A fails with FK violation, switch to Case B. Max 1 retry.
- **Stop condition**: `io-theater` row absent from `venues` table.

---

### Loop: cdpf-aggregator-blocklist

- **Trigger**: cdpf-io-duplicate-fix complete
- **Inner cycle**:
  1. Plan: Read `class-discovery/index.ts` in full. Identify `SERPAPI_KEY` declaration (insertion point for constant) and `deduplicateAndQueue()` function (insertion point for pre-filter).
  2. Execute: Insert `AGGREGATOR_DOMAINS` constant. Insert pre-filter block at top of `deduplicateAndQueue()`. Update `deduplicateAndQueue()` return type to include `blocked` count.
  3. Verify: `grep -n "AGGREGATOR_DOMAINS" supabase/functions/class-discovery/index.ts` returns at least 2 hits (declaration + usage). The pre-filter block references `filtered` (not `results`) after the loop.
- **Evaluator**: Grep confirms constant and usage = pass. Missing constant = re-read and re-insert.
- **Retry**: Max 1 retry.
- **Stop condition**: `AGGREGATOR_DOMAINS` declared and applied in `deduplicateAndQueue()`.

---

### Loop: cdpf-discovery-logs

- **Trigger**: cdpf-io-duplicate-fix complete (parallel with cdpf-aggregator-blocklist track)
- **Inner cycle**:
  1. Plan: Write migration `20260819000002_discovery_logs.sql` with table DDL, indexes, and RLS policies from PRD §FR-4.
  2. Execute: Push migration. Add `DiscoveryLogEntry` interface and `logDiscoveryResult()` helper to `class-discovery/index.ts`. Add `logDiscoveryResult()` call at each of the 5 disposition points in `deduplicateAndQueue()`.
  3. Verify: `SELECT COUNT(*) FROM discovery_logs` returns 0 (table exists but is empty — no runs yet). `\d public.discovery_logs` confirms columns and CHECK constraint. After a discovery run: `SELECT disposition, COUNT(*) FROM discovery_logs GROUP BY disposition` returns at least one row.
- **Evaluator**: Table exists with correct schema = migration pass. All 5 disposition points have logging calls = code pass.
- **Retry**: If migration fails on CHECK constraint syntax, check Postgres version compatibility. Max 1 retry.
- **Stop condition**: `discovery_logs` table exists in DB; `logDiscoveryResult()` is defined and called at all 5 disposition points in source.

---

### Loop: cdpf-decouple-discover-action

- **Trigger**: cdpf-expanded-queries complete (all three prior Discovery nodes implemented in the same file pass)
- **Inner cycle**:
  1. Plan: Read `class-discovery/index.ts` after the three prior edits. Identify: the `serve()` handler's action dispatch block, the `processFirstSchool()` function where `runSerpSearch()` is currently called, and the `runSerpSearch()` function signature.
  2. Execute: Add `action === "discover"` branch at top of handler. Change `runSerpSearch()` return type. Add `SERPAPI_KEY` guard. Remove `runSerpSearch()` call from `processFirstSchool()`.
  3. Verify: `supabase functions deploy class-discovery` succeeds. `curl -d '{"action":"discover"}'` returns 200 with `queries_run` field. `curl -d '{"action":"start"}'` returns 200 with NDJSON stream (regression check).
- **Evaluator**: Both curl tests pass = done. `curl -d '{"action":"discover"}'` returns 500 = runtime error (check import paths, missing `logDiscoveryResult()` definition). `action: "start"` breaks = check that `runSerpSearch()` removal from `processFirstSchool()` did not remove surrounding logic.
- **Retry**: Fix the specific failure. Max 2 cycles.
- **Stop condition**: Both action paths return 200 with expected response shapes.

---

### Loop: cdpf-promote-rpc

- **Trigger**: cdpf-discovery-logs complete
- **Inner cycle**:
  1. Plan: Read `supabase/migrations/20260809000002_venue_discovery.sql` for exact column names (`promoted`, `rejected_at` or equivalent).
  2. Execute: Write migration `20260819000003_promote_school_rpc.sql` with the `promote_school_candidate(uuid)` Postgres function. Push.
  3. Verify: `SELECT public.promote_school_candidate('<any-valid-queue-id>')` — if no queue entries exist, insert a test row first: `INSERT INTO venue_discovery_queue (raw_name, raw_website_url, raw_category) VALUES ('Test School', 'https://testschool.com', 'school')`. Confirm return JSON contains `venue_id` and `school_id`. Confirm rows appear in `venues` and `schools`. Confirm queue entry is marked promoted.
- **Evaluator**: RPC returns JSON with both IDs = pass. `permission denied` = check `GRANT EXECUTE`. `slug already exists` = test data conflict, use a unique `raw_name`.
- **Retry**: Fix GRANT or slug conflict. Max 1 retry.
- **Stop condition**: `promote_school_candidate()` creates rows in `venues` and `schools` atomically and marks the queue entry promoted.

---

### Loop: cdpf-admin-review-ui

- **Trigger**: cdpf-promote-rpc complete
- **Inner cycle**:
  1. Plan: Read `src/pages/Docs.tsx` to understand the Coverage tab structure and existing admin section patterns.
  2. Execute: Write `src/components/admin/SchoolCandidatesSection.tsx`. Import and render in Coverage tab of `Docs.tsx`.
  3. Verify: In dev browser, navigate to Coverage tab. Confirm "SCHOOL DISCOVERY QUEUE" section appears. If queue is empty (no discovery runs yet), section shows "0 schools awaiting review" — not a blank section. Press "Promote" on a seeded test queue entry and confirm the school appears in `schools` table.
- **Evaluator**: Section renders with correct count = pass. Missing section = check import in `Docs.tsx`. "Promote" fails with 403 = check `promote_school_candidate` GRANT and admin email guard.
- **Retry**: Fix import or GRANT. Max 2 cycles.
- **Stop condition**: Promote and Reject flows both work end-to-end in the dev browser.

---

### Loop: cdpf-observability

- **Trigger**: cdpf-client-discover-button complete
- **Inner cycle**:
  1. Plan: Read `src/components/admin/` directory to understand existing card component patterns.
  2. Execute: Write `src/components/admin/DiscoveryStatsCard.tsx`. Import in `Docs.tsx` Coverage tab. The data fetch queries `discovery_logs` ordered by `created_at DESC`, groups by the most recent `run_id`, and counts by `disposition`.
  3. Verify: After triggering a discovery run via the "Discover Schools" button, refresh the Coverage tab. The "LAST DISCOVERY RUN" card shows a date and non-zero counts for at least one disposition. Values match a direct SQL query: `SELECT disposition, COUNT(*) FROM discovery_logs WHERE run_id = '<last-run-id>' GROUP BY disposition`.
- **Evaluator**: Card renders with correct counts = pass. "No discovery runs recorded yet" when runs exist = check `order` direction in query.
- **Retry**: Fix query or import. Max 1 retry.
- **Stop condition**: Stats card displays correct counts from the most recent discovery run.

---

### Loop: cdpf-deploy-verify

- **Trigger**: All prior nodes complete
- **Inner cycle**:
  1. Plan: Confirm all migrations are in `supabase/migrations/` and all Edge Function edits are saved.
  2. Execute: `supabase db push`, `supabase functions deploy class-discovery`.
  3. Verify: Run the full verification sequence from the node spec. Check all acceptance criteria from PRD §6.
- **Evaluator**: All 6 acceptance criteria pass = done. Any failure = diagnose via `supabase functions logs class-discovery` and `discovery_logs` table.
- **Retry**: Fix root cause of failing AC. Max 2 cycles per AC.
- **Stop condition**: AC-1 through AC-7 all pass.

---

## Section 4: Shared State

| State | Set by | Consumed by |
|-------|--------|-------------|
| `io-theater` removed from `venues` | cdpf-io-duplicate-fix | cdpf-decouple-discover-action (correct dedup for ioimprov.com domain) |
| `AGGREGATOR_DOMAINS` constant | cdpf-aggregator-blocklist | cdpf-decouple-discover-action (pre-filter called from `deduplicateAndQueue()`) |
| `CLASS_SEARCH_QUERIES` (12 entries, no year suffix) | cdpf-expanded-queries | cdpf-decouple-discover-action (`runSerpSearch()` iterates the array) |
| `action: "discover"` handler + updated `runSerpSearch()` signature | cdpf-decouple-discover-action | cdpf-client-discover-button (button target), cdpf-deploy-verify (curl test) |
| `discovery_logs` table | cdpf-discovery-logs (migration) | cdpf-decouple-discover-action (`logDiscoveryResult()` writes to it), cdpf-observability (reads from it) |
| `logDiscoveryResult()` function | cdpf-discovery-logs | cdpf-aggregator-blocklist (calls it for blocked_aggregator disposition) |
| `promote_school_candidate(uuid)` RPC | cdpf-promote-rpc | cdpf-admin-review-ui (calls on "Promote" press) |
| Pending school queue entries in `venue_discovery_queue` | cdpf-decouple-discover-action (discovery run populates) | cdpf-admin-review-ui (fetches and renders), cdpf-observability (counts by disposition) |

---

## Section 5: Build Phases

### Phase 0: Data Cleanup

- [ ] cdpf-io-duplicate-fix → `supabase/migrations/20260819000001_merge_io_duplicate.sql`

**Gate:** `SELECT COUNT(*) FROM venues WHERE slug = 'io-theater'` = 0 before Phase 1.

---

### Phase 1: Discovery Pipeline

Track A (Edge Function — implement in one pass of `class-discovery/index.ts`):
- [ ] cdpf-aggregator-blocklist → `supabase/functions/class-discovery/index.ts` (add `AGGREGATOR_DOMAINS` + pre-filter)
- [ ] cdpf-expanded-queries → `supabase/functions/class-discovery/index.ts` (replace `CLASS_SEARCH_QUERIES`, bump `num` to `"20"`)
- [ ] cdpf-decouple-discover-action → `supabase/functions/class-discovery/index.ts` (add `action: "discover"`, change `runSerpSearch()` return type, remove from chain)

Track B (Schema — can run in parallel with Track A):
- [ ] cdpf-discovery-logs → `supabase/migrations/20260819000002_discovery_logs.sql` + `class-discovery/index.ts` (`logDiscoveryResult()` helper + 5 disposition call sites)

**Gate (Track A):** `supabase functions deploy class-discovery` succeeds. `curl -d '{"action":"discover"}'` returns 200 with `queries_run: 12`. `curl -d '{"action":"start"}'` still returns 200 with NDJSON stream (no regression).
**Gate (Track B):** `SELECT COUNT(*) FROM discovery_logs` returns a row count equal to SerpAPI results processed after a test run.

---

### Phase 2: Queue Promotion

- [ ] cdpf-promote-rpc → `supabase/migrations/20260819000003_promote_school_rpc.sql`
- [ ] cdpf-admin-review-ui → `src/components/admin/SchoolCandidatesSection.tsx`

**Gate:** Promote flow creates rows in `venues` and `schools` and marks queue entry promoted. Reject flow marks queue entry with `rejected_at` timestamp.

---

### Phase 3: Integration

- [ ] cdpf-client-discover-button → `src/pages/Docs.tsx` (add "DISCOVER SCHOOLS" button)
- [ ] cdpf-observability → `src/components/admin/DiscoveryStatsCard.tsx`
- [ ] cdpf-deploy-verify → deployment step (no file output)

**Gate:** All 7 acceptance criteria from PRD §6 pass. `queries_run: 12` in discover response. At least 1 row in `discovery_logs` with `disposition = 'blocked_aggregator'`. At least 1 row with `disposition = 'queued'`.
