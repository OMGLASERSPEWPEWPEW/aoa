# PRD: Data Layer Refactoring

**Feature:** Data Layer Refactoring
**Date:** 2026-08-15
**Size:** Large (3–5 sessions, 25+ files)
**Status:** Draft
**ADR:** `docs/adr/0005-data-layer-refactor.md`

---

## 1. Executive Summary

The frontend data layer has grown organically through Phases 0–3, producing two coexisting data-fetching patterns (manual useState/useEffect vs TanStack Query), 40+ scattered Supabase query chains, 7 `as any` casts, 62+ scattered type declarations, and 3 god components exceeding 300 lines. This refactoring standardizes the data layer before Phase 4 (Content + Social) adds more surface area: consolidate types, centralize Supabase queries, migrate all hooks to TanStack Query, and decompose god components into focused sub-components.

## 2. User Stories

**US-1:** As a developer, I want one data-fetching pattern so I don't have to decide between useState/useEffect and useQuery when writing a new hook.

**US-2:** As a developer, I want Supabase queries centralized in one file so a column rename is a one-file edit instead of a 16-file hunt.

**US-3:** As a developer, I want typed Supabase join results so the compiler catches shape mismatches instead of `as any` hiding them.

**US-4:** As a developer, I want domain types in one file so I can find and update them without grep.

**US-5:** As a developer, I want page components under 250 lines so UI changes don't require understanding the entire data flow.

**US-6:** As a user, I want data to stay fresh when I switch tabs (stale-while-revalidate) and optimistic updates when I add to my watchlist, so the app feels instant.

## 3. Functional Requirements

### FR-1: Type Consolidation

**Trigger:** Build phase starts.

**Behavior:** Move 10 domain types from individual hook/component files into `src/lib/types.ts`:
- `FriendActivity` from `src/hooks/useFriendActivity.ts`
- `QueueItem` from `src/hooks/useDiscoveryQueue.ts`
- `AuditVenue` from `src/hooks/useVenueAudit.ts`
- `CostDashboard`, `CostByModel`, `CostByFeature`, `DailyCost` from `src/hooks/useCostDashboard.ts`
- `PromoteData` from `src/hooks/useVenuePromotion.ts`
- `TrendBucket` from `src/hooks/usePlayInterest.ts` (deduplicate with `src/components/play/WaitingBlock.tsx`)
- `MapData` from `src/lib/mapData.ts`
- `TimeFilter` from `src/components/MapTimePills.tsx`
- `PatchNote` from `src/data/changelog.ts`

Deduplicate `ProductionRow` (defined in both `src/pages/PlayDetail.tsx` and `src/components/play/StagedProductionsBlock.tsx`).

**Do NOT move:** Component `Props` interfaces (colocated by convention), module-internal types (`DiagnosticsConfig`, `CallModelOptions`, `PendingWrite`, `Setting`), context value types (`AuthContextType`, `ThemeContextValue`), hook result interfaces (`UsePlayInterestResult`).

**Error State:** N/A — compile-time only.

**Scope Boundary:** Only domain entity types move. Utility types, context types, and component Props stay colocated.

### FR-2: Supabase Join Result Types

**Trigger:** FR-1 complete.

**Behavior:** Add 5 typed interfaces to `src/lib/types.ts` that match the exact column shapes of existing `.select()` join queries:

| Interface | Matches Query Pattern | Used By |
|-----------|----------------------|---------|
| `WatchlistWithEvent` | `watchlist → events(*, venue:venues(*))` | `useWatchlist`, `MyShows` |
| `WatchlistMapJoin` | `watchlist(event_id, seen_date, emotions) → events(venue_id)` | `mapData.ts` |
| `ReviewWithProfile` | `reviews → profiles(id, username, house_rank)` | `useReviews`, `ProductionDetail` |
| `EventEmotionCount` | `event_emotion_counts(event_id, emotion_slug, pick_count)` | `Tonight`, `ProductionDetail` |
| `EventSpectrumRow` | `event_spectrum(event_id, emotion, pct)` | `ProductionDetail`, `Discover` |

**Error State:** N/A.

**Scope Boundary:** Only read-result types. Mutation payloads are not typed here.

### FR-3: Eliminate `as any` Casts

**Trigger:** FR-2 complete.

**Behavior:** Replace or document all 7 `as any` casts:

| Location | Action |
|----------|--------|
| `src/lib/mapData.ts:32,35,39` (3 casts) | Replace with `WatchlistMapJoin` typing on the query result |
| `src/pages/MyShows.tsx:800,804` (2 casts) | Refactor `groupByMonth` to return `{ label: string; items: WatchlistItem[] }[]` — no item mutation |
| `src/lib/offlineSync.ts:18` | Document with eslint-disable comment — inherently untyped generic offline queue |
| `src/hooks/useOfflineWrite.ts:11` | Document with eslint-disable comment — same reason |

**Error State:** N/A.

**Data:** `groupByMonth` refactored to use a `Map<string, { label: string; items: WatchlistItem[] }>` instead of mutating items with ad-hoc `__monthLabel` property.

**Scope Boundary:** The 2 offline-queue casts are documented, not eliminated. A generic write queue cannot know table schemas at compile time.

### FR-4: Centralized Query Functions

**Trigger:** FR-2 complete.

**Behavior:** Create `src/lib/queries.ts` containing typed async fetch functions for every Supabase read operation. Each function:
- Imports `supabase` from `./supabase`
- Has an explicit return type annotation using types from `./types`
- Returns `data ?? []` (for arrays) or `data ?? null` (for singles)
- Contains zero `as any` casts

Required functions (minimum):
`fetchPlays`, `fetchPlayById`, `fetchEventsWithJoins`, `fetchEventById`, `fetchEventsByPlayId`, `fetchVenuesWithCoords`, `fetchProfile`, `fetchUserProgress`, `fetchWatchlist`, `fetchWatchlistForMap`, `fetchReviewsByEvent`, `fetchFriendships`, `fetchEventEmotionCounts`, `fetchFriendActivity`, `fetchVenueCoverage`, `fetchDiscoveryQueue`, `fetchVenueAudit`, `fetchCostDashboard`, `fetchPlaySpectrum`, `fetchPlayInterest`, `fetchEmotionAggregates`

**Error State:** Query errors propagate through TanStack Query's error state (Phase C). `queries.ts` does not catch errors.

**Data:** Zero `.from()` calls remain in `src/hooks/` or `src/pages/` after Phase C. All read operations route through `queries.ts`.

**Scope Boundary:** Mutation functions (insert, update, delete, upsert) stay in hooks as `useMutation` callbacks. Only read operations centralize. RPC calls can go in `queries.ts` as separate functions.

### FR-5: Query Key Registry

**Trigger:** FR-4 complete.

**Behavior:** Create `src/lib/queryKeys.ts` with a typed factory object:

```typescript
export const queryKeys = {
  plays: {
    all: ['plays'] as const,
    detail: (id: string) => ['plays', id] as const,
  },
  events: {
    all: ['events'] as const,
    detail: (id: string) => ['events', id] as const,
    byPlay: (playId: string) => ['events', 'play', playId] as const,
  },
  watchlist: {
    byUser: (userId: string) => ['watchlist', userId] as const,
    forMap: (userId: string, scrapeTs: string | null) => ['map-data', userId, scrapeTs] as const,
  },
  // ... all entities
} as const
```

All `useQuery` and `invalidateQueries` calls reference `queryKeys.*` — no string literal query keys.

**Error State:** N/A.

**Scope Boundary:** Key structure matches the entity hierarchy. No deep nesting beyond 2 levels.

### FR-6: TanStack Query Migration — 13 Hooks

**Trigger:** FR-4 and FR-5 complete.

**Behavior:** Migrate 13 hooks from manual `useState`/`useEffect` to `useQuery`/`useMutation`:

**Batch 1 — Simple read-only (no auth):**
- `useVenueCoverage` (32 lines)
- `usePlaySpectrum` (58 lines)
- `useDiscoveryQueue` (54 lines — also gets `useMutation` for dismiss)

**Batch 2 — Auth-dependent read-only:**
- `useProfile` (47 lines) — `enabled: !!user`
- `useEmotionAggregates` (76 lines) — `enabled: !!user`
- `useFriendActivity` (78 lines) — `enabled: !!user`
- `useCostDashboard` (66 lines) — `enabled: !!user`
- `useVenueAudit` (78 lines) — local `useState` for sort/filter state stays

**Batch 3 — Read + write (useMutation):**
- `useReviews` (52 lines) — `useMutation` for submit/delete/vote, `invalidateQueries` on success
- `useFriendships` (86 lines) — `useMutation` for send/accept/decline/remove
- `usePlayInterest` (105 lines) — optimistic update on toggle

**Batch 4 — Complex optimistic updates:**
- `useWatchlist` (91 lines) — `useMutation` with `onMutate` (optimistic cache update), `onError` (rollback), `onSettled` (invalidate)

Each migrated hook:
- Imports `queryFn` from `queries.ts`
- Imports `queryKey` from `queryKeys.ts`
- Returns `{ data, isLoading, error }` (or destructured equivalents matching current API)
- Has zero `useState` for data state (local UI state like filters is fine)
- Has zero `useEffect` for data fetching

**Error State:** TanStack Query handles retry (default 3 attempts), error state, and loading state automatically.

**Data:** After migration, switching browser tabs triggers stale-while-revalidate. Multiple components using the same query key share cached data.

**Scope Boundary:** These hooks are NOT migrated (stay as-is): `useMap` (Mapbox GL setup), `useHouseCheck` (no data fetching), `useOfflineWrite` (imperative offline queue), `usePullToRefresh` (gesture handler).

### FR-7: Page-Level Query Elimination

**Trigger:** FR-6 Batch 4 complete.

**Behavior:** Remove all inline `supabase.from()` calls from page components:

| Page | Inline Query | Resolution |
|------|-------------|------------|
| `src/pages/MyShows.tsx:35` | `play_interest` count | Move to hook or `queries.ts` |
| `src/pages/ProductionDetail.tsx:27-35` | events + spectrum | Extract to `useProductionDetail` hook |
| `src/pages/PlayDetail.tsx:35-264` | plays, events, watchlist, friendships, interest | Extract to `usePlayDetail` + `usePlayFriends` hooks |
| `src/pages/Discover.tsx:44` | `event_spectrum` | Extract to `useDiscoverFilters` hook |

**Error State:** N/A.

**Data:** `grep -rn 'supabase\.from' src/pages/` returns zero results after this step.

**Scope Boundary:** Pages may still import `supabase` for auth or other non-query operations.

### FR-8: God Component Decomposition

**Trigger:** FR-7 complete.

**Behavior:**

**MyShows.tsx (807 → ~200 lines):**
Extract to `src/components/myshows/`: `MarqueeView` (~230 lines), `PosterThumb` (~65), `BookingRow` (~100), `ShowRow` (~110), `EmptyState` (~25), `MonthDivider` (~28).
Extract `useMyShowsState` hook (~30 lines — tab, view, filter state).
Extract `groupByMonth` to `src/lib/groupByMonth.ts` (~25 lines — pure utility).

**ProductionDetail.tsx (570 → ~180 lines):**
Extract to `src/components/production/`: `HeroImage` (~45), `TitleBlock` (~70), `CastSection` (~85), `HouseFelt` (~45), `ReviewsSection` (~65, includes ReviewRow + SpoilerReview).
Extract `useProductionDetail` hook (~35 lines).

**Discover.tsx (303 → ~120 lines):**
Extract to `src/components/discover/`: `SearchBar` (~40), `FilterChips` (~45), `PlaySearchResults` (~70).
Extract `useDiscoverFilters` hook (~40 lines).

**PlayDetail.tsx (296 → ~120 lines):**
Extract `FriendSection` to `src/components/play/FriendSection.tsx` (~70 lines).
Extract `usePlayDetail` (~30 lines) and `usePlayFriends` (~40 lines) hooks.

**Error State:** N/A.

**Data:** No sub-component imports `supabase` directly. All data flows through props or hooks.

**Scope Boundary:** Only the 4 pages listed above are decomposed. Other pages (Tonight, Settings, MentorChat, etc.) are not in scope.

## 4. Non-Functional Requirements

**NFR-1:** `npm run build` must succeed with zero TypeScript errors after each phase.

**NFR-2:** All existing tests must pass after each phase (`npm run test`).

**NFR-3:** Zero visual regression — same UI output, same behavior, same data.

**NFR-4:** Bundle size must not increase by more than 5KB (TanStack Query is already in the bundle).

**NFR-5:** No new runtime dependencies added (TanStack Query is already installed).

## 5. Technical Considerations

### Prior Art

| Pattern | File | Lines | Reuse |
|---------|------|-------|-------|
| TanStack Query hook | `src/hooks/usePlays.ts` | 1–20 | Canonical pattern for simple read hooks |
| TanStack Query hook with auth | `src/pages/Tonight.tsx` | 13–55 | Pattern for auth-dependent queries |
| Query key in MapView | `src/components/MapView.tsx` | 51–53 | Existing key pattern to standardize |
| Component extraction | `src/components/play/` | 5 files | Existing pattern for extracted sub-components |

### Dependency Order

Types → Join Types → (Query Functions + Fix Casts) → Query Keys → Update Existing Hooks → Migrate Batches 1→2→3→4 → Page Queries → Component Decomposition

See graph engineering doc at `docs/graphs/data-layer-refactor.md` for full DAG.

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TanStack Query cache invalidation bugs | Medium | High | Test each mutation's invalidation manually |
| Optimistic updates show wrong data briefly | Medium | Medium | `onMutate`/`onError` rollback pattern; test with slow network |
| Breaking queries when centralizing | Low | High | Phase B adds `queries.ts` without changing hook behavior |
| Component extraction introduces prop drilling | Low | Low | Sub-components use hooks, not cascading props |
| Type consolidation creates circular imports | Low | Medium | `types.ts` has zero runtime imports |

## 7. Success Metrics

- Zero `as any` casts except 2 documented offline-queue exceptions
- Zero `useState`/`useEffect` for data fetching in hooks (4 utility hooks excluded)
- Zero inline `supabase.from()` calls in page components
- No page component exceeds 250 lines
- All domain types importable from `src/lib/types.ts`
- Cache sharing works: watchlist update on one page is reflected on another without reload
