# QA: Design Overhaul — House Record

**Date:** 2026-07-31
**Scope:** Full visual and functional redesign per `docs/design/handoff/`
**Entry:** `/app` (Tonight page)
**Graph:** `docs/design/graph-engineering-v2.md`

---

## Phase 0: Schema Migrations

### Emotion System Schema
- [ ] `emotion_slugs` table has exactly 12 rows matching EMOTIONS.md
- [ ] Trigger rejects invalid emotion slugs on `watchlist.emotions`
- [ ] Trigger rejects invalid emotion slugs on `reviews.emotions`
- [ ] `watchlist.emotions` accepts 0-3 slugs, rejects 4+
- [ ] `reviews.emotions` requires 1-3 slugs

### Shelf Rename
- [ ] `watchlist.status` accepts `want_to_see`, `booked`, `seen`
- [ ] `watchlist.status` rejects `seeing`
- [ ] Existing `seeing` rows migrated to `booked`

### Rating Removal
- [ ] `watchlist.rating` column does not exist
- [ ] `reviews.rating` column does not exist

### House Rank
- [ ] `profiles.house_rank` exists with constraint 0-6
- [ ] `profiles.belt_level` does not exist
- [ ] `profiles.ushered_count` synced from `user_progress`
- [ ] `check_house_rank()` returns correct rank for all 7 levels
- [ ] `check_house_rank()` never decreases a rank

### New Tables
- [ ] `plays` table exists with slug unique constraint
- [ ] `events.play_id` FK to `plays(id)` works; null allowed
- [ ] `event_access` table exists with unique index on `event_id`
- [ ] `event_emotion_counts` populates via trigger on watchlist write
- [ ] `event_spectrum` view returns percentages summing to 100
- [ ] `profile_emotion_counts` partitioned by season (Sep 1 - Aug 31)

### Tonight + Privacy
- [ ] `is_up_tonight()` returns true for today's performances
- [ ] `is_up_tonight()` respects exceptions (dark days)
- [ ] `profiles.share_reflections` defaults true; hides reflection when false

---

## Phase 1: Constants & Design Tokens

### Emotion Constants
- [ ] `src/lib/emotions.ts` exports `EMOTIONS` array with exactly 12 entries
- [ ] Each entry has: slug, label, l, c, h (oklch components)
- [ ] `base()`, `fill()`, `edge()`, `bright()` functions produce correct oklch strings
- [ ] Array order matches wheel clockwise order (delighted at index 0, bored at index 11)

### House Constants
- [ ] `src/lib/house.ts` exports `HOUSE_RANKS` with 7 entries
- [ ] Rank criteria table accessible programmatically
- [ ] Rank-up copy strings for all 6 advancement moments

### Design Tokens
- [ ] CSS custom properties defined for all surface colors (`--bg`, `--bg-card`, `--rule`, etc.)
- [ ] CSS custom properties for all ink colors (`--ink`, `--ink-dim`, `--ink-faint`, etc.)
- [ ] CSS custom properties for accent/gold colors (`--accent`, `--accent-text`, etc.)
- [ ] Google Fonts loaded: Newsreader, Courier Prime, JetBrains Mono

### Type Updates
- [ ] `BELT_NAMES` export deleted from `src/lib/types.ts`
- [ ] `BELT_COLORS` export deleted from `src/lib/types.ts`
- [ ] `LearningContent` interface deleted
- [ ] `Profile.belt_level` replaced with `house_rank`
- [ ] `WatchlistItem.rating` replaced with `emotions: Emotion[]`
- [ ] `Review.rating` replaced with `emotions: Emotion[]`
- [ ] `WatchlistStatus` = `'want_to_see' | 'booked' | 'seen'`
- [ ] New types: `Emotion`, `RoomVolume`, `Play`, `EventAccess`, `SpectrumSlice`
- [ ] TypeScript compiles clean

---

## Phase 2-3: Log a Show + Write a Review

### Emotion Wheel <!-- qa:human visual-positioning -->
- [ ] 12 nodes render on 300x300 box at exact positions from README.md §3.4
- [ ] Each node is 66px circle with oklch base color
- [ ] Unselected: 1px solid `#2b2720`, no fill
- [ ] Selected: 1.5px solid base, fill `oklch(0.21 {C*0.3} {H})`
- [ ] Centre label: `PICK UP TO THREE` Courier Prime 10px `#4f4a3e`
- [ ] Max 3 picks enforced; 4th tap triggers 120ms shake on centre label
- [ ] Selection order preserved in dots row below wheel
- [ ] Touch target >= 66px per node
- [ ] Reduced motion: no animation on selection, just instant state change

### Room Volume
- [ ] Three buttons: `A MURMUR`, `REAL APPLAUSE`, `EVERYONE STOOD`
- [ ] Each 46px height, Courier Prime 10.5px
- [ ] Optional — can proceed without selecting
- [ ] Selected state: gold text on `oklch(0.20 0.04 55)` with 1.5px gold border

### Log Show Flow
- [ ] Header: `CANCEL` left, `STEP 1 OF 2` right
- [ ] Context: venue + time in gold Courier Prime, title in Newsreader italic 27px
- [ ] Logging sets `watchlist.status = 'seen'`, stamps `seen_date`
- [ ] Passed-date booking pre-fills and skips search
- [ ] Emotion aggregate triggers fire after log
- [ ] Footer CTA: `Next — say a little more →` full width 50px gold

### Write a Review
- [ ] Emotion pills editable with `edit` link back to step 1
- [ ] Three prompt chips: `What surprised you?`, `One image you'll keep`, `Who should go?`
- [ ] Selected prompt echoed in editor in gold Courier Prime
- [ ] Swapping prompts does not clear typed text
- [ ] Spoiler toggle: 38x22 track with 18px knob
- [ ] Privacy note with venue name substituted
- [ ] `JUST LOG IT` creates no review; `Post to the house` creates review
- [ ] Emotions sync between watchlist row and review row

---

## Phase 4: Core Display

### Spectrum Bar
- [ ] `display:flex; gap:1px; border-radius:{h/2}px; overflow:hidden`
- [ ] Segments sorted descending by percentage
- [ ] Capped at 7 segments; tail folded into last
- [ ] Heights: 8px (map), 9px (tonight), 11px (detail), 26px (my shows), 30px (profile)
- [ ] Below 5 cards: show dots instead, label `EARLY DAYS · {N} CARDS`
- [ ] Top 2-3 feelings named below with percentages in own colors

### Interpretation Sentence
- [ ] Top feeling >= 40%: `The room agreed.`
- [ ] Top two opposed within 6 pts: `A divisive one...`
- [ ] `Bored` in top three: `Some people checked out...`
- [ ] `Held`/`seen`: `People felt taken care of in there.`
- [ ] `Cracked_open`/`aching`: `Bring someone you can talk to afterwards.`
- [ ] `Buzzing`/`delighted`: `A good night out, no homework required.`
- [ ] < 5 cards: `Too early to say. Be the one who says it.`
- [ ] Otherwise: `Mixed room. Worth finding out for yourself.`

### My Shows (Ledger)
- [ ] Three tabs: `WANT TO SEE`, `BOOKED`, `SEEN` with counts
- [ ] Active tab: gold underline, count in gold
- [ ] Month dividers: `{MONTH YEAR}` with rule and `{N} SHOWS`
- [ ] Row: day (JetBrains Mono 11px), title (Newsreader italic 17.5px), emotion dots right
- [ ] Emotion dots 9px in pick order, gap 3px
- [ ] `USHERED` badge in green when applicable
- [ ] Empty states use verbatim copy from design spec

---

## Phase 5: Feature Pages

### Production Detail (Show Detail)
- [ ] Hero 196px with scrim gradient
- [ ] Title: Newsreader italic 31px
- [ ] Credit line with playwright roman, director italic
- [ ] Run line: Courier Prime 10px with venue, dates, price
- [ ] Access chips: green `oklch(0.68 0.13 150)` for pay-what-you-can
- [ ] Actions: `I'm going` gold + `WANT TO SEE` outline
- [ ] House felt panel: spectrum bar 11px + interpretation + card count
- [ ] Reviews with House rank badge (gold for Orchestra+, neutral below)
- [ ] Spoiler collapse: 44px touch target, furious-color background
- [ ] Play link when `play_id` exists: `THE PLAY: {title} · {N} productions tracked →`
- [ ] No star ratings anywhere

### Tonight (Home Page)
- [ ] Masthead: `The Art of Art` Courier Prime 700 19px, `· chicago` 10px
- [ ] Marquee: 26s linear infinite, duplicated DOM, `prefers-reduced-motion` pauses
- [ ] Marquee content: `{N} CURTAINS UP TONIGHT · {N} UNDER $20 · {N} OPENINGS`
- [ ] Hero: 196px image with scrim, genre chips, title 29px italic, venue line
- [ ] Hero spectrum bar 9px with top feelings
- [ ] `Want to see` button + price button (e.g. `$25 HOTTIX`)
- [ ] Your people went out: avatar + sentence with italic names/titles + emotion pills + quote
- [ ] Free tonight section: green label, never empty (fallback to cheapest)

### Map <!-- qa:human mobile-gestures -->
- [ ] Markers: 30x30 chip + 6px tail, glyph per room kind (`▣`/`▨`/`◈`)
- [ ] Marker border: gold solid (booked), gold dashed (want), feeling color (seen), neutral (never)
- [ ] Tonight dot: 9px pulsing 1.8s at top-right of marker
- [ ] Selected marker: `scale(1.18)` with glow shadow, 120ms
- [ ] Filtered markers dim to `opacity:.22`, never removed
- [ ] Filter chips float with backdrop blur
- [ ] Filters are additive (AND)
- [ ] Legend card visible at all times
- [ ] Sheet anchored at `bottom:79px`, z-index 1100
- [ ] Sheet never covers tab bar
- [ ] Peek state: live count headline + label
- [ ] Detail state: 5 subsections (venue, tonight, facts, actions, nearby)
- [ ] `© OpenStreetMap contributors` always visible
- [ ] Basemap tint matches `#0c0a05` theme

### Profile (You)
- [ ] Gold gradient header with avatar 54px, name italic 23px
- [ ] Rank row: `YOUR SEAT` label + rank name italic 20px gold + `{N} OF 7`
- [ ] Seating chart: 4 rows of 8 squares, lit seat at correct row per rank formula
- [ ] Lit seat: 11px, `oklch(0.86 0.15 55)`, glow `box-shadow: 0 0 10px`
- [ ] Row formula: `row = 3 - floor(rank * 3 / 6)`
- [ ] Next-step invitation copy (never phrased as requirement)
- [ ] Stat strip: 4 cells (SHOWS, VENUES, WROTE, USHERED), ushered always green
- [ ] Palette bar 30px with insight sentence
- [ ] House chips: achieved (line-through), current (gold), future (dashed)

### House Rank-Up <!-- qa:human visual-animation -->
- [ ] Fires once, immediately after qualifying log/review
- [ ] Full-bleed dark background with gold gradient
- [ ] Seating chart enlarged ~1.6x
- [ ] Seat animates forward one row: 400ms `cubic-bezier(.2,.8,.2,1)`
- [ ] Rank name: Newsreader italic 34px gold
- [ ] Copy line per rank (verbatim from THE-HOUSE.md)
- [ ] Dismiss by tapping anywhere
- [ ] Never shown twice
- [ ] No confetti, no sound, no share prompt
- [ ] `prefers-reduced-motion`: seat drawn in new position, no animation

---

## Phase 6: Navigation + Discover

### Navigation
- [ ] Exactly 5 slots, total height 79px
- [ ] Slot 1: `◉` `TONIGHT` → `/app`
- [ ] Slot 2: `⌖` `MAP` → `/app/map`
- [ ] Slot 3: `✦` gold circle 44x44, no label, opens Log a Show
- [ ] Slot 4: `▤` `MY SHOWS` → `/app/watchlist`
- [ ] Slot 5: `◇` `YOU` → `/app/profile`
- [ ] Glyph 15px, label Courier Prime 9px
- [ ] Inactive `#625b4c`, active `oklch(0.80 0.14 55)`
- [ ] No Learn tab
- [ ] No Mentor tab
- [ ] No Social tab
- [ ] No sixth tab

### Discover
- [ ] Search field: 46px, placeholder `A play, a theater, a feeling…` italic
- [ ] Searching by feeling returns productions from `event_spectrum`
- [ ] Filter chips: `TONIGHT`, `UNDER $20`, `STOREFRONT`, `ASL`
- [ ] "The play, not the poster" card with production list
- [ ] "The scene right now" with live dot, 3 editorial items

---

## Phase 7: Cleanup Verification

### Belt Code Deleted
- [ ] `grep -ri "belt_level\|BELT_NAMES\|BELT_COLORS\|useBeltCheck\|BeltUpgrade" src/` = 0 results
- [ ] `BeltUpgradeModal.tsx` file does not exist
- [ ] `useBeltCheck.ts` file does not exist

### Star Ratings Deleted
- [ ] `grep -ri "CommunityRating\|community_rating\|LogShowModal" src/` = 0 results
- [ ] `CommunityRating.tsx` file does not exist
- [ ] `LogShowModal.tsx` file does not exist
- [ ] No `/5` or star visualization anywhere in UI

### Learn Tab Deleted
- [ ] `grep -ri "Learn\.tsx\|/app/learn\|LearningContent\|LearningModal" src/` = 0 results
- [ ] `Learn.tsx` file does not exist
- [ ] No route to `/app/learn`

---

## Global Type & Colour

- [ ] Every production, play, and venue title renders in Newsreader **italic**
- [ ] Every uppercase label is Courier Prime with `letter-spacing` >= 0.06em
- [ ] Page background exactly `#0c0a05`; cards `#141109`; rules `#2b2720`
- [ ] Gold is `oklch(0.80 0.14 55)` everywhere — no `amber-400`
- [ ] No card shadows except map sheet and marker glow
- [ ] No text below 9px; no body copy below 13.5px
- [ ] No emoji anywhere

## Access (Product Promise)

- [ ] Price on every production card and marker sheet
- [ ] Pay-what-you-can / free / usher info in green `oklch(0.68 0.13 150)`, never below fold
- [ ] Tonight's "free" section never renders empty
- [ ] Every touch target >= 44px

---

## Regression Risks

- **High:** Belt-to-house migration breaks profile if any `belt_level` reference survives
- **High:** Rating-to-emotions migration breaks reviews and watchlist display
- **High:** Emotion aggregate triggers must fire correctly or spectrum bars are empty
- **Medium:** Nav restructuring (7→5) breaks routing if old routes not redirected
- **Medium:** Deleting Learn page leaves orphaned imports
- **Medium:** `seeing` → `booked` rename breaks any hardcoded status checks
- **Low:** Font loading flashes unstyled text on slow connections
- **Low:** oklch() not supported in older Android WebView (use hex fallbacks)
