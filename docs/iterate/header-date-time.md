# Date/Time Display in Header

**Category:** feature
**Status:** complete
**Phase:** 7
**Priority:** P3

## User's Original Request
> Let's have the app, near the top, surface today's date and time.

## Diagnosis

The app had no date/time display. For a theater app focused on "tonight" shows, knowing the current date and time is contextually useful — especially when deciding whether to head to a show. The header had available space between the title/version area and the sign-out button.

**Design decisions:**
- Format: `SAT AUG 2 · 2:45 PM` — day-of-week, month, day, centered dot separator, time
- Font: Courier Prime monospace, 10px, `var(--ink-dim)` color — matches other label styling
- Position: Right side of header, left of sign-out button
- Update interval: 60 seconds via `setInterval` — minute-level precision is sufficient
- Layout: Wrapped sign-out button and date into a flex container with `gap-3`

## Graph

```
┌─────────────────────────────────────────────────────────┐
│ HEADER DATE/TIME — FEATURE GRAPH                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [design-format]                                        │
│    │  Choose format, font, position                     │
│    ▼                                                    │
│  [implement-clock]                                      │
│    │  Header.tsx: formatNow() helper                    │
│    │  useState + useEffect with 60s setInterval         │
│    │  Render between version stamp and sign-out          │
│    ▼                                                    │
│  [verify-build]                                         │
│    │  Build passes, time displays and updates            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## AI Loops (AL)

### Loop: implement-clock
- **Trigger:** User request for date/time display
- **Inner cycle:**
  1. Plan: `formatNow()` function using `toLocaleDateString` and `toLocaleTimeString` with 'en-US' locale. `useState(formatNow)` for lazy init. `useEffect` with 60s interval + cleanup.
  2. Execute: Add imports (useState, useEffect), add formatNow helper, add state + effect, restructure header right side into flex container
  3. Verify: Build passes, time formats correctly, updates each minute
- **Evaluator:** Header shows correct date/time in expected format. Interval cleans up on unmount.
- **Retry:** If format looks wrong, adjust toLocaleDateString/toLocaleTimeString options
- **Stop condition:** Build passes, time displays correctly

## Commit
- **Hash:** d843cbf
- **Message:** v0.4.19: Map UX overhaul — green borders for tonight, remove banner, add date/time
- **Version:** 0.4.19

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| 2026-08-01 | user | request | Surface today's date and time near top of app |
| 2026-08-02 | ai | implement | Added formatNow() + useState/useEffect clock to Header.tsx, wrapped right side in flex container |
| 2026-08-02 | ai | test | npm run build passes |
| 2026-08-02 | ai | commit | d843cbf — v0.4.19 |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| design-format | — | — | — |
| implement-clock | — | — | — |
| verify-build | — | — | — |
| **Total** | — | — | — |
