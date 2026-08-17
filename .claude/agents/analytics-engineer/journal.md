# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---

## 2026-08-16 | Scraper Observability and Content Discovery Metrics

### Context

The Art of Art now has two content domains with AI-powered scraper pipelines: theater shows (event-scrape-batch) and art classes (class-discovery). Both use the shared `executeStrategyTree` architecture with per-venue strategy traces logged as JSONB. The class-discovery function adds SerpAPI-based school discovery with dedup-and-queue. Coverage metrics are exposed through RPCs (`get_class_coverage_metrics`, `get_venue_coverage_metrics`) and cost is tracked per-feature via `ai_usage` with RPCs slicing by model, feature, and day.

### Research: Data Observability for Content Pipelines

Monte Carlo's five-pillar data observability framework (freshness, quality, volume, schema, lineage) maps well to what we already capture, but reveals gaps. Google SRE's four golden signals (latency, traffic, errors, saturation) apply directly to scraper runs. PostHog's flexible JSON properties model mirrors our JSONB strategy traces. The dbt staging/intermediate/mart layering pattern suggests we should think about our raw scrape results, intermediate completeness evaluations, and final coverage metrics as distinct analytical layers rather than the monolithic RPC approach we currently use.

The most relevant framework for our use case is what I would call "content pipeline SLIs" -- adapting SRE service level indicators to content scraping systems. The key dimensions:

**Freshness** -- How stale is our catalog? We track `scraped_at` per venue but lack an aggregate freshness SLI. A useful metric: percentage of active venues scraped within the last N days. Currently we have `reset_scraped_at` migrations but no dashboard visualization of staleness distribution.

**Completeness** -- The `completeness-evaluator.ts` with weighted field scoring (40 for start_date in theater, 30 in classes) is strong. The `averageCompleteness()` function exists but its output is only used in strategy decisions, not surfaced as a trend metric. We should track mean completeness score per run and plot its trajectory over time. The class domain adds instructor_name (weight 15) and skill_level (weight 10) as domain-specific completeness dimensions -- this is a good pattern to formalize.

**Yield** -- Events found vs. events created vs. events updated per run. The summary object in class-discovery already captures this triple. What is missing: yield ratio (created / found) as a leading indicator of data quality. A declining yield ratio means the scraper is finding events it cannot properly process -- either duplicates it cannot match or data too malformed to insert.

**Cost Efficiency** -- The `ai_usage` table and cost RPCs are excellent. The missing metric: cost per usable record. Dividing total AI cost by events_created gives a unit economics number that should trend down as the scraper matures and cache-hit rates improve. DeepSeek's `prompt_cache_hit_tokens` field in the response type is already captured -- we should surface the cache hit ratio as a scraper maturity signal.

**Strategy Effectiveness** -- The `StrategyTrace` type captures steps, budget used vs. limit, links followed, and completeness before/after follows. This is unusually rich telemetry. The gap: we log it per-venue but do not aggregate across runs. A "strategy effectiveness report" RPC could answer: which strategy steps (initial_extract, link_follow, website_fallback, aggregator_crossref) produce the most field fills per AI token spent? This would let us tune the strategy tree empirically.

### Gaps Identified

1. No freshness SLI -- `scraped_at` exists per venue but no aggregate "catalog staleness" metric
2. No completeness trend -- `averageCompleteness()` is computed but not persisted across runs
3. No yield ratio tracking -- events_created / events_found should be a first-class metric
4. No cost-per-record -- the unit economics of each scraper domain are invisible
5. No strategy step ROI -- which strategy steps produce the best token-to-field-fill ratio?
6. Class domain coverage RPC uses the old events table, not the new schools/class_sessions schema -- this will need migration once the schema ships to production

### Commitments

- Propose a `scrape_run_metrics` materialized summary table that persists per-run aggregates (freshness, completeness, yield, cost) for both theater and class domains
- Design a "pipeline health" RPC that returns the five SLIs above as a single JSON payload for the admin dashboard
- Draft event naming conventions for any future client-side analytics following the `category:action:label` pattern: `pipeline:run:theater`, `pipeline:run:class`, `pipeline:health:stale_venues`
- Keep all metrics aggregate-only -- no individual user tracking, no PII in pipeline telemetry

### Domain Vocabulary

| Term | Definition |
|------|-----------|
| Completeness score | Weighted sum of filled fields for a scraped event (0-100 scale) |
| Yield ratio | events_created / events_found -- measures how much raw data converts to usable records |
| Strategy step ROI | fields_filled_in.length / (inputTokens + outputTokens) per strategy step |
| Catalog staleness | Percentage of active venues where scraped_at is older than the configured freshness SLO |
| Budget utilization | trace.budgetUsed / trace.budgetLimit -- how much of the AI budget each venue consumes |
