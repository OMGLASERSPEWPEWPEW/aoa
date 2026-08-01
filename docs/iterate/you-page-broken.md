# You Page Broken

**Category:** bug
**Status:** pending
**Phase:** 2
**Priority:** P1

## User's Original Request
> 'You' leads to an empty screen and clicking the back button doesn't work on desktop. On app, it gets stuck on loading... what's it trying to load? Then when it's done loading, it's a blank screen.

## Diagnosis
Profile.tsx depends on `useAuth()` for the user object and `useProfile()` for profile data. The useProfile hook (lines 6-26) fetches from the `profiles` table when user is available. If auth fails or user is null, the hook returns early at line 13 **without setting `loading = false`**, causing an infinite loading state.

Once loading eventually resolves (or if user IS authenticated), the page may still appear blank if the profile query returns no data and the component doesn't handle the empty state.

No back button exists in the component — the page relies entirely on bottom tab navigation.

**Root cause:** `useProfile` hook has a loading state bug when user is null. Also missing empty state handling.

**Files involved:**
- `src/hooks/useProfile.ts` — fix loading state when user is null
- `src/pages/Profile.tsx` — add empty state, ensure content renders for authenticated users

## Graph

### Node 1: explore
- **Loop:** discover → assess
- **Output:** diagnosis section above
- **Tokens:** in / out / $

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. Fix useProfile: when user is null, set loading=false and return null profile
  2. Profile.tsx: add unauthenticated state ("Sign in to see your profile")
  3. Profile.tsx: add empty profile state (profile exists but has no data yet)
  4. Verify profile renders correctly for authenticated users with data
- **Files:** src/hooks/useProfile.ts, src/pages/Profile.tsx
- **Tokens:** in / out / $

### Node 3: test
- **Loop:** write tests → run → fix failures
- **Tests:** unit test for useProfile with null user, e2e for Profile page states
- **Tokens:** in / out / $

### Node 4: verify
- **Loop:** build → dev-server → test both auth states
- **Tokens:** in / out / $

## Commit
- **Hash:**
- **Message:**
- **Version:**

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| | user | request | You page leads to empty/loading screen |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | | | |
| implement | | | |
| test | | | |
| verify | | | |
| **Total** | | | |
