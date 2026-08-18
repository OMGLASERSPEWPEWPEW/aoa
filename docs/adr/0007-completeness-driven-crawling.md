# ADR 0007: Scraper v3 — Completeness-Driven BFS Crawling

**Date:** 2026-08-17
**Status:** Accepted
**Feature:** Scraper v3: Completeness-Driven Crawling
**Graph:** `docs/graphs/scraper-v3.md`

---

## Context

The v2 scraper uses a deterministic strategy tree that follows up to 3 links from a venue's calendar page, using a targeted enrichment prompt to fill in missing fields for events already identified in the initial extraction pass. This was a meaningful improvement over v1's single-pass approach — it fills dates that live on linked show-detail pages.

However, class-oriented venues (Acting Studio Chicago, The Second City, iO Theater, etc.) organize their data differently than theater venues. Their class catalogs are spread across 5–10 subpages: one page for Acting I, a separate page for Acting II, a page for weekend workshops, a page for youth programs, etc. None of these subpages are linked directly from the class calendar — they are reached by navigating a multi-level menu hierarchy.

The v2 strategy tree was designed around the theater domain assumption: events appear on a calendar listing page, detail pages add dates. For classes, there is often no listing page — each subpage IS the listing page for a specific class, and the root page is just a navigation hub.

Three additional problems were identified during v0.16.x testing:

**Problem 1: The 3-link cap is arbitrary.**
The user explicitly challenged this: "Why do we have link limits?" The cap was introduced to prevent runaway crawling in the v2 design session, but it was never derived from actual venue page structures. Acting Studio Chicago's class catalog requires following at minimum 6 subpages to reach all class offerings.

**Problem 2: Dateless events are silently discarded.**
The current strategy tree filters events before the verification step with `events.filter(e => e.start_date != null)`. This filter was introduced to prevent verifying garbage, but it also discards legitimate class events that have no fixed start date (rolling enrollment, drop-in classes, ongoing programs). Classes are often dateless by design — they run "when enough students enroll."

**Problem 3: JS-rendered pages return empty cleaned HTML.**
Several class school sites render their course catalogs via React or similar — the raw HTML returned by a plain `fetch()` contains only a `<div id="root"></div>`. After `cleanHtml()`, this produces fewer than 100 characters and the scraper bails silently. No fallback mechanism exists.

**Problem 4: Link scoring mixes theater and class keywords without domain awareness.**
The current `extractCandidateLinks` function uses a single keyword set that includes both show keywords (`production`, `season`, `play`) and class keywords (`enroll`, `curriculum`). On class sites, `/education` is excluded from scoring even though it is the primary subpath for class catalogs. The `break` statement in the keyword scoring loop means only the first matched keyword contributes to the score, leaving multi-keyword URLs under-scored.

**External consultation (2026-08-17):**
An external panel was convened to assess whether the 3-link cap was a reasonable architectural limit:
- GPT-5.6 Sol: 0.98 confidence recommending BFS with discovery mode
- Gemini 2.5 Pro: 0.95 confidence recommending BFS with domain-aware link scoring
- Claude Opus 4.8: 0.78 confidence recommending BFS with per-site config as a fallback

All three panel members independently recommended BFS over a raised-cap approach. None recommended headless browser rendering as a first-line solution.

---

## Decision

Replace the fixed 3-link-cap link-following loop with a **BFS frontier crawler** controlled by a safety ceiling rather than a fixed count. The crawler continues until either the frontier is empty or the safety ceiling is hit.

The safety ceiling is defined in `CostBudget` defaults, not in the crawl loop itself. This decouples the "how far to crawl" question from the "how expensive is this run" question — operators can tune the budget without modifying the crawl algorithm.

In addition: add a **discovery mode** for class-domain crawls where following a subpage runs the full extraction prompt (not the targeted enrichment prompt) to find NEW events on that page, not just fill in missing fields for events already identified. Dedup by title across discovered events.

---

## Alternatives Considered

### Option A: Raise the Link Cap (3 → 10)

Keep the existing `prioritizeLinks(..., 3)` call, change the cap to 10.

**Pro:**
- Minimal code change. Low risk of regression.
- The existing link-follow logic already handles each followed link correctly.

**Con:**
- Still arbitrary. Why 10 and not 8 or 12? The same question that surfaced for 3 applies to any fixed number.
- Does not address the dateless event filter problem.
- Does not address JS-rendered pages.
- Does not introduce discovery mode — class subpages will still be processed with targeted enrichment against the initial event list, which is empty for class sites where the root page is a navigation hub.
- Acting Studio Chicago's class catalog was tested at cap=10 and still missed 3 deep subpages that require following a `/classes/` → `/classes/acting/` → `/classes/acting/level-1/` path. A cap of 10 happens to work for this specific site today but is not structurally sound.

**Decision:** Rejected. Does not address the structural problem.

### Option B: Headless Browser Rendering (Playwright / Puppeteer)

Deploy a Playwright or Puppeteer instance (via a Deno-compatible headless runtime) to render JS-heavy pages before extraction.

**Pro:**
- Solves the JS-rendering problem definitively. No more empty cleaned HTML on React-rendered sites.
- Would make the Jina fallback unnecessary.

**Con:**
- Playwright in a Deno Edge Function environment is not currently supported. The official Playwright library is Node.js/npm only. Deno compatibility via `npm:playwright` is experimental and has been broken by recent Deno version changes in the Supabase runtime.
- Even if Playwright ran, the cold start of launching a Chromium instance adds 8–15 seconds per venue scrape. The current scrape is ~20s per venue; headless rendering would push this to ~30–35s before any AI calls — near the Edge Function timeout limit.
- Increases cost significantly: Playwright binary is ~300MB. Supabase Edge Functions have a 50MB bundle limit.
- This is a different class of infrastructure decision that would require its own ADR and a custom Docker container approach, not an Edge Function change.

**Decision:** Rejected. Wrong layer for this problem. Jina Reader API provides JS rendering without deploying a headless browser.

### Option C: Per-Site Scraper Configs (CSS Selectors, XPaths)

Define a configuration record per venue (or per venue type) that specifies which CSS selectors or XPaths to use for extracting class data from that specific site's HTML.

**Pro:**
- Extremely precise. For a site like Second City whose HTML has been stable for years, a selector config would reliably extract every class.
- No AI cost for extraction on configured sites.

**Con:**
- Does not scale. There are ~12 class schools in Chicago now. Expanding to NYC adds ~40 more. Expanding to LA adds ~30 more. Per-site configs require a human to write and maintain them for every new school — a linear cost that defeats the purpose of an automated discovery system.
- Sites change their HTML. A selector-based config for Acting Studio Chicago would have broken 3 times in the past 18 months based on their redesigns.
- The app's philosophy is AI-driven discovery, not manual curation. Per-site configs move the maintenance burden back to the operator.
- Does not address JS-rendering or the dateless event filter.

**Decision:** Rejected. Does not scale to multi-city expansion.

### Option D (Chosen): BFS Frontier with Discovery Mode + Jina Reader Fallback

Replace the 3-link capped loop with a BFS queue. After each page is processed, add its extracted links to the frontier. Continue until frontier is empty or the `CostBudget` safety ceiling is hit.

For class-domain crawls, each followed page runs the full extraction prompt (discovery mode) to find new events, not just enrich existing ones. Discovered events are deduped by normalized title before being added to the accumulating event list.

For JS-rendered pages (detected by `cleanedHtml.length < 300` after a successful fetch), re-fetch through the Jina Reader API (`https://r.jina.ai/{url}`) which renders the page server-side and returns clean markdown. No headless browser required.

Remove the `events.filter(e => e.start_date != null)` gate before verification. Dateless events are valid and should flow through to storage with `extraction_status: 'no_dates_on_site'`.

**Pro:**
- BFS naturally handles arbitrary page depth without requiring foreknowledge of site structure.
- Discovery mode finds events on subpages that were never referenced from the root listing page — the exact failure mode for class school sites.
- Safety ceiling in `CostBudget` is the actual throttle — it is tunable without code changes.
- Jina Reader handles JS rendering without any new infrastructure.
- Dateless class events are preserved in the database for human review and future enrichment runs.
- All existing v2 logic (TIC crossref, completeness evaluator, strategy trace) is preserved and used.

**Con:**
- Scrape time per venue increases from ~20s to ~45s in the worst case (hitting the safety ceiling). Acceptable given the completeness gain.
- AI cost increases from ~$0.008/venue to ~$0.05/venue in full BFS mode. Acceptable at current scale (~50 venues). Will need monitoring as venue count grows.
- BFS could theoretically crawl an entire domain if link extraction is too permissive. The domain-same-origin filter in `extractCandidateLinks` prevents this — only same-domain links are considered — but it is a risk that must be respected by the safety ceiling.

**Decision:** Accepted.

---

## Consequences

### Positive

- **Complete class catalog coverage.** Acting Studio Chicago, Second City, iO, and similar multi-subpage school sites will return all class offerings per run, not a subset determined by which 3 links scored highest.
- **Dateless events preserved.** Rolling enrollment and drop-in classes that have no fixed start date will be stored as `extraction_status: 'no_dates_on_site'` rather than silently discarded.
- **JS-rendered sites handled.** Venues using React-rendered catalogs will receive a Jina Reader fallback, producing clean text for extraction.
- **Domain-aware link scoring.** Class site subpaths (`/education`, `/classes`, `/curriculum`) are now scored positively, not excluded. Theater site scoring is unchanged.
- **No per-site config maintenance.** Discovery scales to new cities without additional configuration.

### Negative

- **Longer scrape times.** Worst-case 45s per venue vs. 20s in v2. The safety ceiling can be tuned down if this becomes a problem.
- **Higher AI cost.** Discovery mode runs the full extraction prompt on each subpage, not the cheaper targeted prompt. ~$0.05/venue vs. $0.008. A full 50-venue run costs ~$2.50 vs. $0.40.
- **Safety ceiling must be set correctly.** Too low and BFS is no better than the cap. Too high and a runaway crawl could exceed budget. The recommended ceiling (20 AI calls, $0.10, 60s, 30 fetches) was derived from Acting Studio Chicago's class catalog structure (6 subpages × ~2 AI calls per page = 12 calls minimum to cover the site fully).

### Neutral

- The `StrategyProfile` domain distinction (`theater` vs `class`) continues to govern whether discovery mode or targeted mode is used for link follows. Theater scrapes continue to use targeted enrichment (cheaper, more focused). Class scrapes use discovery mode.
- The existing v2 graph (`docs/graphs/multi-pass-extraction.md`) remains valid as the spec for the shared `executeStrategyTree` function. The v3 graph documents only the delta nodes — changes to that function and the new modules it depends on.

---

## Implementation Notes

The BFS frontier replaces lines 373–430 of `supabase/functions/_shared/scraper/strategy-agent.ts` (the `for (const link of linksToFollow)` loop). After each followed page, `extractCandidateLinks` is called on the page's raw HTML and any new unvisited links are pushed to the frontier queue. The loop terminates when `budget.isExhausted()` or `frontier.length === 0`.

Discovery mode is activated when `effectiveProfile.domain === 'class'`. In discovery mode, `callDeepSeek` receives `buildExtractionPrompt(venue.name)` (full extraction) rather than `buildTargetedExtractionPrompt(...)` (targeted). New events from the response are title-deduped against `events` before being appended.

The Jina fallback fires after `cleanHtml()` when the result is fewer than 300 characters. The Jina URL is `https://r.jina.ai/${encodeURIComponent(url)}`. No API key is required for the public endpoint. The result is used as-is (Jina returns clean markdown, no HTML cleaning needed).

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-17 | Sashiko | Initial draft |
| 1.1 | 2026-08-17 | Sashiko | Addendum: URL Resolution (v3.1) |

---

## Addendum: URL Resolution (v3.1)

**Date:** 2026-08-17
**Status:** Accepted

### Context

After deploying scraper v3 (BFS crawling, discovery mode), 6/8 school venues still failed because `calendar_url` values were wrong (404, SSL, timeout). Manual URL fixes via SQL migrations were tried three times and failed each time — URLs change, domains expire, sites restructure. The scraper had no recovery mechanism: a single failed fetch killed the entire run for that venue.

Three external models (GPT-5.6 Sol 0.98, Gemini 0.95, Opus 0.88) independently identified the same root cause: fetchHtml throws inside Promise.all, preventing all downstream recovery from executing.

### Decision

Add a URL resolution stage that treats `calendar_url` as an unverified hint. Recovery uses available APIs (Perplexity, SerpAPI) to discover correct URLs when the stored URL fails. Successful recoveries self-heal the database record.

### Alternatives Considered

- **Manual URL maintenance via migrations**: Tried 3 times, failed each time. Does not scale to 300+ venues.
- **Headless browser to handle all sites**: Not available in Deno Edge Functions. Jina Reader provides partial coverage.
- **Per-venue scraper configs**: O(venues) maintenance cost, doesn't scale.
- **Periodic URL validation cron**: Detects dead URLs but doesn't fix them. Still requires manual intervention.

### Consequences

- **Positive**: Scraper self-heals when URLs break. No manual intervention needed.
- **Positive**: Perplexity provides human-level URL discovery ("find the classes page for X").
- **Negative**: Additional API cost (~$0.01 per Perplexity call). Bounded to recovery-only, not every venue.
- **Negative**: Perplexity/SerpAPI availability becomes a dependency. Mitigated by graceful fallback.
