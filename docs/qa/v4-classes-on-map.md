# QA: F70–F74 — Classes and Schools on the Map

**Date:** 2026-08-12
**Scope:** Class markers, mode control, rethought filters, class sheet, teacher links
**Entry point:** `/app` → Map toggle in Tonight masthead
**Graph doc:** `docs/graphs/v4-classes-on-map.md`
**Design spec:** `docs/design/v4/design_handoff_house_record/CLASSES-AND-SCHOOLS.md`

---

## Schema & Data

- [ ] `schools` table exists with: id, name, short_name (≤14 chars), slug, ll (geography), neighborhood, discipline, price_band, venue_id FK, financial_aid, payment_plan, sliding_scale, url
- [ ] `class_sessions` table exists with: school_id FK, title, level (1–5), starts_on (nullable), schedule, weeks, price, seats_total, seats_taken, drop_in, no_experience, audition_required, scraped_at, source_url
- [ ] `class_teachers` join table exists with: session_id FK, artist_id FK, credential
- [ ] `class_interest` table exists with: user_id FK, session_id FK, status (watching|held|enrolled|took_it)
- [ ] `discipline` check constraint enforces exactly: improv, acting, writing, musical, devised, youth
- [ ] Index on class_sessions(school_id, starts_on) exists
- [ ] RLS: anon can SELECT schools and class_sessions; user can only write own class_interest rows
- [ ] 8 schools seeded with correct disciplines and short_names
- [ ] At least 16 class_sessions seeded (mix of enrolling and between-sessions)
- [ ] A session with a passed starts_on NEVER displays as enrolling

## Mode Control & Filters

- [ ] Mode control is a segmented pill: `SHOWS {count} | CLASSES {count}`
- [ ] Active SHOWS segment fills gold `oklch(.80 .14 55)`
- [ ] Active CLASSES segment fills chartreuse `oklch(.80 .16 110)`
- [ ] Counts update live as filters are applied
- [ ] Each segment ≥ 44px touch target
- [ ] Shows mode shows exactly 3 chips: TONIGHT, UNDER $20, NEVER BEEN
- [ ] Classes mode shows exactly 3 chips: ENROLLING, DROP-IN, NO EXPERIENCE
- [ ] `USHER SLOTS` chip is permanently gone — not rendered, not in code
- [ ] `STOREFRONT` chip is permanently gone — not rendered, not in code
- [ ] All 3 chips visible simultaneously on 390px viewport — NO horizontal scroll
- [ ] Active chips in shows mode use gold accent
- [ ] Active chips in classes mode use chartreuse accent
- [ ] Filter state persists independently per mode (switch away and back, state preserved)
- [ ] No filter combination produces an empty map by construction

## Class Markers

- [ ] Class markers are chalk circles (38px ring), NOT chips — visually distinct from show markers
- [ ] Class markers are larger than show markers (56×56 divIcon vs 34×40)
- [ ] Each discipline renders in its correct oklch color:
  - [ ] improv: `oklch(.80 .16 110)` with ◍ (U+25CD)
  - [ ] acting: `oklch(.64 .19 20)` with ▭ (U+25AD)
  - [ ] writing: `oklch(.68 .13 235)` with ✎ (U+270E)
  - [ ] musical: `oklch(.68 .18 330)`
  - [ ] devised: `oklch(.72 .14 165)`
  - [ ] youth: `oklch(.78 .15 65)`
- [ ] NO discipline hue collides with gold `oklch(.80 .14 55)` — improv at hue 110, gold at hue 55
- [ ] Every class marker has a visible short label (Courier Prime 8px, tinted to discipline)
- [ ] Enrolling markers: solid ring in --dc, glow, discipline glyph, short label, date badge (e.g. `SEP 8`)
- [ ] Between-sessions markers: dashed `#4f4a3e` ring, `#625b4c` glyph/label, NO badge, NO glow
- [ ] Selected marker: `scale(1.16)`, halo via `color-mix(in srgb, var(--dc) 18%, transparent)` — NOT `in oklch`
- [ ] Filtered-out markers: `opacity:.22`, never removed from DOM

## Ghost Behavior (Emphasis, Not Visibility)

- [ ] Both layers are ALWAYS on the map — mode changes emphasis, not visibility
- [ ] In shows mode: class markers ghost to `opacity:.42`, ring shrinks to 24px, colors forced to `#332e26`/`#4a453a`, label hidden, badge hidden
- [ ] In classes mode: show markers ghost to `opacity:.5`, chip forced to `#0f0d08` bg / `#332e26` border, `scale(.82)`, live dots hidden, seen dots hidden
- [ ] Ghost hit box shrinks with the visual:
  - [ ] `.vm.ghost, .cm.ghost { pointer-events: none }`
  - [ ] `.vm.ghost .chip, .cm.ghost .ring { pointer-events: auto }`
- [ ] Tapping a ghosted theater in classes mode does NOT open VenueSheet
- [ ] Tapping a ghosted school in shows mode does NOT open ClassSheet
- [ ] Ghosted markers remain tappable on their drawn shape (chip or ring), but tap is a no-op in the wrong mode
- [ ] Legend names the recessive layer: `○ schools, dimmed` in shows mode, `□ theaters, dimmed` in classes mode

## Map Key

- [ ] Key positioned at `right:14px; top:92px` — NOT bottom-anchored
- [ ] Z-index 1200 — renders above the bottom sheet (z-index 1100)
- [ ] Collapsible pill: `THE KEY −` (open) / `THE KEY +` (closed)
- [ ] Open by default on first load
- [ ] Auto-collapses when any marker is selected
- [ ] Content swaps with mode
- [ ] Shows mode key includes: you have tickets, want to see, been — your colour, curtain up tonight, `○ schools, dimmed`
- [ ] Classes mode key includes: `◍ improv`, `▭ acting`, `✎ writing`, enrolling, between sessions, `□ theaters, dimmed`
- [ ] Key glyphs are SAME codepoints as markers: ◍ U+25CD, ▭ U+25AD, ✎ U+270E
- [ ] Key never occludes sheet content
- [ ] Key pill always visible in every state

## Class Sheet

- [ ] Sheet anchored at `bottom:79px`, radius `16px 16px 0 0`
- [ ] Grab row has explicit `height:24px` — NOT collapsed to ~13px
- [ ] OSM attribution in grab row at `right:14px; top:6px` — NEVER overlaps school name
- [ ] `© OpenStreetMap contributors` visible in both modes
- [ ] Peek line (collapsed): `"N classes taking people right now"` / `TAP A SCHOOL · N NEED NO EXPERIENCE · N DROP-IN`
- [ ] Header: school photo placeholder → school name (Newsreader italic 21px) → HOOD · DISCIPLINE · $$ → user history
- [ ] Next session panel border: --dc when enrolling, `#4a453a` when between sessions
- [ ] Next session label: `NEXT SESSION` in --dc, or `BETWEEN SESSIONS` in --ink-faint
- [ ] Seats indicator: `N OF N TAKEN` / `WALK-INS WELCOME` / `WAITLIST OPEN`
- [ ] Class title in Newsreader italic 19px
- [ ] Schedule: `Tue 7–10pm · 8 weeks · from Sep 8` format
- [ ] WHERE IT STARTS renders LevelPips — NO numeric label, NO "beginner/intermediate/advanced" text
- [ ] LevelPips: 5 pips, filled in --dc up to level (16×4px), empty in --rule beyond (10×4px), radius 2px
- [ ] First tag chip: filled in --dc = access fact (NO EXPERIENCE NEEDED / DROP-IN · $15 / AUDITION REQUIRED)
- [ ] Price is NEVER hidden — always visible above the fold
- [ ] Access fact is ALWAYS above the fold
- [ ] Money chips (outline): PAYMENT PLAN, FINANCIAL AID, SLIDING SCALE (as applicable)
- [ ] Primary action button filled in --dc:
  - [ ] `Hold a spot` (enrolling, not drop-in)
  - [ ] `Just show up` (drop-in)
  - [ ] `Join the waitlist` (between sessions)
- [ ] Between-sessions state is a useful page — waitlist button, NOT a dead end
- [ ] TELL ME MORE outline button present
- [ ] 56px ↗ directions button present
- [ ] All action buttons ≥ 44px touch target
- [ ] WHO TEACHES IT: 44px circular placeholder, name Newsreader italic 13px, credential Courier Prime 8px
- [ ] Teacher names are plain text (until F34/F74 ships)
- [ ] ALSO NEARBY: two nearest schools, each a tappable row ≥ 44px
- [ ] Footer: `LISTINGS UPDATED {date}` when scraped_at > 7 days old

## Teacher → Artist Links (F74, after F34 ships)

- [ ] Teacher names in WHO TEACHES IT become links to artist pages
- [ ] If artist_id is null, name renders as plain text — no broken link
- [ ] `took_it` status writable via class sheet
- [ ] Taking a class records to Your run

## Cleanup & Regression

- [ ] `MapFilterChips.tsx` deleted — no file, no imports anywhere
- [ ] `MapTimePills.tsx` deleted — no file, no imports anywhere
- [ ] No references to old 6-chip filter system remain in codebase
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] No console errors in browser at 390×844 viewport
- [ ] Show markers still render correctly (regression check)
- [ ] VenueSheet still opens correctly for show markers in shows mode (regression check)
- [ ] Existing map filter behavior (tonight, under20, never been) still works on show markers

## Hard Do-Not List

- [ ] No star ratings anywhere
- [ ] No belts anywhere
- [ ] No emoji
- [ ] No "beginner/intermediate/advanced" text labels — pips only
- [ ] No numeric level labels on class markers or sheets
- [ ] No discipline color that matches gold `oklch(.80 .14 55)`
- [ ] No bottom-anchored key (occluded by sheet)
- [ ] No horizontal scroll on filter chips
- [ ] No removing markers from the map (dim to .22, never remove)
- [ ] No hiding the inactive layer entirely (ghost, don't hide)
