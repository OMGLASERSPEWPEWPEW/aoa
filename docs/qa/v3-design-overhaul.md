# QA: v3 Design Overhaul

**Date:** 2026-08-12
**Scope:** Full visual and functional implementation per `docs/design/v3/design_handoff_house_record/`
**Graph:** `docs/graphs/v3-design-overhaul.md` (23 nodes, 9 phases)
**Entry:** `/app` (Tonight page)

## Type & Colour
- [ ] Every production, play, venue, and artist name renders in Newsreader **italic**
- [ ] Every uppercase label is Courier Prime with `letter-spacing` >= 0.06em
- [ ] All surfaces, ink, and accents come from `tokens.css` — no hardcoded hex that duplicates a token
- [ ] Emotion labels pass 4.5:1 contrast on `#f6f1e3` (paper) AND `#0c0a05` (ink)
- [ ] No card shadows except the map sheet shadow
- [ ] No body copy below 13.5px; no text below 9px

## The Emotion System
- [ ] Twelve feelings, exact slugs and oklch from `emotions.ts`
- [ ] Max three picks, order preserved everywhere it renders
- [ ] Spectrum bars use `gap:1px` and sort descending, cap at 7 segments
- [ ] Every spectrum has one `InterpretationSentence` beneath it
- [ ] `Bored` is present, selectable, never styled as failure
- [ ] No star, number, average, or /5 appears anywhere in the UI
- [ ] `ink()` helper used for label text on light theme; `base()` on dark

## The House
- [ ] Seven ranks with exact names: Standing Room, Balcony, Mezzanine, Orchestra, Front Row, Green Room, Company
- [ ] Rank badge appears only on profile header and review headers
- [ ] No leaderboard, comparison, streak, or decay anywhere
- [ ] Your Run never displays rank name, level number, "N of 7", or progress bar
- [ ] Seating chart: `ROW_BY_RANK = [3,3,2,1,1,0,0]` exactly
- [ ] Rank-up fires once, ever; 400ms animation; verbatim copy per rank; no confetti/sound/share

## Shelves
- [ ] Exactly three: Want to See, Tickets Booked, Seen
- [ ] Logging a show moves to Seen, stamps seen_date, clears any booking
- [ ] Empty states use verbatim copy from README §5

## Works & People
- [ ] Play with zero productions is fully trackable and useful (not an error state)
- [ ] `Want to see it` persists with no production, survives reload, appears in My Shows
- [ ] Seeing a production does NOT clear play interest
- [ ] Waiting counts and 8-bucket trend render on every play page in both themes
- [ ] Every artist has a page with their own emotion spectrum
- [ ] `WHAT ROOMS FEEL WHEN SHE'S IN THEM` renders on artist pages
- [ ] Credits provenance footer present with working correction link
- [ ] Unstaged play page always offers a library copy and one adjacent thing

## Social
- [ ] The Lobby is three real sections, not an infinite feed
- [ ] `share_reflections` respected — hidden when opted out
- [ ] Threads gated to people who logged the production (RLS enforced)
- [ ] `SAY SOMETHING NICE — THEY'RE RIGHT THERE` present on The Plan
- [ ] Open seat expires with performance and never auto-charges

## Callboard & Journey
- [ ] The Callboard replaces Mentor page and Learn page as destinations
- [ ] One call per week, never a list
- [ ] Call reason cites user's own record
- [ ] `READ IT →` and `SKIP IT — JUST GO` carry equal visual weight
- [ ] Standing calls surface usher/PWYC/free in access green
- [ ] Ruth row: name, history, suggested opener in quotes
- [ ] Call taken: 3 beats of practical anxiety, ending `THAT'S EVERYTHING.`

## Map
- [ ] Markers show room-kind glyph (`▣ ▨ ◈`), relationship border, tonight dot
- [ ] Filters dim to `opacity:.22` rather than remove
- [ ] Sheet above map controls, never covers tab bar
- [ ] `© OpenStreetMap contributors` visible in every state

## Access (Product Promise)
- [ ] Price on every production card, marker sheet, and hero
- [ ] Pay-what-you-can / free / usher information in green `--access`, never below the fold
- [ ] Tonight's free section never renders empty (falls back to cheapest three)
- [ ] Every touch target >= 44px

## Navigation
- [ ] Exactly 5 bottom tabs: TONIGHT, CALLBOARD, ✦ (log), LOBBY, YOU
- [ ] No sixth tab
- [ ] Slot 3 is 44x44 gold circle, no label, no active state
- [ ] Map is a toggle in Tonight masthead, not a bottom tab
- [ ] Discover is reached from search, not a tab

## Hard "Do Not" List
- [ ] No star ratings anywhere
- [ ] No belts (no BELT_NAMES, BELT_COLORS in codebase)
- [ ] No Learn tab
- [ ] No Mentor page (Ruth is one row on Callboard)
- [ ] No emoji
- [ ] No gradient backgrounds beyond the two specified gold gradients
- [ ] No rounded-card-with-left-accent-border pattern

## Regression Risks

| Risk | Severity | Phase | Mitigation |
|------|----------|-------|------------|
| Belt references survive in mentor prompts (Docs.tsx:100,112,115) | High | P1 | Grep + delete all "belt" in src/ |
| SpectrumBar labels invisible on light theme | High | P0 | ink() helper + contrast verification |
| Nav restructure breaks existing routes | Medium | P3 | Redirect old routes, verify all links |
| Migration breaks production data | High | P1 | Backup before running; reversible DDL |
| Offline queue schema stale after watchlist changes | Medium | P2 | Dexie version bump in N08 |
| Artist backfill creates duplicate artists from name normalization | Medium | P5 | Dedup on normalized name before insert |
| play_interest notifications not firing | Medium | P8 | Verify trigger with test insert |

## Per-Phase Verification

### Phase 0: Foundation
- [ ] `ink()`, `fillLight()`, `edgeLight()` exported from emotions.ts
- [ ] `<EmotionDots>` component exists and is used everywhere dots appear

### Phase 1: Schema
- [ ] `profiles.belt_level` does not exist
- [ ] `profiles.house_rank` exists with CHECK 0-6
- [ ] `play_interest` table and views exist
- [ ] `artists` and `credits` tables exist
- [ ] `notifications` table exists

### Phase 2: Types + Logic
- [ ] `npm run build` exits 0
- [ ] No `BELT_NAMES` or `BELT_COLORS` found in src/
- [ ] `check_house_rank()` function idempotent, never lowers

### Phase 3: Navigation
- [ ] 5 tabs render in both themes
- [ ] Old routes redirect or 404 gracefully

### Phase 4: Verifications
- [ ] Tonight, MyShows, ProductionDetail, Discover all render correctly

### Phase 5: Works & People
- [ ] Staged and unstaged play pages both rich and useful
- [ ] Artist page with emotion spectrum renders

### Phase 6: Social
- [ ] Lobby renders 3 sections with live data
- [ ] Thread RLS rejects non-viewers

### Phase 7: Journey
- [ ] Callboard weekly call renders with user-specific reason
- [ ] Your Run seating chart matches spec

### Phase 8: Access + Final
- [ ] Price on every surface
- [ ] Full acceptance matrix passes in both themes at 390x844
