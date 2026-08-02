# Green Marker Borders for Tonight Shows

**Category:** change
**Status:** complete
**Phase:** 7
**Priority:** P1

## User's Original Request
> Instead of the green light at the top right corner, let's make the icons border green so it pops more. Like we have a gray square, a grey outline, then a blackish box outline.

## Diagnosis

Tonight shows were indicated by a 9px green circle positioned at the top-right corner of the marker, with a pulsing animation. The user correctly identified this was too subtle — on a dark map with 37 markers, a tiny dot in the corner doesn't draw the eye. The marker's border (chip + tail) is the most visible element and should carry the "tonight" signal.

**Design approach:**
- When `isTonight` is true, override the chip border to `2px solid oklch(0.74 0.16 145)` regardless of relationship status
- Make the tail border match (green, solid)
- For default-relationship venues (no watchlist interaction), also turn the glyph color green
- Keep relationship-based background/text color intact — only the border changes
- Remove the tonight dot DOM element entirely
- Remove the `tonight-pulse` CSS animation from MapView.tsx

**Files involved:**
- `MapMarker.tsx` — tonight dot creation (lines 90-102), border assignment logic
- `MapView.tsx` — `@keyframes tonight-pulse` CSS (lines 258-267)
- `MapKey.tsx` — legend entry for "curtain up tonight" (green dot → green-bordered square)

## Graph

```
┌─────────────────────────────────────────────────────────┐
│ GREEN MARKER BORDERS — VISUAL CHANGE GRAPH              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [redesign-tonight-indicator]                           │
│    │  Plan: tonightBorder variable, apply to chip       │
│    │  and tail, remove dot element                      │
│    ▼                                                    │
│  [implement-marker]                                     │
│    │  MapMarker.tsx: add tonightBorder const             │
│    │  Override chip.style.border for all 4 relationship │
│    │  branches when isTonight                            │
│    │  Override tail border to match                      │
│    │  Delete tonight dot creation block                  │
│    ▼                                                    │
│  [remove-pulse-animation]                               │
│    │  MapView.tsx: delete @keyframes tonight-pulse       │
│    │  and reduced-motion override                        │
│    ▼                                                    │
│  [update-map-key]                                       │
│    │  MapKey.tsx: replace green dot (●) with             │
│    │  green-bordered square inline element               │
│    ▼                                                    │
│  [verify-visual]                                        │
│    │  Build passes, markers render with green            │
│    │  borders for tonight shows                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## AI Loops (AL)

### Loop: implement-marker
- **Trigger:** User approval of green border approach
- **Inner cycle:**
  1. Plan: `const tonightBorder = isTonight ? '2px solid oklch(0.74 0.16 145)' : null` — use as first choice in each relationship branch via `tonightBorder ?? <default>`
  2. Execute: Modify all 4 if/else branches to use `tonightBorder ??` fallback pattern. Delete the tonight dot block. For tail, compute tailBorder from tonightBorder or fall back to chip border.
  3. Verify: `npm run build` passes, no references to tonight dot remain
- **Evaluator:** Tonight markers have green borders. Non-tonight markers have their original borders unchanged.
- **Retry:** If border doesn't show, check CSS specificity and whether inline styles are being overwritten by the selection styling useEffect
- **Stop condition:** Build passes, visual confirmed in dev server

### Loop: update-map-key
- **Trigger:** implement-marker complete
- **Inner cycle:**
  1. Discover: Current legend uses `● curtain up tonight` with green color
  2. Execute: Replace text dot with inline `<span>` element — 8×8px square with 2px green border and 2px border-radius
  3. Verify: Legend visually matches the new marker style
- **Evaluator:** Legend entry is visually consistent with actual marker appearance
- **Stop condition:** MapKey renders correctly

## Commit
- **Hash:** d843cbf
- **Message:** v0.4.19: Map UX overhaul — green borders for tonight, remove banner, add date/time
- **Version:** 0.4.19

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| 2026-08-01 | user | request | Green borders instead of small green dot for tonight shows |
| 2026-08-02 | ai | implement | Added tonightBorder const in MapMarker, overrides chip+tail border in all relationship branches, deleted tonight dot block |
| 2026-08-02 | ai | implement | Removed tonight-pulse keyframes from MapView |
| 2026-08-02 | ai | implement | Updated MapKey: green dot → green-bordered square |
| 2026-08-02 | ai | test | npm run build passes |
| 2026-08-02 | ai | commit | d843cbf — v0.4.19 |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| redesign-tonight-indicator | — | — | — |
| implement-marker | — | — | — |
| remove-pulse-animation | — | — | — |
| update-map-key | — | — | — |
| verify-visual | — | — | — |
| **Total** | — | — | — |
