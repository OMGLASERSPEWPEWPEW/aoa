# Map Marker Click Race Condition

**Category:** bug
**Status:** complete
**Phase:** 6
**Priority:** P1

## User's Original Request
> The map banner x button still doesnt work and the clicking on a map icon still doesnt pull up the theater and show info. Why cant we fix this?

## Diagnosis

Three prior fix attempts failed because they addressed surface symptoms (missing stopPropagation, missing state tracking) without understanding the DOM lifecycle race condition at the core.

**Root cause:** `selectedVenue` was listed in the markers `useEffect` dependency array. When a marker was clicked, `setSelectedVenue(venue)` triggered a re-render, which re-ran the markers effect, destroying all marker DOM elements and recreating them. The DOM element that received the click was removed mid-event, allowing the event to fall through to the Mapbox GL canvas underneath, which fired its own click handler and called `setSelectedVenue(null)` — instantly clearing the selection.

**Why prior fixes failed:**
1. **v0.4.14 (stopPropagation):** `e.stopPropagation()` on the marker DOM element prevents DOM event bubbling, but Mapbox GL listens on its own canvas element, not via DOM bubbling. When the marker DOM was destroyed mid-click, the canvas received a fresh pointer event.
2. **v0.4.15 (banner state):** Added `bannerDismissed` state for the banner dismiss (correct), but the core marker click issue persisted because the DOM lifecycle problem was unresolved.
3. **v0.4.16 (same code, redeploy):** No new fix — redeployed hoping PWA cache was stale. Same bug.

## Graph

### Node 1: explore
- **Loop:** discover → assess
- **Output:** Identified that `selectedVenue` in useEffect deps caused full marker DOM teardown/rebuild on every selection change. The destroyed marker's click event couldn't complete, letting Mapbox canvas receive the pointer event.
- **Tokens:** — (manual diagnosis)

### Node 2: implement
- **Loop:** plan → code → build-check
- **Files:**
  - `src/components/MapView.tsx` — removed `selectedVenue` from marker useEffect deps, added `markerClickedRef` (useRef flag), added separate useEffect for selection styling (scale + box-shadow), updated map click handler to check ref before clearing
  - `src/components/VenueSheet.tsx` — enlarged × button to 44px, added stopPropagation, added zIndex: 10
  - `src/components/MapMarker.tsx` — (already had stopPropagation from prior fix)
- **Tokens:** —

### Node 3: test
- **Loop:** write tests → run → fix failures
- **Tests:** `npm run build` passes, 92 unit tests pass
- **Tokens:** —

### Node 4: verify
- **Loop:** build → dev-server check → visual confirm
- **Tokens:** —

## AI Graph Engineering (AGE)

```
┌─────────────────────────────────────────────────────────┐
│ MAP MARKER CLICK RACE CONDITION — FIX GRAPH             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [diagnose-dom-lifecycle]                               │
│    │  Understand: marker useEffect deps → full DOM      │
│    │  teardown → click event lost → canvas fires        │
│    ▼                                                    │
│  [split-marker-effects]                                 │
│    │  Separate marker creation (heavy) from             │
│    │  selection styling (lightweight DOM manipulation)   │
│    ▼                                                    │
│  [add-click-ref-flag]──────────┐                        │
│    │  useRef(false) set true   │                        │
│    │  on marker click          │                        │
│    ▼                           ▼                        │
│  [guard-canvas-click]    [fix-banner-dismiss]            │
│    │  Map onClick checks  │  Separate bannerDismissed   │
│    │  ref before clearing  │  state, onClose branches   │
│    ▼                       ▼                            │
│  [enlarge-touch-targets]                                │
│    │  × button 44px, stopPropagation, zIndex            │
│    ▼                                                    │
│  [verify-build-tests]                                   │
│    │  npm run build + 92 tests pass                     │
│    ▼                                                    │
│  [deploy-v0.4.17]                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## AI Loops (AL)

### Loop: diagnose-dom-lifecycle
- **Trigger:** Bug reported 3+ times after attempted fixes
- **Inner cycle:**
  1. Discover: Read MapView.tsx useEffect deps, trace what happens when selectedVenue changes
  2. Assess: Does the effect destroy/recreate markers? If yes, does that interfere with in-flight click events?
  3. Confirm: The marker DOM element is removed before the click handler completes
- **Evaluator:** Can explain the full causal chain from click → state change → effect → DOM removal → canvas event → state clear
- **Stop condition:** Root cause identified with testable hypothesis

### Loop: split-marker-effects
- **Trigger:** diagnose-dom-lifecycle complete
- **Inner cycle:**
  1. Plan: Two useEffects — one for marker creation (deps: venues, events, filters), one for selection styling (deps: selectedVenue)
  2. Execute: Move selectedVenue out of marker creation deps, add new useEffect that reads markersRef and applies scale/glow via direct DOM manipulation
  3. Verify: Markers not destroyed on selection change (check via console.log in marker creation effect)
- **Evaluator:** Selecting a venue does NOT trigger the marker creation effect
- **Retry:** If markers still re-render, check for other deps that transitively depend on selectedVenue
- **Stop condition:** Selection styling updates without marker DOM teardown

### Loop: add-click-ref-flag
- **Trigger:** split-marker-effects complete
- **Inner cycle:**
  1. Plan: useRef(false) — marker onClick sets true, map onClick checks and resets
  2. Execute: Add markerClickedRef, wire into both handlers
  3. Verify: Click marker → ref true → map click handler skips → selection persists
- **Evaluator:** Clicking a marker results in venue sheet appearing, not flashing and disappearing
- **Stop condition:** No race condition between marker click and canvas click

## Commit
- **Hash:** 67419f9
- **Message:** Fix map marker click race condition + banner dismiss (v0.4.17)
- **Version:** 0.4.17

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| 2026-08-01 | user | request | Map banner x button still doesn't work, clicking map icons doesn't show theater info |
| 2026-08-01 | ai | explore | Read MapView.tsx, MapMarker.tsx, VenueSheet.tsx — identified selectedVenue in marker useEffect deps as root cause |
| 2026-08-01 | ai | implement | Removed selectedVenue from deps, added markerClickedRef, added separate styling useEffect, enlarged × button |
| 2026-08-01 | ai | test | npm run build passes, 92 tests pass |
| 2026-08-01 | ai | commit | 67419f9 — Fix map marker click race condition + banner dismiss (v0.4.17) |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | — | — | — |
| implement | — | — | — |
| test | — | — | — |
| verify | — | — | — |
| **Total** | — | — | — |
