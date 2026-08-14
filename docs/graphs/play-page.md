# Graph Engineering: Play Page Upgrade — F30 / F31 / F32 / F33

**Version:** 1.0.0
**Date:** 2026-08-13
**Nodes:** 7 | **Phases:** 5 | **Loop specs:** 3

Design source: `docs/design/v3/design_handoff_house_record/PLAY-AND-WAITING.md`
PRD + Architecture: `.claude/docs/prd/play-page.md`

This document is the executable build specification. Read Section 5 (Build Phases) to find the starting node. Read the node spec and loop spec. Execute. Mark complete. Advance.

**Additive-only constraint**: only `src/pages/PlayDetail.tsx` and new files are modified. No existing page, component, or hook is touched.

---

## Predecessor Graph (v0.1 by prd-specialist, retained for reference)

The v0.1 graph below (10 nodes, 4 phases) contains the full PRD-level feature breakdown including the MyShows shelf, emotion trigger, and waiting-card utility. It remains valid as a feature-complete roadmap.

The v1.0 graph above consolidates those 10 nodes into 7 architectural units: the additive-only constraint eliminates the MyShows node from this ticket's scope, and the emotion trigger is deferred to a future dedicated F34 migration. The 5-phase build order is stricter and implementable by a single agent without inter-node conflicts.

**Which graph to follow for implementation:** use v1.0 (this document). Use v0.1 for the fuller feature picture and the loop specs for pp-waiting-card and pp-your-people, which have more detailed canned-copy specifications.

---

---

## Section 1: Task Graph Topology (v1.0)

### Nodes

```
FOUNDATION:    pp-migration
TYPES:         pp-emotion-ink, pp-types
HOOKS:         pp-hooks
COMPONENTS:    pp-components
ORCHESTRATOR:  pp-playdetail
VERIFY:        pp-verify
```

### Edges

```
pp-migration   --> pp-types
pp-migration   --> pp-hooks
pp-types       --> pp-emotion-ink
pp-types       --> pp-hooks
pp-types       --> pp-components
pp-emotion-ink --> pp-components
pp-hooks       --> pp-playdetail
pp-components  --> pp-playdetail
pp-playdetail  --> pp-verify
```

### Parallelism

- `pp-types` and `pp-emotion-ink` can start immediately after `pp-migration` completes
- `pp-hooks` and `pp-components` run in parallel after both `pp-types` and `pp-emotion-ink` complete
- `pp-playdetail` gates on both `pp-hooks` and `pp-components`

---

## Section 2: Node Specifications (v1.0)

---

### Node: pp-migration

- **Type**: migration
- **Depends on**: (none)
- **Outputs**: `supabase/migrations/20260813000001_play_interest.sql`
- **Loop pattern**: one-shot
- **Success criteria**: `supabase db push` succeeds; `play_interest`, `play_waiting_counts`, `play_waiting_trend`, `play_emotion_counts`, and `play_spectrum` all exist; four new nullable columns on `plays`; unauthenticated insert to `play_interest` returns 401
- **Estimated effort**: Small

```sql
-- play_interest: want attached to the work, not a production
create table public.play_interest (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  play_id     uuid not null references public.plays(id) on delete cascade,
  city        text not null,
  created_at  timestamptz not null default now()
);
create unique index on public.play_interest (user_id, play_id);
create index on public.play_interest (play_id, city);
create index on public.play_interest (play_id, city, created_at);

alter table public.play_interest enable row level security;
create policy "Users manage their own play interest"
  on public.play_interest for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Aggregate counts (never exposes user IDs)
create view public.play_waiting_counts as
  select play_id, city, count(*)::int as waiting
  from public.play_interest group by play_id, city;
grant select on public.play_waiting_counts to anon, authenticated;

-- 8-bucket monthly sparkline
create view public.play_waiting_trend as
  select play_id, city,
    to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
    count(*)::int as count
  from public.play_interest
  group by play_id, city, date_trunc('month', created_at);
grant select on public.play_waiting_trend to anon, authenticated;

-- Cross-production emotion aggregate (seeded empty; trigger populated in F34)
create table public.play_emotion_counts (
  play_id uuid not null references public.plays(id) on delete cascade,
  emotion text not null,
  weight  numeric not null default 0,
  primary key (play_id, emotion)
);
alter table public.play_emotion_counts enable row level security;
create policy "Anyone can read play emotion counts"
  on public.play_emotion_counts for select using (true);
grant select on public.play_emotion_counts to authenticated;

create view public.play_spectrum as
  select play_id, emotion,
    round(100 * weight / nullif(sum(weight) over (partition by play_id), 0))::int as pct
  from public.play_emotion_counts;
grant select on public.play_spectrum to authenticated;

-- New nullable columns on plays
alter table public.plays add column if not exists premise text;
alter table public.plays add column if not exists read_prompt text;
alter table public.plays add column if not exists library_url text;
alter table public.plays add column if not exists adjacent_event_id uuid
  references public.events(id) on delete set null;
```

---

### Node: pp-types

- **Type**: types
- **Depends on**: pp-migration
- **Outputs**: `src/lib/types.ts` (additive append only)
- **Loop pattern**: one-shot
- **Success criteria**: `npm run build` compiles without errors; `PlayInterest`, `PlayWaiting`, `PlayWaitingTrend` are importable; the existing `Play` interface gains `premise`, `read_prompt`, `library_url`, `adjacent_event_id` — no existing interface is modified
- **Estimated effort**: Trivial

Append after `HOUSE_RANKS` constant in `src/lib/types.ts`:

```ts
export interface PlayInterest {
  id: string; user_id: string; play_id: string; city: string; created_at: string
}
export interface PlayWaiting {
  play_id: string; city: string; waiting: number
}
export interface PlayWaitingTrend {
  play_id: string; city: string; month: string; count: number  // month: 'YYYY-MM'
}
```

Add to existing `Play` interface (additive fields):
```ts
premise: string | null
read_prompt: string | null
library_url: string | null
adjacent_event_id: string | null
```

---

### Node: pp-emotion-ink

- **Type**: lib
- **Depends on**: pp-types
- **Outputs**: `src/lib/emotions.ts` (additive append only)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `ink()`, `fillLight()`, `edgeLight()` exported; all twelve emotions produce `ink()` values with L ≤ 0.48 (≥ 4.5:1 contrast on `#f6f1e3`); existing `base/fill/edge/bright` exports unchanged; `npm run test` passes
- **Estimated effort**: Trivial

Append after the `bright` function, before `emotionBySlug`:

```ts
/** Text color for emotion labels on a light/paper (#f6f1e3) background. Never use as a fill. */
export const ink = (e: EmotionDef) =>
  `oklch(${Math.min(e.l - 0.14, 0.48).toFixed(2)} ${e.c} ${e.h})`

/** Pill background for light theme. */
export const fillLight = (e: EmotionDef) =>
  `oklch(0.94 ${(e.c * 0.25).toFixed(3)} ${e.h})`

/** Pill border for light theme. */
export const edgeLight = (e: EmotionDef) =>
  `oklch(0.72 ${(e.c * 0.5).toFixed(3)} ${e.h})`
```

Verify: `ink({ l: 0.82, c: 0.15, h: 90 })` → `oklch(0.48 0.15 90)`. `ink({ l: 0.58, c: 0.12, h: 330 })` → `oklch(0.44 0.12 330)`. Confirm L ≤ 0.48 for all twelve.

---

### Node: pp-hooks

- **Type**: hooks
- **Depends on**: pp-types, pp-migration
- **Outputs**:
  - `src/hooks/usePlayInterest.ts` (new)
  - `src/hooks/usePlaySpectrum.ts` (new)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Both hooks compile; `usePlayInterest` returns correct shape; `toggle()` performs optimistic update both directions and reverts on error; `usePlaySpectrum` returns `{ slices, totalCards, loading }`
- **Estimated effort**: Small

**`usePlayInterest` signature:**
```ts
interface TrendBucket { month: string; count: number }
export interface UsePlayInterestResult {
  isWaiting: boolean
  waitingCount: number        // 0 when no play_waiting_counts row
  trend: TrendBucket[]        // up to 8 items, oldest → newest
  loading: boolean
  toggle: () => Promise<void> // upsert or delete, optimistic
}
export function usePlayInterest(playId: string): UsePlayInterestResult
```

Pattern: mirrors `useWatchlist.ts` exactly — `useCallback` for toggle, `useEffect` for load, optimistic state with revert on error. On mount: fetch `profiles.home_city`, then `Promise.all` three queries: `play_interest` (own row), `play_waiting_counts` (city count), `play_waiting_trend` (up to 8 rows ORDER BY month ASC).

**`usePlaySpectrum` signature:**
```ts
export interface UsePlaySpectrumResult {
  slices: SpectrumSlice[]; totalCards: number; loading: boolean
}
export function usePlaySpectrum(playId: string): UsePlaySpectrumResult
```

Pattern: `Promise.all([play_spectrum WHERE play_id=?, sum(weight) FROM play_emotion_counts WHERE play_id=?])`. Returns empty slices + 0 totalCards when no data.

---

### Node: pp-components

- **Type**: components
- **Depends on**: pp-types, pp-emotion-ink
- **Outputs** (all new, in `src/components/play/`):
  - `src/components/play/PlayActionBar.tsx`
  - `src/components/play/WaitingBlock.tsx`
  - `src/components/play/PlaySpectrumBlock.tsx`
  - `src/components/play/StagedProductionsBlock.tsx`
  - `src/components/play/UnstagedBlock.tsx`
  - `src/components/play/PlayPeopleBlock.tsx`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: All six compile; `PlaySpectrumBlock` passes `height={11}` to `SpectrumBar` unmodified; all token references use `var(--token)` from `tokens.css` — no hardcoded hex; all interactive elements ≥ 44px height; `WaitingBlock` renders 8 bars when `trend` prop is present; `npm run build` clean
- **Estimated effort**: Medium

**Signatures:**

```ts
// PlayActionBar
interface Props { isWaiting: boolean; onWantToggle: () => void; onLogSeen: () => void }

// WaitingBlock
interface Props {
  city: string; waitingCount: number
  trend?: TrendBucket[]        // present → 8-bar sparkline (UNSTAGED)
  hasActiveProduction: boolean // true → "SOMEONE ANNOUNCED IT" footer (STAGED)
}

// PlaySpectrumBlock
interface Props {
  slices: SpectrumSlice[]; totalCards: number
  mode: 'staged' | 'unstaged'  // controls label copy
  isDark: boolean               // drives ink() vs base() on percentage labels
}
// Uses: <SpectrumBar height={11} .../> and <InterpretationSentence .../> unmodified

// StagedProductionsBlock — extracts existing inline production list from PlayDetail.tsx
interface ProductionRow { event: Event; userSeen: boolean; userSeenDate: string | null }
interface Props { productions: ProductionRow[]; onProductionClick: (eventId: string) => void }

// UnstagedBlock
interface Props {
  playTitle: string; playwright: string
  libraryUrl?: string | null
  adjacentEvent?: Pick<Event, 'id' | 'title'> & { venueName?: string } | null
}

// PlayPeopleBlock
interface FriendWatcher {
  friendName: string; avatarUrl: string | null; relation: 'seen' | 'waiting'
  seenCity?: string; seenYear?: number; quote?: string | null
}
interface Props {
  friends: FriendWatcher[]; othersSeenCount: number; othersWaitingCount: number
  mode: 'staged' | 'unstaged'
}
```

**Key visual specs (from PLAY-AND-WAITING.md and THEMING.md):**

`PlayActionBar`: gap 9px, padding `0 20px 14px`. Primary button `flex:1 height:48px` Newsreader italic 16px — default `--accent` fill `--accent-on` text; waiting state `--accent-bg` bg `1.5px solid var(--accent)` `--accent-text`. Secondary `width:104px height:48px border:1px solid var(--rule)` Courier Prime 10px. `aria-pressed` on primary.

`WaitingBlock`: `border:1px solid var(--accent-border) background:var(--accent-bg) border-radius:3px padding:14px 15px margin:0 20px 14px`. Count in JetBrains Mono 14px `--accent-text` right-aligned. Trend bars: `display:flex align-items:flex-end height:34px gap:3px`. Each bar `flex:1 border-radius:1px`, height `(count/maxCount)*100%`. Color ramp oldest `oklch(0.80 0.06 55)` → newest `var(--accent)`.

`PlaySpectrumBlock`: `background:var(--bg-card) border-top:1px solid var(--rule) border-bottom:1px solid var(--rule) padding:14px 20px`. Label Courier Prime 11px `letter-spacing:0.14em --ink-faint`.

`UnstagedBlock`: library row uses `var(--access)` (green token) for the FREE label and FIND IT link. Adjacent row uses `var(--accent)` for LOOK link.

---

### Node: pp-playdetail

- **Type**: page
- **Depends on**: pp-hooks, pp-components
- **Outputs**: `src/pages/PlayDetail.tsx` (full rewrite, ~238 → ~380 lines)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Page loads without console errors; staged state renders all six sections in correct order; unstaged state shows 8-bar trend in WaitingBlock and UnstagedBlock; toggle writes to `play_interest` and persists on reload; `npm run build` clean; no other file modified
- **Estimated effort**: Medium

**Top-level state:**
```ts
const { playId } = useParams<{ playId: string }>()
const navigate = useNavigate()
const { user } = useAuth()
const { isDark } = useTheme()
const { isWaiting, waitingCount, trend, toggle, loading: interestLoading } = usePlayInterest(playId!)
const { slices: playSlices, totalCards: playTotalCards } = usePlaySpectrum(playId!)
const [play, setPlay] = useState<Play | null>(null)
const [allProductions, setAllProductions] = useState<ProductionRow[]>([])
const [userCity, setUserCity] = useState('chicago')
const [friendsSeen, setFriendsSeen] = useState<FriendWatcher[]>([])
const [friendsWaiting, setFriendsWaiting] = useState<FriendWatcher[]>([])
const [loading, setLoading] = useState(true)

const today = new Date().toISOString().split('T')[0]
const hasActiveProduction = allProductions.some(p => p.event.end_date && p.event.end_date >= today)
const mode: 'staged' | 'unstaged' = hasActiveProduction ? 'staged' : 'unstaged'
```

**Render tree:**
```
<div scroll container>
  <ChromeRow />                     // inline: ← / THE PLAY / ⋯
  <TitleBlock />                    // inline: title, playwright, year, premise, awards
  <PlayActionBar isWaiting onWantToggle={toggle} onLogSeen={handleLogSeen} />
  <WaitingBlock
    city={userCity}
    waitingCount={waitingCount}
    trend={mode === 'unstaged' ? trend : undefined}
    hasActiveProduction={mode === 'staged'}
  />
  {playSlices.length > 0 && (
    <PlaySpectrumBlock slices={playSlices} totalCards={playTotalCards} mode={mode} isDark={isDark} />
  )}
  {mode === 'staged'
    ? <StagedProductionsBlock productions={allProductions} onProductionClick={...} />
    : <UnstagedBlock playTitle={play.title} playwright={play.playwright}
        libraryUrl={play.library_url} adjacentEvent={adjacentEvent} />
  }
  {(friendsSeen.length > 0 || friendsWaiting.length > 0) && (
    <PlayPeopleBlock
      friends={[...friendsSeen, ...friendsWaiting]}
      othersSeenCount={othersSeenCount}
      othersWaitingCount={othersWaitingCount}
      mode={mode}
    />
  )}
</div>
```

**Data flow (two useEffect calls):**
1. Primary (deps: `[playId, user]`): `Promise.all` — play record, all events with venues, user watchlist seen-map. Sets `play`, `allProductions`, `userCity`.
2. Secondary (deps: `[play, user]`, fires after primary): friend IDs from `friendships WHERE status='accepted'`, then `play_interest WHERE play_id=? AND user_id IN (friendIds)` for `friendsWaiting`, and `watchlist WHERE event_id IN (...) AND user_id IN (friendIds) AND status='seen'` JOIN profiles for `friendsSeen`.

---

### Node: pp-verify

- **Type**: verification
- **Depends on**: pp-playdetail
- **Outputs**: (none — acceptance gate only)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: All items in design spec acceptance checklist pass; both themes verified at 390×844; `npm run build` and `npm run test` both green
- **Estimated effort**: Small

Checklist (from PLAY-AND-WAITING.md §7):
- [ ] `Want to see it` persists on a play with zero productions, survives reload
- [ ] Seeing a production does not clear the play interest (`play_interest` row persists after watchlist update)
- [ ] Waiting count and 8-bucket trend render in both light and dark themes
- [ ] Unstaged page always renders a library link AND an adjacent show or fallback
- [ ] YOUR PEOPLE renders visible within 844px on a 390px screen
- [ ] Spectrum bar fills use `base()`; percentage labels use `ink()` on light, `base()` on dark
- [ ] No individual waiter identifiable beyond accepted friends
- [ ] `npm run build` — zero TypeScript errors
- [ ] `npm run test` — no regressions in existing tests

---

## Section 3: Loop Specifications (v1.0)

### Loop: pp-emotion-ink

- **Trigger**: Node execution begins
- **Inner cycle**:
  1. Plan: Read `THEMING.md §4`. Identify the three problem emotions: Delighted (L 0.82), Electrified (0.80), Buzzing (0.76). Derive target values using `min(L - 0.14, 0.48)`. Confirm formulas for `fillLight` and `edgeLight`.
  2. Execute: Append `ink`, `fillLight`, `edgeLight` after `bright` in `emotions.ts`. No modification above that line.
  3. Verify: `ink({ l: 0.82, c: 0.15, h: 90 })` → `oklch(0.48 0.15 90)`. Confirm all twelve produce L ≤ 0.48. `npm run test` passes.
- **Evaluator**: All twelve `ink()` values pass 4.5:1 contrast on `#f6f1e3`; existing tests green
- **Retry**: Re-read formulas, correct clamp. Max 1 cycle.
- **Stop condition**: All twelve contrasts pass; build clean

---

### Loop: pp-components

- **Trigger**: pp-types and pp-emotion-ink both complete
- **Inner cycle**:
  1. Plan: For each component, read the exact pixel values from `PLAY-AND-WAITING.md §4/§5` and `THEMING.md §1–4`. Note all existing component import paths.
  2. Execute: Create `src/components/play/` directory. Write all six files. Import `SpectrumBar` and `InterpretationSentence` with their existing prop signatures unmodified.
  3. Verify: `npm run build` succeeds. Open dev browser at 390px in light theme. Inspect each component visually. Toggle to dark. Confirm no hardcoded hex.
- **Evaluator**: Zero TypeScript errors; all six components render in both themes; all touch targets ≥ 44px
- **Retry**: Fix type errors or visual bugs per component; re-run build. Max 2 cycles.
- **Stop condition**: Build clean; both themes verified

---

### Loop: pp-playdetail

- **Trigger**: pp-hooks and pp-components both complete
- **Inner cycle**:
  1. Plan: Read the current `PlayDetail.tsx` (238 lines) in full. Inventory every piece of state, every query, every render branch. Note the exact `useParams`, `useNavigate`, `useAuth` import chain. Plan the two `useEffect` calls.
  2. Execute: Rewrite `PlayDetail.tsx`. Import all six play components and both hooks. Preserve `ProductionRow` as a local interface (passed to `StagedProductionsBlock`). Wire `handleLogSeen` to navigate to the most recent event or show a toast.
  3. Verify: Navigate to a staged play — confirm six sections, correct order. Navigate to an unstaged play — confirm 8-bar trend in WaitingBlock and UnstagedBlock renders. Tap "Want to see it" — button state changes, persists on reload. `npm run build` clean.
- **Evaluator**: Both states render correctly; toggle persists; build passes; no other file is modified
- **Retry**: If a query returns wrong data, add console.log → inspect → fix the query (not the component). Max 2 cycles.
- **Stop condition**: Both page states verified; toggle verified; build and tests green; pp-verify can begin

---

## Section 5: Build Phases (v1.0)

### Phase 1: Foundation (sequential)

- [ ] **pp-migration** → `supabase/migrations/20260813000001_play_interest.sql`

Verify: `supabase db push` succeeds; tables and views exist in Supabase dashboard.

---

### Phase 2: Types and Emotion Helpers (parallel)

- [ ] **pp-types** → `src/lib/types.ts` additions
- [ ] **pp-emotion-ink** → `src/lib/emotions.ts` additions

Verify: `npm run build` clean; `npm run test` passes.

---

### Phase 3: Hooks (parallel with Phase 4)

- [ ] **pp-hooks** → `src/hooks/usePlayInterest.ts` and `src/hooks/usePlaySpectrum.ts`

Verify: TypeScript compile; hooks importable.

---

### Phase 4: Components (parallel with Phase 3)

- [ ] **pp-components**:
  - `src/components/play/PlayActionBar.tsx`
  - `src/components/play/WaitingBlock.tsx`
  - `src/components/play/PlaySpectrumBlock.tsx`
  - `src/components/play/StagedProductionsBlock.tsx`
  - `src/components/play/UnstagedBlock.tsx`
  - `src/components/play/PlayPeopleBlock.tsx`

Verify: `npm run build` clean; visual inspection in both themes.

---

### Phase 5: Orchestrator and Acceptance (sequential, gates on 3+4)

- [ ] **pp-playdetail** → `src/pages/PlayDetail.tsx` rewrite
- [ ] **pp-verify** → full acceptance checklist

Verify: all checklist items pass; `npm run build` and `npm run test` both green.

---

## File Index (v1.0)

| File | Node | Action |
|------|------|--------|
| `supabase/migrations/20260813000001_play_interest.sql` | pp-migration | Create |
| `src/lib/types.ts` | pp-types | Append (additive) |
| `src/lib/emotions.ts` | pp-emotion-ink | Append (additive) |
| `src/hooks/usePlayInterest.ts` | pp-hooks | Create |
| `src/hooks/usePlaySpectrum.ts` | pp-hooks | Create |
| `src/components/play/PlayActionBar.tsx` | pp-components | Create |
| `src/components/play/WaitingBlock.tsx` | pp-components | Create |
| `src/components/play/PlaySpectrumBlock.tsx` | pp-components | Create |
| `src/components/play/StagedProductionsBlock.tsx` | pp-components | Create |
| `src/components/play/UnstagedBlock.tsx` | pp-components | Create |
| `src/components/play/PlayPeopleBlock.tsx` | pp-components | Create |
| `src/pages/PlayDetail.tsx` | pp-playdetail | Rewrite (~238 → ~380 lines) |

**Not modified by this ticket:**
`src/components/SpectrumBar.tsx`, `src/components/InterpretationSentence.tsx`, `src/components/EmotionPill.tsx`, `src/hooks/useWatchlist.ts`, `src/hooks/useFriendActivity.ts`, `src/hooks/useEmotionAggregates.ts`, `src/pages/MyShows.tsx`, any other existing file.

---

## v0.1 Graph (prd-specialist, retained for fuller feature reference)

---

## Section 1: Task Graph Topology

### Nodes

```
FOUNDATION:   pp-migration, pp-types
DATA:         pp-hook-play-interest, pp-play-emotion-trigger
UI-CORE:      pp-title-block, pp-action-bar, pp-waiting-card
UI-SECTIONS:  pp-staged-sections, pp-unstaged-sections, pp-your-people
MYSHOWS:      pp-myshows-shelf
```

### Edges

```
pp-migration
    │
    ├──→ pp-types
    │         │
    │         ├──→ pp-hook-play-interest
    │         │         │
    │         │         ├──→ pp-title-block
    │         │         │         │
    │         │         ├──→ pp-action-bar
    │         │         │         │
    │         │         ├──→ pp-waiting-card
    │         │         │         │
    │         │         │    [pp-title-block + pp-action-bar + pp-waiting-card complete]
    │         │         │         │
    │         │         ├──→ pp-staged-sections
    │         │         ├──→ pp-unstaged-sections
    │         │         └──→ pp-your-people
    │         │                   │
    │         │              [all UI-SECTIONS complete]
    │         │                   │
    │         └──→ pp-myshows-shelf
    │
    └──→ pp-play-emotion-trigger  (independent of UI nodes)
```

### ASCII DAG

```
Phase 1 (Foundation):
  [pp-migration] → [pp-types]

Phase 2 (Data Layer):
  [pp-migration] → [pp-play-emotion-trigger]
  [pp-types]     → [pp-hook-play-interest]

Phase 3 (UI Core):
  [pp-hook-play-interest] → [pp-title-block]
  [pp-hook-play-interest] → [pp-action-bar]
  [pp-hook-play-interest] → [pp-waiting-card]

Phase 4 (UI Sections + MyShows):
  [pp-title-block + pp-action-bar + pp-waiting-card] → [pp-staged-sections]
  [pp-title-block + pp-action-bar + pp-waiting-card] → [pp-unstaged-sections]
  [pp-hook-play-interest] → [pp-your-people]
  [all UI-SECTIONS] → [pp-myshows-shelf]
```

---

## Section 2: Node Specifications

---

#### Node: pp-migration

- **Type:** scaffold
- **Agent:** backend-architect
- **Depends on:** (none)
- **Inputs:** Existing migrations in `supabase/migrations/`, specifically `20260731100001_plays.sql` (plays table) and `20260731100005_emotion_aggregates.sql` (trigger pattern to follow)
- **Outputs:**
  - `supabase/migrations/20260813000001_play_interest.sql`
- **Loop pattern:** plan-execute-verify
- **Success criteria:** `supabase db push` succeeds; `SELECT * FROM play_waiting_counts LIMIT 1` returns without error; `SELECT * FROM play_waiting_trend LIMIT 1` returns without error; `SELECT * FROM play_emotion_counts LIMIT 1` returns without error; RLS test: unauthenticated client cannot INSERT into `play_interest`
- **Estimated effort:** Small

---

#### Node: pp-types

- **Type:** feature
- **Agent:** backend-architect
- **Depends on:** pp-migration
- **Inputs:** `src/lib/types.ts` (existing), `src/lib/emotions.ts` (existing)
- **Outputs:**
  - `src/lib/types.ts` (modified — add `PlayInterest`, `TrendBucket`, `FriendSeen`, `FriendWaiting` interfaces; add `premise`, `read_prompt`, `library_url`, `adjacent_event_id` fields to `Play` interface)
- **Loop pattern:** one-shot
- **Success criteria:** `npm run build` compiles with no TypeScript errors; `Play` type includes `premise: string | null`, `library_url: string | null`, `adjacent_event_id: string | null`
- **Estimated effort:** Trivial

---

#### Node: pp-play-emotion-trigger

- **Type:** feature
- **Agent:** backend-architect
- **Depends on:** pp-migration
- **Inputs:** `supabase/migrations/20260731100005_emotion_aggregates.sql` (pattern to follow exactly), `play_emotion_counts` table created in pp-migration
- **Outputs:**
  - Trigger SQL appended to `supabase/migrations/20260813000001_play_interest.sql` OR in a new file `supabase/migrations/20260813000002_play_emotion_trigger.sql`
- **Loop pattern:** plan-execute-verify
- **Success criteria:** Log a show for a play (via watchlist upsert with emotions). Query `SELECT * FROM play_emotion_counts WHERE play_id = ?` — row exists with correct weight. Update the log with different emotions — weights update. Existing `event_emotion_counts` trigger still fires correctly (no conflict).
- **Estimated effort:** Small

---

#### Node: pp-hook-play-interest

- **Type:** feature
- **Agent:** frontend-developer
- **Depends on:** pp-types
- **Inputs:**
  - `src/hooks/useWatchlist.ts` (follow optimistic update pattern exactly)
  - `src/contexts/AuthContext.tsx` (`useAuth()` pattern)
  - `src/lib/supabase.ts` (supabase client)
  - `src/lib/types.ts` (after pp-types)
- **Outputs:**
  - `src/hooks/usePlayInterest.ts` (new file)
- **Loop pattern:** plan-execute-verify
- **Success criteria:** Hook renders without error in a test harness; `toggle()` writes to `play_interest` and updates `isWaiting` optimistically; calling `toggle()` again deletes the row and reverts `isWaiting`; `waitingCount` starts at the city-scoped count from `play_waiting_counts`; `trend` returns up to 8 `TrendBucket` items ordered oldest-first
- **Estimated effort:** Medium

---

#### Node: pp-title-block

- **Type:** feature
- **Agent:** frontend-developer
- **Depends on:** pp-hook-play-interest
- **Inputs:**
  - `src/pages/PlayDetail.tsx` (current stub, lines 80–141 for existing title/awards pattern to upgrade)
  - `src/lib/types.ts` (`Play` interface after pp-types)
  - PRD §FR4 for exact typography specs
- **Outputs:**
  - `src/pages/PlayDetail.tsx` (modified — this node replaces only the title block section of the file; the full page rewrite happens across pp-title-block, pp-action-bar, pp-waiting-card, pp-staged-sections, pp-unstaged-sections, pp-your-people)
- **Loop pattern:** plan-execute-verify
- **Success criteria:** Title renders at 31px Newsreader italic. Playwright renders at 15px `--ink-dim`. Year renders in `--ink-faint` with `·` separator. Premise renders with 3px left border accent when `play.premise` is non-null. Premise block is absent when `play.premise` is null. Awards render as chips. At 390px width, no text overflows horizontally.
- **Estimated effort:** Small

---

#### Node: pp-action-bar

- **Type:** feature
- **Agent:** frontend-developer
- **Depends on:** pp-hook-play-interest
- **Inputs:**
  - `src/hooks/usePlayInterest.ts` (after pp-hook-play-interest) — `isWaiting`, `toggle`
  - PRD §FR1, §FR10, §FR11 for exact button specs
  - Existing `useWatchlist` pattern in `ProductionDetail.tsx` lines 20–21 for `getStatus` pattern (reference only)
- **Outputs:**
  - `src/pages/PlayDetail.tsx` (modified — action bar section)
- **Loop pattern:** plan-execute-verify
- **Success criteria:** "Want to see it" button has `flex: 1; height: 48px`. Default state: gold fill, white text, Newsreader italic 16px. Waiting state: `--accent-bg` background, `--accent-text` text, `1.5px solid --accent` border. Toggle changes state immediately (optimistic). `aria-pressed` reflects `isWaiting`. "I'VE SEEN IT" button is 104px wide, 48px tall, outline style, navigates to log flow on tap.
- **Estimated effort:** Small

---

#### Node: pp-waiting-card

- **Type:** feature
- **Agent:** frontend-developer
- **Depends on:** pp-hook-play-interest
- **Inputs:**
  - `src/hooks/usePlayInterest.ts` — `waitingCount`, `trend`, `isWaiting`
  - PRD §FR5, §FR6 for exact visual specs
  - `src/lib/emotions.ts` — for `interpretSpectrum` pattern (reference for `interpretWaitingCount` utility)
- **Outputs:**
  - `src/pages/PlayDetail.tsx` (modified — WAITING IN CHICAGO card section)
  - `src/lib/waiting.ts` (new file — `interpretWaitingCount(count: number): string` and `interpretWaitingTrend(trend: TrendBucket[]): string` pure functions)
- **Loop pattern:** plan-execute-verify
- **Success criteria:** Card renders with `1px solid --accent-border` border and `--accent-bg` background. Count right-aligns in JetBrains Mono 14px `--accent-text`. Interpretation sentence from `interpretWaitingCount` renders below. STAGED state: footer row shows live dot + "SOMEONE ANNOUNCED IT — SEE BELOW" above a `1px dotted` rule. UNSTAGED state: 8 bars render in a 34px flex container, bars sized by count, color ramped oldest → newest, below the interpretation sentence. Zero count does not crash — shows "0". Trend with no data omits bars entirely.
- **Estimated effort:** Medium

---

#### Node: pp-staged-sections

- **Type:** feature
- **Agent:** frontend-developer
- **Depends on:** pp-title-block, pp-action-bar, pp-waiting-card
- **Inputs:**
  - `src/pages/PlayDetail.tsx` (after pp-title-block, pp-action-bar, pp-waiting-card)
  - `src/components/SpectrumBar.tsx` — for EVERY ROOM spectrum
  - `src/components/InterpretationSentence.tsx` — for spectrum interpretation
  - PRD §FR7, §FR8 for exact section specs
  - `src/lib/emotions.ts` — `base()` function for spectrum colors
- **Outputs:**
  - `src/pages/PlayDetail.tsx` (modified — EVERY ROOM section + JUST ANNOUNCED section, STAGED state only)
- **Loop pattern:** plan-execute-verify
- **Success criteria:** EVERY ROOM section renders with `SpectrumBar` at `height={11}` using `play_emotion_counts` data. Section omitted entirely when no emotion data. JUST ANNOUNCED section renders venue name at Newsreader italic 19px. Dates render in `--accent-text`. Director and cast render at 14px `--ink-dim`; "director not announced" shown when null. "TELL ME WHEN ON SALE" button renders at 40px height. "SHARE" button calls `navigator.share()` with the play URL. Past productions list shows max 2 rows. All renders correctly when `currentProductions` is non-empty.
- **Estimated effort:** Medium

---

#### Node: pp-unstaged-sections

- **Type:** feature
- **Agent:** frontend-developer
- **Depends on:** pp-title-block, pp-action-bar, pp-waiting-card
- **Inputs:**
  - `src/pages/PlayDetail.tsx` (after pp-title-block, pp-action-bar, pp-waiting-card)
  - `src/components/SpectrumBar.tsx`
  - `src/components/InterpretationSentence.tsx`
  - PRD §FR7, §FR9 for exact section specs
- **Outputs:**
  - `src/pages/PlayDetail.tsx` (modified — EVERY ROOM section + UNTIL SOMEBODY STAGES IT section, UNSTAGED state only)
- **Loop pattern:** plan-execute-verify
- **Success criteria:** EVERY ROOM section (relabeled "EVERY ROOM, EVERYWHERE") renders with cross-city emotion data. UNTIL SOMEBODY STAGES IT section always renders two rows. Row 1 always has a library link — uses `plays.library_url` when available, falls back to Chicago Public Library catalog search URL. Row 2 renders adjacent event if `plays.adjacent_event_id` is non-null and current; falls back to same-playwright current event; falls back to Goodman website link. "FIND IT →" link opens in new tab. "LOOK →" link navigates to `/app/show/{eventId}`. All renders correctly when `currentProductions` is empty.
- **Estimated effort:** Medium

---

#### Node: pp-your-people

- **Type:** feature
- **Agent:** frontend-developer
- **Depends on:** pp-hook-play-interest
- **Inputs:**
  - `src/hooks/useFriendships.ts` (accepted friends query pattern, lines 12–40)
  - `src/hooks/useFriendActivity.ts` (friend watchlist query pattern, lines 23–50)
  - PRD §FR10 for exact visual specs
  - `src/lib/types.ts` — `FriendSeen`, `FriendWaiting` interfaces (after pp-types)
- **Outputs:**
  - `src/pages/PlayDetail.tsx` (modified — YOUR PEOPLE section)
- **Loop pattern:** plan-execute-verify
- **Success criteria:** STAGED state: renders 34px avatar + first friend's quote (truncated to 80 chars) with left border. Summary line "+ N OTHERS HAVE SEEN IT · M ARE WAITING" in Courier Prime 10px `--ink-ghost`. UNSTAGED state: overlapping 30px avatars with `margin-left: -9px` from second. Single sentence listing first 2 friend names. Section entirely absent when no friends have seen or are waiting. `share_reflections = false` friends show "..." as quote. No pending friendships surface. Section renders within 844px — verified by visual inspection at 390×844.
- **Estimated effort:** Medium

---

#### Node: pp-myshows-shelf

- **Type:** feature
- **Agent:** frontend-developer
- **Depends on:** pp-hook-play-interest (for data shape), all UI-SECTION nodes (play page must be complete for the shelf links to land correctly)
- **Inputs:**
  - `src/pages/MyShows.tsx` (MarqueeView function, lines 185–416 — additive change only; existing three shelves unchanged)
  - `src/lib/supabase.ts` — for direct query of `play_interest JOIN plays`
  - `src/lib/types.ts` — `PlayInterest` interface
  - PRD §FR12 for exact visual specs
- **Outputs:**
  - `src/pages/MyShows.tsx` (modified — new `PlaysWaitingShelf` component added at bottom of MarqueeView; imports only)
- **Loop pattern:** plan-execute-verify
- **Success criteria:** When user has 0 `play_interest` rows, shelf section is entirely absent from MyShows marquee view. When user has ≥ 1 rows, "PLAYS YOU'RE WAITING FOR" header renders with count. Each row shows title (Newsreader italic 17px), playwright (Courier Prime 10px `--ink-dim`), status chip right-aligned. Status "NOBODY'S STAGING IT" in `--ink-ghost`. Status "ANNOUNCED · MAR 2027" in `--accent-text` when a current event exists. Tapping any row navigates to `/app/play/{playId}`. Existing three shelves are unmodified.
- **Estimated effort:** Small

---

## Section 3: Loop Specifications

### Loop: pp-migration

- **Trigger:** Node starts
- **Inner cycle:**
  1. Plan: Read `20260731100001_plays.sql` (plays table), `20260731100005_emotion_aggregates.sql` (trigger pattern). Draft the migration file with all objects: `play_interest` table, unique index, city index, trend index; `play_waiting_counts` view; `play_waiting_trend` view; `play_emotion_counts` table; RLS policies; GRANT statements; 4 new nullable columns on `plays`.
  2. Execute: Write `supabase/migrations/20260813000001_play_interest.sql`
  3. Verify: Run `supabase db push`. Check `\d play_interest` and `\d+ play_waiting_counts`. Test RLS: unauthenticated insert returns 401.
- **Evaluator:** `supabase db push` exits 0; all views queryable; RLS blocks unauthenticated write
- **Retry:** On SQL error, fix the specific statement and re-push. Max 3 cycles.
- **Stop condition:** All 3 verifications pass

---

### Loop: pp-play-emotion-trigger

- **Trigger:** pp-migration complete
- **Inner cycle:**
  1. Plan: Read `20260731100005_emotion_aggregates.sql` lines 48–92 (the `update_event_emotion_counts` trigger). Draft equivalent trigger function `update_play_emotion_counts()` that: resolves `play_id` from `event_emotion_counts.event_id` via `SELECT play_id FROM events WHERE id = NEW.event_id`; for each emotion, upserts into `play_emotion_counts (play_id, emotion, weight)`.
  2. Execute: Write trigger function and trigger statement to migration file
  3. Verify: Insert test watchlist entry with emotions for a play-linked event. Query `play_emotion_counts WHERE play_id = ?`. Expect row. Update emotions. Expect weight to update.
- **Evaluator:** `play_emotion_counts` reflects watchlist emotion changes within one trigger cycle
- **Retry:** On test failure, inspect trigger logic. Max 2 cycles.
- **Stop condition:** Insert and update test both pass

---

### Loop: pp-hook-play-interest

- **Trigger:** pp-types complete
- **Inner cycle:**
  1. Plan: Read `useWatchlist.ts` (full file). Map equivalent operations: `fetchWatchlist` → `fetchPlayInterest`; `addToWatchlist` → `toggle` (upsert or delete based on current state); `getStatus` → `isWaiting` boolean. Plan the profile city fetch (single `profiles` query on mount). Plan the trend query (ORDER BY month ASC, LIMIT 8).
  2. Execute: Write `src/hooks/usePlayInterest.ts`
  3. Verify: Import hook in `PlayDetail.tsx` stub. Call `toggle()`. Check network tab: upsert fires. Check state: `isWaiting` flips. Call `toggle()` again: delete fires, `isWaiting` reverts.
- **Evaluator:** Optimistic toggle works both directions; count updates in sync; trend populated from view; TypeScript compiles
- **Retry:** On type error, check `TrendBucket` interface matches view shape. Max 2 cycles.
- **Stop condition:** Both toggle directions verified, TypeScript clean

---

### Loop: pp-waiting-card

- **Trigger:** pp-hook-play-interest complete
- **Inner cycle:**
  1. Plan: Define `interpretWaitingCount(count: number): string` — returns canned sentences by range (0: "Be first in Chicago.", 1–9: "A small circle, so far.", 10–49: "A quiet crowd is building.", 50–199: "Real demand here.", 200+: "This one has a following."). Define `interpretWaitingTrend(trend: TrendBucket[]): string` — detects rising (last bar > first bar * 1.5), spike (penultimate bar is max), flat, falling. Write 8-bar renderer: `display: flex; align-items: flex-end; height: 34px; gap: 3px`. Each bar `flex: 1; border-radius: 1px`. Color computed via linear interpolation between `oklch(0.80 0.06 55)` and `var(--accent)` across bar index.
  2. Execute: Write `src/lib/waiting.ts`, add card JSX to `PlayDetail.tsx`
  3. Verify: Render WAITING card with count=0, count=42. Verify sentence changes. Render trend with 3 buckets — verify 3 bars render. Render trend with 8 buckets — verify 8 bars. STAGED state: verify "SOMEONE ANNOUNCED IT" footer shows. UNSTAGED state: verify bars appear.
- **Evaluator:** Count=0 does not crash. Trend with varying counts renders. Staged/unstaged footer difference visible.
- **Retry:** On color interpolation failure, simplify to static color for non-critical bars. Max 2 cycles.
- **Stop condition:** All verification cases pass

---

### Loop: pp-staged-sections

- **Trigger:** pp-title-block, pp-action-bar, pp-waiting-card all complete
- **Inner cycle:**
  1. Plan: EVERY ROOM — query `play_emotion_counts WHERE play_id = ?`, compute slices + totalCards (same pattern as `ProductionDetail.tsx` lines 38–50 for `event_emotion_counts`). JUST ANNOUNCED — use first entry from `currentProductions`. Format date range. Render director ("director not announced" if null). Render cast members (first 2, "+ N more"). Wire SHARE button to `navigator.share()` with fallback.
  2. Execute: Add EVERY ROOM and JUST ANNOUNCED JSX to `PlayDetail.tsx` (STAGED branch)
  3. Verify: Navigate to a play that has a current production. Verify venue name renders at 19px. Verify past productions list capped at 2. Navigate to a play with no emotions logged — verify EVERY ROOM section absent.
- **Evaluator:** Both sections render when data present. Both absent when data absent. No crash on null director/cast.
- **Retry:** On render crash, add null guards. Max 2 cycles.
- **Stop condition:** Manual verification on test play with and without emotion data

---

### Loop: pp-unstaged-sections

- **Trigger:** pp-title-block, pp-action-bar, pp-waiting-card all complete
- **Inner cycle:**
  1. Plan: EVERY ROOM — same as pp-staged-sections but labeled "EVERYWHERE". UNTIL SOMEBODY STAGES IT — Row 1: `plays.library_url ?? catalog URL`. Row 2: check `plays.adjacent_event_id` (join events, check end_date >= today); fallback to playwright query; fallback to Goodman URL.
  2. Execute: Add EVERY ROOM and UNTIL SOMEBODY STAGES IT JSX to `PlayDetail.tsx` (UNSTAGED branch)
  3. Verify: Navigate to a play with no current Chicago productions. Verify both rows of UNTIL section render. Row 1 taps open library link. Row 2 navigates to adjacent show or external URL. Verify fallback chain works (set `adjacent_event_id` to null, verify playwright fallback fires).
- **Evaluator:** Both rows always present. Library link opens. Adjacent link navigates correctly.
- **Retry:** On broken fallback chain, trace each condition. Max 2 cycles.
- **Stop condition:** All three fallback scenarios verified (adjacent event, playwright match, Goodman fallback)

---

### Loop: pp-your-people

- **Trigger:** pp-hook-play-interest complete
- **Inner cycle:**
  1. Plan: Friends who have seen — query watchlist for accepted friend IDs, filter by events with this play_id. Respect `share_reflections` flag. Take first result. Friends who are waiting — query `play_interest` for accepted friend IDs. Take up to 3 (for avatar overlap). Conditional render: if both empty, return null.
  2. Execute: Add YOUR PEOPLE JSX to `PlayDetail.tsx`
  3. Verify: With 0 friends, verify section absent. With 1 friend who has seen, verify quote renders with left border. With 2+ friends waiting, verify overlapping avatars with `margin-left: -9px`. Verify `share_reflections = false` shows "..." not the actual quote.
- **Evaluator:** Section absent when empty. Privacy flag respected. Avatar overlap correct.
- **Retry:** On query shape error, check JOIN conditions match `useFriendActivity.ts` pattern. Max 2 cycles.
- **Stop condition:** All four test scenarios verified

---

## Section 5: Build Phases

### Phase 1: Foundation

- [ ] pp-migration — creates `play_interest`, views, `play_emotion_counts`, new `plays` columns
- [ ] pp-types — updates `src/lib/types.ts`

### Phase 2: Data Layer

- [ ] pp-play-emotion-trigger — emotion aggregation trigger for play-level counts
- [ ] pp-hook-play-interest — `usePlayInterest(playId)` hook with optimistic toggle

### Phase 3: UI Core (all modify `src/pages/PlayDetail.tsx`)

- [ ] pp-title-block — title, playwright, premise, awards
- [ ] pp-action-bar — Want to see it / I'VE SEEN IT
- [ ] pp-waiting-card — WAITING IN CHICAGO with count, interpretation, trend (UNSTAGED) or footer (STAGED)

### Phase 4: UI Sections + MyShows

- [ ] pp-staged-sections — EVERY ROOM + JUST ANNOUNCED (STAGED branch of PlayDetail)
- [ ] pp-unstaged-sections — EVERY ROOM EVERYWHERE + UNTIL SOMEBODY STAGES IT (UNSTAGED branch)
- [ ] pp-your-people — friend quotes (STAGED) and friend avatars (UNSTAGED)
- [ ] pp-myshows-shelf — PLAYS YOU'RE WAITING FOR section in MarqueeView
