# You Page Still Blank (Third Fix)

**Category:** bug
**Status:** complete
**Phase:** 5
**Priority:** P1

## User's Original Request
> Profile button still doesn't work. Did we have a graph node to fix it. Can we diagnose with diagnostics?

## Prior Fixes (both insufficient)
1. **v0.4.5:** useProfile hook — added `setLoading(false)` when user is null
2. **v0.4.12:** Profile.tsx — moved `useEmotionAggregates` before early return (hooks ordering violation)

## Diagnosis
Root cause: **useProfile silently swallows Supabase errors.** The hook never checks `.error` on query responses. When either `profiles` or `user_progress` query fails (RLS, network, stale token), `data` is `undefined`, gets cast to `null` via `as Profile | null`, `loading` becomes false, and the component renders with null profile. No error is logged, no empty state is shown.

Additionally, Profile.tsx has no fallback UI for when `profile` is null after loading completes. It renders all sections with null-safe access (`profile?.house_rank ?? 0`) but the result looks blank — default values with no meaningful content and no indication that something went wrong.

**Files involved:**
- `src/hooks/useProfile.ts` — add error handling, diagnostic logging
- `src/pages/Profile.tsx` — add null profile state, add diagnostics

## Graph

### Node 1: explore
- **Loop:** discover → assess
- **Output:** diagnosis above
- **Tokens:** — (done via Explore agent)

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. useProfile: check `.error` on both Supabase responses, log via diagnostics
  2. useProfile: expose `error` state to consumers
  3. Profile.tsx: add error state UI
  4. Profile.tsx: add empty profile state (profile null after loading)
  5. Profile.tsx: add diagnostic breadcrumbs for render lifecycle
- **Files:** src/hooks/useProfile.ts, src/pages/Profile.tsx

### Node 3: test
- **Loop:** write tests → run → fix failures

### Node 4: verify
- **Loop:** build → dev-server → test profile page in all states

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| 2026-08-01T14:45 | user | request | Profile button still doesn't work |
| 2026-08-01T14:46 | ai | explore | Explore agent traced all render paths, found silent error swallowing in useProfile |
| 2026-08-01T14:47 | ai | implement | Adding error handling + diagnostics + fallback UI |
