# ADR 0012: Domain-Keyed Soft-Delete Blocklist and Per-Field Admin Provenance

**Date:** 2026-08-21
**Status:** Proposed
**Feature:** Admin Coverage Redesign (F80–F90)
**PRD:** `.claude/docs/prd/admin-coverage-redesign.md`
**Design:** `docs/design/v4/design_handoff_house_record/ADMIN-COVERAGE.md`, `ADMIN-IMPLEMENTATION.md`
**Graph:** `docs/graphs/admin-coverage-redesign.md`

> Numbering note: 0011 (`executable-evaluators-and-test-first-loops`) is the highest ADR at spec time. If a 0012 lands first, renumber this file and update the three cross-references above plus the graph doc header.

---

## Context

Admins need to (1) edit venue and school records without the curator overwriting them, and (2) remove junk entries in a way the discovery pipeline respects — today a dismissed aggregator is re-found on every run. Four architectural questions required decisions:

1. How is "blocked" keyed and enforced so it survives re-discovery?
2. How do blocked entities vanish from public reads when those reads hit tables directly (no views) and `blocked_sources` is admin-only under RLS?
3. What is the granularity and storage model for "the curator must not override my edit"?
4. What happens to a curator finding that conflicts with a held field?

Constraints in force: RLS on every table; never query `auth.users` in policies; Vercel is static-only so all server logic is Supabase (RLS + `SECURITY DEFINER` RPCs + Edge Functions); blocking must never `DELETE` (`events`, `class_sessions`, `watchlist`, `play_interest` hang off venues/schools); no `public.is_admin()` exists yet — live admin policies hardcode a jwt email.

## Decision

**D-1 — `public.is_admin()` helper.** One `SECURITY DEFINER STABLE` function returning `auth.jwt() ->> 'email' = ANY(<allowlist>)`. All new admin policies and RPC guards call it; the two existing hardcoded-email policies in `20260819000002` are left as-is (working, out of scope). The allowlist is a Decision Gate (DG-1) for the author.

**D-2 — Blocklist = `blocked_sources`, keyed by normalized domain, soft-delete only.** Schema exactly as ADMIN-COVERAGE §2.1 (`scope IN ('domain','entry')`, `reason` CHECK, `name_snapshot`, `UNIQUE(domain)`). Blocking inserts a row; unblocking deletes it; entity rows are never touched. `normalize_domain(text)` is an `IMMUTABLE` SQL function mirrored byte-for-byte by `normalizeDomain()` in `src/lib/blocklist.ts`, both proven against one shared fixture (`src/lib/__fixtures__/domains.json`). A `UNIQUE(domain)` row blocks the domain for **both** entity types — a domain block is global by design.

**D-3 — Enforcement at three points, with read-path filtering inside RLS via a definer helper.**
- *Discovery insert:* edge functions reject candidates whose normalized domain matches a `scope='domain'` row (service role reads `blocked_sources` directly — no RLS issue), log `disposition='blocked_admin'` (CHECK extended), and count into the run's existing `blocked` total.
- *Curation target selection:* `getNextVenue` / `getNextSchool` exclude blocked entities with a `NOT EXISTS` join (service role).
- *Public reads:* the anon/authenticated SELECT policies on `venues`, `schools`, `events`, `class_sessions` gain `AND NOT public.is_source_blocked(<entity_type>, <entity_id or parent id>, <url>)`, where `is_source_blocked` is `SECURITY DEFINER STABLE`. The definer wrapper is the load-bearing part: RLS applies **inside** policy subqueries, so a plain `NOT EXISTS (SELECT 1 FROM blocked_sources …)` evaluated as anon sees zero rows (admin-only table) and silently filters nothing — the exact RLS-silent-failure class this repo has been burned by before. Events and class_sessions filter on their **parent** venue/school so a blocked venue's shows leave Tonight/Discover with it.

**D-4 — Per-field provenance: `field_overrides` is the memory of who wrote it, not the value's home.** Saving via `apply_field_override(entity_type, entity_id, field, value)` atomically UPDATEs the real column (so zero read paths grow a join) and upserts the override row, preserving `previous_value` from the **first** override and whitelisting `p_field` against `information_schema.columns` (identifier position, never interpolated unchecked). Precedence, stated once: admin override > curator extraction > discovery raw > null; no confidence score beats an override.

**D-5 — One curator guard, every write site.** `heldFields()` / `filterWritable()` / `fileSuggestion()` in `supabase/functions/_shared/curator/overrides.ts`, called at all five guarded write sites in ADMIN-IMPLEMENTATION §6 (venue enrichment, event persistence, class extraction, geocode auto-fix, play backfill). Discovery auto-insert is exempt — inserts precede any possible override — and that exemption is documented at the call site so nobody "fixes" it later and masks a real bug.

**D-6 — Conflicts are parked, never dropped.** `curator_suggestions` upserts on `(entity, field)` with evidence; `times_suggested` increments on re-finding; `accept_suggestion` writes the value **and deletes the override** (the curator owns the field again); two dismissals mute. This table migrates alongside `field_overrides` — the guard writes it, so it cannot lag to a later step (PRD D-5).

## Alternatives Considered

- **Block by row id instead of domain:** rejected — discovery inserts a fresh row with a fresh id; the block must survive re-discovery, so the key is the domain (COVERAGE §2.1). Entry-scoped blocks exist for the row-level case and deliberately leave the domain eligible.
- **`is_blocked` column on `venues`/`schools`:** rejected — unblocking becomes a multi-table update, discovery re-inserts need an upsert dance, and the column duplicates state the blocklist already holds. `NOT EXISTS`/helper keeps unblock a one-row delete.
- **Hard `DELETE` on block:** rejected — FK cascade would destroy watchlist history and reviews; also makes unblock impossible.
- **Public-read views (`venues_public` etc.) with the filter inside:** honest to the handoff's wording but repoints every client query (`fetchVenuesWithCoords`, map, Tonight, Discover, class map) — a large blast radius for an admin feature, and it still needs the definer trick or a readable blocklist. RLS-policy amendment touches zero client call sites.
- **World-readable `blocked_sources` instead of a definer helper:** simpler, but leaks admin moderation notes/reasons to anon, and RLS is not column-selective. Rejected.
- **Per-row (whole-record) override flag:** rejected — freezing 14 fields because the admin corrected one blocks genuinely useful automatic updates to the other 13 (COVERAGE §5.1). Provenance is per field.
- **Overrides as the read-time source of truth (join everywhere):** rejected — adds a join to the map, Tonight, and Discover for an admin feature; write-through keeps every existing read path untouched.
- **Silently dropping blocked curator writes:** rejected — a stale hand-typed `calendar_url` would quietly starve a venue of events forever; parking with evidence is what makes the guarantee trustworthy (COVERAGE §5.5).
- **Client-side multi-statement writes instead of RPCs:** rejected — block/override/accept are multi-statement and must be atomic; RPC with `is_admin()` guard is the only atomic path from the browser.

## Consequences

- **Positive:** blocks survive re-discovery and are reversible in one delete; zero joins added to hot read paths; the admin's corrections are provably durable (integration test: hold 3 fields → curate → 0 changed, 3 suggestions); enforcement is testable at each of the three points independently.
- **Negative:** RLS SELECT policies on four public tables now call a function per row — `STABLE` + the `(entity_type, entity_id)` and partial domain indexes keep it cheap at this data size (hundreds of rows), but it is a per-row cost to monitor if venue count grows 100×. The guard is a per-write-site obligation: a forgotten call silently breaks the promise, which is why the graph's guard node greps every `.update`/`.upsert` site and the integration test is mandatory.
- **Negative:** jwt-email allowlist inside `is_admin()` means adding an admin is a migration, not a UI action. Accepted at current team size; revisit as a `profiles.is_admin` flag if that changes.
- **Neutral:** `accept_suggestion` deleting the override means "take theirs" is a full hand-back, by design; the two legacy hardcoded-email policies remain until a cleanup pass.

## Amendment (2026-08-21) — D-2 Uniqueness Now Scope-Partial

**Context:** F91 (Cost Truth + Admin Coverage Remediation) found that the unconditional `UNIQUE(domain)` constraint caused an entry block to occupy the domain slot — a second entry block or a later domain block on the same domain raised `'domain already blocked'`.

**Change:** migration `20260823000010` drops `UNIQUE(domain)` and replaces it with two partial unique indexes: `(domain) WHERE scope = 'domain'` and `(entity_type, entity_id) WHERE scope = 'entry'`. `block_source` now conflicts per scope with scope-specific error text. Entry rows retain `domain NOT NULL` for audit display.
