# v3 Design Overhaul — Executable Graph Engineering Document

**Project:** The Art of Art (AOA)
**Version target:** v3 House Record
**Last updated:** 2026-08-12
**Design references:** `docs/design/v3/design_handoff_house_record/`

This document is the master build plan for implementing the v3 design across all 62 features.
Every `/new-feature` and `/implementation` invocation for this overhaul should cite the node
it addresses. Agents read this document, execute one node, then verify against the success
criteria before moving to the next.

---

## Section 1: Task Graph Topology

```
Phase 0 — Foundation (VERIFY + GAP-FILL) ─────────────────────────────────────────────
  N00-tokens      N01-emotions-light     N02-emotion-dots
  │               │                      │
  └───────────────┴──────────────────────┘
                  │
Phase 1 — Schema Migrations ───────────────────────────────────────────────────────────
                  │
         ┌────────┴────────────────────────────────────────┐
         │                                                 │
    N03-db-house-migration              N04-db-works-people
    (profiles.house_rank,               (plays.play_id, artists,
     watchlist rating→emotions,          credits, artist_follows,
     reviews rating→emotions)            play_interest, event_access)
         │                                                 │
         └────────┬────────────────────────────────────────┘
                  │
         N05-db-social-callboard
         (plans, plan_members, plan_items, plan_messages,
          threads, thread_posts, calls, standing_calls,
          learn_cards, notifications)
                  │
Phase 2 — Types + Shared Logic ────────────────────────────────────────────────────────
                  │
    N06-types-update (src/lib/types.ts — full sync to DATA-MODEL §16)
                  │
         ┌────────┴──────────────┐
         │                       │
    N07-house-logic         N08-offline-verify
    (useHouseCheck,          (offlineDb, offlineSync,
     HouseRankModal          useOfflineWrite)
     rank criteria)
         │                       │
         └────────┬──────────────┘
                  │
Phase 3 — Navigation Overhaul ─────────────────────────────────────────────────────────
                  │
    N09-nav (TONIGHT/CALLBOARD/star/LOBBY/YOU + route renames)
                  │
Phase 4 — Foundation Verifications ────────────────────────────────────────────────────
                  │
    ┌─────────────┼─────────────┬──────────────────────────┐
    │             │             │                           │
N10-tonight   N11-myshows   N12-production-detail     N13-discover
(F20-F22)     (F14/F15      (F16, F17)                (F24 feeling
 verify+fix)  pick+audit)   verify+fix)               search, chips)
    │             │             │                           │
    └─────────────┴─────────────┴──────────────────────────┘
                  │
Phase 5 — Works and People ────────────────────────────────────────────────────────────
                  │
         ┌────────┴──────────────────────────┐
         │                                   │
    N14-play-page                       N15-artist-page
    (PlayDetail full rewrite,            (Artist.tsx new,
     F30/F31 staged+unstaged,            F34, F35, F36)
     F32 play_interest UI,              │
     F33 waiting counts+trend)          │
         │                              │
         └────────┬──────────────────────┘
                  │
Phase 6 — Social ──────────────────────────────────────────────────────────────────────
                  │
         ┌────────┴────────────────────┐
         │                             │
    N16-lobby                     N17-plan
    (Social.tsx full rewrite       (The Plan + open seat
     F40 OUT TONIGHT,              F41 open seat card,
     WHAT THEY FELT,               F42 plan/run-of-show,
     STILL TALKING)                F43 threads)
         │                             │
         └────────┬────────────────────┘
                  │
Phase 7 — Journey (Callboard + Your Run) ──────────────────────────────────────────────
                  │
         ┌────────┴───────────────────────────────────┐
         │                                            │
    N18-callboard                              N19-your-run
    (F50 Callboard screen,                     (F55 Your run
     F51 learn card,                            profile overhaul,
     F52 standing calls,                        F56 rank-up moment,
     F53 Ruth row,                              F57 ticket stubs)
     F54 call taken)
         │                                            │
         └────────┬───────────────────────────────────┘
                  │
Phase 8 — Access + Notifications ──────────────────────────────────────────────────────
                  │
         ┌────────┴──────────────────────────────┐
         │                                       │
    N20-access-ui                          N21-notifications
    (event_access chips                    (Edge Function triggers,
     everywhere, F60-F62,                  play_announced,
     price on all cards)                   artist_cast,
                                           open_seat, rank_up)
         │                                       │
         └────────┬──────────────────────────────┘
                  │
    N22-final-sweep
    (both-theme audit, type/colour checklist,
     touch targets, reduced-motion, acceptance matrix)
```

Parallel execution is safe within each phase between nodes that share no file outputs.
Between phases, all nodes in the prior phase must pass their success criteria.

---

## Section 2: Node Specifications

---

### N00 · Dual-theme tokens — verify

**Type:** config
**Agent:** frontend-developer
**Depends on:** (none — first node)
**Inputs:**
- `src/styles/tokens.css`
- `THEMING.md` §1 token tables

**Outputs:**
- `src/styles/tokens.css` (patch only if tokens are missing)
- No new files

**Loop pattern:** one-shot

**Success criteria:**
- Every token in THEMING.md §1 exists in both `:root` and `.dark` with the exact values from the table
- `ThemeContext.tsx` persists the user's choice to `localStorage`
- No component file contains a hardcoded hex or oklch that duplicates a token
- `--accent-on` is defined as `#f6f1e3` (light) and `#0c0a05` (dark)

**Estimated effort:** Trivial

**Design reference:** THEMING.md §1; BUILD-SPEC.md F01

---

### N01 · Emotion constants — light-theme variants

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N00
**Inputs:**
- `src/lib/emotions.ts` (current — dark-only helpers)
- `THEMING.md` §4 "Emotion colour — the open gap"
- `EMOTIONS.md` "Light theme" section
- `src/components/SpectrumBar.tsx`
- `src/components/EmotionPill.tsx`
- `src/contexts/ThemeContext.tsx` (or equivalent)

**Outputs:**
- `src/lib/emotions.ts` — add `ink()`, `fillLight()`, `edgeLight()` helpers
- `src/components/SpectrumBar.tsx` — use `ink(e)` for label text on light; `base(e)` on dark
- `src/components/EmotionPill.tsx` — use `fillLight`/`edgeLight`/`ink` on light; `fill`/`edge`/`bright` on dark

**Loop pattern:** plan-execute-verify

**Success criteria:**
- `ink(e)` formula: `oklch(${Math.min(e.l - 0.14, 0.48)} ${e.c} ${e.h})`
- `fillLight(e)` formula: `oklch(0.94 ${e.c * 0.25} ${e.h})`
- `edgeLight(e)` formula: `oklch(0.72 ${e.c * 0.5} ${e.h})`
- Delighted (L 0.82), Electrified (L 0.80), Buzzing (L 0.76) all render legible text on `#f6f1e3`
- Contrast ≥ 4.5:1 for every emotion label on both `#f6f1e3` and `#0c0a05`
- SpectrumBar and EmotionPill do NOT fork into separate light/dark components — theme is resolved once from context
- Bar segment fills use `base(e)` unchanged on both themes

**Estimated effort:** Small

**Design reference:** THEMING.md §4; EMOTIONS.md "Light theme"; BUILD-SPEC.md F02

---

### N02 · EmotionDots shared component

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N01
**Inputs:**
- `src/lib/emotions.ts` (after N01)
- `EMOTIONS.md` §"Pills and dots" (§4.3 in README)
- Any existing ad-hoc dot rendering in `ReviewCard.tsx`, `MyShows.tsx`, `VenueSheet.tsx`

**Outputs:**
- `src/components/EmotionDots.tsx` — NEW component
- `src/components/ReviewCard.tsx` — replace ad-hoc dots
- `src/components/VenueSheet.tsx` — replace ad-hoc dots
- `src/pages/MyShows.tsx` — replace ad-hoc dots (ledger rows)

**Loop pattern:** one-shot

**Success criteria:**
- `<EmotionDots emotions={Emotion[]} size={8 | 9 | 10} />` accepts the three canonical sizes
- Dots render in **user selection order** — never sorted
- Gap between dots is 3px
- Dot colour is `base(e)` from `emotions.ts`
- Component is used everywhere dots previously appeared ad-hoc
- F05 acceptance: verify every spectrum renders one `InterpretationSentence` beneath it

**Estimated effort:** Small

**Design reference:** BUILD-SPEC.md F05; README §4.3

---

### N03 · DB: house migration + watchlist/reviews schema

**Type:** migration
**Agent:** backend-architect
**Depends on:** (none — parallel with N04)
**Inputs:**
- `DATA-MODEL.md` §1 (profiles), §2 (watchlist), §3 (reviews), §15 (user_progress cleanup)
- Current migrations in `supabase/migrations/`
- `THE-HOUSE.md` "Migration from belts"

**Outputs:**
- `supabase/migrations/20260812000001_house_rank.sql` — NEW migration
- `supabase/migrations/20260812000002_watchlist_emotions.sql` — NEW migration
- `supabase/migrations/20260812000003_reviews_emotions.sql` — NEW migration

**Loop pattern:** plan-execute-verify

**Success criteria:**
- `profiles.house_rank smallint NOT NULL DEFAULT 0 CHECK (house_rank BETWEEN 0 AND 6)` exists
- `profiles.belt_level` is DROPPED after migrating existing values via `least(belt_level, 6)`
- `profiles.ushered_count int NOT NULL DEFAULT 0` exists
- `watchlist.status` CHECK constraint allows exactly `('want_to_see','booked','seen')`; `'seeing'` is gone
- `watchlist.rating` is DROPPED
- `watchlist.emotions text[] NOT NULL DEFAULT '{}'` exists with cardinality ≤ 3 check
- `watchlist.room_volume text CHECK (room_volume IN ('murmur','applause','standing'))` exists
- `watchlist.performance_at timestamptz` exists
- `watchlist.seat_note text` exists
- `reviews.rating` is DROPPED
- `reviews.emotions text[] NOT NULL DEFAULT '{}'` with cardinality 1–3 check
- `reviews.prompt text` exists
- `user_progress.learning_modules_completed` is DROPPED
- All migrations run cleanly with `supabase db push --dry-run`

**Estimated effort:** Medium

**Design reference:** DATA-MODEL.md §1, §2, §3, §15; THE-HOUSE.md "Migration from belts"

---

### N04 · DB: works + people schema

**Type:** migration
**Agent:** backend-architect
**Depends on:** (none — parallel with N03)
**Inputs:**
- `DATA-MODEL.md` §4 (plays), §5 (event_access), §6 (emotion aggregates), §10 (artists/credits), §11 (play_interest)
- Current `supabase/migrations/`

**Outputs:**
- `supabase/migrations/20260812000004_plays_schema.sql` — NEW
- `supabase/migrations/20260812000005_event_access.sql` — NEW
- `supabase/migrations/20260812000006_emotion_aggregates.sql` — NEW
- `supabase/migrations/20260812000007_artists_credits.sql` — NEW
- `supabase/migrations/20260812000008_play_interest.sql` — NEW

**Loop pattern:** plan-execute-verify

**Success criteria:**
- `plays` table exists with: `id, title, slug unique, playwright, year_written, awards text[], synopsis, created_at`
- `events.play_id uuid REFERENCES plays(id)` exists; nullable (not all events have a play)
- `event_access` table exists per DATA-MODEL §5 DDL exactly, with `unique index on (event_id)`
- `venues` now has: `pay_what_you_can_days, student_rush_price, seat_count, usher_signup_url`
- `event_emotion_counts(event_id, emotion, weight)` table exists
- `event_spectrum` view exists with the `round(100 * weight / ...)` formula
- `profile_emotion_counts(user_id, emotion, weight, season)` table exists
- `artists` table exists with all columns from DATA-MODEL §10
- `credits` table exists with `credit_type` check, `source` check, composite unique index
- `artist_follows(user_id, artist_id, created_at)` primary key composite exists
- `artist_emotion_counts` table exists
- `play_interest(user_id, play_id, city)` unique index on `(user_id, play_id)` exists
- `play_waiting_counts` view exists
- `play_waiting_trend` view exists
- `play_emotion_counts(play_id, emotion, weight)` table exists
- Trigger on `watchlist` insert/update propagates to `event_emotion_counts`, `profile_emotion_counts`, and `artist_emotion_counts` (fanning out through credits)
- RLS: all new user-owned tables use `auth.uid() = user_id` for write

**Estimated effort:** Large

**Design reference:** DATA-MODEL.md §4, §5, §6, §10, §11

---

### N05 · DB: social + callboard schema

**Type:** migration
**Agent:** backend-architect
**Depends on:** N03, N04
**Inputs:**
- `DATA-MODEL.md` §12 (calls/standing_calls/learn_cards), §13 (plans/threads), §14 (notifications)

**Outputs:**
- `supabase/migrations/20260812000009_callboard.sql` — NEW
- `supabase/migrations/20260812000010_plans_threads.sql` — NEW
- `supabase/migrations/20260812000011_notifications.sql` — NEW

**Loop pattern:** plan-execute-verify

**Success criteria:**
- `calls(id, user_id, event_id, week_of, reason, status, created_at)` with unique `(user_id, week_of)`
- `calls.status` CHECK: `('open','declined','accepted','expired')`
- `standing_calls(id, venue_id, kind, recurrence, slots, signup_url, active)` exists
- `standing_calls.kind` CHECK: `('usher','pwyc','student_rush','free')`
- `learn_cards(id, slug unique, title, dek, body_md, seconds, tags)` — NO completion tracking table
- `plans(id, event_id, creator_id, performance_at, seats_total, note, created_at)` exists
- `plan_members(plan_id, user_id, status, seat_note)` composite PK; status CHECK: `('invited','in','paid','out')`
- `plan_items(id, plan_id, at_label, body, detail, sort_order)` exists
- `plan_messages` exists
- `threads(id, event_id, created_at)` unique index on `(event_id)` exists
- `thread_posts` exists; RLS INSERT policy requires `watchlist` row with `status='seen'` for that `event_id`
- `notifications(id, user_id, kind, subject_type, subject_id, body, read_at, created_at)` exists
- `notifications.kind` CHECK includes all 8 kinds from DATA-MODEL §14
- Dedup index on `(user_id, kind, subject_id)` for notifications
- Index on `notifications(user_id, created_at DESC)` exists

**Estimated effort:** Medium

**Design reference:** DATA-MODEL.md §12, §13, §14

---

### N06 · TypeScript types — full sync

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N03, N04, N05
**Inputs:**
- `src/lib/types.ts` (current)
- `DATA-MODEL.md` §16 "TypeScript types to update"

**Outputs:**
- `src/lib/types.ts` — comprehensive update

**Loop pattern:** one-shot

**Success criteria:**
- `BELT_NAMES` and `BELT_COLORS` are deleted entirely; no import of either compiles
- `HOUSE_RANKS` array exists: `['Standing Room','Balcony','Mezzanine','Orchestra','Front Row','Green Room','Company']`
- `Emotion` union type has all 12 exact slugs from `EMOTIONS.md`
- `WatchlistStatus = 'want_to_see' | 'booked' | 'seen'`
- `RoomVolume = 'murmur' | 'applause' | 'standing'`
- `CreditType` and `CreditSource` unions defined
- `PlanMemberStatus` and `CallStatus` unions defined
- New interfaces: `Artist`, `Credit`, `PlayInterest`, `PlayWaiting`, `Call`, `StandingCall`, `LearnCard`, `Plan`, `PlanMember`, `PlanItem`, `Thread`, `ThreadPost`, `Notification`, `EventAccess`, `SpectrumSlice`
- `Profile` type: `belt_level` removed, `house_rank: number` added, `ushered_count: number` added
- `WatchlistItem` type: `rating` removed; `emotions: Emotion[]`, `room_volume`, `performance_at`, `seat_note` added
- `Review` type: `rating` removed; `emotions: Emotion[]`, `prompt` added
- `npm run build` compiles with zero TypeScript errors after this node

**Estimated effort:** Medium

**Design reference:** DATA-MODEL.md §16

---

### N07 · House rank logic — criteria + trigger

**Type:** feature
**Agent:** backend-architect
**Depends on:** N03, N06
**Inputs:**
- `src/hooks/useHouseCheck.ts` (current)
- `THE-HOUSE.md` — rank criteria table (7 ranks, exact criteria)
- `supabase/functions/` (for Edge Function if needed for rank evaluation)

**Outputs:**
- `supabase/migrations/20260812000012_house_rank_trigger.sql` — NEW (`check_house_rank(user_id)` function + trigger)
- `src/hooks/useHouseCheck.ts` — update to call `check_house_rank` and return new rank for rank-up moment
- `src/components/HouseRankModal.tsx` — verify verbatim per-rank copy matches THE-HOUSE.md; verify fires once-ever

**Loop pattern:** plan-execute-verify

**Success criteria:**
- `check_house_rank(user_id uuid)` is idempotent, never lowers a rank, returns the new rank or null
- Trigger fires after insert on `watchlist`, `reviews`, `user_progress`
- All 7 rank criteria from THE-HOUSE.md are encoded exactly (no approximations)
- `useHouseCheck` returns `{ newRank: number | null }` — client shows `HouseRankModal` exactly once
- `HouseRankModal` per-rank copy matches THE-HOUSE.md verbatim for all 6 transitions
- No leaderboard, comparison, streak, or decay logic anywhere in the trigger or hooks

**Estimated effort:** Medium

**Design reference:** THE-HOUSE.md "The ladder" and "Non-negotiable rules"

---

### N08 · Offline write queue — verify and harden

**Type:** feature
**Agent:** debugger
**Depends on:** N06
**Inputs:**
- `src/lib/offlineDb.ts` (Dexie v4 schema)
- `src/lib/offlineSync.ts` (sync-on-reconnect logic)
- `src/hooks/useOfflineWrite.ts`

**Outputs:**
- `src/lib/offlineDb.ts` — patch if queue schema doesn't match current watchlist shape
- `src/lib/offlineSync.ts` — patch retry and dedup logic if needed
- `src/hooks/useOfflineWrite.ts` — patch if needed

**Loop pattern:** plan-execute-verify

**Success criteria:**
- Submit a log with DevTools set to offline mode; reload the page; restore network; the log appears in the DB
- No double-submission on reconnect (idempotent upsert)
- A queued reflection is never silently dropped — failure surfaces a retry toast
- Queue entries include the full watchlist payload after N03 shape (emotions, room_volume, etc.)

**Estimated effort:** Small

**Design reference:** DATA-MODEL.md §9; BUILD-SPEC.md F07

---

### N09 · Navigation overhaul

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N06
**Inputs:**
- `src/components/Navigation.tsx`
- `src/App.tsx` (routes)
- `src/pages/AppShell.tsx`
- BUILD-SPEC.md "Navigation — final" table
- README §2.3

**Outputs:**
- `src/components/Navigation.tsx` — rewrite to exactly 5 slots
- `src/App.tsx` — add routes `/app/callboard`, `/app/lobby`, `/app/you`; rename/remove old routes
- `src/pages/Callboard.tsx` — NEW (stub for N18)
- `src/pages/Lobby.tsx` — NEW (stub for N16)
- `src/pages/You.tsx` — NEW (wraps Profile + Your run, for N19)

**Loop pattern:** one-shot

**Success criteria:**
- Exactly 5 nav slots: `◉ TONIGHT` `/app` · `▥ CALLBOARD` `/app/callboard` · `✦` (log-a-show) · `◍ LOBBY` `/app/lobby` · `◇ YOU` `/app/you`
- Slot 3 is a 44×44 gold circle glyph `✦`, no label, no active state
- Tab bar: `border-top:1px solid var(--rule)`, `background: var(--bg)`, `padding-bottom:22px`, total height 79px
- Inactive tabs: `color: var(--ink-faint)`; active: `color: var(--accent)` (gold on dark, bronze on light)
- Old routes `/app/mentor`, `/app/social`, `/app/map` redirect or are replaced; no broken routes
- `/app/discover` remains reachable from search (not a tab)
- `/app/watchlist` → `/app/you` (My Shows lives under YOU)
- Map is reachable as a toggle in the Tonight masthead, not a bottom tab
- No sixth tab — ever

**Estimated effort:** Medium

**Design reference:** BUILD-SPEC.md "Navigation — final"; README §2.3

---

### N10 · Tonight — verify and fix

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N01, N02, N09
**Inputs:**
- `src/pages/Tonight.tsx`
- `src/components/MarqueeTicker.tsx`
- `src/components/TonightHero.tsx`
- `src/components/TonightFree.tsx`
- `src/components/TonightFriends.tsx` (to be REMOVED)
- README §3.1 (verbatim layout)
- BUILD-SPEC.md F20–F22

**Outputs:**
- `src/pages/Tonight.tsx` — remove TonightFriends import; fix masthead to match spec
- `src/components/MarqueeTicker.tsx` — verify loop + reduced-motion
- `src/components/TonightFree.tsx` — add fallback to "CHEAPEST TONIGHT" when zero free events
- `src/components/TonightFriends.tsx` — DELETE (moves to Lobby)

**Loop pattern:** plan-execute-verify

**Success criteria:**
- Page order: masthead → ticker → hero (never a carousel) → Free tonight (or cheapest fallback)
- Friend activity section does NOT appear on Tonight
- Masthead: `The Art of Art` Courier Prime 700 19px + `· chicago` 10px + `◔` notification glyph right
- MarqueeTicker: content duplicated once in DOM for seamless loop; 26s linear infinite; static under `prefers-reduced-motion`
- Ticker numbers are live: count of tonight's curtains, count under $20, count of openings
- Hero: 196px image band, title below (no negative margin pulling over image), spectrum bar using `ink()` on light theme
- Actions row: primary CTA flex:1 gold + secondary is the real price signal (`$25 HOTTIX`, not generic `Tickets`)
- F22 verified: with zero free events, renders cheapest three under `CHEAPEST TONIGHT` — never empty

**Estimated effort:** Small

**Design reference:** README §3.1; BUILD-SPEC.md F20–F22

---

### N11 · My Shows — audit and pick one take

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N01, N02, N06, N09
**Inputs:**
- `src/pages/MyShows.tsx` (794 lines — contains both takes)
- README §3.2 (both Take A and Take B specifications)
- BUILD-SPEC.md F14, F15

**Outputs:**
- `src/pages/MyShows.tsx` — cut to ONE take (Take B — the Ledger, per spec guidance for heavy users)
- `src/pages/You.tsx` — route to MyShows from under YOU

**Loop pattern:** plan-execute-verify

**Success criteria:**
- Exactly one shelf UI exists in the codebase after this node
- Decision: ship Take B (the Ledger) as the canonical take per BUILD-SPEC.md recommendation for heavy users
- Ledger: segmented tabs `WANT TO SEE N · BOOKED N · SEEN N` with correct counts
- Month dividers: `JULY 2026` label + rule + `4 SHOWS` count right
- Row grid: `34px 1fr auto`, gap 12px, JetBrains Mono date, Newsreader italic title 17.5px, Courier Prime venue
- Emotion dots in selection order (9px, gap 3px) on the right of each row
- `USHERED` badge in access green where applicable
- Empty states are verbatim from README §5
- Add **fourth group** `PLAYS YOU'RE WAITING FOR` after the three production shelves (from `play_interest`)
  - Each row: play title Newsreader italic, playwright `--ink-dim`, right status `NOBODY'S STAGING IT` or `ANNOUNCED · MAR 2027`
  - (Data hook built in N14; this node wires the UI)
- Palette bar (26px) on the Seen card showing all-time emotion aggregate with insight sentence

**Estimated effort:** Medium

**Design reference:** README §3.2; PLAY-AND-WAITING.md §6; BUILD-SPEC.md F14/F15

---

### N12 · Production detail — verify and fix

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N01, N02, N06
**Inputs:**
- `src/pages/ProductionDetail.tsx` (570 lines)
- `src/components/ReviewsList.tsx`, `ReviewCard.tsx`, `ReviewBadge.tsx`
- README §3.3 (verbatim layout)
- BUILD-SPEC.md F16, F17

**Outputs:**
- `src/pages/ProductionDetail.tsx` — targeted fixes
- `src/components/ReviewCard.tsx` — update badge to use house_rank not belt_level
- `src/components/ReviewBadge.tsx` — use HOUSE_RANKS, correct gold threshold at Orchestra+

**Loop pattern:** plan-execute-verify

**Success criteria:**
- Hero is 196px; title block is BELOW it with no negative margin
- Access chips are ordered: money first, then services, then runtime
- Both `12 MORE` and `WRITE ONE →` affordances are present in the header section
- `THE PLAY: {title} · N productions tracked →` link appears when `events.play_id` is set
- Review badge: Orchestra and above = gold text `oklch(0.80 0.14 55)` on `1px solid oklch(0.42 0.09 55)`; below Orchestra = `--ink-dim` on `1px solid --rule`
- Spoiler reviews collapse behind ≥44px tap target
- Badges never sort or weight reviews by rank (display order is chronological)
- Emotion dots on reviews use `<EmotionDots>` from N02

**Estimated effort:** Small

**Design reference:** README §3.3; BUILD-SPEC.md F16, F17

---

### N13 · Discover — feeling search + filter chips

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N01, N04, N06
**Inputs:**
- `src/pages/Discover.tsx` (303 lines)
- `src/hooks/useEmotionAggregates.ts`
- `event_spectrum` view (from N04)
- README §3.7 (verbatim layout)
- BUILD-SPEC.md F24

**Outputs:**
- `src/pages/Discover.tsx` — add spec filter chips; wire feeling search to `event_spectrum`
- `src/hooks/useDiscover.ts` — NEW hook encapsulating search logic

**Loop pattern:** plan-execute-verify

**Success criteria:**
- Search placeholder verbatim: `A play, a theater, a feeling…` (Newsreader italic 15px)
- Searching `"gutted"` returns productions where top emotion in `event_spectrum` has `pct >= 25` for `gutted`
- Filter chips: `TONIGHT` (active gold) · `UNDER $20` (access green text/border) · `STOREFRONT` · `ASL` — all horizontal scroll
- `THE PLAY, NOT THE POSTER` section renders work-level cards with per-production sub-rows
- Work cards: play title Newsreader italic 20px, playwright/award Newsreader 14px dim; per-production rows separated by `1px dotted --rule`
- `YOU SAW THIS` renders in `--ink-ghost` for productions in user's record
- Scene news section retains exactly 3 items with correct kicker colours by kind

**Estimated effort:** Medium

**Design reference:** README §3.7; BUILD-SPEC.md F24; EMOTIONS.md §"Search by feeling"

---

### N14 · Play page — full rewrite

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N01, N02, N04, N06
**Inputs:**
- `src/pages/PlayDetail.tsx` (current stub)
- `PLAY-AND-WAITING.md` (complete spec, both states)
- `DATA-MODEL.md` §11 (`play_interest`, views)
- README §3.11
- `src/hooks/usePlays.ts` (extend)

**Outputs:**
- `src/pages/PlayDetail.tsx` — FULL REWRITE
- `src/hooks/usePlays.ts` — extend with `play_interest` mutations and `play_waiting_counts` query
- `src/hooks/usePlayInterest.ts` — NEW hook

**Loop pattern:** plan-execute-verify

**Success criteria:**
- **Staged state (F30):** title block, action bar, WAITING IN CHICAGO panel, EVERY ROOM EVERY PRODUCTION spectrum, JUST ANNOUNCED section, YOUR PEOPLE section — all match PLAY-AND-WAITING.md §4 layout
- **Unstaged state (F31):** same title/action bar; WAITING IN CHICAGO carries the page; EVERY ROOM EVERYWHERE; UNTIL SOMEBODY STAGES IT (library + adjacent); YOUR PEOPLE with overlapping avatars — all match PLAY-AND-WAITING.md §5
- `Want to see it` button (flex:1, 48px, Newsreader italic 16px, accent fill) writes `play_interest`
- `I'VE SEEN IT` button (104px, Courier Prime 10px) opens log flow with production picker
- Wanting state: label becomes `You're waiting ✓`, `--accent-text` on `--accent-bg` with `1.5px solid --accent`
- WAITING IN CHICAGO: `border:1px solid var(--accent-border)`, `background: var(--accent-bg)`, count right in JetBrains Mono
- F32: `Want to see it` persists with zero productions, survives reload, appears in My Shows
- Seeing a production does NOT clear play interest
- F33: 8-bucket monthly trend renders as bars; interpretation sentence beneath
- YOUR PEOPLE block never falls off the bottom at 844px
- Spectrum bars use `base(e)` from emotions.ts; labels use `ink(e)` on light theme
- UNSTAGED: never shows bare "no productions" — always offers library copy and adjacent thing

**Estimated effort:** Large

**Design reference:** PLAY-AND-WAITING.md; README §3.11; DATA-MODEL.md §11; BUILD-SPEC.md F30–F33

---

### N15 · Artist page — full build

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N01, N02, N04, N06
**Inputs:**
- README §3.10 (verbatim layout)
- DATA-MODEL.md §10 (artists, credits, artist_follows, artist_emotion_counts)
- BUILD-SPEC.md F34–F36

**Outputs:**
- `src/pages/ArtistDetail.tsx` — NEW page
- `src/hooks/useArtist.ts` — NEW hook (artist + credits + follows + emotion spectrum)
- `src/App.tsx` — add route `/app/artist/:artistId`
- `supabase/migrations/20260812000013_artist_credits_backfill.sql` — NEW (backfill from cast_members)

**Loop pattern:** plan-execute-verify

**Success criteria:**
- Hero: 158px, scrim, affiliation Courier Prime 9.5px gold bottom-left, name Newsreader italic 32px
- `YOU'VE SEEN HER N TIMES` count in gold + `FIRST: {PLAY}, {YEAR}` Courier Prime 9.5px `--ink-ghost`
- `FOLLOWING ✓` button: 44px, gold text on `--accent-bg` with `1px solid --accent-border`
- F35: follow writes `artist_follows`; next casting fires `artist_cast` notification
- WHAT ROOMS FEEL WHEN SHE'S IN THEM: 11px spectrum bar using `artist_emotion_counts`, top 3 labelled, one interpretation sentence
- THE NIGHTS YOU WERE THERE: grid with user's own emotion dots per night, empty if user has no overlap
- EVERYTHING ELSE: all credits not in user's record, with house's dominant feelings for past, `SOON` gold for upcoming
- Provenance footer verbatim: `CREDITS FROM OUR OWN RECORD SINCE 2021, PLUS PUBLIC LISTINGS. MISSING SOMETHING? TELL US →`
- F36: correction link routes to a real form or email — not a dead link
- backfill migration: `events.cast_members` blob promoted to `credits` rows; unmatched names create `artists` with `source='public_listing'`

**Estimated effort:** Large

**Design reference:** README §3.10; DATA-MODEL.md §10; BUILD-SPEC.md F34–F36

---

### N16 · The Lobby — full build

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N02, N05, N06, N09
**Inputs:**
- `src/pages/Social.tsx` (70-line stub to replace)
- `src/hooks/useFriendActivity.ts` (extend)
- `src/hooks/useFriendships.ts` (verify `share_reflections` is respected)
- README §3.9 (verbatim layout)
- DATA-MODEL.md §8 (friend activity), §13 (plans/threads for STILL TALKING)
- BUILD-SPEC.md F40–F44

**Outputs:**
- `src/pages/Lobby.tsx` — rewrite (was `Social.tsx`, moved to new route)
- `src/hooks/useFriendActivity.ts` — extend for OUT TONIGHT, WHAT THEY FELT, STILL TALKING
- `src/hooks/useOpenSeats.ts` — NEW hook

**Loop pattern:** plan-execute-verify

**Success criteria:**
- Masthead: `The Lobby` Newsreader italic 26px + `· who's out` Courier Prime 10px `--ink-dim`; right `FIND PEOPLE` gold
- OUT TONIGHT: horizontal scroller; 52px circular avatars; live green dot when in seat now; last tile is `+` add dashed circle with `SAY YOU'RE GOING`
- AN OPEN SEAT: gold-bordered card (same treatment as Open Seat from plan); sentence italic names + venue details Courier Prime 10px; `I'm in` gold flex:1 44px + `ASK HER` outline 104px
- WHAT THEY FELT: grid `36px 1fr`; emotion pills from N01; quote block with `border-left:2px solid --rule`; footer `SAME →` + `SAY SOMETHING`
- STILL TALKING ABOUT IT: live dot, production name + count in thread, `YOU SAW IT JUL 3 — GO IN →` gold link
- F40: exactly three real sections — not an infinite feed
- F44: `share_reflections` respected — reflections from friends who opted out never appear
- `SAME →` action: one-tap records the same emotions on the user's watchlist row if they've seen the production

**Estimated effort:** Medium

**Design reference:** README §3.9; DATA-MODEL.md §8, §13; BUILD-SPEC.md F40, F44

---

### N17 · The Plan + open seat + threads

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N05, N06, N16
**Inputs:**
- README §3.12 (The Plan verbatim layout)
- DATA-MODEL.md §13 (plans, plan_members, plan_items, threads, thread_posts)
- BUILD-SPEC.md F41–F43

**Outputs:**
- `src/pages/PlanDetail.tsx` — NEW page
- `src/pages/ThreadView.tsx` — NEW page
- `src/hooks/usePlan.ts` — NEW hook
- `src/hooks/useThread.ts` — NEW hook
- `src/App.tsx` — add routes `/app/plan/:planId`, `/app/thread/:eventId`

**Loop pattern:** plan-execute-verify

**Success criteria:**
- F41 open seat: triggered when `plan.seats_total > count(plan_members where status IN ('in','paid'))`;
  `I'm in` inserts `plan_members` row with `status='in'` and notifies creator; never auto-charges
- Open seat offer expires with the performance datetime — cannot strand either party
- F42 The Plan: chrome row shows `FRIDAY NIGHT`; FOUR OF YOU avatars with status chips; THE NIGHT run-of-show grid
- THE NIGHT: grid `52px 1fr`; last row is always `AFTER` with copy in access green Courier Prime: `SAY SOMETHING NICE — THEY'RE RIGHT THERE`
- Thread composer: 46px well italic placeholder `Say something to the four of you…`
- Footer: `Add to calendar` gold 50px + `BRING SOMEONE` outline 110px
- F43 threads: scoped to one production; INSERT RLS requires `watchlist.status='seen'` for that event; no exceptions
- Thread page renders only for users who logged the production

**Estimated effort:** Medium

**Design reference:** README §3.12; DATA-MODEL.md §13; BUILD-SPEC.md F41–F43

---

### N18 · The Callboard — full build

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N05, N06, N07, N09
**Inputs:**
- `src/pages/MentorChat.tsx` (becomes one row inside Callboard)
- `src/components/MentorAvatar.tsx`
- `src/pages/Callboard.tsx` (stub from N09)
- README §3.13, §3.14 (verbatim layout for both screens)
- DATA-MODEL.md §12 (calls, standing_calls, learn_cards)
- BUILD-SPEC.md F50–F54

**Outputs:**
- `src/pages/Callboard.tsx` — full implementation
- `src/pages/CallTaken.tsx` — NEW page (§3.14)
- `src/hooks/useCall.ts` — NEW hook (weekly call logic, standing calls, learn card)
- `src/hooks/useStandingCalls.ts` — NEW hook
- `supabase/functions/generate-call/index.ts` — NEW Edge Function (AI-generated weekly call reason citing user's record)
- Delete routes for old Mentor and Learn pages if they exist

**Loop pattern:** plan-execute-verify

**Success criteria:**
- F50: `The Callboard` is the new slot-2 screen; `MentorChat` is one row at the bottom, not a page
- THIS WEEK'S CALL: one call per week (`unique (user_id, week_of)` enforced); gold-bordered card; reason block uses `border-left:2px solid --accent-border` Newsreader italic 15px
- Call reason must cite the user's own record: *"You've seen four heavy things in a row"* — generated by Edge Function reading their watchlist
- Actions: `Hold two seats` gold flex:1 48px + `NOT THIS WEEK` outline 110px
- Declined call never repeats within a season
- F51: IF YOU WANT IT — single optional learn card on `--bg-card`; `READ IT →` and `SKIP IT — JUST GO` carry equal visual weight (same size, one gold one ghost — no hierarchy)
- F52: STANDING CALLS section with access-green `FREE · YOU SEE THE SHOW · N SLOTS LEFT` qualifier; `TAKE IT` in `--access` for free items; `REMIND ME` outline for paid
- F53: Ruth — one row at bottom; 36px avatar; `Ask Ruth anything.` italic + `She's been going since 1994.` dim; gold suggested opener in quotes; tapping opens chat
- F54 Call taken (§3.14): held banner on gold gradient; `TWO SEATS HELD FOR 20 MINUTES` in access green; `Pay $36 — done` gold 48px; BEFORE YOU GO exactly 3 beats with JetBrains Mono numbers; closes with `THAT'S EVERYTHING.`
- No Learn tab, no Mentor page, no sixth bottom tab

**Estimated effort:** Large

**Design reference:** README §3.13, §3.14; DATA-MODEL.md §12; BUILD-SPEC.md F50–F54

---

### N19 · Your run — profile overhaul + stubs

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N01, N06, N07, N09
**Inputs:**
- `src/pages/Profile.tsx` (partial)
- `src/components/SeatingChart.tsx`
- `src/components/StatStrip.tsx`
- `src/components/HouseRankModal.tsx` (from N07)
- `src/pages/You.tsx` (stub from N09)
- README §3.6 (You/Profile), §3.15 (Your run)
- THE-HOUSE.md seating chart spec
- BUILD-SPEC.md F55–F57

**Outputs:**
- `src/pages/You.tsx` — wrap Profile header + stat strip + entry to Your run
- `src/pages/Profile.tsx` — update for house_rank, ushered_count, season palette
- `src/pages/YourRun.tsx` — NEW page (progression screen)
- `src/components/SeatingChart.tsx` — verify ROW_BY_RANK exact; lit seat glow spec; no rank name/number displayed
- `src/components/StatStrip.tsx` — update labels to SHOWS/VENUES/WROTE/USHERED; ushered value always `--access` green
- `src/components/TicketStub.tsx` — NEW component (F57)

**Loop pattern:** plan-execute-verify

**Success criteria:**
- F55: YourRun screen NEVER displays rank name, level number, "N of 7", or a progress bar
- Seating chart: 4 rows of 8 (or 9 on YourRun) squares; `ROW_BY_RANK = [3,3,2,1,1,0,0]` exactly
- Lit seat: 11px square (13px on YourRun), `oklch(0.86–0.88 0.15 55)`, `box-shadow:0 0 10–14px oklch(0.80 0.14 55)`
- Caption sentence: `You started in the back. You're two rows from the stage.` — must agree with the drawing
- THE LAST FIVE (F57): 5 stubs at 58px wide, dashed perforation `1px dashed --rule`, JetBrains Mono 8.5px date, 6px emotion dots; oldest at `opacity:0.6`
- `<TicketStub>` component: `34px hatched image area | perforation | date + dots`
- F56 rank-up moment: fires once ever; seat animates forward 400ms `cubic-bezier(.2,.8,.2,1)`; NO confetti, NO sound, NO share prompt; dismissed by tapping anywhere
- Under reduced-motion: seat drawn in new position immediately, no animation
- WHAT'S OPENED UP grid: gold `◆` markers, phrased as invitations, never "unlocked"
- WHAT'S CLOSE: human-language sentence + muted `SEE THE WHOLE HOUSE →` link only (named ranks live behind it)
- Profile header: gold gradient, stat strip, YOUR SEAT label + rank name italic 20px gold + house chips

**Estimated effort:** Medium

**Design reference:** README §3.6, §3.15; THE-HOUSE.md rendering section; BUILD-SPEC.md F55–F57

---

### N20 · Access UI — chips everywhere

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N04, N06, N12
**Inputs:**
- `src/components/AccessChip.tsx`
- `src/pages/ProductionDetail.tsx` (from N12)
- `src/components/EventCard.tsx`
- `src/components/VenueSheet.tsx`
- `src/pages/Tonight.tsx` (from N10)
- BUILD-SPEC.md F60–F62; DATA-MODEL.md §5

**Outputs:**
- `src/components/AccessChip.tsx` — extend for all chip types from `event_access`
- `src/components/EventCard.tsx` — add price signal and access chips
- `src/components/VenueSheet.tsx` — add access chips to venue sheet detail state

**Loop pattern:** plan-execute-verify

**Success criteria:**
- F60: every production card, hero, and marker sheet renders at least one price signal (`$25 HOTTIX`)
- Access chips ordered: money first, then access services (`PAY-WHAT-YOU-CAN TUE`), then runtime
- Access chips use `color: var(--access)` / `border: 1px solid oklch(0.36 0.07 150)` (light) for free/PWYC/usher
- Other info chips use `--ink-dim` on `1px solid --rule`
- F61: usher slot count from `event_access.usher_slots` surfaces as `USHER SLOTS` chip; the map USHER SLOTS filter works
- F62: no production card, marker sheet, or hero renders without a price signal — blank access data surfaces as a content alert (admin view), not an empty state in the user view
- Blank `event_access` rows are treated as a data quality issue, not an empty state

**Estimated effort:** Small

**Design reference:** DATA-MODEL.md §5; BUILD-SPEC.md F60–F62; README §2.2 access chip styling

---

### N21 · Notifications — Edge Function triggers

**Type:** feature
**Agent:** backend-architect
**Depends on:** N05, N15
**Inputs:**
- `supabase/functions/` (existing functions for pattern reference)
- DATA-MODEL.md §14 (notifications table, 8 kinds)
- DATA-MODEL.md §11 (`play_announced` trigger logic)
- DATA-MODEL.md §10 (`artist_cast` trigger logic)

**Outputs:**
- `supabase/migrations/20260812000014_notification_triggers.sql` — NEW (DB triggers for `play_announced` and `artist_cast`)
- `supabase/functions/notify-users/index.ts` — NEW Edge Function (called by trigger via `pg_net` or `supabase_functions.http_request`)

**Loop pattern:** plan-execute-verify

**Success criteria:**
- Insert on `events` with a `play_id` triggers notifications to all `play_interest` rows matching `play_id` and `city` — once, deduplicated on `(user_id, kind, subject_id)`
- Insert on `credits` for a followed artist triggers `artist_cast` notification to `artist_follows`
- No more than one notification per subject per user (dedup enforced at insert)
- `rank_up` notification fires from the `check_house_rank` trigger (N07) when rank changes
- `open_seat` notification fires when `plan.seats_total > current member count` and a friend is the creator
- All 8 notification kinds from DATA-MODEL §14 have their trigger wired
- Notifications are retrievable via `SELECT * FROM notifications WHERE user_id = auth.uid() ORDER BY created_at DESC`

**Estimated effort:** Medium

**Design reference:** DATA-MODEL.md §14; BUILD-SPEC.md F32, F35

---

### N22 · Final acceptance sweep

**Type:** feature
**Agent:** frontend-developer
**Depends on:** N10–N21 (all prior nodes)
**Inputs:**
- BUILD-SPEC.md "Final acceptance" checklist
- THEMING.md §5 checklist
- All shipped pages and components

**Outputs:**
- Targeted patches to any file that fails the acceptance matrix
- No new files unless a missing component is discovered

**Loop pattern:** plan-execute-verify

**Success criteria — all must pass:**

Type and colour:
- Every production, play, venue, and artist name renders in Newsreader italic
- Every uppercase label is Courier Prime, `letter-spacing` ≥ 0.06em
- All surfaces, ink, and accents come from `tokens.css` — no hardcoded hex that duplicates a token
- Emotion labels pass contrast on paper (`#f6f1e3`) AND on ink (`#0c0a05`)
- No card shadows except the map sheet
- No body copy below 13.5px, no text below 9px

Emotion system:
- Twelve feelings, exact slugs from `EMOTIONS.md`
- Max three picks, order preserved everywhere
- Every spectrum has one `InterpretationSentence`
- `Bored` is present, selectable, never styled as failure
- No star, number, average, or /5 anywhere in the UI

The House:
- Seven ranks, exact names from THE-HOUSE.md
- Rank appears only on the profile header and review badges
- No leaderboard, comparison, streak, or decay anywhere
- YourRun never states a rank name or level number

Works and people:
- A play with zero productions is fully trackable and useful
- Waiting counts render on every play page in both themes
- Every artist has a page with their own emotion spectrum
- Provenance footer with working correction link

Social:
- The Lobby is three real sections, not an infinite feed
- Threads gated to logged viewers only
- `SAY SOMETHING NICE — THEY'RE RIGHT THERE` is present on The Plan

Access:
- Price on every card, marker sheet, and hero
- Free/PWYC/usher in access green, never below the fold
- Free tonight never renders empty
- Every touch target ≥ 44px

Hard constraints:
- No stars, no belts, no Learn tab, no Mentor page, no emoji, no sixth tab
- No gradient backgrounds beyond the two specified
- No rounded-card-with-left-accent-border pattern (deprecated SaaS look)

**Estimated effort:** Medium

**Design reference:** BUILD-SPEC.md "Final acceptance"; THEMING.md §5

---

## Section 3: Loop Specifications

For every `plan-execute-verify` node, the inner cycle follows this pattern.

---

### Loop: N01 — Emotion light-theme variants

**Trigger:** Node starts after N00 passes.

**Inner cycle:**

1. **Discover** — Read `emotions.ts` current helpers. Note which are dark-only. Read `SpectrumBar.tsx` and `EmotionPill.tsx` to find all color callsites.
2. **Plan** — Draft the three new helpers (`ink`, `fillLight`, `edgeLight`). Map every callsite to its light/dark variant. Identify how `ThemeContext` is consumed — resolve pattern once at the component level.
3. **Execute** — Add helpers to `emotions.ts`. Update `SpectrumBar` and `EmotionPill` to branch on theme for label color and pill background/border. Do not fork the components.
4. **Verify** — Check Delighted (L 0.82), Electrified (L 0.80), Buzzing (L 0.76) against `#f6f1e3` using the WCAG formula. Verify `ink(e)` output ≤ L 0.48 for all three. Screenshot both themes at 390×844.

**Evaluator:** Contrast ratio ≥ 4.5:1 for all 12 emotion labels on both backgrounds. No dark-only helpers used against paper anywhere.

**Retry strategy:** If any emotion fails contrast, tighten the `ink()` cap: `Math.min(e.l - 0.14, 0.44)`. Repeat verify. Max 2 retries before escalating.

**Stop condition:** All 12 labels pass contrast in both themes; `npm run build` exits 0.

---

### Loop: N03 — House migration

**Trigger:** Node starts; no other migrations may run concurrently.

**Inner cycle:**

1. **Discover** — `mcp__supabase__list_tables` to enumerate current schema. Read current migration files.
2. **Plan** — Write migration SQL per DATA-MODEL §1, §2, §3. Confirm each ALTER is idempotent. Note any foreign key constraints that must be dropped before renaming.
3. **Execute** — Write SQL files to `supabase/migrations/`. Run `supabase db push --dry-run`.
4. **Verify** — `mcp__supabase__execute_sql` to confirm columns exist, constraints correct, old columns gone.

**Evaluator:** All success criteria in N03 spec verified via SQL SELECT against the schema.

**Retry strategy:** If a constraint fails, drop it first in a separate statement before adding the new one. If `belt_level` drop fails, verify `house_rank` was populated first.

**Stop condition:** All assertions pass; `supabase db push` exits 0 on the real project.

---

### Loop: N04 — Works + people schema

**Trigger:** After N03 completes (schemas are independent but running both concurrently risks migration numbering conflicts).

**Inner cycle:**

1. **Discover** — Confirm existing `plays` table state (may already exist per task context). Check `events.play_id` status.
2. **Plan** — Five migrations in dependency order: plays → event_access → emotion_aggregates → artists_credits → play_interest. Each migration must be independently revertible.
3. **Execute** — Write migration files. Run `supabase db push --dry-run` on each.
4. **Verify** — Query each table and view. Insert a test record and verify the watchlist trigger propagates to `event_emotion_counts`.

**Evaluator:** Views return correct results from test inserts. Triggers fire correctly.

**Retry strategy:** If trigger fails to propagate, add explicit `RAISE NOTICE` calls to trace execution path. Fix the fan-out logic.

**Stop condition:** All 5 migrations apply cleanly; test inserts produce expected aggregate values.

---

### Loop: N07 — House rank trigger

**Trigger:** After N03 and N06 complete.

**Inner cycle:**

1. **Discover** — Read `THE-HOUSE.md` rank criteria table fully. Identify which criteria require joining `watchlist`, `user_progress`, `reviews`.
2. **Plan** — Write `check_house_rank(user_id)` as a PL/pgSQL function with explicit criteria checks for each rank. Design the trigger to call it after relevant inserts.
3. **Execute** — Write migration. Test manually with fabricated data that satisfies each rank boundary.
4. **Verify** — Seed a test user through each rank boundary; confirm function returns the new rank and does not lower it.

**Evaluator:** Function returns correct rank for each boundary condition. Idempotency verified (calling twice produces same result).

**Retry strategy:** If criteria are wrong, re-read THE-HOUSE.md literally. "Kinds of room" = `institutional | storefront | devised/experimental | school` from the `venues.kind` column — verify that column exists.

**Stop condition:** All 7 boundary conditions verified in test data; trigger fires after watchlist insert.

---

### Loop: N08 — Offline verify

**Trigger:** After N06 (types must match new watchlist shape).

**Inner cycle:**

1. **Discover** — Read `offlineDb.ts` Dexie schema. Check if queue entries include `emotions`, `room_volume`, `performance_at` fields.
2. **Plan** — If schema is stale, write a Dexie migration (version bump). Verify sync function handles conflicts.
3. **Execute** — Update schema and sync logic if needed.
4. **Verify** — Manual test: DevTools → Network → Offline; submit a log; reload; restore network; confirm DB row.

**Evaluator:** Log survives reload and syncs without duplication.

**Retry strategy:** If sync creates duplicates, add upsert on `(user_id, event_id)`.

**Stop condition:** Offline log survives reload and syncs exactly once.

---

### Loop: N13 — Discover feeling search

**Trigger:** After N01, N04, N06.

**Inner cycle:**

1. **Discover** — Inspect current `Discover.tsx` search handler. Confirm `event_spectrum` view is queryable.
2. **Plan** — Build `useDiscover` hook with two query paths: text search (existing) and feeling search (new, against `event_spectrum`).
3. **Execute** — Implement hook and update `Discover.tsx` filter chips.
4. **Verify** — Search `"gutted"` — confirm only productions with `pct >= 25` for gutted return. Search `"hamlet"` — confirm text path works. Activate `UNDER $20` chip — confirm it narrows results.

**Evaluator:** Feeling search returns correct results from real `event_spectrum` data; filter chips reduce result set correctly.

**Retry strategy:** If `event_spectrum` has no data (aggregates empty), seed test watchlist rows and verify trigger populated counts.

**Stop condition:** All filter combinations return correct, non-empty results on staging data.

---

### Loop: N14 — Play page full rewrite

**Trigger:** After N01, N02, N04, N06.

**Inner cycle:**

1. **Discover** — Read current `PlayDetail.tsx` fully. Read `PLAY-AND-WAITING.md` completely. Map each spec block to a component slot.
2. **Plan** — Design component tree: staged vs. unstaged conditional branches; hooks for `play_interest`, waiting counts, trend, your people.
3. **Execute** — Rewrite `PlayDetail.tsx`. Build `usePlayInterest.ts`. Extend `usePlays.ts` with waiting data.
4. **Verify** — Test with a play that has productions; verify staged state. Test with a play that has no Chicago productions; verify unstaged state offers library + adjacent. Verify `Want to see it` persists reload. Verify MY SHOWS shows the play in PLAYS YOU'RE WAITING FOR.

**Evaluator:** Both states match spec. play_interest persists. Seeing a production does not clear interest.

**Retry strategy:** If WAITING IN CHICAGO panel has no data, verify `play_waiting_counts` view is populated. If trend bars are missing, check `play_waiting_trend` view.

**Stop condition:** Both spec states pass acceptance criteria; F32–F33 checklist from PLAY-AND-WAITING.md §7 all green.

---

### Loop: N18 — Callboard full build

**Trigger:** After N05, N06, N07, N09.

**Inner cycle:**

1. **Discover** — Read `MentorChat.tsx` to understand what to preserve as the Ruth row. Read README §3.13 and §3.14 completely.
2. **Plan** — Callboard has 4 sections (THIS WEEK'S CALL, IF YOU WANT IT, STANDING CALLS, Ruth row). Call Taken is a separate page. Edge Function `generate-call` uses the user's watchlist to write the reason sentence.
3. **Execute** — Build `Callboard.tsx`, `CallTaken.tsx`, `useCall.ts`, `generate-call` Edge Function.
4. **Verify** — With a seeded `calls` row for the current week, verify the card renders correctly. Verify `NOT THIS WEEK` sets status='declined'. Verify declined call does not reappear within the same season. Verify Ruth row opens chat.

**Evaluator:** All F50–F54 acceptance criteria pass. No Mentor page or Learn tab exists.

**Retry strategy:** If Edge Function fails to generate a reason, fall back to a template sentence using the user's top emotion from `profile_emotion_counts`. Never render an empty reason block.

**Stop condition:** Weekly call renders with user-specific reasoning; call taken flow completes in ≤ 2 taps.

---

### Loop: N22 — Final acceptance sweep

**Trigger:** After all N10–N21 nodes complete.

**Inner cycle:**

1. **Discover** — Screenshot every page at 390×844 in both light and dark themes. Run the BUILD-SPEC.md "Final acceptance" checklist item by item.
2. **Plan** — Group failures by component and create a targeted fix list.
3. **Execute** — Apply all targeted fixes.
4. **Verify** — Re-screenshot affected pages. Re-run checklist.

**Evaluator:** Every checklist item in BUILD-SPEC.md "Final acceptance" passes.

**Retry strategy:** If a token violation is found deep in a component, search the entire codebase for the hardcoded value and replace all instances.

**Stop condition:** Zero checklist failures in both themes at 390×844.

---

## Section 4: Shared State Schema

These keys flow between nodes. Agents should not re-derive these from raw DB data when a prior node has already computed them.

| Key | Type | Produced by | Consumed by | Notes |
|-----|------|-------------|-------------|-------|
| `emotions` | `Emotion[]` (ordered) | N01 (lib), N03 (DB) | N02, N10–N19, N22 | Never sort; order is pick order |
| `house_rank` | `number` 0–6 | N03 (DB), N07 (trigger) | N07, N19, N22 | Comes from `profiles.house_rank` |
| `ushered_count` | `number` | N03 (DB) | N19 | Always rendered in `--access` green |
| `event_spectrum` | `SpectrumSlice[]` | N04 (view) | N10, N12, N13, N14, N15, N20 | Precomputed; never compute client-side per-card |
| `play_interest` | `PlayInterest` | N04 (DB), N14 (hook) | N11, N14 | City-scoped want; persists independently of production watchlist |
| `play_waiting_counts` | `PlayWaiting` | N04 (view) | N14 | Exposes count + trend; never exposes who |
| `artist_emotion_counts` | `SpectrumSlice[]` | N04 (table + trigger) | N15 | Same trigger path as event_emotion_counts |
| `calls` | `Call` | N05 (DB), N18 (hook) | N18 | One per user per week; unique constraint enforced DB-side |
| `standing_calls` | `StandingCall[]` | N05 (DB) | N18 | Cached in hook; revalidate on focus |
| `plans` | `Plan` | N05 (DB), N17 (hook) | N16 (open seat), N17 | Open seat derived: `seats_total > active_members` |
| `notifications` | `Notification[]` | N05 (DB), N21 (triggers) | Future notification bell | Ordered by `created_at DESC`; deduped on `(user_id, kind, subject_id)` |
| `theme` | `'light' \| 'dark'` | N00 (ThemeContext) | N01, all components | Persisted in localStorage |
| `new_rank` | `number \| null` | N07 (trigger return) | N19 (HouseRankModal) | Non-null triggers rank-up animation exactly once |
| `offline_queue` | `WatchlistItem[]` | N08 (Dexie) | N08 | Local queue; synced on reconnect |
| `credits` | `Credit[]` | N04 (DB), N15 | N15 | Source field drives provenance footer text |

---

## Section 5: Build Phases (Topological Sort)

---

### Phase 0 — Foundation (verify + gap-fill)

**Nodes:** N00, N01, N02
**Execution:** Sequential: N00 → N01 → N02
**Fan-out:** 1 agent (these are tightly coupled)
**Quality gate:** `npm run build` exits 0; all 12 emotion labels pass 4.5:1 contrast in both themes

**Human checkpoint:** Before proceeding to Phase 1 — visually verify SpectrumBar in both themes at 390×844. Delighted, Electrified, and Buzzing must be legible on the paper background. If any label is invisible, do not proceed.

---

### Phase 1 — Schema migrations

**Nodes:** N03 (parallel with N04), then N05
**Execution:** N03 and N04 run in parallel worktrees; N05 runs after both complete
**Fan-out:** 2 agents for N03+N04 (separate migration files, no conflicts); 1 agent for N05

**Quality gate:** `supabase db push --dry-run` passes for all migration files; all table assertions verify via `mcp__supabase__execute_sql`

**Human checkpoint:** Before Phase 2 — review migration plan with a quick `mcp__supabase__list_tables` diff. Confirm `belt_level` is gone. Confirm `plays`, `artists`, `credits`, `play_interest`, `event_access` all exist. This is the irreversible step.

---

### Phase 2 — Types + shared logic

**Nodes:** N06, then N07 and N08 in parallel
**Execution:** N06 → (N07 || N08)
**Fan-out:** 2 agents for N07+N08 (different files, no conflicts)

**Quality gate:** `npm run build` exits 0 with zero TypeScript errors after N06; `BELT_NAMES` and `BELT_COLORS` produce no search results in `src/`

**Human checkpoint:** Confirm `src/lib/types.ts` has the correct `HOUSE_RANKS` array and that all 12 emotion slugs are present. Spot-check that `Profile` type no longer has `belt_level`.

---

### Phase 3 — Navigation overhaul

**Nodes:** N09
**Execution:** Single agent
**Fan-out:** 1

**Quality gate:** All 5 nav tabs render correctly in both themes; slot 3 is a gold circle not a tab; `/app/callboard` and `/app/lobby` resolve to their stub pages; no broken routes

**Human checkpoint:** Load the app on a device. Tap each nav slot. Confirm there is no sixth tab. Confirm the log-a-show gold circle opens the log flow. Confirm old routes 404 gracefully (or redirect).

---

### Phase 4 — Foundation verifications

**Nodes:** N10, N11, N12, N13 (all parallel after N09)
**Execution:** All 4 can run in parallel worktrees
**Fan-out:** Up to 4 agents

**Quality gate:** Each node passes its success criteria; `npm run build` exits 0; no regression in existing shipped features

**Human checkpoint:** End-to-end smoke test: log a show (Tonight → log), view the production detail, view My Shows (ledger take only), try a feeling search in Discover. All flows should complete without errors.

---

### Phase 5 — Works and people

**Nodes:** N14, N15 (parallel)
**Execution:** N14 and N15 can run in parallel worktrees
**Fan-out:** 2 agents

**Quality gate:** N14: staged and unstaged play page both render fully; `play_interest` persists reload. N15: artist page renders with spectrum and provenance footer; follow button works.

**Human checkpoint:** This is the highest-value phase. Before declaring done: navigate to a play with zero Chicago productions. Confirm the page is rich and useful, not an error state. Navigate to an artist page. Confirm `WHAT ROOMS FEEL WHEN SHE'S IN THEM` renders (even if empty with `EARLY DAYS`). Confirm provenance footer is present with a working link.

---

### Phase 6 — Social

**Nodes:** N16, then N17 (N17 depends on N16 for open seat card reference)
**Execution:** N16 → N17 (sequential; N17 builds on N16's open seat component)
**Fan-out:** 1 agent per node

**Quality gate:** N16: three real Lobby sections render with live data. N17: The Plan renders; `SAY SOMETHING NICE — THEY'RE RIGHT THERE` is visible in AFTER row; thread INSERT rejected for users who haven't logged the show.

**Human checkpoint:** This is the social phase. Verify with a friend account: create a plan, have a second account `I'm in`, confirm notification fires. Try to post in a thread without logging the show — confirm it fails. Confirm `share_reflections: false` hides reflections on The Lobby.

---

### Phase 7 — Journey

**Nodes:** N18, N19 (parallel)
**Execution:** N18 and N19 can run in parallel worktrees
**Fan-out:** 2 agents

**Quality gate:** N18: Callboard renders with weekly call; call taken flow completes. N19: YourRun seating chart matches spec; ticket stubs render; rank-up modal fires once.

**Human checkpoint:** This is the product's heart. Verify: The Callboard shows a real call with a reason that references the user's record. `NOT THIS WEEK` sets declined and it doesn't reappear. YourRun shows the seating chart — confirm there is zero mention of rank name or level number on the screen. Trigger a rank-up (seed data if needed) and confirm the modal fires exactly once.

---

### Phase 8 — Access + notifications

**Nodes:** N20, N21 (parallel), then N22
**Execution:** N20 and N21 parallel; N22 runs last
**Fan-out:** 2 agents for N20+N21; 1 agent for N22

**Quality gate:** N20: every card has a price signal; every access chip is in access green. N21: inserting an event with a play_id fires notifications to play_interest rows. N22: BUILD-SPEC.md "Final acceptance" checklist all green.

**Human checkpoint (final release gate):** Full device review at 390×844 in both themes. Run through the complete acceptance matrix in BUILD-SPEC.md. No item can be marked "close enough." Specifically:
- Every screen in both themes
- Touch all interactive elements (≥44px verified)
- Confirm no stars, no belts, no Learn tab, no Mentor page, no sixth tab, no emoji
- Confirm price on every card
- Confirm free tonight never empty

---

## Section 6: Execution Guide

### Running a single node

Each node is a scoped task for one `/implementation` invocation. Invoke as:

```
/implementation

Node: N01 — Emotion constants, light-theme variants
Design refs: THEMING.md §4; EMOTIONS.md; BUILD-SPEC.md F02
Loop: plan-execute-verify
```

The agent reads this document, finds the node spec, reads the inputs listed, executes, then verifies against the success criteria before declaring done.

---

### Parallel execution with worktrees

Nodes within the same phase that have no shared output files can run in parallel worktrees. Use `EnterWorktree` to create an isolated branch for each parallel agent.

**Safe parallel pairs (no output file conflicts):**
- N03 + N04 (different migration files, different concerns)
- N07 + N08 (different files entirely)
- N10 + N11 + N12 + N13 (different page files, different hooks)
- N14 + N15 (different pages, different hooks)
- N18 + N19 (different pages, different hooks)
- N20 + N21 (N20 is frontend, N21 is backend)

**Never parallelize:**
- N05 with N03 or N04 (N05 depends on both)
- N06 with any node it feeds (N07, N08, all Phase 4+ nodes)
- N09 with Phase 4 nodes (navigation must resolve before page verifications)
- N22 with anything (it is the final sweep)

---

### Phase invocation pattern

At the start of each phase, invoke the standup skill to align agents:

```
/standup — Phase N build: [list nodes]
```

At the end of each phase, run the quality gate manually, then invoke:

```
/docs-check — verify design references are still current before proceeding
```

---

### Quality gates between phases

Every phase ends with a mandatory quality gate. An agent cannot declare a phase complete without:

1. `npm run build` exits 0
2. All success criteria for every node in the phase are verified
3. The human checkpoint has been reviewed (at minimum, a visual spot-check on device)

If a node fails its quality gate, it blocks the entire phase. Diagnose and fix before proceeding. Do not skip nodes and circle back — the dependency graph is real.

---

### Rollback strategy

**Phase 0 (token/emotion changes):** Revert with `git checkout` on the affected files. No data is touched.

**Phase 1 (migrations):** Write all migrations as **reversible** with explicit `DOWN` blocks (comments at minimum). If a migration causes data loss and must be reverted, restore from the Supabase project backup taken before the migration ran. Always take a manual backup (`mcp__supabase__execute_sql` for a schema dump) before Phase 1.

**Phase 2 (types):** Revert `types.ts` with `git checkout`. No data is touched.

**Phases 3–8 (UI + features):** Feature-flag approach — if a new page breaks something, the old route can be temporarily restored while the fix is applied. No migration is needed.

---

### Token cost tracking

This graph spans ~30 nodes and 8 phases. To avoid runaway costs:

- Each `/implementation` invocation should consume ≤ 50k tokens for a Trivial/Small node
- Medium nodes: budget 100k tokens
- Large nodes (N04, N14, N15, N18): budget 200k tokens
- Use `/retro` after Phase 1 and Phase 5 to extract patterns and avoid re-exploration in later nodes

---

### References quick-index

| Node | Primary design ref |
|------|--------------------|
| N00 | `THEMING.md` §1 |
| N01 | `THEMING.md` §4, `EMOTIONS.md` |
| N02 | `EMOTIONS.md` §"Pills and dots", `README.md` §4.3 |
| N03 | `DATA-MODEL.md` §1–3, §15 |
| N04 | `DATA-MODEL.md` §4–6, §10–11 |
| N05 | `DATA-MODEL.md` §12–14 |
| N06 | `DATA-MODEL.md` §16 |
| N07 | `THE-HOUSE.md` |
| N08 | `DATA-MODEL.md` §9 |
| N09 | `BUILD-SPEC.md` "Navigation — final", `README.md` §2.3 |
| N10 | `README.md` §3.1 |
| N11 | `README.md` §3.2, `PLAY-AND-WAITING.md` §6 |
| N12 | `README.md` §3.3 |
| N13 | `README.md` §3.7 |
| N14 | `PLAY-AND-WAITING.md`, `DATA-MODEL.md` §11 |
| N15 | `README.md` §3.10, `DATA-MODEL.md` §10 |
| N16 | `README.md` §3.9, `DATA-MODEL.md` §8, §13 |
| N17 | `README.md` §3.12, `DATA-MODEL.md` §13 |
| N18 | `README.md` §3.13–3.14, `DATA-MODEL.md` §12 |
| N19 | `README.md` §3.6, §3.15, `THE-HOUSE.md` |
| N20 | `DATA-MODEL.md` §5, `BUILD-SPEC.md` F60–F62 |
| N21 | `DATA-MODEL.md` §14 |
| N22 | `BUILD-SPEC.md` "Final acceptance" |

All design files live at: `docs/design/v3/design_handoff_house_record/`
