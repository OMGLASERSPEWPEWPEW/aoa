# Remove Map Peek Banner

**Category:** change
**Status:** complete
**Phase:** 7
**Priority:** P1

## User's Original Request
> On the map. Can we remove the banner? it's so in the way.

## Diagnosis

The map had a "peek" banner that displayed when no venue was selected: "X curtains up within three miles / TAP A THEATER · Y UNDER $20 · Z PAY-WHAT-YOU-CAN". This occupied ~80px at the bottom of the map viewport, covering map markers and reducing usable map area. It was introduced in v0.4.15 as a discovery affordance but proved more annoying than helpful in practice.

**Files involved:**
- `MapView.tsx` — `bannerDismissed` state, conditional rendering `(selectedVenue || !bannerDismissed)`, dismiss logic in `onClose`, `peekCounts` prop calculation
- `VenueSheet.tsx` — `PeekCounts` interface, `peekCounts` prop, entire `venue === null` early return branch (lines 78-134) rendering the banner

## Graph

```
┌─────────────────────────────────────────────────────────┐
│ REMOVE MAP BANNER — DELETION GRAPH                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [remove-banner-state]                                  │
│    │  MapView.tsx: delete bannerDismissed useState       │
│    │  Simplify conditional to just `selectedVenue`      │
│    │  Remove peekCounts prop, simplify onClose           │
│    ▼                                                    │
│  [remove-peek-path]                                     │
│    │  VenueSheet.tsx: delete PeekCounts interface        │
│    │  Remove peekCounts from Props                      │
│    │  Delete venue===null early return (56 lines)        │
│    │  Change venue prop type from Venue|null to Venue   │
│    ▼                                                    │
│  [verify-build]                                         │
│    │  npm run build — no type errors from removed       │
│    │  props/interfaces                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## AI Loops (AL)

### Loop: remove-banner-state
- **Trigger:** User request to remove banner
- **Inner cycle:**
  1. Discover: Trace all references to `bannerDismissed` and `peekCounts` in MapView.tsx
  2. Execute: Remove state, simplify conditional rendering, remove prop passing
  3. Verify: No references to banner state remain in MapView.tsx
- **Evaluator:** `grep -n bannerDismissed src/components/MapView.tsx` returns nothing
- **Stop condition:** MapView.tsx has no banner-related code

### Loop: remove-peek-path
- **Trigger:** remove-banner-state complete
- **Inner cycle:**
  1. Discover: Read VenueSheet.tsx, identify PeekCounts interface and null-venue rendering
  2. Execute: Delete interface, remove prop, delete early return, change venue type to non-nullable
  3. Verify: TypeScript compiles — MapView.tsx no longer passes peekCounts, VenueSheet no longer expects it
- **Evaluator:** `npm run build` passes with no type errors
- **Retry:** If build fails, check for other consumers of PeekCounts or peekCounts prop
- **Stop condition:** Build passes, no dead code remains

## Commit
- **Hash:** d843cbf
- **Message:** v0.4.19: Map UX overhaul — green borders for tonight, remove banner, add date/time
- **Version:** 0.4.19

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| 2026-08-01 | user | request | Remove map banner, "it's so in the way" |
| 2026-08-02 | ai | implement | Removed bannerDismissed state from MapView, deleted PeekCounts interface and null-venue path from VenueSheet |
| 2026-08-02 | ai | test | npm run build passes |
| 2026-08-02 | ai | commit | d843cbf — v0.4.19 |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| remove-banner-state | — | — | — |
| remove-peek-path | — | — | — |
| verify-build | — | — | — |
| **Total** | — | — | — |
