# PRD: Cost Truth + Admin Coverage Remediation (F91)

**Date:** 2026-08-21 · **Status:** Draft · **Size:** Medium
**Graph:** `docs/graphs/cost-truth-and-admin-fixes.md` · **ADR:** `docs/adr/0013-ai-cost-ledger-of-record.md`
**Prior work:** `docs/graphs/admin-coverage-redesign.md` (F80–F90, shipped v0.25.0–v0.27.0), `ADMIN-COVERAGE.md`, `ADMIN-IMPLEMENTATION.md`

## 1. Problem

Post-implementation review of F80–F90 found two issue sets. **(A) Costs are invisible or wrong**: the two pipelines write spend to two disjoint ledgers — the show path logs to `ai_usage` (which the Costs tab reads) but never to `scrape_logs.cost_usd`; the v4 class path writes `scrape_logs`/`scrape_jobs` but never `ai_usage` — so the tab named "Costs" is blind to curation, the biggest spender. The curation dashboard's per-row stats line can never render (writer emits flat fields, reader expects `entry.trace.*`), and every number that does surface is priced at DeepSeek-Flash rates even when gpt-4o-mini did the work. **(B) The admin redesign only half-landed**: the theaters panel feeds `AuditRow` a synthetic `kind:'ok'` diagnosis while `useVenueAudit` computes real ones; `WorkActions`/`NeedsALookTiles` exist but were never mounted (old five-button block, scaffold BLOCKED button, and the legacy inline CLASS COVERAGE row remain); blocking a school sends `entity_type:'venue'` with a `schools.id` so entry-scope school blocks hide nothing; `UNIQUE(domain)` is unconditional so one entry block locks a whole domain; the BlockSheet hides the affected count at 0; `diagnoseVenue`'s MISTYPED rule flags correctly-typed institutional venues.

## 2. Findings register (binding — every FR closes one or more)

| # | Finding | Evidence |
|---|---------|----------|
| C-1 | v4 class path never calls `logUsage`; `ai_usage` has zero curation rows; Costs tab blind | `strategy-agent.ts` imports (no `logUsage`); `extractClassPrograms`/`scoreLinksLLM` raw `fetch` + `recordAiCall` only |
| C-2 | Per-row dashboard stats never render: writer emits flat `costUsd`, reader guards on `s.trace` | `class-scrape-batch/index.ts` entry builder vs `ClassDiscoveryDashboard.tsx` + `RecentSchoolEntry` |
| C-3 | `CostBudget.recordAiCall` prices everything at DeepSeek-Flash; `getClassAiConfig` prefers gpt-4o-mini (~33% underpriced) | `cost-budget.ts` constants; spec'd `model?` param was dropped |
| C-4 | Show path never writes `scrape_logs.cost_usd/fetches/pages_visited` (columns stay null) | both `processVenue` inserts omit them |
| C-5 | Vercel auto-deploy broken for this repo; stale builds mask fixes | graph §7 notes ("deployed via `vercel --prod`") |
| A-1 | Theaters panel constructs inline `diagnosis:{kind:'ok'…}`, `domain:null`, ignoring computed `AuditVenueRow` | `Docs.tsx` venue `AuditRow` wiring |
| A-2 | `WorkActions`/`NeedsALookTiles` built, never mounted; old buttons + scaffold BLOCKED + legacy CLASS COVERAGE row + duplicate inline `classMetrics` RPC fetch remain; migration-5 metrics unused; filters never set; headers say "Venue Audit (n)"; lists `.slice(0,30)` | `Docs.tsx`; Phase-4 deviation never closed |
| A-3 | School block sends `entityType:'venue'` + `schools.id`; entry-scope school blocks match neither table's policy; consequence labels classes as "events"; `affectedClasses` hardcoded 0 | `Docs.tsx` BlockSheet target |
| A-4 | `blocked_sources` `UNIQUE(domain)` unconditional + `domain NOT NULL`: entry block occupies the domain slot; second entry block or later domain block raises `'domain already blocked'` | migration `20260823000002` |
| A-5 | BlockSheet suppresses the count at 0 (`affectedCount > 0 ? … : ''`) — acceptance requires stating 0 | `BlockSheet.tsx` |
| A-6 | MISTYPED fires on any institution-hint name where `venue_type !== 'school'`; spec: `storefront` + `event_count === 0`; label lacks `SHOULD BE INSTITUTIONAL` | `diagnosis.ts` + its test |
| A-7 | `DryPipelineCard` is a stand-in (no `THE PIPELINE IS DRY` label/pulse/spec copy/typography); `DisciplineBar` hidden when pipeline dry though it renders school data | `DryPipelineCard.tsx`, `Docs.tsx` schools branch |
| A-8 | School rows lack per-row CURATE, discipline glyph, price-band meta; venue rows lack ↻; no single-target curation endpoint exists | `Docs.tsx`, `class-scrape-batch` |

## 3. Functional requirements

| FR | Closes | Requirement |
|----|--------|-------------|
| FR-1 | C-1, C-3 | `ai_usage` becomes the **ledger of record** for AI spend (ADR-0013). `CostBudget.recordAiCall(input, output, model?)` prices per model from the shared `MODEL_PRICING`, accumulates token sums, and emits to an optional **usage sink**. `executeClassStrategy` attaches a sink that `logUsage`s each call (`feature:'class-curation'`, real model + provider, per-call `estimatedCostUsd`). Every `recordAiCall` site in the v4 path threads the real model. |
| FR-2 | C-2 | `class-scrape-batch` emits `recent_schools` entries with a nested `trace` object exactly matching `RecentSchoolEntry` (`stopReason, aiCalls, fetches, durationMs, costUsd, programsExtracted, modelResults:null`). Old flat rows render no stats line (already defensive) — acceptable. |
| FR-3 | C-4 | The **live** show-path `scrape_logs` insert gains `cost_usd`, `fetches`, `pages_visited` from the trace. Dead duplicate `processVenue` (if confirmed unreferenced) gets a `// LEGACY` header, not deleted. |
| FR-4 | C-5 | Phase closes with `vercel --prod` + version bump; QA probes run against the deployed build. |
| FR-5 | A-1 | Theaters panel passes the real `AuditVenueRow` (`row={v}`); no inline diagnosis construction remains in `Docs.tsx`. |
| FR-6 | A-2 | `WorkActions` + `NeedsALookTiles` mounted per COVERAGE §4.2 with exact handler parity (see graph node table); old five-button block, scaffold BLOCKED button, legacy CLASS COVERAGE row, and the duplicate inline `classMetrics` fetch removed; tiles drive `useVenueAudit` filters (`BLOCKED` opens `BlockedList`); list headers name the active filter + `TAP FOR WHY`; row caps removed. |
| FR-7 | A-3 | School blocks send `entity_type:'school'`, `schools.id`, `url:s.url`, `affectedClasses:s.session_count`; BlockSheet labels classes as classes. Anon probe decides whether the linked `venues` row leaks into a user surface; if yes, `is_source_blocked`'s venue branch also honors entry-blocked schools via `schools.venue_id` (folded into FR-8's migration). |
| FR-8 | A-4 | Migration `20260823000010`: drop `UNIQUE(domain)`; partial uniques `(domain) WHERE scope='domain'` and `(entity_type, entity_id) WHERE scope='entry'`; `block_source` conflicts per scope with accurate error text. Append a dated **Amendment** to ADR-0012 D-2. |
| FR-9 | A-5 | Consequence sentence always states the count, including `0`. |
| FR-10 | A-6 | MISTYPED = `venue_type==='storefront' && event_count===0 && hint match`, label `MISTYPED · SHOULD BE INSTITUTIONAL`. Tests updated **first** (spec change ⇒ new frozen tests, per ADR-0011). One place composes the full on-screen meta (`TYPE · HOOD` lead + source + diagnosis, ≤3 diagnosis segments) — not both `diagnosis.ts` and `AuditRow`. |
| FR-11 | A-7 | `DryPipelineCard` to frame-6b spec (post-copy-sweep wording: *curated*); `DisciplineBar` renders whenever `school_count > 0`, independent of sessions. |
| FR-12 | A-8 | Per DG-2: `class-scrape-batch` accepts `{action:'start', venue_id}` (single-school job); school rows gain 44px `CURATE`; venue ↻ via the same param on `event-scrape-batch` is DG-2-optional. School rows gain glyph + `{HOOD} · {price_band} · {n} CLASSES` meta. |

## 4. Binding decisions

- **D-1 (ADR-0013):** ledger of record = `ai_usage`; `CostBudget` is the emission choke point; `scrape_logs`/`scrape_jobs` cost fields are per-run operational telemetry, never summed as "the" cost. v3's existing per-step logging stays (sink attached in v4 only); consolidation noted as future work.
- **D-2:** Dashboard shape fix happens in the **writer** (nested `trace`), because the typed client contract (`RecentSchoolEntry`) already declares it.
- **D-3:** No backfill of historical class-run costs into `ai_usage`; history stays in `scrape_logs.cost_usd`.
- **D-4:** Frozen-test rule: FR-10 legitimately changes spec'd behavior, so its node rewrites the affected tests first and freezes the new set — this is the ADR-0011-sanctioned path, not an evaluator edit mid-loop.
- **D-5:** Entry rows keep `domain NOT NULL` (useful for display/audit); only uniqueness becomes scope-partial.

## 5. Out of scope

Jina fetch pricing (unless DG-4 supplies a per-request price), migrating v3 per-step logging onto the sink, deleting the legacy `event-scraper` `processVenue`, Costs-tab UI changes (once `ai_usage` is fed, the existing RPCs/tab need nothing), suggestion-UI changes, nav divergence (still open from the original handoff).

## 6. Success metrics

After one curation run on the deployed build: Costs tab by-feature shows `class-curation` with cost > 0 and model ∈ {gpt-4o-mini, deepseek-chat}; dashboard rows show `· $0.0xxx`; blocking a school at entry scope empties its anon reads; the theaters panel shows a real `DEAD SITE ×n` for a seeded failing domain; exactly four work buttons per panel.
