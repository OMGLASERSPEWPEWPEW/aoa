# ADMIN-COVERAGE.md — implementation spec for the redesigned Coverage tab

Covers tickets **F80–F89**. Prototype: `The Art of Art - Admin.dc.html`, frames `6a` (theaters), `6b` (schools), `6c` (block), `7a` (venue detail), `7b` (school detail), `7c` (curator conflicts).

Target: `OMGLASERSPEWPEWPEW/aoa` @ `main`, replacing the `CoverageTab` function inside `src/pages/Docs.tsx`.

Every visual element in the six frames appears in §4 or §5 with its data source, its component, and its acceptance line. If something is on screen and not in those sections, that is a spec bug — say so rather than inventing it.

## 0.1 Vocabulary: curation, not scraping

User-facing copy says **curate / curation / the curator**. "Scrape" is an engineering word and this is an arts product; the pipeline is doing editorial work, so it gets an editorial name. **The curator** is a persona, like Ruth the mentor — it *finds*, *suggests*, and *defers*. It never "overwrites".

| Old | New |
|---|---|
| Scrape Shows | `Curate shows` |
| Scrape all N schools | `Curate all N schools` |
| SCRAPE (row action) | `CURATE` |
| NEVER SCRAPED | `NEVER CURATED` |
| … is scraping | `… is curating` |
| the scraper's blocklist | `the curator's blocklist` |
| Last scrape | `CURATED {date}` / `NEVER CURATED` |

Internal identifiers stay as they are — do **not** rename `ScrapeContext`, `scrape_jobs`, `scraped_at`, `ScraperDashboard`, or the edge functions. This is a copy change at the presentation layer only; renaming the data layer risks the pipeline for no user benefit. One exception worth taking: if you add a *new* component for this work, name it `Curation*`.

---

Companion: **`ADMIN-IMPLEMENTATION.md`** — the code-level contracts (TypeScript types, component props, hook signatures, RPC bodies, migration order, curator-guard call sites, test plan). Read this file for *what and why*, that one for *what to type*.

## 0. What is wrong with the current tab

Read `src/pages/Docs.tsx` (`CoverageTab`, ~line 385) and `src/components/admin/CoverageMetricsCards.tsx` before starting. Four concrete problems, in priority order:

1. **Eight identical metric cards.** `CoverageMetricsCards` renders a `repeat(4, 1fr)` grid of same-sized cards, so `COVERAGE 66.5%` (the headline) has exactly the same visual weight as `LAST RUN Aug 19` (a footnote). Nothing tells the admin what to do next.
2. **Theaters and schools share one screen.** They are different entities (`venues`/`events` vs `schools`/`class_sessions`) with different failure modes, and the school section is currently four numbers stapled to the bottom of the venue section.
3. **Five action buttons in three different colours** — orange primary, green `Find Schools`, amber-outlined `View Progress` — with no hierarchy, wrapping unpredictably on a 390px screen.
4. **No way to remove or block anything.** The single most-requested capability is absent: a junk venue found by discovery is re-found on every subsequent run.

The redesign is not a reskin. It reorganises around the admin's actual loop: **see what is broken → act on it → block what should never come back.**

---

## 1. Routing and shell

The tab lives where it already lives. Do not create a new route.

- Route: `/app/admin` → `src/pages/Docs.tsx`, tab `'Coverage'`
- Tabs array stays `['Design', 'AI Prompts', 'Costs', 'Coverage']` (`Docs.tsx:15`) — **`'AI Prompts'` is the real label**, it wraps to two lines at 390px, and that wrap is part of the vertical budget
- `Header` (`src/components/Header.tsx`) and `Navigation` (`src/components/Navigation.tsx`) are untouched shell. The prototype recreates them only so the layout is honest about its ~134px of chrome:
  - Header: `padding:10px 20px 8px`, `border-bottom:1px solid var(--rule)`, h1 Newsreader italic 19px, `ADMIN` at Courier 10px/`0.06em` in `var(--accent)`, 16px lucide `LogOut` in `var(--ink-dim)`, meta line at Courier 10px/`0.06em` in `var(--ink-faint)` reading `✦ v0.22.0 · chicago · FRI AUG 21 · 2:04 PM` (lowercase `chicago`, clock on a 60s interval)
  - Nav: 79px — `padding:8px 6px 22px`, 48px slots, TONIGHT/⌖MAP/✦/◎DISCOVER/◇YOU, 44px accent FAB → `/app/watchlist`

> **Open divergence, do not resolve silently.** The shipped nav is MAP + DISCOVER; `BUILD-SPEC.md` §Navigation says CALLBOARD + LOBBY. The prototype draws what shipped. Ask before changing either.

**Vertical budget at 390×844:** status 39 + header 55 + Docs tabs 29 + nav 79 = **202**, leaving a **642px** scroller. Both tabs currently compute to ~597px. Any new block must be measured against 642, not 844.

---

## 2. Schema

### 2.1 `blocked_sources` — the blocklist (F82)

The core new object. A block must survive re-discovery, which means it is keyed by **domain**, not by row id.

```sql
CREATE TABLE public.blocked_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text UNIQUE,                      -- 'classpass.com', null for entry-only blocks
  scope text NOT NULL CHECK (scope IN ('domain', 'entry')),
  entity_type text NOT NULL CHECK (entity_type IN ('venue', 'school')),
  entity_id uuid,                          -- venues.id or schools.id, null if never promoted
  name_snapshot text NOT NULL,             -- name at block time, for the BLOCKED list
  reason text NOT NULL CHECK (reason IN ('aggregator','closed','duplicate','not_chicago','other')),
  note text,
  blocked_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.blocked_sources (domain) WHERE domain IS NOT NULL;
CREATE INDEX ON public.blocked_sources (entity_type, entity_id);

ALTER TABLE public.blocked_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_sources_admin_all" ON public.blocked_sources
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
```

If `is_admin()` does not exist, mirror the check used by the existing admin-only policies in `20260819000002_discovery_logs.sql`.

**Normalise the domain on write, not on read:** lowercase, strip `www.`, strip port and path. `https://WWW.ClassPass.com/chicago` → `classpass.com`. Do it in one exported helper (`src/lib/blocklist.ts → normalizeDomain()`) and use it in both the write path and the scraper check, or the two will disagree.

### 2.2 Enforcement — the part that makes it real

A blocklist that only hides rows in the UI is worthless; the next discovery run re-adds them. Three enforcement points, all required:

1. **Discovery insert** — in the school/venue discovery edge functions, reject any candidate whose normalised domain has a `blocked_sources` row with `scope='domain'`. Count them into the existing `blocked` counter already returned by `Find Schools` (`Docs.tsx:596` renders `${discoveryResult.blocked} blocked`) so the ribbon reports the number honestly.
2. **Scrape target selection** — exclude blocked venues/schools when building the scrape queue.
3. **Read paths** — exclude blocked entities from public queries (map markers, Tonight, Discover). Prefer a `WHERE NOT EXISTS` against `blocked_sources` inside the existing views rather than a column on `venues`, so unblocking is a single delete.

`scope='entry'` blocks only rows 1 and 3 for that `entity_id`, and leaves the domain free to return.

**Blocking is soft-delete, never `DELETE`.** The `⊘` action must not remove `venues`/`schools` rows — related `events`, `class_sessions`, `watchlist`, and `play_interest` rows hang off them. Insert the `blocked_sources` row and let the read paths filter. That is also what makes `BLOCKED (9) → unblock` a one-row delete.

### 2.3 Disciplines reduce to theatre only (F83)

Per the current product decision, `writing`, `musical`, and `devised` are dropped; the app is strictly theatre for now. `youth` was already unused.

```sql
-- Reassign before narrowing the constraint, or the ALTER fails.
UPDATE public.schools SET discipline = 'acting'
  WHERE discipline IN ('writing', 'musical', 'devised', 'youth');

ALTER TABLE public.schools DROP CONSTRAINT schools_discipline_check;
ALTER TABLE public.schools ADD CONSTRAINT schools_discipline_check
  CHECK (discipline IN ('improv', 'acting'));
```

Then remove the dropped values from every client surface: the `DCOL`/`CSIGIL` maps in `src/components/ClassMarker.ts`, the class filter chips, `MapKey.tsx`, and the discipline types in `src/lib/types.ts`. `CLASSES-AND-SCHOOLS.md` §2 lists six hues — treat the four extras as reserved, not deleted, and leave a comment saying so, since re-adding a discipline is likely.

### 2.4 `get_class_coverage_metrics` is measuring the wrong table — **fix before building 6b**

`supabase/migrations/20260815000012_class_coverage_rpc.sql` counts `events WHERE event_type IN ('class','workshop')`. Classes moved to `class_sessions` in `20260820000001_class_schema.sql` (F70). The RPC therefore reports `0` even after a successful class scrape, which is exactly the `0` visible in the user's screenshot — **the number is not just sad, it is wrong.** Replace it:

```sql
CREATE OR REPLACE FUNCTION public.get_class_coverage_metrics()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'school_count',        (SELECT COUNT(*) FROM schools s
                              WHERE NOT EXISTS (SELECT 1 FROM blocked_sources b
                                WHERE b.entity_type='school' AND b.entity_id=s.id)),
    'schools_never_scraped',(SELECT COUNT(*) FROM schools s
                              WHERE NOT EXISTS (SELECT 1 FROM class_sessions c WHERE c.school_id=s.id)),
    'session_count',       (SELECT COUNT(*) FROM class_sessions),
    'sessions_enrolling',  (SELECT COUNT(*) FROM class_sessions WHERE starts_on >= CURRENT_DATE),
    'with_start_date',     (SELECT COUNT(*) FROM class_sessions WHERE starts_on IS NOT NULL),
    'with_price',          (SELECT COUNT(*) FROM class_sessions WHERE price IS NOT NULL),
    'with_level',          (SELECT COUNT(*) FROM class_sessions WHERE level IS NOT NULL),
    'with_teacher',        (SELECT COUNT(*) FROM class_sessions c
                              WHERE EXISTS (SELECT 1 FROM class_teachers t WHERE t.session_id=c.id)),
    'by_discipline',       (SELECT COALESCE(json_object_agg(discipline, n), '{}'::json)
                              FROM (SELECT discipline, COUNT(*) n FROM schools GROUP BY discipline) d),
    'last_class_scrape',   (SELECT MAX(scraped_at) FROM class_sessions)
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_class_coverage_metrics() TO authenticated;
```

Update `ClassCoverageMetrics` in `supabase/functions/_shared/scraper/types.ts` to match, alongside the existing `VenueCoverageMetrics`.

### 2.5 Venue metrics additions

`get_venue_coverage_metrics` already returns everything 6a needs except the blocked count. Add `'blocked_count'` to it. Do **not** compute `22 NO CALENDAR` / `41 NO PHOTO` client-side by subtraction — return `venues_missing_calendar` and `venues_missing_photo` explicitly, because `total_aoa_venues - venues_with_calendar_url` silently includes blocked venues and drifts.

---

## 3. Components, hooks, and query keys

New files under `src/components/admin/`:

| File | Renders |
|---|---|
| `CoverageDomainTabs.tsx` | the THEATERS/SCHOOLS segmented control |
| `CoverageBar.tsx` | the 3-segment Chicago coverage bar + legend |
| `WorkActions.tsx` | THE WORK button block (per domain) |
| `NeedsALookTiles.tsx` | the 4 tappable filter tiles |
| `AuditRow.tsx` | one venue/school row with its actions |
| `DisciplineBar.tsx` | SCHOOLS BY DISCIPLINE |
| `ClassFieldTiles.tsx` | WHAT A CLASS NEEDS |
| `DryPipelineCard.tsx` | the empty-pipeline alarm |
| `BlockSheet.tsx` | frame 6c |
| `BlockedList.tsx` | the BLOCKED (n) review list |

`CoverageMetricsCards.tsx` is **deleted** — the 4×2 grid is what the redesign removes. `VenueAuditTable.tsx` is **replaced** by `AuditRow` (the `<table>` cannot hold 44px controls at 390px without horizontal scroll, which is the current clipping bug).

New hooks:

```ts
// src/hooks/useClassCoverage.ts   — get_class_coverage_metrics
// src/hooks/useSchoolAudit.ts     — mirrors useVenueAudit: rows + filters + sort
// src/hooks/useBlockSource.ts     — block / unblock mutations
```

Extend `src/lib/queryKeys.ts`:

```ts
venues:   { ..., coverage: ['venues','coverage'], audit: ['venues','audit'] },   // existing
classes:  { coverage: ['classes','coverage'], audit: ['schools','audit'] },
blocked:  { all: ['blocked'], count: ['blocked','count'] },
```

`useVenueAudit.ts` keeps its shape (`{ venues, loading, sort, setSort, filters, setFilters }`); add `blocked` to the filters object and a `reason` field on `AuditVenue` (§4.1).

**Invalidation on block** — one mutation touches many surfaces. In `onSettled`, invalidate: `blocked.all`, `blocked.count`, `venues.coverage` or `classes.coverage`, the matching `audit` key, and `queryKeys.map` (blocked entities must leave the map immediately). Optimistically remove the row from its audit list following the existing pattern in `useDiscoveryQueue.ts`.

---

## 4. Element-by-element

Tokens only — `var(--bg)`, `var(--ink-faint)`, etc. from `src/styles/tokens.css`. The prototype uses literal hex/oklch because Design Components forbid stylesheets; **production code must use the tokens**, and both themes must work (`.dark` is live). Every value below is the light-theme resolution, given so you can check yourself.

### 4.1 Shared — the audit row (`AuditRow.tsx`)

Replaces the table. Grid `1fr auto`, `gap:10px`, `align-items:center`, `padding:7px 0`, `border-bottom:1px solid var(--rule-soft)`.

| Element | Spec | Data |
|---|---|---|
| Name | Newsreader roman 15.5px, `line-height:1.2`, `var(--ink)`. No truncation — the row wraps rather than ellipsising, since the name is how the admin identifies the thing | `venues.name` / `schools.name` |
| Meta line | Courier 9px, `letter-spacing:0.04em`, `var(--ink-faint)`, uppercase, ` · `-joined | see below |
| Status badge | Courier 9px, `padding:5px 6px`, radius 2. **Informational, not a control** — render as `<span>`, never a button, so the 44px rule does not apply | derived |
| Actions | 44×44 `<button>`s, `gap:6px` | — |

**The meta line is the feature.** The current table shows `venue_type / event_count / source`, which does not say what is wrong. Compose a diagnosis instead, in this precedence order, max three segments:

| Segment | Condition | Example |
|---|---|---|
| type + neighborhood | always | `INSTITUTIONAL · HYDE PARK` |
| source | always | `MANUAL`, `DISCOVERED` |
| dead site | ≥2 consecutive fetch failures | `DEAD SITE ×3` |
| mistyped | `venue_type='storefront'` and `event_count=0` and name matches a known institution list | `MISTYPED · SHOULD BE INSTITUTIONAL` |
| aggregator | domain in the scraper's aggregator list | `AGGREGATOR · NOT A SCHOOL` |

`DEAD SITE ×n` comes from `site_profiles.consecutive_failures` (`SiteProfileRow` in `scraper/types.ts`) joined on domain — it already exists and is not currently surfaced anywhere. Surface it.

Badge values: `CAL ✓` in `var(--access)` on `var(--access-bg)`; `NO CAL` in `var(--danger)` on `var(--danger-bg)`; `FIX` neutral on `1px solid var(--rule)`.

Actions: `↻` rescrape (44×44, `1px solid var(--rule)`, glyph 15px `var(--ink-dim)`) and `⊘` block (44×44, `1px solid var(--danger-border)`, `background:var(--danger-bg)`, glyph 15px `var(--danger)`). Schools additionally get a 44px-tall labelled `SCRAPE` button in `var(--accent)`, or `BLOCK` in `var(--danger)` when the row is flagged as an aggregator.

The section sub-label reads `TAP FOR WHY` — **not** `SWIPE A ROW`. Only print a swipe affordance if you implement swipe.

### 4.2 Frame 6a — theaters

**Domain tabs** (`CoverageDomainTabs.tsx`). `display:inline-flex` in a `var(--bg-card)` well, `1px solid var(--rule)`, radius 3, `padding:2px`. Each half `flex:1`, centred, Courier 10.5px/`0.08em`, `padding:8px 0`. Active: `var(--accent)` fill, `var(--accent-on)` text, radius 2. Inactive: `var(--ink-faint)`. Live counts in JetBrains Mono — `opacity:0.72` when active, `var(--ink-ghost)` when not.
- Counts: `venue_coverage.total_aoa_venues`, `class_coverage.school_count`
- Persist the choice in `sessionStorage`; do not reset it on refetch
- Note: the map's mode control uses ivory for CLASSES; here both actives are gold, because ivory has no contrast on `#f6f1e3`. Correct adaptation — keep it.

**Chicago coverage** (`CoverageBar.tsx`). `padding:16px 20px 14px`, `border-bottom`.
- Label `CHICAGO COVERAGE` (Courier 9px/`0.18em`, `var(--ink-faint)`)
- Sentence: `155` in Newsreader italic 31px `var(--ink)`, then `of 233 venues we know exist` in Newsreader 15px `var(--ink-dim)`
- `66.5%` right-aligned, JetBrains Mono 19px, `var(--accent-text)`
- Bar: 10px tall, radius 5, `gap:1px`, track `var(--rule-soft)`. Three segments by `flex`: scraping (`venues_with_calendar_url`) `var(--accent)` · no-calendar (`venues_missing_calendar`) `oklch(0.72 0.10 55)` · missing (`total_known_chicago - total_aoa_venues`) `var(--rule-soft)`
- Entry animation: `transform: scaleX(0)→1`, `transform-origin:left`, `1.1s cubic-bezier(.2,.8,.2,1)`, second segment `.1s` delayed. **Wrap in `@media (prefers-reduced-motion: reduce)` and skip.** Animate on mount only, never on refetch.
- Legend: Courier 9.5px, `■` swatch in each segment's colour + count + label

**THE WORK** (`WorkActions.tsx`). `padding:13px 20px`, `background:var(--bg-card)`, `border-bottom`.
- Label row: `THE WORK` left; right, Courier 9px `var(--ink-ghost)`: `LAST RUN AUG 19 · 2D AGO` from `last_discovery_run`. Show relative age — a 2-day-old run is the actionable part.
- Primary row, `gap:8px`, both `height:44px`, Newsreader italic 15px: `Find venues` (`var(--accent)` fill / `var(--accent-on)`) and `Scrape shows` (`var(--accent-bg)` fill, `1px solid var(--accent-border)`, `var(--accent-text)`)
- Secondary row, `gap:8px`, both `height:44px`, Courier 10px, `1px solid var(--rule)`, transparent: `PLAY BACKFILL {n}` and `QUEUE {n} →`
- **Four buttons, two weights** — this replaces the current five-buttons-three-colours state. `Find Schools` moves to the SCHOOLS tab where it belongs; `View Progress` becomes the `QUEUE {n} →` row when a run is active.
- Wire to the existing handlers in `CoverageTab` and `ScrapeContext`. While running, the button shows the running label already implemented (`'Searching...'`) and is `disabled` with `opacity:0.6`.

**NEEDS A LOOK** (`NeedsALookTiles.tsx`). `padding:13px 20px 10px`. Four `flex:1` tiles, `gap:7px`, `padding:9px 0 8px`, radius 3, value JetBrains Mono 17px, label Courier 8.5px/`0.08em`.
- `0 EVENTS` (`venues_zero_events`) · `NO CAL` (`venues_missing_calendar`) · `NO PHOTO` (`venues_missing_photo`) · `BLOCKED` (`blocked_count`)
- **Tiles are filters, not stats.** Tapping sets the corresponding `useVenueAudit` filter and scrolls the list. Active tile: `1.5px solid` + tinted background in its own colour.
- A tile whose count is non-zero *and* represents breakage (`0 EVENTS`) renders in `var(--danger)` with `1.5px solid var(--danger)` and `background:var(--danger-bg)`. At zero it reverts to neutral. The colour is driven by the data, not hardcoded.
- `BLOCKED` opens `BlockedList.tsx` rather than filtering.
- The whole tile is the target — ≥44px including label.

**List header.** `{n} VENUES · ZERO EVENTS` in the active filter's colour, with `TAP FOR WHY` right in `var(--ink-ghost)`. The header names the *active filter*, so the admin always knows what they are looking at. Then `AuditRow`s.

### 4.3 Frame 6b — schools

**THE PIPELINE IS DRY** (`DryPipelineCard.tsx`). The most important element in the redesign: the user's screenshot shows `25 SCHOOLS / 0 CLASSES` rendered as a quiet row of zeros, when it means the class layer of the map is empty.
- **Render only when `session_count === 0 && school_count > 0`.** Otherwise render nothing — this is an alarm, not a permanent header.
- `margin:14px 20px 0`, `1.5px solid var(--danger)`, `background:oklch(0.95 0.03 35)` (light) / `var(--danger-bg)` (dark), radius 3, `padding:14px 15px`
- 7px `var(--danger)` dot, `animation: adm-pulse 1.8s ease-in-out infinite` (suppress under reduced-motion), + `THE PIPELINE IS DRY` in Courier 9px/`0.18em`
- Headline: `0` and `25` in Newsreader italic 26px inline in a 16px sentence — *"0 classes from 25 schools."*
- Body, Newsreader 14.5px `var(--ink-dim)`: *"Every school was found but none has been scraped. The class layer of the map is empty until this runs."*
- CTA: full-width 46px, `var(--danger)` fill, Newsreader italic 16px — `Scrape all {school_count} schools`
- When `session_count > 0`, its slot is taken by the normal class stats. Do not keep both.

**SCHOOLS BY DISCIPLINE** (`DisciplineBar.tsx`). Two segments after §2.3: improv `oklch(0.55 0.15 110)`, acting `oklch(0.52 0.19 20)` — the map's hues darkened for paper. 26px tall, radius 2, `gap:1px`, count in JetBrains Mono 11px `var(--accent-on)` centred in each segment. Legend below: `◍ IMPROV {n}` / `▭ ACTING {n}` in the same hues at `oklch(0.48 …)` for text contrast. Source: `by_discipline`. **Render segments from the returned object, not a hardcoded list** — a re-added discipline must appear without a code change.

**WHAT A CLASS NEEDS** (`ClassFieldTiles.tsx`). Four tiles, `repeat(4,1fr)`, `gap:7px`, `padding:8px 0`, `1px solid var(--rule)`, radius 3. `START DATE` / `PRICE` / `LEVEL` / `TEACHER` from `with_start_date`, `with_price`, `with_level`, `with_teacher`.
- These four are the publish bar: a session missing a start date or a price cannot be rendered in the class sheet (`CLASSES-AND-SCHOOLS.md` §4), so it is invisible to users no matter how many rows exist.
- At `0` the value is `var(--ink-ghost)`; at `< session_count` it is `var(--danger)`; at parity `var(--access)`. Data-driven, not hardcoded.

**List.** Header `{n} SCHOOLS · NEVER SCRAPED` from `schools_never_scraped`. Rows carry the discipline glyph in its hue (`◍`/`▭`), name, then `{NEIGHBORHOOD} · {price_band} · {n} CLASSES`, then `SCRAPE` + `⊘`. An aggregator-flagged row shows `BLOCK` in `var(--danger)` instead of `SCRAPE` and greys its glyph.

### 4.4 Frame 6c — the block sheet (`BlockSheet.tsx`)

Bottom sheet over a dimmed list (`opacity:0.32`), `border-radius:16px 16px 0 0`, `border-top:1px solid var(--rule)`, `box-shadow:0 -14px 44px rgba(0,0,0,0.18)`, 38×4 grab handle. Same geometry as the map sheet; here it may cover the nav, since it is modal.

1. **Header** — 22px `var(--danger)` square with `⊘`, then `BLOCK THIS SOURCE` in Courier 9.5px/`0.18em` `var(--danger)`. Name in Newsreader italic 25px. Domain below in JetBrains Mono 11px `var(--ink-dim)` — **show the normalised domain**, since that is what is actually being blocked.
2. **WHY** — five single-select chips, `min-height:44px`, `display:inline-flex; align-items:center`, `padding:0 15px`, radius 22. Selected: `var(--danger)` fill / `var(--accent-on)`. Unselected: `1px solid var(--rule)` / `var(--ink-dim)`. Maps 1:1 to the `reason` CHECK: `AGGREGATOR` `CLOSED` `DUPLICATE` `NOT CHICAGO` `OTHER`. Required. `OTHER` reveals a `note` textarea.
3. **HOW WIDE** — two radio rows, each a `<button>` with `min-height:44px`, `display:flex; align-items:center; gap:11px`. 20px circle: selected `6px solid var(--danger)` on `var(--bg)`, unselected `1.5px solid var(--rule)`. Title Newsreader 15px; sub-line Courier 9.5px.
   - *The whole domain* → `scope='domain'` — `NOTHING FROM {DOMAIN} IS EVER SCRAPED AGAIN`
   - *Just this entry* → `scope='entry'` — `HIDDEN NOW, BUT THE DOMAIN CAN RETURN`
   - **This is the most consequential control in the admin surface**, so it is also the most generous target. Default to `domain` when the reason is `aggregator`, `entry` otherwise.
4. **Consequences** — Newsreader 14px `var(--ink-dim)`, with real counts interpolated: *"Removes it from the map and every list, drops {n} classes, and adds the domain to the scraper's permanent blocklist. Reversible from BLOCKED (9)."* Say the true number, including when it is `0`. Never a generic "are you sure".
5. **Footer** — `CANCEL` (104px, 50px tall, outline) + `Block and remove` (`flex:1`, 50px, `var(--danger)` fill, Newsreader italic 16px).

No native `confirm()`. The sheet *is* the confirmation, because it states consequences and is reversible.

### 4.5 `BlockedList.tsx`

Reached from the `BLOCKED` tile. Rows: `name_snapshot`, domain in JetBrains Mono, reason chip, who and when in Courier 9px, and a 44px `UNBLOCK` button. Unblock deletes the `blocked_sources` row and invalidates the same keys as block. Empty state: `Nothing blocked yet.` / `Blocking a source removes it from the app and stops the scraper returning to it.`

---

## 5. The detail page — frames 7a, 7b, 7c (F87–F89)

Route: `/app/admin/venue/:id` and `/app/admin/school/:id`. A real route, not a modal — the admin needs back/forward and a shareable URL. Push from any `AuditRow` tap (`TAP FOR WHY` is the affordance already printed on the list header).

**Chrome differs from the Coverage tab.** The bottom nav is replaced by a save bar; an edit context should not offer five ways to navigate away from unsaved work. Budget: status 39 + back bar 44 + provenance strip 34 + save bar 74 = 191, leaving a **653px** scroller.

### 5.1 The core mechanic: field-level provenance (F87)

**This is the whole feature.** "If we edit them, the curator should not override them" is a per-field promise, not a per-row one. A venue has 14 fields; freezing all of them because the admin corrected `venue_type` would block genuinely useful automatic updates to the other 13. So provenance is tracked per field.

```sql
CREATE TABLE public.field_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('venue','school','class_session','event')),
  entity_id uuid NOT NULL,
  field_name text NOT NULL,
  value jsonb NOT NULL,              -- the admin's value, typed
  previous_value jsonb,              -- what the curator had, for the "WAS …" line
  edited_by uuid NOT NULL REFERENCES auth.users(id),
  edited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, field_name)
);
CREATE INDEX ON public.field_overrides (entity_type, entity_id);

ALTER TABLE public.field_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_overrides_admin_all" ON public.field_overrides
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
```

**Write path.** Saving an edit does two things in one transaction: `UPDATE` the real column on `venues`/`schools` (so every existing read path just works, with no join added anywhere) **and** upsert the `field_overrides` row. The override table is the *memory of who wrote it*, not the value's home. This is deliberate: adding a join to the map, Tonight, and Discover queries would be a large blast radius for an admin feature.

**Curator path.** Before writing any field, the pipeline checks for an override:

```ts
// supabase/functions/_shared/curator/overrides.ts
const held = await heldFields(entityType, entityId)   // Set<string>
const writable = Object.fromEntries(
  Object.entries(extracted).filter(([field]) => !held.has(field))
)
// held fields never enter the UPDATE; they go to curator_suggestions instead (§5.5)
```

Do this in **one shared helper** used by every write site (venue enrichment, event scrape, class extraction). A single forgotten call silently breaks the promise, and the admin will not notice until their correction is gone.

**Precedence, stated once:** admin override > curator extraction > discovery raw > null. Never the reverse, and no confidence score is high enough to beat an override.

### 5.2 The field row (`AdminField.tsx`)

One component, three states, driven by data:

| State | Condition | Treatment |
|---|---|---|
| **Curated** | value present, no override | `1px solid var(--rule)`, `background:var(--bg-card)`; label + `CURATOR` in `var(--ink-faint)` |
| **Yours** | override exists | `1px solid var(--accent-border)`, **`border-left:3px solid var(--accent)`**, `background:var(--accent-bg)`; label and chip in `var(--accent-text)` reading `⊙ YOURS · {MON D}` |
| **Empty** | null/blank | `1px dashed var(--rule)`, transparent; label chip in `var(--danger)` naming the *consequence*, e.g. `EMPTY · SHOWS AS A GAP`; body is placeholder text in `var(--ink-faint)` |

- The `⊙` glyph is the held mark. Typographic, consistent with `▣ ▨ ◈ ◍ ▭`; no icon library.
- A held field adds one line of Courier 9px `var(--ink-dim)` explaining itself: `WAS STOREFRONT · THE CURATOR WON'T CHANGE THIS AGAIN` — built from `previous_value`. This is the sentence that makes the guarantee legible; do not cut it.
- Empty-state labels state the user-facing cost, not the technical fact. `EMPTY · SHOWS AS A GAP` beats `NULL`, because a missing `accessibility_info` is a real hole in the product's promise.
- Every editable field is a ≥44px control. Text fields become inputs on tap; enums render as button groups (all ≥44px); booleans as toggle rows with a ≥44px hit area spanning the full width.
- Releasing an override: `⋯` → `Hand back to the curator`, which deletes the `field_overrides` row. Always offer this — an override the admin cannot undo is a trap.

### 5.3 Frame 7a — a theater

- **Back bar**: `←` + name (Newsreader italic 19px, ellipsised) + `⋯`, with `COVERAGE · THEATERS` beneath in Courier 9px. Back returns to the audit list **with its filter intact**.
- **Provenance strip** (`var(--bg-card)`, `border-bottom`): `14 FIELDS · ⊙ 3 YOURS · 2 EMPTY` with counts in JetBrains Mono, and `CURATED AUG 19` right-aligned. Counts come from `field_overrides` and a null-scan of the row — they are the page's summary, so they must be live, not computed once on mount.
- **Photo** first: 112px well, `REPLACE` (44px) and `✕` (44×44) bottom-right on a `rgba(246,241,227,0.94)` scrim so they stay legible over any image. Header right shows attribution: `CURATOR · GOODMAN.ORG` from `photo_url_source` (already on `VenueTarget`). A replaced photo is an override like any other.
- Then the fields in this order — **most-corrected first**, not schema order: `name`, `venue_type`, `calendar_url`, `neighborhood`, `accessibility_info`, `address`, `price_range`, `website_url`, `genre_tags`, `description`, `latitude`/`longitude`.
  - `calendar_url` sits third because it is the field that decides whether anything gets curated at all.
  - `latitude`/`longitude` render as one row with a small static map thumb and a `GEOCODED` / `⊙ YOURS` chip, reading `geocode_source` from `20260821000001_geocode_columns.sql`.
- **Save bar**: `DISCARD` (96px) + `Save {n} changes` (`flex:1`, gold, Newsreader italic 16px). The count is literal; at zero the button is disabled at `opacity:0.5`. Leaving with unsaved edits prompts.

### 5.4 Frame 7b — a school

Same shell, school fields.

- **Photo** first, same as 7a — `schools.photo_url`. When empty, the label chip names the cost: `EMPTY · THE MAP SHOWS A BLANK`, and the well is a dashed 64px button reading `+ ADD A PHOTO OF THE ROOM` / `CLASS SHEETS USE THIS`. **`schools` has no `photo_url_source` sibling** (unlike `venues`), so there is no attribution line here — do not invent a provenance the table cannot store. If attribution matters for schools, add the column first.
- `short_name` shows a live character counter in JetBrains Mono — `SECOND CITY` is 11 characters, so it reads `11/14`. **Derive it from the value (`value.length`), never hardcode it.** The column is `CHECK (length(short_name) <= 14)` and it is the **map label**, so say so in the sub-line (`⊙ YOURS · THE MAP LABEL`). Truncation here is visible to every user on the map.
- `price_band` is a 3-button `$ / $$ / $$$` group, each ≥44px, matching the `CHECK`.
- `discipline` is a 2-button group with the discipline glyph and hue (`◍ IMPROV` chartreuse, `▭ ACTING` red) — two options only after F83. Header shows the curator's confidence when it classified: `CURATOR · 0.91 CONFIDENCE` from `VenueTypeResult.confidence`. Low confidence is a reason to look, so surface it.
- **`HOW PEOPLE AFFORD IT`** — `payment_plan`, `financial_aid`, `sliding_scale` as toggle rows. Grouped and named this way on purpose: they are the fields that decide whether a broke newcomer can walk in, which is the product's whole promise. On, the track is `var(--access)`.
- **Classes** section: `CLASSES · NONE YET` in `var(--danger)` with a 44px `CURATE NOW` in the header, then a single dashed 44px `+ ADD A CLASS BY HAND` row for when the admin has the catalogue in front of them. A hand-added session gets `field_overrides` rows for every field it was given, so the curator never touches it.
  - When sessions exist, this becomes a list: title, `level` pips, `starts_on`, `price`, and a `⊙` mark on any session with overrides. Tapping opens the same field page for `entity_type='class_session'`.

### 5.5 Frame 7c — when the curator disagrees (F89)

The part that makes "don't override" trustworthy instead of merely obedient. If the curator's finding is silently dropped, the admin never learns that their held value is now wrong — a stale hand-typed calendar URL will quietly starve a venue of events forever. So a blocked write is **parked, not discarded**.

```sql
CREATE TABLE public.curator_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field_name text NOT NULL,
  suggested_value jsonb NOT NULL,
  evidence jsonb,                    -- { events_found: 11, confidence: 0.62, source_url: … }
  times_suggested int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','accepted','dismissed','muted')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, field_name)
);
```

Re-finding the same value increments `times_suggested` and bumps `last_seen_at` rather than inserting a duplicate.

- **Header card**: `THE CURATOR HAS {n} NOTES` in `var(--accent-text)` on `var(--accent-bg)`, then the reassurance in plain words: *"It found different values for fields you hold. Nothing was changed — your versions are still live."* Say this explicitly; it is the guarantee.
- **Each note** is one bordered block, two stacked halves divided by `1px dashed var(--rule)`:
  - top: `⊙ YOURS · LIVE` on `var(--accent-bg)` with a `border-left:3px solid var(--accent)` — the live value, visually dominant
  - bottom: `CURATOR SUGGESTS` on `var(--bg-card)` in `var(--ink-dim)`, then the evidence in Courier 8.5px: `FOUND 11 EVENTS THERE · YOURS FOUND 8`, or `0.62 CONFIDENCE · IT HAS SUGGESTED THIS TWICE`
- **Evidence decides the default.** A suggestion with better evidence than the held value (more events found) puts `TAKE THEIRS` as the filled button; weak evidence (0.62 confidence) puts `KEEP MINE` filled. Both are always present and both are ≥44px — the recommendation is a default, never a lock.
- `TAKE THEIRS` writes the value and **deletes the override** (the curator owns that field again). `KEEP MINE` sets `dismissed`. Two dismissals of the same field set `muted` and stop the asking — surfaced as the footnote `KEEPING YOURS TWICE STOPS IT ASKING.`
- Footer: `Keep everything I wrote` dismisses all open notes at once.
- Entry point: when a venue has open suggestions, its provenance strip shows `⊙ 3 YOURS · 2 NOTES` with `NOTES` in `var(--accent-text)`, tappable. On the audit list, the row's meta line gains `CURATOR HAS NOTES`.

### 5.6 Acceptance — detail pages

- [ ] Overrides are per **field**, never per row
- [ ] Saving writes the real column *and* the `field_overrides` row in one transaction
- [ ] Every curator write site calls the shared `heldFields()` helper — grep for write sites and confirm each one
- [ ] A curation run over a venue with 3 held fields changes 0 of them and files suggestions instead
- [ ] Held fields show `WAS {previous}` and can be handed back to the curator
- [ ] A blocked write is parked in `curator_suggestions`, never silently dropped
- [ ] Re-finding the same value increments `times_suggested` rather than duplicating
- [ ] Two dismissals mute the field
- [ ] Empty-field labels name the user-facing consequence, not the null
- [ ] `short_name` enforces 14 chars with a counter derived from `value.length`, and says it is the map label
- [ ] Both venue and school detail pages expose their photo field; the school has no attribution line, because `schools` has no `photo_url_source`
- [ ] Back preserves the audit list's filter
- [ ] Unsaved-changes prompt on navigate away; save button disabled at zero changes
- [ ] Every editable control ≥44px; provenance chips are `<span>`s and exempt
- [ ] Both themes

---

## 6. Build order

1. **§2.4** — fix `get_class_coverage_metrics`. Everything in 6b reads it, and it is currently wrong.
2. **§2.1 + §2.2** — `blocked_sources` and all three enforcement points. Ship the enforcement in the same PR as the table; a UI-only blocklist is a bug that looks like a feature.
3. **§2.3** — discipline migration + client cleanup.
4. **§2.5** — venue metric additions.
5. `CoverageDomainTabs` + splitting `CoverageTab` into `TheatersPanel` / `SchoolsPanel`.
6. 6a: `CoverageBar` → `WorkActions` → `NeedsALookTiles` → `AuditRow`.
7. 6b: `DryPipelineCard` → `DisciplineBar` → `ClassFieldTiles` → rows.
8. 6c + `BlockedList`.
9. **F87** — `field_overrides` + the shared `heldFields()` guard in every curator write site. Ship the guard with the table; an editable page whose edits get overwritten is worse than no editable page.
10. **F88** — detail routes 7a/7b and `AdminField`.
11. **F89** — `curator_suggestions` + 7c.
12. Copy sweep §0.1 (presentation layer only).
13. Delete `CoverageMetricsCards.tsx` and `VenueAuditTable.tsx`.

---

## 7. Acceptance

**Blocking**
- [ ] Blocking inserts a `blocked_sources` row and never `DELETE`s a venue or school
- [ ] A blocked domain is rejected by the next discovery run and counted in its `blocked` total
- [ ] A blocked entity disappears from the map, Tonight, and Discover
- [ ] `scope='entry'` hides the row but leaves the domain eligible
- [ ] Unblock is one row delete and fully restores the entity
- [ ] Domain normalisation is one shared helper used by both the write path and the scraper check

**Layout**
- [ ] Both panels fit a 642px scroller at 390×844 — measured with `scrollHeight - clientHeight`, not eyeballed
- [ ] No horizontal scroll anywhere (this is what the `<table>` got wrong)
- [ ] Every control ≥ 44px. Status badges are `<span>`s and exempt; if it is a `<button>`, it is 44
- [ ] Both themes checked; no hardcoded hex where a token exists

**Content**
- [ ] The dry-pipeline card appears only when `session_count === 0 && school_count > 0`
- [ ] `NEEDS A LOOK` tiles filter the list; they are not decorative
- [ ] Tile and field-tile colours are derived from counts, never hardcoded
- [ ] Discipline segments render from `by_discipline`, so a re-added discipline needs no code change
- [ ] Every audit row states a diagnosis, not just its type and source
- [ ] `DEAD SITE ×n` is surfaced from `site_profiles.consecutive_failures`
- [ ] The block sheet states the real number of affected classes, including `0`
- [ ] No `SWIPE` affordance unless swipe is implemented

**Do not**
- [ ] No 4×2 grid of equal metric cards; no `<table>` for the audit list; no `confirm()`; no hard delete; no fifth action button
