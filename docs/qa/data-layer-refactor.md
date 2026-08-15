# QA: Data Layer Refactoring

**Date:** 2026-08-15
**Scope:** `src/hooks/`, `src/lib/`, `src/pages/`, `src/components/`
**Entry:** `/app` (Tonight page)
**Graph:** `docs/graphs/data-layer-refactor.md`

---

## Phase A: Types Foundation

### Type Consolidation (dlr-types-consolidate)
- [ ] `TrendBucket` defined exactly once in `src/lib/types.ts`
- [ ] `ProductionRow` defined exactly once in `src/lib/types.ts`
- [ ] `FriendActivity` importable from `src/lib/types.ts`
- [ ] `QueueItem` importable from `src/lib/types.ts`
- [ ] `AuditVenue` importable from `src/lib/types.ts`
- [ ] `CostDashboard`, `CostByModel`, `CostByFeature`, `DailyCost` importable from `src/lib/types.ts`
- [ ] `MapData` importable from `src/lib/types.ts`
- [ ] `TimeFilter` importable from `src/lib/types.ts`
- [ ] `PatchNote` importable from `src/lib/types.ts`
- [ ] No domain type exported from hook files (only `Props` and hook result interfaces remain)
- [ ] `npm run build` succeeds with zero errors

### Join Result Types (dlr-join-types)
- [ ] `WatchlistWithEvent` interface exists in `src/lib/types.ts`
- [ ] `WatchlistMapJoin` interface exists in `src/lib/types.ts`
- [ ] `ReviewWithProfile` interface exists in `src/lib/types.ts`
- [ ] `EventEmotionCount` interface exists in `src/lib/types.ts`
- [ ] `EventSpectrumRow` interface exists in `src/lib/types.ts`
- [ ] `npm run build` succeeds

### Fix `as any` (dlr-fix-as-any)
- [ ] `grep -rn 'as any' src/ | grep -v node_modules | grep -v test` returns at most 2 results (offlineSync.ts, useOfflineWrite.ts)
- [ ] `mapData.ts` contains zero `as any` casts
- [ ] `MyShows.tsx` contains zero `as any` casts
- [ ] `offlineSync.ts` cast has eslint-disable comment explaining why
- [ ] `useOfflineWrite.ts` cast has eslint-disable comment explaining why
- [ ] `groupByMonth` returns `{ label: string; items: WatchlistItem[] }[]` without mutating items
- [ ] `npm run build` succeeds

---

## Phase B: Query Layer

### Centralized Queries (dlr-queries-ts)
- [ ] `src/lib/queries.ts` exists
- [ ] Every function has an explicit return type annotation
- [ ] File contains zero `as any` casts
- [ ] File contains only read operations (no `.insert`, `.update`, `.delete`, `.upsert`)
- [ ] Functions exist for: plays, events, venues, profiles, user_progress, watchlist, reviews, friendships, emotion counts, spectrum, friend activity, venue coverage, discovery queue, venue audit, cost dashboard, play interest, emotion aggregates
- [ ] `npm run build` succeeds

### Query Keys (dlr-querykeys-ts)
- [ ] `src/lib/queryKeys.ts` exists
- [ ] All entity types have key factories (plays, events, watchlist, profile, reviews, friendships, emotions, tonight, venues, costs, plays_interest)
- [ ] No string literal query keys remain in existing TanStack Query hooks
- [ ] `npm run build` succeeds

### Existing Hook Updates (dlr-update-existing-hooks)
- [ ] `usePlays.ts` imports `queryFn` from `queries.ts`
- [ ] `useEvents.ts` imports `queryFn` from `queries.ts`
- [ ] `useLastScrape.ts` imports `queryFn` from `queries.ts`
- [ ] No inline `supabase.from()` in these 3 files
- [ ] `npm run build` succeeds

### MapData Update (dlr-update-mapdata)
- [ ] `mapData.ts` contains zero `supabase.from()` calls
- [ ] `mapData.ts` imports from `queries.ts`
- [ ] `mapData.ts` contains zero `as any` casts
- [ ] `npm run build` succeeds

---

## Phase C: TanStack Migration

### Batch 1 — Simple Read-Only (dlr-migrate-batch1)
- [ ] `useVenueCoverage` uses `useQuery`, no `useState` for data
- [ ] `usePlaySpectrum` uses `useQuery` with `enabled: !!playId`
- [ ] `useDiscoveryQueue` uses `useQuery` for reads + `useMutation` for dismiss
- [ ] All 3 hooks import from `@tanstack/react-query`
- [ ] `npm run build` succeeds

### Batch 2 — Auth-Dependent (dlr-migrate-batch2)
- [ ] `useProfile` uses `useQuery` with `enabled: !!user`
- [ ] `useEmotionAggregates` uses `useQuery` with `enabled: !!user`
- [ ] `useFriendActivity` uses `useQuery` with `enabled: !!user`
- [ ] `useCostDashboard` uses `useQuery` with `enabled: !!user`
- [ ] `useVenueAudit` uses `useQuery` for data; `useState` only for sort/filter controls
- [ ] No queries fire when user is not authenticated
- [ ] `npm run build` succeeds

### Batch 3 — Read + Write (dlr-migrate-batch3)
- [ ] `useReviews` reads with `useQuery`, writes with `useMutation`
- [ ] `useFriendships` reads with `useQuery`, writes with `useMutation` for send/accept/decline/remove
- [ ] `usePlayInterest` reads with `useQuery`, toggle uses `useMutation` with optimistic update
- [ ] Each mutation calls `queryClient.invalidateQueries` on success
- [ ] `npm run build` succeeds

### Batch 4 — Optimistic Updates (dlr-migrate-batch4)
- [ ] `useWatchlist` reads with `useQuery`, writes with `useMutation`
- [ ] Add-to-watchlist uses `onMutate` for optimistic cache update
- [ ] Error triggers `onError` rollback to previous state
- [ ] `onSettled` calls `invalidateQueries` for eventual consistency
- [ ] `npm run build` succeeds

### Page Query Elimination (dlr-update-page-queries)
- [ ] `grep -rn 'supabase\.from' src/pages/` returns zero results
- [ ] `MyShows.tsx` has no inline Supabase query
- [ ] `ProductionDetail.tsx` has no inline Supabase query
- [ ] `PlayDetail.tsx` has no inline Supabase query
- [ ] `Discover.tsx` has no inline Supabase query
- [ ] `npm run build` succeeds

---

## Phase D: Component Decomposition

### MyShows Extraction (dlr-extract-myshows)
- [ ] `wc -l src/pages/MyShows.tsx` <= 250
- [ ] `src/components/myshows/MarqueeView.tsx` exists
- [ ] `src/components/myshows/PosterThumb.tsx` exists
- [ ] `src/components/myshows/BookingRow.tsx` exists
- [ ] `src/components/myshows/ShowRow.tsx` exists
- [ ] `src/components/myshows/EmptyState.tsx` exists
- [ ] `src/components/myshows/MonthDivider.tsx` exists
- [ ] `src/hooks/useMyShowsState.ts` exists
- [ ] `src/lib/groupByMonth.ts` exists
- [ ] No file in `src/components/myshows/` imports `supabase` directly
- [ ] `npm run build` succeeds

### ProductionDetail Extraction (dlr-extract-production)
- [ ] `wc -l src/pages/ProductionDetail.tsx` <= 250
- [ ] `src/components/production/HeroImage.tsx` exists
- [ ] `src/components/production/TitleBlock.tsx` exists
- [ ] `src/components/production/CastSection.tsx` exists
- [ ] `src/components/production/HouseFelt.tsx` exists
- [ ] `src/components/production/ReviewsSection.tsx` exists
- [ ] `src/hooks/useProductionDetail.ts` exists and uses `useQuery`
- [ ] No file in `src/components/production/` imports `supabase` directly
- [ ] `npm run build` succeeds

### Discover Extraction (dlr-extract-discover)
- [ ] `wc -l src/pages/Discover.tsx` <= 150
- [ ] `src/components/discover/SearchBar.tsx` exists
- [ ] `src/components/discover/FilterChips.tsx` exists
- [ ] `src/components/discover/PlaySearchResults.tsx` exists
- [ ] `src/hooks/useDiscoverFilters.ts` exists
- [ ] No file in `src/components/discover/` imports `supabase` directly
- [ ] `npm run build` succeeds

### PlayDetail Extraction (dlr-extract-playdetail)
- [ ] `wc -l src/pages/PlayDetail.tsx` <= 150
- [ ] `src/components/play/FriendSection.tsx` exists
- [ ] `src/hooks/usePlayDetail.ts` exists and uses `useQuery`
- [ ] `src/hooks/usePlayFriends.ts` exists and uses `useQuery`
- [ ] No inline `supabase.from()` in `PlayDetail.tsx`
- [ ] `npm run build` succeeds

---

## Feature Regression Checklist

All existing user-facing behavior must still work after each phase merge. Test on iPhone PWA.

### Tonight Page
- [ ] Page loads at `/app` with hero card and marquee ticker
- [ ] Marquee ticker scrolls with live counts
- [ ] Hero production shows spectrum bar and emotion breakdown
- [ ] "Want to see" button adds to watchlist
- [ ] Price button shows correct price
- [ ] "Your people went out" section shows friend activity
- [ ] "Free tonight" section renders (or falls back to cheapest)

### Map Page
- [ ] Map renders with venue markers at correct positions
- [ ] Time filter pills work (Today / This Week / This Month)
- [ ] Filter chips work (tonight, under $20, storefront, never)
- [ ] Tapping a marker opens venue sheet
- [ ] Venue sheet shows peek and detail states
- [ ] Swipe-to-dismiss works on venue sheet

### Discover Page
- [ ] Search field finds plays by title
- [ ] Emotion/feeling search returns results from `event_spectrum`
- [ ] Filter chips work (Tonight, Under $20, Storefront, ASL)
- [ ] Play search results navigate to PlayDetail

### My Shows Page
- [ ] Three tabs (Want to See, Booked, Seen) with correct counts
- [ ] Tab switching filters correctly
- [ ] Month dividers group shows by month (Seen tab)
- [ ] Emotion dots appear in pick order
- [ ] Pull-to-refresh works
- [ ] Empty states show correct copy per tab
- [ ] USHERED badge appears when applicable
- [ ] Marquee view toggle works (if applicable)

### Show Detail (ProductionDetail)
- [ ] Hero image renders at 196px
- [ ] Title, credit line, run line display correctly
- [ ] Access chips render in green
- [ ] "I'm going" and "Want to see" buttons work
- [ ] House Felt panel shows spectrum bar with interpretation
- [ ] Reviews section loads with rank badges
- [ ] Spoiler reviews collapse correctly
- [ ] Play link appears when `play_id` exists

### Play Detail
- [ ] Play information renders (title, playwright, synopsis)
- [ ] Waiting count and trend bars display
- [ ] "I'm waiting" toggle works
- [ ] Staged productions list displays
- [ ] Friend section shows friends interested/who have seen

### Log a Show
- [ ] Emotion wheel allows 1–3 picks
- [ ] 4th pick rejected with shake
- [ ] Room volume selector works (optional)
- [ ] Logging writes emotions, status, seen_date to watchlist
- [ ] Emotion aggregate triggers fire

### Write a Review
- [ ] Prompt chips work, swapping doesn't clear text
- [ ] Spoiler toggle works
- [ ] "Just log it" skips review
- [ ] "Post to the house" creates review

### Profile (You)
- [ ] Rank row shows correct house rank
- [ ] Seating chart lights correct seat
- [ ] Stat strip shows correct counts
- [ ] Palette bar renders with insight sentence

### Cross-Cutting
- [ ] Network tab: no duplicate requests for same data (TanStack Query dedup) <!-- qa:human network-inspector -->
- [ ] Tab switch triggers stale-while-revalidate (not full reload)
- [ ] Add to watchlist on one page, navigate to another, data is updated (cache sharing)
- [ ] Offline: app shell loads, offline indicator appears
- [ ] Console: no runtime errors or unhandled promise rejections
- [ ] Mentor chat sends messages and receives responses

---

## Automated Verification Commands

Run after every phase merge:

```bash
# Build gate
npm run build

# Test gate
npm run test

# Structural checks (run after all phases complete)
grep -rn 'as any' src/ | grep -v node_modules | grep -v test | grep -v eslint-disable | wc -l   # Expected: 0
grep -rn 'supabase\.from' src/pages/ | wc -l                                                     # Expected: 0
wc -l src/pages/MyShows.tsx src/pages/ProductionDetail.tsx src/pages/Discover.tsx src/pages/PlayDetail.tsx  # All <= 250
grep -rn "import.*from.*supabase" src/components/myshows/ src/components/production/ src/components/discover/ 2>/dev/null | wc -l  # Expected: 0
```

---

## Regression Risks

- **High:** TanStack Query cache invalidation misalignment — mutations that don't properly invalidate their dependent queries will show stale data. Test every mutation path.
- **Medium:** Optimistic update rollback — if the `onMutate`/`onError` pattern has a cache shape mismatch, the rollback will fail silently and leave the cache in an inconsistent state. Test with network errors.
- **Medium:** Hook return shape changes — if a migrated hook returns `{ data, isLoading }` instead of the previous `{ items, loading }`, consumers will break. Preserve the hook's public API during migration.
- **Low:** Component extraction introduces prop-drilling — mitigated by sub-components using hooks instead of deep prop chains.
