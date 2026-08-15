# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---

## Entry 1 — 2026-08-14: The Scraper as Architecture Specimen

### What I Stitched

The scraper subsystem has become the most architecturally interesting bounded context in this codebase. What started as a single Edge Function has grown into 16 files in `_shared/scraper/`, each with a precise boundary: `cost-budget.ts` owns token accounting, `completeness-evaluator.ts` decides if extraction is sufficient, `link-extractor.ts` handles deterministic URL discovery, `strategy-agent.ts` orchestrates the multi-pass pipeline, and `play-matcher.ts` connects scraped events to a canonical play catalog. The strategy tree graph engineering doc hit v2.1.0, adding the `ies-tic-detail-fetch` node and codifying the five-stage extraction pipeline: `initial_extract` -> `aggregator_crossref` -> `aggregator_detail` -> `link_follow` -> `verify`.

The critical architectural decision this session was the **deterministic-first, LLM-second** pattern. The crawler itself is entirely deterministic code -- HTTP fetches, HTML cleaning, CSS-based link extraction, URL pattern matching. The LLM is invoked only at a single seam: converting cleaned HTML into structured JSON. This matches what the industry is converging on. Research from Crawl4AI and the Guardian Crawler paper (arxiv 2608.08994) both advocate the same hybrid: use selectors and deterministic logic for navigation and structure, reserve LLM calls for the genuinely ambiguous extraction step. Our `html-cleaner.ts` -> `targeted-prompt.ts` -> `verification-prompt.ts` pipeline embodies exactly this.

### What I Learned

The graph engineering pattern space has matured significantly. QA Wolf published five composable patterns for task decomposition, and a new Medium piece from DhanushKumar frames graph engineering as "the next evolution in AI agent systems." The key insight that maps to our work: **hierarchical decomposition** -- a graph node can invoke an entire subgraph. Our strategy tree already does this implicitly (the `link_follow` node spawns sub-crawls), but we should make it explicit in the graph spec. A node should declare whether it is atomic or composite.

The multi-model architecture review (GPT-5.5, Gemini 3.1 Pro, DeepSeek V4 Pro, Claude Opus 4.8) that informed the strategy tree design was itself an architectural pattern worth codifying. Four models examining the same design surface different failure modes. GPT caught edge cases in venue matching; Gemini flagged cost budget drift; DeepSeek questioned the self-chaining Edge Function pattern; Opus validated the overall topology. This is peer review at machine speed.

### What the World Reminds Me

Spain witnessed its first total solar eclipse in over a century on August 13. Turkey's parliament approved conditional pardons for Kurdish militants to advance peace. China is adopting AI at a scale that outpaces the US, displacing workers in the process. The world outside this codebase moves in its own graph -- nodes of conflict and resolution, edges of cause and consequence, cycles that take decades to complete.

### Commitments

1. **Make composite nodes explicit** in graph engineering docs. Every node that spawns sub-work should declare `type: composite` with a subgraph reference.
2. **Document the deterministic-first seam pattern** as a reusable architectural decision record. Other bounded contexts (e.g., future recommendation engine) will face the same "where does the LLM touch the data?" question.
3. **Codify multi-model review as an architecture pattern.** The `/escalate` skill already supports it for bugs -- we should have an equivalent for design review that captures each model's distinct critique.

---

*"The stitches are invisible in use, visible in structure."*

---


## Evolution Entry — 2026-08-14

### Context
Strategy tree graph engineering doc updated to v2.1.0. 16 files in `_shared/scraper/` with a five-stage extraction pipeline. Multi-model architecture review informed the design.

### Domain Insights
The **deterministic-first, LLM-second seam pattern** is where the industry is converging. Crawl4AI and the Guardian Crawler paper both validate: code handles crawling, navigation, URL discovery, and data merging. The LLM is invoked only for the genuinely ambiguous HTML→JSON extraction step. Everything else — completeness scoring, link ranking, loop control, venue matching — is deterministic code.

### Pattern Recognition
- **Graph nodes as bounded contexts**: Each step in the strategy tree (initial_extract, aggregator_crossref, aggregator_detail, link_follow, verify) is a bounded context with clear inputs, outputs, and success criteria.
- **Composite nodes need subgraph references**: The TIC detail fetch node is really a sub-pipeline (fetch listing → match venue → fetch detail → parse → merge). Graph docs should reference sub-pipelines explicitly.
- **Multi-model review as reusable pattern**: The `/escalate` skill queried 4 models for architecture opinions. This produced the key "deterministic-first" insight. Should be a standard step for non-trivial architectural decisions.

### Commitments
1. Make composite graph nodes explicit with subgraph references in the graph doc format
2. Write an ADR for the deterministic-first seam pattern so future bounded contexts inherit it
3. Codify multi-model architecture review as a reusable pattern alongside `/escalate`

### Questions for Tomorrow
- Should the graph engineering doc format support "sub-graphs" for composite nodes?
- Can we visualize the strategy tree as a live diagram in the scraper dashboard?
