# ADR 0013: `ai_usage` as the AI-Cost Ledger of Record; `CostBudget` as the Emission Choke Point

**Date:** 2026-08-21
**Status:** Proposed
**Feature:** Cost Truth + Admin Coverage Remediation (F91)
**PRD:** `.claude/docs/prd/cost-truth-and-admin-fixes.md` · **Graph:** `docs/graphs/cost-truth-and-admin-fixes.md`

> Numbering note: 0012 is the highest ADR at spec time. If another 0013 lands first, renumber and update the two cross-references above plus the graph header.

## Context

AI spend is recorded in two disjoint ledgers. The v3 show path logs per-step to `ai_usage` via `logUsage` (which the admin Costs tab reads through the `get_ai_cost_*` RPCs) but writes no cost to `scrape_logs`. The v4 class path accumulates spend only in `CostBudget` → `crawl_state.budget_used` → `scrape_logs.cost_usd` / `scrape_jobs.total_cost_usd`, and never calls `logUsage` — so the Costs tab is blind to curation, the dominant spender. Compounding it, `CostBudget.recordAiCall` prices every call at DeepSeek-Flash rates while `getClassAiConfig` prefers gpt-4o-mini, so even the numbers that surface are ~33% low. The root cause is structural: nothing forces an AI call site to reach the ledger, so each new pipeline decides independently and drifts.

## Decision

1. **`ai_usage` is the single ledger of record for AI spend.** The Costs tab and any future reporting sum only `ai_usage`. `scrape_logs.cost_usd`, `scrape_jobs.total_cost_usd`, and `crawl_state.budget_used` are per-run operational telemetry — useful for dashboards and budget enforcement, never summed as "the" cost (double-count hazard).
2. **`CostBudget` becomes the emission choke point.** `recordAiCall(inputTokens, outputTokens, model = 'deepseek-v4-flash')` prices per model from the shared `MODEL_PRICING` map (exported from `_shared/logUsage.ts`, single source of truth), accumulates `inputTokens`/`outputTokens` sums (also feeding the dv2 `trace.totalInputTokens` fields), and invokes an optional **usage sink** — `attachUsageSink((u: { model, inputTokens, outputTokens, costUsd }) => …)` — fire-and-forget with swallowed rejection so ledger writes can never fail a crawl.
3. **The v4 class path attaches the sink.** `executeClassStrategy` attaches a sink that calls `logUsage(sb, { userId: null, model, provider: providerFor(model), feature: 'class-curation', inputTokens, outputTokens, estimatedCostUsd, metadata: { venue_id, venue_name, invocation } })`. Every v4 `recordAiCall` site threads the real model string.
4. **Rule going forward:** any new AI call site must route through a `CostBudget` with a sink attached (or call `logUsage` directly with an explicit justification comment). The graph node for this ADR produces a census of `recordAiCall` sites so the rule starts true.
5. v3's existing per-step `logUsage` in `process-venue.ts` stays as-is (no sink attached there, avoiding double logging). Consolidating v3 onto the sink is deliberate future work, not this pass.

## Alternatives Considered

- **UNION `scrape_logs.cost_usd` into the cost RPCs:** no code change in the pipelines, but double-counts the show path (already in `ai_usage`), loses by-model and by-feature splits (scrape_logs has neither), and entrenches two ledgers. Rejected.
- **One aggregate `logUsage` per invocation:** ~15-line fix, but loses per-call granularity, can't split extract vs. link-scoring features, and — decisively — does nothing to prevent the next pipeline from repeating the omission. Rejected in favor of the choke point.
- **Backfill historical class costs into `ai_usage`:** the source rows lack model/token splits per call; a lossy backfill would pollute by-model reporting. History remains queryable in `scrape_logs.cost_usd`. Rejected (PRD D-3).
- **Sink as a constructor-required parameter:** would break `CostBudget`'s many existing call sites and the v3 path that must not double-log. Optional attach keeps the diff surgical. Chosen.

## Consequences

- **Positive:** the Costs tab reports true spend by feature and model with zero RPC/UI changes; wrong-model pricing fixed at the same choke point; future AI call sites inherit ledger emission by construction; the census makes the invariant auditable (`rg "recordAiCall\(" supabase/functions`).
- **Negative:** up to ~18 `ai_usage` inserts per invocation (one per AI call) — acceptable at this volume and consistent with the show path's per-step rows; sink failures are silent by design (console-logged inside `logUsage` only).
- **Neutral:** two cost representations continue to exist with clarified roles (ledger vs. telemetry); v3 remains on direct per-step logging until a consolidation pass; `MODEL_PRICING` gains an export and one import site.
