# Graph: Admin Coverage Redesign — 6a/6b/6c + 7a/7b/7c (F80–F90)

**Date:** 2026-08-21
**PRD:** `.claude/docs/prd/admin-coverage-redesign.md` (binding divergence register in its §5 — read it first)
**ADR:** `docs/adr/0012-blocklist-and-field-provenance.md`
**QA:** `docs/qa/admin-coverage-redesign.md`
**Design authority:** `docs/design/v4/design_handoff_house_record/ADMIN-COVERAGE.md` + `ADMIN-IMPLEMENTATION.md` + `The Art of Art - Admin.dc.html` (landed by node `acr-handoff-landing`)
**Target:** `OMGLASERSPEWPEWPEW/aoa` @ `main` — React 19 + TS + Vite + Tailwind tokens + Supabase + TanStack Query

## Section 0: Execution Contract

**Skills that execute this spec.** This document is the `/new-feature` Phases 1–5 output; execution runs its Execute phase node-by-node. Per node: `/create-tests` conventions govern test style (test-first, frozen during implementation — ADR-0011); nodes marked **[SR]** touch auth, RLS, `SECURITY DEFINER`, or Edge-Function input handling and MUST run `/security-review` in their Verify stage (tlv-security-review-wiring rule). Before every push: `/docs-check`. Every commit+push: `/cap` only — never manual `git add/commit/push` (`.claude/runbooks/deployment-workflow.md`). Dev server restarts via `/rs`. Phase-4 component nodes with no shared files may be dispatched in parallel via `/swarm`; stuck nodes escalate via `/escalate`.

**Hooks in force.** `pre-push-gate.sh` (tsc + vitest + deno tests must pass; `SKIP_GATE=1` is logged and is not to be used by this graph), `git-push-confirm.sh`, `status-digest.sh`. Push to main **is** the Vercel deploy — a node is not "verified" by deploying; every success criterion below is an executable command that runs *before* push (ADR-0011).

**Loop template (applies to every node unless its Loop spec overrides).** Test → Implement → Verify: (1) write the node's tests/evaluator first, commit failing where a test file exists; (2) implement with tests frozen — changing a test to reach green requires stopping for author sign-off; (3) fresh-context verify: a cold `Argus-code-reviewer` subagent gets only the node spec, the diff, and the evaluator command, runs the evaluator itself, and reads the diff independently. Append every verify cycle to `docs/graphs/attempts.jsonl`. Retry budget: 3 cycles per node, then `/escalate`.

**Env for evaluator commands.** `$SB` = `VITE_SUPABASE_URL` from `.env.local`; `$ANON` = `VITE_SUPABASE_ANON_KEY`; `$SRK` = service-role key (author-held, never committed); `$ADMIN_JWT` = a signed-in admin access token (author supplies for RPC probes). REST probes use PostgREST (`/rest/v1/...`) so no psql dependency exists.

### Decision Gates (answer before Phase 2; record answers in §7)

- **DG-1 — `is_admin()` allowlist.** Which emails? Live DB policy knows only `deric.o.ortiz@gmail.com`; client `ADMINS` has two usernames. Default if unanswered: the one known email.
- **DG-2 — Restart-safety of migration stamps.** Run `ls supabase/migrations | tail -3` — if anything ≥ `20260823000001` exists, shift all eight stamps up and update this doc's File Index. Same check for ADR numbering (`ls docs/adr | tail -1`; expected `0011`).
- **DG-3 — Scaffold block entry point (Phase 2)** ships a temporary `⊘` on the *existing* `VenueAuditTable` so blocking is usable before 6a lands, removed by `acr-6a-tiles-audit`. Author may veto and accept blocking being UI-less until Phase 4.

---

## Section 1: DAG

```
Phase 0   [acr-handoff-landing]──[acr-decision-gates]
                     │
Phase 1   [acr-class-rpc-fix]                              v0.23.1
                     │
Phase 2   [acr-blocklist-lib]
                     │
          [acr-mig-blocked-sources]
                     ├──────────────────────┐
          [acr-curator-blocklist-guard] [acr-mig-read-filters]
                     └──────────┬───────────┘
                       [acr-block-ui]                      v0.24.0
                            │
Phase 3   [acr-mig-disciplines]                            v0.25.0
                            │
Phase 4   [acr-mig-venue-metrics]  [acr-tokens-access-bg]
                     └──────┬───────────┘
             [acr-domain-tabs-split]
              ├────────────────┬───────────────┐
   [acr-6a-coverage-work] [acr-6a-tiles-audit] [acr-6b-hooks]
                                               │
                                        [acr-6b-panel]     v0.26.0
                            │
Phase 5   [acr-mig-overrides-suggestions]
                            │
              [acr-curator-guard]  ← never ships after detail pages; ships before or with them
                            │
              [acr-mig-admin-rpcs]
                            │
              [acr-field-registry]
                            │
              [acr-detail-pages]                           v0.27.0
                            │
Phase 6   [acr-suggestions-ui]                             v0.28.0
                            │
Phase 7   [acr-copy-sweep]──[acr-teardown]                 v0.28.1
                            │
Phase 8   [acr-docs-qa]
```

Every phase boundary is an independently deployable state; the app works at each one (ADMIN-IMPLEMENTATION §11).

---

## Section 2: Node Specifications

### Phase 0 — Landing

#### Node: acr-handoff-landing
- **Type**: docs
- **Agent**: technical-writer
- **Depends on**: (none)
- **Inputs**: the `aoa-admin_design_and_spec.zip` bundle (`design_handoff_house_record/`)
- **Outputs**: bundle contents copied into `docs/design/v4/design_handoff_house_record/` (the existing handoff folder — new files `ADMIN-COVERAGE.md`, `ADMIN-IMPLEMENTATION.md`, `The Art of Art - Admin.dc.html`; shared files like `README.md`, `support.js` overwrite in place)
- **Loop pattern**: one-shot
- **Success criteria**: `test -f docs/design/v4/design_handoff_house_record/ADMIN-COVERAGE.md && test -f .../ADMIN-IMPLEMENTATION.md`; `git status --short docs/design/` shows the adds
- **Estimated effort**: Trivial

#### Node: acr-decision-gates
- **Type**: gate
- **Agent**: (main context, with author)
- **Depends on**: acr-handoff-landing
- **Outputs**: DG-1..DG-3 answers appended to §7; migration/ADR numbering confirmed per DG-2
- **Loop pattern**: one-shot
- **Success criteria**: §7 contains all three answers before any Phase-2 file is written
- **Estimated effort**: Trivial

### Phase 1 — Fix the wrong number (v0.23.1)

#### Node: acr-class-rpc-fix
- **Type**: migration + patch
- **Agent**: Frontinus-backend-architect
- **Depends on**: acr-decision-gates
- **Inputs**: ADMIN-COVERAGE §2.4 (SQL body, minus the blocked_sources filter — PRD D-4); ADMIN-IMPLEMENTATION §2 `ClassCoverageMetrics` (key names win — PRD D-2); `supabase/migrations/20260815000012_class_coverage_rpc.sql`; `src/pages/Docs.tsx` inline `classMetrics` fetch
- **Outputs**:
  - `supabase/migrations/20260823000001_fix_class_coverage_rpc.sql` — `CREATE OR REPLACE FUNCTION public.get_class_coverage_metrics()` returning exactly the `ClassCoverageMetrics` keys: `school_count`, `schools_never_curated` (schools with no `class_sessions`), `session_count`, `sessions_enrolling` (`starts_on >= CURRENT_DATE`), `with_start_date`, `with_price`, `with_level`, `with_teacher` (EXISTS `class_teachers`), `by_discipline` (`json_object_agg`), `last_curated_at` (`MAX(scraped_at)`). No blocked filter yet.
  - `ClassCoverageMetrics` replaced in `supabase/functions/_shared/scraper/types.ts` and added to `src/lib/types.ts` (IMPL §2)
  - `src/pages/Docs.tsx` — inline `classMetrics` state + JSX remapped to the new keys (SCHOOLS→`school_count`, CLASSES→`session_count`, W/ INSTRUCTOR→`with_teacher`, W/ LEVEL→`with_level`) so the current tab keeps rendering (PRD D-11)
- **Loop pattern**: plan-execute-verify
- **Success criteria** (executable):
  - `supabase db push` exits 0
  - `curl -s "$SB/rest/v1/rpc/get_class_coverage_metrics" -X POST -H "apikey: $ANON" -H "Authorization: Bearer $ADMIN_JWT"` returns JSON whose key set equals the TS interface exactly (`jq 'keys|sort'` diffed against the ten names)
  - `session_count` in that JSON equals `curl -s "$SB/rest/v1/class_sessions?select=id" -H "apikey: $ANON" -H "Prefer: count=exact" -I | grep -i content-range` total
  - `npx tsc --noEmit` exits 0
- **Estimated effort**: Small
- **Design reference**: COVERAGE §2.4 — "the number is not just sad, it is wrong"

### Phase 2 — Blocklist core + enforcement (v0.24.0)

#### Node: acr-blocklist-lib
- **Type**: lib (test-first)
- **Agent**: frontend-developer
- **Depends on**: acr-decision-gates
- **Inputs**: COVERAGE §2.1 normalization rule (lowercase, strip scheme, `www.`, port, path); IMPL §8
- **Outputs**:
  - `src/lib/__fixtures__/domains.json` — ≥10 pairs incl. `https://WWW.ClassPass.com/chicago → classpass.com`, bare host, trailing slash, `http://`, port `:8080`, subdomain preserved (`chicago.eventbrite.com → chicago.eventbrite.com`), null/empty → null, garbage string → null
  - `src/lib/blocklist.ts` — `normalizeDomain(url: string | null): string | null`, `BLOCK_REASON_LABELS: Record<BlockReason,string>`
  - `src/lib/blocklist.test.ts` — vitest, drives every fixture pair (written first, committed failing)
- **Loop pattern**: plan-execute-verify (Loop v2)
- **Success criteria**: `npx vitest run src/lib/blocklist.test.ts` green; fixture file untouched after implementation (`git diff --stat -- src/lib/__fixtures__` empty post-test-commit)
- **Estimated effort**: Small

#### Node: acr-mig-blocked-sources **[SR]**
- **Type**: migration
- **Agent**: Frontinus-backend-architect
- **Depends on**: acr-blocklist-lib
- **Inputs**: COVERAGE §2.1 DDL verbatim; ADR-0012 D-1/D-2; `src/lib/__fixtures__/domains.json`; `.claude/rules/anti-patterns.md` (never `auth.users` in policies)
- **Outputs**: `supabase/migrations/20260823000002_blocked_sources.sql` containing, in order:
  1. `public.is_admin()` — `SECURITY DEFINER STABLE`, jwt-email `= ANY(ARRAY[...DG-1...])`, `search_path = public`
  2. `public.normalize_domain(text) RETURNS text IMMUTABLE` — same five rules as the TS; `GRANT EXECUTE ... TO anon, authenticated` (pure function; grant exists so the parity evaluator can call it over REST)
  3. `blocked_sources` table + partial domain index + `(entity_type, entity_id)` index + RLS `FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())`, exactly as COVERAGE §2.1
  4. `public.is_source_blocked(p_entity_type text, p_entity_id uuid, p_url text) RETURNS boolean SECURITY DEFINER STABLE` — true when a matching `entity` row exists **or** a `scope='domain'` row matches `normalize_domain(p_url)` (ADR-0012 D-3)
  5. RPCs `block_source(...)` per `BlockRequest` (guarded by `is_admin()`; normalizes server-side; `ON CONFLICT (domain) DO NOTHING` semantics surfaced as an error the UI can show; dismisses open `curator_suggestions` **only if that table exists** — wrap in `to_regclass` check since suggestions migrate in Phase 5) and `unblock_source(p_id uuid)` (one-row delete)
  6. `ALTER TABLE discovery_logs DROP CONSTRAINT ... ; ADD CONSTRAINT` extending the disposition CHECK with `'blocked_admin'` (PRD D-10)
- **Loop pattern**: plan-execute-verify; `/security-review` on the SQL before push
- **Success criteria** (executable):
  - `supabase db push` exits 0
  - Parity: `node scripts/parity/normalize-domain.mjs` exits 0 (created here; for each fixture input, curls `POST $SB/rest/v1/rpc/normalize_domain {"$1": input}` with `$ANON` and diffs against `normalizeDomain()` output — TS and SQL byte-equal on all pairs)
  - Anon cannot read: `curl -s "$SB/rest/v1/blocked_sources?select=id" -H "apikey: $ANON"` returns `[]` or a 401/permission body, and after seeding one row via `$SRK` it still returns no rows
  - Admin RPC path: `block_source` with `$ADMIN_JWT` inserts; with a non-admin JWT raises `not admin`
- **Estimated effort**: Medium
- **Design reference**: COVERAGE §2.1; ADR-0012 D-1/D-2/D-3

#### Node: acr-curator-blocklist-guard **[SR]**
- **Type**: feature (edge)
- **Agent**: Frontinus-backend-architect
- **Depends on**: acr-mig-blocked-sources
- **Inputs**: COVERAGE §2.2 points 1–2; `supabase/functions/class-discovery/index.ts` (`deduplicateAndQueue`, existing `blocked` counter + `logDiscoveryResult`), `supabase/functions/venue-discovery/` insert path, `event-scrape-batch/index.ts` `getNextVenue`, `class-scrape-batch/index.ts` `getNextSchool`
- **Outputs**:
  - `supabase/functions/_shared/curator/blocklist.ts` — `isBlockedDomain(sb, url): Promise<boolean>` + `blockedEntityIds(sb, entityType): Promise<Set<string>>` (service-role reads; RLS is not in play for the pipeline)
  - Discovery insert rejection in both discovery functions: blocked candidates increment the run's `blocked` total (the ribbon at `Docs.tsx` already renders `${discoveryResult.blocked} blocked` — report honestly) and log `disposition: 'blocked_admin'`
  - Target-selection exclusion: `getNextVenue`/`getNextSchool` queries gain `NOT EXISTS` against `blocked_sources` (entity or domain scope)
  - `supabase/functions/_shared/curator/blocklist.test.ts` — deno test with a stubbed in-memory client fixture (same hermetic style as `scraper/fixtures.test.ts`): a queued candidate on a blocked domain is rejected and counted; a blocked venue never comes back from target selection
- **Loop pattern**: plan-execute-verify (Loop v2; deno test written first)
- **Success criteria**: `deno test supabase/functions/_shared/curator/` green; `supabase functions deploy class-discovery event-scrape-batch class-scrape-batch venue-discovery` exit 0; curl smoke — with one seeded `scope='domain'` block, `POST $SB/functions/v1/class-discovery {"action":"discover"}` (x-scraper-key) returns `blocked ≥ 1` when SerpAPI surfaces that domain, and `discovery_logs` (read via `$SRK`) contains a `blocked_admin` row
- **Estimated effort**: Medium
- **Design reference**: COVERAGE §2.2 — "a UI-only blocklist is a bug that looks like a feature"

#### Node: acr-mig-read-filters **[SR]**
- **Type**: migration
- **Agent**: Frontinus-backend-architect
- **Depends on**: acr-mig-blocked-sources
- **Inputs**: ADR-0012 D-3; existing SELECT policies (`"Anyone can read venues/events"`, `schools_select`, `class_sessions_select`); COVERAGE §2.4 (blocked-aware school_count)
- **Outputs**: `supabase/migrations/20260823000003_blocklist_read_filters.sql` —
  - Recreate the four public SELECT policies with `USING (NOT public.is_source_blocked(...))`: venues on `('venue', id, website_url)`; schools on `('school', id, url)`; events on the **parent** `('venue', venue_id, NULL)`; class_sessions on the parent `('school', school_id, NULL)`
  - `CREATE OR REPLACE get_class_coverage_metrics` — identical body plus the `blocked_sources NOT EXISTS` filter on `school_count` (PRD D-4 closes here)
- **Loop pattern**: plan-execute-verify; `/security-review` (RLS blast radius: confirm service_role and the ScraperDashboard's service paths unaffected; confirm admin client reads of a blocked entity return nothing — BlockedList reads `name_snapshot` by design)
- **Success criteria** (executable RLS probes — integration tests 3 & 4 of IMPL §10):
  - Seed a domain block for one test venue via `$SRK`; then `curl "$SB/rest/v1/venues?select=id&id=eq.<that-id>" -H "apikey: $ANON"` → `[]`; same probe for one of its events → `[]`; a school entry-block hides the school and its sessions from anon
  - `unblock_source` via `$ADMIN_JWT`, re-probe → row returns (one-row delete fully restores)
  - `$SRK` probe of the same venue → row present (service role unaffected)
  - `get_class_coverage_metrics.school_count` decreases by exactly 1 while a school is blocked
- **Estimated effort**: Medium
- **Design reference**: COVERAGE §2.2(3); ADR-0012 D-3 (the definer-helper trap)

#### Node: acr-block-ui
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: acr-mig-read-filters, acr-curator-blocklist-guard
- **Inputs**: COVERAGE §4.4–§4.5 (full sheet spec: header, five reason chips, HOW WIDE radios with defaults — `domain` when reason `aggregator`, else `entry` — consequence sentence with real counts, footer); IMPL §4.1–4.3, §7 (`BlockSheet`/`BlockedList` props, `useBlockSource`, `useBlockedSources`); `src/hooks/useDiscoveryQueue.ts` (optimistic-removal pattern); DG-3
- **Outputs**:
  - `src/lib/adminInvalidation.ts` — `invalidateAfterBlock` / `invalidateAfterOverride` exactly per IMPL §4.2 (map keys invalidated by **prefix** `['map-data']`, `['class-map']`)
  - `src/lib/queryKeys.ts` — add `blocked`, `schools`, `overrides`, `suggestions` namespaces + `venues.detail` per IMPL §4.1 (style-preserving `as const` builders)
  - `src/hooks/useBlockSource.ts`, `src/hooks/useBlockedSources.ts`
  - `src/components/admin/BlockSheet.tsx` (sheet geometry per §4.4 — modal, may cover nav; `OTHER` reveals a note textarea; shows the **normalized** domain; affected counts fetched live: `events` by `venue_id`, `class_sessions` by `school_id`; "Say the true number, including when it is 0"; no native `confirm()`), `src/components/admin/BlockedList.tsx` (empty state copy per §4.5)
  - DG-3 scaffold: `⊘` (44×44, danger tokens) appended to `VenueAuditTable` rows + a `BLOCKED ({count})` row opening `BlockedList` — marked `// SCAFFOLD: removed by acr-6a-tiles-audit`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `npx tsc --noEmit`; blocking a venue in the running app removes it from the audit list optimistically and from the map without reload (invalidation by prefix observed in devtools); `BlockedList` UNBLOCK restores it; both themes screenshotted; `[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height<44)` empty on the sheet
- **Estimated effort**: Large
- **Design reference**: COVERAGE §4.4 — "The sheet *is* the confirmation"

### Phase 3 — Theatre-only disciplines (v0.25.0)

#### Node: acr-mig-disciplines
- **Type**: migration + client cleanup
- **Agent**: Frontinus-backend-architect (SQL) + frontend-developer (client)
- **Depends on**: acr-block-ui
- **Inputs**: COVERAGE §2.3 (reassign **before** narrowing, or the ALTER fails); IMPL §2 (`Discipline` narrows — tsc walks the cleanup); `src/components/ClassMarker.ts` (`DCOL`/`CSIGIL`), `MapKey.tsx`, class filter chips, `src/lib/types.ts`
- **Outputs**: `supabase/migrations/20260823000004_theatre_only_disciplines.sql` (UPDATE reassign → DROP → ADD CHECK `('improv','acting')`); `Discipline = 'improv' | 'acting'` with the reserved-hues comment ("treat the four extras as reserved, not deleted") kept beside `DCOL`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `supabase db push` 0; `curl "$SB/rest/v1/schools?select=discipline" -H "apikey: $ANON" | jq -r '.[].discipline' | sort -u` ⊆ {improv, acting}; `npx tsc --noEmit` 0 after cleanup; `rg "'writing'|'musical'|'devised'|'youth'" src/ --glob '!*.test.*'` returns only the reserved-comment lines
- **Estimated effort**: Small
- **Design reference**: COVERAGE §2.3

### Phase 4 — Panels, 6a, 6b (v0.26.0)

#### Node: acr-mig-venue-metrics
- **Type**: migration
- **Agent**: Frontinus-backend-architect
- **Depends on**: acr-mig-disciplines
- **Outputs**: `supabase/migrations/20260823000005_venue_coverage_additions.sql` — `get_venue_coverage_metrics` gains `blocked_count`, `venues_missing_calendar`, `venues_missing_photo` (explicit counts, blocked-aware; **never** client-side subtraction — COVERAGE §2.5); `VenueCoverageMetrics` extended in `_shared/scraper/types.ts` (keep the import path the hooks use)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: RPC key-set diff includes the three new keys; with one venue blocked, `blocked_count` = 1 and `venues_missing_calendar` excludes it; `tsc` 0
- **Estimated effort**: Small

#### Node: acr-tokens-access-bg
- **Type**: constants
- **Agent**: frontend-developer
- **Depends on**: (none — parallel)
- **Outputs**: `--access-bg` added to both themes in `src/styles/tokens.css` per PRD D-6
- **Loop pattern**: one-shot
- **Success criteria**: `grep -c "access-bg" src/styles/tokens.css` = 2
- **Estimated effort**: Trivial

#### Node: acr-domain-tabs-split
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: acr-mig-venue-metrics
- **Inputs**: COVERAGE §4.2 domain-tabs spec (geometry, JetBrains counts, sessionStorage persistence, gold-active-for-both note — "Correct adaptation — keep it"); IMPL §7 `CoverageDomainTabs` props
- **Outputs**: `src/components/admin/CoverageDomainTabs.tsx`; `CoverageTab` in `Docs.tsx` split into `TheatersPanel` + `SchoolsPanel` (state stays in hooks; panels stay mounted so audit filters survive detail-page round-trips — IMPL §5)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: tab choice survives refetch and reload (sessionStorage); `tsc` 0; counts render from `total_aoa_venues` / `school_count`
- **Estimated effort**: Medium

#### Node: acr-6a-coverage-work
- **Type**: feature
- **Agent**: frontend-developer (Dorsaidh-mobile-ux-optimizer reviews the 44px/vertical budget)
- **Depends on**: acr-domain-tabs-split
- **Inputs**: COVERAGE §4.2 (CoverageBar sentence/segments/animation with `prefers-reduced-motion` skip, animate on mount only; WorkActions: four buttons two weights, `LAST RUN … · 2D AGO` relative age, running labels reuse `'Searching...'` and `disabled` at `opacity:0.6`); IMPL §7 props; existing `ScrapeContext` handlers (`runDiscovery`, `runScraper`, `runClassDiscovery`, dashboard setters) wired as-is
- **Outputs**: `src/components/admin/CoverageBar.tsx`, `src/components/admin/WorkActions.tsx`; `Find Schools` moves to the SCHOOLS tab's WorkActions; `View Progress` becomes `QUEUE {n} →` while a run is active
- **Loop pattern**: plan-execute-verify
- **Success criteria**: reduced-motion query verified by toggling emulation (no scaleX animation); exactly four buttons render per panel ("no fifth action button" — COVERAGE §7); all handlers fire the same context functions the old tab did (no behavioral change to the pipeline)
- **Estimated effort**: Medium

#### Node: acr-6a-tiles-audit
- **Type**: feature (test-first for diagnosis)
- **Agent**: frontend-developer + test-engineer
- **Depends on**: acr-6a-coverage-work
- **Inputs**: COVERAGE §4.1 (AuditRow anatomy; badge `<span>` exemption; meta-line precedence table; `TAP FOR WHY`, never `SWIPE`), §4.2 tiles ("Tiles are filters, not stats"; danger coloring derived from counts; `BLOCKED` opens `BlockedList`); IMPL §2 (`Diagnosis`, `AuditVenueRow`), §8 (`diagnoseVenue` precedence: aggregator → dead_site(≥2) → mistyped → no_calendar → never_curated → ok, max 3 segments); `site_profiles` (anon-readable — join `consecutive_failures` by domain client-side); PRD D-8 (`INSTITUTION_HINTS` confinement)
- **Outputs**: `src/lib/diagnosis.ts` + `src/lib/diagnosis.test.ts` (one case per `DiagnosisKind` + precedence collisions — written first); `src/components/admin/NeedsALookTiles.tsx`, `src/components/admin/AuditRow.tsx`; `useVenueAudit.ts` extended (add `blocked` filter; rows become `AuditVenueRow[]` with `diagnosis`, `consecutive_failures`, `domain`, `has_open_suggestions:false` stub until Phase 6); DG-3 scaffold `⊘` removed; `VenueAuditTable` no longer rendered (file deletion waits for acr-teardown)
- **Loop pattern**: plan-execute-verify (Loop v2)
- **Success criteria**: `npx vitest run src/lib/diagnosis.test.ts` green with frozen tests; `DEAD SITE ×n` visibly rendered for a `consecutive_failures ≥ 2` domain (seed one via `$SRK` if none live); tapping a tile filters the list and the header names the active filter in its color; 642px scroller: `scrollHeight - clientHeight === 0` at 390×844 (measured, not eyeballed); no `<table>` remains in the panel; 44px audit passes with badge `<span>`s exempt
- **Estimated effort**: Large
- **Design reference**: COVERAGE §4.1 — "The meta line is the feature"

#### Node: acr-6b-hooks
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: acr-domain-tabs-split
- **Inputs**: IMPL §4.3 hook contracts (`useClassCoverage` mirrors `useVenueCoverage`; `useSchoolAudit` mirrors `useVenueAudit` — filters `{ neverCurated, noPhoto, blocked }`); `last_curated_at` per school derived from `MAX(class_sessions.scraped_at)` client-side
- **Outputs**: `src/hooks/useClassCoverage.ts`, `src/hooks/useSchoolAudit.ts` (rows are `AuditSchoolRow[]` with `diagnoseSchool` from `diagnosis.ts`)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `tsc` 0; hooks return live values matching direct REST probes for `school_count` and per-school session counts
- **Estimated effort**: Medium

#### Node: acr-6b-panel
- **Type**: feature
- **Agent**: frontend-developer
- **Depends on**: acr-6b-hooks, acr-6a-tiles-audit
- **Inputs**: COVERAGE §4.3 in full — `DryPipelineCard` guard lives in the **panel**, not the component (`sessionCount === 0 && schoolCount > 0`, else render nothing; "this is an alarm, not a permanent header"; when sessions exist its slot is the normal stats — never both); `DisciplineBar` iterates `by_discipline` ("a re-added discipline must appear without a code change"); `ClassFieldTiles` colors derived from `count` vs `session_count` (`0`→ghost, `<session_count`→danger, parity→access); school rows: glyph ◍/▭ in hue, `SCRAPE`→labelled `CURATE`-styled action per §0.1 copy, aggregator-flagged rows show `BLOCK` and grey the glyph
- **Outputs**: `src/components/admin/DryPipelineCard.tsx`, `DisciplineBar.tsx`, `ClassFieldTiles.tsx`; `SchoolsPanel` composition with school `AuditRow`s
- **Loop pattern**: plan-execute-verify
- **Success criteria**: with `class_sessions` truncated in a scratch check the card renders and the stats do not; with one session it inverts; discipline segments render purely from the returned object (verified by temporarily injecting a fake third key in devtools — segment appears with no code change); 642px budget holds; both themes
- **Estimated effort**: Large

### Phase 5 — Provenance + detail pages (v0.27.0)

#### Node: acr-mig-overrides-suggestions **[SR]**
- **Type**: migration
- **Agent**: Frontinus-backend-architect
- **Depends on**: acr-6b-panel
- **Inputs**: COVERAGE §5.1 + §5.5 DDL verbatim; PRD D-5 (suggestions migrate here, with the tables the guard writes)
- **Outputs**: `supabase/migrations/20260823000006_field_overrides.sql` (table + `(entity_type, entity_id)` index + admin-only RLS) and `supabase/migrations/20260823000007_curator_suggestions.sql` (table + `UNIQUE(entity_type, entity_id, field_name)` + admin-only RLS + `(entity_type, entity_id, status)` index)
- **Loop pattern**: plan-execute-verify; `/security-review`
- **Success criteria**: `supabase db push` 0; anon REST probes on both tables return nothing even with seeded rows; `$ADMIN_JWT` reads succeed
- **Estimated effort**: Small

#### Node: acr-curator-guard **[SR]**
- **Type**: feature (edge) — **the ticket that can silently fail**
- **Agent**: Frontinus-backend-architect + test-engineer
- **Depends on**: acr-mig-overrides-suggestions
- **Inputs**: IMPL §6 in full (helper signatures; the write-site table; evidence-per-field rules; the documented discovery-insert exemption); grep census first: `rg "\.from\('venues'\)\.update|\.from\('schools'\)\.update|\.from\('class_sessions'\)\.upsert|\.from\('events'\)\.upsert" supabase/functions/`
- **Outputs**:
  - `supabase/functions/_shared/curator/overrides.ts` — `heldFields()`, `filterWritable()`, `fileSuggestion()` (upsert bumps `times_suggested` + `last_seen_at`, never duplicates)
  - Every guarded write site rewired to the §6 shape: venue enrichment, event scrape persistence, class extraction (v4 `strategy-agent`/`process-venue` school + session writes), geocode auto-fix, play backfill; discovery auto-insert carries the `// no guard: inserts precede any override — see ADR-0012 D-5` comment
  - `supabase/functions/_shared/curator/overrides.test.ts` — deno, hermetic stub client, written first: **hold 3 fields → run a write pass → assert the 3 columns unchanged and 3 suggestion upserts filed; re-run → `times_suggested` = 2, no duplicate rows** (integration tests 1 & the §10 re-find case)
- **Loop pattern**: plan-execute-verify (Loop v2; frozen tests); `/security-review` (edge input handling)
- **Success criteria**: `deno test supabase/functions/_shared/curator/` green; the grep census output pasted into §7 with a per-site checkmark — every hit either guarded or exemption-commented, zero unclassified; `supabase functions deploy` for each touched function exits 0; live smoke via `$SRK`: seed an override on a test venue's `venue_type`, curl the venue through `event-scrape-batch`, then REST-read the column (unchanged) and `curator_suggestions` (row exists)
- **Estimated effort**: Large
- **Design reference**: IMPL §6 — "A single forgotten call silently breaks the promise"

#### Node: acr-mig-admin-rpcs **[SR]**
- **Type**: migration
- **Agent**: Frontinus-backend-architect
- **Depends on**: acr-curator-guard
- **Inputs**: IMPL §3.2 verbatim (`apply_field_override` full body incl. `information_schema` column whitelist and first-override `previous_value` preservation; `release_field_override` reopens `muted`; `accept_suggestion` writes + **deletes the override** + `accepted`; `dismiss_suggestion` → `muted` at `times_suggested >= 2`). `block_source`/`unblock_source` already landed in migration 2 — note the manifest deviation here, do not duplicate them.
- **Outputs**: `supabase/migrations/20260823000008_admin_rpcs.sql`
- **Loop pattern**: plan-execute-verify; `/security-review` (SECURITY DEFINER + dynamic identifiers)
- **Success criteria** (integration tests 5–8 of IMPL §10, all via REST rpc with `$ADMIN_JWT`):
  - `apply_field_override` twice on one field → `previous_value` still the curator's original
  - bogus field name → error raised, column and override both unwritten (no partial write)
  - `accept_suggestion` → column updated **and** override row gone
  - `dismiss_suggestion` ×2 → status `muted`
  - non-admin JWT → every RPC raises
- **Estimated effort**: Medium

#### Node: acr-field-registry
- **Type**: lib (test-first)
- **Agent**: frontend-developer
- **Depends on**: acr-mig-admin-rpcs
- **Inputs**: IMPL §4.4 (`VENUE_FIELDS` / `SCHOOL_FIELDS` verbatim — most-corrected-first order, consequence copy, `short_name` maxLength 14 + `THE MAP LABEL` hint; **schools render no photo attribution** — no `photo_url_source` sibling exists, "do not invent a provenance the table cannot store"); IMPL §8 `fieldState` (`0` and `false` are **values**, not empty)
- **Outputs**: `src/lib/fieldMeta.ts`, `src/lib/fieldState.ts` + `src/lib/fieldState.test.ts` (cases: `''`, `null`, `[]`, `0`, `false`, override→`held`)
- **Loop pattern**: plan-execute-verify (Loop v2)
- **Success criteria**: vitest green; `VENUE_FIELDS[3].name === 'calendar_url'` ("sits third because it decides whether anything gets curated at all" — photo occupies slot 0); `tsc` 0
- **Estimated effort**: Small

#### Node: acr-detail-pages
- **Type**: feature
- **Agent**: frontend-developer (Dorsaidh reviews save-bar/653px budget; accessibility-specialist reviews field editors)
- **Depends on**: acr-field-registry
- **Inputs**: COVERAGE §5.2–§5.4 in full (three field states with exact treatments; the `WAS {previous} · THE CURATOR WON'T CHANGE THIS AGAIN` line — "do not cut it"; `⋯ → Hand back to the curator` always offered; empty labels name the consequence; photo well with scrim controls; `short_name` live `value.length` counter reading `11/14`; `HOW PEOPLE AFFORD IT` toggle grouping with `--access` tracks; classes section incl. `+ ADD A CLASS BY HAND` seeding overrides for every given field; lat/lng single row with `geocode_source` chip); IMPL §5 (routes inside the authed branch, admin-guarded like `Header.tsx`; **no bottom nav** on detail pages — save bar instead; `navigate(-1)` with filters surviving because panels stay mounted; `useBeforeUnload` + prompt on `dirtyCount > 0`); IMPL §4.3 `useEntityDetail` contract (staged `edits`, `save()` = one `apply_field_override` per dirty field then `invalidateAfterOverride`); PRD D-7 (photo replace sets `photo_url_source='manual'`)
- **Outputs**: `src/App.tsx` routes `admin/venue/:id` + `admin/school/:id`; `src/pages/AdminVenueDetail.tsx`, `src/pages/AdminSchoolDetail.tsx`; `src/components/admin/AdminField.tsx`, `ProvenanceStrip.tsx`; `src/hooks/useEntityDetail.ts`, `useFieldOverrides.ts`; `AuditRow` `onOpen` navigates here
- **Loop pattern**: plan-execute-verify
- **Success criteria**: save on a `venue_type` edit updates the column **and** creates the override (REST-verified), row flips to `⊙ YOURS` with the `WAS …` line; release deletes the override and the row reverts; `Save {n} changes` count is literal and disabled at 0; navigating away dirty prompts; back restores the exact audit filter; 653px scroller holds; 44px audit passes (provenance chips `<span>`-exempt); both themes; school photo shows no attribution line
- **Estimated effort**: Large
- **Design reference**: COVERAGE §5.1 — "This is the whole feature"

### Phase 6 — When the curator disagrees (v0.28.0)

#### Node: acr-suggestions-ui
- **Type**: feature (test-first for `preferSuggestion`)
- **Agent**: frontend-developer
- **Depends on**: acr-detail-pages, acr-curator-guard
- **Inputs**: COVERAGE §5.5 (header reassurance copy verbatim — "Nothing was changed — your versions are still live"; two-half note blocks; evidence lines; `KEEPING YOURS TWICE STOPS IT ASKING.` footnote; `Keep everything I wrote` bulk dismiss; provenance-strip `· 2 NOTES` entry; audit meta gains `CURATOR HAS NOTES`); IMPL §8 `preferSuggestion` rules (events_found beats current → true; confidence < 0.75 → false; `times_suggested >= 3` → true; default false; **both buttons always ≥44px — the recommendation is a default, never a lock**)
- **Outputs**: `src/lib/suggestions.ts` + `src/lib/suggestions.test.ts` (each rule + ambiguous default, written first); `src/components/admin/SuggestionCard.tsx`; `src/hooks/useCuratorSuggestions.ts`; `has_open_suggestions` wired for real in both audit hooks
- **Loop pattern**: plan-execute-verify (Loop v2)
- **Success criteria**: vitest green; TAKE THEIRS → column updated + override deleted (REST-verified via `accept_suggestion`); KEEP MINE ×2 → muted and the card stops appearing; filled-button choice demonstrably derives from evidence, not props
- **Estimated effort**: Medium

### Phase 7 — Copy + teardown (v0.28.1)

#### Node: acr-copy-sweep
- **Type**: copy (presentation layer only)
- **Agent**: frontend-developer (Theia-branding reviews tone)
- **Depends on**: acr-suggestions-ui
- **Inputs**: COVERAGE §0.1 swap table; IMPL §9 scope discipline (strings only — `ScrapeContext`, `scrape_jobs`, `scraped_at`, `ScraperDashboard`, `AdminScrapeRibbon`, edge functions untouched); date rendering rule (`CURATED {MON D}` / `NEVER CURATED` in danger — never sentence-case `Never`, never an empty cell)
- **Outputs**: string-level sweep across the admin surface
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `rg -i 'scrap' src/ --glob '!*.test.*'` returns only identifiers — zero string literals that reach the screen (paste the output into §7); `git diff` shows no identifier renames
- **Estimated effort**: Small

#### Node: acr-teardown
- **Type**: cleanup
- **Agent**: frontend-developer
- **Depends on**: acr-copy-sweep
- **Outputs**: delete `src/components/admin/CoverageMetricsCards.tsx` and `src/components/admin/VenueAuditTable.tsx`
- **Loop pattern**: one-shot
- **Success criteria**: `rg "CoverageMetricsCards|VenueAuditTable" src/` empty **before** deletion; `npx tsc --noEmit` 0 after; `npm run build` 0
- **Estimated effort**: Trivial

### Phase 8 — Documentation closure

#### Node: acr-docs-qa
- **Type**: docs
- **Agent**: technical-writer
- **Depends on**: acr-teardown
- **Outputs**: `docs/features/admin-coverage.md` NEW (what the admin can now do, in user terms); CLAUDE.md — Key Files rows for the detail pages, `curator/overrides.ts`, `blocklist.ts`; Database paragraph gains `blocked_sources`, `field_overrides`, `curator_suggestions`; ADR-0012 status flipped to Accepted; PRD deviation notes appended if §7 recorded any; roadmap status updated; `.claude/runbooks/deployment-workflow.md` gains two Wrong/Right/Why entries — (1) *RLS filters that subquery an admin-only table silently no-op for anon; wrap in a SECURITY DEFINER helper and probe as anon before shipping* and (2) *a new curator write site must call `heldFields()` — grep the write-site census in `docs/graphs/admin-coverage-redesign.md` §7 before adding one*; run every checkbox in `docs/qa/admin-coverage-redesign.md`
- **Loop pattern**: one-shot
- **Success criteria**: `/docs-check` reports clean; QA doc fully ticked or exceptions filed in §7
- **Estimated effort**: Small

---

## Section 3: Loop Specifications (deltas from the shared template)

**Loop: acr-mig-read-filters** — Verify stage must run the anon probes *with a seeded block present*, then unseed. Evaluator = the four curl probes; a probe returning the blocked row is a hard fail even if `db push` succeeded (this is exactly the silent-failure the definer helper exists to prevent). Retry max 2, then `/escalate` with the policy SQL and probe transcript.

**Loop: acr-curator-guard** — Discover stage is the grep census; Plan lists every hit with guarded/exempt classification and gets author eyes before Execute. Tests (the hold-3 fixture) commit failing first and are frozen. Fresh-context Argus verify additionally re-runs the census and diffs it against the classification table — an unclassified write site is an automatic fail.

**Loop: acr-blocklist-lib ⇄ acr-mig-blocked-sources parity** — the fixture file is shared state: after either side changes, `node scripts/parity/normalize-domain.mjs` is the single evaluator; a mismatch is fixed in whichever side diverged from COVERAGE §2.1's five rules, never by editing the fixture to match.

**Loop: acr-detail-pages** — Verify includes the layout-budget command (`scrollHeight - clientHeight`) and the 44px query from IMPL §10 run in the console at 390×844, both themes; screenshots attach to §7.

All loops append to `docs/graphs/attempts.jsonl` (`{ts, node, gate, result}`); the 3-cycle budget is enforced by counting that file, not by memory.

---

## Section 4: Semver & Changelog (per `.claude/rules/versioning.md`)

Every tranche push bumps and prepends a `PatchNote` to `src/data/changelog.ts`; `/cap` Phase 1.5 enforces. Drafts:

| Ver | Type | title | summary | details (draft bullets) |
|-----|------|-------|---------|--------|
| 0.23.1 | patch | Class coverage counts the right table | The admin class metrics RPC now reads `class_sessions`, so the schools tab stops reporting 0 after successful runs. | Fix: `get_class_coverage_metrics` rewritten against `class_sessions` (was counting legacy `events` rows post-F70) · Fix: coverage tab reads the new keys |
| 0.24.0 | minor | Block a source — and the curator respects it | Admins can block a venue or school by domain or entry; blocked sources vanish from the app and are rejected by every future discovery run. | New: `blocked_sources` with domain/entry scope and reasons · New: block sheet with real consequence counts and one-tap unblock from BLOCKED (n) · New: enforcement at discovery insert, curation target selection, and all public read paths · New: `blocked_admin` discovery-log disposition |
| 0.25.0 | minor | Theatre only: disciplines narrowed | Schools are improv or acting for now; the four other hues are reserved for re-adding later. | Change: `discipline` CHECK narrowed with reassignment · Removed: dropped disciplines from markers, chips, key, and types (hues kept as reserved) |
| 0.26.0 | minor | The Coverage tab, reorganised around the work | Theaters and schools split into two panels with a coverage bar, four-button work block, filter tiles, diagnostic audit rows, and a dry-pipeline alarm. | New: THEATERS/SCHOOLS tabs, CoverageBar, WorkActions, NeedsALookTiles, AuditRow with composed diagnosis (surfaces `DEAD SITE ×n`) · New: DryPipelineCard, DisciplineBar, ClassFieldTiles · New: `blocked_count` + explicit missing-calendar/photo metrics |
| 0.27.0 | minor | Edit anything — and the curator won't take it back | Field-level admin edits with provenance: your value stays yours, per field, with a visible `WAS …` line and a hand-back. | New: `field_overrides` + atomic `apply_field_override` · New: curator guard at every write site — held fields are parked as suggestions, never overwritten · New: `/app/admin/venue/:id` and `/app/admin/school/:id` detail pages with three-state fields and a save bar |
| 0.28.0 | minor | The curator can disagree — out loud | When the curator finds a different value for a field you hold, it files a note with evidence instead of changing anything. | New: `curator_suggestions` with evidence-driven defaults (TAKE THEIRS / KEEP MINE) · New: mute after two dismissals · New: NOTES entry on the provenance strip and audit rows |
| 0.28.1 | patch | The curator speaks like a curator | User-facing scrape language becomes curate/curation; internal identifiers untouched. | Change: presentation-layer copy sweep per the swap table · Removed: `CoverageMetricsCards`, `VenueAuditTable` |

**Expected /cap groupings** follow the standing rules: `chore(build): bump …` first and separate; migrations + edge changes as `feat(admin)` / `feat(curator)` / `fix(admin)`; docs commits separate (`docs(prd)`, `docs(adr)`, `docs(graphs)`, `docs(qa)`, `docs(features)`); this graph's File Index feeds `/cap` Phase 1.6 — tick nodes as their files land, log out-of-node changes to §7 Deviations.

## Section 5: Documentation Surface (per `/docs-check` mapping — stated explicitly)

CLAUDE.md (Key Files + Database, at acr-docs-qa) · Feature doc **NEW** `docs/features/admin-coverage.md` · Design docs: handoff bundle lands under `docs/design/v4/design_handoff_house_record/` (no separate design doc — the handoff is it) · ADR **NEW** `docs/adr/0012-…` · PRD **NEW** `.claude/docs/prd/admin-coverage-redesign.md` (+ deviation appendix if any) · QA **NEW** `docs/qa/admin-coverage-redesign.md` · Graph **NEW** (this file) · Runbook: two entries into `.claude/runbooks/deployment-workflow.md` · Roadmap status update. **No CSS-only or test-only exemptions apply — this is a full-stack feature.**

## Section 6: Tooling Gaps & Ripple Candidates (protocol §6)

- **Gap — TS↔SQL parity has no harness.** This spec adds `scripts/parity/normalize-domain.mjs` (fixture-driven REST diff). No hook needed — it runs inside two nodes' evaluators. **Promote candidate** after soak: any sibling with a mirrored TS/SQL helper wants this shape.
- **Gap — hermetic edge tests need a stub Supabase client.** `acr-curator-blocklist-guard` and `acr-curator-guard` introduce an in-memory stub in the fixture style of `scraper/fixtures.test.ts`; if it grows past those two files, extract to `supabase/functions/_shared/testing/stub-client.ts` and flag for `/promote-hook`.
- **Covered, not gaps:** RLS blast-radius review is `/security-review` (mandatory on the four [SR] nodes); spec↔code drift is `/cap` Phase 1.6 via the File Index; no new hooks or lifecycle events required.
- **Ripple candidate:** the field-provenance pattern (`field_overrides` + guard + suggestions) is sibling-valuable for any app with a pipeline writing over admin-curated data — note for `/mind-meld` / `/promote` after it soaks here.

## Section 7: Execution Notes

### Decision Gate Answers (2026-08-21)

**DG-1 — `is_admin()` allowlist:** `ARRAY['deric.o.ortiz@gmail.com']`. One email. The client-side `ADMINS = ['darklight','matti']` in `src/lib/constants.ts` is unchanged (client-side gating for Header/AdminScrapeRibbon).

**DG-2 — Migration stamp safety:** `ls supabase/migrations | tail -1` = `20260822000005_discovery_v2_cleanup.sql`. All eight stamps `20260823000001–8` are clear. ADR `ls docs/adr | tail -1` = `0011` (if it existed) — `0012` is clear.

**DG-3 — Scaffold block entry point:** Accepted. Temporary `⊘` on `VenueAuditTable` rows ships in Phase 2 (`acr-block-ui`), removed by `acr-6a-tiles-audit` in Phase 4.

*(Executor appends below: write-site census table, copy-sweep grep output, screenshots refs, deviations, attempts summaries.)*

---

## File Index

| File | Node | Action |
|------|------|--------|
| `docs/design/v4/design_handoff_house_record/ADMIN-COVERAGE.md` (+ IMPL, Admin html, shared) | acr-handoff-landing | Create/Overwrite |
| `supabase/migrations/20260823000001_fix_class_coverage_rpc.sql` | acr-class-rpc-fix | Create |
| `supabase/functions/_shared/scraper/types.ts` | acr-class-rpc-fix, acr-mig-venue-metrics | Modify |
| `src/pages/Docs.tsx` | acr-class-rpc-fix, acr-domain-tabs-split | Modify |
| `src/lib/__fixtures__/domains.json` | acr-blocklist-lib | Create |
| `src/lib/blocklist.ts` / `blocklist.test.ts` | acr-blocklist-lib | Create |
| `supabase/migrations/20260823000002_blocked_sources.sql` | acr-mig-blocked-sources | Create |
| `scripts/parity/normalize-domain.mjs` | acr-mig-blocked-sources | Create |
| `supabase/functions/_shared/curator/blocklist.ts` / `.test.ts` | acr-curator-blocklist-guard | Create |
| `supabase/functions/class-discovery/index.ts` | acr-curator-blocklist-guard | Modify |
| `supabase/functions/venue-discovery/index.ts` | acr-curator-blocklist-guard | Modify |
| `supabase/functions/event-scrape-batch/index.ts` | acr-curator-blocklist-guard, acr-curator-guard | Modify |
| `supabase/functions/class-scrape-batch/index.ts` | acr-curator-blocklist-guard, acr-curator-guard | Modify |
| `supabase/migrations/20260823000003_blocklist_read_filters.sql` | acr-mig-read-filters | Create |
| `src/lib/adminInvalidation.ts` | acr-block-ui | Create |
| `src/lib/queryKeys.ts` | acr-block-ui | Modify |
| `src/hooks/useBlockSource.ts` / `useBlockedSources.ts` | acr-block-ui | Create |
| `src/components/admin/BlockSheet.tsx` / `BlockedList.tsx` | acr-block-ui | Create |
| `src/components/admin/VenueAuditTable.tsx` | acr-block-ui (scaffold), acr-teardown | Modify → Delete |
| `supabase/migrations/20260823000004_theatre_only_disciplines.sql` | acr-mig-disciplines | Create |
| `src/lib/types.ts` | acr-class-rpc-fix, acr-mig-disciplines, acr-block-ui, acr-field-registry | Modify |
| `src/components/ClassMarker.ts`, `src/components/MapKey.tsx` | acr-mig-disciplines | Modify |
| `supabase/migrations/20260823000005_venue_coverage_additions.sql` | acr-mig-venue-metrics | Create |
| `src/styles/tokens.css` | acr-tokens-access-bg | Modify |
| `src/components/admin/CoverageDomainTabs.tsx` | acr-domain-tabs-split | Create |
| `src/components/admin/CoverageBar.tsx` / `WorkActions.tsx` | acr-6a-coverage-work | Create |
| `src/lib/diagnosis.ts` / `diagnosis.test.ts` | acr-6a-tiles-audit | Create |
| `src/components/admin/NeedsALookTiles.tsx` / `AuditRow.tsx` | acr-6a-tiles-audit | Create |
| `src/hooks/useVenueAudit.ts` | acr-6a-tiles-audit, acr-suggestions-ui | Modify |
| `src/hooks/useClassCoverage.ts` / `useSchoolAudit.ts` | acr-6b-hooks | Create |
| `src/components/admin/DryPipelineCard.tsx` / `DisciplineBar.tsx` / `ClassFieldTiles.tsx` | acr-6b-panel | Create |
| `supabase/migrations/20260823000006_field_overrides.sql` | acr-mig-overrides-suggestions | Create |
| `supabase/migrations/20260823000007_curator_suggestions.sql` | acr-mig-overrides-suggestions | Create |
| `supabase/functions/_shared/curator/overrides.ts` / `.test.ts` | acr-curator-guard | Create |
| `supabase/functions/_shared/scraper/strategy-agent.ts`, `process-venue.ts` (+ geocode, play-backfill sites per census) | acr-curator-guard | Modify |
| `supabase/migrations/20260823000008_admin_rpcs.sql` | acr-mig-admin-rpcs | Create |
| `src/lib/fieldMeta.ts` / `fieldState.ts` / `fieldState.test.ts` | acr-field-registry | Create |
| `src/App.tsx` | acr-detail-pages | Modify |
| `src/pages/AdminVenueDetail.tsx` / `AdminSchoolDetail.tsx` | acr-detail-pages | Create |
| `src/components/admin/AdminField.tsx` / `ProvenanceStrip.tsx` | acr-detail-pages | Create |
| `src/hooks/useEntityDetail.ts` / `useFieldOverrides.ts` | acr-detail-pages | Create |
| `src/lib/suggestions.ts` / `suggestions.test.ts` | acr-suggestions-ui | Create |
| `src/components/admin/SuggestionCard.tsx` | acr-suggestions-ui | Create |
| `src/hooks/useCuratorSuggestions.ts` | acr-suggestions-ui | Create |
| `src/components/admin/CoverageMetricsCards.tsx` | acr-teardown | Delete |
| `src/data/changelog.ts`, `package.json` | every tranche | Modify |
| `docs/features/admin-coverage.md`, `CLAUDE.md`, `.claude/runbooks/deployment-workflow.md` | acr-docs-qa | Create/Modify |
