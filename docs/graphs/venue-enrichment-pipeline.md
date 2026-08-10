# Graph Engineering: Venue Enrichment Pipeline

**Version:** 1.0
**Generated:** 2026-08-10
**Nodes:** 4 | **Phases:** 2 | **Loop specs:** 1

---

## Section 1: Task Graph Topology

### Nodes
```
BACKEND:   vep-enrich-function, vep-strip-discovery
FRONTEND:  vep-discovery-loop, vep-deploy
```

### Edges
```
vep-enrich-function → vep-strip-discovery → vep-discovery-loop → vep-deploy
```

---

## Section 2: Node Specifications

#### Node: vep-enrich-function
- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: (none)
- **Inputs**: `supabase/functions/venue-discovery/enrichment.ts` (reuse enrichBatch), `supabase/functions/venue-discovery/index.ts` (copy CORS + auth pattern)
- **Outputs**: `supabase/functions/venue-enrich/index.ts` (new file)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `curl -X POST -H "x-scraper-key: aoa-scraper-2026" .../functions/v1/venue-enrich` returns `{ enriched: N, remaining: M, failed: F }` with N > 0 if pending rows exist
- **Estimated effort**: Small

**Implementation:**
```
1. Create supabase/functions/venue-enrich/index.ts
2. Copy CORS headers + dual auth from venue-discovery/index.ts
3. Query: SELECT ... FROM venue_discovery_queue WHERE dedup_status='new' AND enrichment_status='pending' ORDER BY created_at ASC LIMIT 5
4. Call enrichBatch(supabase, candidates) — import from ../venue-discovery/enrichment.ts
5. Count remaining: SELECT count(*) ... WHERE dedup_status='new' AND enrichment_status='pending'
6. Return JSON { enriched, remaining, failed }
7. Deploy with: supabase functions deploy venue-enrich --no-verify-jwt
```

#### Node: vep-strip-discovery
- **Type**: refactor
- **Agent**: backend-architect
- **Depends on**: vep-enrich-function
- **Inputs**: `supabase/functions/venue-discovery/index.ts`
- **Outputs**: `supabase/functions/venue-discovery/index.ts` (modified — enrichment removed)
- **Loop pattern**: one-shot
- **Success criteria**: venue-discovery function returns parse+dedup results only, no enrichment phase, build passes
- **Estimated effort**: Trivial

**Remove from index.ts:**
- `import { enrichBatch }` line
- Variables: `enrichSuccess`, `enrichFailed`, `totalAiIn`, `totalAiOut`
- The entire `// --- Phase 3: Enrichment ---` block
- Enrichment fields from the summary NDJSON event and discovery_runs update
- Redeploy: `supabase functions deploy venue-discovery --no-verify-jwt`

#### Node: vep-discovery-loop
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: vep-strip-discovery
- **Inputs**: `src/pages/Docs.tsx` (CoverageTab component, handleRunDiscovery function)
- **Outputs**: `src/pages/Docs.tsx` (modified)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Pressing "Run Discovery" shows parse progress → "Found N new" → auto-loops enrichment with "Enriching X/N" → "Done" when remaining=0
- **Estimated effort**: Small

**Replace handleRunDiscovery with:**
```typescript
// State: discoveryProgress with phase/found/enriched/total/error

// Phase 1: Discovery
const discoverRes = await fetch(venue-discovery URL, { auth })
const discoverData = await discoverRes.json() // read NDJSON last line for summary
// Extract venues_new from summary

// Phase 2: Enrichment loop
if (venues_new > 0) {
  let remaining = venues_new
  let enriched = 0
  while (remaining > 0) {
    const res = await fetch(venue-enrich URL, { auth })
    const data = await res.json()
    enriched += data.enriched
    remaining = data.remaining
    // Update progress state: { phase: 'enriching', enriched, total: venues_new }
  }
}
// Refetch metrics + queue
```

**Progress UI (replace the button area):**
```
idle:        [Run Discovery]
discovering: [Discovering...]     subtitle: "Parsing ChicagoPlays..."
enriching:   [Enriching 40/195]   subtitle: "Found 195 new theaters"
done:        [Run Discovery]     subtitle: "195 venues enriched"
error:       [Run Discovery]     subtitle: "Error: <msg>. Tap to retry."
```

#### Node: vep-deploy
- **Type**: config
- **Agent**: devops-engineer
- **Depends on**: vep-discovery-loop
- **Inputs**: Both edge functions deployed, frontend built
- **Outputs**: (deployment only)
- **Loop pattern**: one-shot
- **Success criteria**: Admin presses Run Discovery on iPhone, sees full flow complete
- **Estimated effort**: Trivial

---

## Section 3: Loop Specifications

### Loop: vep-enrich-function
- **Trigger**: vep-enrich-function node starts
- **Inner cycle**:
  1. Plan: Read enrichment.ts enrichBatch signature, read venue-discovery CORS/auth pattern
  2. Execute: Create venue-enrich/index.ts with query + enrichBatch call + remaining count
  3. Verify: Deploy function, curl test with scraper key, confirm { enriched, remaining } response
- **Evaluator**: Function processes exactly LIMIT venues, remaining count decreases, dead websites don't crash
- **Retry**: Fix query or import path, redeploy (max 2 cycles)
- **Stop condition**: curl returns correct JSON with enriched > 0

### Loop: vep-discovery-loop
- **Trigger**: vep-strip-discovery complete
- **Inner cycle**:
  1. Plan: Read current handleRunDiscovery, design state machine for progress display
  2. Execute: Replace handler with two-phase loop, add progress state + UI
  3. Verify: npm run build, test in browser — press button, observe full flow
- **Evaluator**: Button press triggers discovery → enrichment loop → done, with visible progress
- **Retry**: Fix fetch/response parsing or progress state (max 2 cycles)
- **Stop condition**: Full flow completes in browser with progress visible

---

## Section 5: Build Phases

### Phase 1: Backend
- [ ] vep-enrich-function
- [ ] vep-strip-discovery

### Phase 2: Frontend + Deploy
- [ ] vep-discovery-loop
- [ ] vep-deploy

---

## File Index

| File | Node | Action |
|------|------|--------|
| `supabase/functions/venue-enrich/index.ts` | vep-enrich-function | Create |
| `supabase/functions/venue-discovery/index.ts` | vep-strip-discovery | Modify (remove enrichment) |
| `src/pages/Docs.tsx` | vep-discovery-loop | Modify (replace handleRunDiscovery) |
