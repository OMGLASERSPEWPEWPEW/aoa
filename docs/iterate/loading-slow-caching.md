# Loading Slow / No Caching

**Category:** change
**Status:** pending
**Phase:** 4
**Priority:** P2

## User's Original Request
> Loading is slow... are we caching at all or something? Things should be snappy and instant. Glyffiti is really fast — is there anything Glyffiti is doing that makes their app faster than ours?

## Diagnosis
The app has minimal caching:
- **Workbox PWA** caches Supabase REST calls for 5 min (NetworkFirst strategy in vite.config.ts lines 33-39) — good for offline, not for speed
- **Dexie** is used only for offline write queue (`pendingWrites` table), not for data caching
- **No React Query or SWR** — not in dependencies
- **Every page load queries Supabase fresh**: Tonight.tsx queries ALL events on every mount, MapView.tsx queries ALL venues + events on every mount
- **No stale-while-revalidate** pattern — user sees "Loading..." on every page transition
- **No prefetching** on route change

With 100+ venues and growing events, each page load downloads ~50KB+ of JSON from Supabase with 200-500ms latency.

**Root cause:** No client-side data caching layer. Every navigation triggers a full network fetch.

**Files involved:**
- `package.json` — add @tanstack/react-query
- `src/App.tsx` — add QueryClientProvider
- `src/pages/Tonight.tsx` — convert to useQuery
- `src/components/MapView.tsx` — convert to useQuery
- `src/pages/MyShows.tsx` — convert to useQuery
- All pages with Supabase queries

## Graph

### Node 1: explore
- **Loop:** discover → assess
- **Output:** diagnosis section above
- **Tokens:** in / out / $

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. Install @tanstack/react-query
  2. Add QueryClientProvider to App.tsx with staleTime: 5 min, gcTime: 30 min
  3. Convert Tonight.tsx loadData to useQuery with 'tonight-events' key
  4. Convert MapView.tsx data fetch to useQuery with 'map-venues' key
  5. Convert other pages similarly
  6. Add prefetchQuery on route hover/focus for common navigation paths
  7. Data shows instantly from cache, revalidates in background
- **Files:** package.json, src/App.tsx, src/pages/Tonight.tsx, src/components/MapView.tsx, src/pages/MyShows.tsx, src/pages/Profile.tsx
- **Tokens:** in / out / $

### Node 3: test
- **Loop:** write tests → run → fix failures
- **Tests:** unit tests for query hooks, e2e for page transition speed
- **Tokens:** in / out / $

### Node 4: verify
- **Loop:** build → dev-server → navigate between pages, confirm instant transitions
- **Tokens:** in / out / $

## Commit
- **Hash:**
- **Message:**
- **Version:**

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| | user | request | App is slow, needs caching like Glyffiti |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | | | |
| implement | | | |
| test | | | |
| verify | | | |
| **Total** | | | |
