# Graph Engineering: F70–F74 — Classes and Schools on the Map

**Date:** 2026-08-12
**Version:** 1.0
**Scope:** F70 (schema + migration), F71 (ClassMarker), F71b (ghost behavior), F72 (MapModeControl + MapModeFilters), F73 (ClassSheet), F74 (teacher → artist page links)

This document is the executable build specification for the classes-and-schools feature set. It defines the task graph (nodes, edges, shared state) and loop specifications that Claude Code agents execute to deliver the map's second layer.

**How to use this document:** Read Section 5 (Build Phases) to find the current phase. Read the node specs for each uncompleted node in that phase. Execute using `/implementation` with the loop spec. Mark nodes complete and update shared state as you go.

**Prerequisites:** MapView, MapMarker, VenueSheet, and MapKey already exist and ship. F34 (artist pages) does not need to be complete for F70–F73, but F74 blocks on it. Run F70–F73 first; stub teacher links in F73 and wire them when F34 lands.

---

## Section 1: Task Graph Topology

### Nodes

```
SCHEMA:    class-schema-migration
           class-schema-rls
           class-seed-migration

TYPES:     class-types

DATA:      class-data-hook

CONTROLS:  map-mode-control
           map-mode-filters

MARKERS:   class-marker
           ghost-behavior

KEY:       map-key-relocate

SHEETS:    level-pips
           class-sheet

WIRING:    mapview-mode-wiring
           teacher-artist-links
```

### Edges (→ = "must complete before")

```
class-schema-migration → class-schema-rls → class-seed-migration
class-schema-migration → class-types
class-types           → class-data-hook
class-data-hook       → class-marker
class-data-hook       → map-mode-control
class-data-hook       → class-sheet
map-mode-control      → map-mode-filters
map-mode-control      → mapview-mode-wiring
map-mode-filters      → mapview-mode-wiring
class-marker          → ghost-behavior
class-marker          → mapview-mode-wiring
ghost-behavior        → mapview-mode-wiring
map-key-relocate      → mapview-mode-wiring
level-pips            → class-sheet
class-sheet           → mapview-mode-wiring
mapview-mode-wiring   → teacher-artist-links
```

### ASCII DAG

```
Phase 1:  [class-schema-migration]
                    │
                    ├──────────────────────┐
                    ▼                      ▼
Phase 2:  [class-schema-rls]         [class-types]
                    │                      │
                    ▼                      ▼
          [class-seed-migration]   [class-data-hook]
                                          │
                    ┌─────────────────────┼──────────────────────┐
                    ▼                     ▼                      ▼
Phase 3:  [class-marker]       [map-mode-control]      [map-key-relocate]
                    │                     │
                    ▼                     ▼
          [ghost-behavior]    [map-mode-filters]
                    │                     │
                    └──────────┬──────────┘
                               │
Phase 4:                 [level-pips]
                               │
                               ▼
                         [class-sheet]
                               │
Phase 5:          [mapview-mode-wiring]   ← joins all Phase 3 + 4 outputs
                               │
Phase 6:      [teacher-artist-links]      ← depends on F34 artist pages
```

---

## Section 2: Node Specifications

### Phase 1 — Schema

#### Node: class-schema-migration
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: (existing core schema with `venues` and `events` tables)
- **Inputs**:
  - `docs/design/v4/design_handoff_house_record/CLASSES-AND-SCHOOLS.md` §5 (exact DDL)
  - `supabase/migrations/20260815000011_seed_class_venues.sql` (8 seeded school venue rows to migrate)
  - `supabase/migrations/20260815000010_class_fields.sql` (existing class columns on `events` that will be deprecated)
- **Outputs**:
  - `supabase/migrations/20260820000001_class_schema.sql` — creates `schools`, `class_sessions`, `class_teachers`, `class_interest` tables per spec DDL. Backfills `schools` from `venues` where `venue_type = 'school'` preserving `ll` geography from lat/lng. Backfills `class_sessions` from `events` where `event_type in ('class','workshop')` mapping `instructor_name` → `class_teachers`, `skill_level` → `level`, `session_count` → `weeks`.
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `schools` table exists with all columns: `id`, `name`, `short_name`, `slug`, `ll geography(point)`, `neighborhood`, `discipline`, `price_band`, `venue_id`, `financial_aid`, `payment_plan`, `sliding_scale`, `url`, `created_at`
  - `class_sessions` table exists with all columns including `drop_in`, `no_experience`, `audition_required`, `scraped_at`, `source_url`
  - `class_teachers` join table exists
  - `class_interest` table exists with status enum `watching|held|enrolled|took_it`
  - Index on `class_sessions(school_id, starts_on)` created
  - All 8 school venues have corresponding rows in `schools`
  - `discipline` check constraint enforces `improv|acting|writing|musical|devised|youth`
- **Estimated effort**: Medium
- **Design reference**: CLASSES-AND-SCHOOLS.md §5

#### Node: class-schema-rls
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: class-schema-migration
- **Inputs**:
  - `supabase/migrations/` (existing RLS patterns in core schema)
  - Anti-patterns: never query `auth.users` in RLS; use `auth.uid()` for current user
- **Outputs**:
  - `supabase/migrations/20260820000002_class_schema_rls.sql` — RLS policies for all four new tables
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `schools`: SELECT enabled for all (anon reads permitted — public data)
  - `class_sessions`: SELECT enabled for all; scraper write via service role only
  - `class_teachers`: SELECT enabled for all
  - `class_interest`: SELECT/INSERT/UPDATE scoped to `auth.uid() = user_id` only; users cannot see each other's interest rows
  - `supabase db push` succeeds with no RLS errors
  - Anon user can SELECT from `schools` and `class_sessions`
  - Authenticated user can INSERT their own `class_interest` row and cannot INSERT for another user
- **Estimated effort**: Small
- **Design reference**: `.claude/rules/anti-patterns.md`

#### Node: class-seed-migration
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: class-schema-rls
- **Inputs**:
  - `supabase/migrations/20260815000011_seed_class_venues.sql` (school names, slugs, coordinates)
  - `docs/design/v4/design_handoff_house_record/CLASSES-AND-SCHOOLS.md` §5 (discipline check constraint)
  - Discipline mapping: Second City/iO/Annoyance/CIS → `improv`; Acting Studio/Steppenwolf-Ed → `acting`; Piven → `acting`; Old Town School → `musical`
- **Outputs**:
  - `supabase/migrations/20260820000003_seed_schools.sql` — explicit INSERT rows for all 8 `schools` with correct `discipline`, `short_name` (≤14 chars), `price_band`, access flags, and `venue_id` FK where school shares a building with a venue
  - At least 2 seeded `class_sessions` per school (one enrolling, one between-sessions) so the map is non-empty on day one
- **Loop pattern**: one-shot
- **Success criteria**:
  - 8 `schools` rows with valid `discipline` values
  - `short_name` ≤ 14 chars on all rows (`SECOND CITY`, `iO`, `ANNOYANCE`, `BLACK BOX`, etc.)
  - At least 16 `class_sessions` rows total
  - At least one session has `starts_on` in the future (enrolling state)
  - At least one session has `starts_on` null or in the past (between-sessions state)
  - `supabase db push` succeeds; `select count(*) from schools` returns 8
- **Estimated effort**: Small
- **Design reference**: CLASSES-AND-SCHOOLS.md §5 scraper notes

---

### Phase 2 — Types and Data Hook

#### Node: class-types
- **Type**: types
- **Agent**: frontend-developer
- **Depends on**: class-schema-migration
- **Inputs**:
  - `src/lib/types.ts` (existing type definitions to extend)
  - `docs/design/v4/design_handoff_house_record/CLASSES-AND-SCHOOLS.md` §5 (schema)
- **Outputs**:
  - Additions to `src/lib/types.ts`:
    - `Discipline` type: `'improv' | 'acting' | 'writing' | 'musical' | 'devised' | 'youth'`
    - `MapMode` type: `'shows' | 'classes'`
    - `School` interface (mirrors schema: id, name, short_name, slug, ll, neighborhood, discipline, price_band, venue_id, financial_aid, payment_plan, sliding_scale, url)
    - `ClassSession` interface (mirrors schema including seats_total, seats_taken, drop_in, no_experience, audition_required, level, starts_on, scraped_at, source_url)
    - `ClassTeacher` interface (session_id, artist_id, credential)
    - `ClassInterest` interface (user_id, session_id, status)
    - `SchoolWithSessions` interface (School + nearest session join)
    - `ClassMapData` interface (schools, sessions, userInterests)
- **Loop pattern**: one-shot
- **Success criteria**:
  - `Discipline` type has exactly 6 members with no spelling deviations from the check constraint
  - `MapMode` is `'shows' | 'classes'`
  - `ClassSession.level` typed as `1 | 2 | 3 | 4 | 5` (not bare `number`)
  - `ClassSession.starts_on` typed as `string | null` (null = between sessions)
  - TypeScript compiles without errors: `npm run build` passes
- **Estimated effort**: Trivial
- **Design reference**: CLASSES-AND-SCHOOLS.md §5

#### Node: class-data-hook
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: class-types
- **Inputs**:
  - `src/lib/mapData.ts` (existing fetchMapData pattern)
  - `src/lib/types.ts` (new class types)
  - Supabase query: `schools` JOIN `class_sessions` (nearest session per school by `starts_on`)
- **Outputs**:
  - `src/lib/classData.ts` — `fetchClassMapData(userId)` that returns `ClassMapData`; queries `schools` with their next `class_sessions` row (ordered by `starts_on asc nulls last`); if authenticated, fetches user's `class_interest` rows
  - `src/hooks/useClassMap.ts` — TanStack Query hook wrapping `fetchClassMapData`, query key includes userId + last scrape timestamp; returns `{ schools, sessions, userInterests, isLoading }`
  - Helper: `isEnrolling(session: ClassSession): boolean` — returns true if `session.starts_on` is not null and is in the future; exported from `src/lib/classData.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `useClassMap()` returns the 8 seeded schools
  - Each school entry includes its nearest future session (or null if between sessions)
  - `isEnrolling(session)` returns true for future starts, false for null or past
  - A passed `starts_on` date is never surfaced — query filters `starts_on > now()` or returns null
  - TypeScript compiles without errors
  - No API key exposed in client bundle (direct Supabase anon key access is fine per stack rules)
- **Estimated effort**: Small
- **Design reference**: CLASSES-AND-SCHOOLS.md §5 (scraper notes), `.claude/rules/stack.md`

---

### Phase 3 — Markers, Controls, Key (parallel)

#### Node: class-marker
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: class-data-hook
- **Inputs**:
  - `src/components/MapMarker.tsx` (existing `createMarkerElement` — do NOT modify; ClassMarker is a separate factory function)
  - `docs/design/v4/design_handoff_house_record/CLASSES-AND-SCHOOLS.md` §2 (exact CSS spec)
  - `src/styles/tokens.css` (existing token values)
- **Outputs**:
  - `src/components/ClassMarker.ts` — `createClassMarkerElement(school, session | null, isSelected): HTMLDivElement`
  - The element structure must match the spec exactly:
    ```
    .cm   position:relative; width:56px; height:56px; display:flex; flex-direction:column; align-items:center
    .ring 38px × 38px circle; background:#0c0a05; border:2px solid var(--dc)
          font-size:16px; color:var(--dc)
          box-shadow: 0 3px 10px rgba(0,0,0,.85), 0 0 15px -4px var(--dc)
    .lab  Courier Prime 8px; letter-spacing:.06em; color:var(--dc)
          background:rgba(12,10,5,.9); border:1px solid #2b2720; padding:1px 5px; radius:2px
    .soon JetBrains Mono 8px; color:#0c0a05 on var(--dc); radius:2px; padding:1px 3px
          position:absolute; right:6px; top:-3px
    ```
  - `--dc` values set inline per discipline:
    - `improv`: `oklch(.80 .16 110)`
    - `acting`: `oklch(.64 .19 20)`
    - `writing`: `oklch(.68 .13 235)`
    - `musical`: `oklch(.68 .18 330)`
    - `devised`: `oklch(.72 .14 165)`
    - `youth`: `oklch(.78 .15 65)`
  - Discipline glyphs: `◍` (improv), `▭` (acting), `✎` (writing), and placeholders for musical/devised/youth until spec adds them
  - Enrolling state: solid ring in `--dc`, glyph in `--dc`, label in `--dc`, `.soon` badge with formatted start date (e.g. `SEP 8`)
  - Between-sessions state: dashed `#4f4a3e` ring, `#625b4c` glyph and label, no badge, no glow (`box-shadow` drops the glow term)
  - Selected state: `transform:scale(1.16)`, `box-shadow:0 0 0 5px color-mix(in srgb, var(--dc) 18%, transparent), 0 4px 12px rgba(0,0,0,.8)` — note `in srgb` not `in oklch` to prevent transparent hue collapse
  - Filtered-out state: `opacity:.22` on the outer `.cm` div
  - Icon anchor export: `[28, 44]`, icon size: `[56, 56]`
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - Each of the 6 disciplines renders a visually distinct circle with the correct oklch color (verified by Mapbox rendering in browser or headless screenshot)
  - No discipline color collides with `oklch(.80 .14 55)` (gold) — improv is at hue 110, gold is at hue 55, ≥50 hue apart
  - Enrolling marker shows the `.soon` date badge at `right:6px; top:-3px`
  - Between-sessions marker has dashed ring `#4f4a3e`, no glow, no badge
  - Selected marker has 5px halo using `color-mix(in srgb, ...)` not `in oklch`
  - Filtered marker at `opacity:.22`
  - Short school label always present and tinted to discipline color
  - TypeScript compiles without errors
- **Estimated effort**: Medium
- **Design reference**: CLASSES-AND-SCHOOLS.md §2

#### Node: ghost-behavior
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: class-marker
- **Inputs**:
  - `src/components/MapMarker.tsx` (existing `.vm` chip structure to understand what classes to add)
  - `src/components/ClassMarker.ts` (new `.cm` ring structure)
  - `docs/design/v4/design_handoff_house_record/CLASSES-AND-SCHOOLS.md` §2.1 (exact ghost CSS)
- **Outputs**:
  - CSS classes added to `src/styles/map-ghost.css` (new file, imported by MapView):
    ```css
    /* Show markers ghosted in classes mode */
    .vm.ghost { opacity: .5; pointer-events: none; transform: scale(.82) }
    .vm.ghost .chip { background: #0f0d08; border-color: #332e26; pointer-events: auto }
    .vm.ghost .chip-glyph { color: #4a453a }
    .vm.ghost .dot-live,
    .vm.ghost .dot-seen { display: none }

    /* Class markers ghosted in shows mode */
    .cm.ghost { opacity: .42; pointer-events: none }
    .cm.ghost .ring {
      width: 24px; height: 24px;
      border-color: #332e26;
      background: #4a453a;
      box-shadow: none;
      pointer-events: auto
    }
    .cm.ghost .lab,
    .cm.ghost .soon { display: none }
    ```
  - `createMarkerElement` in `MapMarker.tsx` updated to add CSS class names `vm` to the outer div and `chip` to the chip div (so ghost CSS can target them)
  - `createClassMarkerElement` in `ClassMarker.ts` adds CSS class names `cm` to the outer div and `ring` to the ring div
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - In shows mode: class markers render at `opacity:.42` with `ring` shrunk to 24px, no label, no badge; still tappable on the ring only
  - In classes mode: show markers render at `opacity:.5` with chip forced to `#0f0d08` bg and `#332e26` border; live dot hidden; still tappable on chip only
  - Tapping a ghosted class marker's ring (in shows mode) does not open the class sheet — it opens nothing (pointer-events:none on outer, auto on ring but ring click behavior is disabled in shows mode via JS gate)
  - Tapping a ghosted show marker's chip (in classes mode) does not open the venue sheet — same JS gate
  - Invisible padding outside the drawn shape does NOT capture taps (the 56×56 box shrinks via pointer-events pattern, not positional hack)
  - `npm run build` succeeds
- **Estimated effort**: Small
- **Design reference**: CLASSES-AND-SCHOOLS.md §2.1

#### Node: map-mode-control
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: class-data-hook
- **Inputs**:
  - `src/components/MapFilterChips.tsx` (old component being replaced — read for positioning context, then DELETE the file)
  - `docs/design/v4/design_handoff_house_record/CLASSES-AND-SCHOOLS.md` §3 (exact segmented pill spec)
  - `src/styles/tokens.css` (token values for `--rule`, `--bg`)
- **Outputs**:
  - `src/components/MapModeControl.tsx` — segmented pill component
    - Props: `mode: MapMode`, `onModeChange: (mode: MapMode) => void`, `showCount: number`, `classCount: number`
    - Visual spec:
      ```
      background: rgba(12,10,5,.92)
      border: 1px solid var(--rule)  (dark: #2b2720)
      border-radius: 3px
      padding: 2px
      backdrop-filter: blur(6px)
      display: inline-flex
      ```
    - Each segment: Courier Prime 10px, `letter-spacing:.1em`, padding `7px 13px`
    - Count in JetBrains Mono, same line as label
    - Active SHOWS segment: background `oklch(.80 .14 55)` (gold), color `#0c0a05`
    - Active CLASSES segment: background `oklch(.80 .16 110)` (chartreuse), color `#0c0a05`
    - Inactive segment: background transparent, color `var(--ink-dim)`
    - Touch target: each segment ≥ 44px tall (padding `7px 13px` on 10px font = ~24px — add `min-height:44px` to meet target)
  - DELETE `src/components/MapFilterChips.tsx`
  - DELETE `src/components/MapTimePills.tsx`
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - SHOWS segment fills gold when active, chartreuse when CLASSES is active (inactive)
  - CLASSES segment fills chartreuse when active, no fill when SHOWS is active
  - Live counts update to reflect filtered marker totals (14 venues in shows, 6 schools in classes — exact numbers from seed data)
  - Each segment ≥ 44px touch target
  - No horizontal scroll — both segments visible on 390px viewport
  - `MapFilterChips.tsx` and `MapTimePills.tsx` are deleted from the filesystem
  - TypeScript compiles without errors (no remaining imports of deleted files)
- **Estimated effort**: Small
- **Design reference**: CLASSES-AND-SCHOOLS.md §3

#### Node: map-mode-filters
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: map-mode-control
- **Inputs**:
  - `docs/design/v4/design_handoff_house_record/CLASSES-AND-SCHOOLS.md` §3 (three chips per mode)
  - `src/components/MapModeControl.tsx` (positioning context — filters live below mode control)
- **Outputs**:
  - `src/components/MapModeFilters.tsx` — contextual filter chips component
    - Props: `mode: MapMode`, `activeFilters: Set<string>`, `onToggle: (key: string) => void`, `counts: Record<string, number>`
    - Shows mode chips: `TONIGHT`, `UNDER $20`, `NEVER BEEN`
    - Classes mode chips: `ENROLLING`, `DROP-IN`, `NO EXPERIENCE`
    - Chip style: Courier Prime 9.5px, `letter-spacing:.08em`, padding `6px 10px`, radius 3px
    - Active chip: border `1px solid` active-mode accent (gold for shows, chartreuse for classes), bg tint
    - Inactive chip: `1px solid var(--rule)`, color `var(--ink-dim)`, `backdrop-filter:blur(6px)`
    - Mode switch does NOT reset filter state — chips keep state per mode (two independent `Set<string>` states)
    - No `USHER SLOTS` chip. No `STOREFRONT` chip. These are permanently removed.
    - All three chips must be visible simultaneously on 390px with no scroll
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - Switching to shows mode shows exactly: TONIGHT, UNDER $20, NEVER BEEN
  - Switching to classes mode shows exactly: ENROLLING, DROP-IN, NO EXPERIENCE
  - No horizontal scroll on 390px viewport (Chrome DevTools device emulation)
  - Active chips in shows mode use gold accent; active chips in classes mode use chartreuse (`oklch(.80 .16 110)`)
  - USHER SLOTS and STOREFRONT chips do not exist anywhere in the rendered output
  - Filter state persists independently per mode — activating TONIGHT in shows, switching to classes, switching back still shows TONIGHT active
  - TypeScript compiles without errors
- **Estimated effort**: Small
- **Design reference**: CLASSES-AND-SCHOOLS.md §3

#### Node: map-key-relocate
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: (existing MapKey.tsx)
- **Inputs**:
  - `src/components/MapKey.tsx` (current implementation at `bottom:10px; left:10px`)
  - `docs/design/v4/design_handoff_house_record/CLASSES-AND-SCHOOLS.md` §3 (key relocation spec)
  - `src/lib/types.ts` (`MapMode` type needed for content swap)
- **Outputs**:
  - `src/components/MapKey.tsx` — rewritten in-place (same file path)
    - Position: `right:14px; top:92px; z-index:1200` (above the sheet's `z-index:1100`)
    - Trigger pill: `THE KEY −` (open) / `THE KEY +` (closed)
    - Pill style: Courier Prime 9.5px, `background:rgba(12,10,5,.92)`, `border:1px solid var(--rule)`, radius 3px, `backdrop-filter:blur(6px)`
    - Open by default on mount
    - Auto-collapse to pill when any marker is selected (parent passes `isMarkerSelected` prop)
    - Content swaps with mode:
      - **Shows mode key**: `● you have tickets · ◌ want to see · ● been — your colour · □ curtain up tonight · ○ schools, dimmed`
      - **Classes mode key**: `◍ improv · ▭ acting · ✎ writing · ● enrolling · ◌ between sessions · □ theaters, dimmed`
    - Glyphs in key must use the same Unicode codepoints as the markers: `◍` U+25CD, `▭` U+25AD, `✎` U+270E
    - Props: `mode: MapMode`, `isMarkerSelected: boolean`
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - Key positioned at `right:14px; top:92px` — NOT bottom-anchored
  - Z-index 1200 — renders above VenueSheet (`z-index:1100`) and class sheet
  - Collapses to pill when a marker is selected; expands when no marker selected
  - Content differs between shows and classes mode
  - Legend includes `○ schools, dimmed` in shows mode and `□ theaters, dimmed` in classes mode
  - Glyph codepoints match: `◍` U+25CD, `▭` U+25AD, `✎` U+270E — verify with browser devtools character inspector
  - Key never occludes sheet content
  - `npm run build` succeeds
- **Estimated effort**: Small
- **Design reference**: CLASSES-AND-SCHOOLS.md §3

---

### Phase 4 — Sheet Components (parallel with late Phase 3)

#### Node: level-pips
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: class-types
- **Inputs**:
  - `docs/design/v4/design_handoff_house_record/CLASSES-AND-SCHOOLS.md` §4 (WHERE IT STARTS spec)
  - `src/styles/tokens.css` (`--rule` token for empty pip)
- **Outputs**:
  - `src/components/LevelPips.tsx` — pure presentational component
    - Props: `level: 1 | 2 | 3 | 4 | 5`, `disciplineColor: string` (the `--dc` value as a CSS string)
    - Renders 5 pips in a horizontal row
    - Filled pip (index < level): `16px × 4px`, `border-radius:2px`, background = `disciplineColor`
    - Empty pip (index >= level): `10px × 4px`, `border-radius:2px`, background = `var(--rule)`
    - Gap between pips: 3px
    - No number, no label, no "beginner/intermediate/advanced" text — the pips speak for themselves
    - `aria-label` on the container: `"Level ${level} of 5"`
- **Loop pattern**: one-shot
- **Success criteria**:
  - Level 1: one 16×4 filled pip, four 10×4 empty pips
  - Level 3: three 16×4 filled pips, two 10×4 empty pips
  - Level 5: five 16×4 filled pips, no empty pips
  - Filled pips use the passed `disciplineColor`, not a hardcoded value
  - Empty pips use `var(--rule)`, not hardcoded
  - No numeric label, no text label
  - Touch target: the row itself is display-only; no interaction needed
  - TypeScript compiles without errors
- **Estimated effort**: Trivial
- **Design reference**: CLASSES-AND-SCHOOLS.md §4 (WHERE IT STARTS)

#### Node: class-sheet
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: level-pips, class-data-hook
- **Inputs**:
  - `docs/design/v4/design_handoff_house_record/CLASSES-AND-SCHOOLS.md` §4 (full class sheet spec including grab row, header, next session panel, tags, actions, WHO TEACHES IT, ALSO NEARBY)
  - `src/components/LevelPips.tsx`
  - `src/components/VenueSheet.tsx` (reference for bottom sheet anchor geometry: `bottom:79px`, radius `16px 16px 0 0`)
  - `src/lib/types.ts` (School, ClassSession, ClassTeacher types)
- **Outputs**:
  - `src/components/ClassSheet.tsx` — bottom sheet for class detail
    - Geometry mirrors VenueSheet: anchored `bottom:79px` above tab bar, `border-radius:16px 16px 0 0`, z-index `1100`
    - **Grab row**: `height:24px` (explicit — prevents collapse to ~13px that would bleed attribution into title). Grab handle: 4px pill centered. OSM attribution: `position:absolute; right:14px; top:6px; font-size:8px; Courier Prime; color:var(--ink-whisper)` — it lives in the grab row, not elsewhere.
    - **Peek line** (collapsed state): `"N classes taking people right now"` / `TAP A SCHOOL · N NEED NO EXPERIENCE · N DROP-IN`
    - **Header**: 88×66 hatched studio placeholder labeled `THE ROOM` (photo_url when available), then school name in Newsreader italic 21px, then `HOOD · DISCIPLINE · PRICE_BAND` in Courier Prime, then user history in Courier Prime 10px `var(--ink-ghost)`: `NEVER TAKEN A CLASS HERE` / `YOU SAW THE HAROLD NIGHT · JUN 12` (show venue connection when `school.venue_id` matches a visited venue) / `NEVER BEEN — GOOD FIRST ONE`
    - **Next session panel**: border is `--dc` when enrolling, `#4a453a` when between sessions; `background:var(--bg-card)`
      - Label: `NEXT SESSION` in `--dc` when enrolling; `BETWEEN SESSIONS` in `var(--ink-faint)` when not
      - Seats right: `12 OF 16 TAKEN` / `WALK-INS WELCOME` / `WAITLIST OPEN`
      - Class title in Newsreader italic 19px
      - Schedule: `Tue 7–10pm · 8 weeks · from Sep 8` in 14px `var(--ink-dim)`
      - `WHERE IT STARTS` label + `<LevelPips level={session.level} disciplineColor={dc} />`
    - **Tags**: first chip filled in `--dc` = access fact (`NO EXPERIENCE NEEDED` / `DROP-IN · $15` / `AUDITION REQUIRED`). Then outline chips: `PAYMENT PLAN`, `FINANCIAL AID`, `SLIDING SCALE`, price. Price is never hidden.
    - **Actions**: primary button filled in `--dc` (ivory when between sessions). Label: `Hold a spot` / `Just show up` (drop-in) / `Join the waitlist` (between sessions). Then `TELL ME MORE` outline. Then 56px `↗` directions button. All ≥ 44px touch targets.
    - **WHO TEACHES IT**: 44px circular headshots (placeholder circles if no photo), name Newsreader italic 13px, credential Courier Prime 8px. Teacher names are plain text for now — F74 wires artist page links.
    - **ALSO NEARBY**: two nearest schools by coordinates, each a row: start date in ivory if enrolling / `LATER` if not; class title italic; school short name right-aligned. Tappable rows ≥ 44px.
    - **Footer**: `LISTINGS UPDATED {date}` rendered when `scraped_at` is older than 7 days
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - Grab row has explicit `height:24px` in the CSS; OSM attribution never overlaps school name
  - Next session panel border changes color correctly: `--dc` enrolling, `#4a453a` between sessions
  - `WHERE IT STARTS` renders `LevelPips`, no numeric or text level label anywhere
  - Price is always visible above the fold
  - Access fact chip (first chip) is always filled in `--dc` above the fold
  - Between-sessions state shows `Join the waitlist` button, not a dead-end empty state
  - ALSO NEARBY shows two schools (not the current school)
  - All action buttons ≥ 44px touch target
  - Sheet opens when a school marker is tapped; closes on backdrop tap or drag-down gesture
  - `npm run build` succeeds with no TypeScript errors
- **Estimated effort**: Large
- **Design reference**: CLASSES-AND-SCHOOLS.md §4 and §4.1

---

### Phase 5 — Map Wiring

#### Node: mapview-mode-wiring
- **Type**: integration
- **Agent**: frontend-developer
- **Depends on**: class-marker, ghost-behavior, map-mode-control, map-mode-filters, map-key-relocate, class-sheet
- **Inputs**:
  - `src/components/MapView.tsx` (current implementation — significant modification)
  - `src/hooks/useClassMap.ts`
  - `src/components/MapModeControl.tsx`
  - `src/components/MapModeFilters.tsx`
  - `src/components/ClassMarker.ts`
  - `src/components/ClassSheet.tsx`
  - `src/components/MapKey.tsx` (relocated version)
  - `src/styles/map-ghost.css`
  - `docs/design/v4/design_handoff_house_record/CLASSES-AND-SCHOOLS.md` §2.1 (dual-layer always-on behavior)
- **Outputs**:
  - `src/components/MapView.tsx` — modified to add:
    - `mode` state: `const [mode, setMode] = useState<MapMode>('shows')`
    - `showFilters` state: `const [showFilters, setShowFilters] = useState<Set<string>>(new Set())`
    - `classFilters` state: `const [classFilters, setClassFilters] = useState<Set<string>>(new Set())`
    - `selectedSchool` state alongside existing `selectedVenue`
    - `useClassMap()` call to fetch school + session data
    - BOTH marker layers rendered simultaneously — venue markers AND class markers always on the map
    - Ghost class name applied conditionally: show markers get `.ghost` class in classes mode; class markers get `.ghost` class in shows mode
    - JS gate on ghost clicks: `onClick` on ghosted markers is a no-op (does not open sheet)
    - Mode control positioned at `top:8px; left:50%; transform:translateX(-50%); z-index:1050`
    - Mode filters positioned below mode control at `top:60px`
    - Show marker count and class marker count passed to `MapModeControl` as live counts (counts of non-ghost markers)
    - MapKey receives `mode` and `isMarkerSelected={selectedVenue !== null || selectedSchool !== null}`
    - Remove `<MapTimePills />` and `<MapFilterChips />` (deleted files, remove imports)
    - Shows filter `isVenueDimmed` updated: remove `storefront` and `classes` filter keys; add only `tonight`, `under20`, `never`
    - Classes filter `isSchoolDimmed`: true when `classFilters.has('enrolling')` and school has no enrolling session; true when `classFilters.has('drop_in')` and no drop-in session; true when `classFilters.has('no_experience')` and no no-experience session
    - Masthead qualifier: when mode is classes, append `· classes` to the masthead count (this is a prop or context update — coordinate with Tonight.tsx if needed)
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - Both show markers and class markers are simultaneously visible on the map
  - In shows mode: class markers are ghost (opacity:.42, ring shrunk to 24px, no label, no badge)
  - In classes mode: show markers are ghost (opacity:.5, chip color forced, live dots hidden)
  - Tapping a ghost show marker in classes mode does NOT open VenueSheet
  - Tapping a ghost class marker in shows mode does NOT open ClassSheet
  - Tapping an active class marker in classes mode opens ClassSheet for that school
  - Mode control switch is instant — no full remount, no map flash
  - Show filter chips (TONIGHT, UNDER $20, NEVER BEEN) correctly dim show markers only
  - Class filter chips (ENROLLING, DROP-IN, NO EXPERIENCE) correctly dim class markers only
  - MapKey at `right:14px; top:92px` is always visible, never covered by sheet
  - `MapTimePills` and `MapFilterChips` imports are gone
  - `npm run build` succeeds; no TypeScript errors; no console errors in browser
- **Estimated effort**: Large
- **Design reference**: CLASSES-AND-SCHOOLS.md §2.1, §3

---

### Phase 6 — Artist Links

#### Node: teacher-artist-links
- **Type**: integration
- **Agent**: frontend-developer
- **Depends on**: mapview-mode-wiring, F34 artist pages (external prerequisite)
- **Inputs**:
  - `src/components/ClassSheet.tsx` (WHO TEACHES IT section — teacher names currently plain text)
  - F34 artist pages (route: `/app/artist/:slug` or equivalent)
  - `src/lib/types.ts` (`ClassTeacher` interface with `artist_id`)
- **Outputs**:
  - `src/components/ClassSheet.tsx` — teacher names in WHO TEACHES IT become tappable links to artist pages
  - `src/lib/classData.ts` — `fetchClassMapData` extended to JOIN `class_teachers` with enough artist data (artist slug, name, photo_url) for the sheet to render teacher rows
  - `class_interest.status = 'took_it'` write when user marks a class as taken — this feeds Your run (F55)
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - Tapping a teacher name navigates to their artist page
  - If `artist_id` is null (teacher not yet linked to an artist record), name renders as plain text — no broken link
  - `took_it` status is writable via the class sheet action
  - F34 route resolves correctly from inside the map sheet (no navigation stack conflict)
  - TypeScript compiles without errors
- **Estimated effort**: Small
- **Design reference**: CLASSES-AND-SCHOOLS.md §4 (WHO TEACHES IT), §5 (class_interest.status)
- **Note**: This node is blocked until F34 ships. Wire the stub (plain-text teacher names) in class-sheet; replace with links here.

---

## Section 3: Loop Specifications

### Loop: class-schema-migration
- **Trigger**: implementation session starts
- **Inner cycle**:
  1. Discover: read CLASSES-AND-SCHOOLS.md §5 DDL; read existing migrations for table naming patterns; read seed_class_venues.sql for the 8 school venue rows to backfill
  2. Plan: write migration that creates 4 new tables; write backfill INSERT...SELECT from venues where venue_type='school'; write backfill for class_sessions from events where event_type in ('class','workshop')
  3. Execute: write `20260820000001_class_schema.sql`; run `supabase db push`
  4. Verify: `select count(*) from schools` returns 8; `select count(*) from class_sessions` > 0; `\d schools` matches spec schema; `\d class_sessions` matches spec
- **Evaluator**: all 4 tables exist with correct columns; backfill counts match source rows; index on `(school_id, starts_on)` exists
- **Retry**: on failure → read migration error output → fix DDL → re-push (max 3 cycles)
- **Stop condition**: all tables exist, RLS will be added in next node

### Loop: class-schema-rls
- **Trigger**: class-schema-migration complete
- **Inner cycle**:
  1. Discover: read existing RLS policies in core schema migrations for pattern; read anti-patterns.md (never query auth.users)
  2. Plan: `schools` and `class_sessions` public read; `class_interest` user-scoped read/write
  3. Execute: write `20260820000002_class_schema_rls.sql`; run `supabase db push`
  4. Verify: anon `select * from schools` succeeds; authenticated user can insert own `class_interest` row; authenticated user CANNOT insert another user's `class_interest` row (test with different user JWT or mock)
- **Evaluator**: anon reads work; user-scoped writes work; cross-user writes rejected
- **Retry**: on failure → read RLS error → fix policy → re-push (max 3 cycles)
- **Stop condition**: all RLS policies in place and verified

### Loop: class-data-hook
- **Trigger**: class-types complete
- **Inner cycle**:
  1. Discover: read `src/lib/mapData.ts` and `src/lib/queries.ts` for existing fetch patterns; understand TanStack Query key structure in `src/lib/queryKeys.ts`
  2. Plan: `fetchClassMapData` queries schools JOIN class_sessions (one per school, nearest future), plus user interests if authenticated
  3. Execute: write `src/lib/classData.ts`; write `src/hooks/useClassMap.ts`
  4. Verify: start dev server; verify hook returns 8 schools; verify `isEnrolling()` returns correct values for future vs null/past start dates; verify no stale past dates in the session data
- **Evaluator**: 8 schools returned; correct enrolling/between-sessions classification; TypeScript passes
- **Retry**: on failure → check Supabase query syntax, geography column handling, date comparison → fix (max 3 cycles)
- **Stop condition**: hook returns correct data; TypeScript compiles

### Loop: class-marker
- **Trigger**: class-data-hook complete
- **Inner cycle**:
  1. Discover: read MapMarker.tsx createMarkerElement for structural reference; read spec §2 for exact CSS values
  2. Plan: ClassMarker factory function; discipline color map; glyph map; enrolling/between-sessions/selected/filtered-out state logic
  3. Execute: write `src/components/ClassMarker.ts`
  4. Verify: add temporary ClassMarker instances to MapView; visually verify in browser at 390px width — each discipline color correct; between-sessions = dashed ring, no badge, no glow; enrolling = solid ring, badge, glow; selected = scaled up with `color-mix(in srgb, ...)` halo
- **Evaluator**: all 6 disciplines render correct oklch color; no color collision with gold; all states visually distinct; TypeScript compiles
- **Retry**: on failure → check oklch support in browser, CSS variable scoping, `color-mix` transparent handling → fix (max 3 cycles)
- **Stop condition**: all discipline markers correct; all states verified; no gold collision

### Loop: ghost-behavior
- **Trigger**: class-marker complete
- **Inner cycle**:
  1. Discover: read MapMarker.tsx to identify existing CSS class names (or add them); read spec §2.1 for exact ghost values
  2. Plan: add `.vm` and `.chip` class names to show markers; add `.cm` and `.ring` class names to class markers; write ghost CSS; verify pointer-events rules
  3. Execute: modify MapMarker.tsx and ClassMarker.ts to add class names; write `src/styles/map-ghost.css`; import in MapView
  4. Verify: toggle mode in dev; visually confirm ghost states; tap a ghosted marker — no sheet should open; inspect DevTools to confirm pointer-events on invisible padding is `none`
- **Evaluator**: ghost opacity, color, size correct; tapping ghosted markers produces no sheet; DevTools confirms pointer-events
- **Retry**: on failure → check CSS specificity, class name conflicts, Mapbox divIcon class inheritance → fix (max 3 cycles)
- **Stop condition**: both ghost states work; no phantom taps

### Loop: mapview-mode-wiring
- **Trigger**: class-marker, ghost-behavior, map-mode-control, map-mode-filters, map-key-relocate, class-sheet all complete
- **Inner cycle**:
  1. Discover: read current MapView.tsx fully; list all state variables, effects, and render output to plan changes
  2. Plan: minimal-diff strategy — add mode state, add classMarkers render loop, add ghost class toggling, replace old filter/time components with new, update key props
  3. Execute: modify MapView.tsx; remove deleted imports; add useClassMap; add ClassSheet conditional render
  4. Verify: shows mode → class markers ghost; classes mode → show markers ghost; filter chips correct per mode; key at top-right; tapping markers opens correct sheet; tapping ghosted markers does nothing; `npm run build` passes; no console errors
- **Evaluator**: dual-layer render works; ghost behavior correct; filter chips mode-contextual; sheets open correctly; build passes
- **Retry**: on failure → isolate by feature (ghost alone, then filters, then sheets) → fix in layers (max 3 cycles per layer)
- **Stop condition**: full F70–F73 acceptance criteria pass in browser at 390px

---

## Section 4: Shared State Schema

State that flows between nodes in this graph. Track manually or via shared state file during execution.

| Key | Type | Set by | Consumed by |
|-----|------|--------|-------------|
| `schema_migrated` | boolean | class-schema-migration | class-schema-rls, class-seed-migration, class-types |
| `rls_applied` | boolean | class-schema-rls | class-seed-migration |
| `schools_seeded` | boolean | class-seed-migration | class-data-hook (verifies non-empty data) |
| `discipline_colors` | `Record<Discipline, string>` | class-types (constant) | class-marker, class-sheet, level-pips, map-key-relocate |
| `discipline_glyphs` | `Record<Discipline, string>` | class-types (constant) | class-marker, map-key-relocate (key glyphs must match) |
| `mode_state` | `'shows' \| 'classes'` | mapview-mode-wiring (runtime) | map-mode-control, map-mode-filters, map-key-relocate, ghost-behavior |
| `selected_school` | `School \| null` | mapview-mode-wiring (runtime) | class-sheet, map-key-relocate (auto-collapse) |
| `class_data_loaded` | boolean | class-data-hook | class-marker, class-sheet, mapview-mode-wiring |
| `ghost_css_applied` | boolean | ghost-behavior | mapview-mode-wiring |
| `old_filter_deleted` | boolean | map-mode-control (deletes MapFilterChips + MapTimePills) | mapview-mode-wiring (no stale imports) |
| `artist_pages_shipped` | boolean | F34 (external) | teacher-artist-links |

---

## Section 5: Build Phases (Topological Sort)

Nodes within a phase may fan out in parallel using `/implementation` worktrees. All nodes in a phase must pass their success criteria before advancing to the next phase.

### Phase 1: Schema (sequential — migrations must be ordered)

```
[ class-schema-migration ] → [ class-schema-rls ] → [ class-seed-migration ]
```

No UI work until schema is pushed. Run `supabase db push` after each migration file.

**Quality gate**: `select count(*) from schools` = 8; `select count(*) from class_sessions` >= 16; all RLS policies in place; anon SELECT works.

---

### Phase 2: Types and Data (sequential — types before hook)

```
[ class-types ] → [ class-data-hook ]
```

Can start Phase 2 in parallel with Phase 1 after class-schema-migration completes (types can be written from the spec DDL alone; hook needs the real tables for verify step).

**Quality gate**: TypeScript compiles; `useClassMap()` returns 8 schools with correct session data in dev browser.

---

### Phase 3: Parallel Fan-out (all three tracks independent)

```
Track A: [ class-marker ] → [ ghost-behavior ]
Track B: [ map-mode-control ] → [ map-mode-filters ]
Track C: [ map-key-relocate ]
```

All three tracks depend only on Phase 2 completion (class-data-hook for Track A and B; no data dependency for Track C). Fan out in separate worktrees or sequential sessions.

**Quality gate (Track A)**: ClassMarker renders correctly for all 6 disciplines; enrolling/between-sessions/selected states correct; no gold collision.

**Quality gate (Track B)**: MapModeControl renders both segments with correct active colors; MapModeFilters shows 3 chips per mode; no horizontal scroll; old files deleted.

**Quality gate (Track C)**: MapKey at `right:14px; top:92px`; collapses on marker select; content swaps with mode prop; glyph codepoints verified.

---

### Phase 4: Sheet Components (parallel with late Phase 3)

```
[ level-pips ] → [ class-sheet ]
```

LevelPips has no external dependencies beyond class-types. ClassSheet depends on LevelPips.

Can start level-pips immediately after Phase 2 completes. ClassSheet can start immediately after level-pips.

**Quality gate**: level-pips renders correct filled/empty pip counts; class-sheet opens from marker tap; all spec sections present; grab row `height:24px`; price above fold; between-sessions shows waitlist not dead end.

---

### Phase 5: Map Wiring (joins all Phase 3 + 4 outputs)

```
[ mapview-mode-wiring ]
```

This is the integration node. All Phase 3 and Phase 4 nodes must be complete and verified before this node begins. Do not attempt wiring until all upstream nodes pass their quality gates — partial wiring creates hard-to-debug state.

**Quality gate (full F70–F73 acceptance)**:
- [ ] Mode control switches marker layers; three filters per mode; no horizontal scroll
- [ ] `USHER SLOTS` and `STOREFRONT` filters are gone from the DOM
- [ ] Class markers are discipline-coloured circles, larger than show markers, always labelled
- [ ] Enrolling sessions show next start date on marker; between-sessions schools are colourless
- [ ] Mode changes emphasis, not visibility — other layer ghosts to neutral, stays on map, stays tappable
- [ ] Ghost marker hit box is only the drawn shape — tapping ghosted theater never opens class sheet
- [ ] No discipline hue collides with gold
- [ ] Filtered-out markers dim to `.22` in the active layer; nothing removed
- [ ] Legend and masthead qualifier swap with mode
- [ ] Key reachable in every state — pill top-right above the sheet, never bottom-anchored
- [ ] Key glyphs are same codepoints as markers (`◍` U+25CD, `▭` U+25AD, `✎` U+270E)
- [ ] Every class sheet shows price and access fact above the fold
- [ ] `© OpenStreetMap contributors` visible in both modes, never overlapping a sheet title

---

### Phase 6: Artist Links (blocked on F34)

```
[ teacher-artist-links ]
```

Do not block F70–F73 deployment on this node. Ship Phase 5 as a complete feature. Return to this node after F34 (artist pages) ships.

**Quality gate**: teacher names in WHO TEACHES IT navigate to correct artist pages; `took_it` status writable; plain-text fallback when artist_id is null.

---

## Section 6: Execution Guide

### How to Run with /implementation

1. Start with Phase 1 — run class-schema-migration, verify, then class-schema-rls, verify, then class-seed-migration, verify. These are sequential and cannot be parallelized.

2. Run Phase 2 in the same session or a new one immediately after Phase 1 gate passes.

3. Phase 3 is the primary fan-out opportunity. Open three worktrees:
   - Worktree A: `git worktree add ../aoa-class-marker -b feat/class-marker` → implement Track A
   - Worktree B: `git worktree add ../aoa-mode-control -b feat/mode-control` → implement Track B
   - Worktree C: `git worktree add ../aoa-map-key -b feat/map-key` → implement Track C
   - Merge all three branches before beginning Phase 5

4. Phase 4 (level-pips → class-sheet) can run concurrently with Phase 3 if bandwidth allows.

5. Phase 5 (mapview-mode-wiring) must be the last integration step. Read the current state of all modified files before writing MapView.tsx — do not overwrite based on the state at the start of the session.

### Parallel Fan-out Rules

- Nodes in the same phase with no shared output files may run in parallel worktrees.
- Nodes that touch the same file (MapView.tsx) must run sequentially — map-mode-control deletes old imports; mapview-mode-wiring rewrites the file.
- The class-marker and map-mode-control nodes both depend on class-data-hook but do not touch shared output files — they can run in parallel.
- ghost-behavior touches MapMarker.tsx (to add CSS class names) AND creates map-ghost.css. If class-marker is being built in the same session, coordinate the MapMarker.tsx touch — class-marker does not modify MapMarker.tsx, so there is no conflict.

### Quality Gates per Phase

Do not advance past a phase quality gate with known failures. A passing build (`npm run build`) is required at each gate. Visual verification at 390px (iPhone SE / Chrome DevTools device emulation) is required at Phase 3 and Phase 5 gates.

### Rollback Strategy

Each phase maps to one or more migration files. To rollback:
- Phase 1 schema: `supabase db reset` to a pre-migration snapshot (do not rollback RLS alone — it leaves orphaned tables)
- Phase 2–4 (code only): `git revert` the feature branches
- Phase 5 (MapView.tsx integration): the original MapView.tsx is preserved in git history; `git checkout HEAD -- src/components/MapView.tsx` to restore

The deleted files (`MapFilterChips.tsx`, `MapTimePills.tsx`) are recoverable from git history after deletion.

### Token for Model Selection

This feature set has no AI/LLM calls. All nodes are database + frontend work. Use `claude-sonnet-4-6` for implementation. Escalate to `claude-opus-4-6` only for the mapview-mode-wiring integration node if the dual-layer rendering produces unexpected behavior that three retry cycles cannot resolve.

---

*"The stitches are invisible in use, visible in structure."*
