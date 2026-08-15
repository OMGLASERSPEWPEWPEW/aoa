# Data Layer Refactoring Plan

**Status**: Planning (not yet started)
**Created**: 2026-08-14
**Scope**: 5 linked refactoring items across `src/hooks/`, `src/pages/`, `src/lib/`
**Risk level**: Medium -- touches data fetching across the entire app
**Estimated effort**: 3-5 focused sessions

---

## Motivation

The app has grown organically through Phases 0-3. Every hook was written to solve an immediate need, and that was the right call at the time -- ship first, refine later. But the patterns have diverged enough that maintenance cost is climbing:

1. **15 of 21 hooks** use the manual `useState`/`useEffect`/`setLoading` pattern. 5 hooks and 1 page already use TanStack Query (`useQuery`). Two paradigms coexist, meaning every new hook requires a decision and every reader needs to understand both.

2. **3 page components** exceed 300 lines (one exceeds 800) because they bundle fetching, filtering, state management, and rendering in a single file. Changing the UI requires understanding the data flow; changing the data flow risks breaking the UI.

3. **Identical Supabase query chains** are scattered across 16+ files with subtle differences in `.select()` columns, `.order()` direction, and `.eq()` filters. A schema change (e.g., renaming a column) requires a find-and-replace across the entire codebase.

4. **7 `as any` casts** paper over missing types for Supabase join results. These suppress compiler warnings but also suppress real bugs.

5. **62+ type/interface declarations** live outside the canonical `src/lib/types.ts`. Some are duplicated (e.g., `TrendBucket` in both `usePlayInterest.ts` and `WaitingBlock.tsx`). Refactoring a domain type requires hunting across files.

### What this unlocks

- **Faster feature development**: New hooks follow one pattern (TanStack Query), data functions live in one file (`queries.ts`), types live in one file (`types.ts`).
- **Safer schema evolution**: Change a Supabase query in one place, get type errors everywhere it's consumed.
- **Better UX**: TanStack Query provides stale-while-revalidate, background refetch, and deduplication out of the box -- features we're manually approximating in some hooks and ignoring in others.
- **Smaller bundle from god components**: Code-splitting becomes possible when sub-components are extracted.

---

## Current State Inventory

### Item 1: Data Fetching Pattern (useEffect/useState sprawl)

**21 hook files** in `src/hooks/`. Of these:

| Pattern | Hook Files | Count |
|---------|-----------|-------|
| Manual useEffect/useState | useProfile, useWatchlist, useReviews, useFriendships, useFriendActivity, useEmotionAggregates, usePlayInterest, usePlaySpectrum, useCostDashboard, useVenueAudit, useVenueCoverage, useDiscoveryQueue, useMap (partial) | 13 |
| TanStack useQuery | usePlays, useEvents, useLastScrape | 3 |
| No data fetching (utility) | useHouseCheck, useOfflineWrite, usePullToRefresh | 3 |
| Mixed (useQuery + useEffect) | useMap | 1 |

**Pages with inline data fetching** (should be hooks but aren't):

| Page | Lines | Inline Supabase Calls |
|------|-------|-----------------------|
| `src/pages/MyShows.tsx` | 807 | 1 (play_interest count, line 35) |
| `src/pages/ProductionDetail.tsx` | 570 | 2 (events+spectrum, lines 27-35) |
| `src/pages/PlayDetail.tsx` | 296 | 3 (plays+events, line 35; watchlist, line 49; friendships+interest in FriendSection, lines 233-264) |
| `src/pages/Discover.tsx` | 303 | 1 (event_spectrum, line 44) |
| `src/pages/Tonight.tsx` | 118 | Already uses useQuery -- good pattern, inline `fetchTonightData` function |

**The canonical pattern** (already proven in `usePlays.ts`, `useEvents.ts`, `useLastScrape.ts`, `MapView.tsx`, `Tonight.tsx`):

```typescript
// src/hooks/usePlays.ts -- 20 lines, zero manual state management
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Play } from '../lib/types'

async function fetchPlays(): Promise<Play[]> {
  const { data } = await supabase
    .from('plays')
    .select('*')
    .order('title', { ascending: true })
  return (data as Play[]) ?? []
}

export function usePlays() {
  const { data, isLoading } = useQuery({
    queryKey: ['plays'],
    queryFn: fetchPlays,
  })
  return { plays: data ?? [], loading: isLoading }
}
```

Compare to the manual pattern (e.g., `useProfile.ts` -- 47 lines, 4 useState calls, try/catch, manual setLoading):

```typescript
// Manual pattern -- verbose, no caching, no stale-while-revalidate
const [profile, setProfile] = useState<Profile | null>(null)
const [progress, setProgress] = useState<UserProgress | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

const fetchData = useCallback(async () => {
  if (!user) { setLoading(false); return }
  try {
    // ... fetch logic ...
    setProfile(...)
    setProgress(...)
  } catch (e) {
    setError(...)
  }
  setLoading(false)
}, [user])

useEffect(() => { fetchData() }, [fetchData])
```

### Item 2: God Components

| Component | Lines | Responsibilities |
|-----------|-------|-----------------|
| `src/pages/MyShows.tsx` | 807 | Tab state, filter state, view toggle (marquee/ledger), inline play_interest query, 7 sub-components (MarqueeView, PosterThumb, BookingRow, EmptyState, MonthDivider, ShowRow, groupByMonth) all defined in same file |
| `src/pages/ProductionDetail.tsx` | 570 | Inline data fetching (events + spectrum), hero image, title block, cast section, spectrum panel, reviews section, play link, 2 sub-components (ReviewRow, SpoilerReview) |
| `src/pages/Discover.tsx` | 303 | Search state, emotion matching, type filter, venue type filter, inline Supabase emotion query, play search results, event list rendering |

**Extraction candidates**:

MyShows.tsx (807 lines):
- `MarqueeView` (lines 198-429) -- 231 lines, self-contained card layout
- `PosterThumb` (lines 431-497) -- 66 lines, reusable thumbnail component
- `BookingRow` (lines 499-599) -- 100 lines, booking list item
- `ShowRow` (lines 659-770) -- 111 lines, show list item
- `EmptyState` (lines 601-627) -- 26 lines
- `MonthDivider` (lines 629-657) -- 28 lines
- `groupByMonth` (lines 784-807) -- pure function, move to `src/lib/`
- Filter/tab state -- extract to custom hook `useMyShowsState`

ProductionDetail.tsx (570 lines):
- `ReviewRow` (lines 492-543) -- 51 lines
- `SpoilerReview` (lines 545-570) -- 25 lines
- Inline data fetching (lines 22-52) -- extract to `useProductionDetail` hook
- Hero section, title block, cast section, spectrum panel -- each a sub-component

Discover.tsx (303 lines):
- Search + filter state (lines 23-28) -- extract to `useDiscoverFilters` hook
- Emotion matching effect (lines 29-51) -- part of the filter hook
- Play results rendering (lines 191-262) -- extract to `PlaySearchResults` component

### Item 3: Supabase Query Builders

**Repeated query patterns** across the codebase:

| Query Pattern | Files Using It | Differences |
|---------------|---------------|-------------|
| `events` with venue+play join | `useEvents.ts:8`, `Tonight.tsx:15`, `ProductionDetail.tsx:28`, `PlayDetail.tsx:37`, `Discover.tsx:44` (via useEvents), `MapView.tsx` (via mapData) | Column selection varies, some include play join, some don't |
| `watchlist` with event+venue join | `useWatchlist.ts:14-17`, `mapData.ts:27-30`, `PlayDetail.tsx:50-54` | Filter columns vary (user_id, status, event_id) |
| `friendships` filtered by user | `useFriendships.ts:16-18`, `useFriendActivity.ts:24-28`, `PlayDetail.tsx:233-236` | Same `.or()` pattern repeated 3 times |
| `profiles` by ID | `useProfile.ts:21`, `useFriendships.ts:27`, `AuthContext.tsx:48` | Column selection varies |
| `reviews` with profile join | `useReviews.ts:13-16` | Only one usage currently, but the join pattern is fragile |
| `venues` full select | `useVenueAudit.ts:33`, `mapData.ts:15`, `useVenuePromotion.ts:55-73` | Different column sets |
| `play_interest` by user+play | `usePlayInterest.ts:44-49,83-95`, `MyShows.tsx:35-38`, `PlayDetail.tsx:260-264` | Same table, different operations |

**40+ total `.from()` calls** across hooks, pages, lib, and contexts. Many share the same table+join but with subtle column differences that should be unified.

### Item 4: Type Safety Gaps (`as any` casts)

| File | Line | Cast | Root Cause |
|------|------|------|------------|
| `src/lib/mapData.ts` | 32 | `(w as any).events?.venue_id` | Supabase join result `watchlist -> events(venue_id)` not typed |
| `src/lib/mapData.ts` | 35 | `(w as any).seen_date` | Same watchlist join, `seen_date` untyped |
| `src/lib/mapData.ts` | 39 | `(w as any).emotions` | Same watchlist join, `emotions` untyped |
| `src/lib/offlineSync.ts` | 18 | `item.payload as any` | `PendingWrite.payload` is `Record<string, unknown>`, Supabase `.upsert()` expects table-specific type |
| `src/hooks/useOfflineWrite.ts` | 11 | `payload as any` | Same issue -- generic payload vs. typed Supabase insert |
| `src/pages/MyShows.tsx` | 800 | `(item as any).__monthLabel = label` | Mutating WatchlistItem with ad-hoc property |
| `src/pages/MyShows.tsx` | 804 | `(groupItems[0] as any).__monthLabel` | Reading the ad-hoc property back |

**Additional type-safety concerns** (not `as any` but still problematic):

- `ProductionDetail.tsx:39,42-43` -- `specRes.data` fields accessed as `(r: any)` in `.map()` callback
- `Tonight.tsx:43,46` -- Same pattern with `event_emotion_counts` data
- `useFriendActivity.ts:51` -- `(item: any)` in `.map()` callback for complex join result
- Multiple hooks cast Supabase `.data` with `as Type[]` without validating the shape

### Item 5: Scattered Type Declarations

**`src/lib/types.ts`** -- 179 lines, 14 exported type/interface declarations. This is the intended single source of truth.

**62+ additional declarations** spread across:

**Domain types that belong in `types.ts`** (exported, used across files):

| Type | Current Location | Used By |
|------|-----------------|---------|
| `FriendActivity` | `useFriendActivity.ts:6` | `TonightFriends` component |
| `QueueItem` | `useDiscoveryQueue.ts:4` | `useVenuePromotion.ts`, `DiscoveryQueueSection`, `VenuePromoteModal` |
| `AuditVenue` | `useVenueAudit.ts:4` | `VenueAuditTable` component |
| `CostDashboard`, `CostByModel`, `CostByFeature`, `DailyCost` | `useCostDashboard.ts:5-30` | Admin dashboard page |
| `PromoteData` | `useVenuePromotion.ts:13` | `VenuePromoteModal` |
| `UsePlayInterestResult`, `TrendBucket` | `usePlayInterest.ts:5,10` | `PlayDetail`, `WaitingBlock` |
| `UsePlaySpectrumResult` | `usePlaySpectrum.ts:5` | `PlayDetail` |
| `MapData` | `mapData.ts:5` | `MapView` |
| `TimeFilter` | `MapTimePills.tsx:1` | `MapView` |
| `ThemeMode` | `ThemeContext.tsx:4` | Settings, ThemeProvider |
| `PatchNote` | `data/changelog.ts:1` | Changelog component |
| `ProductionRow` | `PlayDetail.tsx:14`, `StagedProductionsBlock.tsx:3` | **Duplicated** -- defined in two files |
| `TrendBucket` | `usePlayInterest.ts:5`, `WaitingBlock.tsx:1` | **Duplicated** -- defined in two files |
| `MonthGroup` | `MyShows.tsx:779` | Internal to MyShows |
| `Message` | `MentorChat.tsx:8` | Internal to MentorChat |
| `LocationState` | `WriteReview.tsx:13` | Internal to WriteReview |

**Types that are fine where they are** (component Props interfaces, internal-only types):

- `interface Props` in component files (30+ instances) -- these are colocated by convention and should stay
- `DiagnosticsConfig`, `DiagLevel`, `DiagCategory`, `DiagEntry` in `diagnostics.ts` -- domain-specific to that module
- `CallModelOptions`, `CallModelResult` in `gateway.ts` -- internal to gateway module
- `PendingWrite`, `Setting` in `offlineDb.ts` -- internal to Dexie schema

**Types re-exported through `types.ts`** (already correct):
- `Emotion`, `RoomVolume`, `SpectrumSlice` from `emotions.ts`
- `HouseRank` from `house.ts`

---

## Dependency Graph Between Items

```
Item 5 (Consolidate types) ──┐
                              ├──> Item 4 (Fix as any casts)
Item 3 (Centralize queries) ──┤
                              └──> Item 1 (Migrate to TanStack Query)
                                          │
                                          └──> Item 2 (Break up god components)
```

**Explanation**:

- **Item 5 before Item 4**: You need the correct types defined before you can replace `as any` with proper interfaces.
- **Item 3 before Item 1**: Centralized query functions become the `queryFn` callbacks for TanStack Query hooks. Build the functions first, then wrap them.
- **Item 3 before Item 4**: When queries are centralized, you type them once with proper Supabase join types, which eliminates the `as any` at the call sites.
- **Item 1 before Item 2**: God components need their inline data fetching extracted into hooks first. Those hooks should be TanStack Query hooks, not more useState/useEffect sprawl.

---

## Phased Execution Plan

### Phase A: Types Foundation (Items 5 + 4)

**Branch**: `refactor/types-consolidation`

**Step A1: Consolidate domain types into `types.ts`**

Move the following exported types/interfaces into `src/lib/types.ts`:

```
FROM src/hooks/useFriendActivity.ts    -> FriendActivity
FROM src/hooks/useDiscoveryQueue.ts    -> QueueItem
FROM src/hooks/useVenueAudit.ts        -> AuditVenue
FROM src/hooks/useCostDashboard.ts     -> CostDashboard, CostByModel, CostByFeature, DailyCost
FROM src/hooks/useVenuePromotion.ts    -> PromoteData
FROM src/hooks/usePlayInterest.ts      -> TrendBucket (deduplicate with WaitingBlock.tsx)
FROM src/lib/mapData.ts                -> MapData
FROM src/components/MapTimePills.tsx    -> TimeFilter
FROM src/data/changelog.ts             -> PatchNote
```

**Do NOT move**:
- Component `Props` interfaces (stay colocated)
- Module-internal types (diagnostics, gateway, offlineDb, models, emotions, house)
- Context types (AuthContextType, ThemeContextValue, ScrapeContextType) -- these are tightly coupled to their providers
- Hook result interfaces (UsePlayInterestResult, etc.) -- these stay with their hooks since they describe the hook's API, not a domain entity

**Deduplication**:
- `TrendBucket` is defined in both `usePlayInterest.ts:5` and `WaitingBlock.tsx:1`. Move to `types.ts`, import from both.
- `ProductionRow` is defined in both `PlayDetail.tsx:14` and `StagedProductionsBlock.tsx:3`. Move to `types.ts`, import from both.
- `type View = 'marquee' | 'ledger'` in `MyShows.tsx:13` -- leave inline, it's component-local state.

**Step A2: Create Supabase join result types**

Add to `src/lib/types.ts`:

```typescript
/** Watchlist row with nested event + venue joins (from .select('*, event:events(*, venue:venues(*))')) */
export interface WatchlistWithEvent extends WatchlistItem {
  event: Event & { venue: Venue }
}

/** Watchlist row with partial join for map data (from .select('event_id, seen_date, emotions, events(venue_id)')) */
export interface WatchlistMapJoin {
  event_id: string
  seen_date: string | null
  emotions: Emotion[] | null
  events: { venue_id: string } | null
}

/** Review row with author profile join */
export interface ReviewWithProfile extends Review {
  profile: Pick<Profile, 'id' | 'username' | 'house_rank'>
}

/** Event emotion count row from the event_emotion_counts view */
export interface EventEmotionCount {
  event_id: string
  emotion_slug: string
  pick_count: number
}

/** Event spectrum row from the event_spectrum view */
export interface EventSpectrumRow {
  event_id: string
  emotion: string
  pct: number
}
```

**Step A3: Replace `as any` casts**

| File | Line | Current | Replacement |
|------|------|---------|-------------|
| `mapData.ts:32` | `(w as any).events?.venue_id` | `(w as WatchlistMapJoin).events?.venue_id` -- or better, type the query result directly |
| `mapData.ts:35` | `(w as any).seen_date` | Remove cast, `w` is now typed as `WatchlistMapJoin` |
| `mapData.ts:39` | `(w as any).emotions` | Remove cast, `w` is now typed as `WatchlistMapJoin` |
| `offlineSync.ts:18` | `item.payload as any` | Keep as `as Record<string, unknown>` -- this is inherently untyped (generic offline queue). Add a `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment explaining why. |
| `useOfflineWrite.ts:11` | `payload as any` | Same -- document with comment |
| `MyShows.tsx:800` | `(item as any).__monthLabel = label` | Refactor `groupByMonth` to return `{ label, items }[]` without mutating the items. The label is already available from the date computation -- store it in the Map key instead. |
| `MyShows.tsx:804` | `(groupItems[0] as any).__monthLabel` | Eliminated by the refactor above |

**Specifically for MyShows.tsx `groupByMonth`**, replace:

```typescript
// BEFORE: mutates items with ad-hoc property
;(item as any).__monthLabel = label
// ...
label: (groupItems[0] as any).__monthLabel,
```

```typescript
// AFTER: store label alongside items, no mutation
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

**Verification criteria for Phase A**:
- [ ] `npm run build` succeeds with zero TypeScript errors
- [ ] No `as any` casts remain except the 2 documented offline-queue exceptions
- [ ] `grep -rn 'as any' src/` returns at most 2 results (offlineSync.ts, useOfflineWrite.ts)
- [ ] All domain types imported from `src/lib/types.ts` -- no cross-hook type imports
- [ ] No duplicate type definitions (TrendBucket, ProductionRow)

### Phase B: Query Layer (Item 3)

**Branch**: `refactor/centralize-queries`

**Create `src/lib/queries.ts`** -- typed fetch functions for every Supabase table access. These become the `queryFn` for TanStack Query in Phase C.

```typescript
// src/lib/queries.ts
import { supabase } from './supabase'
import type {
  Play, Event, Venue, Profile, UserProgress,
  WatchlistItem, Review, Friendship,
  WatchlistMapJoin, ReviewWithProfile, EventEmotionCount,
  QueueItem, AuditVenue,
} from './types'

// ─── Plays ──────────────────────────────────────────────
export async function fetchPlays(): Promise<Play[]> {
  const { data } = await supabase
    .from('plays')
    .select('*')
    .order('title', { ascending: true })
  return (data ?? []) as Play[]
}

export async function fetchPlayById(playId: string): Promise<Play | null> {
  const { data } = await supabase
    .from('plays')
    .select('*')
    .eq('id', playId)
    .single()
  return (data as Play) ?? null
}

// ─── Events ─────────────────────────────────────────────
export async function fetchEventsWithJoins(): Promise<Event[]> {
  const { data } = await supabase
    .from('events')
    .select('*, venue:venues(*), play:plays(*)')
    .order('start_date', { ascending: true })
  return (data ?? []) as Event[]
}

export async function fetchEventById(eventId: string): Promise<Event | null> {
  const { data } = await supabase
    .from('events')
    .select('*, venue:venues(*), play:plays(*)')
    .eq('id', eventId)
    .single()
  return (data as Event) ?? null
}

export async function fetchEventsByPlayId(playId: string): Promise<Event[]> {
  const { data } = await supabase
    .from('events')
    .select('*, venue:venues(*)')
    .eq('play_id', playId)
    .order('start_date', { ascending: false })
  return (data ?? []) as Event[]
}

// ─── Venues ─────────────────────────────────────────────
export async function fetchVenuesWithCoords(): Promise<Venue[]> {
  const { data } = await supabase
    .from('venues')
    .select('*')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
  return (data ?? []) as Venue[]
}

// ─── Profiles ───────────────────────────────────────────
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  return (data as Profile) ?? null
}

export async function fetchUserProgress(userId: string): Promise<UserProgress | null> {
  const { data } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as UserProgress) ?? null
}

// ─── Watchlist ──────────────────────────────────────────
export async function fetchWatchlist(userId: string): Promise<WatchlistItem[]> {
  const { data } = await supabase
    .from('watchlist')
    .select('*, event:events(*, venue:venues(*))')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  return (data ?? []) as WatchlistItem[]
}

export async function fetchWatchlistForMap(userId: string): Promise<WatchlistMapJoin[]> {
  const { data } = await supabase
    .from('watchlist')
    .select('event_id, seen_date, emotions, events(venue_id)')
    .eq('user_id', userId)
    .eq('status', 'seen')
  return (data ?? []) as WatchlistMapJoin[]
}

// ─── Reviews ────────────────────────────────────────────
export async function fetchReviewsByEvent(eventId: string): Promise<ReviewWithProfile[]> {
  const { data } = await supabase
    .from('reviews')
    .select('*, profile:profiles(id, username, house_rank)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  return (data ?? []) as ReviewWithProfile[]
}

// ─── Friendships ────────────────────────────────────────
export async function fetchFriendships(userId: string) {
  const { data } = await supabase
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  return (data ?? []) as Friendship[]
}

// ─── Emotion Counts ─────────────────────────────────────
export async function fetchEventEmotionCounts(eventId: string): Promise<EventEmotionCount[]> {
  const { data } = await supabase
    .from('event_emotion_counts')
    .select('*')
    .eq('event_id', eventId)
  return (data ?? []) as EventEmotionCount[]
}

// ... additional query functions as needed
```

**Migration strategy**:
1. Create `src/lib/queries.ts` with all fetch functions
2. Update existing TanStack Query hooks (`usePlays`, `useEvents`, `useLastScrape`) to import from `queries.ts` instead of defining inline fetch functions
3. Update `mapData.ts` to use `fetchVenuesWithCoords()`, `fetchEventsWithJoins()`, `fetchWatchlistForMap()`
4. Do NOT change the useState/useEffect hooks yet -- that's Phase C

**What stays out of `queries.ts`**:
- Mutation functions (insert, update, delete, upsert) -- these will move into TanStack `useMutation` in Phase C
- RPC calls (`supabase.rpc(...)`) -- these can go in `queries.ts` but as separate functions
- Offline queue writes -- these are inherently untyped

**Verification criteria for Phase B**:
- [ ] `npm run build` succeeds
- [ ] Every `supabase.from(table).select(...)` read operation in `src/hooks/` and `src/lib/` calls a function from `queries.ts`
- [ ] Pages that had inline Supabase queries now call `queries.ts` functions
- [ ] All fetch functions in `queries.ts` have explicit return types
- [ ] Existing app behavior unchanged -- same data, same timing

### Phase C: TanStack Query Migration (Item 1)

**Branch**: `refactor/tanstack-migration`

**Migrate each hook to TanStack Query**, using the centralized query functions from Phase B.

**Migration order** (simplest to most complex):

#### Batch 1: Simple read-only hooks (no auth dependency)

| Hook | Current Lines | Key Change |
|------|--------------|------------|
| `useVenueCoverage` | 32 | Replace useState/useEffect with `useQuery({ queryKey: ['venue-coverage'], queryFn })` |
| `usePlaySpectrum` | 58 | Replace with `useQuery({ queryKey: ['play-spectrum', playId], queryFn, enabled: !!playId })` |
| `useDiscoveryQueue` | 54 | Replace with `useQuery` + `useMutation` for dismiss |

#### Batch 2: Auth-dependent read-only hooks

| Hook | Current Lines | Key Change |
|------|--------------|------------|
| `useProfile` | 47 | `useQuery({ queryKey: ['profile', user?.id], queryFn, enabled: !!user })` -- combine profile+progress into one query |
| `useEmotionAggregates` | 76 | `useQuery({ queryKey: ['emotion-agg', user?.id, mode], queryFn, enabled: !!user })` |
| `useFriendActivity` | 78 | `useQuery({ queryKey: ['friend-activity', user?.id], queryFn, enabled: !!user })` |
| `useCostDashboard` | 66 | `useQuery({ queryKey: ['cost-dashboard', user?.id, days], queryFn, enabled: !!user })` |
| `useVenueAudit` | 78 | `useQuery` + keep filter/sort state as local useState (not part of query) |

#### Batch 3: Read + write hooks (need useMutation)

| Hook | Current Lines | Key Change |
|------|--------------|------------|
| `useReviews` | 52 | `useQuery` for reads + `useMutation` for submit/delete/vote with `queryClient.invalidateQueries` |
| `useFriendships` | 86 | `useQuery` for reads + `useMutation` for send/accept/decline/remove |
| `usePlayInterest` | 105 | `useQuery` for reads + `useMutation` for toggle with optimistic updates |

#### Batch 4: Complex hooks with optimistic updates

| Hook | Current Lines | Key Change |
|------|--------------|------------|
| `useWatchlist` | 91 | `useQuery` for reads + `useMutation` for add/update/remove with optimistic cache updates via `queryClient.setQueryData` |

**TanStack Query conventions** to establish:

```typescript
// Query key convention: [entity, ...params]
// Examples:
['plays']
['events']
['profile', userId]
['watchlist', userId]
['reviews', eventId]
['friendships', userId]
['play-interest', playId, userId]
['play-spectrum', playId]
['map-data', userId, lastScrapeTs]  // already exists
['tonight-events']                   // already exists

// Stale time defaults (set in QueryClient config):
// - Static data (plays, venues): 5 minutes
// - User data (watchlist, profile): 1 minute
// - Real-time data (tonight): 30 seconds
```

**Pattern for mutations with optimistic updates** (watchlist example):

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
    await queryClient.cancelQueries({ queryKey: ['watchlist', user!.id] })
    const previous = queryClient.getQueryData<WatchlistItem[]>(['watchlist', user!.id])
    // optimistic update...
    return { previous }
  },
  onError: (_err, _vars, context) => {
    queryClient.setQueryData(['watchlist', user!.id], context?.previous)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['watchlist', user!.id] })
  },
})
```

**What does NOT change**:
- `useMap.ts` -- keeps its current Mapbox GL setup (only the data-fetching part already uses useQuery)
- `useHouseCheck.ts` -- no data fetching, stays as-is
- `useOfflineWrite.ts` -- offline queue is inherently imperative, stays as-is
- `usePullToRefresh.ts` -- gesture handler, stays as-is

**Verification criteria for Phase C**:
- [ ] `npm run build` succeeds
- [ ] Zero `useState`/`useEffect` for data fetching in hooks (except useMap Mapbox setup, useOfflineWrite, useHouseCheck, usePullToRefresh)
- [ ] All hooks use TanStack Query `useQuery` or `useMutation`
- [ ] Optimistic updates work for watchlist add/update/remove
- [ ] Background refetch works (switch tabs, come back, data refreshes)
- [ ] Manual test: add to watchlist on one page, navigate to another, see updated data (cache sharing)

### Phase D: God Component Decomposition (Item 2)

**Branch**: `refactor/component-decomposition`

This phase depends on Phase C because the inline data fetching needs to be in hooks before we extract sub-components. Once data flows through hooks, components become pure render functions that are easy to extract.

#### MyShows.tsx (807 -> ~200 lines)

Extract to:
```
src/pages/MyShows.tsx                    (~200 lines - orchestration only)
src/components/myshows/MarqueeView.tsx   (~230 lines)
src/components/myshows/PosterThumb.tsx   (~65 lines)
src/components/myshows/BookingRow.tsx    (~100 lines)
src/components/myshows/ShowRow.tsx       (~110 lines)
src/components/myshows/EmptyState.tsx    (~25 lines)
src/components/myshows/MonthDivider.tsx  (~28 lines)
src/hooks/useMyShowsState.ts            (~30 lines - tab, view, filter state)
src/lib/groupByMonth.ts                 (~25 lines - pure utility function)
```

#### ProductionDetail.tsx (570 -> ~180 lines)

Extract to:
```
src/pages/ProductionDetail.tsx                (~180 lines - orchestration only)
src/components/production/HeroImage.tsx       (~45 lines)
src/components/production/TitleBlock.tsx      (~70 lines)
src/components/production/CastSection.tsx     (~85 lines)
src/components/production/HouseFelt.tsx       (~45 lines)
src/components/production/ReviewsSection.tsx  (~65 lines - includes ReviewRow, SpoilerReview)
src/hooks/useProductionDetail.ts             (~35 lines - TanStack Query hook)
```

#### Discover.tsx (303 -> ~120 lines)

Extract to:
```
src/pages/Discover.tsx                        (~120 lines - orchestration)
src/components/discover/SearchBar.tsx         (~40 lines)
src/components/discover/FilterChips.tsx       (~45 lines)
src/components/discover/PlaySearchResults.tsx (~70 lines)
src/hooks/useDiscoverFilters.ts              (~40 lines - search, type/venue filters, emotion matching)
```

#### PlayDetail.tsx (296 lines -> ~120 lines)

Extract the `FriendSection` inline component (lines 223-295) to:
```
src/components/play/FriendSection.tsx    (~70 lines)
src/hooks/usePlayFriends.ts             (~40 lines - TanStack Query hook)
```

Move the inline data fetching (lines 31-68) to:
```
src/hooks/usePlayDetail.ts              (~30 lines - TanStack Query hook)
```

**Verification criteria for Phase D**:
- [ ] No page component exceeds 250 lines
- [ ] Every sub-component has a single responsibility
- [ ] No sub-component imports `supabase` directly -- all data comes through props or hooks
- [ ] Visual regression: no UI changes visible to user
- [ ] `npm run build` succeeds, no new TypeScript errors

---

## Rollback Strategy

Each phase is on its own branch and can be reverted independently:

| Phase | Branch | Rollback |
|-------|--------|----------|
| A | `refactor/types-consolidation` | `git revert` the merge commit. Types are additive -- old imports still work during transition. |
| B | `refactor/centralize-queries` | `git revert`. Hooks still work because they still have their own query logic; `queries.ts` just provides shared functions. |
| C | `refactor/tanstack-migration` | `git revert`. This is the riskiest phase because it changes data flow. Test thoroughly before merging. Consider feature-flagging by migrating one hook at a time (merge after each batch). |
| D | `refactor/component-decomposition` | `git revert`. Pure file reorganization -- no behavior changes. |

**If Phase C breaks in production**: The QueryClient config in `src/App.tsx` already has error retry and stale time configured. If a specific hook's migration is buggy, revert just that hook file to its pre-migration version while keeping other migrated hooks.

**Partial rollback for Phase C**: Since hooks are migrated in batches, each batch can be its own commit. Revert the specific batch commit.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TanStack Query cache invalidation bugs | Medium | High (stale data shown to user) | Test each mutation's invalidation manually. Log cache hits/misses in dev mode. |
| Optimistic updates cause flash of wrong data | Medium | Medium (confusing UX) | Use `onMutate` + `onError` rollback pattern. Test with slow network throttling. |
| Breaking existing Supabase query behavior when centralizing | Low | High (data stops loading) | Phase B changes zero hook behavior -- it only adds `queries.ts`. Hooks aren't updated until Phase C. |
| Component extraction introduces prop drilling | Low | Low (inconvenience) | Sub-components receive data through hooks, not props cascading from parents. |
| Type consolidation creates circular imports | Low | Medium (build fails) | `types.ts` has zero runtime imports. It only depends on `emotions.ts` and `house.ts` for re-exports. New types are pure interfaces. |

---

## Query Key Registry

Establish a central registry at `src/lib/queryKeys.ts` to prevent key collisions and enable bulk invalidation:

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
  profile: {
    byUser: (userId: string) => ['profile', userId] as const,
  },
  reviews: {
    byEvent: (eventId: string) => ['reviews', eventId] as const,
  },
  friendships: {
    byUser: (userId: string) => ['friendships', userId] as const,
    activity: (userId: string) => ['friend-activity', userId] as const,
  },
  emotions: {
    aggregate: (userId: string, mode: string) => ['emotion-agg', userId, mode] as const,
  },
  tonight: ['tonight-events'] as const,
  venues: {
    audit: ['venue-audit'] as const,
    coverage: ['venue-coverage'] as const,
    discoveryQueue: ['discovery-queue'] as const,
  },
  costs: {
    dashboard: (userId: string, days: number) => ['cost-dashboard', userId, days] as const,
  },
  plays_interest: {
    byPlay: (playId: string) => ['play-interest', playId] as const,
    spectrum: (playId: string) => ['play-spectrum', playId] as const,
  },
} as const
```

---

## File Diff Summary

After all four phases, the net file changes:

**New files** (6):
- `src/lib/queries.ts` -- centralized Supabase fetch functions
- `src/lib/queryKeys.ts` -- TanStack Query key registry
- `src/lib/groupByMonth.ts` -- extracted pure function
- `src/hooks/useMyShowsState.ts` -- extracted state hook
- `src/hooks/useProductionDetail.ts` -- extracted data hook
- `src/hooks/useDiscoverFilters.ts` -- extracted filter hook

**New component directories** (3):
- `src/components/myshows/` -- 6 extracted components
- `src/components/production/` -- 5 extracted components
- `src/components/discover/` -- 3 extracted components

**Modified files** (25+):
- `src/lib/types.ts` -- expanded with domain types + join result types
- `src/lib/mapData.ts` -- uses queries.ts, typed join results, zero `as any`
- `src/lib/offlineSync.ts` -- documented `as any` with comment
- All 13 hooks migrated from useState/useEffect to TanStack Query
- `src/pages/MyShows.tsx` -- reduced from 807 to ~200 lines
- `src/pages/ProductionDetail.tsx` -- reduced from 570 to ~180 lines
- `src/pages/Discover.tsx` -- reduced from 303 to ~120 lines
- `src/pages/PlayDetail.tsx` -- reduced from 296 to ~120 lines

**Deleted files**: 0 (all changes are in-place modifications or new files)

---

## Testing Checklist

Run after each phase merge:

- [ ] `npm run build` -- zero TypeScript errors, zero warnings
- [ ] Manual smoke test on iPhone PWA:
  - [ ] Tonight page loads with hero card and marquee ticker
  - [ ] Map page shows venue markers, filter chips work
  - [ ] Discover search returns results, emotion search works
  - [ ] My Shows tabs switch correctly, pull-to-refresh works
  - [ ] Add to watchlist from show detail, see it in My Shows
  - [ ] Log a show as seen, verify emotion palette updates
  - [ ] Mentor chat sends messages and receives responses
  - [ ] Play detail shows waiting count and spectrum
  - [ ] Friend activity appears in Tonight feed
- [ ] Network tab: no duplicate requests for same data (TanStack Query dedup working)
- [ ] Offline: app shell loads, offline indicator appears
- [ ] Console: no runtime errors, no unhandled promise rejections
