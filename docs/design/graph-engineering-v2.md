# Graph Engineering v2: The Art of Art — House Record

**Date:** 2026-07-31
**Version:** 2.0
**Supersedes:** `docs/graph-engineering.md` Phase 4+ (Foundation through Core Shell are complete)

This document is the executable build specification for the AOA design overhaul ("House Record"). It defines the task graph (nodes, edges, shared state) and loop specifications that Claude Code agents execute to transform the existing app from the belt/star/learn model to the emotion/House/tonight model described in `docs/design/handoff/`.

**How to use this document:** Read Section 5 (Build Phases) to find the current phase. Read the node specs for each uncompleted node in that phase. Execute using the loop spec. Mark nodes complete and update shared state as you go.

**Pre-conditions:** Phases 0-2 of `graph-engineering.md` are complete. The app has auth, Supabase, app shell, map, AI gateway, and PWA. This graph starts from that baseline.

---

## Section 1: Task Graph Topology

### Nodes

```
SCHEMA:         schema-emotions, schema-plays, schema-access, schema-shelves,
                schema-house, schema-emotion-agg, schema-tonight, schema-privacy
CONSTANTS:      emotion-constants, house-constants, design-tokens, type-updates
LOG-A-SHOW:     emotion-wheel, room-volume, log-show-page
WRITE-REVIEW:   write-review-page
MY-SHOWS:       my-shows-ledger, my-shows-empty-states
SHOW-DETAIL:    spectrum-bar, interpretation-copy, production-detail
TONIGHT:        marquee-ticker, tonight-hero, tonight-friends, tonight-free, tonight-page
MAP-OVERHAUL:   map-markers, map-filters, venue-sheet, map-basemap
PROFILE:        seating-chart, house-chips, palette-bar, stat-strip, profile-page
HOUSE-ENGINE:   house-check-fn, house-rank-modal, house-hook
NAV-OVERHAUL:   navigation-v2, genre-chips, review-badge, access-chips, loading-skeleton
DISCOVER:       discover-page, play-pages
CLEANUP:        delete-belt-code, delete-star-ratings, delete-learn
COMPLETION:     personal-palette, is-up-tonight-wire, search-by-feeling,
                venue-sheet-states, scene-news, pull-to-refresh,
                reduced-motion-complete, osm-attribution, offline-dexie
```

### Edges (-> = "must complete before")

```
                     schema-emotions
                    /       |       \
           schema-plays  schema-access  schema-shelves
                    \       |       /
                     schema-house
                         |
                  schema-emotion-agg
                    /           \
            schema-tonight    schema-privacy
                    \           /
                     (schema complete)

  emotion-constants ─┐
  house-constants ───┤
  design-tokens ─────┤
  type-updates ──────┘── (constants complete)

  (schema + constants) ──> emotion-wheel ──> room-volume ──> log-show-page
                                                                  |
                                                           write-review-page
                                                                  |
                                     ┌────────────────────────────┤
                                     v                            v
                              my-shows-ledger              spectrum-bar
                              my-shows-empty-states    interpretation-copy
                                     |                            |
                                     v                    production-detail
                              tonight-hero                        |
                              marquee-ticker         ┌────────────┘
                              tonight-friends        v
                              tonight-free      map-markers
                                     |          map-filters
                              tonight-page      venue-sheet
                                     |          map-basemap
                                     v               |
                              seating-chart     ┌────┘
                              house-chips       v
                              palette-bar    discover-page
                              stat-strip     play-pages
                              profile-page        |
                                     |            v
                              house-check-fn  navigation-v2
                              house-rank-modal genre-chips
                              house-hook       review-badge
                                     |         access-chips
                                     v         loading-skeleton
                              delete-belt-code      |
                              delete-star-ratings   |
                              delete-learn ─────────┘
```

### ASCII DAG (parallel tracks visible)

```
Phase 0:  [schema-emotions]
          [schema-plays] [schema-access] [schema-shelves]
              |
Phase 1:  [schema-house]
              |
          [schema-emotion-agg]
              |
          [schema-tonight] [schema-privacy]

Phase 1b: [emotion-constants] [house-constants] [design-tokens] [type-updates]

Phase 2:  [emotion-wheel] ──> [room-volume] ──> [log-show-page]
              |
Phase 3:  [write-review-page]
              |
Phase 4:  [my-shows-ledger]     [spectrum-bar]
          [my-shows-empty-states] [interpretation-copy]
              |                        |
              |                  [production-detail]
              |                        |
Phase 5:  [tonight-hero]        [map-markers]    [seating-chart]   [house-check-fn]
          [marquee-ticker]       [map-filters]    [house-chips]     [house-rank-modal]
          [tonight-friends]      [venue-sheet]    [palette-bar]     [house-hook]
          [tonight-free]         [map-basemap]    [stat-strip]
              |                        |               |
          [tonight-page]               |          [profile-page]
              |                        |               |
Phase 6:  [discover-page] [play-pages] |          [navigation-v2]
          [genre-chips] [review-badge] |          [access-chips]
          [loading-skeleton]           |
              |                        |
Phase 7:  [delete-belt-code] [delete-star-ratings] [delete-learn]
              |
Phase 8:  [personal-palette]   [is-up-tonight-wire]   [pull-to-refresh]      [offline-dexie]
              |                        |                [reduced-motion]
              |                        |                [osm-attribution]
          [search-by-feeling]  [venue-sheet-states]  [scene-news]
          [genre-chips] [review-badge] |          [access-chips]
          [loading-skeleton]           |
              |                        |
Phase 7:  [delete-belt-code] [delete-star-ratings] [delete-learn]
```

---

## Section 2: Node Specifications

### Schema Nodes

#### Node: schema-emotions
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: (existing migrations through `20260731000005_expand_venues.sql`)
- **Inputs**: `EMOTIONS.md` §canonical set (12 feelings, slugs), `DATA-MODEL.md` §2 (watchlist emotions), §3 (reviews emotions)
- **Outputs**: `supabase/migrations/20260731100000_emotions_system.sql` — creates `emotion_slugs` lookup table with the 12 canonical slugs for FK-ish validation triggers
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `emotion_slugs` table has exactly 12 rows matching `EMOTIONS.md` slugs; trigger on `watchlist.emotions` and `reviews.emotions` rejects any slug not in the table; `supabase db push` succeeds
- **Estimated effort**: Small
- **Design reference**: `EMOTIONS.md` §canonical set, `DATA-MODEL.md` §2–3

#### Node: schema-plays
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: schema-emotions
- **Inputs**: `DATA-MODEL.md` §4 (plays table DDL, events.play_id FK)
- **Outputs**: `supabase/migrations/20260731100001_plays.sql` — `plays` table (id, title, slug unique, playwright, year_written, awards text[], synopsis, created_at), `events.play_id uuid references plays(id)`, index on `events(play_id)`, RLS: public read, admin write
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `plays` table exists; `events.play_id` FK works; inserting an event with a valid play_id succeeds; null play_id is allowed (improv/devised)
- **Estimated effort**: Small
- **Design reference**: `DATA-MODEL.md` §4

#### Node: schema-access
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: schema-emotions
- **Inputs**: `DATA-MODEL.md` §5 (venue access fields, event_access table DDL)
- **Outputs**: `supabase/migrations/20260731100002_access.sql` — adds `pay_what_you_can_days text[]`, `student_rush_price numeric`, `seat_count int`, `usher_signup_url text` to `venues`; creates `event_access` table (event_id unique FK, asl_dates date[], relaxed_dates date[], audio_described_dates date[], open_caption_dates date[], touch_tour_dates date[], usher_slots int default 0, runtime_minutes int, has_intermission boolean, content_notes text, created_at); RLS: public read
- **Loop pattern**: plan-execute-verify
- **Success criteria**: all venue columns exist; `event_access` table exists with unique index on event_id; inserting access data for an event succeeds
- **Estimated effort**: Small
- **Design reference**: `DATA-MODEL.md` §5, `README.md` §3.3 (access chips), §3.8 (USHER SLOTS filter)

#### Node: schema-shelves
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: schema-emotions
- **Inputs**: `DATA-MODEL.md` §2 (watchlist DDL, constraint changes), §3 (reviews DDL)
- **Outputs**: `supabase/migrations/20260731100003_shelves_and_feelings.sql` — renames `seeing` to `booked` in watchlist status constraint; adds `emotions text[]` (max 3), `room_volume text` (check murmur/applause/standing), `performance_at timestamptz`, `seat_note text` to `watchlist`; drops `watchlist.rating`; adds `emotions text[]` (1-3), `prompt text` to `reviews`; drops `reviews.rating`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `watchlist.status` constraint accepts only `want_to_see|booked|seen`; `watchlist.emotions` accepts 0-3 slugs; `watchlist.rating` column gone; `reviews.emotions` requires 1-3 slugs; `reviews.rating` column gone; existing data migrated (`seeing` rows now `booked`)
- **Estimated effort**: Medium
- **Design reference**: `DATA-MODEL.md` §2–3, `EMOTIONS.md` §rules (1-3 picks)

#### Node: schema-house
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: schema-plays, schema-access, schema-shelves
- **Inputs**: `DATA-MODEL.md` §1 (profiles DDL), `THE-HOUSE.md` §ladder (7 ranks, criteria)
- **Outputs**: `supabase/migrations/20260731100004_house_rank.sql` — adds `house_rank smallint not null default 0 check (house_rank between 0 and 6)` to `profiles`; migrates `belt_level` values via `least(belt_level, 6)`; drops `belt_level`; adds `ushered_count int not null default 0` to `profiles` with sync from `user_progress.ushering_count`; creates `check_house_rank(user_id uuid)` function (idempotent, never lowers, returns new rank or null)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `profiles.house_rank` exists with check constraint; `profiles.belt_level` is gone; `check_house_rank()` returns correct rank for test cases covering all 7 levels; rank never decreases; `ushered_count` synced from `user_progress`
- **Estimated effort**: Medium
- **Design reference**: `DATA-MODEL.md` §1, `THE-HOUSE.md` §ladder + §non-negotiable rules

#### Node: schema-emotion-agg
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: schema-house
- **Inputs**: `DATA-MODEL.md` §6 (event_emotion_counts, event_spectrum view, profile_emotion_counts)
- **Outputs**: `supabase/migrations/20260731100005_emotion_aggregates.sql` — creates `event_emotion_counts(event_id, emotion, weight, primary key (event_id, emotion))`; creates trigger on `watchlist` insert/update of emotions to maintain counts (3 picks = 1/3 weight each); creates `event_spectrum` view (event_id, emotion, pct); creates `profile_emotion_counts(user_id, emotion, weight, season text)`; trigger on `watchlist` to maintain profile counts partitioned by season (Sep 1 - Aug 31)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: logging a show with 3 emotions creates 3 rows in `event_emotion_counts` each with weight 0.333; `event_spectrum` returns percentages summing to 100; `profile_emotion_counts` partitioned by season; second log updates counts correctly
- **Estimated effort**: Medium
- **Design reference**: `DATA-MODEL.md` §6, `EMOTIONS.md` §rules #5 (share of picks)

#### Node: schema-tonight
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: schema-emotion-agg
- **Inputs**: `DATA-MODEL.md` §7 (is_up_tonight function, show_times jsonb format)
- **Outputs**: `supabase/migrations/20260731100006_tonight.sql` — creates `is_up_tonight(events, timestamptz)` stable function that reads `show_times` jsonb (keys: mon-sun + exceptions) and returns boolean; index for tonight queries
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `is_up_tonight()` returns true for events with a performance matching today's day-of-week; respects exceptions (e.g., dark on 4th of July); handles null `show_times`; query plan uses index
- **Estimated effort**: Small
- **Design reference**: `DATA-MODEL.md` §7, `README.md` §3.1 (marquee counts)

#### Node: schema-privacy
- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: schema-emotion-agg
- **Inputs**: `DATA-MODEL.md` §8 (share_reflections boolean)
- **Outputs**: `supabase/migrations/20260731100007_privacy.sql` — adds `share_reflections boolean not null default true` to `profiles`; updates RLS on watchlist to hide reflection text when friend's `share_reflections` is false
- **Loop pattern**: one-shot
- **Success criteria**: `profiles.share_reflections` exists; when false, friend activity queries return null for reflection text; emotions still visible
- **Estimated effort**: Trivial
- **Design reference**: `DATA-MODEL.md` §8

### Constants Nodes

#### Node: emotion-constants
- **Type**: constants
- **Agent**: frontend-developer
- **Depends on**: (none — can run in parallel with schema)
- **Inputs**: `EMOTIONS.md` §canonical set (12 feelings, oklch values), §derived styles (base/fill/edge/bright formulas), §code example
- **Outputs**: `src/lib/emotions.ts` — exports `EMOTIONS` const array (12 objects: slug, label, l, c, h), `base()`, `fill()`, `edge()`, `bright()` functions; exports `INTERPRETATION_RULES` for deterministic sentence generation per `EMOTIONS.md` §interpretation copy
- **Loop pattern**: one-shot
- **Success criteria**: `EMOTIONS` has exactly 12 entries in wheel clockwise order (delighted first, bored last); all four colour functions return valid oklch strings; `EMOTIONS[11].slug === 'bored'`; `base(EMOTIONS[0])` returns `oklch(0.82 0.15 90)`
- **Estimated effort**: Trivial
- **Design reference**: `EMOTIONS.md` full file

#### Node: house-constants
- **Type**: constants
- **Agent**: frontend-developer
- **Depends on**: (none)
- **Inputs**: `THE-HOUSE.md` §ladder (7 ranks), §rendering (chip styles, badge styles, seating row formula), `DATA-MODEL.md` §10 (HOUSE_RANKS)
- **Outputs**: `src/lib/house.ts` — exports `HOUSE_RANKS` const array of 7 names; `HouseRank` type (0-6); `rankRow(rank: HouseRank)` function implementing `row = 3 - floor(rank * 3 / 6)`; rank-up copy strings per `THE-HOUSE.md` §rank-up moment; criteria descriptions per rank
- **Loop pattern**: one-shot
- **Success criteria**: `HOUSE_RANKS[0] === 'Standing Room'`; `HOUSE_RANKS[6] === 'Company'`; `rankRow(0) === 3` (back row); `rankRow(6) === 0` (front row); all 6 rank-up copy strings present
- **Estimated effort**: Trivial
- **Design reference**: `THE-HOUSE.md` full file

#### Node: design-tokens
- **Type**: constants
- **Agent**: frontend-developer
- **Depends on**: (none)
- **Inputs**: `README.md` §2.2 (all design tokens: surfaces, ink, accent, typography, radius, spacing)
- **Outputs**: `src/styles/tokens.css` — CSS custom properties for all tokens (`--bg: #0c0a05`, `--bg-card: #141109`, `--bg-chrome: #1a1610`, `--rule: #2b2720`, `--rule-soft: #211d17`, `--ink: #ebe5d6`, `--ink-dim: #9c9586`, `--ink-faint: #625b4c`, `--ink-ghost: #4f4a3e`, `--ink-whisper: #3f3a31`, `--accent: oklch(0.80 0.14 55)`, `--accent-text: oklch(0.84 0.13 55)`, `--accent-border: oklch(0.42 0.09 55)`, `--accent-bg: oklch(0.20 0.04 55)`, `--accent-deep: oklch(0.45 0.10 55)`, `--live: oklch(0.74 0.16 145)`, `--access: oklch(0.68 0.13 150)`); Google Fonts import for Newsreader, Courier Prime, JetBrains Mono; font utility classes
- **Loop pattern**: one-shot
- **Success criteria**: all 17 colour tokens match `README.md` §2.2 exactly; `--accent` is `oklch(0.80 0.14 55)` not any Tailwind amber; fonts load; Newsreader italic renders; gold gradient `linear-gradient(180deg, oklch(0.16 0.04 55), #0c0a05)` defined
- **Estimated effort**: Small
- **Design reference**: `README.md` §2.2

#### Node: type-updates
- **Type**: types
- **Agent**: frontend-developer
- **Depends on**: (none)
- **Inputs**: `DATA-MODEL.md` §10 (TypeScript types to update)
- **Outputs**: Modified `src/lib/types.ts` — adds `Emotion` union type (12 slugs), `WatchlistStatus`, `RoomVolume`, `Play`, `EventAccess`, `SpectrumSlice`, `HouseRank`; modifies `Profile` (belt_level -> house_rank, +ushered_count), `WatchlistItem` (rating -> emotions + room_volume + performance_at + seat_note), `Review` (rating -> emotions + prompt), `Event` (+play_id); deletes `BELT_NAMES`, `BELT_COLORS`, `LearningContent`
- **Loop pattern**: one-shot
- **Success criteria**: `Emotion` type has exactly 12 union members; no `rating` field on WatchlistItem or Review; no `belt_level` on Profile; `BELT_NAMES` and `BELT_COLORS` deleted; `HOUSE_RANKS` exported; no TypeScript errors in `types.ts`
- **Estimated effort**: Small
- **Design reference**: `DATA-MODEL.md` §10

### Log-a-Show Nodes

#### Node: emotion-wheel
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: emotion-constants, design-tokens, type-updates
- **Inputs**: `README.md` §3.4 (wheel spec: 300x300 box, 12 nodes at 66px on 112px radius, exact left/top positions for all 12), `EMOTIONS.md` §derived styles (selected state: 1.5px solid base, fill oklch(0.21 C*0.3 H))
- **Outputs**: `src/components/EmotionWheel.tsx` — 300x300 relative container; 12 circular 66px nodes positioned per the left/top table in §3.4; centre label "PICK UP TO THREE" (Courier Prime 10px, letter-spacing 0.1em, #4f4a3e, 108px wide box at left:96px top:112px); selection state (1-3 picks, 4th rejected with 120ms shake on centre label); selected row below wheel showing SELECTED label + 10px dots
- **Loop pattern**: plan-execute-verify
- **Success criteria**: 12 nodes render in a circle at exact px positions from §3.4; unselected = 1px solid #2b2720, no fill, label in base colour; selected = 1.5px solid base, fill oklch(0.21 C*0.3 H), text oklch(L+0.12 C-0.03 H); max 3 selections enforced; 4th tap triggers 120ms shake on centre, no state change; selection order preserved; `Bored` node at position left:62 top:21 with text #625b4c; selected row shows dots in pick order at 10px; touch targets >= 66px
- **Estimated effort**: Medium
- **Design reference**: `README.md` §3.4, `EMOTIONS.md` §canonical set + §derived styles + §rules #1-2

#### Node: room-volume
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: emotion-wheel
- **Inputs**: `README.md` §3.4 (room volume selector: three equal buttons, 46px, gap 8px), `EMOTIONS.md` §room volume
- **Outputs**: `src/components/RoomVolumeSelector.tsx` — three equal-width 46px buttons (Courier Prime 10.5px, radius 3px): "A MURMUR" / "REAL APPLAUSE" / "EVERYONE STOOD"; unselected = #9c9586 on 1px solid #2b2720; selected = gold text on oklch(0.20 0.04 55) with 1.5px solid oklch(0.80 0.14 55); optional (user can skip)
- **Loop pattern**: one-shot
- **Success criteria**: three buttons render at 46px height; only one selectable at a time; deselect by tapping again; Courier Prime 10.5px; unselected/selected styles match spec; optional — no validation error when skipped
- **Estimated effort**: Trivial
- **Design reference**: `README.md` §3.4, `EMOTIONS.md` §room volume

#### Node: log-show-page
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: room-volume, schema-shelves, schema-emotion-agg
- **Inputs**: `README.md` §3.4 (full Log a show spec), §5 (sheet animation 300ms cubic-bezier(.2,.8,.2,1)), `DATA-MODEL.md` §2 (watchlist mutations)
- **Outputs**: `src/pages/LogShow.tsx` — step 1 page with header bar (CANCEL left, STEP 1 OF 2 right), context line (TONIGHT, 8:00 + VENUE in gold Courier Prime 10px), title (Newsreader italic 27px), prompt "So. What did it do to you?" (Newsreader 15px #9c9586), EmotionWheel, RoomVolumeSelector, footer CTA "Next -- say a little more ->" (full width, 50px, gold, Newsreader italic 16px); writes emotions + room_volume to watchlist row; sets status to 'seen' and stamps seen_date; clears booking if applicable; pre-fills from past-due booking
- **Loop pattern**: plan-execute-verify
- **Success criteria**: header shows CANCEL (Courier Prime 11px #9c9586) and STEP 1 OF 2 (Courier Prime 10px #625b4c); context line renders venue + time in gold; wheel functional; footer CTA 50px with border-top 1px solid #2b2720 and padding 14px 20px 26px; writing to Supabase succeeds — emotions array, room_volume, status='seen', seen_date stamped; past-due bookings auto-fill; sheet enters from bottom at 300ms cubic-bezier(.2,.8,.2,1); emotion-aggregate triggers fire
- **Estimated effort**: Medium
- **Design reference**: `README.md` §3.4, §5 (interactions/motion)

### Write-Review Nodes

#### Node: write-review-page
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: log-show-page
- **Inputs**: `README.md` §3.5 (Write a review spec: prompt chips, editor, spoiler toggle, privacy note, footer CTAs), `DATA-MODEL.md` §3 (reviews mutations)
- **Outputs**: `src/pages/WriteReview.tsx` — step 2 page with header (BACK left, STEP 2 OF 2 right); chosen emotion pills at top with "edit" link back to step 1; PICK A PROMPT label + 3 prompt chips (Courier Prime 10.5px, padding 6px 11px, radius 14px; selected = gold fill #0c0a05 text; prompts verbatim: "What surprised you?" / "One image you'll keep" / "Who should go?"); editor well (1px solid #2b2720, radius 3px, bg #141109, padding 16px, min-height 236px, prompt echoed in gold Courier Prime 10px, text Newsreader 16px line-height 1.55 #ebe5d6); spoiler toggle (38x22 track, 18px knob, 160ms ease); privacy note (Newsreader 13.5px #625b4c with real venue name); footer: JUST LOG IT (96px outline) + Post to the house (flex:1 gold Newsreader italic 16px), both 50px
- **Loop pattern**: plan-execute-verify
- **Success criteria**: emotion pills render with edit link; swapping prompts never clears typed text; spoiler toggle: track 38x22, knob 18px, off = #2b2720 track + #625b4c knob, on = oklch(0.20 0.04 55) track + gold knob, 160ms; privacy note substitutes real venue name; JUST LOG IT writes watchlist only (no review); Post to the house writes both review + watchlist; review.emotions defaults from log step; step 2 is skippable (footer CTA from step 1 allows skip); character count in JetBrains Mono 10.5px #4f4a3e
- **Estimated effort**: Medium
- **Design reference**: `README.md` §3.5

### My-Shows Nodes

#### Node: my-shows-ledger
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: write-review-page
- **Inputs**: `README.md` §3.2 Take B (the ledger: header, segmented tabs, month dividers, row spec with day/title/venue/emotion dots/excerpt/ushered badge), §3.2 Take A (palette bar in Seen card — implement the Seen summary even in ledger view)
- **Outputs**: `src/pages/MyShows.tsx` — header "My Shows" Newsreader italic 26px + "SINCE {year}" JetBrains Mono 11px #625b4c; segmented tabs (WANT TO SEE / BOOKED / SEEN with counts; Courier Prime 12px, padding 8px 0 12px, active = #ebe5d6 + gold count + 2px gold underline, inactive = #625b4c + #4f4a3e count); month dividers (MONTH YEAR label + 1px rule + N SHOWS in Courier Prime 9.5px #4f4a3e); rows: grid 34px 1fr auto, gap 12px, padding 11px 20px, border-bottom 1px solid #211d17; day zero-padded JetBrains Mono 11px #625b4c; title Newsreader italic 17.5px; venue Courier Prime 10px #625b4c; optional excerpt Newsreader italic 13.5px #9c9586 (80 chars); optional USHERED badge (Courier Prime 8.5px, oklch(0.68 0.13 150), radius 9px); emotion dots 9px gap 3px in pick order
- **Loop pattern**: plan-execute-verify
- **Success criteria**: three tabs filter correctly; counts update in real-time; month dividers group by calendar month; rows render at exact grid spec; emotion dots in user's pick order (never sorted); USHERED badge in access green; excerpt truncated at ~80 chars on word boundary; Booked tab shows performance_at + seat_note; pull-to-refresh works
- **Estimated effort**: Medium
- **Design reference**: `README.md` §3.2 Take B

#### Node: my-shows-empty-states
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: my-shows-ledger
- **Inputs**: `README.md` §5 (empty state copy, verbatim)
- **Outputs**: Modified `src/pages/MyShows.tsx` — empty states per shelf: Want to See = "Nothing on the list yet." / "The map knows what's up tonight. Start there."; Seen = "Your record starts whenever you say it does." / "Log something you saw in 2019 -- it counts."; two-line layout, line 1 Newsreader 15px #ebe5d6, line 2 Newsreader 14px #9c9586
- **Loop pattern**: one-shot
- **Success criteria**: each shelf shows verbatim copy when empty; copy matches §5 exactly including curly apostrophes and em dashes; no spinner, no illustration — just the two lines
- **Estimated effort**: Trivial
- **Design reference**: `README.md` §5

### Show-Detail Nodes

#### Node: spectrum-bar
- **Type**: component
- **Agent**: frontend-developer
- **Depends on**: emotion-constants
- **Inputs**: `EMOTIONS.md` §spectrum bar (display:flex, gap:1px, sorted descending, 7-segment cap), `README.md` §4.2 (heights by context: 8/9/11/26/30px)
- **Outputs**: `src/components/SpectrumBar.tsx` — props: slices (SpectrumSlice[]), height (8|9|11|26|30), totalCards (number); renders flex row with gap:1px, border-radius h/2, overflow hidden; one span per feeling sorted descending by pct with flex:{pct} and background:base(); capped at 7 segments (remainder folded into 7th); below bar: top 2-3 feelings with percentages in Courier Prime 10.5px each in its own colour; when totalCards < 5, show dots instead of bar with "EARLY DAYS * N CARDS" label
- **Loop pattern**: plan-execute-verify
- **Success criteria**: bar renders with gap:1px between segments; segments sorted descending; max 7 segments (tail folded); border-radius = height/2; heights match context (8px map sheet, 9px tonight hero, 11px show detail, 26px my-shows card, 30px profile); percentages below bar in each feeling's base colour; < 5 cards shows raw dots with "EARLY DAYS" label; colours are oklch from EMOTIONS, not hex approximations
- **Estimated effort**: Small
- **Design reference**: `EMOTIONS.md` §spectrum bar (rule #6), `README.md` §4.2

#### Node: interpretation-copy
- **Type**: component
- **Agent**: frontend-developer
- **Depends on**: spectrum-bar
- **Inputs**: `EMOTIONS.md` §interpretation copy (8 deterministic rules in priority order), §personal palette (profile sentence patterns)
- **Outputs**: `src/components/InterpretationSentence.tsx` — props: slices (SpectrumSlice[]), totalCards (number), isPersonal (boolean), venuKind? (string); implements the 8 rules in priority order: top >= 40% -> "The room agreed."; top two within 6pts and opposed -> "A divisive one..."; bored in top 3 -> "Some people checked out..."; top=held|seen -> "People felt taken care of..."; top=cracked_open|aching -> "Bring someone you can talk to..."; top=buzzing|delighted -> "A good night out..."; < 5 cards -> "Too early to say..."; otherwise -> "Mixed room..."; personal mode uses warm sentence patterns from §personal palette
- **Loop pattern**: one-shot
- **Success criteria**: all 8 rules produce correct sentence for test inputs; priority order respected (rule 1 beats rule 4); personal mode generates "You are, statistically..." pattern; Newsreader 14px #9c9586; italic for feeling names; no star ratings, no numbers restated; sentences match §interpretation copy verbatim
- **Estimated effort**: Small
- **Design reference**: `EMOTIONS.md` §interpretation copy + §personal palette

#### Node: production-detail
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: interpretation-copy, schema-plays, schema-access
- **Inputs**: `README.md` §3.3 (show detail: hero 196px, title block, house felt panel, company, reviews, play link), `THE-HOUSE.md` §review badge
- **Outputs**: `src/pages/ProductionDetail.tsx` — hero 196px with scrim; title block (H1 Newsreader italic 31px, credit line, run line, access chips, actions); "the house felt" panel (bg #141109, label + N CARDS, SpectrumBar at 11px, top-3 percentages, InterpretationSentence); company section (56px headshots, cap at 3 + overflow); reviews section (label + WRITE ONE gold link, reviews with name + house rank badge + emotion dots + body, divided by 1px dotted #2b2720, spoiler collapse); play link ("THE PLAY: {title} * N productions tracked ->"); `ReviewBadge.tsx` component (Courier Prime 8.5px, letter-spacing 0.1em, padding 1px 6px, radius 9px; Orchestra+ = gold on gold border; below = #9c9586 on #2b2720)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: hero 196px, scrim gradient exact per spec; title Newsreader italic 31px line-height 1.03; credit line shows playwright roman + director italic; run line Courier Prime 10px letter-spacing 0.08em; access chips: PAY-WHAT-YOU-CAN in oklch(0.68 0.13 150); spectrum panel bg #141109 with 11px bar; review badge distinguishes Orchestra+ from below; spoiler reviews collapse with tap target (Courier Prime 11px, oklch(0.66 0.19 35), bg oklch(0.20 0.05 35), min-height 44px); play link renders when play_id present; no title pulled up over hero with negative margin; no star ratings anywhere
- **Estimated effort**: Large
- **Design reference**: `README.md` §3.3, `THE-HOUSE.md` §review badge

### Tonight Nodes

#### Node: marquee-ticker
- **Type**: component
- **Agent**: frontend-developer
- **Depends on**: design-tokens, schema-tonight
- **Inputs**: `README.md` §3.1 #2 (marquee: full-bleed, gold gradient bg, overflow hidden, 26s linear infinite, content duplicated, Courier Prime 10.5px letter-spacing 0.14em gold, separators in #625b4c)
- **Outputs**: `src/components/MarqueeTicker.tsx` — full-bleed strip with bg linear-gradient(180deg, oklch(0.16 0.04 55), #0c0a05), border-bottom 1px solid #2b2720; inner row display:inline-flex gap:28px padding:9px 0; Courier Prime 10.5px letter-spacing 0.14em oklch(0.80 0.14 55); separators in #625b4c; content: "N CURTAINS UP TONIGHT * N UNDER $20 * N OPENINGS" duplicated once for seamless loop; @keyframes translateX(0) to translateX(-50%) 26s linear infinite; prefers-reduced-motion: static first three items; props: tonightCount, under20Count, openingsCount
- **Loop pattern**: one-shot
- **Success criteria**: marquee scrolls seamlessly (no gap between loops); 26s duration; gold text on gold gradient; paused under prefers-reduced-motion: reduce (shows first three items statically); live counts from `is_up_tonight()` and price queries; duplicated DOM for seamless loop; border-bottom 1px solid #2b2720
- **Estimated effort**: Small
- **Design reference**: `README.md` §3.1 #2, §5 (reduced motion)

#### Node: tonight-hero
- **Type**: component
- **Agent**: frontend-developer
- **Depends on**: spectrum-bar, interpretation-copy
- **Inputs**: `README.md` §3.1 #3 (hero production: 196px image, scrim, genre chips, title 29px, venue line, blurb, house felt, actions), §3.1.1 (genre hue map)
- **Outputs**: `src/components/TonightHero.tsx` + `src/components/GenreChip.tsx` — hero image band 196px full-bleed with scrim; genre chips at bottom-left (primary = text oklch(0.82 0.15 H) bg oklch(0.22 0.05 H) per genre hue table; secondary = #9c9586 outline); body block padding 14px 20px 18px: title Newsreader italic 29px line-height 1.04; venue Courier Prime 10.5px letter-spacing 0.08em #625b4c format "VENUE * SPACE * NEIGHBORHOOD"; blurb Newsreader 15px #9c9586 with italic play titles; 9px SpectrumBar; actions row gap 10px: "Want to see" flex:1 46px gold Newsreader italic 15px + price button 104px 46px outline
- **Loop pattern**: plan-execute-verify
- **Success criteria**: image band exactly 196px; scrim gradient matches §3.1 #3; genre chip colours derive from hue table (Musical=90, Drama=250, Experimental=300, Classic=55, New work=150, Thriller=25); title 29px italic; venue line uppercase with dots; spectrum bar 9px; "Want to see" button 46px gold; price button 104px outline with real price; border-bottom 1px solid #2b2720
- **Estimated effort**: Medium
- **Design reference**: `README.md` §3.1 #3 + §3.1.1

#### Node: tonight-friends
- **Type**: component
- **Agent**: frontend-developer
- **Depends on**: emotion-constants
- **Inputs**: `README.md` §3.1 #4 (your people went out: grid 40px 1fr, avatar, sentence with italic names, emotion pills, quote with left border), `DATA-MODEL.md` §8 (friend activity query)
- **Outputs**: `src/components/TonightFriends.tsx` + `src/hooks/useFriendActivity.ts` — section padding 16px 20px 14px with YOUR PEOPLE WENT OUT label; grid 40px 1fr gap 12px; 40px circular avatar; sentence Newsreader 14.5px line-height 1.35 (friend name + production title italic, connective words #9c9586); `EmotionPill.tsx` component (Courier Prime 9.5px, padding 2px 7px, radius 9-10px, border 1px solid oklch(0.36 C*0.5 H), bg oklch(0.21 C*0.3 H), text oklch(L+0.10 C-0.02 H)); quote Newsreader italic 13.5px #9c9586 with border-left 2px solid #2b2720 padding-left 10px (first 90 chars, curly quotes, word boundary ellipsis); `useFriendActivity` hook: accepted friends + watchlist status=seen last 14 days, ordered by seen_date desc, respects share_reflections
- **Loop pattern**: plan-execute-verify
- **Success criteria**: avatar 40px circle; sentence renders friend name and production title in italic; emotion pills use oklch derived colours per EMOTIONS.md §derived styles; quote truncated at 90 chars on word boundary with curly quotes; border-left 2px solid #2b2720; respects share_reflections (hides quote when false); empty state: "Nobody here yet." / "Theater is better with one other person. Bring one."
- **Estimated effort**: Medium
- **Design reference**: `README.md` §3.1 #4, §4.3 (pills), `DATA-MODEL.md` §8

#### Node: tonight-free
- **Type**: component
- **Agent**: frontend-developer
- **Depends on**: design-tokens
- **Inputs**: `README.md` §3.1 #5 (free tonight: label in access green, fallback to cheapest three)
- **Outputs**: `src/components/TonightFree.tsx` — section padding 16px 20px; label "FREE TONIGHT" in oklch(0.68 0.13 150) + trailing "-- NO CATCH, NO TICKET" in #4f4a3e; body Newsreader 15px line-height 1.4 (initiative name italic #ebe5d6, rest #9c9586); fallback: if nothing free, show cheapest three under label "CHEAPEST TONIGHT"; never render empty
- **Loop pattern**: one-shot
- **Success criteria**: "FREE TONIGHT" label in access green oklch(0.68 0.13 150); trailing text in #4f4a3e; initiative name italic; NEVER renders empty — falls back to cheapest three; fallback label "CHEAPEST TONIGHT"; free/cheap data from event prices and venue pay_what_you_can_days
- **Estimated effort**: Small
- **Design reference**: `README.md` §3.1 #5

#### Node: tonight-page
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: marquee-ticker, tonight-hero, tonight-friends, tonight-free
- **Inputs**: `README.md` §3.1 (full Tonight spec: masthead, marquee, hero, friends, free), `README.md` §2.3 (route: /app)
- **Outputs**: `src/pages/Tonight.tsx` — replaces Discover as home route (/app); masthead (padding 8px 20px 12px, border-bottom #2b2720: "The Art of Art" Courier Prime 700 19px letter-spacing -0.01em #ebe5d6 + " * chicago" Courier Prime 10px #625b4c; right: notification glyph in #9c9586 18px); MarqueeTicker; TonightHero; TonightFriends; TonightFree; pull-to-refresh
- **Loop pattern**: plan-execute-verify
- **Success criteria**: masthead "The Art of Art" is Courier Prime bold 19px (NOT Newsreader); dot separator + "chicago" in #625b4c; notification glyph 18px right-aligned; sections stack in order: masthead, marquee, hero, friends, free; route is /app (replaces Discover); pull-to-refresh supported; border-bottom 1px solid #2b2720 on masthead
- **Estimated effort**: Small
- **Design reference**: `README.md` §3.1

### Map-Overhaul Nodes

#### Node: map-markers
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: production-detail, schema-tonight
- **Inputs**: `README.md` §3.8 (markers: 34x40 hit area, 30x30 chip with 4px border-radius, 6px tail, glyphs by room kind, border by relationship, tonight dot 9px with 1.8s pulse, selected scale 1.18)
- **Outputs**: Modified `src/components/MapView.tsx` + `src/components/MapMarker.tsx` — custom markers: 30x30 chip bg #141109, border-radius 4px, 1.5px border, box-shadow 0 3px 8px rgba(0,0,0,.7), 6px rotated square tail; glyphs by kind: institutional, storefront, devised/experimental; border by relationship: booked=solid gold fill glyph #0c0a05, want_to_see=1.5px dashed gold glyph gold, seen=1.5px solid dominant-feeling glyph same colour + 8px dot, never_been=1.5px solid #2b2720 glyph #9c9586; tonight dot 9px oklch(0.74 0.16 145) with 2px #0c0a05 ring at top-right, 1.8s opacity pulse; selected: scale(1.18) with glow shadow 120ms; filtered-out: opacity .22 (never removed)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: markers render with correct glyphs per room kind; relationship borders match spec exactly (dashed for want_to_see, solid gold fill for booked, feeling colour for seen); tonight dot pulses at 1.8s; selected marker scales 1.18 with shadow; filtered markers dim to opacity .22 not removed; tonight dot suppressed under prefers-reduced-motion; hit area 34x40; tail at left:12px top:29px
- **Estimated effort**: Large
- **Design reference**: `README.md` §3.8 (markers section)

#### Node: map-filters
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: map-markers
- **Inputs**: `README.md` §3.8 (filter chips floating at top:10px, backdrop-filter blur(6px), additive AND logic; the key legend card)
- **Outputs**: Modified `src/components/MapView.tsx` + `src/components/MapFilterChips.tsx` + `src/components/MapKey.tsx` — filter chips: TONIGHT / UNDER $20 / STOREFRONT / USHER SLOTS / NEVER BEEN, horizontal scroll, top:10px padding 0 14px, backdrop-filter blur(6px) bg rgba(12,10,5,.9); chips are additive (AND); MapKey: legend card bottom-left rgba(12,10,5,.9) 1px solid #2b2720 radius 3px padding 9px 11px backdrop-filter blur(6px), Courier Prime 9.5px #9c9586, five verbatim lines: "you have tickets" / "want to see" / "been -- your colour" / "curtain up tonight" / "house * storefront * devised"
- **Loop pattern**: plan-execute-verify
- **Success criteria**: chips float over map at top:10px; backdrop-filter blur(6px); additive AND filtering; markers cross-fade opacity 120ms on filter change; counts in peek line update immediately; key card bottom-left with 5 verbatim lines; all chips Courier Prime; TONIGHT filter uses is_up_tonight(); UNDER $20 checks price_min; USHER SLOTS checks event_access.usher_slots > 0; NEVER BEEN checks no watchlist entry
- **Estimated effort**: Medium
- **Design reference**: `README.md` §3.8 (filter + key sections)

#### Node: venue-sheet
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: map-filters, spectrum-bar
- **Inputs**: `README.md` §3.8 (sheet spec: bottom:79px, radius 16px 16px 0 0, border-top #2b2720, shadow 0 -14px 44px rgba(0,0,0,.75), z-index 1100; peek state, detail state with 5 subsections)
- **Outputs**: `src/components/VenueSheet.tsx` — bottom-anchored sheet at bottom:79px, left/right 0, border-radius 16px 16px 0 0, border-top 1px solid #2b2720, bg #0c0a05, shadow 0 -14px 44px rgba(0,0,0,.75), z-index 1100; grab handle 38x4 radius 2 #2b2720; peek state: headline Newsreader italic 19px "N curtains up within three miles" + Courier Prime label "TAP A THEATER * N UNDER $20 * N PAY-WHAT-YOU-CAN"; detail state: (1) 88x66 photo + name italic 22px + neighbourhood/kind/price label + history line, (2) tonight panel bg #141109 with live dot + production + 8px spectrum bar, (3) fact chips (first gold-tinted, rest outline), (4) actions (primary gold + outline + 56px directions), (5) ALSO WITHIN A TEN-MINUTE WALK nearest two venues; tap background returns to peek; selecting marker pans map
- **Loop pattern**: plan-execute-verify
- **Success criteria**: sheet anchored above tab bar (bottom:79px); never covers tab bar; shadow exactly 0 -14px 44px rgba(0,0,0,.75); z-index 1100 above map controls; peek shows live counts; detail shows all 5 subsections; tonight panel shows ON STAGE TONIGHT or DARK TONIGHT with appropriate dot colour; history line shows "YOU'VE BEEN N TIMES" or "NEVER BEEN"; fact chips first is gold-tinted; directions button 56px with arrow; nearby venues show UP/DARK status; attribution visible in every state
- **Estimated effort**: Large
- **Design reference**: `README.md` §3.8 (sheet section)

#### Node: map-basemap
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: map-markers
- **Inputs**: `README.md` §3.8 (basemap tint: Mapbox custom dark style matched to #0c0a05 land, #2b2720 roads, #625b4c labels; or CSS filter fallback)
- **Outputs**: Modified `src/hooks/useMap.ts` or Mapbox style JSON — dark basemap with land #0c0a05, roads #2b2720, labels #625b4c; streets, river, and neighbourhood labels legible; attribution always visible
- **Loop pattern**: plan-execute-verify
- **Success criteria**: basemap reads dark with warm undertone matching app palette; streets visible; Chicago River visible; neighbourhood labels legible in #625b4c; OpenStreetMap attribution visible; no bright elements that clash with marker system
- **Estimated effort**: Small
- **Design reference**: `README.md` §3.8 (basemap section)

### Profile Nodes

#### Node: seating-chart
- **Type**: component
- **Agent**: frontend-developer
- **Depends on**: house-constants
- **Inputs**: `THE-HOUSE.md` §seating chart (container, STAGE label, stage edge, 4 rows of 8 squares, row assignment formula, lit seat spec, STANDING ROOM label)
- **Outputs**: `src/components/SeatingChart.tsx` — props: rank (HouseRank), animated? (boolean); container border 1px solid #2b2720 radius 3px bg #141109 padding 12px 0 10px flex-col align-center gap 5px; STAGE label Courier Prime 8.5px letter-spacing 0.3em #4f4a3e; stage edge 180x2px oklch(0.42 0.09 55) margin-bottom 8px; 4 rows of 8 x 7px squares (radius 1px, gap 4px); rows nearer stage than user: oklch(0.55 0.11 55); user row: oklch(0.45 0.09 55) with seat at index 3 = 11px square radius 2px bg oklch(0.86 0.15 55) box-shadow 0 0 10px oklch(0.80 0.14 55); rows behind: #2b2720; STANDING ROOM Courier Prime 8.5px letter-spacing 0.2em #4f4a3e margin-top 6px; row formula: row = 3 - floor(rank * 3 / 6)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: rank 0 sits in row 3 (back); rank 6 sits in row 0 (front); lit seat at index 3 with glow shadow; rows between stage and user row in oklch(0.55 0.11 55); rows behind user in #2b2720; exactly 4 rows of 8 squares; STAGE at top, STANDING ROOM at bottom; animated mode supports 400ms forward animation for rank-up
- **Estimated effort**: Small
- **Design reference**: `THE-HOUSE.md` §seating chart

#### Node: house-chips
- **Type**: component
- **Agent**: frontend-developer
- **Depends on**: house-constants
- **Inputs**: `THE-HOUSE.md` §ladder chips (3 states: achieved, current, future)
- **Outputs**: `src/components/HouseChips.tsx` — all 7 rank names as chips, wrap, gap 6px; Courier Prime 10px padding 4px 9px radius 2px; achieved = #4f4a3e on 1px solid #211d17 with text-decoration line-through; current = oklch(0.80 0.14 55) text on 1px solid oklch(0.42 0.09 55) bg oklch(0.20 0.04 55); future = #625b4c on 1px dashed #2b2720; names uppercase in chips
- **Loop pattern**: one-shot
- **Success criteria**: 7 chips render; names uppercase; achieved chips struck through; current chip gold with accent bg; future chips dashed border; chip order: Standing Room through Company
- **Estimated effort**: Trivial
- **Design reference**: `THE-HOUSE.md` §ladder chips

#### Node: palette-bar
- **Type**: component
- **Agent**: frontend-developer
- **Depends on**: spectrum-bar, interpretation-copy
- **Inputs**: `README.md` §3.6 #3 (your palette this season: 30px palette bar + insight sentence)
- **Outputs**: `src/components/PaletteBar.tsx` + `src/hooks/useEmotionAggregates.ts` — wraps SpectrumBar at 30px height with personal InterpretationSentence; `useEmotionAggregates` hook fetches profile_emotion_counts for user (all-time or this season); insight sentence warm and non-judgmental per EMOTIONS.md §personal palette
- **Loop pattern**: one-shot
- **Success criteria**: bar renders at 30px on profile, 26px on My Shows; insight sentence uses personal mode ("You are, statistically..."); season = Sep 1 - Aug 31; never compares to other users; never prescriptive
- **Estimated effort**: Small
- **Design reference**: `README.md` §3.6 #3, `EMOTIONS.md` §personal palette

#### Node: stat-strip
- **Type**: component
- **Agent**: frontend-developer
- **Depends on**: design-tokens
- **Inputs**: `README.md` §3.6 #2 (four cells: SHOWS/VENUES/WROTE/USHERED)
- **Outputs**: `src/components/StatStrip.tsx` — four equal cells padding 14px 0, dividers 1px solid #2b2720; value Newsreader italic 24px; label Courier Prime 9px letter-spacing 0.1em #625b4c; labels: SHOWS / VENUES / WROTE / USHERED; ushered value always oklch(0.68 0.13 150) even at zero
- **Loop pattern**: one-shot
- **Success criteria**: four equal cells with dividers; values Newsreader italic 24px; labels Courier Prime 9px; ushered value always in access green; zero shows as "0" not "--"
- **Estimated effort**: Trivial
- **Design reference**: `README.md` §3.6 #2

#### Node: profile-page
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: seating-chart, house-chips, palette-bar, stat-strip
- **Inputs**: `README.md` §3.6 (full You page: header on gold gradient, rank row, seating chart, next-step sentence, stat strip, palette, house chips)
- **Outputs**: Modified `src/pages/Profile.tsx` — header on gold gradient (linear-gradient 180deg oklch(0.16 0.04 55) to #0c0a05), padding 14px 20px 18px, border-bottom #2b2720; 54px circular avatar + name Newsreader italic 23px + "CHICAGO * SINCE {date}" Courier Prime 10px #625b4c; rank row: YOUR SEAT label + rank name Newsreader italic 20px oklch(0.84 0.13 55) + "N OF 7" Courier Prime 9.5px #4f4a3e; SeatingChart; next-step sentence Newsreader 14.5px #9c9586 with next rank italic #ebe5d6 (invitation pattern from THE-HOUSE.md §non-negotiable #7); StatStrip; PaletteBar at 30px (this season); HouseChips
- **Loop pattern**: plan-execute-verify
- **Success criteria**: gold gradient header; avatar 54px; name italic 23px; YOUR SEAT label; rank name in gold text; seating chart with correct lit row; next-step sentence uses invitation pattern never requirement pattern; stat strip 4 cells; palette 30px with personal insight; house chips 7 with correct states; no belt references anywhere; no leaderboard or comparison
- **Estimated effort**: Medium
- **Design reference**: `README.md` §3.6, `THE-HOUSE.md` §rendering

### House-Engine Nodes

#### Node: house-check-fn
- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: schema-house, log-show-page
- **Inputs**: `THE-HOUSE.md` §ladder (criteria table for all 7 ranks), §non-negotiable rules (no money criterion, ushering counts double, never lower)
- **Outputs**: `supabase/functions/house-check/index.ts` — Edge Function that calls `check_house_rank(user_id)` DB function after log/review events; returns new rank if advanced, null otherwise; JWT auth required; idempotent
- **Loop pattern**: plan-execute-verify
- **Success criteria**: after logging show #1 with feelings, user advances to Balcony (rank 1); after 3 shows at 2+ venues, advances to Mezzanine; rank never decreases; ushering satisfies Front Row alternative; criteria match THE-HOUSE.md exactly; returns new rank only on first advancement; JWT verified
- **Estimated effort**: Medium
- **Design reference**: `THE-HOUSE.md` §ladder + §non-negotiable rules

#### Node: house-rank-modal
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: seating-chart, house-check-fn
- **Inputs**: `THE-HOUSE.md` §rank-up moment (full-bleed, gold gradient, enlarged seating chart 1.6x, seat animation 400ms, rank name 34px, copy per rank)
- **Outputs**: `src/components/HouseRankModal.tsx` — full-bleed #0c0a05 with gold gradient; SeatingChart enlarged ~1.6x centred; lit seat animates forward one row at 400ms cubic-bezier(.2,.8,.2,1); vacated row fades from oklch(0.45 0.09 55) to oklch(0.55 0.11 55) over 400ms; rank name Newsreader italic 34px oklch(0.84 0.13 55); one line of rank-specific copy Newsreader 16px #9c9586 (verbatim from THE-HOUSE.md); dismiss by tapping anywhere; never shown twice; under prefers-reduced-motion, seat drawn in new position immediately
- **Loop pattern**: plan-execute-verify
- **Success criteria**: fires once immediately after qualifying log/review; seating chart 1.6x scale; seat animation 400ms with cubic-bezier; rank name 34px gold; copy matches THE-HOUSE.md verbatim per rank (e.g., Balcony = "That's one. The rest of your life in this city just got a little bigger."); dismisses on tap; never repeats; no confetti, no sound, no share prompt; reduced motion respected
- **Estimated effort**: Medium
- **Design reference**: `THE-HOUSE.md` §rank-up moment

#### Node: house-hook
- **Type**: hook
- **Agent**: frontend-developer
- **Depends on**: house-rank-modal
- **Inputs**: `THE-HOUSE.md` §rank-up moment (trigger timing)
- **Outputs**: `src/hooks/useHouseCheck.ts` — replaces `useBeltCheck`; calls house-check Edge Function after log/review; if new rank returned, triggers HouseRankModal; tracks shown-once state to prevent repeat; deletes old `useBeltCheck.ts`
- **Loop pattern**: one-shot
- **Success criteria**: hook calls house-check after each log; triggers modal on rank-up; never triggers modal for same rank twice; cleans up useBeltCheck import references
- **Estimated effort**: Small
- **Design reference**: `THE-HOUSE.md` §rank-up moment

### Nav-Overhaul Nodes

#### Node: navigation-v2
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: tonight-page, profile-page
- **Inputs**: `README.md` §2.3 (5-slot bottom nav: Tonight/Map/FAB/My Shows/You; tab bar spec; gold circle centre)
- **Outputs**: Modified `src/components/Navigation.tsx` — 5 slots: (1) glyph circle-dot TONIGHT /app, (2) glyph crosshair MAP /app/map, (3) gold circle 44x44 bg oklch(0.80 0.14 55) glyph star Newsreader italic 19px #0c0a05 no label opens Log a Show, (4) glyph grid MY SHOWS /app/watchlist, (5) glyph diamond YOU /app/profile; container flex border-top 1px solid #2b2720 bg #0c0a05 padding 8px 6px 22px total height 79px; each slot flex:1 height:48px column-centred gap 3px; glyph 15px label Courier Prime 9px; inactive #625b4c active oklch(0.80 0.14 55); slot 3 never shows active state; routes updated: /app = Tonight, /app/map = Map, /app/watchlist = MyShows, /app/profile = You; removes Learn tab, Discover tab, Social tab from nav
- **Loop pattern**: plan-execute-verify
- **Success criteria**: exactly 5 slots, no 6th; gold circle at centre (44x44, border-radius 50%, bg gold, glyph #0c0a05); tab bar total height 79px (8px top + 48px items + 22px bottom safe area + 1px border); active state gold; inactive #625b4c; slot 3 has no label and no active state; routes correct; Learn removed from router
- **Estimated effort**: Small
- **Design reference**: `README.md` §2.3

#### Node: genre-chips
- **Type**: component
- **Agent**: frontend-developer
- **Depends on**: design-tokens
- **Inputs**: `README.md` §3.1.1 (genre hue map: 6 genres with H values)
- **Outputs**: `src/components/GenreChip.tsx` (if not already created in tonight-hero) + `src/lib/genre.ts` — genre hue map: Musical/comedy=90, Drama/literary=250, Experimental/devised=300, Classic/Shakespeare=55, New work/premiere=150, Thriller=25; chip text oklch(0.82 0.15 H), fill oklch(0.22 0.05 H); secondary chip = #9c9586 on 1px solid #2b2720
- **Loop pattern**: one-shot
- **Success criteria**: all 6 genres map to correct hue; chips render in Courier Prime 9.5px letter-spacing 0.12em padding 3px 8px radius 2px; primary chip coloured by genre; secondary chip neutral
- **Estimated effort**: Trivial
- **Design reference**: `README.md` §3.1.1

#### Node: review-badge
- **Type**: component
- **Agent**: frontend-developer
- **Depends on**: house-constants
- **Inputs**: `THE-HOUSE.md` §review badge (Courier Prime 8.5px, Orchestra+ gold, below #9c9586)
- **Outputs**: `src/components/ReviewBadge.tsx` (if not already created in production-detail) — Courier Prime 8.5px letter-spacing 0.1em padding 1px 6px radius 9px; Orchestra+ (rank >= 3): gold text oklch(0.80 0.14 55) on 1px solid oklch(0.42 0.09 55); below Orchestra: #9c9586 on 1px solid #2b2720; never sort or weight reviews by rank
- **Loop pattern**: one-shot
- **Success criteria**: badge renders rank name; Orchestra+ gold; below neutral; appears only on profile and review headers; never on map, feed, or friend names
- **Estimated effort**: Trivial
- **Design reference**: `THE-HOUSE.md` §review badge

#### Node: access-chips
- **Type**: component
- **Agent**: frontend-developer
- **Depends on**: design-tokens
- **Inputs**: `README.md` §3.3 (access chips: green for accessibility, outline for others)
- **Outputs**: `src/components/AccessChip.tsx` — Courier Prime 9.5px letter-spacing 0.1em padding 3px 8px radius 2px; accessibility chips (PAY-WHAT-YOU-CAN, FREE, USHER, ASL, RELAXED, AUDIO DESCRIBED): colour oklch(0.68 0.13 150) border 1px solid oklch(0.36 0.07 150); other chips (runtime, intermission): #9c9586 on 1px solid #2b2720; order: money first, then access services, then runtime
- **Loop pattern**: one-shot
- **Success criteria**: access chips in green; non-access in neutral; ordering correct; all chip text uppercase; chip renders PAY-WHAT-YOU-CAN with day appended; never buried below fold
- **Estimated effort**: Trivial
- **Design reference**: `README.md` §3.3

#### Node: loading-skeleton
- **Type**: component
- **Agent**: frontend-developer
- **Depends on**: design-tokens
- **Inputs**: `README.md` §5 (loading: skeletons #141109 with 1.4s shimmer to #1a1610, never a full-screen spinner, Tonight hero reserves 196px)
- **Outputs**: `src/components/LoadingSkeleton.tsx` — skeleton blocks with bg #141109 and 1.4s shimmer animation to #1a1610; variants for: card (full-width, radius 3px), text line (various widths), hero (196px), spectrum (bar height), avatar (circle); Tonight hero skeleton reserves 196px to prevent layout jump
- **Loop pattern**: one-shot
- **Success criteria**: shimmer from #141109 to #1a1610 at 1.4s; no spinner on any full screen; Tonight hero skeleton is exactly 196px; skeleton blocks use radius 3px for cards, 9999px for avatars
- **Estimated effort**: Trivial
- **Design reference**: `README.md` §5

### Discover Nodes

#### Node: discover-page
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: tonight-page, production-detail, spectrum-bar
- **Inputs**: `README.md` §3.7 (Discover: search field, filter chips, play card, scene news)
- **Outputs**: `src/pages/Discover.tsx` — search field 46px border 1px solid #2b2720 radius 3px bg #141109 with glyph and placeholder Newsreader italic 15px #4f4a3e "A play, a theater, a feeling..."; filter chips horizontal scroll gap 6px (TONIGHT active gold, UNDER $20 access green, STOREFRONT, ASL; Courier Prime 10px padding 6px 11px radius 14px); THE PLAY NOT THE POSTER section: play title Newsreader italic 20px, playwright + award Newsreader 14px #9c9586, production rows with date/venue/director separated by 1px dotted #2b2720; THE SCENE RIGHT NOW section with 6px live dot, three editorial items with kicker/headline/dek; search by feeling wired to emotion index
- **Loop pattern**: plan-execute-verify
- **Success criteria**: search placeholder italic; search by feeling works (typing "gutted" returns shows where top feeling is gutted per event_spectrum with pct >= 25); filter chips scroll horizontally; play card shows all productions; scene kickers coloured by kind (SEASON DROP gold, FREE access green, CLOSING SOON oklch(0.58 0.16 300)); exactly 3 editorial items; live dot 6px oklch(0.74 0.16 145)
- **Estimated effort**: Medium
- **Design reference**: `README.md` §3.7

#### Node: play-pages
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: discover-page, schema-plays
- **Inputs**: `README.md` §3.3 #6 (play vs production link), §3.7 (play card format), `DATA-MODEL.md` §4 (plays table)
- **Outputs**: `src/pages/PlayDetail.tsx` — play page showing: title Newsreader italic, playwright, year, awards, synopsis; all tracked productions listed with venue/date/director; user's history ("YOU SAW THIS AT COURT IN 2019"); linked from ProductionDetail "THE PLAY: {title} * N productions tracked ->"
- **Loop pattern**: plan-execute-verify
- **Success criteria**: play page shows all productions of the work; past productions show year and venue; user's own viewings highlighted; upcoming productions in gold; linked from show detail; handles null play_id gracefully (no link shown)
- **Estimated effort**: Small
- **Design reference**: `README.md` §3.3 #6, §3.7, `DATA-MODEL.md` §4

### Cleanup Nodes

#### Node: delete-belt-code
- **Type**: cleanup
- **Agent**: frontend-developer
- **Depends on**: house-hook, profile-page, navigation-v2
- **Inputs**: Codebase search for belt references
- **Outputs**: Deleted files: `src/components/BeltUpgradeModal.tsx`, `src/components/BeltDisplay.tsx`, `src/components/BeltProgress.tsx`, `src/hooks/useBeltCheck.ts`; removed from: `src/lib/types.ts` (BELT_NAMES, BELT_COLORS), `src/pages/Profile.tsx` (belt imports/renders), `src/components/ReviewCard.tsx` (belt badge), `src/components/FriendsList.tsx` (belt display), `src/components/AddFriend.tsx` (belt display), `src/pages/Watchlist.tsx` (belt references)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `grep -r "belt" src/` returns zero results (case-insensitive, excluding node_modules); `grep -r "BELT" src/` returns zero results; all belt component files deleted; TypeScript compiles with zero errors; app runs without belt-related runtime errors
- **Estimated effort**: Small
- **Design reference**: `README.md` §0 (fidelity risk #2), `THE-HOUSE.md` §migration from belts

#### Node: delete-star-ratings
- **Type**: cleanup
- **Agent**: frontend-developer
- **Depends on**: production-detail, my-shows-ledger, write-review-page
- **Inputs**: Codebase search for rating references
- **Outputs**: Deleted files: `src/components/CommunityRating.tsx`, `src/components/LogShowModal.tsx`; removed from: `src/lib/types.ts` (rating fields), `src/components/EventCard.tsx` (star display), `src/components/ReviewCard.tsx` (star display), `src/components/ReviewForm.tsx` (star input), `src/components/ReviewsList.tsx` (star rendering), `src/components/ActivityFeed.tsx` (star references), `src/pages/Discover.tsx` (star references), `src/pages/Watchlist.tsx` (rating references), `src/hooks/useWatchlist.ts` (rating field), `src/hooks/useReviews.ts` (rating field)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `grep -r "rating" src/` returns zero results (excluding "community_rating" if still in DB types for migration compat); `grep -r "star" src/` returns zero rating-related results; CommunityRating.tsx and LogShowModal.tsx deleted; no /5 or star icon appears anywhere in the UI; TypeScript compiles clean
- **Estimated effort**: Small
- **Design reference**: `README.md` §0 (fidelity risk #1), §9 (no star, number, or /5 anywhere)

#### Node: delete-learn
- **Type**: cleanup
- **Agent**: frontend-developer
- **Depends on**: navigation-v2
- **Inputs**: Codebase search for Learn references
- **Outputs**: Deleted files: `src/pages/Learn.tsx`, `src/pages/LearningModule.tsx`, `src/components/LearningModal.tsx`; removed from: `src/components/Navigation.tsx` (Learn tab), `src/App.tsx` (Learn route), `src/lib/types.ts` (LearningContent type)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `grep -r "Learn" src/ --include="*.tsx" --include="*.ts"` returns zero results for Learn page/tab references (case-sensitive, allowing "learn" in other contexts like learning-related comments if any); Learn.tsx deleted; /app/learn route removed from router; bottom nav has exactly 5 tabs; TypeScript compiles clean
- **Estimated effort**: Trivial
- **Design reference**: `README.md` §0 (fidelity risk #3)

### Completion Nodes (Phase 8)

#### Node: personal-palette
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: profile-page, my-shows-ledger, schema-emotion-agg
- **Inputs**: `EMOTIONS.md` §5 (personal palette rules, insight sentence patterns), `README.md` §3.6 #3 (profile palette section), `README.md` §3.2 Take B (My Shows palette); DB: `profile_emotion_counts` table (user_id, emotion, weight, season); existing components: `src/components/SpectrumBar.tsx`, `src/components/InterpretationSentence.tsx`
- **Outputs**: `src/hooks/useEmotionAggregates.ts` — hook that queries `profile_emotion_counts` for a user, supports `mode: 'season' | 'all-time'`, returns `SpectrumSlice[]` + `totalCards: number`; `src/pages/Profile.tsx` — replace placeholder with SpectrumBar at 30px + personal insight sentence (season mode); `src/pages/MyShows.tsx` — add palette section to Seen tab with SpectrumBar at 26px + insight sentence (all-time mode)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: hook returns valid slices from profile_emotion_counts; Profile shows 30px SpectrumBar with personal insight when data exists; Profile shows "Log more shows to see your palette" when no data; MyShows Seen tab shows 26px palette bar with all-time insight; season boundary is Sept 1 → Aug 31; insight sentence uses warm patterns from EMOTIONS.md §5 (e.g., "You are, statistically, a person who likes to be {top1} and then {top2}.")
- **Estimated effort**: Small
- **Design reference**: `EMOTIONS.md` §5, `README.md` §3.6 #3, `README.md` §3.2 Take B

#### Node: is-up-tonight-wire
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: tonight-page, map-markers (both already use client-side tonight filtering)
- **Inputs**: `DATA-MODEL.md` §3 (is_up_tonight function spec, show_times jsonb format); DB: `is_up_tonight()` SQL function (exists in migration `20260731100006_tonight.sql`); existing files: `src/pages/Tonight.tsx`, `src/components/MapMarker.tsx`, `src/components/MapFilterChips.tsx`, `src/components/TonightHero.tsx`
- **Outputs**: Modified queries in Tonight.tsx and MapView.tsx to use server-side `is_up_tonight` computed column instead of client-side date comparison; events fetched with `.select('*, is_up_tonight')` so the DB function runs server-side; MarqueeTicker counts driven by server truth; map TONIGHT filter uses pre-computed boolean
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Tonight page uses `event.is_up_tonight` boolean from server; marquee counts match DB truth; map TONIGHT filter works off server-computed field; no client-side date string comparison for tonight status; existing behavior unchanged — only data source changes
- **Estimated effort**: Small
- **Design reference**: `DATA-MODEL.md` §3

#### Node: search-by-feeling
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: discover-page, schema-emotion-agg
- **Inputs**: `README.md` §3.7 (search placeholder "A play, a theater, a feeling…"), `EMOTIONS.md` §emotion slugs; DB: `event_spectrum` view (event_id, emotion, pct sorted descending); existing file: `src/pages/Discover.tsx`
- **Outputs**: `src/pages/Discover.tsx` — enhanced search that detects emotion slug names in search input (e.g., typing "gutted" or "delighted") and queries `event_spectrum` view for events where that emotion has pct >= 25; results merged with existing text search results; emotion matches shown with the emotion's base oklch color on the result card
- **Loop pattern**: plan-execute-verify
- **Success criteria**: typing "gutted" returns productions where gutted >= 25% of spectrum; typing "delighted" returns delighted-dominant shows; mixed queries ("storefront gutted") apply both text and emotion filters; emotion color indicator on matched results; all 12 emotion slugs recognized; partial matches don't trigger (e.g., "del" doesn't match "delighted"); search still works normally for non-emotion text
- **Estimated effort**: Medium
- **Design reference**: `README.md` §3.7

#### Node: venue-sheet-states
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: venue-sheet (already exists)
- **Inputs**: `README.md` §3.8 (sheet spec: peek state with live counts, detail state with 5 subsections); existing file: `src/components/VenueSheet.tsx`
- **Outputs**: `src/components/VenueSheet.tsx` — rewritten with two states: **Peek** (no venue selected): grab handle + headline Newsreader italic 19px ("14 curtains up within three miles") + stats line Courier Prime ("TAP A THEATER · 4 UNDER $20 · 2 PAY-WHAT-YOU-CAN"); **Detail** (venue selected): venue photo 88×66px + name Newsreader italic 22px + metadata (NEIGHBORHOOD · KIND · $$) + history line ("YOU'VE BEEN 9 TIMES · LAST: JUL 3" or "NEVER BEEN — GOOD FIRST ONE") + tonight panel (live dot + status + production + spectrum 8px + top 2 feelings) + fact chips (gold for actionable, outline for info) + action buttons (primary gold + WANT TO SEE outline + directions 56px ↗) + "ALSO WITHIN A TEN-MINUTE WALK" section (2 nearest venues as UP/DARK rows)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: peek state shows live counts when no venue selected; tapping marker transitions to detail state; detail has all 5 subsections; tonight panel shows ON STAGE/DARK status; spectrum bar 8px with top 2 feelings in their colors; nearby venues section shows 2 venues with UP (green) or DARK (grey) status; directions button 56px opens Apple Maps; history line accurate per user's watchlist data; tap background returns to peek; sheet never covers tab bar (bottom:79px)
- **Estimated effort**: Medium
- **Design reference**: `README.md` §3.8

#### Node: scene-news
- **Type**: feature
- **Agent**: frontend-developer + backend-architect
- **Depends on**: discover-page
- **Inputs**: `README.md` §3.7 (THE SCENE RIGHT NOW section: 3 editorial items, each with kicker/headline/dek, kicker colored by kind); no existing DB table for editorial content
- **Outputs**: `supabase/migrations/YYYYMMDD_scene_news.sql` — new table `scene_news(id uuid, kind text check (kind in ('season_drop','free','closing_soon')), kicker text, headline text, dek text, link_event_id uuid references events, active boolean default true, published_at timestamptz, created_at timestamptz default now())`; RLS: anyone can read where active=true; `src/components/SceneNews.tsx` — renders exactly 3 items: kicker (Courier Prime 9.5px, letter-spacing 0.12em, color by kind: season_drop=gold, free=oklch(0.68 0.13 150), closing_soon=oklch(0.58 0.16 300)), headline (Newsreader italic 18px, line-height 1.2), dek (Newsreader 14px, #9c9586), dividers 1px solid #211d17; label with 6px live dot oklch(0.74 0.16 145); `src/pages/Discover.tsx` — integrate SceneNews below filters
- **Loop pattern**: plan-execute-verify
- **Success criteria**: scene_news table created with RLS; SceneNews renders exactly 3 items (or fewer if < 3 active); kicker colors match spec (gold/green/purple); live dot 6px green; dividers use #211d17 (rule-soft); headline italic 18px; dek #9c9586; component handles 0 items gracefully (hidden, not empty state); migration deploys clean
- **Estimated effort**: Medium
- **Design reference**: `README.md` §3.7

#### Node: pull-to-refresh
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: tonight-page, my-shows-ledger
- **Inputs**: `README.md` §5 (pull to refresh supported on Tonight and My Shows); existing files: `src/pages/Tonight.tsx`, `src/pages/MyShows.tsx`
- **Outputs**: `src/hooks/usePullToRefresh.ts` — hook that listens for touchstart/touchmove/touchend on a scroll container, triggers a callback when pulled down >= 60px from scroll top, shows a brief loading indicator; `src/pages/Tonight.tsx` — wrapped with pull-to-refresh that re-fetches all tonight data; `src/pages/MyShows.tsx` — wrapped with pull-to-refresh that re-fetches watchlist
- **Loop pattern**: one-shot
- **Success criteria**: pulling down on Tonight triggers data refresh and shows indicator; pulling down on My Shows refreshes watchlist; pull threshold is 60px; indicator disappears after data loads; does not interfere with normal scrolling; no pull-to-refresh on other pages
- **Estimated effort**: Small
- **Design reference**: `README.md` §5

#### Node: reduced-motion-complete
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: map-markers, venue-sheet, house-rank-modal
- **Inputs**: `README.md` §5 (reduced motion: marquee paused ✅, live dot static, sheet no animation, state changes never disabled); existing files: `src/components/MapMarker.tsx` (tonight pulse), `src/components/VenueSheet.tsx` (transitions), `src/components/HouseRankModal.tsx` (rank-up animation), `src/components/MapView.tsx` (tonight-pulse keyframe)
- **Outputs**: `src/components/MapMarker.tsx` — tonight dot pulse respects prefers-reduced-motion (static opacity 1 when reduced); `src/components/MapView.tsx` — tonight-pulse keyframe disabled under reduced-motion; `src/components/VenueSheet.tsx` — sheet slide transition disabled (instant) under reduced-motion; `src/components/HouseRankModal.tsx` — rank-up entrance instant under reduced-motion; all via CSS `@media (prefers-reduced-motion: reduce)` or JS matchMedia
- **Loop pattern**: one-shot
- **Success criteria**: with prefers-reduced-motion:reduce enabled: tonight dots are static (no pulse), venue sheet appears instantly (no slide), rank-up modal appears instantly (no entrance animation); with motion enabled: all animations play normally; state changes (selection, toggle) are never disabled regardless of motion preference
- **Estimated effort**: Small
- **Design reference**: `README.md` §5

#### Node: osm-attribution
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: map-basemap
- **Inputs**: `README.md` §3.8 (OpenStreetMap attribution always visible, Courier Prime 8px, #3f3a31); existing file: `src/components/MapView.tsx`
- **Outputs**: `src/components/MapView.tsx` — add "© OpenStreetMap contributors" text overlay, Courier Prime 8px, color #3f3a31, positioned bottom-left or integrated with map key; visible at all times; does not interfere with Mapbox's own attribution
- **Loop pattern**: one-shot
- **Success criteria**: "© OpenStreetMap contributors" visible on map at all times; Courier Prime 8px; color #3f3a31 (ink-whisper); does not obscure map controls or venue sheet; persists across all map states
- **Estimated effort**: Trivial
- **Design reference**: `README.md` §3.8

#### Node: offline-dexie
- **Type**: feature
- **Agent**: frontend-developer + backend-architect
- **Depends on**: log-show-page, write-review-page
- **Inputs**: `README.md` §5.4 (offline: queue log-a-show writes, retry on reconnect, losing reflections is worst failure); Dexie v4 already installed (`dexie@4.4.4` + `dexie-react-hooks`); existing files: `src/pages/LogShow.tsx`, `src/pages/WriteReview.tsx`, `src/hooks/useWatchlist.ts`
- **Outputs**: `src/lib/offlineDb.ts` — Dexie database definition with tables: `pendingWrites(++id, table, payload, createdAt)` for queued inserts; `src/lib/offlineSync.ts` — sync engine that watches `navigator.onLine`, processes queue FIFO on reconnect, retries with exponential backoff (max 3), removes on success; `src/hooks/useOfflineWrite.ts` — hook wrapping Supabase writes: if online → write directly, if offline → queue in Dexie + show toast "Saved offline — will sync when connected"; `src/pages/LogShow.tsx` — use useOfflineWrite for watchlist upsert; `src/pages/WriteReview.tsx` — use useOfflineWrite for review insert; `src/components/OfflineIndicator.tsx` — small Courier Prime 9px banner "OFFLINE — YOUR WORK IS SAVED" in oklch(0.80 0.14 55) when disconnected
- **Loop pattern**: plan-execute-verify
- **Success criteria**: going offline then logging a show → data queued in IndexedDB → toast shown; coming back online → queued write syncs to Supabase → toast "Synced"; queue processes FIFO; failed sync retries 3x with backoff; review text never lost (the product's worst failure mode); offline indicator visible when disconnected; online behavior unchanged (direct writes, no latency added)
- **Estimated effort**: Large
- **Design reference**: `README.md` §5.4

---

## Section 3: Loop Specifications

### Loop: schema-shelves
- **Trigger**: schema-emotions complete
- **Inner cycle**:
  1. Discover: read current watchlist and reviews migration files, understand existing constraints
  2. Plan: write migration SQL with exact constraint changes: rename seeing->booked, add emotions/room_volume/performance_at/seat_note columns, drop rating from both tables
  3. Execute: create migration file, run `supabase db push`
  4. Verify: test that 'booked' is accepted and 'seeing' rejected; test emotions array 1-3 constraint; confirm rating column gone; confirm existing data migrated
- **Evaluator**: all constraints active, no data loss, `supabase db push` succeeds
- **Retry**: on failure -> read error, check constraint syntax, verify column dependencies -> fix -> re-push (max 3 cycles)
- **Stop condition**: migration applied, all constraints verified, TypeScript types match schema

### Loop: schema-house
- **Trigger**: schema-plays, schema-access, schema-shelves complete
- **Inner cycle**:
  1. Discover: read current profiles table migration, read THE-HOUSE.md criteria table fully
  2. Plan: migration SQL: add house_rank with check, migrate belt_level values, drop belt_level, add ushered_count with sync, create check_house_rank() function
  3. Execute: create migration, implement check_house_rank() with all 7 rank criteria, run `supabase db push`
  4. Verify: test check_house_rank() against all 7 ranks with mock data; verify rank never decreases; verify ushering counts double for Front Row
- **Evaluator**: check_house_rank() returns correct rank for each test case; belt_level column gone; ushered_count synced
- **Retry**: on failure -> check criteria logic, test edge cases (rank 6 clamping, ushering alternative) -> fix (max 3 cycles)
- **Stop condition**: all 7 rank criteria verified, migration clean, belt_level gone

### Loop: schema-emotion-agg
- **Trigger**: schema-house complete
- **Inner cycle**:
  1. Discover: read DATA-MODEL.md §6 (weight calculation: 3 picks = 1/3 each, percentages sum to 100)
  2. Plan: trigger on watchlist insert/update of emotions, event_emotion_counts maintenance, event_spectrum view, profile_emotion_counts with season partitioning
  3. Execute: create migration with trigger functions, view, and profile table
  4. Verify: insert watchlist row with ['delighted','gutted','bored'] -> verify 3 rows in event_emotion_counts each weight ~0.333; verify event_spectrum percentages sum to 100; insert second log -> verify counts aggregate; verify profile_emotion_counts partitioned by season
- **Evaluator**: aggregate math correct (share-of-picks), view returns valid percentages, season partitioning works
- **Retry**: on failure -> check trigger logic, weight arithmetic, season boundary calculation -> fix (max 3 cycles)
- **Stop condition**: aggregates correct for single and multi-log scenarios, season partitioning verified

### Loop: emotion-wheel
- **Trigger**: emotion-constants, design-tokens, type-updates complete
- **Inner cycle**:
  1. Discover: read README.md §3.4 (exact left/top positions for all 12 nodes), EMOTIONS.md §derived styles
  2. Plan: EmotionWheel component with positioned nodes, selection state (1-3 max), shake animation, selected row
  3. Execute: build 300x300 container with 12 positioned 66px circular nodes at exact px coordinates; implement selection/deselection with order preservation; 4th-pick shake; selected dots row
  4. Verify: visual check at 390x844 — all 12 nodes positioned correctly; tap 3 nodes -> all selected; tap 4th -> shake on centre label, no state change; deselect by tapping selected; dots below in pick order
- **Evaluator**: node positions match table in §3.4 to the pixel; selection order preserved; 4th-pick rejection works; touch targets >= 66px
- **Retry**: on position error -> recalculate against the left/top table; on selection bug -> check state management -> fix (max 3 cycles)
- **Stop condition**: 12 nodes at correct positions, 1-3 selection with order, 4th-pick shake, dots row correct

### Loop: log-show-page
- **Trigger**: room-volume, schema-shelves, schema-emotion-agg complete
- **Inner cycle**:
  1. Discover: read README.md §3.4 (full page structure), §5 (sheet animation, interaction states)
  2. Plan: page layout (header, context, prompt, wheel, volume, footer CTA), Supabase write (emotions, room_volume, status, seen_date), booking handling
  3. Execute: build LogShow.tsx with all sections, wire to Supabase, handle past-due booking pre-fill
  4. Verify: log a show -> emotions array persists in watchlist -> status = 'seen' -> seen_date stamped -> emotion aggregate triggers fire -> booking cleared if applicable -> step 2 reachable from footer CTA
- **Evaluator**: full write cycle works end-to-end; aggregate triggers verified; past-due booking auto-fills
- **Retry**: on write failure -> check RLS policy, column types, trigger firing -> fix (max 3 cycles)
- **Stop condition**: log-a-show writes all data, triggers fire, booking handling correct

### Loop: write-review-page
- **Trigger**: log-show-page complete
- **Inner cycle**:
  1. Discover: read README.md §3.5 (prompt chips, editor, spoiler toggle, privacy note, dual CTAs)
  2. Plan: step 2 page with emotion pills (editable), prompt selection, rich editor, spoiler toggle, dual footer actions
  3. Execute: build WriteReview.tsx with all interactions; JUST LOG IT writes watchlist only; Post to the house writes review + watchlist; emotions default from step 1
  4. Verify: select prompt -> echoed in editor in gold -> type review -> toggle spoiler -> Post -> verify review in DB with emotions + prompt + body + contains_spoilers; verify JUST LOG IT skips review creation; verify editing emotions updates both watchlist and review
- **Evaluator**: both CTAs function correctly; prompt swap doesn't clear text; spoiler toggle persists; emotions sync between watchlist and review
- **Retry**: on sync issue -> check dual-write logic; on UI bug -> check toggle/prompt state -> fix (max 3 cycles)
- **Stop condition**: full review flow works, both CTAs tested, emotion sync verified

### Loop: production-detail
- **Trigger**: interpretation-copy, schema-plays, schema-access complete
- **Inner cycle**:
  1. Discover: read README.md §3.3 (all 6 sections of show detail page)
  2. Plan: page structure (hero, title block, house felt panel, company, reviews, play link), data fetching (event + play + access + spectrum + reviews)
  3. Execute: build ProductionDetail.tsx with all 6 sections; integrate SpectrumBar at 11px, InterpretationSentence, ReviewBadge, AccessChip, spoiler collapse
  4. Verify: hero 196px with scrim; title 31px italic; credit line with italic director; access chips green for pay-what-you-can; spectrum panel with interpretation; reviews with rank badges and spoiler collapse; play link present when play_id exists
- **Evaluator**: all 6 sections render with correct styling; no star ratings; review badges distinguish rank tiers; spoiler collapse has 44px touch target
- **Retry**: on styling mismatch -> check exact px/oklch values against spec; on data issue -> check joins and FK relationships -> fix (max 3 cycles)
- **Stop condition**: all 6 sections render correctly, no star ratings, play link functional

### Loop: map-markers
- **Trigger**: production-detail, schema-tonight complete
- **Inner cycle**:
  1. Discover: read README.md §3.8 (full marker spec: glyphs, borders, tonight dot, selected state)
  2. Plan: custom marker component with dynamic styling based on room kind, user relationship, and tonight status
  3. Execute: build MapMarker.tsx with 30x30 chip + 6px tail + glyph + dynamic border + tonight dot + selection animation
  4. Verify: markers render with correct glyph per room kind; border encodes relationship (dashed for want, solid gold for booked, feeling colour for seen, neutral for never been); tonight dot pulses 1.8s; selected scales 1.18; filtered markers at opacity .22
- **Evaluator**: each marker variant renders correctly; tonight dot pulse smooth; selection animation 120ms; reduced-motion disables pulse
- **Retry**: on rendering issue -> check Mapbox custom marker API, CSS animations -> fix (max 3 cycles)
- **Stop condition**: all marker variants correct, tonight dot pulses, selection works, filtering dims

### Loop: venue-sheet
- **Trigger**: map-filters, spectrum-bar complete
- **Inner cycle**:
  1. Discover: read README.md §3.8 (sheet spec: positioning, peek/detail states, 5 detail subsections)
  2. Plan: bottom sheet component with peek and detail states; anchored at bottom:79px above tab bar; detail shows 5 subsections
  3. Execute: build VenueSheet.tsx with grab handle, peek state (headline + counts), detail state (photo/info, tonight panel, fact chips, actions, nearby venues)
  4. Verify: sheet sits above tab bar never covers it; z-index 1100; peek shows live counts; detail shows all 5 subsections; tap background returns to peek; tonight panel shows correct status; directions button 56px; nearby venues show UP/DARK
- **Evaluator**: sheet positioning correct in all states; never covers tab bar; all data populates; transitions smooth
- **Retry**: on positioning -> check bottom:79px, z-index; on data -> check venue/event queries -> fix (max 3 cycles)
- **Stop condition**: sheet works in both states, positioned correctly, all data renders

### Loop: tonight-page
- **Trigger**: marquee-ticker, tonight-hero, tonight-friends, tonight-free complete
- **Inner cycle**:
  1. Discover: read README.md §3.1 (full Tonight page structure, masthead spec)
  2. Plan: page composition (masthead, marquee, hero, friends, free), route as /app (replacing Discover)
  3. Execute: build Tonight.tsx composing all sub-components; update router to make /app render Tonight
  4. Verify: masthead "The Art of Art" in Courier Prime 700 19px; marquee scrolls with live counts; hero shows tonight's top production; friends section shows recent activity; free section never empty; pull-to-refresh works
- **Evaluator**: all sections render; masthead uses Courier Prime not Newsreader; live data populates; free section has fallback
- **Retry**: on layout issue -> check padding/spacing; on data -> check tonight/friend queries -> fix (max 3 cycles)
- **Stop condition**: Tonight page fully functional as home route with all sections

### Loop: profile-page
- **Trigger**: seating-chart, house-chips, palette-bar, stat-strip complete
- **Inner cycle**:
  1. Discover: read README.md §3.6 (full You page spec, gold gradient header)
  2. Plan: refactor existing Profile.tsx to House model; compose sub-components in order
  3. Execute: rebuild Profile.tsx with gold gradient header, avatar, rank row, seating chart, next-step sentence, stat strip, palette, house chips
  4. Verify: gold gradient renders; rank row shows YOUR SEAT + rank name in gold + N OF 7; seating chart lights correct seat; next-step sentence is an invitation not a requirement; stat strip shows 4 values; palette renders with insight; house chips show correct states; no belt references
- **Evaluator**: full profile renders matching §3.6; no belt code; next-step copy follows invitation pattern
- **Retry**: on styling -> check gradient, oklch values; on content -> check rank calculation, palette query -> fix (max 3 cycles)
- **Stop condition**: profile matches spec, no belt references, next-step sentence warm and inviting

### Loop: seating-chart
- **Trigger**: house-constants complete
- **Inner cycle**:
  1. Discover: read THE-HOUSE.md §seating chart (container, rows, lit seat, row formula)
  2. Plan: 4×8 grid with row assignment from rankRow(), lit seat at index 3
  3. Execute: build SeatingChart.tsx with all visual layers
  4. Verify: rank 0 → row 3 (back); rank 6 → row 0 (front); lit seat 11px with glow; correct oklch per row tier
- **Evaluator**: all 7 ranks produce visually correct seat placement
- **Retry**: on row mismatch → check rankRow() formula → fix (max 3 cycles)
- **Stop condition**: all ranks render correctly, lit seat glows, STAGE/STANDING ROOM labels present

### Loop: house-chips
- **Trigger**: house-constants complete
- **Inner cycle**: one-shot — build HouseChips.tsx, verify 7 chips with 3 states
- **Stop condition**: achieved=strikethrough, current=gold, future=dashed

### Loop: palette-bar
- **Trigger**: spectrum-bar complete
- **Inner cycle**: one-shot — wrap SpectrumBar at 30px with useEmotionAggregates hook
- **Stop condition**: bar renders with personal insight sentence

### Loop: stat-strip
- **Trigger**: design-tokens complete
- **Inner cycle**: one-shot — build StatStrip.tsx with 4 cells
- **Stop condition**: 4 cells with correct fonts, ushered always green

### Loop: house-check-fn
- **Trigger**: schema-house, log-show-page complete
- **Inner cycle**:
  1. Discover: read THE-HOUSE.md §ladder (all criteria), §non-negotiable rules
  2. Plan: Edge Function that calls check_house_rank() DB function, returns new rank or null, JWT verified
  3. Execute: create house-check Edge Function; wire to be called after log/review
  4. Verify: create test user -> log 1 show -> check returns rank 1 (Balcony); log 2 more at different venue -> returns rank 2 (Mezzanine); verify rank never decreases on re-check; verify ushering satisfies Front Row alternative
- **Evaluator**: all rank transitions correct; idempotent; never lowers; JWT required
- **Retry**: on criteria mismatch -> check DB function logic; on auth issue -> check JWT verification -> fix (max 3 cycles)
- **Stop condition**: all 7 rank transitions verified correct

### Loop: navigation-v2
- **Trigger**: tonight-page, profile-page complete
- **Inner cycle**:
  1. Discover: read README.md §2.3 (5-slot nav spec), read current Navigation.tsx
  2. Plan: refactor from current tabs to 5-slot layout with gold FAB centre
  3. Execute: rebuild Navigation.tsx with exact 5 slots, gold circle, route updates
  4. Verify: 5 slots render; gold circle at centre (44x44, no label, no active state); routes correct (/app, /app/map, log-a-show, /app/watchlist, /app/profile); tab bar 79px total; active/inactive colours correct; no Learn tab
- **Evaluator**: exactly 5 slots; gold circle visually distinct; routes work; height 79px
- **Retry**: on layout -> check flex/padding; on routing -> check router config -> fix (max 3 cycles)
- **Stop condition**: 5-slot nav with gold FAB, all routes functional, no extra tabs

### Loop: delete-belt-code
- **Trigger**: house-hook, profile-page, navigation-v2 complete
- **Inner cycle**:
  1. Discover: `grep -ri "belt" src/` to find all references
  2. Plan: list every file with belt references, plan deletion and removal order
  3. Execute: delete belt component files; remove belt imports, constants, and renders from all files
  4. Verify: `grep -ri "belt" src/` returns zero results; TypeScript compiles clean; app runs without errors
- **Evaluator**: zero belt references in source; clean compile; no runtime errors
- **Retry**: on missed reference -> grep again with broader pattern -> fix (max 3 cycles)
- **Stop condition**: zero belt references, clean compile, app functional

### Loop: delete-star-ratings
- **Trigger**: production-detail, my-shows-ledger, write-review-page complete
- **Inner cycle**:
  1. Discover: `grep -ri "rating\|star\|/5\|CommunityRating\|LogShowModal" src/` to find all references
  2. Plan: list every file with rating/star references, plan deletion order
  3. Execute: delete CommunityRating.tsx and LogShowModal.tsx; remove rating imports, fields, and renders from all files
  4. Verify: `grep -ri "rating" src/` returns zero rating-related results; no star icon or /5 in UI; clean compile
- **Evaluator**: zero star/rating UI references; clean compile; no runtime errors
- **Retry**: on missed reference -> grep with broader pattern -> fix (max 3 cycles)
- **Stop condition**: zero star/rating references, clean compile, app functional

### Loop: personal-palette
- **Trigger**: profile-page, my-shows-ledger, schema-emotion-agg complete
- **Inner cycle**:
  1. Discover: read EMOTIONS.md §5 (personal palette rules: season = Sept 1→Aug 31, insight patterns, warm tone). Read `profile_emotion_counts` table structure in migration `20260731100005_emotion_aggregates.sql`. Read existing SpectrumBar and InterpretationSentence components.
  2. Plan: create `useEmotionAggregates(userId, mode)` hook that queries `profile_emotion_counts`, computes `SpectrumSlice[]` from weights, supports `'season'` (current season filter) and `'all-time'` (no season filter). Add personal insight sentence logic — either extend InterpretationSentence with `mode: 'personal'` or create separate function. Wire into Profile.tsx (replace placeholder) and MyShows.tsx Seen tab.
  3. Execute: build hook; add personal insight patterns ("You are, statistically, a person who likes to be {top1} and then {top2}.", "Mostly {top1}. You've been going to a lot of {dominant venue kind}."); replace Profile placeholder with SpectrumBar at 30px + personal insight; add palette section to MyShows Seen tab with SpectrumBar at 26px + all-time insight.
  4. Verify: log 3+ shows with different emotions → Profile palette bar renders with correct proportions; insight sentence uses top 2 emotions by name in italic; MyShows Seen tab shows all-time palette; Profile shows current season only; no data → placeholder text remains; season boundary crosses correctly (show from August vs September)
- **Evaluator**: palette bar proportions match profile_emotion_counts weights; insight sentence warm and specific; season filtering correct; both Profile and MyShows render their respective modes
- **Retry**: on empty data → check RLS policy on profile_emotion_counts; on wrong proportions → verify weight calculation → fix (max 3 cycles)
- **Stop condition**: Profile shows seasonal palette, MyShows shows all-time palette, insight sentences are warm and personal

### Loop: is-up-tonight-wire
- **Trigger**: tonight-page, map-markers complete (both already have client-side tonight filtering)
- **Inner cycle**:
  1. Discover: read migration `20260731100006_tonight.sql` for `is_up_tonight()` function signature. Read current tonight filtering logic in Tonight.tsx and MapView.tsx. Identify all places that compare dates client-side for "tonight" status.
  2. Plan: modify Supabase queries to request `is_up_tonight` as a computed column (`.select('*, is_up_tonight')`). Replace all client-side date comparisons with the server-computed boolean. Update TypeScript Event type if needed.
  3. Execute: update Tonight.tsx queries to use `event.is_up_tonight`; update MapView.tsx marker tonight detection; update MarqueeTicker counts; remove client-side tonight date logic.
  4. Verify: Tonight page shows same events as before (behavior unchanged); map TONIGHT filter still works; MarqueeTicker count matches; performance improved (DB does the work, not client); add `show_times` data to a test event and verify is_up_tonight responds correctly to day-of-week scheduling.
- **Evaluator**: identical behavior to client-side filtering; no regression in marquee counts or map dots; queries simpler (no client date logic)
- **Retry**: on query error → check PostgREST computed column syntax; on wrong results → verify `show_times` jsonb format → fix (max 3 cycles)
- **Stop condition**: all tonight-related features use server-computed boolean, client-side date logic removed

### Loop: search-by-feeling
- **Trigger**: discover-page, schema-emotion-agg complete
- **Inner cycle**:
  1. Discover: read `event_spectrum` view definition (migration `20260731100005`). Read current Discover.tsx search/filter logic. Read EMOTIONS.md for all 12 slug names.
  2. Plan: in Discover, after text search input changes, check if any token matches an emotion slug exactly (case-insensitive). If match, query `event_spectrum` view for events where that emotion has pct >= 25. Merge with text search results. Show emotion color indicator on matched result cards.
  3. Execute: add emotion slug detection to Discover search handler; add `event_spectrum` query; merge results (deduplicate by event ID); add small color dot (8px, emotion's base oklch) next to matched event titles; handle multiple emotion terms in one query (AND logic — both must be >= 25).
  4. Verify: type "gutted" → see productions where gutted >= 25% of spectrum; type "delighted" → see delighted-dominant shows; type "storefront gutted" → both text filter and emotion filter apply; type "gut" → no emotion match (partial match rejected); type "Gutted" → case-insensitive match works; no results → standard empty state; emotion dot color matches the emotion definition.
- **Evaluator**: exact slug match only (no partial); correct threshold (>= 25%); results merge correctly with text search; emotion indicator visible
- **Retry**: on no results → check event_spectrum view has data; on wrong threshold → check pct column type → fix (max 3 cycles)
- **Stop condition**: emotion search works for all 12 slugs, merges with text search, indicator shows correct color

### Loop: venue-sheet-states
- **Trigger**: venue-sheet (already exists, single-state)
- **Inner cycle**:
  1. Discover: read README.md §3.8 (peek and detail state specs). Read current VenueSheet.tsx. Read current MapView.tsx to understand venue selection flow.
  2. Plan: refactor VenueSheet into two states. **Peek** (default, no venue selected): grab handle + "N curtains up within three miles" headline (Newsreader italic 19px) + "TAP A THEATER · N UNDER $20 · N PAY-WHAT-YOU-CAN" (Courier Prime). **Detail** (venue tapped): 5 subsections — (1) venue block with 88×66 photo, name 22px, metadata NEIGHBORHOOD·KIND·$$, history line; (2) tonight panel with live dot + ON STAGE/DARK + production + 8px spectrum + top 2 feelings; (3) fact chips (gold=actionable, outline=info); (4) action buttons (primary gold + WANT TO SEE + directions 56px); (5) "ALSO WITHIN A TEN-MINUTE WALK" with 2 nearest venues as UP/DARK rows.
  3. Execute: rebuild VenueSheet with state machine (peek/detail). Add venue photo fetching. Compute live counts for peek (tonight count, under-$20 count, PWYC count). Add nearby venues query (PostGIS or haversine on venue lat/lng within ~1.5km). Add history line from user's watchlist. Wire transitions.
  4. Verify: no venue selected → peek state with live counts; tap marker → detail state with all 5 subsections; tonight panel shows ON STAGE (green dot) or DARK (grey dot); history line shows "YOU'VE BEEN N TIMES · LAST: {DATE}" or "NEVER BEEN — GOOD FIRST ONE"; nearby venues show 2 venues with UP/DARK status; directions opens Apple Maps; tap outside → returns to peek; sheet bottom:79px, never covers tab bar.
- **Evaluator**: both states fully rendered; transitions smooth (300ms cubic-bezier); live counts accurate; nearby venues calculated correctly; history line accurate per watchlist data
- **Retry**: on positioning → check z-index and bottom offset; on data → check venue queries and watchlist joins → fix (max 3 cycles)
- **Stop condition**: peek and detail states fully functional, all 5 detail subsections render, live counts accurate

### Loop: scene-news
- **Trigger**: discover-page complete
- **Inner cycle**:
  1. Discover: read README.md §3.7 (THE SCENE RIGHT NOW section, 3 editorial items, kicker/headline/dek, kicker color by kind). Check if any similar tables exist in migrations.
  2. Plan: create `scene_news` table (id, kind, kicker, headline, dek, link_event_id, active, published_at, created_at) with RLS (anyone reads active rows). Build SceneNews component. Wire into Discover below filter chips.
  3. Execute: write migration for scene_news table + RLS policy. Build SceneNews.tsx: label "THE SCENE RIGHT NOW" with 6px green live dot (oklch(0.74 0.16 145)); query `scene_news` where active=true, order by published_at desc, limit 3; render kicker (Courier Prime 9.5px, letter-spacing 0.12em, color by kind: season_drop=oklch(0.80 0.14 55), free=oklch(0.68 0.13 150), closing_soon=oklch(0.58 0.16 300)), headline (Newsreader italic 18px), dek (Newsreader 14px #9c9586); dividers 1px solid #211d17; integrate into Discover.tsx below filters.
  4. Verify: migration deploys clean; SceneNews hidden when 0 items (not empty state — section simply absent); 1-3 items render correctly; kicker colors match per kind; headline italic; dek secondary color; dividers use rule-soft (#211d17 not #2b2720); tapping a news item with link_event_id navigates to ProductionDetail.
- **Evaluator**: table created with correct constraints; component renders 0-3 items; kicker colors match exactly; section hidden when empty
- **Retry**: on migration error → check column types and constraints; on color mismatch → verify oklch values → fix (max 3 cycles)
- **Stop condition**: migration deployed, component renders correctly for 0-3 items, kicker colors match spec

### Loop: offline-dexie
- **Trigger**: log-show-page, write-review-page complete
- **Inner cycle**:
  1. Discover: read Dexie v4 docs for database definition and hooks. Read current LogShow.tsx and WriteReview.tsx Supabase write logic. Read README.md §5.4 (offline rules: queue writes, retry on reconnect, losing reflections = worst failure).
  2. Plan: Dexie database with `pendingWrites` table (++id, table, payload, createdAt). Sync engine watching `navigator.onLine` + `window.addEventListener('online', ...)`. useOfflineWrite hook wrapping Supabase inserts/upserts. OfflineIndicator banner component.
  3. Execute: create `src/lib/offlineDb.ts` (Dexie schema, singleton instance). Create `src/lib/offlineSync.ts` (FIFO queue processor, exponential backoff 1s/2s/4s, max 3 retries, process on 'online' event + on app mount). Create `src/hooks/useOfflineWrite.ts` (if online → direct Supabase write, if offline → queue in Dexie + return optimistic success). Create `src/components/OfflineIndicator.tsx` (Courier Prime 9px, oklch(0.80 0.14 55) on #141109 bg, fixed top, "OFFLINE — YOUR WORK IS SAVED"). Wire into LogShow.tsx and WriteReview.tsx write paths. Mount OfflineIndicator in AppShell.
  4. Verify: disable network → log a show → data queued in IndexedDB (check via DevTools Application tab) → toast/indicator shown; re-enable network → queue syncs → data appears in Supabase; queue processes in FIFO order; review text persisted (never lost); repeated sync attempts don't duplicate data (use upsert logic); online behavior unchanged (no added latency); indicator appears/disappears with connectivity.
- **Evaluator**: offline writes queued correctly; sync succeeds on reconnect; no data loss; no duplicate writes; indicator responsive to connectivity changes; online behavior unaffected
- **Retry**: on sync failure → check Supabase upsert conflict handling; on duplicate writes → add idempotency key; on indicator issues → check navigator.onLine detection → fix (max 3 cycles)
- **Stop condition**: offline log/review writes queued, sync on reconnect works, indicator toggles, no data loss

---

## Section 4: Shared State Schema

| Key | Type | Set by | Consumed by |
|-----|------|--------|-------------|
| project_path | string | (existing) | all nodes |
| port | number | (existing, 5204) | all verify steps |
| supabase_ref | string | (existing) | all migration nodes |
| supabase_url | string | (existing) | all frontend data fetching |
| supabase_anon_key | string | (existing) | all frontend data fetching |
| mapbox_token | string | (existing) | map-markers, map-basemap, venue-sheet |
| migration_sequence | number | schema-emotions (starts at 100000) | all schema nodes (sequential numbering) |
| migration_files | string[] | all schema- nodes | verification, rollback |
| emotion_slugs | string[] | schema-emotions | schema-shelves, emotion-constants, type-updates |
| house_rank_criteria | object | schema-house | house-check-fn, house-hook |
| design_token_file | string | design-tokens | all UI component nodes |
| emotion_constants_file | string | emotion-constants | emotion-wheel, spectrum-bar, tonight-friends, palette-bar |
| house_constants_file | string | house-constants | seating-chart, house-chips, review-badge, house-hook |
| spectrum_component | string | spectrum-bar | production-detail, venue-sheet, tonight-hero, palette-bar, my-shows-ledger |
| interpretation_component | string | interpretation-copy | production-detail, palette-bar |
| log_show_route | string | log-show-page | navigation-v2, write-review-page |
| tonight_route | string | tonight-page | navigation-v2 |
| profile_route | string | profile-page | navigation-v2 |
| watchlist_route | string | my-shows-ledger | navigation-v2 |
| verified_nodes | string[] | all verify steps | progress tracking, phase advancement |
| belt_code_deleted | boolean | delete-belt-code | final verification |
| star_code_deleted | boolean | delete-star-ratings | final verification |
| learn_code_deleted | boolean | delete-learn | final verification |
| emotion_agg_hook_exists | boolean | personal-palette | profile-page, my-shows-ledger |
| tonight_server_computed | boolean | is-up-tonight-wire | tonight-page, map-markers |
| feeling_search_enabled | boolean | search-by-feeling | discover-page |
| sheet_has_states | boolean | venue-sheet-states | map verification |
| scene_news_table_exists | boolean | scene-news | discover-page |
| pull_to_refresh_exists | boolean | pull-to-refresh | tonight, my-shows |
| reduced_motion_complete | boolean | reduced-motion-complete | all animation nodes |
| osm_attribution_visible | boolean | osm-attribution | map verification |
| offline_queue_exists | boolean | offline-dexie | log-show, write-review |

---

## Section 5: Build Phases (Topological Sort)

Nodes within a phase can run in parallel (fan out via Claude Code worktrees or subagents). All nodes in a phase must pass verification before advancing to the next phase.

### Phase 0: Schema Migrations (sequential within, parallel across independent tracks)

**Track A (foundation):**
- [x] schema-emotions

**Fan-out after schema-emotions (parallel):**
- [x] schema-plays
- [x] schema-access
- [x] schema-shelves

**Sequential after fan-in:**
- [x] schema-house (depends on plays + access + shelves)
- [x] schema-emotion-agg (depends on house)

**Fan-out after schema-emotion-agg (parallel):**
- [x] schema-tonight
- [x] schema-privacy

**Quality gate:** `supabase db push` succeeds with all 8 migrations; `is_up_tonight()` returns correct results; `check_house_rank()` passes criteria tests; `event_spectrum` view returns valid percentages; `profiles.belt_level` column is gone; `watchlist.rating` and `reviews.rating` columns are gone.

### Phase 1: Constants & Types (fully parallel, no DB dependency)

All four can run simultaneously in separate worktrees:
- [x] emotion-constants (`src/lib/emotions.ts`)
- [x] house-constants (`src/lib/house.ts`)
- [x] design-tokens (`src/styles/tokens.css`)
- [x] type-updates (`src/lib/types.ts`)

**Quality gate:** TypeScript compiles clean; `EMOTIONS` array has 12 entries; `HOUSE_RANKS` has 7 entries; `BELT_NAMES`/`BELT_COLORS` deleted from types; all CSS custom properties defined; fonts load.

### Phase 2: Log a Show (sequential — this is the data source for everything)

- [x] emotion-wheel
- [x] room-volume
- [x] log-show-page

**Quality gate:** can log a show with 1-3 emotions + optional room volume; watchlist row created with status='seen', emotions array, seen_date; emotion aggregate triggers fire and populate event_emotion_counts; booking cleared if applicable. This gate is critical: **every downstream screen reads data this flow produces.**

### Phase 3: Write a Review (sequential, depends on Phase 2)

- [x] write-review-page

**Quality gate:** can write a review with prompt, emotions, body, spoiler toggle; emotions default from log step; JUST LOG IT skips review; Post to the house creates review; emotions sync between watchlist and review rows.

### Phase 4: Core Display Components (two parallel tracks)

**Track A (shelves):**
- [x] my-shows-ledger
- [x] my-shows-empty-states

**Track B (spectrum):**
- [x] spectrum-bar
- [x] interpretation-copy

**Worktree guidance:** Track A touches `src/pages/MyShows.tsx`. Track B touches `src/components/SpectrumBar.tsx` and `src/components/InterpretationSentence.tsx`. No file conflicts — safe to fan out.

**Quality gate:** My Shows renders with three tabs, month dividers, emotion dots in pick order, empty states verbatim; SpectrumBar renders with gap:1px, sorted descending, 7-segment cap; InterpretationSentence produces correct sentence for all 8 rules.

### Phase 5: Feature Pages (four parallel tracks)

**Track A (show detail):**
- [x] production-detail (depends on spectrum-bar, interpretation-copy, schema-plays, schema-access)

**Track B (tonight):**
- [x] marquee-ticker
- [x] tonight-hero (depends on spectrum-bar)
- [x] tonight-friends
- [x] tonight-free
- [x] tonight-page (depends on all above)

**Track C (map overhaul):**
- [x] map-markers (depends on production-detail for navigation target)
- [x] map-filters (depends on map-markers)
- [x] venue-sheet (depends on map-filters, spectrum-bar)
- [x] map-basemap (depends on map-markers)

**Track D (profile):**
- [x] seating-chart
- [x] house-chips
- [x] palette-bar (depends on spectrum-bar)
- [x] stat-strip
- [x] profile-page (depends on all above)

**Track E (House engine):**
- [x] house-check-fn (depends on schema-house, log-show-page)
- [x] house-rank-modal (depends on seating-chart, house-check-fn)
- [x] house-hook (depends on house-rank-modal)

**Worktree guidance:** Tracks A-E touch different files. Track A: `src/pages/ProductionDetail.tsx`. Track B: `src/pages/Tonight.tsx` + `src/components/Marquee*.tsx` + `src/components/Tonight*.tsx`. Track C: `src/components/Map*.tsx` + `src/components/VenueSheet.tsx`. Track D: `src/pages/Profile.tsx` + `src/components/Seating*.tsx` + `src/components/House*.tsx` + `src/components/Palette*.tsx` + `src/components/Stat*.tsx`. Track E: `supabase/functions/house-check/` + `src/components/HouseRankModal.tsx` + `src/hooks/useHouseCheck.ts`. No file conflicts — safe for 5-way fan-out with worktree isolation.

**Quality gate:** Production detail renders all 6 sections with no stars; Tonight page renders as home with marquee + hero + friends + free; Map markers show glyphs, relationship borders, tonight dots; Venue sheet sits above tab bar with peek/detail; Profile shows seating chart, rank, palette, house chips; House rank-up fires once on rank advancement with correct animation.

### Phase 6: Discover + Shared Components (parallel)

**Track A (discover):**
- [x] discover-page
- [x] play-pages

**Track B (shared components):**
- [x] navigation-v2
- [x] genre-chips (may already exist from tonight-hero; skip if so)
- [x] review-badge (may already exist from production-detail; skip if so)
- [x] access-chips (may already exist from production-detail; skip if so)
- [x] loading-skeleton

**Worktree guidance:** Track A touches `src/pages/Discover.tsx` and `src/pages/PlayDetail.tsx`. Track B touches `src/components/Navigation.tsx` and shared components. Navigation update depends on tonight-page and profile-page being done.

**Quality gate:** Discover search by feeling works (event_spectrum query); play pages show all productions; navigation has exactly 5 slots with gold FAB; loading skeletons use #141109 shimmer; no sixth tab.

### Phase 7: Cleanup (parallel, run LAST)

All three can run simultaneously — they only delete code:
- [x] delete-belt-code
- [x] delete-star-ratings
- [x] delete-learn

**Quality gate:** `grep -ri "belt_level\|BELT_NAMES\|BELT_COLORS\|useBeltCheck\|BeltUpgrade" src/` = 0 results. `grep -ri "rating.*star\|star.*rating\|CommunityRating\|LogShowModal" src/` = 0 results. `grep -ri "Learn\.tsx\|/learn\|LearningContent\|LearningModal\|LearningModule" src/` = 0 results. TypeScript compiles clean. App runs end-to-end: signup -> log show -> see emotions in My Shows -> see spectrum on show detail -> see rank on profile.

### Phase 8: Completion & Polish (9 nodes, 4 parallel tracks)

All prerequisite schema exists in DB (is_up_tonight(), profile_emotion_counts, event_spectrum). These nodes wire existing backend to the frontend and add missing UX polish.

**Track A (Data Integration — parallel, no deps between them):**
- [x] personal-palette
- [x] is-up-tonight-wire (client-side isUpTonight() + scraper show_times extraction)

**Track B (Feature Gaps — after Track A):**
- [x] search-by-feeling
- [x] venue-sheet-states
- [x] scene-news

**Track C (UX Polish — parallel, independent):**
- [x] pull-to-refresh
- [x] reduced-motion-complete
- [x] osm-attribution

**Track D (Infrastructure — independent):**
- [x] offline-dexie

**Worktree guidance:** Tracks A–D touch entirely different files and can run in parallel. Within Track B, all three nodes touch different files (Discover, VenueSheet, new component) so they can also run in parallel after Track A completes.

**Quality gate:** Profile palette renders SpectrumBar from live data; Discover returns results when searching emotion names; VenueSheet has peek/detail toggle; pull-to-refresh triggers data reload on Tonight and My Shows; all animations respect prefers-reduced-motion; OSM attribution visible on map; Dexie queues offline writes and syncs on reconnect. `npm run build` passes. `npx vitest run` passes.

---

## Section 6: Execution Guide

### Per-phase invocation

Each phase should be invoked explicitly:

```
"Execute Phase 0 of graph-engineering-v2.md — run all 8 schema migrations in sequence."
"Execute Phase 1 of graph-engineering-v2.md — create emotion-constants, house-constants, design-tokens, and type-updates in parallel."
"Execute Phase 2 of graph-engineering-v2.md — build log-a-show (emotion-wheel -> room-volume -> log-show-page)."
```

### Fan-out rules

1. **Schema migrations are always sequential** — migration numbering matters, and each depends on the prior table existing.
2. **Constants (Phase 1) are fully parallel** — they touch different files (`emotions.ts`, `house.ts`, `tokens.css`, `types.ts`).
3. **Phase 5 supports 5-way fan-out** — each track touches entirely different files. Use worktree isolation.
4. **Cleanup (Phase 7) is fully parallel** — each cleanup node greps and deletes independently.
5. **Completion (Phase 8) supports 4-way fan-out** — Tracks A-D touch entirely different files. Track B nodes (search-by-feeling, venue-sheet-states, scene-news) are also parallel within the track since they touch different files.

### Worktree isolation

For parallel tracks within a phase, each track should run in its own git worktree to avoid merge conflicts:

```bash
# Phase 5 fan-out example
git worktree add ../aoa-show-detail feature/show-detail
git worktree add ../aoa-tonight feature/tonight
git worktree add ../aoa-map feature/map-overhaul
git worktree add ../aoa-profile feature/profile
git worktree add ../aoa-house-engine feature/house-engine
```

Merge back to main after each track's quality gate passes. Merge order does not matter because tracks touch different files.

### Quality gates

Every phase has a quality gate defined in Section 5. **Do not advance to the next phase until the gate passes.** Gates are verified by:

1. **TypeScript compilation**: `npm run build` succeeds with zero errors
2. **Visual inspection at 390x844**: Chrome DevTools responsive mode, iPhone 14 preset
3. **Data verification**: Supabase SQL checks for correct schema state
4. **Grep verification** (cleanup only): zero references to deleted concepts

### Rollback strategy

If a phase fails its quality gate:

1. **Schema nodes**: roll back with `supabase db reset` to the last known-good state, fix the migration, re-push
2. **Frontend nodes**: git revert the commits from the failed track, fix in isolation, re-apply
3. **Cleanup nodes**: if a cleanup causes runtime errors, the missing component was still in use somewhere — add it back, find the reference, replace it with the new equivalent, then re-delete

### Progress tracking

Update this section as nodes complete:

```
Phase 0: [x] schema-emotions [x] schema-plays [x] schema-access [x] schema-shelves
         [x] schema-house [x] schema-emotion-agg [x] schema-tonight [x] schema-privacy
Phase 1: [x] emotion-constants [x] house-constants [x] design-tokens [x] type-updates
Phase 2: [x] emotion-wheel [x] room-volume [x] log-show-page
Phase 3: [x] write-review-page
Phase 4: [x] my-shows-ledger [x] my-shows-empty-states [x] spectrum-bar [x] interpretation-copy
Phase 5: [x] production-detail [x] marquee-ticker [x] tonight-hero [x] tonight-friends
         [x] tonight-free [x] tonight-page [x] map-markers [x] map-filters
         [x] venue-sheet [x] map-basemap [x] seating-chart [x] house-chips
         [x] palette-bar [x] stat-strip [x] profile-page [x] house-check-fn
         [x] house-rank-modal [x] house-hook
Phase 6: [x] discover-page [x] play-pages [x] navigation-v2 [x] genre-chips
         [x] review-badge [x] access-chips [x] loading-skeleton
Phase 7: [x] delete-belt-code [x] delete-star-ratings [x] delete-learn
Phase 8: [x] personal-palette [x] is-up-tonight-wire [x] search-by-feeling
         [x] venue-sheet-states [x] scene-news [x] pull-to-refresh
         [x] reduced-motion-complete [x] osm-attribution [x] offline-dexie
```

### Critical path

The longest sequential chain determines minimum build time:

```
schema-emotions -> schema-shelves -> schema-house -> schema-emotion-agg -> schema-tonight
    -> emotion-wheel -> room-volume -> log-show-page -> write-review-page
    -> spectrum-bar -> interpretation-copy -> production-detail
    -> map-markers -> map-filters -> venue-sheet
    -> delete-star-ratings
```

**20 nodes on the critical path.** Parallel tracks (tonight, profile, house engine, discover) run alongside but do not extend the critical path as long as they complete before Phase 7.

### Design doc reference map

Quick lookup for which design doc section governs each node:

| Node | Primary reference |
|------|-------------------|
| schema-* | `DATA-MODEL.md` §1-8 |
| emotion-constants | `EMOTIONS.md` full file |
| house-constants | `THE-HOUSE.md` full file |
| design-tokens | `README.md` §2.2 |
| type-updates | `DATA-MODEL.md` §10 |
| emotion-wheel | `README.md` §3.4 + `EMOTIONS.md` §derived styles |
| room-volume | `README.md` §3.4 + `EMOTIONS.md` §room volume |
| log-show-page | `README.md` §3.4 + §5 |
| write-review-page | `README.md` §3.5 |
| my-shows-* | `README.md` §3.2 Take B |
| spectrum-bar | `EMOTIONS.md` §spectrum bar + `README.md` §4.2 |
| interpretation-copy | `EMOTIONS.md` §interpretation copy |
| production-detail | `README.md` §3.3 + `THE-HOUSE.md` §review badge |
| marquee-ticker | `README.md` §3.1 #2 |
| tonight-hero | `README.md` §3.1 #3 + §3.1.1 |
| tonight-friends | `README.md` §3.1 #4 + §4.3 |
| tonight-free | `README.md` §3.1 #5 |
| tonight-page | `README.md` §3.1 |
| map-markers | `README.md` §3.8 markers |
| map-filters | `README.md` §3.8 filters + key |
| venue-sheet | `README.md` §3.8 sheet |
| map-basemap | `README.md` §3.8 basemap |
| seating-chart | `THE-HOUSE.md` §seating chart |
| house-chips | `THE-HOUSE.md` §ladder chips |
| palette-bar | `README.md` §3.6 #3 + `EMOTIONS.md` §personal palette |
| stat-strip | `README.md` §3.6 #2 |
| profile-page | `README.md` §3.6 |
| house-check-fn | `THE-HOUSE.md` §ladder + §non-negotiable rules |
| house-rank-modal | `THE-HOUSE.md` §rank-up moment |
| house-hook | `THE-HOUSE.md` §rank-up moment |
| navigation-v2 | `README.md` §2.3 |
| genre-chips | `README.md` §3.1.1 |
| review-badge | `THE-HOUSE.md` §review badge |
| access-chips | `README.md` §3.3 |
| loading-skeleton | `README.md` §5 |
| discover-page | `README.md` §3.7 |
| play-pages | `README.md` §3.3 #6 + §3.7 + `DATA-MODEL.md` §4 |
| delete-belt-code | `README.md` §0 risk #2 + `THE-HOUSE.md` §migration |
| delete-star-ratings | `README.md` §0 risk #1 + §9 |
| delete-learn | `README.md` §0 risk #3 |
| personal-palette | `EMOTIONS.md` §5 + `README.md` §3.6 #3 + §3.2 Take B |
| is-up-tonight-wire | `DATA-MODEL.md` §3 |
| search-by-feeling | `README.md` §3.7 + `EMOTIONS.md` §slugs |
| venue-sheet-states | `README.md` §3.8 (sheet peek/detail) |
| scene-news | `README.md` §3.7 (THE SCENE RIGHT NOW) |
| pull-to-refresh | `README.md` §5 |
| reduced-motion-complete | `README.md` §5 |
| osm-attribution | `README.md` §3.8 |
| offline-dexie | `README.md` §5.4 + `DATA-MODEL.md` §9 |
