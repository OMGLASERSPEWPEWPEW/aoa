# Graph: Cost Truth + Admin Coverage Remediation (F91)

**Date:** 2026-08-21 · **Status:** Ready for execution
**PRD:** `.claude/docs/prd/cost-truth-and-admin-fixes.md` (findings C-1..C-5, A-1..A-8 — binding)
**ADR:** `docs/adr/0013-ai-cost-ledger-of-record.md` · amends `docs/adr/0012-blocklist-and-field-provenance.md` D-2
**QA:** `docs/qa/cost-truth-and-admin-fixes.md`
**Prior graph:** `docs/graphs/admin-coverage-redesign.md` (its §7 Execution Notes are the ground truth for what shipped)

---

## Section 0: Execution Contract

- **Skills:** `/new-feature` Execute discipline per node; `/create-tests` for test-first nodes; `/security-review` on nodes tagged **[SR]**; `/docs-check` before each phase's push; **all commits via `/cap`** (never manual git); `/rs` for dev server; `/escalate` if a node's loop exceeds budget.
- **Hooks in force:** `pre-push-gate.sh` (tsc + vitest + deno must pass; `SKIP_GATE=1` is logged and forbidden here), `git-push-confirm.sh`, `status-digest.sh`.
- **Loop v2 (ADR-0011):** executable evaluators only; test-first nodes commit frozen tests before implementation; fresh-context Argus verifies each node; attempts logged to `docs/graphs/attempts.jsonl`; 3-cycle budget per node then `/escalate`.
- **Env for evaluators:** `$SB` = Supabase URL, `$ANON` = anon key, `$SRK` = service-role key, `$ADMIN_JWT` = a signed-in admin access token. REST probes use `curl -H "apikey: $ANON"` (or `$SRK`) as noted. Supabase MCP is read-only — writes go through migrations/RPCs/curl.
- **Deploy reality (C-5):** Vercel auto-deploy is broken for this repo. Every phase close runs `vercel --prod` explicitly and re-verifies against the deployed build before QA sign-off.
- **Copy vocabulary:** user-facing strings say *curate/curation/the curator* (COVERAGE §0.1). Internal identifiers stay.

### Decision Gates — answer in §7 before Phase A code

- **DG-1 (stamps/version):** confirm `package.json` = `0.27.0` and migrations `20260823000010+` are unclaimed (`ls supabase/migrations | tail`). If drifted, renumber here and in the File Index.
- **DG-2 (single-target curation):** approve adding `{ venue_id }` targeting to `class-scrape-batch` (required for per-row school CURATE, FR-12). Also approve/decline the same param on `event-scrape-batch` for the venue ↻ action — decline defers ↻ with a documented gap, it does not block the phase.
- **DG-3 (Jina pricing):** if the `JINA_API_KEY` tier is paid, supply a per-request USD price to record as `provider:'jina'` rows; otherwise Jina stays unpriced (out of scope).

---

## Section 1: DAG

```
Phase 0   ctf-decision-gates
Phase A   ctf-cost-choke-point ─→ ctf-v4-usage-wiring ─→ ┐
          ctf-dashboard-row-shape ───────────────────────┼─→ ctf-cost-close (v0.28.0)
          ctf-v3-cost-columns ───────────────────────────┘
Phase B   ctf-audit-real-rows ─→ ctf-6a-wire ────────────┐
          ctf-diagnosis-rule ──────────────┐             │
          ctf-school-block-fix ─→ ctf-blocklist-uniqueness [SR]
          ctf-6b-to-spec ── ctf-single-target-curate ────┼─→ ctf-remediation-close (v0.29.0)
```

Phase A and Phase B are independent; run A first (the user's priority) but B may start in parallel after Phase 0.

---

## Section 2: Node Specifications

### Phase 0

#### Node: ctf-decision-gates
- **Type**: gate · **Agent**: main context, with author
- **Outputs**: DG-1..DG-3 answers appended to §7
- **Success criteria**: §7 contains all three answers before any Phase-A file is written
- **Estimated effort**: Trivial

---

### Phase A — Cost Truth (v0.28.0)

#### Node: ctf-cost-choke-point
- **Type**: feature (test-first) · **Agent**: Frontinus-backend-architect + test-engineer
- **Depends on**: ctf-decision-gates
- **Inputs**: ADR-0013 §Decision 2; `supabase/functions/_shared/scraper/cost-budget.ts`; `_shared/logUsage.ts` (`MODEL_PRICING`, currently module-private)
- **Outputs**:
  - `_shared/logUsage.ts` — `export const MODEL_PRICING` (values unchanged; `estimateCost` keeps using it)
  - `_shared/scraper/cost-budget.ts` — `recordAiCall(inputTokens, outputTokens, model = "deepseek-v4-flash")` prices via imported `MODEL_PRICING` (fallback: current Flash constants); new private `_inputTokens`/`_outputTokens` accumulators with getters; `toJSON()` gains `inputTokens`/`outputTokens`; `attachUsageSink(sink: (u: { model: string; inputTokens: number; outputTokens: number; costUsd: number }) => void | Promise<void>)` — invoked inside `recordAiCall`, wrapped `void Promise.resolve(...).catch(() => {})`
  - `_shared/scraper/cost-budget.test.ts` — **written first, frozen**: gpt-4o-mini call of (1M in, 1M out) → `spent` ≈ 0.75; deepseek-chat priced per map; omitted model = current Flash behavior (regression pin); sink receives per-call `{model, tokens, costUsd}` and a throwing sink does not throw out of `recordAiCall`; token sums accumulate across calls; `fromResumable` still constrains by `CLASS_INVOCATION_CAPS`
- **Loop pattern**: plan-execute-verify (Loop v2, deno tests first)
- **Success criteria**: `deno test supabase/functions/_shared/scraper/cost-budget.test.ts` green with frozen tests; `rg "MODEL_PRICING" supabase/functions/_shared -l` shows exactly `logUsage.ts` (definition) + `cost-budget.ts` (import) + `ai-gateway/index.ts` (its own map is out of scope — leave); `deno check` on both files exits 0
- **Estimated effort**: Medium
- **Design reference**: ADR-0013 D-2; PRD FR-1

#### Node: ctf-v4-usage-wiring
- **Type**: feature · **Agent**: Frontinus-backend-architect
- **Depends on**: ctf-cost-choke-point
- **Inputs**: ADR-0013 §Decision 3–4; `strategy-agent.ts` (`executeClassStrategy`, `extractClassPrograms`, `getClassAiConfig`); `link-extractor.ts` (`scoreLinksLLM`); the v4 page classifier if it makes AI calls
- **Outputs**:
  - `strategy-agent.ts` — `executeClassStrategy` attaches the sink right after constructing `budget`: `logUsage(sb, { userId: null, model: u.model, provider: providerFor(u.model), feature: 'class-curation', inputTokens: u.inputTokens, outputTokens: u.outputTokens, estimatedCostUsd: u.costUsd, metadata: { venue_id: venue.id, venue_name: venue.name, invocation: state.invocation_count + 1 } })`; small `providerFor(model)` helper (`gpt-*` → `openai`, `deepseek-*` → `deepseek`, else `unknown`) in `cost-budget.ts` or `logUsage.ts`
  - Every v4 `recordAiCall(...)` call threads the real model (`ai.model` is in scope at both known sites); `scoreLinksLLM` gains the model from its own `getClassAiConfig`/config path
  - **Census table appended to §7**: `rg -n "recordAiCall\(" supabase/functions/` — one row per site: file:line, path (v3/v4), model threaded ✓/n-a, sink coverage (v4=sink, v3=per-step logUsage). Any uncovered site is a loop failure, not a footnote.
  - Deploy every function that bundles `strategy-agent.ts` or `cost-budget.ts` (expected: `class-scrape-batch`, `event-scrape-batch`, `event-scraper`, `class-discovery` — confirm via `rg -l "strategy-agent" supabase/functions`)
- **Loop pattern**: plan-execute-verify
- **Success criteria** (executable):
  - `supabase functions deploy <census list>` exit 0
  - Trigger one single-school curation (after DG-2 lands use `venue_id`; before it, a normal run): `curl -X POST $SB/functions/v1/class-scrape-batch -H "x-scraper-key: $SCRAPER_SECRET" -d '{"action":"start"}'` → then `curl "$SB/rest/v1/ai_usage?feature=eq.class-curation&order=created_at.desc&limit=5" -H "apikey: $SRK" -H "Authorization: Bearer $SRK"` returns ≥1 row with `model` ∈ {gpt-4o-mini, deepseek-chat}, `estimated_cost_usd > 0`, `metadata->>'venue_id'` set
  - `curl -X POST "$SB/rest/v1/rpc/get_ai_cost_by_feature" -H "apikey: $ANON" -H "Authorization: Bearer $ADMIN_JWT" -d '{"p_days":1}'` includes a `class-curation` row
  - No double counting: `get_ai_cost_by_feature` shows `event-scraper-*` rows unchanged in mechanism (v3 untouched — `rg "attachUsageSink" supabase/functions/_shared/scraper/process-venue.ts` returns 0)
- **Estimated effort**: Medium
- **Design reference**: ADR-0013; PRD FR-1

#### Node: ctf-dashboard-row-shape
- **Type**: feature (test-first) · **Agent**: Frontinus-backend-architect
- **Depends on**: ctf-cost-choke-point (uses token sums for `durationMs` sanity only — may run in parallel if careful)
- **Inputs**: PRD D-2/FR-2; `class-scrape-batch/index.ts` entry builder; `ScrapeContext.tsx` `RecentSchoolEntry` (the contract: nested `trace`); `ClassDiscoveryDashboard.tsx` (reader — unchanged)
- **Outputs**:
  - `class-scrape-batch/index.ts` — extract a pure `buildRecentSchoolEntry(school, status, prevEntry, result, counts)` returning `{ name, venueId, status, invocations, eventsFound, eventsCreated, address, calendarUrl, timestamp, trace: result ? { stopReason: t.stopReason ?? null, aiCalls: t.totalAiCalls ?? null, fetches: t.totalFetches ?? null, durationMs: t.wallMs ?? 0, costUsd: t.budgetUsed ?? null, programsExtracted: result.programs?.length ?? null, modelResults: null } : null }`; flat `costUsd`/`pagesVisited`/`stopReason`/`completeness` keys removed
  - `supabase/functions/class-scrape-batch/entry.test.ts` — **frozen first**: builder emits the nested shape; `invocations` increments from a previous entry; `trace:null` when the strategy crashed
- **Loop pattern**: plan-execute-verify (Loop v2)
- **Success criteria**: `deno test .../entry.test.ts` green; after one run, `curl "$SB/rest/v1/scrape_jobs?job_type=eq.class&order=created_at.desc&limit=1&select=recent_schools" -H "apikey: $SRK" -H "Authorization: Bearer $SRK" | jq '.[0].recent_schools[0].trace.costUsd'` is a number; `npx tsc --noEmit` 0 (client contract untouched)
- **Estimated effort**: Small
- **Design reference**: FR-2; `RecentSchoolEntry` is the contract of record

#### Node: ctf-v3-cost-columns
- **Type**: feature · **Agent**: Frontinus-backend-architect
- **Depends on**: ctf-decision-gates
- **Inputs**: PRD FR-3/C-4; `_shared/scraper/process-venue.ts` (scrape_logs insert), `event-scraper/index.ts` (duplicate local `processVenue`), `event-scrape-batch/index.ts` (imports decide which is live)
- **Outputs**: The **live** insert gains `cost_usd: trace.budgetUsed`, `fetches: trace.totalFetches`, `pages_visited: trace.linksFollowed.length + 1`. Liveness determined by `rg -n "process-venue|processVenue" supabase/functions/event-scrape-batch supabase/functions/event-scraper`; if `event-scraper/index.ts`'s local copy is unreferenced by any route the app calls, prepend `// LEGACY: superseded by _shared/scraper/process-venue.ts — do not extend` (no deletion this pass); if it IS live, patch both.
- **Loop pattern**: plan-execute-verify
- **Success criteria**: after one venue scrape via the Run/Curate button, `curl "$SB/rest/v1/scrape_logs?order=created_at.desc&limit=1&select=cost_usd,fetches,pages_visited,venue_name" -H "apikey: $SRK" -H "Authorization: Bearer $SRK"` → `cost_usd` non-null; `rg "cost_usd" supabase/functions/_shared/scraper/process-venue.ts` ≥ 1
- **Estimated effort**: Small

#### Node: ctf-cost-close
- **Type**: release · **Agent**: git-manager + technical-writer
- **Depends on**: ctf-v4-usage-wiring, ctf-dashboard-row-shape, ctf-v3-cost-columns
- **Outputs**: `package.json` → `0.28.0`; changelog entry (§4); `/docs-check` surface for Phase A (§5); `vercel --prod`; QA §A executed against the deployed build; §7 attempts summary
- **Success criteria**: pre-push gate green; deployed header shows `v0.28.0`; QA §A all checked
- **Estimated effort**: Small

---

### Phase B — Admin Coverage Remediation (v0.29.0)

#### Node: ctf-audit-real-rows
- **Type**: fix · **Agent**: frontend-developer
- **Depends on**: ctf-decision-gates
- **Inputs**: PRD FR-5/A-1; `Docs.tsx` theaters `AuditRow` map; `useVenueAudit` (already returns full `AuditVenueRow[]`)
- **Outputs**: theaters panel passes `row={v}` (plus the `onOpen`/`onBlock`/`onCurate` handlers per current `AuditRow` props); the inline `diagnosis: { kind: 'ok' … }`, `domain: null`, `has_open_suggestions: false` construction deleted; school panel likewise passes the hook's `AuditSchoolRow` unmodified if it currently re-shapes
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `rg "kind: 'ok'" src/pages/Docs.tsx` → 0; `rg "diagnosis:\s*\{" src/pages/Docs.tsx` → 0; `npx tsc --noEmit` 0; runtime probe — seed `site_profiles.consecutive_failures = 3` for one live venue's domain via `$SRK` PATCH, reload `/app/admin` → its row's meta contains `DEAD SITE ×3` (DOM check; also QA §B)
- **Estimated effort**: Small
- **Design reference**: COVERAGE §4.1 — "The meta line is the feature"

#### Node: ctf-diagnosis-rule
- **Type**: fix (test-first; spec-change per PRD D-4) · **Agent**: test-engineer + frontend-developer
- **Depends on**: ctf-decision-gates (parallel with ctf-audit-real-rows)
- **Inputs**: PRD FR-10/A-6; `src/lib/diagnosis.ts` + `diagnosis.test.ts`; COVERAGE §4.1 mistyped row (`storefront` + `event_count=0` + institution name → `MISTYPED · SHOULD BE INSTITUTIONAL`); `AuditRow.tsx` (find where `TYPE · HOOD`/source render today)
- **Outputs**:
  - `diagnosis.test.ts` — rewritten **first** and frozen: mistyped positive now requires `venue_type:'storefront'` **and** `event_count: 0`; two new negatives (institutional-typed "Columbia College…" → not mistyped; storefront college name with `event_count: 5` → not mistyped); label assertion `MISTYPED · SHOULD BE INSTITUTIONAL`; all prior non-mistyped cases preserved verbatim
  - `diagnosis.ts` — rule + label updated; **one composer**: if `AuditRow` already renders `TYPE · HOOD`/source itself, `diagnosis.label` stays problem-only (document with a comment naming the renderer); if not, prepend them here and strip from the component — never both
- **Loop pattern**: plan-execute-verify (Loop v2)
- **Success criteria**: `npx vitest run src/lib/diagnosis.test.ts` green with frozen tests; `rg "SHOULD BE INSTITUTIONAL" src/lib/diagnosis.ts` = 1; grep proves single composition (`rg "venue_type" src/components/admin/AuditRow.tsx src/lib/diagnosis.ts` shows the lead segments in exactly one file)
- **Estimated effort**: Small

#### Node: ctf-6a-wire
- **Type**: feature · **Agent**: frontend-developer (Dorsaidh-mobile-ux-optimizer reviews budget/44px)
- **Depends on**: ctf-audit-real-rows
- **Inputs**: PRD FR-6/A-2; COVERAGE §4.2 (WorkActions geometry/copy, tiles-as-filters, list header, blocked tile → BlockedList); IMPL §7 props; existing `WorkActions.tsx`, `NeedsALookTiles.tsx`; `useVenueCoverage` (migration-5 fields `blocked_count`, `venues_missing_calendar`, `venues_missing_photo`); `useBlockedSources` count
- **Outputs**, all in `src/pages/Docs.tsx` unless noted:
  - Mount `WorkActions` in the theaters panel with **exact handler parity**: `onFind → runDiscovery`, `onCurate → runScraper`, `onBackfill → existing play-backfill handler`, `onQueue → setDashboardOpen(true)`; `running` derived from the same phase flags the old buttons used; labels post-copy-sweep (`Find venues`, `Curate shows`, `PLAY BACKFILL {unlinkedCount}`, `QUEUE {n} →`)
  - Mount a schools-panel `WorkActions`: `onFind → existing school-discovery handler`, `onCurate → runClassDiscovery`, `onQueue → setClassDashboardOpen(true)`, backfill slot hidden or repurposed per component contract
  - Mount `NeedsALookTiles` fed by `venues_zero_events / venues_missing_calendar / venues_missing_photo / blocked_count`; taps toggle the matching `useVenueAudit` filter; `BLOCKED` opens `BlockedList`; severity derived from counts
  - **Delete**: the old five-button block, the scaffold `BLOCKED (n)` button, the legacy inline `CLASS COVERAGE` 4-stat row, and the duplicate inline `classMetrics` `useState`/effect/RPC call (the schools panel's `useClassCoverage` is the sole consumer)
  - List headers: `{n} VENUES · {ACTIVE FILTER || 'ALL'}` in the filter's color + `TAP FOR WHY` right (`var(--ink-ghost)`); schools: `{n} SCHOOLS · NEVER CURATED` from `schools_never_curated` when that filter is on; remove both `.slice(0, 30)` caps
- **Loop pattern**: plan-execute-verify
- **Success criteria** (executable + QA):
  - Grep gates: `rg "classMetrics" src/pages/Docs.tsx` → 0; `rg "SCAFFOLD" src/pages/Docs.tsx` → 0; `rg "slice\(0, ?30\)" src/pages/Docs.tsx` → 0; `rg "<WorkActions" src/pages/Docs.tsx` = 2; `rg "<NeedsALookTiles" src/pages/Docs.tsx` = 1
  - Handler parity: `rg -c "runDiscovery|runScraper|runClassDiscovery" src/pages/Docs.tsx` unchanged vs. pre-node count (same context functions, new mounts)
  - `npx tsc --noEmit` 0; QA §B: exactly four ≥44px work buttons per panel, tiles filter the list, 642px scroller re-measured (`scrollHeight - clientHeight === 0` at 390×844)
- **Estimated effort**: Large
- **Design reference**: COVERAGE §4.2; acceptance "no fifth action button", "Tiles are filters, not stats"

#### Node: ctf-school-block-fix
- **Type**: fix · **Agent**: frontend-developer + Frontinus-backend-architect
- **Depends on**: ctf-decision-gates
- **Inputs**: PRD FR-7/FR-9/A-3/A-5; `Docs.tsx` (`blockTarget` state + both `onBlock` sites + `BlockSheet` target construction); `BlockSheet.tsx` consequence block; `useBlockSource`; `is_source_blocked` (for the leak probe)
- **Outputs**:
  - `Docs.tsx` — `blockTarget` becomes a typed union carrying `entityType`; school rows set `{ entityType:'school', id: s.id, name: s.name, url: s.url, affectedClasses: s.session_count, affectedEvents: 0 }`; the `BlockSheet` target and the `block(...)` request both use `blockTarget.entityType` (no hardcoded `'venue'` anywhere in the flow)
  - `BlockSheet.tsx` — `affectedLabel` says `classes` for schools; consequence **always** renders `, drops {n} {label}` including `0` (A-5)
  - **Leak probe (decides a sub-fix):** with one school entry-blocked via `$SRK` seed — (a) `curl "$SB/rest/v1/schools?id=eq.<sid>" -H "apikey: $ANON"` → `[]` and its `class_sessions` → `[]` (existing policies); (b) inspect `fetchVenuesWithCoords`/map-data: if the school's linked `venues` row (via `schools.venue_id`) reaches any anon user surface, record it and hand the fix to **ctf-blocklist-uniqueness** (`is_source_blocked` venue-branch extension); if it reaches none, record "no leak — venues row unused for schools post-F70" in §7 and skip the extension
- **Loop pattern**: plan-execute-verify
- **Success criteria**: seed an **entry** block for a school through the UI (not curl) as admin → anon probes (a) return `[]`; `rg "entityType: 'venue'" src/pages/Docs.tsx` → 0; consequence text with a 0-class school reads `drops 0 classes` (DOM/QA); `npx tsc --noEmit` 0
- **Estimated effort**: Medium
- **Design reference**: ADR-0012 D-3 parent-filter semantics; COVERAGE §4.4(4)

#### Node: ctf-blocklist-uniqueness **[SR]**
- **Type**: migration · **Agent**: Frontinus-backend-architect
- **Depends on**: ctf-school-block-fix (consumes its leak-probe verdict)
- **Inputs**: PRD FR-8/A-4/D-5; migration `20260823000002` (constraint + `block_source`); ADR-0012 D-2
- **Outputs**: `supabase/migrations/20260823000010_blocklist_entry_scope.sql` —
  1. `ALTER TABLE public.blocked_sources DROP CONSTRAINT blocked_sources_domain_key;` (verify actual constraint name via `\d` / information_schema first)
  2. `CREATE UNIQUE INDEX blocked_sources_domain_uq ON public.blocked_sources (domain) WHERE scope = 'domain';`
  3. `CREATE UNIQUE INDEX blocked_sources_entry_uq ON public.blocked_sources (entity_type, entity_id) WHERE scope = 'entry';`
  4. `CREATE OR REPLACE FUNCTION public.block_source(...)` — same signature; branch on `p_scope`: `domain` → `ON CONFLICT (domain) WHERE scope='domain' DO NOTHING`, null id ⇒ `RAISE 'domain already blocked: %'`; `entry` → `ON CONFLICT (entity_type, entity_id) WHERE scope='entry' DO NOTHING`, null id ⇒ `RAISE 'entry already blocked'`
  5. If ctf-school-block-fix found a leak: `CREATE OR REPLACE public.is_source_blocked(...)` venue branch additionally returns TRUE when `EXISTS (SELECT 1 FROM blocked_sources b JOIN schools s ON s.id = b.entity_id WHERE b.scope='entry' AND b.entity_type='school' AND s.venue_id = p_entity_id)`
  6. Append to `docs/adr/0012-blocklist-and-field-provenance.md` a dated **Amendment (2026-08-21)** under D-2: uniqueness is scope-partial; entry rows retain `domain NOT NULL` for audit display; rationale = one entry block must not lock the domain slot (F91 A-4)
- **Loop pattern**: plan-execute-verify; `/security-review` (RLS/definer surface changed)
- **Success criteria** (SQL/REST probes via `$SRK` + `$ADMIN_JWT`):
  - Entry-block venue A on domain X → succeeds; entry-block venue B on domain X → **succeeds** (two rows); domain-block X → succeeds (third row); re-domain-block X → raises `domain already blocked`
  - Re-entry-block venue A → raises `entry already blocked`
  - `unblock_source` on the domain row restores anon reads for a venue with no entry row; anon probes per acr-mig-read-filters evaluators still pass end-to-end
  - `supabase db push` exit 0; ADR-0012 contains the Amendment heading
- **Estimated effort**: Medium

#### Node: ctf-6b-to-spec
- **Type**: fix · **Agent**: frontend-developer
- **Depends on**: ctf-6a-wire
- **Inputs**: PRD FR-11/A-7; COVERAGE §4.3 (dry card anatomy — 1.5px `var(--danger)` border, light bg `oklch(0.95 0.03 35)` / dark `var(--danger-bg)`, 7px pulsing dot with `prefers-reduced-motion` suppression, `THE PIPELINE IS DRY` Courier 9px/0.18em, Newsreader-italic 26px numerals in a 16px sentence, body copy with *curated* wording, full-width 46px danger CTA `Curate all {n} schools` in Newsreader italic 16px); school row meta spec (glyph ◍/▭ in hue, `{HOOD} · {price_band} · {n} CLASSES`)
- **Outputs**: `DryPipelineCard.tsx` rebuilt to spec; `Docs.tsx` schools branch renders `DisciplineBar` whenever `school_count > 0` (independent of `session_count`; the dry card only replaces the ClassFieldTiles/stats slot); school `AuditRow` rows carry discipline + price_band so glyph and meta render (extend the row object or `AuditRow` per its current contract — whichever touches fewer files, note the choice in §7)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `rg "THE PIPELINE IS DRY" src/components/admin/DryPipelineCard.tsx` = 1; `rg "prefers-reduced-motion" src/components/admin/DryPipelineCard.tsx` ≥ 1; with `session_count=0` seeded, panel shows dry card **and** DisciplineBar (QA/DOM); `npx tsc --noEmit` 0; both themes spot-checked (QA)
- **Estimated effort**: Medium

#### Node: ctf-single-target-curate
- **Type**: feature (DG-2) · **Agent**: Frontinus-backend-architect + frontend-developer
- **Depends on**: ctf-6b-to-spec, DG-2 answered
- **Inputs**: PRD FR-12/A-8; `class-scrape-batch/index.ts` (`getNextSchool`, start flow); `AuditRow` action slots; DG-2 verdict on `event-scrape-batch`
- **Outputs**:
  - `class-scrape-batch` — `{ action:'start', venue_id }` constrains `getNextSchool` to that id (`.eq('id', venue_id)`), `total_venues = 1`, self-chain honors the constraint for resumable invocations (persist `venue_id` on the job row or reuse the running `crawl_state` filter — document the choice)
  - School `AuditRow`s gain a 44px `CURATE` (accent) wired to the targeted start via `ScrapeContext` or a thin panel handler; aggregator-diagnosed rows show `BLOCK` (danger) instead per COVERAGE §4.3
  - If DG-2 approves: same param on `event-scrape-batch` + venue ↻ (44×44) wired; if declined: §7 gap note "venue ↻ deferred — no single-target endpoint"
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `curl -X POST $SB/functions/v1/class-scrape-batch -H "x-scraper-key: $SCRAPER_SECRET" -d '{"action":"start","venue_id":"<id>"}'` processes exactly that school (`scrape_jobs.total_venues = 1`, `recent_schools` length 1 across invocations); a second concurrent start still 409s; UI CURATE fires the same request (network tab / QA); `deno check` + deploy exit 0
- **Estimated effort**: Medium

#### Node: ctf-remediation-close
- **Type**: release · **Agent**: git-manager + technical-writer
- **Depends on**: ctf-6a-wire, ctf-diagnosis-rule, ctf-blocklist-uniqueness, ctf-6b-to-spec, ctf-single-target-curate
- **Outputs**: `package.json` → `0.29.0`; changelog entry (§4); runbook entries (§5); `/docs-check` surface; `vercel --prod`; QA §B against the deployed build; §7 closed with attempts summaries; `docs/graphs/admin-coverage-redesign.md` §7 gains a pointer: "F91 remediation closed the Phase-4 wiring deviations — see this graph"
- **Success criteria**: pre-push gate green; deployed header `v0.29.0`; QA §B all checked; both runbook entries present
- **Estimated effort**: Small

---

## Section 3: Loop deltas (on top of the Loop v2 template)

- **ctf-cost-choke-point / ctf-dashboard-row-shape / ctf-diagnosis-rule:** tests are written and committed **before** implementation and are frozen for the node's loop. ctf-diagnosis-rule's rewrite of existing tests is the ADR-0011-sanctioned spec-change path (PRD D-4) — the *new* set freezes; further edits to it mid-loop are a loop failure.
- **ctf-v4-usage-wiring:** the census is the evaluator's input, produced by `rg`, never from memory; a fresh-context Argus re-runs the `rg` and diffs against the pasted table — any site missing from the table fails the node.
- **ctf-school-block-fix / ctf-blocklist-uniqueness:** RLS evaluators are **seeded probes** (seed → probe → clean up via `unblock_source`), hard-fail on any non-`[]` anon read of a blocked entity. Never mark green from code inspection alone — this repo has been burned by RLS that compiles and silently no-ops.
- **Budget:** 3 cycles per node into `docs/graphs/attempts.jsonl`, then `/escalate`.

## Section 4: Versions & draft changelogs

| Phase | Version | Type | /cap grouping |
|---|---|---|---|
| A | **0.28.0** | minor (new capability: curation costs in the ledger; edge + client changes) | 1) `feat(scraper): model-aware CostBudget + usage sink` (choke point + tests) · 2) `feat(scraper): class-curation ai_usage wiring + dashboard trace shape + show-path cost columns` · 3) `chore(build): v0.28.0` |
| B | **0.29.0** | minor (schema change + user-facing capability completion) | 1) `fix(admin): real diagnoses + 6a wiring, legacy blocks removed` · 2) `fix(admin): school block entity_type + BlockSheet zero-count` · 3) `feat(db): scope-partial blocklist uniqueness` (migration + ADR amendment) · 4) `feat(admin): dry-card to spec + single-target curate` · 5) `chore(build): v0.29.0` |

**0.28.0 — "Cost truth: one ledger for AI spend"** — summary: *Curation costs now reach the Costs tab; every AI call is priced by its real model.* Details: `New: CostBudget.recordAiCall is model-aware via the shared MODEL_PRICING map (gpt-4o-mini no longer priced as DeepSeek-Flash)` · `New: usage sink — every v4 curation AI call logs to ai_usage (feature: class-curation) with real model, tokens, and cost` · `Fix: curation dashboard per-row stats ($ · AI calls · pages) render again — recent_schools entries now carry the nested trace the client expects` · `Fix: show-path scrape_logs now records cost_usd, fetches, pages_visited (were always null)` · `Docs: ADR-0013 — ai_usage is the ledger of record; scrape_logs/scrape_jobs are per-run telemetry`.

**0.29.0 — "Admin coverage: the redesign actually lands"** — summary: *Frame 6a/6b behave as designed; blocking schools works; the blocklist no longer locks a domain on an entry block.* Details: `Fix: audit rows show their real diagnosis — DEAD SITE ×n, MISTYPED, AGGREGATOR now reach the screen` · `New: WorkActions + NEEDS A LOOK tiles wired; old five-button block, scaffold BLOCKED button, and legacy class-stats row removed; tiles filter the list` · `Fix: blocking a school sends entity_type 'school' — entry-scoped school blocks now hide the school and its classes` · `Fix: block sheet states the affected count even when it is 0` · `New: migration 20260823000010 — blocklist uniqueness is scope-partial; entry blocks no longer occupy the domain slot` · `Fix: MISTYPED only fires for storefront-typed, zero-event, institution-named venues` · `New: dry-pipeline card to spec (THE PIPELINE IS DRY, reduced-motion-safe pulse); discipline bar shows even when the pipeline is dry` · `New: per-school CURATE via single-target curation`.

## Section 5: Documentation surface (per /docs-check)

- **Update** `docs/adr/0012-…` (Amendment, node ctf-blocklist-uniqueness) · **Create** `docs/adr/0013-…`, this graph, the PRD, `docs/qa/cost-truth-and-admin-fixes.md`
- **Update** `docs/graphs/admin-coverage-redesign.md` §7 (closure pointer)
- **Feature docs:** append a "Cost accounting" section to the scraper feature doc naming the two roles (ledger vs telemetry) and the sink rule
- **CLAUDE.md:** no changes (no new skills/agents)
- **Runbooks** (`.claude/runbooks/`, Wrong/Right/Why, node ctf-remediation-close):
  1. *Cost tracked ≠ cost visible.* **Wrong:** record spend in a local budget object and per-run rows, assume the Costs tab sees it. **Right:** every AI call reaches `ai_usage` — route through `CostBudget` with a usage sink attached (ADR-0013). **Why:** the tab sums one table; a second ledger is invisible by construction, and this exact gap survived two prior fix passes (v4.2 §7, dv2 §6).
  2. *A component that exists is not a component that ships.* **Wrong:** build `WorkActions`/`NeedsALookTiles`, defer the mount "to avoid breaking wiring," close the phase. **Right:** wiring is part of the node's success criteria; a deferred mount gets its own closing node in §7 before the phase's version bump. **Why:** every acceptance line for frame 6a silently failed for three releases while the components sat unused, and the synthetic inline data added to "make it render" masked the real hook output.

## Section 6: Tooling gaps & out of scope

- **Gap (promote candidate):** a tiny deployed-version probe script (`curl the app, grep the meta version line`) to close the C-5 stale-build class in evaluators — worth adding to the pre-push gate's sibling tooling.
- **Out of scope:** Jina pricing unless DG-3 supplies it; v3 per-step logging → sink consolidation; deleting the legacy `event-scraper` `processVenue`; Costs-tab UI changes; ai-gateway's duplicate pricing map; historical cost backfill (PRD D-3); the nav CALLBOARD/LOBBY divergence.

## Section 7: Execution Notes

### Decision Gate Answers (2026-08-21)

- **DG-1:** `package.json` = `0.27.0` confirmed. Migrations up to `20260823000009`; `20260823000010` is free. Aligned with spec.
- **DG-2:** Single-target curation approved for `class-scrape-batch` (`venue_id` param, per-school CURATE). Venue ↻ via `event-scrape-batch` **deferred** — gap note: "venue ↻ deferred — no single-target endpoint for event-scrape-batch this pass."
- **DG-3:** Jina API key is free tier. Jina pricing out of scope — stays unpriced.

### recordAiCall Census (2026-08-21)

| File:Line | Path | Model Threaded | Sink Coverage |
|-----------|------|---------------|---------------|
| `recon.ts:152` | v4 | ✓ `ai.model` | v4=sink |
| `page-classifier.ts:82` | v4 | ✓ `ai.model` | v4=sink |
| `strategy-agent.ts:981` | v4 (extractClassPrograms) | ✓ `ai.model` | v4=sink |
| `link-extractor.ts:308` | v4 (scoreLinksLLM) | ✓ `ai.model` | v4=sink |
| `strategy-agent.ts:434` | v3 (extractWithAllModels) | default | v3=per-step logUsage |
| `strategy-agent.ts:584` | v3 (callDeepSeek fallback) | default | v3=per-step logUsage |
| `strategy-agent.ts:663` | v3 (callDeepSeek BFS) | default | v3=per-step logUsage |
| `strategy-agent.ts:758` | v3 (callDeepSeek verify) | default | v3=per-step logUsage |

All v4 sites threaded and covered by the attached usage sink. v3 sites use default (deepseek-v4-flash) and log through the existing per-step `logUsage` in `process-venue.ts`.

### Deviations

- `trace.wallMs` not available in `StrategyTrace`; dashboard `durationMs` renders as 0. Acceptable — duration tracking was never wired for v4.
- Venue ↻ deferred per DG-2.

*(Executor appends below: leak-probe verdict, Phase B attempts summaries.)*

---

## File Index

| File | Node | Action |
|------|------|--------|
| `supabase/functions/_shared/logUsage.ts` | ctf-cost-choke-point | Modify (export MODEL_PRICING) |
| `supabase/functions/_shared/scraper/cost-budget.ts` | ctf-cost-choke-point | Modify (model pricing, sums, sink) |
| `supabase/functions/_shared/scraper/cost-budget.test.ts` | ctf-cost-choke-point | Create (frozen first) |
| `supabase/functions/_shared/scraper/strategy-agent.ts` | ctf-v4-usage-wiring | Modify (attach sink; thread model) |
| `supabase/functions/_shared/scraper/link-extractor.ts` | ctf-v4-usage-wiring | Modify (thread model) |
| `supabase/functions/class-scrape-batch/index.ts` | ctf-dashboard-row-shape, ctf-single-target-curate | Modify |
| `supabase/functions/class-scrape-batch/entry.test.ts` | ctf-dashboard-row-shape | Create (frozen first) |
| `supabase/functions/_shared/scraper/process-venue.ts` | ctf-v3-cost-columns | Modify (cost columns) |
| `supabase/functions/event-scraper/index.ts` | ctf-v3-cost-columns | Modify (LEGACY note or patch) |
| `supabase/functions/event-scrape-batch/index.ts` | ctf-single-target-curate | Modify (DG-2 optional) |
| `src/pages/Docs.tsx` | ctf-audit-real-rows, ctf-6a-wire, ctf-school-block-fix, ctf-6b-to-spec | Modify |
| `src/components/admin/BlockSheet.tsx` | ctf-school-block-fix | Modify (labels, zero count) |
| `src/components/admin/DryPipelineCard.tsx` | ctf-6b-to-spec | Rewrite to spec |
| `src/components/admin/AuditRow.tsx` | ctf-diagnosis-rule, ctf-6b-to-spec, ctf-single-target-curate | Modify (single composer; glyph/meta; CURATE) |
| `src/lib/diagnosis.ts` / `src/lib/diagnosis.test.ts` | ctf-diagnosis-rule | Modify (tests first) |
| `supabase/migrations/20260823000010_blocklist_entry_scope.sql` | ctf-blocklist-uniqueness | Create |
| `docs/adr/0012-blocklist-and-field-provenance.md` | ctf-blocklist-uniqueness | Modify (Amendment) |
| `docs/adr/0013-ai-cost-ledger-of-record.md` | (this spec) | Create |
| `.claude/docs/prd/cost-truth-and-admin-fixes.md` | (this spec) | Create |
| `docs/qa/cost-truth-and-admin-fixes.md` | (this spec) | Create |
| `.claude/runbooks/` (2 entries) | ctf-remediation-close | Modify/Create |
| `src/data/changelog.ts`, `package.json` | ctf-cost-close, ctf-remediation-close | Modify |
