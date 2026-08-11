# Graph Engineering: Multi-Pass AI Event Extraction

**Version:** 1.0
**Generated:** 2026-08-10
**Nodes:** 7 | **Phases:** 3 | **Loop specs:** 2

---

## Section 1: Task Graph Topology

### Nodes
```
BACKEND:   mpe-types, mpe-migration, mpe-extraction-prompt, mpe-verification-prompt, mpe-process-venue
FRONTEND:  mpe-prompts-tab, mpe-price-display
```

### Edges
```
mpe-types → mpe-extraction-prompt → mpe-process-venue
mpe-types → mpe-verification-prompt → mpe-process-venue
mpe-migration → mpe-process-venue
mpe-process-venue → mpe-prompts-tab
mpe-process-venue → mpe-price-display
```

---

## Section 2: Node Specifications

#### Node: mpe-types
- **Type**: types
- **Depends on**: (none)
- **Outputs**: `supabase/functions/_shared/scraper/types.ts`, `src/lib/types.ts`
- **Loop pattern**: one-shot
- **Success criteria**: Build passes, new types importable
- **Estimated effort**: Trivial

Add: `Pass1Event`, `Pass2Verification`, `ExtractionResult`, `VerificationResult`. Add `extraction_confidence` to frontend Event type.

#### Node: mpe-migration
- **Type**: migration
- **Depends on**: (none)
- **Outputs**: `supabase/migrations/20260810000003_extraction_confidence.sql`
- **Loop pattern**: one-shot
- **Success criteria**: `supabase db push` succeeds, column exists
- **Estimated effort**: Trivial

#### Node: mpe-extraction-prompt
- **Type**: feature
- **Depends on**: mpe-types
- **Outputs**: `supabase/functions/_shared/scraper/extraction-prompt.ts`
- **Loop pattern**: one-shot
- **Success criteria**: Prompt removes description/genre/cast/photo fields, adds explicit price null rule, venue attribution rule, date sanity rule
- **Estimated effort**: Small

#### Node: mpe-verification-prompt
- **Type**: feature
- **Depends on**: mpe-types
- **Outputs**: `supabase/functions/_shared/scraper/verification-prompt.ts` (new)
- **Loop pattern**: one-shot
- **Success criteria**: File exports `buildVerificationPrompt(venueName, events)`, returns verification prompt string
- **Estimated effort**: Small

#### Node: mpe-process-venue
- **Type**: feature
- **Depends on**: mpe-extraction-prompt, mpe-verification-prompt, mpe-migration
- **Outputs**: `supabase/functions/event-scraper/index.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: processVenue calls both passes sequentially; rejected events not inserted; corrections applied; confidence stored; costs logged with separate feature strings
- **Estimated effort**: Medium

#### Node: mpe-prompts-tab
- **Type**: feature
- **Depends on**: mpe-process-venue
- **Outputs**: `src/pages/Docs.tsx`
- **Loop pattern**: one-shot
- **Success criteria**: Two prompt cards in AI Prompts tab (Pass 1 + Pass 2) instead of one
- **Estimated effort**: Trivial

#### Node: mpe-price-display
- **Type**: feature
- **Depends on**: mpe-process-venue
- **Outputs**: Frontend price display component
- **Loop pattern**: one-shot
- **Success criteria**: null prices show "$ TBD", price_min=0 shows "Free"
- **Estimated effort**: Trivial

---

## Section 3: Loop Specifications

### Loop: mpe-process-venue
- **Trigger**: Both prompt files + types + migration complete
- **Inner cycle**:
  1. Plan: Read current processVenue, plan split into extractEventsPass1 + verifyEventsPass2 + mergeExtractionResults
  2. Execute: Implement three functions, update processVenue orchestration, log both passes separately
  3. Verify: Deploy, run scraper on 3 venues via curl, check events table for null prices (not 0), no misattributed events, confidence scores stored
- **Evaluator**: Events with unknown prices have null (not 0). Events at wrong venues are rejected. Confidence scores between 0-1.
- **Retry**: Fix prompt text or merge logic (max 2 cycles)
- **Stop condition**: 3 test venues produce correctly priced, attributed, scored events

---

## Section 5: Build Phases

### Phase 1: Foundation (parallel)
- [ ] mpe-types
- [ ] mpe-migration

### Phase 2: Prompts + Pipeline (sequential)
- [ ] mpe-extraction-prompt
- [ ] mpe-verification-prompt
- [ ] mpe-process-venue

### Phase 3: Frontend (parallel)
- [ ] mpe-prompts-tab
- [ ] mpe-price-display

---

## File Index

| File | Node | Action |
|------|------|--------|
| `supabase/functions/_shared/scraper/types.ts` | mpe-types | Modify |
| `src/lib/types.ts` | mpe-types | Modify |
| `supabase/migrations/20260810000003_extraction_confidence.sql` | mpe-migration | Create |
| `supabase/functions/_shared/scraper/extraction-prompt.ts` | mpe-extraction-prompt | Rewrite |
| `supabase/functions/_shared/scraper/verification-prompt.ts` | mpe-verification-prompt | Create |
| `supabase/functions/event-scraper/index.ts` | mpe-process-venue | Modify |
| `src/pages/Docs.tsx` | mpe-prompts-tab | Modify |
