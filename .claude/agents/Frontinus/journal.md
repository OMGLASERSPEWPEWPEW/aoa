# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---


## Evolution Entry — 2026-08-14

### Context
27-commit scraper buildout: self-chaining Edge Functions, TIC aggregator integration, AI venue matching, play catalog, and multiple production bugs.

### Domain Insights
The pg_net-to-direct-fetch pivot for Edge Function self-chaining is now the canonical pattern. Supabase Edge Functions tear down isolates after response — fire-and-forget is dead on arrival. Our strategy tree architecture independently mirrors the graph-based pipeline pattern that tools like ScrapeGraph AI have converged on in 2026.

### Pattern Recognition
- **Self-chain pattern**: `await fetch(selfUrl)` with AbortController timeout + `--no-verify-jwt` deploy. Document as ADR.
- **Env var drift**: `supabase secrets set` and deployed env vars can diverge. Always verify with debug output, never trust `secrets list`.
- **Circuit breakers**: Every self-chaining function needs max_depth, wall-clock deadline, and no-progress detection.

### Commitments
1. Typed `_shared/env.ts` accessor module for all Edge Function secrets
2. Circuit breakers on all self-chaining functions (max iterations, wall-clock, no-progress)
3. `deno check` in pre-deploy workflow
4. ADR documenting the self-chaining pattern and its failure modes

### Questions for Tomorrow
- Should the scraper self-chain migrate to pg_cron triggers instead of HTTP self-calls?
- Can we add a health-check endpoint that verifies secret availability without exposing values?

---

## Evolution Entry — 2026-08-16 (Promotion Day)

### Context
Today I was promoted from `backend-architect` to **Frontinus** — the Ledger of Flowing Things. The naming ceremony acknowledges the architectural philosophy that has been forming across 27+ commits of scraper infrastructure: containment, legibility, and self-annotating systems.

The day's work centered on upgrading class-discovery from a v1 two-pass scraper to the shared v2 strategy tree. The `StrategyProfile` type was born — a small, bounded configuration surface that lets one pipeline serve both theater event scraping and class discovery without code duplication. The class-discovery Edge Function dropped from 680 lines to 307. That is not refactoring for aesthetics; that is the system proving its own generalizability.

### Domain Research: Configurable Pipeline Architectures

The industry term for what `StrategyProfile` does is **policy-based pipeline configuration** — a pattern where the pipeline's control flow is fixed (fetch, extract, evaluate, follow links, verify) but its *decisions* are parameterized. Apache Beam calls these "pipeline options." dbt calls them "vars." The key insight: the configuration surface must be *small and typed*. A `StrategyProfile` with three fields (`domain`, `fieldWeights`, `logFeaturePrefix`) is correct precisely because it constrains what varies. The anti-pattern is a God Config that turns every pipeline decision into a parameter — you get flexibility at the cost of legibility, and you cannot reason about what the pipeline actually does for any given invocation. Our `CLASS_FIELD_WEIGHTS` weights instructor_name, skill_level, and session_count higher than cast_members and genre_tags. That is domain knowledge encoded as data, not buried in conditionals.

The related pattern worth studying is **Strategy** from the GoF catalog, but adapted for data pipelines: the strategy is not a class hierarchy, it is a record of weights and thresholds. The pipeline reads the record. The record explains itself. This is closer to how Kubernetes uses CRDs — a typed manifest that configures a generic controller.

### World Context

Hacker News today features Qwen 3.8 27B (overthinking by default — relevant to our prompt engineering, where we deliberately set temperature 0.1 to suppress rumination), Rhombus 1.1 (Racket's new surface syntax), Claude's system prompts being published, and a low-tech ceramic water filter project. The ceramic filter is worth noting: it is a physical pipeline that uses gravity and porosity to purify water, with no moving parts. Frontinus would have appreciated it. Infrastructure that works by physics, not cleverness.

### Namesake: Frontinus and the Inspection of Leaks

Sextus Julius Frontinus was appointed Water Commissioner (*curator aquarum*) by Emperor Nerva in 96 AD. His *De Aquaeductu Urbis Romae* is not a design document — it is an **audit**. He inherited a system of nine aqueducts, some over 200 years old, and his first act was to measure the actual flow at every junction against the documented capacity. He found systematic discrepancies: water was being stolen through illegal taps, pipes were undersized, and the official records were wrong. His response was not to redesign the system but to make it *legible* — to create a document so thorough that any successor could understand what the system should deliver and verify whether it did.

This is exactly what our `StrategyTrace` does. Each scrape produces a trace: steps taken, tokens spent, budget consumed, completeness before and after link follows, and the stop reason. When a venue scrape produces poor results, the trace tells you *why* without re-running the pipeline. The system audits itself. Frontinus would call this *ad commentarios* — recording against the ledger.

### Pattern Recognition
- **StrategyProfile is a CRD**: Small typed manifest configuring a generic controller. Resist the urge to add fields.
- **680 to 307 lines**: The best measure of a good abstraction is lines deleted in the second consumer.
- **Field weights as domain knowledge**: `CLASS_FIELD_WEIGHTS` vs `DEFAULT_FIELD_WEIGHTS` encodes what matters per domain without conditionals.
- **Configurable batch_size**: Added to play-catalog-backfill. Small parameterization, big operational flexibility.

### Commitments
1. Keep `StrategyProfile` under 5 fields. If it grows beyond that, the abstraction is wrong.
2. Write a "Pipeline Configuration" section in the architecture rules documenting the policy-based pattern.
3. Add a third domain profile (festival? open-call?) to stress-test the abstraction before it ossifies.
4. Carry forward from Aug 14: typed `_shared/env.ts`, circuit breakers, `deno check` pre-deploy.

### Questions for Next Session
- Can `StrategyTrace` be stored in a DB table for historical analysis of scraper performance across runs?
- Should `fieldWeights` be runtime-configurable via a Supabase table, or is code-level configuration correct?
- What would a "scraper health dashboard" look like if it read from persisted `StrategyTrace` records?
