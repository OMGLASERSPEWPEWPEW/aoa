# PRD: Map Time Filter Pills

**Feature:** Map Time Filter Pills
**Date:** 2026-08-10
**Size:** Small (< 1 day, 3-4 files)
**Status:** Draft

---

## 1. Executive Summary

The map currently shows all 37+ venues as markers regardless of whether they have active events. Users see a full map of theaters with nothing happening. This feature adds a pill row (Today / This Week / This Month) that filters markers to only show venues with events in the selected time window. Default is "This Week."

## 2. User Stories

**US-1:** As a theater-goer, I want the map to show only venues with something playing this week so I can quickly see what's actually available near me.

**US-2:** As a spontaneous theatergoer, I want to tap "Today" to see only venues with shows tonight so I can make last-minute plans.

**US-3:** As someone planning ahead, I want to tap "This Month" to see the full range of upcoming options across Chicago.

## 3. Functional Requirements

### FR-1: Time Filter Pill Row

**Trigger:** Map page loads at `/app/map`.

**Behavior:** A horizontal row of three pills appears below the header and above the existing filter chips: **Today**, **This Week** (default selected), **This Month**. Exactly one pill is always selected. Tapping a pill selects it and deselects the others.

**Visual:** Pills use the same style as `MapFilterChips.tsx` (Courier Prime monospace, 9.5px, `var(--accent)` active state, `var(--rule)` inactive border). The pill row is a separate row above the existing filter chips, not mixed in with them.

**Error State:** None — pills are always available.

**Scope Boundary:** The time filter affects which markers appear on the map and which events appear in the venue card. It does NOT affect the Tonight page, the Discover page, or any other view.

### FR-2: Venue Marker Filtering

**Trigger:** User selects a time pill (or page loads with default "This Week").

**Behavior:** Only venues that have at least one event within the selected time window get a map marker. Venues with zero matching events are **not rendered** — no marker, no dimmed marker, nothing.

Time window definitions (all dates computed in Chicago timezone, `America/Chicago`):
- **Today:** Events where `isUpTonight(event)` returns true (reuse existing function from `src/lib/tonight.ts`)
- **This Week:** Events where `start_date <= endOfWeek AND (end_date >= today OR (end_date IS NULL AND start_date >= today))`, where endOfWeek is Sunday 23:59:59 of the current week
- **This Month:** Events where `start_date <= endOfMonth AND (end_date >= today OR (end_date IS NULL AND start_date >= today))`, where endOfMonth is the last day of the current calendar month

**Data:** The existing `MapView.tsx` data fetch (lines 33-72) already loads all venues and events in parallel. Filtering happens client-side on the loaded data — no additional queries needed.

**Error State:** If the selected time window has zero venues with events, the map shows no markers. No empty-state message needed — the map itself (basemap, neighborhood labels) is still visible.

**Scope Boundary:** The existing filter chips (tonight, under20, storefront, never) continue to work, but they operate on the time-filtered venue set. If "This Month" is selected and "storefront" filter is active, only storefront venues with events this month show markers.

### FR-3: Venue Count on Pills

**Trigger:** Same as FR-2 — computed alongside the filtering.

**Behavior:** Each pill shows the count of venues with events in that window, e.g. "TODAY (5)" / "THIS WEEK (18)" / "THIS MONTH (27)". Counts update whenever the underlying event data changes.

**Error State:** If count is 0, display "TODAY (0)" — do not hide the pill.

**Scope Boundary:** Counts reflect venue count, not event count.

### FR-4: Interaction with Existing Filter Chips

**Trigger:** User has a time pill selected AND toggles an existing filter chip.

**Behavior:** The time filter is applied first, reducing the venue set. Then existing filter chips (tonight, under20, storefront, never) dim non-matching venues within that set. The "tonight" filter chip becomes redundant when "Today" pill is selected — it should still work but won't further reduce the set since all displayed venues already have tonight events.

**Scope Boundary:** No changes to the existing `MapFilterChips` component or `isVenueDimmed()` logic. The time filter pills are upstream — they control which venues exist; filter chips control which are dimmed.

## 4. Architecture

### Prior Art

| Pattern | File | Lines | Reuse |
|---------|------|-------|-------|
| Filter chip styling | `src/components/MapFilterChips.tsx` | 31-56 | Match visual style exactly |
| Tonight detection | `src/lib/tonight.ts` | 23-42 | Reuse `isUpTonight()` for "Today" pill |
| Marker lifecycle | `src/components/MapView.tsx` | 143-144, 172 | Markers removed/recreated on filter change — add `timeFilter` to dependency array |
| Event data already loaded | `src/components/MapView.tsx` | 36-39 | Events fetched alongside venues — no new queries |

### New File

**`src/components/MapTimePills.tsx`** — Stateless pill row component

```typescript
interface Props {
  selected: 'today' | 'week' | 'month'
  onSelect: (filter: 'today' | 'week' | 'month') => void
  counts: { today: number; week: number; month: number }
}
```

### Modified Files

**`src/components/MapView.tsx`:**
1. Add `timeFilter` state: `useState<'today' | 'week' | 'month'>('week')`
2. Add `filterEventsByTime(events, timeFilter)` — returns events within window
3. Add `getVenueIdsWithEvents(filteredEvents)` — returns Set of venue IDs
4. In the marker creation loop (line 146), skip venues not in the Set
5. Add `timeFilter` to the useEffect dependency array (line 175)
6. Render `<MapTimePills>` above `<MapFilterChips>` in JSX (line 215)
7. Compute pill counts from the loaded events data

**`src/lib/tonight.ts`:**
Add two exported functions (no changes to existing `isUpTonight`):

```typescript
export function isThisWeek(event: Event): boolean
// Chicago timezone. Returns true if the event overlaps with today through end of current week (Sunday).

export function isThisMonth(event: Event): boolean  
// Chicago timezone. Returns true if the event overlaps with today through end of current calendar month.
```

Both follow the same date-range overlap logic as `isUpTonight` but with wider windows.

### No Database Changes

All filtering is client-side on already-loaded data.

## 5. QA Checklist

See `docs/qa/map-time-filter-pills.md`.

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Zero venues for "Today" on slow days | High | Low | Show "(0)" on pill, empty map is fine |
| Performance with 200+ venues | Low | Low | Client-side Set lookup is O(1) per venue |
| Existing filter chips confused by reduced venue set | Low | Medium | Time filter is upstream, chips work on filtered set |
