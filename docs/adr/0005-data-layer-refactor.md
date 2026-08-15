# ADR 0005: Data Layer Refactoring — TanStack Query + Centralized Queries + Type Consolidation

**Date:** 2026-08-15
**Status:** Proposed
**Scope:** `src/hooks/`, `src/lib/`, `src/pages/` — data fetching, state management, type declarations

## Context

The app has grown organically through Phases 0–3, accumulating two coexisting data-fetching patterns. Of 21 hooks, 13 use manual `useState`/`useEffect`/`setLoading`, while 3 hooks and 2 pages use TanStack Query's `useQuery`. Every new hook requires a pattern decision. Every reader needs to understand both paradigms.

Beyond the dual patterns:
- 40+ Supabase `.from()` calls are scattered across 16 files with subtle differences in `.select()` columns and `.order()` direction. A column rename requires a find-and-replace across the codebase.
- 7 `as any` casts paper over missing types for Supabase join results, suppressing real bugs.
- 62+ type/interface declarations live outside the canonical `src/lib/types.ts`, including 2 confirmed duplicates (`TrendBucket`, `ProductionRow`).
- 3 page components exceed 300 lines (MyShows 807, ProductionDetail 570, Discover 303), bundling fetching, filtering, state management, and rendering in single files.

Phase 4 (Content + Social) will add more hooks, components, and Supabase queries. Refactoring after Phase 4 would be twice the work.

Three approaches were considered.

## Decision

Execute a 4-phase data layer refactoring:

1. **Types Foundation** — consolidate domain types into `types.ts`, create typed Supabase join result interfaces, eliminate `as any` casts
2. **Query Layer** — create `src/lib/queries.ts` with typed fetch functions and `src/lib/queryKeys.ts` with factory functions
3. **TanStack Migration** — migrate all 13 manual hooks to `useQuery`/`useMutation` in 4 batches (simplest to most complex)
4. **Component Decomposition** — extract god components into focused sub-components with dedicated hooks

Each phase gets its own branch and can be reverted independently.

## Alternatives Considered

**Option A: Keep both patterns, add documentation**

Document which pattern to use when. New hooks follow TanStack Query; existing hooks stay as-is until individually touched.

Rejected because:
- Documentation doesn't prevent drift — contributors will copy the nearest similar hook, which is usually a manual one
- The 7 `as any` casts persist indefinitely
- God components continue growing as new features add more inline queries
- Two mental models remain necessary for every code review

**Option B: Migrate to TanStack Query only (no centralized queries.ts)**

Convert all hooks to `useQuery` but keep `queryFn` inline in each hook.

Rejected because:
- Each hook still owns its own Supabase query chain, duplicating `.from().select().eq()` patterns
- Schema changes still require multi-file updates
- Join result types still need to be defined somewhere — without `queries.ts`, they scatter across hooks
- Addresses the caching problem but not the duplication problem

**Option C (chosen): Full data layer refactoring**

Four-phase approach with centralized queries, consolidated types, and decomposed components. Addresses all five problems simultaneously. Highest up-front effort but highest long-term leverage.

## Consequences

**Positive:**
- Single data-fetching pattern (TanStack Query) — no pattern choice for new hooks
- Schema changes require updating one file (`queries.ts`) instead of 16+
- Stale-while-revalidate, request dedup, background refetch, and optimistic updates out of the box
- No page component exceeds 250 lines; each sub-component has single responsibility
- 5 fewer `as any` casts (7 → 2 documented offline-queue exceptions)
- Domain types consolidated — no duplicate `TrendBucket` or `ProductionRow`
- Cache sharing: add to watchlist on one page, navigate elsewhere, data is current

**Negative:**
- Large changeset touching 25+ files — regression risk mitigated by 4-batch migration and per-phase branches
- Optimistic updates in `useWatchlist` add complexity (`onMutate`/`onError`/`onSettled` pattern)
- `queries.ts` becomes a single ~200-line file — acceptable now, can be split by domain later if needed

**Neutral:**
- No new dependencies added — TanStack Query is already installed and configured
- The 2 `as any` casts in the offline queue (`offlineSync.ts`, `useOfflineWrite.ts`) are inherently untyped by design and documented rather than "fixed"
- Each phase is independently revertable via `git revert` on the merge commit
