# Map Banner Dismiss + Pulse Colors

**Category:** feature
**Status:** pending
**Phase:** 3
**Priority:** P2

## User's Original Request
> The banner that shows up on map... 3 curtains up within three miles... tap a theater. 5 under $20 - 0 pay-what-you-can... how do we dismiss this banner? Also those items on the banner should pulse with some color on the map. Our palette is muted brown gray so colors will pop and be strong visual signals.

## Diagnosis
The VenueSheet peek state (lines 77-107) has a grab handle that calls `onClose` and clicking the map background also dismisses it. But there's no visible close button (x) or swipe-down gesture — the dismiss affordance is invisible to users.

For pulse colors: MapMarker.tsx already has a tonight-pulse animation (1.8s opacity pulse) on the tonight dot. But the banner items ("curtains up", "under $20", "pay-what-you-can") don't trigger corresponding visual highlighting on map markers. The design spec (README.md line 320) defines the tonight dot pulse but doesn't specify banner-to-marker interaction.

**Root cause:** No visible dismiss affordance. No banner-to-marker color linking.

**Files involved:**
- `src/components/VenueSheet.tsx` — add close button
- `src/components/MapView.tsx` — add color pulse for banner-linked markers
- `src/components/MapMarker.tsx` — support dynamic pulse colors

## Graph

### Node 1: explore
- **Loop:** discover → assess
- **Output:** diagnosis section above
- **Tokens:** in / out / $

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. Add visible close button (x) to VenueSheet peek state
  2. Add swipe-down gesture to dismiss
  3. When banner shows stats (curtains up, under $20, pay-what-you-can), highlight corresponding markers with color pulse
  4. Use contrasting colors against muted palette: tonight=green oklch(0.74 0.16 145), cheap=gold oklch(0.80 0.14 55), free=bright green
- **Files:** src/components/VenueSheet.tsx, src/components/MapView.tsx, src/components/MapMarker.tsx
- **Tokens:** in / out / $

### Node 3: test
- **Loop:** write tests → run → fix failures
- **Tests:** e2e for banner dismiss, marker pulse activation
- **Tokens:** in / out / $

### Node 4: verify
- **Loop:** build → dev-server → visual confirm banner dismiss + marker pulses
- **Tokens:** in / out / $

## Commit
- **Hash:**
- **Message:**
- **Version:**

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| | user | request | Banner needs dismiss button, items should pulse on map |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | | | |
| implement | | | |
| test | | | |
| verify | | | |
| **Total** | | | |
