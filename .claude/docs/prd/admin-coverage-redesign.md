# PRD: Admin Coverage Redesign — Theaters, Schools, Block, and Field Provenance

**Date:** 2026-08-21
**Tickets:** F80–F90
**Design authority:** `docs/design/v4/design_handoff_house_record/ADMIN-COVERAGE.md` (what & why) and `ADMIN-IMPLEMENTATION.md` (what to type), frames `6a` `6b` `6c` `7a` `7b` `7c` in `The Art of Art - Admin.dc.html`
**Graph:** `docs/graphs/admin-coverage-redesign.md`
**ADR:** `docs/adr/0012-blocklist-and-field-provenance.md`
**QA:** `docs/qa/admin-coverage-redesign.md`

> This PRD is deliberately thin. The two design-handoff documents are the element-by-element spec and are not restated here. This file exists to (a) bind the handoff to repo conventions, (b) state the functional requirements at the FR level for QA derivation, and (c) record resolved divergences between the handoff and the live codebase. **When this PRD and the handoff disagree on a visual or copy detail, the handoff wins. When they disagree on a repo fact (column names, RLS mechanics, migration order), this PRD wins — every divergence is listed in §5.**

---

## 1. Problem

The admin Coverage tab (`src/pages/Docs.tsx` → `CoverageTab`) renders eight equal-weight metric cards, staples school stats under venue stats, offers five action buttons in three colors, and — the direct user request — **has no way to edit a venue/school or to remove/block one so the curator stops re-adding it**. A junk venue found by discovery is re-found on every run. `get_class_coverage_metrics` counts the wrong table (`events` instead of `class_sessions`, post-F70) and reports `0` classes even after successful runs.

## 2. Users and Scope

Admins only (`ADMINS` in `src/lib/constants.ts`; DB-side via the new `is_admin()` — see ADR-0012 D-1). Route stays `/app/admin`, tab `'Coverage'`. Two new admin-only routes: `/app/admin/venue/:id`, `/app/admin/school/:id`. No end-user surface changes except: blocked entities disappear from the map, Tonight, and Discover, and held fields stop being overwritten by the curator.

## 3. Functional Requirements

Each FR maps 1:1 to the handoff; the section pointer is the full behavioral spec.

| FR | Ticket | Requirement | Spec |
|----|--------|-------------|------|
| FR-1 | F84 | `get_class_coverage_metrics` rewritten against `class_sessions`; keys match `ClassCoverageMetrics` exactly (curated-naming, D-2) | COVERAGE §2.4, IMPL §3.1 |
| FR-2 | F82 | `blocked_sources` table (domain- or entry-scoped, soft-delete only) + `block_source`/`unblock_source` RPCs + `normalizeDomain` shared TS/SQL | COVERAGE §2.1, IMPL §3.2 |
| FR-3 | F82 | Enforcement at all three points: discovery insert (counted into the run's `blocked` total), curation target selection, public read paths | COVERAGE §2.2, ADR-0012 D-3 |
| FR-4 | F83 | Disciplines narrowed to `improv \| acting`; reassignment before constraint; client cleanup; four hues reserved, not deleted | COVERAGE §2.3 |
| FR-5 | F81/F85 | THEATERS/SCHOOLS domain tabs; `CoverageTab` split into `TheatersPanel`/`SchoolsPanel`; venue metrics gain `blocked_count`, `venues_missing_calendar`, `venues_missing_photo` (never derived by client subtraction) | COVERAGE §2.5, §4.2 |
| FR-6 | F85 | Frame 6a: `CoverageBar`, `WorkActions` (4 buttons, 2 weights), `NeedsALookTiles` (tiles are filters), `AuditRow` with composed diagnosis incl. `DEAD SITE ×n` from `site_profiles.consecutive_failures` | COVERAGE §4.1–4.2 |
| FR-7 | F86 | Frame 6b: `DryPipelineCard` (renders only when `session_count === 0 && school_count > 0`), `DisciplineBar` (iterates `by_discipline`), `ClassFieldTiles`, school audit rows | COVERAGE §4.3 |
| FR-8 | F82 | Frame 6c `BlockSheet` (reason chips → `reason` CHECK; scope radio; real consequence counts incl. `0`; no `confirm()`) + `BlockedList` with one-row-delete unblock | COVERAGE §4.4–4.5 |
| FR-9 | F87 | `field_overrides`: per-**field** provenance; save writes the real column **and** the override; `previous_value` frozen at first override; curator precedence admin > curator > discovery > null | COVERAGE §5.1, IMPL §3.2 |
| FR-10 | F87 | Shared curator guard (`heldFields`/`filterWritable`/`fileSuggestion`) called at **every** write site in §6's table; discovery auto-insert documented as exempt | IMPL §6 |
| FR-11 | F88 | Detail routes 7a/7b: `AdminField` three-state rows driven by `fieldMeta.ts`; `ProvenanceStrip`; save bar with literal count; unsaved-changes guard; back preserves audit filter; school photo has **no** attribution line | COVERAGE §5.2–5.4 |
| FR-12 | F89 | `curator_suggestions`: blocked writes parked with evidence; `times_suggested` upsert; evidence decides the filled button; two dismissals mute; `accept_suggestion` deletes the override | COVERAGE §5.5, IMPL §3.2/§8 |
| FR-13 | F90 | Copy sweep scrape→curate at presentation layer only; identifiers untouched; `rg -i 'scrap' src/` grep gate | COVERAGE §0.1, IMPL §9 |
| FR-14 | F81 | Teardown: `CoverageMetricsCards.tsx` and `VenueAuditTable.tsx` deleted once unreferenced | IMPL §1 |

## 4. Non-Functional Requirements

- Both panels fit the **642px** scroller at 390×844 (`scrollHeight - clientHeight === 0`); detail pages fit **653px**. No horizontal scroll anywhere.
- Every `<button>` ≥ 44px; status/provenance chips are `<span>`s and exempt.
- Tokens only (`src/styles/tokens.css`); both themes; entry animations wrapped in `prefers-reduced-motion`.
- All new tables have RLS (repo rule); admin-gated writes go through `SECURITY DEFINER` RPCs with column whitelisting — `p_field` is never interpolated unchecked (IMPL §3.2).
- Blocking is soft-delete, never `DELETE` — related `events`, `class_sessions`, `watchlist`, `play_interest` rows must survive.

## 5. Resolved Divergences (handoff ↔ repo)

The handoff instructs: surface divergences, never resolve silently. Resolutions below are binding; rationale lives in ADR-0012.

| # | Divergence | Resolution |
|---|-----------|------------|
| D-1 | Handoff SQL calls `public.is_admin()`; it does not exist. Live admin RLS is `auth.jwt() ->> 'email' = 'deric.o.ortiz@gmail.com'` (`20260819000002_discovery_logs.sql`); client uses `ADMINS = ['darklight','matti']`. | Create `public.is_admin()` (`SECURITY DEFINER STABLE`, jwt-email allowlist — never queries `auth.users`, per `.claude/rules/anti-patterns.md`). **Decision Gate DG-1:** author supplies the email list (currently one email backs two client usernames). |
| D-2 | COVERAGE §2.4 RPC keys (`schools_never_scraped`, `last_class_scrape`) vs IMPL §2 `ClassCoverageMetrics` (`schools_never_curated`, `last_curated_at`). IMPL §3.1 demands exact key parity with the TS type. | **TS interface wins** — new API surface, curated naming, consistent with the `Curation*` rule for new code. §0.1's "don't rename data layer" protects *existing* identifiers (`scraped_at` etc.), which stay untouched. |
| D-3 | COVERAGE §2.2(3) says "WHERE NOT EXISTS inside the existing views" — but map/Tonight/Discover read the tables directly; there are no views. A naïve `NOT EXISTS (SELECT … FROM blocked_sources)` inside an anon SELECT policy silently no-ops, because `blocked_sources` is admin-only and RLS applies inside policy subqueries — the founder's known RLS-silent-failure class. | Filter inside the **RLS SELECT policies** of `venues`, `schools`, `events`, `class_sessions` via a `SECURITY DEFINER STABLE` helper `public.is_source_blocked(entity_type, entity_id, url)`. Service role bypasses RLS, so the curator and admin RPCs still see everything. See ADR-0012 D-3 for the full alternative analysis. |
| D-4 | COVERAGE §2.4 filters `school_count` by `blocked_sources`, but ship order applies the RPC fix **before** the table exists. | Migration 1 ships the RPC without the block filter; migration 3 (read filters) `CREATE OR REPLACE`s it to add the filter. |
| D-5 | Handoff ship order puts `curator_suggestions` (mig 7) at step 10, but the step-8 guard's `fileSuggestion()` and `apply_field_override`'s dismiss clause both write that table. | `curator_suggestions` migrates with `field_overrides` at step 8 (tables travel with the guard); the 7c **UI** stays at step 10. Graph §1 reflects the corrected order. |
| D-6 | `AuditRow` badge `CAL ✓` uses `var(--access-bg)`; `tokens.css` defines `--access` but no `--access-bg` (either theme). | Add `--access-bg` to both themes in `tokens.css` (light `oklch(0.92 0.04 150)`, dark `oklch(0.20 0.04 150)` — same L/C recipe as the danger pair). |
| D-7 | 7a photo attribution reads "`CURATOR · GOODMAN.ORG` from `photo_url_source`", but that column is a CHECK enum `('og_image','manual')`, not a domain. | `sourceLabel = photo_url_source === 'og_image' ? 'CURATOR · ' + normalizeDomain(website_url).toUpperCase() : null`. Admin photo replacement sets `photo_url_source = 'manual'` (satisfies the CHECK) **and** writes the override row. |
| D-8 | "MISTYPED … name matches a known institution list" implies a hardcoded Chicago list, brushing against the any-city anti-pattern. | Keep the heuristic but confine it: `INSTITUTION_HINTS` const in `src/lib/diagnosis.ts` with a comment naming it a display heuristic, never a data source; empty list disables the rule cleanly for city #2. |
| D-9 | Handoff header meta shows `v0.22.0`; repo is at `0.23.0`. Migration stamps `20260823…` proposed; latest live is `20260822000002_site_profiles.sql`. | Cosmetic / compatible. Keep `202608230000NN` stamps; executor re-verifies `ls supabase/migrations \| tail` before writing each. |
| D-10 | Discovery logging: admin-blocked domains need a disposition; `discovery_logs.disposition` CHECK has a fixed set. | Extend the CHECK with `'blocked_admin'` in migration 2 so admin blocks are distinguishable from the built-in aggregator list, while still counting into the run's `blocked` total. |
| D-11 | Ship-order step 1 claims "no UI change", but the current tab destructures the old RPC keys (`class_venue_count` …) and would render blanks. | Step 1 pairs the migration with a two-line `Docs.tsx` key remap (old inline `classMetrics` read → new keys). Patch bump. |
| D-12 | Shipped nav is MAP + DISCOVER; BUILD-SPEC says CALLBOARD + LOBBY. | **Out of scope. Not resolved.** The handoff explicitly says ask before changing either; this feature touches neither. |

## 6. Out of Scope

Nav divergence (D-12); any renaming of `ScrapeContext`, `scrape_jobs`, `scraped_at`, `ScraperDashboard`, edge functions (F90 forbids it); swipe gestures (the list header prints `TAP FOR WHY`, and no swipe affordance may be printed unless swipe ships); auth-walled scraping; multi-admin role tables (jwt-email allowlist suffices until admin count grows — noted in ADR-0012 consequences).

## 7. Success Metrics

A blocked domain is absent from the next discovery run's inserts and present in its `blocked` count; a curation run over a venue with 3 held fields changes 0 of them and files 3 suggestions; `session_count` in the tab equals `SELECT COUNT(*) FROM class_sessions`; the admin can correct a `venue_type` in under 30 seconds from the audit list and the correction survives the next curation run.

---

[timestamp] 2026-08-21 CST
