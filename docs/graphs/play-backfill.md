# Graph Engineering: Play Catalog Backfill

**Version:** 1.0.0
**Generated:** 2026-08-14
**Nodes:** 3 | **Phases:** 2 | **Loop specs:** 1

---

## Section 1: Task Graph Topology

### Nodes
```
BACKEND:   bf-edge-function
FRONTEND:  bf-admin-button, bf-unlinked-count
```

### Edges
```
bf-edge-function → bf-admin-button
bf-edge-function → bf-unlinked-count
```

---

## Section 2: Node Specifications

### Node: bf-edge-function
- **Type**: feature
- **Depends on**: (none — play-matcher.ts already exists)
- **Outputs**: `supabase/functions/play-catalog-backfill/index.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `supabase functions deploy play-catalog-backfill` succeeds; POST returns PlayMatchSummary JSON; events with matching titles get play_id set
- **Estimated effort**: Small

### Node: bf-admin-button
- **Type**: feature
- **Depends on**: bf-edge-function
- **Outputs**: `src/pages/Docs.tsx` (modify CoverageTab)
- **Loop pattern**: one-shot
- **Success criteria**: Button appears in Coverage tab; calls backfill endpoint; shows results inline
- **Estimated effort**: Small

### Node: bf-unlinked-count
- **Type**: feature
- **Depends on**: bf-edge-function
- **Outputs**: `src/pages/Docs.tsx` (modify CoverageTab)
- **Loop pattern**: one-shot
- **Success criteria**: Shows "N UNLINKED EVENTS" count on load; updates after backfill runs
- **Estimated effort**: Trivial

---

## Section 3: Loop Specifications

### Loop: bf-edge-function
- **Trigger**: Start of implementation
- **Inner cycle**:
  1. Plan: Read play-matcher.ts exports, existing Edge Function patterns
  2. Execute: Write index.ts with CORS, auth, batch query, runPlayMatcherBatch call
  3. Verify: Deploy, POST with dry_run, confirm response shape matches PlayMatchSummary
- **Evaluator**: Response includes all PlayMatchSummary fields; events_processed > 0
- **Retry**: If deploy fails, check import paths (Deno ESM). If matcher throws, check DEEPSEEK_API_KEY secret.
- **Stop condition**: POST returns valid JSON with match counts

---

## Section 5: Build Phases

### Phase 0: Backend
- [ ] bf-edge-function

### Phase 1: Frontend (parallel after Phase 0)
- [ ] bf-admin-button
- [ ] bf-unlinked-count
