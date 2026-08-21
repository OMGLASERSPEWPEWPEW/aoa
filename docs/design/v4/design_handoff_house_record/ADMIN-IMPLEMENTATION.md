# ADMIN-IMPLEMENTATION.md — code-level contracts for the admin surface

Companion to `ADMIN-COVERAGE.md`. That file says **what each element is and why**; this file says **what to type**. Read that one first for intent, this one while writing code.

Scope: tickets F80–F90, frames `6a` `6b` `6c` `7a` `7b` `7c` in `The Art of Art - Admin.dc.html`.

Target: `OMGLASERSPEWPEWPEW/aoa` @ `main` — React 19, TypeScript, Vite, Tailwind, Supabase, TanStack Query, Dexie.

Every signature below is written against the **real** contents of `src/lib/types.ts`, `src/lib/queryKeys.ts`, and the existing hooks. Where a name already exists in the repo it is marked *(existing)* and must keep its current shape unless stated.

---

## 1. File manifest

### Migrations — apply in this order

| # | File | Contents |
|---|---|---|
| 1 | `20260823000001_fix_class_coverage_rpc.sql` | rewrite `get_class_coverage_metrics` (§3.1) |
| 2 | `20260823000002_blocked_sources.sql` | `blocked_sources` + RLS + indexes |
| 3 | `20260823000003_blocklist_read_filters.sql` | exclude blocked entities from public read paths |
| 4 | `20260823000004_theatre_only_disciplines.sql` | reassign, then narrow the `discipline` CHECK |
| 5 | `20260823000005_venue_coverage_additions.sql` | add `blocked_count`, `venues_missing_calendar`, `venues_missing_photo` |
| 6 | `20260823000006_field_overrides.sql` | `field_overrides` + RLS |
| 7 | `20260823000007_curator_suggestions.sql` | `curator_suggestions` + RLS |
| 8 | `20260823000008_admin_rpcs.sql` | `apply_field_override`, `release_field_override`, `block_source`, `accept_suggestion` |

Migrations 1 and 2 are independently shippable and both fix live bugs. Do not batch them behind the UI work.

### New source files

```
src/lib/
  blocklist.ts                  normalizeDomain(), reason labels
  fieldMeta.ts                  field registry: order, label, editor, consequence copy

src/hooks/
  useClassCoverage.ts
  useSchoolAudit.ts
  useBlockedSources.ts
  useBlockSource.ts
  useEntityDetail.ts
  useFieldOverrides.ts
  useCuratorSuggestions.ts

src/components/admin/
  CoverageDomainTabs.tsx
  CoverageBar.tsx
  WorkActions.tsx
  NeedsALookTiles.tsx
  AuditRow.tsx
  DisciplineBar.tsx
  ClassFieldTiles.tsx
  DryPipelineCard.tsx
  BlockSheet.tsx
  BlockedList.tsx
  AdminField.tsx
  ProvenanceStrip.tsx
  SuggestionCard.tsx

src/pages/
  AdminVenueDetail.tsx
  AdminSchoolDetail.tsx

supabase/functions/_shared/curator/
  overrides.ts                  heldFields(), filterWritable(), fileSuggestion()
  blocklist.ts                  isBlockedDomain()
```

### Files deleted

- `src/components/admin/CoverageMetricsCards.tsx` — the 4×2 equal-card grid is what F81 removes
- `src/components/admin/VenueAuditTable.tsx` — replaced by `AuditRow`; a `<table>` cannot hold 44px controls at 390px without horizontal scroll

### Files modified

- `src/pages/Docs.tsx` — `CoverageTab` splits into `TheatersPanel` + `SchoolsPanel`
- `src/lib/types.ts` — §2
- `src/lib/queryKeys.ts` — §4.1
- `src/hooks/useVenueAudit.ts` — add `blocked` filter, `diagnosis` on rows
- `src/App.tsx` — two new routes (§5)
- every curator write site — §6

---

## 2. Types — additions to `src/lib/types.ts`

```ts
// ---- F83: theatre only. NARROWS an existing exported type.
// Was: 'improv' | 'acting' | 'writing' | 'musical' | 'devised' | 'youth'
export type Discipline = 'improv' | 'acting'
// Reserved for re-add (see CLASSES-AND-SCHOOLS.md §2): writing, musical, devised, youth.
// Narrowing this is a breaking change — tsc will point at every site to clean up.

// ---- F82: blocking
export type BlockScope = 'domain' | 'entry'
export type BlockReason = 'aggregator' | 'closed' | 'duplicate' | 'not_chicago' | 'other'
export type BlockableEntity = 'venue' | 'school'

export interface BlockedSource {
  id: string
  domain: string | null
  scope: BlockScope
  entity_type: BlockableEntity
  entity_id: string | null
  name_snapshot: string
  reason: BlockReason
  note: string | null
  blocked_by: string
  created_at: string
}

export interface BlockRequest {
  entity_type: BlockableEntity
  entity_id: string
  name: string
  url: string | null          // raw; normalized server-side
  scope: BlockScope
  reason: BlockReason
  note?: string
}

// ---- F87: field provenance
export type OverridableEntity = 'venue' | 'school' | 'class_session' | 'event'

export interface FieldOverride {
  id: string
  entity_type: OverridableEntity
  entity_id: string
  field_name: string
  value: unknown
  previous_value: unknown | null
  edited_by: string
  edited_at: string
}

export type FieldState = 'curated' | 'held' | 'empty'

/** One row on a detail page. Built by useEntityDetail, consumed by AdminField. */
export interface AdminFieldModel {
  name: string                      // column name
  label: string                     // 'CALENDAR URL'
  editor: FieldEditor
  value: unknown
  state: FieldState
  override: FieldOverride | null
  /** shown only when state === 'empty'; names the user-facing cost */
  consequence: string | null        // 'SHOWS AS A GAP'
  /** provenance detail for curated fields, e.g. 'CURATOR · GOODMAN.ORG' */
  sourceLabel: string | null
  suggestion: CuratorSuggestion | null
  options?: readonly string[]       // enum editors
  maxLength?: number                // short_name → 14
  hint?: string                     // '⊙ YOURS · THE MAP LABEL'
}

export type FieldEditor =
  | 'text' | 'textarea' | 'url' | 'enum' | 'boolean'
  | 'money' | 'tags' | 'image' | 'latlng'

// ---- F89: curator suggestions
export type SuggestionStatus = 'open' | 'accepted' | 'dismissed' | 'muted'

export interface SuggestionEvidence {
  events_found?: number
  events_found_current?: number
  confidence?: number
  source_url?: string
}

export interface CuratorSuggestion {
  id: string
  entity_type: OverridableEntity
  entity_id: string
  field_name: string
  suggested_value: unknown
  evidence: SuggestionEvidence | null
  times_suggested: number
  status: SuggestionStatus
  first_seen_at: string
  last_seen_at: string
}

// ---- F84: class coverage. Replaces the old shape entirely.
export interface ClassCoverageMetrics {
  school_count: number
  schools_never_curated: number
  session_count: number
  sessions_enrolling: number
  with_start_date: number
  with_price: number
  with_level: number
  with_teacher: number
  by_discipline: Partial<Record<Discipline, number>>
  last_curated_at: string | null
}

// ---- F85: audit rows. EXTENDS the existing AuditVenue.
export type DiagnosisKind =
  | 'ok' | 'dead_site' | 'mistyped' | 'aggregator' | 'no_calendar' | 'never_curated'

export interface Diagnosis {
  kind: DiagnosisKind
  /** already uppercased, ' · '-joined, ready to render */
  label: string
  severity: 'neutral' | 'warn' | 'danger'
}

export interface AuditVenueRow extends AuditVenue {
  diagnosis: Diagnosis
  consecutive_failures: number
  has_open_suggestions: boolean
  domain: string | null
}

export interface AuditSchoolRow {
  id: string
  name: string
  short_name: string
  neighborhood: string
  discipline: Discipline
  price_band: '$' | '$$' | '$$$' | null
  session_count: number
  last_curated_at: string | null
  diagnosis: Diagnosis
  has_open_suggestions: boolean
  domain: string | null
}

export type AdminDomain = 'theaters' | 'schools'
```

> `VenueCoverageMetrics` lives in `supabase/functions/_shared/scraper/types.ts`, not in `src/lib/types.ts`. Add `blocked_count`, `venues_missing_calendar`, `venues_missing_photo` there and keep the import path the existing hooks use.

---

## 3. SQL

### 3.1 `get_class_coverage_metrics` — currently wrong, fix first

It counts `events WHERE event_type IN ('class','workshop')`, but F70 moved classes to `class_sessions`. It returns `0` even after a successful curation run. Full replacement body is in `ADMIN-COVERAGE.md` §2.4; the returned keys must match `ClassCoverageMetrics` exactly.

### 3.2 Write RPCs

Client code never writes these tables directly — each write is multi-statement and must be atomic.

```sql
-- Upsert an override AND the real column, in one transaction.
CREATE OR REPLACE FUNCTION public.apply_field_override(
  p_entity_type text, p_entity_id uuid, p_field text, p_value jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev jsonb; v_table text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not admin'; END IF;

  v_table := CASE p_entity_type
    WHEN 'venue' THEN 'venues' WHEN 'school' THEN 'schools'
    WHEN 'class_session' THEN 'class_sessions' WHEN 'event' THEN 'events'
    ELSE NULL END;
  IF v_table IS NULL THEN RAISE EXCEPTION 'bad entity_type %', p_entity_type; END IF;

  -- whitelist the column: never interpolate an unchecked identifier
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=v_table AND column_name=p_field
  ) THEN RAISE EXCEPTION 'unknown field %.%', v_table, p_field; END IF;

  EXECUTE format('SELECT to_jsonb(t.%I) FROM public.%I t WHERE t.id=$1', p_field, v_table)
    INTO v_prev USING p_entity_id;

  EXECUTE format('UPDATE public.%I SET %I = $1 WHERE id = $2', v_table, p_field)
    USING p_value #>> '{}', p_entity_id;

  INSERT INTO public.field_overrides
    (entity_type, entity_id, field_name, value, previous_value, edited_by)
  VALUES (p_entity_type, p_entity_id, p_field, p_value,
          COALESCE((SELECT previous_value FROM public.field_overrides
                     WHERE entity_type=p_entity_type AND entity_id=p_entity_id
                       AND field_name=p_field), v_prev),
          auth.uid())
  ON CONFLICT (entity_type, entity_id, field_name)
  DO UPDATE SET value = EXCLUDED.value, edited_by = auth.uid(), edited_at = now();

  -- a field the admin just set is no longer in dispute
  UPDATE public.curator_suggestions SET status='dismissed'
   WHERE entity_type=p_entity_type AND entity_id=p_entity_id
     AND field_name=p_field AND status='open';
END $$;
```

Two details that matter: `previous_value` is preserved from the **first** override so the `WAS STOREFRONT` line keeps pointing at what the curator originally had, not at the admin's last edit; and the column name is whitelisted against `information_schema` rather than interpolated, since `p_field` reaches SQL identifier position.

Also implement, same pattern:

| Function | Behaviour |
|---|---|
| `release_field_override(entity_type, entity_id, field)` | delete the override; leave the column value; reopen any `muted` suggestion for that field |
| `block_source(...)` per `BlockRequest` | insert `blocked_sources`; **never** delete the entity; dismiss its open suggestions |
| `unblock_source(id)` | delete the row |
| `accept_suggestion(id)` | write the suggested value to the column, **delete** the override, set status `accepted` |
| `dismiss_suggestion(id)` | status `dismissed`; if `times_suggested >= 2`, set `muted` instead |

`accept_suggestion` deleting the override is the intended semantic: taking the curator's value hands the field back to the curator. Do not leave an override pointing at a value the admin did not type.

### 3.3 Read filters (migration 3)

Blocked entities must vanish from public reads. Do it inside the existing views/queries, not with a new column on `venues`:

```sql
-- pattern, applied to map data, tonight, discover, class map
AND NOT EXISTS (
  SELECT 1 FROM public.blocked_sources b
  WHERE (b.entity_type='venue' AND b.entity_id = v.id)
     OR (b.scope='domain' AND b.domain = public.normalize_domain(v.website_url))
)
```

Implement `normalize_domain(text)` as an `IMMUTABLE` SQL function and **mirror it exactly** in `src/lib/blocklist.ts`. Lowercase, strip scheme, strip `www.`, strip port, strip path. If the two implementations disagree, blocks silently stop working — add a test that runs the same 10 inputs through both.

---

## 4. Client data layer

### 4.1 Query keys — extend `src/lib/queryKeys.ts`

Keep the existing style (namespace object, `as const`, builders for parameterised keys):

```ts
venues: {
  all: ['venues'] as const,
  withCoords: ['venues', 'with-coords'] as const,
  audit: ['venues', 'audit'] as const,
  coverage: ['venues', 'coverage'] as const,
  detail: (id: string) => ['venues', id, 'admin-detail'] as const,   // NEW
},
schools: {                                                           // NEW
  audit: ['schools', 'audit'] as const,
  coverage: ['schools', 'coverage'] as const,
  detail: (id: string) => ['schools', id, 'admin-detail'] as const,
},
blocked: {                                                           // NEW
  all: ['blocked'] as const,
  count: ['blocked', 'count'] as const,
},
overrides: {                                                         // NEW
  forEntity: (t: string, id: string) => ['overrides', t, id] as const,
},
suggestions: {                                                       // NEW
  forEntity: (t: string, id: string) => ['suggestions', t, id] as const,
  openCount: ['suggestions', 'open-count'] as const,
},
```

### 4.2 Invalidation — the part that is easy to get wrong

A block or an override touches more caches than it looks like. Centralise both sets so no call site has to remember:

```ts
// src/lib/adminInvalidation.ts
export function invalidateAfterBlock(qc: QueryClient, d: AdminDomain) {
  qc.invalidateQueries({ queryKey: queryKeys.blocked.all })
  qc.invalidateQueries({ queryKey: queryKeys.blocked.count })
  qc.invalidateQueries({ queryKey: d === 'theaters' ? queryKeys.venues.coverage : queryKeys.schools.coverage })
  qc.invalidateQueries({ queryKey: d === 'theaters' ? queryKeys.venues.audit : queryKeys.schools.audit })
  qc.invalidateQueries({ queryKey: ['map-data'] })      // prefix — mapData is user+ts keyed
  qc.invalidateQueries({ queryKey: ['class-map'] })
  qc.invalidateQueries({ queryKey: queryKeys.events.tonight })
}

export function invalidateAfterOverride(
  qc: QueryClient, t: OverridableEntity, id: string, d: AdminDomain,
) {
  qc.invalidateQueries({ queryKey: queryKeys.overrides.forEntity(t, id) })
  qc.invalidateQueries({ queryKey: t === 'school' ? queryKeys.schools.detail(id) : queryKeys.venues.detail(id) })
  qc.invalidateQueries({ queryKey: d === 'theaters' ? queryKeys.venues.audit : queryKeys.schools.audit })
  qc.invalidateQueries({ queryKey: ['map-data'] })
  qc.invalidateQueries({ queryKey: ['class-map'] })
}
```

`queryKeys.mapData` is `(userId, lastScrapeTs)`-keyed, so it must be invalidated by **prefix** (`['map-data']`), not by an exact key. Same for `classMap`.

### 4.3 Hook contracts

```ts
// useClassCoverage.ts — mirrors the shape of useVenueCoverage (existing)
export function useClassCoverage(): {
  metrics: ClassCoverageMetrics | null
  loading: boolean
  error: string | null
  refetch: () => void
}

// useSchoolAudit.ts — mirrors useVenueAudit (existing) so the panels are symmetric
export function useSchoolAudit(): {
  schools: AuditSchoolRow[]
  loading: boolean
  sort: string
  setSort: (s: string) => void
  filters: { neverCurated: boolean; noPhoto: boolean; blocked: boolean }
  setFilters: (f: Partial<ReturnType<typeof useSchoolAudit>['filters']>) => void
}

// useVenueAudit.ts — EXISTING, extend only
filters: { missingCalendar: boolean; missingPhoto: boolean; zeroEvents: boolean; blocked: boolean }
// rows become AuditVenueRow[] (diagnosis + consecutive_failures + has_open_suggestions)

// useBlockSource.ts
export function useBlockSource(domain: AdminDomain): {
  block: (req: BlockRequest) => Promise<void>
  unblock: (id: string) => Promise<void>
  blocking: boolean
}

// useBlockedSources.ts
export function useBlockedSources(): {
  items: BlockedSource[]; count: number; loading: boolean
}

// useEntityDetail.ts — the detail page's single source of truth
export function useEntityDetail(
  entityType: 'venue' | 'school',
  id: string,
): {
  entity: Venue | School | null
  fields: AdminFieldModel[]        // ordered per fieldMeta.ts
  counts: { total: number; held: number; empty: number; notes: number }
  lastCuratedAt: string | null
  loading: boolean
  /** staged, not yet saved */
  edits: Record<string, unknown>
  setEdit: (field: string, value: unknown) => void
  discard: () => void
  save: () => Promise<void>
  dirtyCount: number
}
```

`setEdit` stages locally; `save` fires one `apply_field_override` per dirty field, then invalidates. Staging in the hook is what makes `Save {n} changes` and `DISCARD` honest, and what lets the unsaved-changes guard work.

### 4.4 `fieldMeta.ts` — the field registry

Field order, labels, editors, and empty-state consequences are **data**, not JSX. This is what keeps 7a and 7b from drifting apart and makes "most-corrected first" enforceable.

```ts
interface FieldMeta {
  name: string
  label: string
  editor: FieldEditor
  /** rendered when the value is empty; names the user-facing cost */
  consequence?: string
  options?: readonly string[]
  maxLength?: number
  hint?: string
}

export const VENUE_FIELDS: readonly FieldMeta[] = [
  { name: 'photo_url',  label: 'PHOTO',        editor: 'image',    consequence: 'CARDS SHOW A BLANK' },
  { name: 'name',       label: 'NAME',         editor: 'text' },
  { name: 'venue_type', label: 'TYPE',         editor: 'enum',
    options: ['storefront','institutional','experimental','school'] },
  { name: 'calendar_url', label: 'CALENDAR URL', editor: 'url',
    consequence: 'NOTHING GETS CURATED' },
  { name: 'neighborhood', label: 'NEIGHBORHOOD', editor: 'text' },
  { name: 'accessibility_info', label: 'ACCESSIBILITY', editor: 'textarea',
    consequence: 'SHOWS AS A GAP' },
  { name: 'address',     label: 'ADDRESS',     editor: 'text' },
  { name: 'price_range', label: 'PRICE',       editor: 'enum', options: ['$','$$','$$$'],
    consequence: 'NO PRICE ON THE CARD' },
  { name: 'website_url', label: 'WEBSITE',     editor: 'url' },
  { name: 'genre_tags',  label: 'GENRE',       editor: 'tags' },
  { name: 'description', label: 'DESCRIPTION', editor: 'textarea' },
  { name: 'latitude',    label: 'LOCATION',    editor: 'latlng',
    consequence: 'MISSING FROM THE MAP' },
] as const

export const SCHOOL_FIELDS: readonly FieldMeta[] = [
  { name: 'photo_url',  label: 'PHOTO',      editor: 'image',
    consequence: 'THE MAP SHOWS A BLANK' },
  { name: 'name',       label: 'NAME',       editor: 'text' },
  { name: 'short_name', label: 'SHORT NAME', editor: 'text', maxLength: 14,
    hint: 'THE MAP LABEL' },
  { name: 'price_band', label: 'PRICE BAND', editor: 'enum', options: ['$','$$','$$$'] },
  { name: 'discipline', label: 'DISCIPLINE', editor: 'enum', options: ['improv','acting'] },
  { name: 'payment_plan',  label: 'PAYMENT PLAN',  editor: 'boolean' },
  { name: 'financial_aid', label: 'FINANCIAL AID', editor: 'boolean' },
  { name: 'sliding_scale', label: 'SLIDING SCALE', editor: 'boolean' },
  { name: 'neighborhood',  label: 'NEIGHBORHOOD',  editor: 'text' },
  { name: 'url',        label: 'WEBSITE',    editor: 'url' },
  { name: 'address',    label: 'ADDRESS',    editor: 'text' },
] as const
```

`schools` has **no `photo_url_source`** column, unlike `venues` — so the school photo field renders no attribution line. Do not invent a provenance the table cannot store.

---

## 5. Routing

```tsx
// src/App.tsx, inside the authed /app branch
<Route path="admin" element={<Docs />} />                                  {/* existing */}
<Route path="admin/venue/:id" element={<AdminVenueDetail />} />            {/* NEW */}
<Route path="admin/school/:id" element={<AdminSchoolDetail />} />          {/* NEW */}
```

Both wrapped in the existing admin guard (`ADMINS` in `src/lib/constants.ts`, as `Header.tsx` does). Real routes, not modals: the admin needs back/forward and a shareable URL.

- Return path: `navigate(-1)`. The audit filter survives because it lives in the `useVenueAudit` hook state — **do not** remount the panel on return; keep `Docs.tsx` mounted or lift the filter into `sessionStorage`.
- Detail pages render **no bottom nav**; they render the save bar instead. An edit context should not offer five ways to abandon unsaved work.
- Unsaved guard: `useBeforeUnload` + a `<Prompt>`-equivalent on `dirtyCount > 0`.

---

## 6. The curator guard — the integration points

**This is the ticket that can silently fail.** `field_overrides` without the guard is a table that does nothing.

```ts
// supabase/functions/_shared/curator/overrides.ts
export async function heldFields(
  sb: SupabaseClient, entityType: OverridableEntity, entityId: string,
): Promise<Set<string>>

/** Split an extraction into what may be written and what must be filed. */
export function filterWritable<T extends Record<string, unknown>>(
  extracted: T, held: Set<string>,
): { writable: Partial<T>; blocked: Partial<T> }

/** Park a blocked value with its evidence. Upserts on (entity, field). */
export async function fileSuggestion(
  sb: SupabaseClient,
  s: { entityType: OverridableEntity; entityId: string; field: string;
       value: unknown; evidence: SuggestionEvidence },
): Promise<void>
```

Every write site must follow this shape:

```ts
const held = await heldFields(sb, 'venue', venueId)
const { writable, blocked } = filterWritable(extracted, held)
if (Object.keys(writable).length) await sb.from('venues').update(writable).eq('id', venueId)
for (const [field, value] of Object.entries(blocked)) {
  await fileSuggestion(sb, { entityType: 'venue', entityId: venueId, field, value, evidence })
}
```

Audit these call sites — grep for `.from('venues').update`, `.from('schools').update`, `.from('class_sessions').upsert`, `.from('events').upsert` across `supabase/functions/`:

| Site | Entity | Notes |
|---|---|---|
| venue enrichment (photo, calendar_url, venue_type, lat/lng) | `venue` | the highest-traffic writer |
| event scrape persistence | `event` | per-event overrides are rare but must be honoured |
| class extraction (v4) | `school`, `class_session` | writes `schools.address` and session fields |
| geocode auto-fix | `venue`, `school` | writes lat/lng — a hand-corrected pin must survive |
| discovery auto-insert | `venue`, `school` | inserts only; no override can exist yet, so no guard needed — **document that** so a future reader does not add one and mask a bug |
| play backfill | `event` | writes `play_id` |

Add one integration test per row. The test that matters: **hold 3 fields, run the curator, assert 0 of the 3 changed and 3 suggestions exist.**

Evidence to attach when filing a suggestion, so 7c can pick its default button:
- `calendar_url` → `events_found` at the suggested URL vs `events_found_current`
- `venue_type` / `discipline` → `confidence` from `VenueTypeResult`
- anything else → `source_url` at minimum

---

## 7. Component contracts

All props are required unless marked `?`. Every component is presentational except where noted — data comes from hooks in the panel, not from fetches inside these.

```ts
CoverageDomainTabs  { domain: AdminDomain; counts: Record<AdminDomain, number>;
                      onChange: (d: AdminDomain) => void }

CoverageBar         { totalKnown: number; totalOurs: number; withCalendar: number;
                      missingCalendar: number; animate?: boolean }

WorkActions         { domain: AdminDomain; lastRunAt: string | null;
                      queueCount: number; backfillCount: number;
                      running: 'find' | 'curate' | null;
                      onFind: () => void; onCurate: () => void;
                      onQueue: () => void; onBackfill: () => void }

NeedsALookTiles     { tiles: Array<{ key: string; label: string; count: number;
                                     severity: 'neutral' | 'danger'; active: boolean }>;
                      onToggle: (key: string) => void }

AuditRow            { row: AuditVenueRow | AuditSchoolRow;
                      onOpen: () => void; onCurate: () => void; onBlock: () => void }

DryPipelineCard     { schoolCount: number; onCurateAll: () => void }
                    // render nothing unless sessionCount === 0 && schoolCount > 0 —
                    // the guard lives in the PANEL, not in this component

DisciplineBar       { byDiscipline: Partial<Record<Discipline, number>>; total: number }
                    // iterate the object; never a hardcoded discipline list

ClassFieldTiles     { sessionCount: number;
                      fields: Array<{ label: string; count: number }> }
                    // colour derives from count vs sessionCount, not from props

BlockSheet          { target: { entityType: BlockableEntity; id: string;
                                name: string; domain: string | null;
                                affectedClasses: number; affectedEvents: number };
                      onConfirm: (r: BlockRequest) => void; onCancel: () => void }

BlockedList         { items: BlockedSource[]; onUnblock: (id: string) => void }

ProvenanceStrip     { total: number; held: number; empty: number;
                      notes: number; lastCuratedAt: string | null;
                      onOpenNotes: () => void }

AdminField          { model: AdminFieldModel;
                      draft: unknown | undefined;
                      onChange: (v: unknown) => void;
                      onRelease: () => void }

SuggestionCard      { suggestion: CuratorSuggestion; currentValue: unknown;
                      label: string;
                      onAccept: () => void; onDismiss: () => void }
                    // which button is filled derives from evidence (§8), not from props
```

Two rules that keep the data-driven promises real: severity and colour are **derived inside** the component from counts, never passed in as a style; and `DisciplineBar` iterates `byDiscipline`, so re-adding a reserved discipline needs no code change.

---

## 8. Derived logic — put these in `src/lib/`, not in components

```ts
// blocklist.ts
export function normalizeDomain(url: string | null): string | null
// must match SQL normalize_domain() exactly; shared test fixture

// diagnosis.ts
export function diagnoseVenue(v: {...}, profile?: SiteProfileRow): Diagnosis
export function diagnoseSchool(s: {...}): Diagnosis
// precedence, first match wins, max 3 ' · ' segments:
//   aggregator → dead_site (consecutive_failures >= 2) → mistyped
//   → no_calendar → never_curated → ok
// dead_site label: `DEAD SITE ×${consecutive_failures}`  (site_profiles — already
// in the DB, surfaced nowhere today)

// suggestions.ts
export function preferSuggestion(s: CuratorSuggestion): boolean
// true → TAKE THEIRS is the filled button. Rules:
//   evidence.events_found > (evidence.events_found_current ?? 0)  → true
//   evidence.confidence != null && evidence.confidence < 0.75     → false
//   times_suggested >= 3                                          → true
//   otherwise                                                     → false
// Always render BOTH buttons at >=44px. The recommendation is a default, never a lock.

// fieldState.ts
export function fieldState(value: unknown, override: FieldOverride | null): FieldState
// override → 'held'; empty string / null / [] → 'empty'; else 'curated'
```

---

## 9. Copy — presentation layer only (F90)

Swap table is `ADMIN-COVERAGE.md` §0.1. Scope discipline: change **strings**, not identifiers. Do not rename `ScrapeContext`, `scrape_jobs`, `scraped_at`, `ScraperDashboard`, `AdminScrapeRibbon`, or any edge function. Renaming the data layer risks the pipeline for zero user benefit.

Grep gates for the PR: `rg -i 'scrap' src/ --glob '!*.test.*'` should return only identifiers, never a string literal that reaches the screen. New components added by this work are named `Curation*`.

Where dates render: `CURATED {MON D}` when `last_curated_at` is set, `NEVER CURATED` in `var(--danger)` when null. Never `Never` in sentence case, never an empty cell.

---

## 10. Test plan

**Unit**
- `normalizeDomain` — 10 fixtures, run through both TS and SQL, assert equality
- `diagnoseVenue` / `diagnoseSchool` — one case per `DiagnosisKind`, plus precedence when two conditions are true
- `preferSuggestion` — each rule, plus the ambiguous default
- `fieldState` — `''`, `null`, `[]`, `0`, `false` (note: `0` and `false` are **values**, not empty)

**Integration (the ones that protect the promises)**
1. Hold 3 fields → run the curator → assert those 3 columns unchanged and 3 `curator_suggestions` rows exist
2. Block a domain → run discovery → assert the domain is not inserted and the run's `blocked` count incremented
3. Block a venue → assert it leaves map data, Tonight, and Discover
4. Unblock → assert it returns
5. `accept_suggestion` → assert the column updated **and** the override deleted
6. Dismiss twice → assert `muted`
7. `apply_field_override` twice on one field → assert `previous_value` still holds the curator's original
8. `apply_field_override` with a bogus field name → assert it raises, no partial write

**Visual**
- Both panels at 390×844: assert `scrollHeight - clientHeight === 0` on the scroller
- Both themes for every frame
- Assert no `<button>` computes below 44px:
  ```js
  [...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height < 44)
  ```
  must be empty. Provenance chips are `<span>`s and correctly exempt.

---

## 11. Ship order

Each step is independently deployable and leaves the app working.

| Step | Ships | Why here |
|---|---|---|
| 1 | migration 1 — class coverage RPC | fixes a live wrong number, no UI change |
| 2 | migrations 2–3 + `blocklist.ts` + enforcement | the requested capability; enforcement ships **with** the table |
| 3 | `BlockSheet` + `BlockedList` + `useBlockSource` | now blocking has a UI |
| 4 | migration 4 — theatre-only disciplines | `tsc` walks you through the client cleanup |
| 5 | migration 5 + `CoverageDomainTabs` + panel split | the visible reorganisation |
| 6 | `CoverageBar`, `WorkActions`, `NeedsALookTiles`, `AuditRow`, `diagnosis.ts` | 6a |
| 7 | `DryPipelineCard`, `DisciplineBar`, `ClassFieldTiles` | 6b |
| 8 | migration 6 + `field_overrides` + **the §6 guard** | never ship the table without the guard |
| 9 | detail routes, `AdminField`, `fieldMeta.ts`, `useEntityDetail` | 7a / 7b |
| 10 | migration 7 + `curator_suggestions` + `SuggestionCard` | 7c |
| 11 | copy sweep §9 | cosmetic, last |
| 12 | delete `CoverageMetricsCards.tsx`, `VenueAuditTable.tsx` | once nothing imports them |

If only two things ship: **step 1** (a wrong number is worse than a missing one) and **step 2** (the capability that was asked for). Steps 8 and 9 must ship together — an editable page whose edits get overwritten is worse than no editable page.
