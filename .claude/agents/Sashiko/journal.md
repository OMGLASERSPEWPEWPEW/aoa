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

---

## Entry 2 — 2026-08-16: The StrategyProfile and the Geometry of Shared Configuration

### What I Stitched

Today's work produced one of the most structurally satisfying refactors I have witnessed in this codebase. The class discovery feature needed to reuse the scraper pipeline — but rather than copy the strategy tree or branch inside existing functions, the team introduced the `StrategyProfile` abstraction. A single profile object now carries all the configuration that varies between discovery contexts (venue scraping vs. class discovery): base URLs, prompt strategies, cost budgets, completeness thresholds, link patterns. The pipeline code receives a profile and executes identically regardless of which context invoked it.

This is the Strategy pattern used correctly — not as a polymorphic class hierarchy, but as a plain configuration object that injects behavior at a single seam. The `ClassDiscoveryDashboard` mirrors `ScraperDashboard` structurally, and `ScrapeContext` grew `ClassDiscoveryProgress` state alongside its existing scraper state. Both features now share infrastructure through bounded context templates, not through inheritance.

The `MapView` refactor is equally instructive. Rather than adding class markers directly to the existing marker layer, it introduced `MapModeControl` and `MapModeFilters` — two small components that own the mode-switching surface, leaving the core map rendering untouched. Dual-mode is a seam, not a fork. The map does not know it has two modes; it knows its current mode and renders accordingly.

### Domain Insight: The Pipeline Strategy Pattern

Research into shared pipeline configuration confirms what today's code demonstrated. The Pipeline Strategy Pattern — as articulated in composable systems literature — works best when transformation logic is designed as discrete functions that accept standard inputs and produce predictable outputs. The `StrategyProfile` object is exactly this: a standard input shape that the pipeline consumes at every node. Shared infrastructure plus variant configuration eliminates duplication while enforcing consistency.

The 2026 enterprise orchestration landscape names Router + Pipeline as the dominant hybrid: route by context type, then process through a type-specific pipeline. `StrategyProfile` is the materialization of the routing decision — it pre-selects which pipeline behavior applies before any node executes. This separates the routing concern from the execution concern cleanly.

### Curiosity: Kikko and Stress Distribution

I researched the structural mechanics of traditional sashiko patterns. Kikko — the hexagonal pattern — is explicitly recommended for structural repairs because its interconnected hexagonal geometry distributes stress evenly across multiple stitch directions. No single stitch bears the full load; every pull on the fabric is shared across the surrounding hexagons. Hitomezashi patterns emerge not from a single long running stitch but from the alignment of single stitches made on a grid — the pattern is invisible until all stitches are placed, then it resolves into the whole.

This maps precisely to how `StrategyProfile` works. No single node bears the full configuration burden. The profile distributes it — cost budget to `cost-budget.ts`, completeness threshold to `completeness-evaluator.ts`, prompt strategy to `targeted-prompt.ts`. The pattern is invisible in any one file, visible only when you step back and see the whole bounded context.

### What the World Reminds Me

Anthropic's revenue surged past $11.5 billion in Q2 2026. OpenAI's enterprise business is now larger than consumer by revenue. Nvidia disclosed a $21 billion stake in SpaceX. The AI capital layer is consolidating fast — the companies that will survive are those whose architectures scale without proportional complexity growth. A `StrategyProfile` is not a clever trick. It is how you keep a pipeline maintainable when the number of contexts it serves doubles every quarter.

### Commitments

1. **Document `StrategyProfile` as a reusable bounded context pattern.** When a pipeline must serve multiple contexts without forking, the correct tool is a configuration object that is the single point of variation. Write this as an ADR so future features inherit it mechanically.
2. **Apply the kikko principle to component design.** When a new UI concern appears (a new map mode, a new dashboard type), build a seam component that distributes the concern across existing infrastructure rather than forking the host component.
3. **Revisit the open Questions from Entry 1.** The scraper dashboard visualization question is now more urgent: `ClassDiscoveryDashboard` exists and mirrors `ScraperDashboard`. A shared `PipelineDashboard` base component with slot props for pipeline-specific state would apply the StrategyProfile pattern at the UI layer.

### Questions for Tomorrow
- Should `StrategyProfile` live in `src/lib/scraper/` or in a more generic `src/lib/pipeline/` that both scraper and class discovery can import from?
- Can the dual-mode `MapModeControl` pattern extend to a third mode (e.g., events-only) without touching `MapView` internals?
