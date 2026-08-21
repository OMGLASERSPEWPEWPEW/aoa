# QA: Admin Coverage Redesign — 6a/6b/6c + 7a/7b/7c (F80–F90)

**Date:** 2026-08-21
**Entry:** `/app/admin` → Coverage tab (admin account required)
**PRD:** `.claude/docs/prd/admin-coverage-redesign.md` · **Graph:** `docs/graphs/admin-coverage-redesign.md`
**Sources:** ADMIN-COVERAGE.md §5.6 + §7, ADMIN-IMPLEMENTATION.md §10

Preconditions unless stated: signed in as an admin; at least one venue with `calendar_url`, one without; ≥1 school; DevTools open at 390×844.

## Metrics correctness (FR-1)

- [ ] Schools tab `session_count` equals `SELECT COUNT(*) FROM class_sessions` (REST probe)
- [ ] After a successful class curation run the count is non-zero (the pre-fix `0` bug is gone)
- [ ] RPC key set exactly matches `ClassCoverageMetrics` (curated naming — PRD D-2)

## Blocking (FR-2/3/8)

- [ ] Blocking inserts a `blocked_sources` row and never DELETEs a venue or school (row still present via service-role probe; watchlist/reviews intact)
- [ ] Block sheet shows the **normalized** domain; reason is required; `OTHER` reveals a note field
- [ ] Scope defaults: reason `aggregator` → *The whole domain*; any other reason → *Just this entry*
- [ ] Consequence sentence interpolates the real affected counts, including `0` — never a generic "are you sure"; no native `confirm()` anywhere
- [ ] A blocked venue disappears from the map, Tonight, and Discover without a reload (anon REST probe returns `[]` for the venue and its events)
- [ ] A blocked school's class_sessions also vanish from anon reads
- [ ] `scope='entry'` hides the row but the domain remains eligible for discovery
- [ ] Next discovery run rejects the blocked domain, increments the ribbon's `blocked` count, and logs `disposition='blocked_admin'`
- [ ] Curation target selection skips blocked entities (blocked venue never appears in a scrape batch)
- [ ] BLOCKED (n) tile opens the list; UNBLOCK is one row delete and fully restores the entity everywhere
- [ ] Service role / pipeline reads are unaffected by the read filters
- [ ] Non-admin JWT cannot call `block_source` / `unblock_source` / read `blocked_sources`

## Layout & shell (FR-5/6/7)

- [ ] THEATERS/SCHOOLS choice persists across refetch and reload (sessionStorage)
- [ ] Both panels: `scroller.scrollHeight - scroller.clientHeight === 0` at 390×844
- [ ] No horizontal scroll anywhere; no `<table>` in the audit list
- [ ] `[...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height < 44)` is empty; status/provenance chips are `<span>`s
- [ ] Both themes pass on every frame; no hardcoded hex where a token exists (spot-check computed styles)
- [ ] Coverage bar animates on mount only, never on refetch; with reduced-motion emulated, no animation <!-- qa:human motion perception -->
- [ ] Exactly four work buttons, two visual weights; `Find venues`/`Curate shows` primary; running state disables at opacity 0.6 with the existing running label
- [ ] `LAST RUN {date} · {n}D AGO` shows relative age

## 6a content

- [ ] NEEDS A LOOK tiles filter the list (not decorative); active tile gets its 1.5px border + tinted bg; `0 EVENTS` renders danger only when non-zero
- [ ] List header names the active filter in that filter's color, with `TAP FOR WHY` right-aligned; no SWIPE copy exists anywhere
- [ ] Every audit row states a diagnosis (max three ` · ` segments, precedence per `diagnosis.ts`), not just type/source
- [ ] `DEAD SITE ×n` appears for a domain with `site_profiles.consecutive_failures ≥ 2`
- [ ] Aggregator-flagged school rows show `BLOCK` (danger) instead of the curate action and grey their glyph

## 6b content

- [ ] DryPipelineCard renders **only** when `session_count === 0 && school_count > 0`; when sessions exist, the normal stats occupy that slot — never both
- [ ] Discipline segments render from `by_discipline` — injecting a synthetic third key in devtools produces a third segment with no code change
- [ ] ClassFieldTiles colors derive from counts: 0 → ghost, < session_count → danger, parity → access

## Provenance & detail pages (FR-9/10/11)

- [ ] Overrides are per **field**, never per row
- [ ] Saving writes the real column *and* the override atomically (bogus field name raises; neither write lands)
- [ ] Editing the same field twice preserves the curator's original in `previous_value` (`WAS …` line stays truthful)
- [ ] Held field shows `⊙ YOURS · {MON D}`, the accent left-border treatment, and the `WAS {previous} · THE CURATOR WON'T CHANGE THIS AGAIN` line
- [ ] `⋯ → Hand back to the curator` deletes the override; row reverts to Curated
- [ ] Empty fields name the user-facing consequence (`EMPTY · SHOWS AS A GAP` etc.), never `NULL`
- [ ] `short_name` counter derives from `value.length` (types `SECOND CITY` → `11/14`), enforces 14, and states it is the map label
- [ ] Venue photo shows `CURATOR · {DOMAIN}` when `photo_url_source='og_image'`; replacing sets `photo_url_source='manual'` + an override; the ✕ and REPLACE sit on the scrim at 44px
- [ ] School photo shows **no** attribution line (no `photo_url_source` column exists)
- [ ] `HOW PEOPLE AFFORD IT` toggles use the access track when on
- [ ] Hand-adding a class seeds `field_overrides` for every provided field
- [ ] Detail pages render no bottom nav; save bar instead; `Save {n} changes` count literal, disabled at 0
- [ ] Navigating away with `dirtyCount > 0` prompts <!-- qa:human browser dialog -->
- [ ] Back returns to the audit list with its filter intact
- [ ] **The promise test:** hold 3 fields on one venue → run the curator over it → all 3 columns unchanged, 3 `curator_suggestions` rows exist

## Curator disagreement (FR-12)

- [ ] A blocked curator write is parked in `curator_suggestions`, never silently dropped
- [ ] Re-finding the same value increments `times_suggested` (no duplicate rows)
- [ ] Header card copy: "It found different values for fields you hold. Nothing was changed — your versions are still live."
- [ ] Evidence decides the filled button; both buttons always present at ≥44px
- [ ] TAKE THEIRS writes the value **and deletes the override**; KEEP MINE dismisses; two dismissals mute with the `KEEPING YOURS TWICE STOPS IT ASKING.` footnote
- [ ] Provenance strip shows `· {n} NOTES` tappable; audit meta gains `CURATOR HAS NOTES`

## Copy & teardown (FR-13/14)

- [ ] `rg -i 'scrap' src/ --glob '!*.test.*'` → identifiers only, zero on-screen strings
- [ ] Dates render `CURATED {MON D}` or `NEVER CURATED` in danger — never `Never`, never blank
- [ ] `CoverageMetricsCards.tsx` and `VenueAuditTable.tsx` deleted; build green

## Do-not regressions

- [ ] No 4×2 equal metric grid; no fifth action button; no hard delete path exists in any RPC or UI handler
