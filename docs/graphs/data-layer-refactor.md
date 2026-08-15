# Graph Engineering: Data Layer Refactoring

**Date:** 2026-08-15
**Version:** 1.0
**Feature:** Data Layer Refactoring
**PRD:** `.claude/docs/prd/data-layer-refactor.md`
**ADR:** `docs/adr/0005-data-layer-refactor.md`

This document is the executable build specification for the Data Layer Refactoring. It defines the task graph, node specifications, loop patterns, and build phases that Claude Code agents execute to implement the refactoring node-by-node.

**How to use this document:** Read Section 5 (Build Phases) to find the starting node. Read the node spec and its loop spec. Execute. Mark the node complete. Advance to the next node in the phase.

---

## Section 1: Task Graph Topology

### Nodes

```
TYPES:       dlr-types-consolidate, dlr-join-types, dlr-fix-as-any
QUERIES:     dlr-queries-ts, dlr-querykeys-ts, dlr-update-existing-hooks, dlr-update-mapdata
MIGRATION:   dlr-migrate-batch1, dlr-migrate-batch2, dlr-migrate-batch3, dlr-migrate-batch4, dlr-update-page-queries
COMPONENTS:  dlr-extract-myshows, dlr-extract-production, dlr-extract-discover, dlr-extract-playdetail
```

### Edges (→ = "must complete before")

```
dlr-types-consolidate
        │
  dlr-join-types
        │
        ├──→ dlr-fix-as-any
        │
        └──→ dlr-queries-ts
                    │
              dlr-querykeys-ts
                /           \
dlr-update-existing-hooks    \
                              \
dlr-fix-as-any ──→ dlr-update-mapdata
                              \
                        dlr-migrate-batch1
                              │
                        dlr-migrate-batch2
                              │
                        dlr-migrate-batch3
                              │
                        dlr-migrate-batch4
                              │
                        dlr-update-page-queries
                        /    |    |    \
    dlr-extract-myshows  |    |  dlr-extract-playdetail
              dlr-extract-production
                    dlr-extract-discover
```

### ASCII DAG

```
Phase A (Types Foundation):
  [dlr-types-consolidate] → [dlr-join-types] → [dlr-fix-as-any]

Phase B (Query Layer):
  [dlr-join-types] → [dlr-queries-ts] → [dlr-querykeys-ts]
                                              │
  Track B1: [dlr-querykeys-ts] → [dlr-update-existing-hooks]
  Track B2: [dlr-fix-as-any] + [dlr-queries-ts] → [dlr-update-mapdata]
  (B1 and B2 are parallel)

Phase C (TanStack Migration — sequential):
  [dlr-migrate-batch1] → [dlr-migrate-batch2] → [dlr-migrate-batch3] → [dlr-migrate-batch4] → [dlr-update-page-queries]

Phase D (Component Decomposition — all 4 parallel):
  [dlr-extract-myshows]
  [dlr-extract-production]
  [dlr-extract-discover]
  [dlr-extract-playdetail]
```

---

## Section 2: Node Specifications

### Node: dlr-types-consolidate

- **Type**: refactor
- **Agent**: backend-architect
- **Depends on**: (none — root node)
- **Inputs**: `src/lib/types.ts` (179 lines, canonical type file); PRD FR-1 (list of types to move and types to leave)
- **Outputs**:
  - `src/lib/types.ts` — modified, 10 domain types added
  - `src/hooks/useFriendActivity.ts` — `FriendActivity` declaration removed, import added
  - `src/hooks/useDiscoveryQueue.ts` — `QueueItem` declaration removed, import added
  - `src/hooks/useVenueAudit.ts` — `AuditVenue` declaration removed, import added
  - `src/hooks/useCostDashboard.ts` — `CostDashboard`, `CostByModel`, `CostByFeature`, `DailyCost` declarations removed, imports added
  - `src/hooks/useVenuePromotion.ts` — `PromoteData` declaration removed, import added
  - `src/hooks/usePlayInterest.ts` — `TrendBucket` declaration removed, import added
  - `src/components/play/WaitingBlock.tsx` — `TrendBucket` declaration removed, import added (dedup)
  - `src/pages/PlayDetail.tsx` — `ProductionRow` declaration removed, import added (dedup)
  - `src/components/play/StagedProductionsBlock.tsx` — `ProductionRow` declaration removed, import added (dedup)
  - `src/lib/mapData.ts` — `MapData` declaration removed, import added
  - `src/components/MapTimePills.tsx` — `TimeFilter` declaration removed, import added
  - `src/data/changelog.ts` — `PatchNote` declaration removed, import added
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `npm run build` succeeds with zero errors
  - `TrendBucket` defined exactly once: `src/lib/types.ts`
  - `ProductionRow` defined exactly once: `src/lib/types.ts`
  - No domain type exported from hook files (only `Props` and hook result interfaces remain colocated)
- **Estimated effort**: Small (1 session)

---

### Node: dlr-join-types

- **Type**: refactor
- **Agent**: backend-architect
- **Depends on**: dlr-types-consolidate
- **Inputs**: PRD FR-2 (join type specifications); existing Supabase `.select()` join patterns in `src/lib/mapData.ts:28`, `src/hooks/useWatchlist.ts`, `src/hooks/useReviews.ts`, `src/pages/ProductionDetail.tsx`, `src/pages/Tonight.tsx`
- **Outputs**:
  - `src/lib/types.ts` — 5 new interfaces appended: `WatchlistWithEvent`, `WatchlistMapJoin`, `ReviewWithProfile`, `EventEmotionCount`, `EventSpectrumRow`
- **Loop pattern**: one-shot
- **Success criteria**:
  - `npm run build` succeeds
  - Each new interface matches the exact column shape of the corresponding `.select()` call
  - No consumers modified yet — types are purely additive
- **Estimated effort**: Trivial (< 30 min)

**Interfaces to add:**

```typescript
export interface WatchlistWithEvent extends WatchlistItem {
  event: Event & { venue: Venue }
}

export interface WatchlistMapJoin {
  event_id: string
  seen_date: string | null
  emotions: Emotion[] | null
  events: { venue_id: string } | null
}

export interface ReviewWithProfile extends Review {
  profile: Pick<Profile, 'id' | 'username' | 'house_rank'>
}

export interface EventEmotionCount {
  event_id: string
  emotion_slug: string
  pick_count: number
}

export interface EventSpectrumRow {
  event_id: string
  emotion: string
  pct: number
}
```

---

### Node: dlr-fix-as-any

- **Type**: refactor
- **Agent**: backend-architect
- **Depends on**: dlr-join-types
- **Inputs**: PRD FR-3 (cast locations and resolutions); `src/lib/mapData.ts`, `src/pages/MyShows.tsx`, `src/lib/offlineSync.ts`, `src/hooks/useOfflineWrite.ts`
- **Outputs**:
  - `src/lib/mapData.ts` — 3 `as any` casts replaced with `WatchlistMapJoin` typing on query result variable
  - `src/pages/MyShows.tsx` — 2 `as any` casts eliminated by refactoring `groupByMonth` to return `{ label: string; items: WatchlistItem[] }[]` without mutating items
  - `src/lib/offlineSync.ts` — `as any` documented with eslint-disable comment
  - `src/hooks/useOfflineWrite.ts` — `as any` documented with eslint-disable comment
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `npm run build` succeeds
  - `grep -rn 'as any' src/` returns at most 3 results: `offlineSync.ts`, `useOfflineWrite.ts`, `settingsStorage.test.ts`
  - `groupByMonth` returns `{ label: string; items: WatchlistItem[] }[]` — no `__monthLabel` mutation
- **Estimated effort**: Small (1 session)

**groupByMonth refactoring:**

```typescript
// BEFORE: mutates items with ad-hoc property
;(item as any).__monthLabel = label
// ...later...
label: (groupItems[0] as any).__monthLabel

// AFTER: store label alongside items in Map value
const map = new Map<string, { label: string; items: WatchlistItem[] }>()
for (const item of sorted) {
  const dateStr = item.seen_date ?? item.updated_at
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'))
  const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
  const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
  if (!map.has(key)) map.set(key, { label, items: [] })
  map.get(key)!.items.push(item)
}
return Array.from(map.values())
```

---

### Node: dlr-queries-ts

- **Type**: refactor
- **Agent**: backend-architect
- **Depends on**: dlr-join-types
- **Inputs**: PRD FR-4 (function list); all existing `.from()` call sites in `src/hooks/` and `src/lib/`; join types from dlr-join-types
- **Outputs**:
  - `src/lib/queries.ts` — new file, ~200 lines, containing 20+ typed async fetch functions
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `npm run build` succeeds
  - Every function has an explicit return type annotation
  - No function uses `as any`
  - File contains only read operations (no insert/update/delete/upsert)
  - Every `.select()` pattern currently in `src/hooks/` has a corresponding function
- **Estimated effort**: Medium (1–2 sessions)

**Required functions (minimum):**

```
fetchPlays, fetchPlayById, fetchEventsWithJoins, fetchEventById,
fetchEventsByPlayId, fetchVenuesWithCoords, fetchProfile, fetchUserProgress,
fetchWatchlist, fetchWatchlistForMap, fetchReviewsByEvent, fetchFriendships,
fetchEventEmotionCounts, fetchFriendActivity, fetchVenueCoverage,
fetchDiscoveryQueue, fetchVenueAudit, fetchCostDashboard, fetchPlaySpectrum,
fetchPlayInterest, fetchEmotionAggregates
```

---

### Node: dlr-querykeys-ts

- **Type**: refactor
- **Agent**: backend-architect
- **Depends on**: dlr-queries-ts
- **Inputs**: PRD FR-5 (key structure); existing query keys in `usePlays.ts`, `useEvents.ts`, `useLastScrape.ts`, `mapData.ts:51–53`, `MapView.tsx`, `Tonight.tsx`
- **Outputs**:
  - `src/lib/queryKeys.ts` — new file, ~50 lines, typed factory object
- **Loop pattern**: one-shot
- **Success criteria**:
  - `npm run build` succeeds
  - All existing `queryKey` string literals in the 3 existing TanStack Query hooks replaced with `queryKeys.*` references
- **Estimated effort**: Trivial (< 30 min)

---

### Node: dlr-update-existing-hooks

- **Type**: refactor
- **Agent**: frontend-developer
- **Depends on**: dlr-queries-ts, dlr-querykeys-ts
- **Inputs**: `src/hooks/usePlays.ts`, `src/hooks/useEvents.ts`, `src/hooks/useLastScrape.ts`
- **Outputs**:
  - `src/hooks/usePlays.ts` — inline fetch function replaced with import from `queries.ts`; query key from `queryKeys.ts`
  - `src/hooks/useEvents.ts` — same
  - `src/hooks/useLastScrape.ts` — same
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `npm run build` succeeds
  - No inline `supabase.from()` calls in these 3 files
  - Behavior identical — same data, same timing
- **Estimated effort**: Trivial (< 30 min)

---

### Node: dlr-update-mapdata

- **Type**: refactor
- **Agent**: backend-architect
- **Depends on**: dlr-queries-ts, dlr-fix-as-any
- **Inputs**: `src/lib/mapData.ts` (50 lines, 3 `.from()` calls)
- **Outputs**:
  - `src/lib/mapData.ts` — uses `fetchVenuesWithCoords()`, `fetchEventsWithJoins()`, `fetchWatchlistForMap()` from `queries.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `npm run build` succeeds
  - `mapData.ts` contains zero `supabase.from()` calls
  - `mapData.ts` contains zero `as any` casts
  - Map still loads venues and events correctly (manual verify)
- **Estimated effort**: Trivial (< 30 min)

---

### Node: dlr-migrate-batch1

- **Type**: refactor
- **Agent**: frontend-developer
- **Depends on**: dlr-queries-ts, dlr-querykeys-ts
- **Inputs**: `src/hooks/useVenueCoverage.ts` (32 lines), `src/hooks/usePlaySpectrum.ts` (58 lines), `src/hooks/useDiscoveryQueue.ts` (54 lines); PRD FR-6 Batch 1
- **Outputs**:
  - `src/hooks/useVenueCoverage.ts` — `useState`/`useEffect` replaced with `useQuery`
  - `src/hooks/usePlaySpectrum.ts` — replaced with `useQuery({ queryKey: queryKeys.plays_interest.spectrum(playId), queryFn, enabled: !!playId })`
  - `src/hooks/useDiscoveryQueue.ts` — `useQuery` for reads + `useMutation` for dismiss with `invalidateQueries`
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `npm run build` succeeds
  - No `useState` for data in these 3 hooks
  - All 3 use `useQuery` from `@tanstack/react-query`
  - `useDiscoveryQueue` dismiss uses `useMutation`
- **Estimated effort**: Small (1 session)

---

### Node: dlr-migrate-batch2

- **Type**: refactor
- **Agent**: frontend-developer
- **Depends on**: dlr-migrate-batch1
- **Inputs**: `src/hooks/useProfile.ts` (47 lines), `src/hooks/useEmotionAggregates.ts` (76 lines), `src/hooks/useFriendActivity.ts` (78 lines), `src/hooks/useCostDashboard.ts` (66 lines), `src/hooks/useVenueAudit.ts` (78 lines); PRD FR-6 Batch 2
- **Outputs**: 5 modified hooks using `useQuery` with `enabled: !!user`
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `npm run build` succeeds
  - No `useState`/`useEffect` for data fetching in these 5 hooks
  - All use `useQuery` with `enabled: !!user`
  - `useProfile` combines profile + progress into one query or two parallel queries
  - `useVenueAudit` keeps local `useState` for sort/filter state (not query state)
- **Estimated effort**: Small–Medium (1 session)

---

### Node: dlr-migrate-batch3

- **Type**: refactor
- **Agent**: frontend-developer
- **Depends on**: dlr-migrate-batch2
- **Inputs**: `src/hooks/useReviews.ts` (52 lines), `src/hooks/useFriendships.ts` (86 lines), `src/hooks/usePlayInterest.ts` (105 lines); PRD FR-6 Batch 3
- **Outputs**: 3 modified hooks using `useQuery` for reads + `useMutation` for writes
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `npm run build` succeeds
  - Reads use `useQuery`, writes use `useMutation`
  - `usePlayInterest` toggle is optimistically fast (no loading spinner between tap and UI update)
  - `useFriendships` send/accept/decline/remove all invalidate the friendships query
  - `useReviews` submit/delete/vote all invalidate the reviews query
- **Estimated effort**: Medium (1–2 sessions)

---

### Node: dlr-migrate-batch4

- **Type**: refactor
- **Agent**: frontend-developer
- **Depends on**: dlr-migrate-batch3
- **Inputs**: `src/hooks/useWatchlist.ts` (91 lines); PRD FR-6 Batch 4
- **Outputs**: Modified `useWatchlist.ts` using `useQuery` + `useMutation` with full optimistic update pattern
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `npm run build` succeeds
  - Add-to-watchlist updates the UI instantly (optimistic)
  - On error, previous state is restored
  - Switching tabs in MyShows shows fresh data without full reload (cache sharing)
  - Background refetch works (tab switch triggers stale-while-revalidate)
- **Estimated effort**: Medium (1 session — most complex hook)

**Optimistic update pattern:**

```typescript
const addMutation = useMutation({
  mutationFn: async ({ eventId, status }: { eventId: string; status: WatchlistStatus }) => {
    const { data } = await supabase
      .from('watchlist')
      .upsert({ user_id: user!.id, event_id: eventId, status, updated_at: new Date().toISOString() },
              { onConflict: 'user_id,event_id' })
      .select('*, event:events(*, venue:venues(*))')
      .maybeSingle()
    return data as WatchlistItem
  },
  onMutate: async ({ eventId, status }) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.watchlist.byUser(user!.id) })
    const previous = queryClient.getQueryData<WatchlistItem[]>(queryKeys.watchlist.byUser(user!.id))
    // optimistic update to cache...
    return { previous }
  },
  onError: (_err, _vars, context) => {
    queryClient.setQueryData(queryKeys.watchlist.byUser(user!.id), context?.previous)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.watchlist.byUser(user!.id) })
  },
})
```

---

### Node: dlr-update-page-queries

- **Type**: refactor
- **Agent**: frontend-developer
- **Depends on**: dlr-migrate-batch4
- **Inputs**: PRD FR-7 (page query inventory); `src/pages/MyShows.tsx:35`, `src/pages/ProductionDetail.tsx:27–35`, `src/pages/PlayDetail.tsx:35–264`, `src/pages/Discover.tsx:44`
- **Outputs**:
  - All inline `supabase.from()` calls in pages replaced with either:
    - Imports from `queries.ts` wrapped in local `useQuery`, or
    - Calls to hooks that will be created in Phase D (use temporary inline `useQuery` for now)
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `npm run build` succeeds
  - `grep -rn 'supabase\.from' src/pages/` returns zero results
  - Page behavior unchanged — same data, same timing
- **Estimated effort**: Small (1 session)

---

### Node: dlr-extract-myshows

- **Type**: refactor
- **Agent**: frontend-developer
- **Depends on**: dlr-update-page-queries
- **Inputs**: `src/pages/MyShows.tsx` (807 lines); PRD FR-8 MyShows extraction plan
- **Outputs**:
  - `src/pages/MyShows.tsx` — reduced to ~200 lines (orchestration only)
  - `src/components/myshows/MarqueeView.tsx` — ~230 lines
  - `src/components/myshows/PosterThumb.tsx` — ~65 lines
  - `src/components/myshows/BookingRow.tsx` — ~100 lines
  - `src/components/myshows/ShowRow.tsx` — ~110 lines
  - `src/components/myshows/EmptyState.tsx` — ~25 lines
  - `src/components/myshows/MonthDivider.tsx` — ~28 lines
  - `src/hooks/useMyShowsState.ts` — ~30 lines (tab, view, filter state)
  - `src/lib/groupByMonth.ts` — ~25 lines (pure utility function)
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `npm run build` succeeds
  - `wc -l src/pages/MyShows.tsx` <= 250
  - No sub-component imports `supabase` directly
  - All sub-components receive data through props or hooks
  - No visual regression (same UI output)
  - `groupByMonth` returns `{ label: string; items: WatchlistItem[] }[]`
- **Estimated effort**: Medium–Large (1–2 sessions)

---

### Node: dlr-extract-production

- **Type**: refactor
- **Agent**: frontend-developer
- **Depends on**: dlr-update-page-queries
- **Inputs**: `src/pages/ProductionDetail.tsx` (570 lines); PRD FR-8 ProductionDetail extraction plan
- **Outputs**:
  - `src/pages/ProductionDetail.tsx` — reduced to ~180 lines
  - `src/components/production/HeroImage.tsx` — ~45 lines
  - `src/components/production/TitleBlock.tsx` — ~70 lines
  - `src/components/production/CastSection.tsx` — ~85 lines
  - `src/components/production/HouseFelt.tsx` — ~45 lines
  - `src/components/production/ReviewsSection.tsx` — ~65 lines (includes ReviewRow, SpoilerReview)
  - `src/hooks/useProductionDetail.ts` — ~35 lines (TanStack Query hook)
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `npm run build` succeeds
  - `wc -l src/pages/ProductionDetail.tsx` <= 250
  - New hook uses `useQuery`
  - No sub-component imports `supabase` directly
  - No visual regression
- **Estimated effort**: Medium (1 session)

---

### Node: dlr-extract-discover

- **Type**: refactor
- **Agent**: frontend-developer
- **Depends on**: dlr-update-page-queries
- **Inputs**: `src/pages/Discover.tsx` (303 lines); PRD FR-8 Discover extraction plan
- **Outputs**:
  - `src/pages/Discover.tsx` — reduced to ~120 lines
  - `src/components/discover/SearchBar.tsx` — ~40 lines
  - `src/components/discover/FilterChips.tsx` — ~45 lines
  - `src/components/discover/PlaySearchResults.tsx` — ~70 lines
  - `src/hooks/useDiscoverFilters.ts` — ~40 lines (search, type/venue filters, emotion matching)
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `npm run build` succeeds
  - `wc -l src/pages/Discover.tsx` <= 150
  - Search + filter state centralized in hook
  - No sub-component imports `supabase` directly
  - No visual regression
- **Estimated effort**: Small (1 session)

---

### Node: dlr-extract-playdetail

- **Type**: refactor
- **Agent**: frontend-developer
- **Depends on**: dlr-update-page-queries
- **Inputs**: `src/pages/PlayDetail.tsx` (296 lines); existing `src/components/play/` directory (5 components); PRD FR-8 PlayDetail extraction plan
- **Outputs**:
  - `src/pages/PlayDetail.tsx` — reduced to ~120 lines
  - `src/components/play/FriendSection.tsx` — ~70 lines (extracted from inline component at lines 223–295)
  - `src/hooks/usePlayDetail.ts` — ~30 lines (TanStack Query hook, replaces inline data fetching at lines 31–68)
  - `src/hooks/usePlayFriends.ts` — ~40 lines (TanStack Query hook)
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `npm run build` succeeds
  - `wc -l src/pages/PlayDetail.tsx` <= 150
  - No inline `supabase.from()` calls in `PlayDetail.tsx`
  - No visual regression
- **Estimated effort**: Small (1 session)

---

## Section 3: Loop Specifications

### Standard Refactoring Loop

Used by all nodes with `loop pattern: plan-execute-verify`.

- **Trigger**: all depends-on nodes marked complete
- **Inner cycle**:
  1. **Discover**: Read the target files. Read the PRD functional requirement for this node. Read the refactoring plan at `docs/refactoring/data-layer-refactor.md` for additional context. Identify every edit needed: which declarations move, which imports change, which types change shape.
  2. **Plan**: Write a short plan: what changes, in what order. For type moves: add to destination first, then update imports, then delete original. For hook migrations: create the useQuery version, verify it compiles, then replace the old implementation.
  3. **Execute**: Make the edits following the plan.
  4. **Verify (gate 1 — compile)**: Run `npm run build`. If TypeScript errors: read errors, fix, re-run. Max 3 fix cycles.
  5. **Verify (gate 2 — tests)**: Run `npm run test`. If test failures: read failing tests, determine if refactor broke behavior (fix the code) or test needs updating for structural changes (fix the test). Max 2 cycles.
  6. **Verify (gate 3 — structural)**: Run the node-specific grep/wc checks from success criteria. If any fail, go back to step 3.
- **Evaluator**: all 3 verify gates pass without manual intervention
- **Retry**: on any gate failure → read error output → identify specific issue → fix → re-verify (max 3 full cycles through all gates)
- **Stop condition**: all gates green, node marked complete

### One-Shot Loop

Used by `dlr-join-types` and `dlr-querykeys-ts`.

- **Trigger**: depends-on nodes complete
- **Inner cycle**:
  1. Execute the change
  2. Run `npm run build`
  3. If pass, mark complete
- **Retry**: on compile failure → fix → rebuild (max 2 cycles)

### Loop: dlr-types-consolidate

- **Trigger**: (root node — no dependencies)
- **Inner cycle**:
  1. Discover: read `src/lib/types.ts` current contents; read all source files listed in Outputs; catalog each type's declaration and all import sites
  2. Plan: for each type, plan: add to `types.ts` → update all import statements across consumers → remove original declaration. Handle deduplication of `TrendBucket` and `ProductionRow` first.
  3. Execute: add all 10 types to `types.ts`; update imports in all 13 consumer files; remove original declarations
  4. Verify: `npm run build` succeeds; `grep -rn 'export type TrendBucket\|export interface TrendBucket' src/` returns exactly 1 result in `types.ts`; same for `ProductionRow`
- **Evaluator**: build passes, no duplicate type definitions, all imports resolve
- **Retry**: on import error → trace the broken import → fix path → rebuild (max 3 cycles)
- **Stop condition**: build green, zero duplicate domain types

### Loop: dlr-fix-as-any

- **Trigger**: dlr-join-types complete
- **Inner cycle**:
  1. Discover: read `mapData.ts` lines 28–42; read `MyShows.tsx` `groupByMonth` function; read `offlineSync.ts:18` and `useOfflineWrite.ts:11`
  2. Plan: for `mapData.ts` — type the query result variable as `WatchlistMapJoin[]`, remove 3 casts. For `MyShows.tsx` — rewrite `groupByMonth` with `Map<string, { label, items }>` pattern. For offline files — add eslint-disable comments.
  3. Execute: make the 4 file changes
  4. Verify: `npm run build` succeeds; `grep -rn 'as any' src/ | grep -v test | grep -v eslint-disable` returns 0 results
- **Evaluator**: build passes, cast count matches expectation
- **Retry**: on type mismatch → inspect the Supabase return shape → adjust interface → rebuild (max 3 cycles)
- **Stop condition**: zero undocumented `as any` casts

### Loop: dlr-queries-ts

- **Trigger**: dlr-join-types complete
- **Inner cycle**:
  1. Discover: catalog every `.from()` read call in `src/hooks/` and `src/lib/` — record table, select columns, filters, ordering
  2. Plan: group by table; write one function per unique query shape; use join types for complex selects
  3. Execute: create `src/lib/queries.ts` with all functions
  4. Verify: `npm run build` succeeds; every function has return type annotation; no `as any` in the file; only read operations (no `.insert`/`.update`/`.delete`/`.upsert`)
- **Evaluator**: build passes, function signatures are typed, no mutations
- **Retry**: on type error → match return type to actual Supabase response shape → rebuild (max 3 cycles)
- **Stop condition**: build green, all read patterns covered

### Loop: dlr-migrate-batch1

- **Trigger**: dlr-queries-ts and dlr-querykeys-ts complete
- **Inner cycle**:
  1. Discover: read each hook's current implementation; identify state variables, effect dependencies, return shape
  2. Plan: map each `useState`/`useEffect` to `useQuery` equivalent; preserve the hook's return API shape for zero consumer changes
  3. Execute: rewrite all 3 hooks; import from `queries.ts` and `queryKeys.ts`
  4. Verify: `npm run build`; `grep -rn 'useState\|useEffect' src/hooks/useVenueCoverage.ts src/hooks/usePlaySpectrum.ts src/hooks/useDiscoveryQueue.ts` returns zero data-state hits (may have local UI state)
- **Evaluator**: build passes, no manual state management for data
- **Retry**: on consumer type error → adjust hook return shape to match previous API → rebuild (max 3 cycles)
- **Stop condition**: all 3 hooks migrated, build green

### Loop: dlr-migrate-batch2

- **Trigger**: dlr-migrate-batch1 complete
- **Inner cycle**:
  1. Discover: read each hook; note auth dependency (all use `user?.id`)
  2. Plan: add `enabled: !!user` to each `useQuery`; for `useProfile` decide whether to combine profile+progress into one query or use parallel queries
  3. Execute: rewrite all 5 hooks
  4. Verify: `npm run build`; manual check that unauthenticated state doesn't trigger queries (no network requests before login)
- **Evaluator**: build passes, no queries fire without auth
- **Retry**: on `enabled` misconfiguration → fix condition → rebuild (max 3 cycles)
- **Stop condition**: all 5 hooks migrated, build green

### Loop: dlr-migrate-batch3

- **Trigger**: dlr-migrate-batch2 complete
- **Inner cycle**:
  1. Discover: read each hook; catalog read functions and write functions separately; identify what queries to invalidate after each mutation
  2. Plan: `useQuery` for reads, `useMutation` for each write operation; `onSettled: () => queryClient.invalidateQueries({ queryKey })` on every mutation; optimistic update for `usePlayInterest` toggle
  3. Execute: rewrite all 3 hooks
  4. Verify: `npm run build`; test each mutation path manually — submit review, toggle interest, send friend request — confirm data refreshes after mutation
- **Evaluator**: build passes, mutations trigger cache invalidation
- **Retry**: on stale-data after mutation → check invalidation key matches query key → fix → re-verify (max 3 cycles)
- **Stop condition**: all 3 hooks migrated with working mutations

### Loop: dlr-migrate-batch4

- **Trigger**: dlr-migrate-batch3 complete
- **Inner cycle**:
  1. Discover: read `useWatchlist.ts`; catalog all mutation operations (add, update status, remove); identify cache key structure
  2. Plan: implement full `onMutate`/`onError`/`onSettled` pattern; save previous state in `onMutate`, optimistically update cache, rollback on error
  3. Execute: rewrite `useWatchlist.ts`
  4. Verify: `npm run build`; test: add to watchlist → UI updates instantly → navigate to MyShows → item appears; simulate error (disable network) → add item → verify rollback
- **Evaluator**: build passes, optimistic updates work, error rollback works
- **Retry**: on cache-shape mismatch → inspect `queryClient.getQueryData` return → adjust cache update logic → re-verify (max 3 cycles)
- **Stop condition**: watchlist mutations are optimistically fast with correct rollback

### Loop: dlr-update-page-queries

- **Trigger**: dlr-migrate-batch4 complete
- **Inner cycle**:
  1. Discover: `grep -rn 'supabase\.from' src/pages/` — list every inline query
  2. Plan: for each query, determine whether it maps to an existing hook or needs a new `useQuery` call with `queries.ts` function
  3. Execute: replace all inline queries
  4. Verify: `npm run build`; `grep -rn 'supabase\.from' src/pages/` returns 0 results; pages load correctly
- **Evaluator**: build passes, zero `.from()` in pages
- **Retry**: on missing query function → add to `queries.ts` → rebuild (max 3 cycles)
- **Stop condition**: pages are query-free

### Loop: dlr-extract-myshows

- **Trigger**: dlr-update-page-queries complete
- **Inner cycle**:
  1. Discover: read `MyShows.tsx`; identify component boundaries (MarqueeView lines 198–429, PosterThumb 431–497, BookingRow 499–599, ShowRow 659–770, EmptyState 601–627, MonthDivider 629–657, groupByMonth 784–807); identify shared state (tab, view mode, filter)
  2. Plan: create `src/components/myshows/` directory; define Props interface for each sub-component; create `useMyShowsState` hook for shared state; move `groupByMonth` to `src/lib/`
  3. Execute: create all 8 files; reduce `MyShows.tsx` to orchestration
  4. Verify: `npm run build`; `wc -l src/pages/MyShows.tsx` <= 250; `grep -rn "import.*supabase" src/components/myshows/` returns 0; manual visual comparison
- **Evaluator**: build passes, line count under limit, no direct supabase imports in sub-components
- **Retry**: on prop-type mismatch → adjust Props interface → rebuild (max 3 cycles)
- **Stop condition**: MyShows under 250 lines, all sub-components render correctly

### Loop: dlr-extract-production

- **Trigger**: dlr-update-page-queries complete
- **Inner cycle**:
  1. Discover: read `ProductionDetail.tsx`; identify sections (hero, title block, cast, spectrum/HouseFelt, reviews with ReviewRow+SpoilerReview); identify inline data fetching (lines 22–52)
  2. Plan: create `src/components/production/` directory; extract data fetching to `useProductionDetail` hook; define Props for each sub-component
  3. Execute: create all 6 files; reduce `ProductionDetail.tsx` to orchestration
  4. Verify: `npm run build`; `wc -l src/pages/ProductionDetail.tsx` <= 250; manual visual comparison
- **Evaluator**: build passes, line count under limit
- **Retry**: on missing prop → add to interface → rebuild (max 3 cycles)
- **Stop condition**: ProductionDetail under 250 lines, all sections render

### Loop: dlr-extract-discover

- **Trigger**: dlr-update-page-queries complete
- **Inner cycle**:
  1. Discover: read `Discover.tsx`; identify search bar, filter chips, results rendering, emotion matching effect (lines 29–51)
  2. Plan: create `src/components/discover/` directory; extract filter/search state to `useDiscoverFilters` hook
  3. Execute: create all 4 files; reduce `Discover.tsx` to orchestration
  4. Verify: `npm run build`; `wc -l src/pages/Discover.tsx` <= 150; search and filter work correctly
- **Evaluator**: build passes, line count under limit
- **Retry**: on state management issue → verify hook returns all needed state → fix → rebuild (max 3 cycles)
- **Stop condition**: Discover under 150 lines, search/filter functional

### Loop: dlr-extract-playdetail

- **Trigger**: dlr-update-page-queries complete
- **Inner cycle**:
  1. Discover: read `PlayDetail.tsx`; identify `FriendSection` inline component (lines 223–295); identify inline data fetching (lines 31–68)
  2. Plan: extract `FriendSection` to `src/components/play/FriendSection.tsx`; create `usePlayDetail` and `usePlayFriends` hooks
  3. Execute: create 3 files; reduce `PlayDetail.tsx`
  4. Verify: `npm run build`; `wc -l src/pages/PlayDetail.tsx` <= 150; friend section renders correctly
- **Evaluator**: build passes, line count under limit
- **Retry**: on hook dependency issue → verify auth context available → fix → rebuild (max 3 cycles)
- **Stop condition**: PlayDetail under 150 lines, all sections render

---

## Section 4: Shared State Schema

| Key | Type | Set by | Consumed by |
|-----|------|--------|-------------|
| `queryKeys` | `Record<string, (...args) => readonly string[]>` | dlr-querykeys-ts | All TanStack Query hooks (migration batches 1–4), page query elimination, component extraction hooks |
| `queries.ts` functions | `async (...args) => Promise<T>` | dlr-queries-ts | All hooks as `queryFn`; `mapData.ts` directly |
| Join result types | TypeScript interfaces | dlr-join-types | dlr-fix-as-any (`WatchlistMapJoin`), dlr-queries-ts (return types), dlr-migrate-batch* (hook type annotations) |
| `QueryClient` instance | TanStack `QueryClient` | Already exists in `src/App.tsx` | All `useMutation` `onSettled` calls (`invalidateQueries`), batch4 `onMutate` (`setQueryData`) |

---

## Section 5: Build Phases

Nodes within a phase can run in parallel (fan out via Claude Code subagents). All nodes in a phase must pass verification before advancing to the next phase.

### Phase A: Types Foundation

Run sequentially — each node builds on the previous.

- [ ] dlr-types-consolidate
- [ ] dlr-join-types
- [ ] dlr-fix-as-any

After this phase: zero duplicate domain types, zero undocumented `as any` casts, all join result types defined.

### Phase B: Query Layer

Run sequentially, except B1/B2 (existing hooks + mapdata) which are parallel after querykeys.

- [ ] dlr-queries-ts
- [ ] dlr-querykeys-ts

**Parallel after dlr-querykeys-ts:**

- [ ] dlr-update-existing-hooks
- [ ] dlr-update-mapdata

After this phase: all Supabase reads centralized in `queries.ts`, all query keys in `queryKeys.ts`, existing TanStack Query hooks and mapData updated.

### Phase C: TanStack Migration

Run sequentially — each batch is a learning ramp. Patterns established in simpler hooks are reused in complex ones.

- [ ] dlr-migrate-batch1
- [ ] dlr-migrate-batch2
- [ ] dlr-migrate-batch3
- [ ] dlr-migrate-batch4
- [ ] dlr-update-page-queries

After this phase: zero manual `useState`/`useEffect` for data fetching, zero inline `supabase.from()` in pages, full TanStack Query caching and dedup active.

### Phase D: Component Decomposition

All 4 nodes are parallel — they touch different page files and create different component directories.

- [ ] dlr-extract-myshows
- [ ] dlr-extract-production
- [ ] dlr-extract-discover
- [ ] dlr-extract-playdetail

After this phase: no page component exceeds 250 lines, all sub-components receive data through props or hooks, no sub-component imports `supabase` directly.

---

## Appendix: File Index

All files created or modified by this feature, organized by layer.

### New Files

| File | Node | Purpose |
|------|------|---------|
| `src/lib/queries.ts` | dlr-queries-ts | Centralized Supabase fetch functions |
| `src/lib/queryKeys.ts` | dlr-querykeys-ts | TanStack Query key registry |
| `src/lib/groupByMonth.ts` | dlr-extract-myshows | Pure utility function |
| `src/hooks/useMyShowsState.ts` | dlr-extract-myshows | Tab, view, filter state hook |
| `src/hooks/useProductionDetail.ts` | dlr-extract-production | TanStack Query data hook |
| `src/hooks/useDiscoverFilters.ts` | dlr-extract-discover | Search/filter state hook |
| `src/hooks/usePlayDetail.ts` | dlr-extract-playdetail | TanStack Query data hook |
| `src/hooks/usePlayFriends.ts` | dlr-extract-playdetail | TanStack Query data hook |
| `src/components/myshows/MarqueeView.tsx` | dlr-extract-myshows | Card layout |
| `src/components/myshows/PosterThumb.tsx` | dlr-extract-myshows | Thumbnail component |
| `src/components/myshows/BookingRow.tsx` | dlr-extract-myshows | Booking list item |
| `src/components/myshows/ShowRow.tsx` | dlr-extract-myshows | Show list item |
| `src/components/myshows/EmptyState.tsx` | dlr-extract-myshows | Empty state display |
| `src/components/myshows/MonthDivider.tsx` | dlr-extract-myshows | Month separator |
| `src/components/production/HeroImage.tsx` | dlr-extract-production | Hero image section |
| `src/components/production/TitleBlock.tsx` | dlr-extract-production | Title + credits |
| `src/components/production/CastSection.tsx` | dlr-extract-production | Cast listing |
| `src/components/production/HouseFelt.tsx` | dlr-extract-production | Spectrum panel |
| `src/components/production/ReviewsSection.tsx` | dlr-extract-production | Reviews + spoiler handling |
| `src/components/discover/SearchBar.tsx` | dlr-extract-discover | Search input |
| `src/components/discover/FilterChips.tsx` | dlr-extract-discover | Filter chip row |
| `src/components/discover/PlaySearchResults.tsx` | dlr-extract-discover | Play result list |
| `src/components/play/FriendSection.tsx` | dlr-extract-playdetail | Friend activity section |

### Modified Files

| File | Nodes | Changes |
|------|-------|---------|
| `src/lib/types.ts` | dlr-types-consolidate, dlr-join-types | 10 domain types + 5 join types added |
| `src/lib/mapData.ts` | dlr-types-consolidate, dlr-fix-as-any, dlr-update-mapdata | Type import, cast removal, query centralization |
| `src/lib/offlineSync.ts` | dlr-fix-as-any | eslint-disable comment |
| `src/hooks/useOfflineWrite.ts` | dlr-fix-as-any | eslint-disable comment |
| `src/hooks/usePlays.ts` | dlr-update-existing-hooks | Use queries.ts + queryKeys.ts |
| `src/hooks/useEvents.ts` | dlr-update-existing-hooks | Use queries.ts + queryKeys.ts |
| `src/hooks/useLastScrape.ts` | dlr-update-existing-hooks | Use queries.ts + queryKeys.ts |
| `src/hooks/useVenueCoverage.ts` | dlr-migrate-batch1 | TanStack Query migration |
| `src/hooks/usePlaySpectrum.ts` | dlr-migrate-batch1 | TanStack Query migration |
| `src/hooks/useDiscoveryQueue.ts` | dlr-migrate-batch1 | TanStack Query migration |
| `src/hooks/useProfile.ts` | dlr-migrate-batch2 | TanStack Query migration |
| `src/hooks/useEmotionAggregates.ts` | dlr-migrate-batch2 | TanStack Query migration |
| `src/hooks/useFriendActivity.ts` | dlr-migrate-batch2 | TanStack Query migration |
| `src/hooks/useCostDashboard.ts` | dlr-migrate-batch2 | TanStack Query migration |
| `src/hooks/useVenueAudit.ts` | dlr-migrate-batch2 | TanStack Query migration |
| `src/hooks/useReviews.ts` | dlr-migrate-batch3 | TanStack Query migration |
| `src/hooks/useFriendships.ts` | dlr-migrate-batch3 | TanStack Query migration |
| `src/hooks/usePlayInterest.ts` | dlr-migrate-batch3 | TanStack Query migration |
| `src/hooks/useWatchlist.ts` | dlr-migrate-batch4 | TanStack Query migration + optimistic updates |
| `src/pages/MyShows.tsx` | dlr-fix-as-any, dlr-update-page-queries, dlr-extract-myshows | Cast fix, query elimination, decomposition |
| `src/pages/ProductionDetail.tsx` | dlr-update-page-queries, dlr-extract-production | Query elimination, decomposition |
| `src/pages/Discover.tsx` | dlr-update-page-queries, dlr-extract-discover | Query elimination, decomposition |
| `src/pages/PlayDetail.tsx` | dlr-types-consolidate, dlr-update-page-queries, dlr-extract-playdetail | ProductionRow dedup, query elimination, decomposition |
| `src/components/play/WaitingBlock.tsx` | dlr-types-consolidate | TrendBucket import change |
| `src/components/play/StagedProductionsBlock.tsx` | dlr-types-consolidate | ProductionRow import change |
| `src/components/MapTimePills.tsx` | dlr-types-consolidate | TimeFilter import change |
| `src/data/changelog.ts` | dlr-types-consolidate | PatchNote import change |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-15 | Zephyr + Sashiko | Initial draft from refactoring plan |
