# QA: Scraper v3 — Completeness-Driven Crawling

**Date:** 2026-08-17
**Scope:** `supabase/functions/_shared/scraper/`, `supabase/functions/class-discovery/`, `supabase/functions/event-scraper/`
**Entry:** Admin UI → "Discover Classes" button or "Run Scraper" button
**PRD:** `.claude/docs/prd/scraper-v3.md`
**Graph:** `docs/graphs/scraper-v3.md`

---

## Discovery Mode

- [ ] Scraping Acting Studio Chicago discovers classes from subpages (`/adult-acting-classes/core`, `/intermediate`, `/advanced`) — not just the index page
- [ ] Classes found on subpages appear in the `class_sessions` table with real titles (e.g., "Level 1: Introduction to Shurtleff")
- [ ] Each discovered event has `found_by` including `"link_follow"` when found on a subpage
- [ ] Events found on the seed page have `found_by` including `"venue_website"`
- [ ] Duplicate events (same title found on multiple pages) are merged, not duplicated
- [ ] Discovery works for both class domain AND theater domain

## Completeness-Driven Crawling (No Arbitrary Limits)

- [ ] A school with 9 class category pages has ALL categories crawled (not capped at 3)
- [ ] After visiting a subpage, links from THAT page are added to the BFS frontier
- [ ] Crawl stops when no unvisited relevant links remain in the frontier
- [ ] Crawl stops if safety ceiling hit: $0.10 cost OR 60 seconds wall time OR 20 AI calls
- [ ] A single empty page does NOT stop the entire crawl (no "no progress" early exit)
- [ ] The strategy trace logs every page visited and total cost

## Dateless Events

- [ ] Classes with no `start_date` are NOT silently dropped before verification
- [ ] Dateless classes appear in `class_sessions` table with `starts_on = NULL`
- [ ] Dateless classes go through the same verification/enrichment pass as dated events

## Photo Extraction

- [ ] The extraction prompt asks for `photo_url` for each event
- [ ] Events with photos on their page have `photo_url` populated (not null)
- [ ] `[img: URL]` tokens in cleaned HTML are preserved and visible to the AI
- [ ] Photo URLs are validated (HTTP/HTTPS only, no data: URLs)

## JSON-LD Extraction

- [ ] Pages with `<script type="application/ld+json">` have structured data extracted before HTML stripping
- [ ] JSON-LD Event/Course data is merged with AI extraction (JSON-LD wins for dates, prices, URLs)
- [ ] Pages without JSON-LD work normally (AI extraction only)
- [ ] Malformed JSON-LD doesn't crash the scraper

## Domain-Aware Link Scoring

- [ ] Class domain uses class keywords (beginner, intermediate, advanced, enroll, register, training, etc.)
- [ ] Theater domain uses theater keywords (show, production, ticket, performance, season, etc.)
- [ ] ALL matching keywords contribute to score (not just the first match)
- [ ] `/education` paths are NOT excluded (they contain valid class content)
- [ ] Social media links are still excluded

## Jina Reader Fallback

- [ ] If initial fetch returns < 300 chars of cleaned text, Jina Reader is used
- [ ] Jina response is used for extraction instead of raw HTML
- [ ] Jina fallback is logged in strategy trace as `"jina_fallback"` step
- [ ] If Jina API is down, scraper gracefully falls back to raw HTML (no crash)

## Source URL Tracking

- [ ] Events discovered on subpages have `source_url` set to that subpage's URL (not the seed calendar_url)
- [ ] Events discovered on the seed page have `source_url` set to the calendar_url
- [ ] The frontend show detail page shows a clickable link to the event's `source_url`

## Budget & Performance

- [ ] Average cost per venue is ≤ $0.05 across a full scrape run
- [ ] Average scrape time per venue is ≤ 45 seconds
- [ ] Weekly scrape of 100 venues completes in < 90 minutes
- [ ] Strategy trace includes total cost, pages visited, AI calls made, stop reason

## URL Resolution & Self-Correction

- [ ] A venue with a dead calendar_url (404) does NOT crash the scraper — enters recovery
- [ ] Recovery tries website_url as first fallback
- [ ] Recovery tries common paths (/classes, /schedule, /training, /events, /shows)
- [ ] Recovery queries Perplexity API for the correct URL when common paths fail
- [ ] Recovery queries SerpAPI with site-restricted search when Perplexity fails
- [ ] First candidate URL that returns 2xx AND ≥ 300 chars AND yields ≥ 1 event is adopted
- [ ] Recovered URL is written back to venues.calendar_url in the database (self-healing)
- [ ] Future scrape runs use the healed URL without needing recovery again
- [ ] A venue where ALL recovery attempts fail shows status "recovery_exhausted" (NOT "success")
- [ ] Strategy trace logs every URL attempted, HTTP status, content length, and extraction count
- [ ] SSL errors trigger recovery (not just 404)
- [ ] Timeout errors trigger recovery (not just 404)
- [ ] Perplexity results are domain-restricted (only URLs from the venue's own domain accepted)
- [ ] Recovery budget is bounded: ≤ 10 additional fetches, ≤ 1 Perplexity call, ≤ 1 SerpAPI call
- [ ] Total recovery cost per venue stays within the $0.10 safety ceiling

## Theater Regression

- [ ] Steppenwolf shows still scraped correctly (dates, prices, ticket URLs)
- [ ] Goodman Theatre shows still scraped correctly
- [ ] Theater Wit shows still scraped correctly
- [ ] TIC cross-referencing still works for theater domain
- [ ] Play matcher still runs for theater domain (not class domain)
- [ ] No existing events lost or duplicated after v3 scrape

## Class Pipeline Integration

- [ ] Scraped classes flow into `class_sessions` table via `processClassSessions()`
- [ ] `class_sessions` records have correct `school_id` linkage
- [ ] Skill level mapping works: beginner→1, intermediate→2, advanced→3
- [ ] Schedule field populated when available (e.g., "Mon 7–10pm")
- [ ] Map shows class markers with real data after scrape completes

## Regression Risks

- **High:** BFS could crawl too many pages on large theater sites (e.g., Broadway in Chicago). Mitigated by $0.10 safety ceiling.
- **Medium:** Changing `cleanHtml` return type from `string` to `{ cleaned, ldJsonEvents }` breaks all 3 call sites in strategy-agent.ts. Must update all simultaneously.
- **Medium:** Jina Reader API rate limits could throttle scraping if many venues need JS rendering.
- **Low:** Title dedup could merge distinct events with similar names (e.g., "Improv 101" at different schools).
