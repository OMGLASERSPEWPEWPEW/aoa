# Graph Engineering: Map Time Filter Pills

**Version:** 1.0
**Generated:** 2026-08-10
**Nodes:** 4 | **Phases:** 2 | **Loop specs:** 2

---

## Section 1: Task Graph Topology

### Nodes
```
LOGIC:  mtf-time-utils, mtf-pill-component
UI:     mtf-mapview-integration, mtf-verify
```

### Edges
```
mtf-time-utils → mtf-mapview-integration
mtf-pill-component → mtf-mapview-integration → mtf-verify
```

---

## Section 2: Node Specifications

#### Node: mtf-time-utils
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: (none)
- **Inputs**: `src/lib/tonight.ts` (existing `isUpTonight` pattern)
- **Outputs**: `src/lib/tonight.ts` (append `isThisWeek`, `isThisMonth`)
- **Loop pattern**: one-shot
- **Success criteria**: `npm run build` passes; existing `isUpTonight` unchanged; new functions exported
- **Estimated effort**: Trivial

**Implementation:**
```typescript
// Append to src/lib/tonight.ts

export function isThisWeek(event: { start_date: string | null; end_date: string | null }): boolean {
  // Get Chicago today and end-of-week (Sunday)
  // Return true if event date range overlaps [today, endOfWeek]
}

export function isThisMonth(event: { start_date: string | null; end_date: string | null }): boolean {
  // Get Chicago today and end-of-month
  // Return true if event date range overlaps [today, endOfMonth]
}
```

Both use the same Chicago timezone logic as `isUpTonight` (lines 5-8 of tonight.ts).

#### Node: mtf-pill-component
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: (none — can run parallel with mtf-time-utils)
- **Inputs**: `src/components/MapFilterChips.tsx` (styling reference)
- **Outputs**: `src/components/MapTimePills.tsx` (new file)
- **Loop pattern**: one-shot
- **Success criteria**: Component renders three pills; selected state toggles; counts displayed
- **Estimated effort**: Trivial

#### Node: mtf-mapview-integration
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: mtf-time-utils, mtf-pill-component
- **Inputs**: `src/components/MapView.tsx` (marker creation flow lines 33-175, JSX line 215)
- **Outputs**: `src/components/MapView.tsx` (modified)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Selecting "Today" shows only venues with tonight events; "This Week" is default; "This Month" shows broadest set; venues with zero events in window have no markers
- **Estimated effort**: Small

**Changes to MapView.tsx:**
1. Import `MapTimePills` and `isThisWeek`, `isThisMonth` from tonight.ts
2. Add state: `const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month'>('week')`
3. In the `useEffect` that creates markers (around line 140):
   - After loading events, filter by time window using the appropriate function
   - Build a `Set<string>` of venue IDs that have matching events
   - In the venue loop (line 146), skip venues not in the Set
4. Add `timeFilter` to the useEffect dependency array
5. Compute counts for all three windows from the full events array
6. Render `<MapTimePills>` above `<MapFilterChips>` in the JSX return

#### Node: mtf-verify
- **Type**: verification
- **Agent**: frontend-developer
- **Depends on**: mtf-mapview-integration
- **Inputs**: Running dev server
- **Outputs**: (none — verification only)
- **Loop pattern**: one-shot
- **Success criteria**: All QA checklist items pass in browser
- **Estimated effort**: Trivial

---

## Section 3: Loop Specifications

### Loop: mtf-mapview-integration
- **Trigger**: mtf-time-utils and mtf-pill-component both complete
- **Inner cycle**:
  1. Plan: Read MapView.tsx marker creation flow; identify where to insert time filter
  2. Execute: Add state, filtering logic, pill rendering, dependency array update
  3. Verify: `npm run build`; open map in browser; toggle pills; verify markers appear/disappear
- **Evaluator**: Selecting "Today" reduces markers to only tonight venues; "This Month" shows the most; counts match visible markers
- **Retry**: Fix filter logic if markers don't match expectations (max 2 cycles)
- **Stop condition**: All three pills produce correct marker sets

---

## Section 5: Build Phases

### Phase 1: Logic + Component (parallel)
- [ ] mtf-time-utils
- [ ] mtf-pill-component

### Phase 2: Integration + Verify (sequential)
- [ ] mtf-mapview-integration
- [ ] mtf-verify

---

## File Index

| File | Node | Action |
|------|------|--------|
| `src/lib/tonight.ts` | mtf-time-utils | Modify (append 2 functions) |
| `src/components/MapTimePills.tsx` | mtf-pill-component | Create |
| `src/components/MapView.tsx` | mtf-mapview-integration | Modify |
