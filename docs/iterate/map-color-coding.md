# Map Missing Color Coding

**Category:** change
**Status:** pending
**Phase:** 3
**Priority:** P2

## User's Original Request
> Our map doesn't have the color coding as in The Art of Art - Map.

## Diagnosis
MapMarker.tsx has the structural framework: room-kind glyphs, relationship borders, tonight dot with pulse. But the emotion-color dimension is incomplete.

The design spec (README.md lines 315-321) defines:
- **booked:** gold fill oklch(0.80 0.14 55), glyph #0c0a05
- **want_to_see:** 1.5px dashed gold border, glyph gold
- **seen:** 1.5px solid {dominant feeling color}, glyph same color
- **never been:** 1.5px solid #2b2720, glyph #9c9586

MapMarker.tsx lines 54-72 implement relationships BUT `dominantColor` is always `null` (MapView.tsx line 136 hardcodes `dominantColor: null`). The "seen" markers never get their emotion color — they fall back to grey.

The emotion data exists in `event_emotion_counts` but is never queried by the map components.

**Root cause:** `dominantColor` never populated from emotion data for seen venues.

**Files involved:**
- `src/components/MapView.tsx` line 136 — query and pass dominantColor
- `src/components/MapMarker.tsx` — verify color application works when dominantColor is provided

## Graph

### Node 1: explore
- **Loop:** discover → assess
- **Output:** diagnosis section above
- **Tokens:** in / out / $

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. MapView.tsx: query user's watchlist emotions for seen venues
  2. Extract dominant emotion per venue from user's watchlist entry
  3. Look up emotion's oklch color from emotions constants
  4. Pass dominantColor to createMarkerElement
  5. Verify MapMarker applies the color to "seen" relationship borders
- **Files:** src/components/MapView.tsx, src/components/MapMarker.tsx
- **Tokens:** in / out / $

### Node 3: test
- **Loop:** write tests → run → fix failures
- **Tests:** unit test for emotion color extraction, e2e for colored markers on map
- **Tokens:** in / out / $

### Node 4: verify
- **Loop:** build → dev-server → visual confirm markers show emotion colors
- **Tokens:** in / out / $

## Commit
- **Hash:**
- **Message:**
- **Version:**

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| | user | request | Map missing color coding per design spec |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | | | |
| implement | | | |
| test | | | |
| verify | | | |
| **Total** | | | |
