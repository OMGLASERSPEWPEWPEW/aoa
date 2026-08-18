# PRD: Scraper v3 — Completeness-Driven Crawling

**Document Version**: 1.1  
**Status**: Approved for Implementation  
**Author**: prd-specialist  
**Date**: 2026-08-17  
**Target Release**: v0.17.0  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [Problem Analysis](#3-problem-analysis)
4. [User Stories](#4-user-stories)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Technical Considerations](#7-technical-considerations)
8. [Files to Modify](#8-files-to-modify)
9. [Success Metrics](#9-success-metrics)
10. [Rollout Plan](#10-rollout-plan)
11. [Risks and Mitigations](#11-risks-and-mitigations)
12. [Open Questions](#12-open-questions)

---

## 1. Executive Summary

### Problem Statement

The Art of Art scraper v2 is a multi-pass strategy tree that fetches HTML from a single `calendar_url`, sends it to DeepSeek V4 Flash for extraction, follows up to 3 same-domain links to enrich known events, and verifies via a second AI pass. This design has seven structural gaps that cause silent data loss at every weekly scrape cycle:

1. Link-following enriches known events only — it cannot discover events that exist solely on subpages
2. A hardcoded 3-link cap means a school with 9 class categories returns at most 3 pages of classes
3. Events without `start_date` are filtered before verification, silently discarding entire classes catalogs
4. The extraction prompt does not request `photo_url` from inline `[img: ...]` tokens
5. JSON-LD structured data (`application/ld+json`) is stripped with all other tags before the AI sees the page
6. Link scoring favors theater vocabulary and penalizes class vocabulary (no `break` fix applied, `/education` path excluded)
7. JavaScript-rendered pages return cleaned text under 100 characters, triggering the "nothing to extract" early exit

Each gap compounds the others. A school whose class listing page is JS-rendered returns empty text, never gets link-followed, the subpage classes are never discovered, the dateless classes are dropped, and the result is zero sessions stored — even though the school's website has complete class data.

### Solution Overview

Scraper v3 replaces the fixed strategy tree with a Breadth-First Search (BFS) crawl frontier. Instead of following 3 pre-selected links to enrich known events, v3 discovers events on every relevant subpage it visits, adds candidate links found on those subpages back into the frontier, and continues until no unvisited relevant pages remain or the safety ceiling is reached. Seven targeted fixes address each of the root causes above.

### Business Impact

| Metric | v2 Baseline | v3 Target |
|--------|------------|-----------|
| Classes captured per school | 3–5 (capped) | All available (est. 8–15) |
| Events with photo_url | ~0% | 30–50% |
| Events with source_url to specific page | 0% | 100% |
| Silent class drops (dateless) | Unknown — untracked | 0 |
| JS-rendered sites processed | 0 (early exit) | ~90% via Jina fallback |
| Ready for NYC/LA expansion | No — link scorer theater-biased | Yes — domain-aware |

### Resource Requirements

- **Engineering effort**: 3–5 days (8 files modified, no new Edge Functions, no schema changes)
- **Ongoing AI cost**: $0.05/venue ceiling (6x increase from $0.008 average, 4x from $0.012 max — justified by completeness)
- **Jina Reader API**: Free tier — 1,000 requests/day; $0.001/request above that; at 100 venues/week, worst case ~100 Jina calls/week well within free tier
- **No new infrastructure**: All changes within existing Edge Functions, same Deno runtime, same DeepSeek model

### Risk Assessment

**High**: Per-venue cost increase (mitigated by $0.10 ceiling and early-exit when frontier exhausted)  
**Medium**: Wall-clock time per venue may exceed 45s for sites with many subpages (mitigated by 60s ceiling)  
**Low**: Jina API availability (mitigated by graceful fallback to raw HTML)

---

## 2. Product Overview

### Product Vision

The Art of Art scraper is the data backbone of the app. Every show a user tracks, every class a newcomer finds, every "next step" the mentor recommends — all depend on the scraper returning complete, accurate, photogenic event records. Scraper v3 treats completeness as the primary crawl termination criterion, not cost limits. The scraper should exhaust every reasonable page at a venue before stopping, within a generous safety ceiling, rather than stopping early because an arbitrary counter hit 3.

### Target Users

**Primary consumer of scraper output**: App users (newcomers to Chicago theater) who see venue pages, class listings, and show cards. They experience scraper gaps as missing events, blank photos, and broken "Sign Up" links.

**Secondary consumer**: The product owner (Deric) who reviews admin scrape reports and diagnoses data quality issues. He experiences scraper gaps as unexplained zero-event schools and incomplete field summaries.

**Indirect consumer**: The AI mentor (DeepSeek via `mentor-chat`), which recommends next steps based on available classes. Gaps in class data reduce mentor recommendation quality.

### Value Proposition

For the 100 Chicago venues currently scraped weekly, v3 will capture materially more events per venue run without any per-site configuration. When the scraper is extended to NYC and LA (~300+ venues), it works correctly on the first attempt because the crawl logic is domain-aware and site-agnostic.

### Assumptions

1. Jina Reader API (`https://r.jina.ai/{url}`) renders JavaScript via headless Chrome and returns clean Markdown text — confirmed by external panel (Gemini 3.5 Flash, confidence 0.95)
2. DeepSeek V4 Flash can extract events from Jina's Markdown output with equal accuracy as from `cleanHtml()` output
3. Most theater and school sites have fewer than 20 relevant subpages — the BFS frontier will exhaust naturally before the $0.10 ceiling is reached for the majority of venues
4. The existing `cleanHtml()` function already preserves `[img: url]` tokens — confirmed by reading `html-cleaner.ts` line 15: `(_, src) => \`[img: ${src}]\`` — the extraction prompt just needs to ask for it
5. JSON-LD parsing before tag stripping is safe and will not break existing HTML cleaning logic

---

## 3. Problem Analysis

### Root Cause Map

```
Gap 1: Subpage events invisible
  Cause: mergeTargetedExtraction() only fills fields on existing events; it never calls JSON.parse on discovered new events
  Evidence: strategy-agent.ts:411 — `const enrichments: TargetedEnrichment[] = parsed.enrichments ?? []` — no `events` field expected from link-follow calls

Gap 2: 3-link cap
  Cause: prioritizeLinks() called with maxLinks=3 (strategy-agent.ts:373)
  Evidence: `const linksToFollow = prioritizeLinks(candidateLinks, incompleteEvents, visitedUrls, 3)`

Gap 3: Dateless events discarded
  Cause: Verification splits events by start_date presence, gives split-off events confidence 0.4 and status "no_dates_on_site", but they are still returned
  Evidence: strategy-agent.ts:441 — `const eventsForVerify = events.filter(e => e.start_date != null)` — these events bypass the verification prompt entirely and receive no description/genre enrichment

Gap 4: No photo extraction
  Cause: extraction-prompt.ts schema does not include photo_url field; AI has no instruction to look for [img: ...] tokens
  Evidence: extraction-prompt.ts:10-27 — JSON schema shows no photo_url key

Gap 5: JSON-LD stripped
  Cause: html-cleaner.ts removes all <script> tags including ld+json before any parsing
  Evidence: html-cleaner.ts:5 — `/<(script|style|nav|footer|...)[\s\S]*?<\/\1>/gi` — script tags removed first

Gap 6: Theater-biased link scorer
  Cause: SHOW_KEYWORDS array has class keywords appended but the `break` after first match means only 1 keyword contributes; /education is in EXCLUDED_PATHS
  Evidence: link-extractor.ts:97-99 — `for (const keyword of SHOW_KEYWORDS) { if (lowerHref.includes(keyword)) { score += 5; break; } }`
  Evidence: link-extractor.ts:7 — `"/education"` in EXCLUDED_PATHS

Gap 7: JS-rendered sites
  Cause: fetchHtml() sends a plain HTTP GET; React/Vue/Angular apps return an empty shell; cleanHtml() returns < 100 chars; initial_extract step is skipped; events = [] triggers no_events stop
  Evidence: strategy-agent.ts:195 — `if (cleaned.length >= 100 && budget.canAffordAiCall())`
```

### External Panel Summary

Three models were consulted to validate the diagnosis and generate solution options. Consensus emerged on all seven gaps.

**GPT-5.6 Sol (confidence 0.98)**:
- Recommended splitting the pipeline into a discovery phase and an enrichment phase
- BFS frontier with domain-aware keyword scoring is the correct architectural change
- Cautioned against unbounded crawls — suggested a page-count ceiling as a safety net alongside dollar ceiling

**Gemini 3.5 Flash (confidence 0.95)**:
- Identified Jina Reader API as the correct JS-rendering solution for a Deno runtime where Puppeteer/Playwright are unavailable
- Recommended dynamic link limits based on domain type (theaters need fewer pages, schools need more)
- Noted that Jina returns Markdown which may require a prompt adjustment to handle `#` headings vs. HTML tokens

**Claude Opus 4.8 (confidence 0.78)**:
- Strongly recommended not discarding dateless events — classes rarely have start dates on listing pages
- Suggested breadth-first crawl specifically for class domains (all categories before going deep)
- Recommended JSON-LD extraction as a high-signal, low-cost improvement with zero AI call overhead

---

## 4. User Stories

### US-01: Discover All Class Sessions (Product Owner)

**As a product owner**, I want the scraper to find every class a school offers — not just the ones on the first calendar page — **so that** app users see the full curriculum and the mentor can recommend appropriate next steps.

**Acceptance Criteria:**

- Given Acting Studio Chicago has 9 class category pages (Core I, Core II, Advanced Scene Study, etc.)
- When the scraper runs on `actingstudiochicago.com/adult-acting-classes`
- Then all 9 categories are discovered and each class is stored as a `class_sessions` row
- And the `source_url` for each class points to the specific category page, not the root calendar URL
- And the scrape does not require any per-venue configuration to achieve this

---

### US-02: See Show Photos (App User)

**As a newcomer browsing shows**, I want to see a photo for each show or class **so that** I can quickly recognize which production I'm considering attending.

**Acceptance Criteria:**

- Given a venue show page includes an `<img>` tag with a production photo URL
- When the scraper processes that page
- Then the event record has `photo_url` populated with that image URL
- And the app's show card renders the image without additional work

---

### US-03: Find Source Page Link (App User)

**As a user who discovers a class through the app**, I want to click a link that takes me directly to the class listing page on the school's website **so that** I can read the full description and sign up.

**Acceptance Criteria:**

- Given a class was discovered on `actingstudiochicago.com/adult-acting-classes/core`
- When I view the class detail in the app
- Then the "Learn More" link points to `actingstudiochicago.com/adult-acting-classes/core`
- And NOT to the school's home page or generic calendar URL

---

### US-04: Scale to NYC Without Configuration (Product Owner)

**As a product owner expanding to NYC**, I want to add 200 New York theater and school venues to the scrape list **so that** the scraper works correctly on the first run without writing custom scrapers for each site.

**Acceptance Criteria:**

- Given a NYC venue is added with only `name`, `calendar_url`, and `website_url` fields
- When the weekly scrape batch processes it
- Then shows or classes are extracted without any per-venue scraper code
- And the link scorer uses theater or class keywords based on the venue's domain type
- And JS-rendered sites automatically fall through to the Jina API

---

### US-05: Monitor Crawl Completeness (Product Owner)

**As a product owner reviewing admin scrape reports**, I want to see exactly which pages were visited, how much each venue cost, and why the crawl stopped **so that** I can identify venues where the scraper is still missing data.

**Acceptance Criteria:**

- Given a scrape run completes for venue "Steppenwolf Theatre"
- When I view the admin scrape log for that run
- Then I can see: list of all pages visited, number of AI calls made, total cost in USD, stop reason ("frontier_exhausted" | "budget_cost" | "budget_time" | "budget_calls" | "no_events")
- And each event row shows `source_url` pointing to the specific page it was found on

---

### US-06: Dateless Classes Preserved (Product Owner)

**As a product owner**, I want dateless classes (ongoing programs with no fixed start date) to appear in the app **so that** newcomers who want to join an ongoing class can discover and sign up.

**Acceptance Criteria:**

- Given a class listing page shows "Core Acting I — Ongoing, register anytime" with no start date
- When the scraper processes that page
- Then the class is stored in `class_sessions` with `starts_on = null`
- And the class record has a description, skill level, and instructor name if present on the page
- And the class is NOT silently dropped during verification

---

## 5. Functional Requirements

### 5.1 Discovery Mode

**FR-01** — When following a subpage link, the AI extraction call MUST return both newly discovered events on that page AND enrichments for known events. The prompt for link-follow calls MUST be updated to request a `{ "events": [...], "enrichments": [...] }` response shape instead of `{ "enrichments": [...] }` only.

*Testable:* Given a page containing a class not in the current events list, the link-follow AI call returns it in the `events` array; after merge, the class appears in `mergedEvents`.

**FR-02** — Newly discovered events found on subpages MUST be merged into the main events list using case-insensitive title deduplication. If a title already exists in the list (case-insensitive match), the new event does not create a duplicate; its fields are used to enrich the existing record instead.

*Testable:* Given "Core Acting I" is already in the list and a subpage returns an event titled "core acting i", after merge the list contains exactly one record with that title.

**FR-03** — Every event MUST track the URL(s) from which it was discovered in a `found_by` array field (already present on `MergedEvent`). Events discovered on a subpage include that subpage's URL in `found_by`. Events discovered on the root calendar page include `"venue_website"`. Events from TIC include `"tic"`.

*Testable:* An event found on `actingstudiochicago.com/adult-acting-classes/core` has `found_by = ["subpage:actingstudiochicago.com/adult-acting-classes/core"]`.

---

### 5.2 Completeness-Driven Crawling (BFS Frontier)

**FR-04** — The hardcoded 3-link cap (`prioritizeLinks(..., 3)`) MUST be removed. The crawl continues until no unvisited relevant links remain in the BFS frontier, OR the safety ceiling is reached (FR-05).

*Testable:* Given 9 class category pages exist on a school site, all 9 are fetched and extracted during a single scrape run without any configuration change.

**FR-05** — The safety ceiling for a single venue scrape MUST be raised to: `maxAiCalls = 20`, `maxUsd = 0.10`, `wallClockMs = 60_000`. Fetch count limit is removed (unbounded, constrained by time and cost ceilings only). These replace the existing defaults of `maxAiCalls = 6`, `maxFetches = 5`, `maxUsd = 0.012`, `wallClockMs = 120_000`.

*Testable:* A venue with 15 relevant subpages exhausts the frontier and returns `stopReason = "frontier_exhausted"` without triggering `budget_cost` or `budget_calls`.

**FR-06** — After fetching and extracting a subpage, the system MUST extract candidate links from THAT subpage's raw HTML and add new, unvisited, relevant links to the BFS frontier. This enables multi-hop discovery (calendar page → category page → individual class page).

*Testable:* Given page A links to page B, and page B links to page C (not linked from A), all three pages are fetched and extracted in a single run.

**FR-07** — The "no progress" early exit (`noProgressCount >= 2` halting the crawl) MUST be removed. An empty page in the frontier does not stop the crawl — the system continues to the next queued page.

*Testable:* Given two consecutive link-follow calls return zero new fields, the crawl does NOT stop; it continues to the next link in the frontier.

---

### 5.3 Dateless Events

**FR-08** — Events with `start_date = null` MUST NOT be filtered out before the verification pass. The line `const eventsForVerify = events.filter(e => e.start_date != null)` MUST be removed. All events go through the same verification pass.

*Testable:* Given a class with no start date extracted in Pass 1, the verification prompt receives that class; after verification, the class has a `description` and `genre_tags` populated.

**FR-09** — Dateless events processed through verification MUST receive the same enrichment as dated events: `description`, `genre_tags`, `cast_members`, `photo_url`, and a `confidence` score. Their `extraction_status` MUST NOT be hardcoded to `"no_dates_on_site"` if they were verified; instead it reflects the completeness score from `evaluateCompleteness()`.

*Testable:* A verified dateless class has `description != null` and `confidence > 0.4` in the merged event record.

---

### 5.4 Photo Extraction

**FR-10** — The extraction prompt schema (`extraction-prompt.ts`) MUST include a `photo_url` field in the event JSON schema. The field description MUST instruct the AI to extract URLs from `[img: https://...]` tokens in the cleaned text.

*Testable:* Given a page with `[img: https://example.com/photo.jpg]` in the cleaned text, the AI returns `"photo_url": "https://example.com/photo.jpg"` in the extracted event.

**FR-11** — The AI MUST extract `photo_url` from `[img: ...]` tokens already preserved by `html-cleaner.ts`. No changes to the HTML cleaner are required for this — the tokens are already in the text. The extraction prompt is the only file that needs updating for photo capture.

*Testable:* The `html-cleaner.ts` output for a page containing `<img src="https://venue.com/show.jpg">` contains `[img: https://venue.com/show.jpg]`, confirming the token is available for extraction without cleaner changes.

**FR-12** — Each event record MUST store its own `photo_url` independently. Events on the same venue page may have different photos. The venue-level `photo_url` field on the `venues` table is unaffected by this change.

*Testable:* Two events on the same page with different production photos are stored with their respective `photo_url` values.

---

### 5.5 JSON-LD Extraction

**FR-13** — Before stripping HTML tags in `html-cleaner.ts`, the system MUST parse all `<script type="application/ld+json">` blocks and extract their content as structured data.

*Testable:* Given a page with `<script type="application/ld+json">{"@type":"Event","name":"Hamlet",...}</script>`, the cleaner extracts the JSON block before stripping tags.

**FR-14** — The system MUST extract data from the following Schema.org types: `Event`, `Course`, `EducationEvent`, and `ImageObject`. For each type, the relevant fields are:
- `Event` / `EducationEvent`: `name`, `startDate`, `endDate`, `offers.price`, `offers.url`, `image`
- `Course`: `name`, `provider`, `offers.price`, `url`, `image`
- `ImageObject`: `url`, `contentUrl`

*Testable:* A page with a JSON-LD `Event` schema returns a structured data object with `name`, `startDate`, and `offers.price` extracted without any AI call.

**FR-15** — JSON-LD data MUST be merged with AI-extracted data, with JSON-LD taking precedence for the following fields: `start_date`, `end_date`, `price_min`, `price_max`, `ticket_url`, `photo_url`. AI-extracted fields not present in JSON-LD are preserved as-is.

*Testable:* Given JSON-LD has `startDate: "2026-09-01"` and the AI extracted `start_date: "2026-09-15"`, the merged event has `start_date: "2026-09-01"`.

---

### 5.6 Domain-Aware Link Scoring

**FR-16** — The `prioritizeLinks()` function signature MUST accept a `domain` parameter (`"theater" | "class"`). The calling code in `strategy-agent.ts` passes `effectiveProfile.domain` when invoking `prioritizeLinks`.

*Testable:* A class-domain venue uses class keywords for scoring; a theater-domain venue uses theater keywords.

**FR-17** — Theater domain keywords for link scoring MUST be: `show`, `production`, `event`, `ticket`, `performance`, `season`, `play`, `musical`. These keywords score +5 per match in the link URL or anchor text.

*Testable:* A link with URL `/2026-season/hamlet` scores +5 for "season" and +5 for "hamlet" is not in theater keywords so no match — correct behavior confirmed.

**FR-18** — Class domain keywords for link scoring MUST be: `class`, `course`, `level`, `beginner`, `intermediate`, `advanced`, `enroll`, `register`, `training`, `adult`, `workshop`, `schedule`, `program`, `curriculum`, `instructor`. These keywords score +5 per match in the link URL or anchor text.

*Testable:* A link with URL `/adult-acting-classes/beginner` scores +10 (two keyword matches: `adult` and `beginner`) in class domain.

**FR-19** — The `break` statement after the first keyword match in the scoring loop MUST be removed. Every matching keyword contributes +5 to the score. A link URL containing both "class" and "beginner" scores +10, not +5.

*Testable:* Given `for (const keyword of keywords) { if (href.includes(keyword)) { score += 5; /* no break */ } }`, a URL with two matching keywords receives +10.

**FR-20** — `/education` MUST be removed from the `EXCLUDED_PATHS` array. Education pages are high-value targets for class discovery and must not be filtered.

*Testable:* A link with path `/education/adult-programs` is NOT excluded and IS eligible for scoring and follow.

---

### 5.7 JavaScript Rendering Fallback

**FR-21** — After `cleanHtml()` is applied to the initial fetch, if the resulting cleaned text length is less than 300 characters, the system MUST re-fetch the URL via the Jina Reader API: `GET https://r.jina.ai/{url}` with no additional transformation.

*Testable:* Given `actingstudiochicago.com/adult-acting-classes` returns an empty React shell (`cleanHtml()` output < 300 chars), the system issues a request to `https://r.jina.ai/https://actingstudiochicago.com/adult-acting-classes`.

**FR-22** — The Jina API response MUST be used as the extraction input in place of the `cleanHtml()` output. No additional HTML cleaning is applied to the Jina response, as Jina already returns clean Markdown text.

*Testable:* Given Jina returns Markdown with class listings, the extraction prompt receives that Markdown and returns populated event objects.

**FR-23** — When the Jina fallback is triggered, the system MUST log a structured event with `{ type: "jina_fallback", url, original_chars: number, venue_name: string }` to the existing console logging infrastructure used throughout `strategy-agent.ts`.

*Testable:* Running the scraper on a JS-rendered site produces a console log line containing `"jina_fallback"` and the venue name.

---

### 5.8 Source URL Tracking

**FR-24** — Every event stored in `events` or `class_sessions` MUST have `source_url` set to the specific page URL from which it was extracted, not the venue's generic `calendar_url`. Events found on the root calendar page use that page's URL. Events found on a subpage use the subpage URL.

*Testable:* A class extracted from `actingstudiochicago.com/adult-acting-classes/core` has `source_url = "https://actingstudiochicago.com/adult-acting-classes/core"`.

**FR-25** — The `MergedEvent` type MUST include a `source_url` field (`string | null`). The strategy agent populates this field during event discovery. The `processVenue()` and `processClassSessions()` functions write it to the database. The existing hardcoded `source_url: venue.calendar_url` in `process-venue.ts:98` MUST be replaced with `source_url: event.source_url ?? venue.calendar_url`.

*Testable:* After a scrape run, querying `SELECT source_url FROM events WHERE venue_id = X` returns URLs pointing to specific pages, not all the same `calendar_url`.

---

### 5.9 Budget Transparency

**FR-26** — The `StrategyTrace` type and `buildTrace()` function MUST log: (a) every page visited with its URL, (b) every AI call with input/output tokens and cost, (c) total cost in USD, (d) stop reason as one of: `"frontier_exhausted"`, `"budget_cost"`, `"budget_time"`, `"budget_calls"`, `"no_events"`, `"complete"`.

*Testable:* The `strategy_trace` column in `scrape_logs` contains a JSON object with `linksFollowed` listing all visited URLs, `budgetUsed` as a dollar amount, and `stopReason` as a string.

**FR-27** — The admin scrape ribbon/dashboard MUST display per-venue: pages visited count, AI calls made, total cost in USD, and stop reason. This surfaces the `strategy_trace` data already written to `scrape_logs`.

*Testable:* The admin UI shows "Pages: 7 | AI Calls: 9 | Cost: $0.023 | Stop: frontier_exhausted" for a venue that was fully crawled.

---

### 5.10 Self-Correcting URL Resolution

**FR-28** — The initial `fetchHtml(venue.calendar_url)` call in `executeStrategyTree` (line 185 of strategy-agent.ts) MUST be wrapped in its own try/catch. A 404, SSL error, timeout, or DNS failure MUST NOT throw to the caller. Instead, the error is captured and the system enters URL recovery.

*Testable:* Given a venue with `calendar_url` returning 404, the `executeStrategyTree` function does NOT throw. Instead, it enters recovery and attempts alternative URLs.

**FR-29** — When the seed fetch fails OR returns cleaned text < 300 chars OR AI extraction returns 0 events, the system MUST enter a URL recovery phase. Recovery attempts in order:
1. Try `venue.website_url` if different from `calendar_url`
2. Try common class/event paths appended to the domain: `/classes`, `/schedule`, `/training`, `/education`, `/events`, `/shows`, `/whats-on`
3. Query Perplexity API: "What is the current URL for classes/events at {venue.name} in Chicago?"
4. Query SerpAPI: `site:{domain} classes schedule events`
5. For each candidate URL: fetch, check content length >= 300, run AI extraction. Stop at first URL that yields >= 1 event.

*Testable:* Given Acting Studio Chicago with a dead `calendar_url`, the system tries `/classes`, then Perplexity, finds `actingstudiochicago.com/adult-acting-classes/`, fetches it, extracts classes.

**FR-30** — A new function `resolveVenueUrl(venue: VenueTarget): Promise<ResolvedUrl>` MUST be created at `supabase/functions/_shared/scraper/url-resolver.ts`. It takes a venue and returns `{ url: string, source: 'calendar_url' | 'website_url' | 'common_path' | 'perplexity' | 'serpapi', html: string }`. The function tries each recovery step in order, returning the first URL that responds with 2xx and content >= 300 chars.

*Testable:* `resolveVenueUrl({ calendar_url: 'https://example.com/dead-link', website_url: 'https://example.com', name: 'Test School' })` returns a resolved URL from one of the fallback strategies.

**FR-31** — The Perplexity API integration MUST use the `sonar` model via `POST https://api.perplexity.ai/chat/completions` with:
- System prompt: "Return only the URL. No explanation."
- User prompt: "What is the current URL for the classes/events schedule page at {venue.name} ({domain})? Return the most specific URL that lists their current classes or shows."
- Parse the response for URLs matching the venue's domain.
- Perplexity API key MUST be set as a Supabase secret (`PERPLEXITY_API_KEY`).

*Testable:* Calling Perplexity with "Acting Studio Chicago" returns a URL containing `actingstudiochicago.com`.

**FR-32** — The SerpAPI integration for URL recovery MUST reuse the existing pattern from `class-discovery/index.ts` lines 78-88. Query: `site:{domain} {classKeywords}` where classKeywords are "classes schedule events register enroll". Extract organic_results[].link values. Filter to same-domain only.

*Testable:* SerpAPI query `site:actingstudiochicago.com classes schedule` returns URLs from that domain.

**FR-33** — When a recovered URL successfully yields events, the system MUST update `venues.calendar_url` in the database to the working URL. This self-heals the venue record for future scrape runs.

*Testable:* After recovery finds `actingstudiochicago.com/adult-acting-classes/`, the venues table row for Acting Studio Chicago has `calendar_url` updated to that URL.

**FR-34** — The scraper MUST NOT report `status: "success"` when 0 events are found. If all recovery attempts are exhausted and 0 events remain, the status MUST be `"recovery_exhausted"`. The strategy trace MUST log every URL attempted, its HTTP status, content length, and extraction count.

*Testable:* A venue where all URLs fail has `status = "recovery_exhausted"` in scrape_logs, NOT `"success"`. The `strategy_trace` JSON shows all attempted URLs.

**FR-35** — URL recovery attempts MUST be bounded: max 5 common-path probes, max 1 Perplexity call, max 1 SerpAPI call (returning up to 5 candidate URLs). Total recovery budget: 10 additional fetches, 1 additional AI call (for Perplexity), within the existing $0.10/60s safety ceiling.

*Testable:* Recovery for a venue with ALL dead URLs completes in < 15 seconds and costs < $0.01.

---

## 6. Non-Functional Requirements

**NFR-01 — Performance**: Average scrape time per venue MUST be at or below 45 seconds. The 60-second wall clock ceiling (FR-05) provides a hard bound. Venues with fewer than 5 relevant subpages should complete in under 20 seconds, consistent with v2 performance.

*Measurement*: `duration_ms` field in `scrape_logs`, averaged over 100 venues per weekly run.

**NFR-02 — Cost**: Average cost per venue MUST NOT exceed $0.05 (500% of the v2 average of $0.008, justified by completeness gains). Individual venue ceiling is $0.10 (FR-05). Weekly scrape of 100 venues MUST stay within $5.00 total.

*Measurement*: Sum of `ai_input_tokens * 0.10 + ai_output_tokens * 0.28` per venue run, divided by 1,000,000.

**NFR-03 — Throughput**: The weekly scrape batch MUST process 100 venues in under 90 minutes. Given 45s average per venue and batching, this requires at least 5 venues running in parallel (current: concurrent via `event-scrape-batch`).

*Measurement*: Batch run end time minus start time, logged in `scrape_run_logs`.

**NFR-04 — Zero Configuration**: Adding a new venue MUST require only `name`, `calendar_url`, `website_url`, and `domain` (theater/class). No per-venue scrapers, selectors, or keyword overrides. v3 MUST handle Chicago, NYC, and LA venues with the same code path.

*Measurement*: Passing a NYC venue through the scraper with no config changes returns events. Tested on 5 NYC venues before NYC launch.

**NFR-05 — Graceful Degradation**: If the Jina Reader API returns a non-200 response or times out, the system MUST fall back to the raw `cleanHtml()` output (even if < 300 chars) and continue the extraction attempt. No error is thrown; a warning is logged.

*Measurement*: Simulating Jina API failure (mock returning 500) causes scraper to log a warning and continue, not crash.

**NFR-06 — Backward Compatibility**: All existing `MergedEvent` fields retain their types and semantics. The `source_url` and `photo_url` fields were already present in the database schema (`events.source_url`, `events.photo_url`). No migration required.

*Measurement*: Running v3 against the existing DB schema without any migration produces no type errors and no failed inserts.

**NFR-07 — Observability**: Every new code path introduced in v3 MUST produce at least one console log line with the venue name, URL, and action taken. This ensures that when a scrape produces unexpected results, the admin can trace the crawl path from logs.

*Measurement*: Code review confirms all new branches (Jina fallback, JSON-LD extraction, BFS frontier expansion, discovery merge) have log statements.

---

## 7. Technical Considerations

### 7.1 Architecture Overview

The v3 architecture keeps the same Edge Function entry points (`event-scraper`, `class-discovery`) and the same `processVenue()` orchestrator. The strategy agent (`strategy-agent.ts`) is the primary site of change. The existing 4-step linear tree becomes a 3-phase BFS loop:

```
Phase A: Seed
  1. Fetch calendar_url (with Jina fallback if JS-rendered)
  2. Extract JSON-LD from raw HTML
  3. Run Pass 1 AI extraction on cleaned text
  4. Merge JSON-LD into Pass 1 events
  5. Add calendar_url to visitedUrls; add candidate links to BFS frontier

Phase B: BFS Crawl (repeat until frontier empty or ceiling hit)
  For each link in frontier (priority order):
    1. Fetch URL (with Jina fallback)
    2. Extract JSON-LD from raw HTML
    3. Run Pass 1 AI extraction (discovery mode: return new events + enrichments)
    4. Merge newly discovered events into main list (title dedup)
    5. Apply enrichments to existing events
    6. Merge JSON-LD into merged events
    7. Extract candidate links from this page; add unvisited relevant links to frontier

Phase C: Verify
  1. Run Pass 2 verification on ALL events (dated and dateless)
  2. Merge verification results
  3. Apply source_url and photo_url to each event
```

### 7.2 BFS Frontier Data Structure

The frontier is a priority queue ordered by link score (descending). The `CandidateLink` type already has a `score` field. The implementation uses a simple sorted array re-sorted after each insertion:

```typescript
// In strategy-agent.ts
const frontier: CandidateLink[] = [];
const visitedUrls = new Set<string>();

function addToFrontier(links: CandidateLink[], domain: "theater" | "class"): void {
  for (const link of links) {
    const normalized = normalizeUrl(link.url);
    if (!visitedUrls.has(normalized)) {
      frontier.push(link);
    }
  }
  frontier.sort((a, b) => b.score - a.score);
}
```

This is O(n log n) per page but frontier size is bounded (~20 links per page × ~10 pages = ~200 total). Performance is not a concern.

### 7.3 Discovery Mode Prompt Change

The targeted extraction prompt (`targeted-prompt.ts`) currently asks for `{ "enrichments": [...] }`. In v3, it MUST ask for:

```json
{
  "events": [
    { "title": "...", "event_type": "...", "start_date": "..." }
  ],
  "enrichments": [
    { "title": "...", "start_date": "..." }
  ]
}
```

The `events` array contains NEW events found on the page not matching any title in the known list. The `enrichments` array contains field updates for events already in the known list. This is a breaking change to `targeted-prompt.ts` — the response parsing in `strategy-agent.ts` must be updated in the same PR.

### 7.4 JSON-LD Extraction Function

A new function `extractJsonLd(rawHtml: string): JsonLdData` is added to `html-cleaner.ts`. It runs before the existing tag-stripping regex chain:

```typescript
interface JsonLdData {
  name: string | null;
  startDate: string | null;
  endDate: string | null;
  priceMin: number | null;
  priceMax: number | null;
  offerUrl: string | null;
  imageUrl: string | null;
}

export function extractJsonLd(rawHtml: string): JsonLdData[]
```

The function uses a regex to find all `<script type="application/ld+json">...</script>` blocks, parses each as JSON, and extracts fields from `Event`, `Course`, `EducationEvent`, and `ImageObject` types.

### 7.5 Jina API Integration

The Jina Reader API requires no API key for the free tier. The request format is:

```
GET https://r.jina.ai/{full_url}
Headers: Accept: text/plain
```

The function `fetchWithJinaFallback(url: string): Promise<string>` wraps the existing `fetchHtml()`. It calls `fetchHtml()`, runs `cleanHtml()`, checks the character count, and conditionally issues a Jina request. The Jina response is used directly as the extraction input (no further cleaning).

The 300-character threshold for triggering Jina was chosen based on the current early-exit threshold of 100 characters in `strategy-agent.ts:195`. A page that returns 100–299 characters after cleaning is likely a JavaScript shell with minimal content — enough to pass the current check but not enough for meaningful extraction. The higher threshold catches these cases.

### 7.6 source_url on MergedEvent

`MergedEvent` interface gains one field:

```typescript
source_url: string | null;   // The page URL this event was discovered on
```

In `strategy-agent.ts`, when an event is first added to the events list, its `source_url` is set to the URL of the page being processed at that moment. This is tracked in a `Map<string, string>` alongside `foundByMap`.

In `process-venue.ts:98`, the database row construction changes from:
```typescript
source_url: venue.calendar_url,
```
to:
```typescript
source_url: event.source_url ?? venue.calendar_url,
```

### 7.7 Cost Model

At DeepSeek V4 Flash pricing ($0.10/M input, $0.28/M output, per `cost-budget.ts`):

| Operation | Est. Input Tokens | Est. Output Tokens | Cost |
|-----------|------------------|-------------------|------|
| Pass 1 extraction (30K chars) | 8,000 | 1,000 | $0.0011 |
| Link-follow extraction (15K chars) | 4,000 | 800 | $0.0006 |
| Verification (10 events) | 3,000 | 1,500 | $0.0007 |
| JSON-LD merge | 0 (no AI) | 0 | $0 |
| Jina fetch | 0 (no AI) | 0 | $0 |

For a school with 9 category pages:
- 1 initial extract + 9 link-follow extracts + 1 verification = 11 AI calls
- Estimated cost: $0.0011 + (9 × $0.0006) + $0.0007 = $0.0072
- Well within $0.10 ceiling; above $0.012 v2 ceiling but acceptable

For a theater with 3 subpages:
- 1 initial extract + 3 link-follow extracts + 1 verification = 5 AI calls
- Estimated cost: $0.0011 + (3 × $0.0006) + $0.0007 = $0.0036
- Below v2 ceiling of $0.012

The $0.10 ceiling is a safety net for pathological cases (site with 50+ pages). In practice, 95%+ of venues are expected to cost under $0.02.

### 7.8 Technology Stack

No changes to infrastructure. All modifications are within:
- Deno runtime (Supabase Edge Functions)
- DeepSeek V4 Flash API (existing)
- Jina Reader API (new, no credentials required)
- Supabase PostgreSQL (no schema changes)

### 7.9 URL Resolution Architecture

`resolveVenueUrl` is the single entry point for all URL resolution logic. It is called at the start of `executeStrategyTree` in place of the bare `fetchHtml(venue.calendar_url)` call. The function encapsulates all recovery strategies and returns a `ResolvedUrl` object that the strategy agent uses as its seed input — no callers need to know which strategy succeeded.

**Recovery strategy order:**

1. **calendar_url** — standard first attempt; captures the nominal case with no overhead
2. **website_url** — only tried if distinct from `calendar_url`; often the homepage links to the correct subpage
3. **common_path probes** — up to 5 paths (`/classes`, `/schedule`, `/training`, `/education`, `/events`, `/shows`, `/whats-on`) appended to the venue's root domain; each probed with a plain HTTP GET
4. **Perplexity sonar** — a single API call returns a specific URL from Perplexity's web index; domain-filtered before use
5. **SerpAPI** — reuses the existing `class-discovery/index.ts` pattern; returns up to 5 organic result URLs from the venue's domain

**Self-healing database update:**

When a recovery strategy succeeds (returns >= 1 event after AI extraction), `resolveVenueUrl` issues a Supabase update before returning:

```typescript
await supabase
  .from("venues")
  .update({ calendar_url: resolvedUrl })
  .eq("id", venue.id);
```

This update runs only once per successful recovery, not on every scrape. Subsequent runs will use the corrected `calendar_url` and hit the fast path.

**Perplexity API request format:**

```typescript
const response = await fetch("https://api.perplexity.ai/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "sonar",
    messages: [
      { role: "system", content: "Return only URLs. No explanation." },
      { role: "user", content: `What is the current URL for the classes/events page at ${venue.name} (${domain})?` }
    ],
    max_tokens: 200,
  }),
});
```

The response `choices[0].message.content` is scanned for URLs (regex `https?://[^\s]+`) and filtered to those whose hostname matches or is a subdomain of the venue's root domain. If no domain-matching URL is found, Perplexity is treated as returning no result and SerpAPI is tried next.

**SerpAPI reuse pattern:**

The SerpAPI call mirrors `class-discovery/index.ts` lines 78–88 exactly. The query is constructed as `site:{domain} classes schedule events register enroll`. `organic_results[].link` values are extracted and filtered to same-domain URLs before being probed as candidates. This reuse ensures SerpAPI error handling, timeout, and logging remain consistent with the existing integration.

**Strategy trace entries for recovery:**

Each recovery attempt appends a structured entry to the strategy trace:

```json
{
  "step": "url_recovery",
  "source": "common_path | perplexity | serpapi",
  "url": "https://...",
  "http_status": 200,
  "content_length": 4821,
  "events_found": 3
}
```

These entries are included in the `strategy_trace` column written to `scrape_logs`, giving full visibility into which strategy unblocked a venue.

---

## 8. Files to Modify

| File | Lines | Change Summary | Breaking Change? |
|------|-------|---------------|-----------------|
| `strategy-agent.ts` | 553 | Replace linear tree with BFS frontier; discovery mode merge; Jina fallback; remove dateless filter; populate source_url per event | Yes — internal logic |
| `targeted-prompt.ts` | ~60 | Return `{ events: [...], enrichments: [...] }` instead of `{ enrichments: [...] }` | Yes — response shape |
| `extraction-prompt.ts` | 69 | Add `photo_url` field to schema; add instruction to extract `[img: ...]` tokens | No |
| `link-extractor.ts` | 139 | Domain-aware scoring; remove `break`; remove `/education` from EXCLUDED_PATHS; accept `domain` param | No |
| `html-cleaner.ts` | 39 | Add `extractJsonLd()` function before tag stripping; export separately | No |
| `cost-budget.ts` | 65 | Raise defaults: `maxAiCalls: 20`, `maxUsd: 0.10`, `wallClockMs: 60_000`; remove `maxFetches` limit | No |
| `types.ts` | 322 | Add `photo_url` to `Pass1Event`; add `source_url` to `MergedEvent`; add `"discovery"` to `StrategyStep.step` union | No |
| `process-venue.ts` | 227 | Use `event.source_url ?? venue.calendar_url` instead of hardcoded `venue.calendar_url` | No |

### Files NOT Modified

| File | Reason |
|------|--------|
| `completeness-evaluator.ts` | No changes needed — evaluator logic is correct |
| `verification-prompt.ts` | No changes needed — verification already handles all event types |
| `tic-lookup.ts` / `tic-parser.ts` | TIC integration is correct and unchanged |
| `process-venue.ts` `processClassSessions()` | `source_url` is already passed as a parameter — no change needed |
| `event-scraper/index.ts` | No interface changes required |
| `class-discovery/index.ts` | No interface changes required |
| Database schema | No migrations required — `source_url` and `photo_url` columns already exist on `events` |

---

## 9. Success Metrics

### Primary Metrics (measure after first weekly run post-release)

| Metric | Baseline (v2) | Target (v3) | Measurement |
|--------|--------------|------------|-------------|
| Average events per school venue | 3–5 | 8–15 | `AVG(events_found)` in `scrape_logs` WHERE venue is school domain |
| Events with `photo_url` populated | ~0% | 30–50% | `COUNT(*) WHERE photo_url IS NOT NULL / COUNT(*)` in `events` |
| Events with source_url != calendar_url | 0% | 40–70% | `COUNT(*) WHERE source_url != v.calendar_url` JOINed to venues |
| Dateless class_sessions retained | Unknown | Tracked (> 0) | `COUNT(*) WHERE starts_on IS NULL` in `class_sessions` |
| Venues with stop_reason = "frontier_exhausted" | N/A (not tracked) | > 70% | `COUNT(*) WHERE strategy_trace->>'stopReason' = 'frontier_exhausted'` in `scrape_logs` |
| Average cost per venue | $0.008 | < $0.05 | `SUM(ai_input_tokens * 0.10 + ai_output_tokens * 0.28) / 1000000 / COUNT(*)` |

### Secondary Metrics (review after 4-week steady state)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Jina fallback rate | < 20% of venues | Count of `jina_fallback` log entries per run |
| JSON-LD hit rate | > 10% of venues | Count of venues where JSON-LD extraction returned at least one field |
| Weekly batch completion time | < 90 minutes | `scrape_run_logs.completed_at - started_at` |
| Total weekly cost | < $5.00 | Sum of per-venue costs |

### Failure Conditions (trigger rollback)

- Average cost per venue exceeds $0.08 on first production run
- Batch completion time exceeds 120 minutes
- Any venue produces an uncaught exception (not a data gap — a runtime error)
- Event deduplication failure causes duplicate rows in `events` table

---

## 10. Rollout Plan

### Phase 1: Development (Days 1–3)

1. Modify `html-cleaner.ts` — add `extractJsonLd()` (isolated, no dependencies)
2. Modify `extraction-prompt.ts` — add `photo_url` field
3. Modify `link-extractor.ts` — domain-aware scoring, remove break, remove /education
4. Modify `cost-budget.ts` — raise safety ceiling
5. Modify `types.ts` — add `photo_url` to `Pass1Event`, `source_url` to `MergedEvent`
6. Modify `targeted-prompt.ts` — discovery mode response shape

### Phase 2: Strategy Agent Rewrite (Days 3–4)

7. Rewrite `strategy-agent.ts` — BFS frontier, discovery merge, Jina fallback, dateless events, source_url tracking
8. Modify `process-venue.ts` — use `event.source_url`

### Phase 3: Testing (Day 4–5)

9. Unit tests for `extractJsonLd()` — confirm correct field extraction from each Schema.org type
10. Unit tests for `extractCandidateLinks()` with domain parameter — confirm class keywords score correctly
11. Integration test: run `processVenue()` against a mock school venue with 5 category pages; assert all 5 are visited
12. Integration test: run `processVenue()` against a mock JS-rendered venue (< 300 chars after clean); assert Jina is called
13. Manual test: run against Acting Studio Chicago — confirm Core I, Core II, Advanced Scene Study all appear
14. Cost validation: run against 10 venues; compute average cost; confirm below $0.05

### Phase 4: Deploy (Day 5)

15. Deploy `supabase functions deploy event-scraper`
16. Deploy `supabase functions deploy class-discovery`
17. Run manual scrape of 5 school venues via admin ribbon; inspect results
18. Run manual scrape of 5 theater venues; confirm no regression in event quality
19. Trigger weekly batch; monitor logs for unexpected stop reasons or cost spikes

### Rollback Plan

If the weekly batch shows cost > $0.08/venue average or runtime > 120 minutes:
1. Restore previous `strategy-agent.ts` from git
2. Restore previous `cost-budget.ts` from git
3. Redeploy `event-scraper` and `class-discovery`
4. The only non-reversible changes are `source_url` values in existing event rows — these are an improvement and do not need to be reverted

---

## 11. Risks and Mitigations

### Risk 1: Cost Spike on Pathological Sites

**Probability**: Low (< 5% of venues). **Impact**: High if a site has 50+ relevant pages.

**Description**: A venue with an unusually large site (e.g., a conservatory with 50 class category pages) could exhaust the $0.10 ceiling on a single run, costing 12x more than v2 for that venue.

**Mitigation**:
- The $0.10 ceiling is a hard stop — no venue can cost more than $0.10 per run
- Monitor per-venue costs after the first production run; flag any venue over $0.05 for manual review
- Consider per-domain page caps (theaters: 10 max, schools: 20 max) as a future enhancement if pathological cases emerge

---

### Risk 2: Jina API Rate Limits or Outage

**Probability**: Medium (Jina is a third-party service). **Impact**: Medium — JS-rendered sites fall back to sparse HTML, same as v2 behavior.

**Description**: Jina Reader API has a free tier of 1,000 requests/day. At 100 venues/week with ~20% Jina rate, that is ~20 requests/week — well within limits. A Jina outage causes graceful degradation to v2 behavior for JS-rendered sites.

**Mitigation**:
- FR-05 requires graceful degradation when Jina fails
- Log Jina failures; monitor for sustained failure patterns
- If Jina proves unreliable over 4 weeks, evaluate Browserless.io or a self-hosted Playwright Edge Function as alternatives

---

### Risk 3: Discovery Mode Hallucination

**Probability**: Medium. **Impact**: Medium — spurious events stored with low confidence.

**Description**: Asking the AI to return both new events AND enrichments in the same call may cause it to hallucinate events on pages that don't have them, especially for sites with generic content.

**Mitigation**:
- The verification pass (Pass 2) acts as a quality gate — low-confidence events are flagged
- `extraction_status` and `confidence` fields are already stored and surfaced in the admin dashboard
- Add a hallucination guard to the discovery prompt: "Only include events that are explicitly listed on this page. Do not infer or predict events."
- If hallucination rate exceeds 10% of extracted events (measured by rejected status in Pass 2), revert to enrichment-only mode for link-follow calls

---

### Risk 4: Title Dedup Collision

**Probability**: Low. **Impact**: Medium — two distinct events merged into one.

**Description**: Case-insensitive title dedup may merge two different events with similar titles (e.g., "Core Acting I — Morning" and "Core Acting I — Evening" if the AI returns just "Core Acting I" for both).

**Mitigation**:
- Review the dedup logic to include `start_date` or `skill_level` in the merge key when titles are identical
- Monitor `class_sessions` rows after the first run to detect unexpected merges
- Add a post-scrape data quality check: flag any venue where `events_created + events_updated < events_found` by more than 2

---

### Risk 5: Wall Clock Ceiling Conflicts with BFS Depth

**Probability**: Medium for large sites. **Impact**: Low — partial crawl, but more complete than v2.

**Description**: A school with 15 pages that each take 5 seconds to fetch will hit the 60-second wall clock ceiling after about 10 pages. The remaining 5 pages are unvisited.

**Mitigation**:
- This is better than v2 (which stopped at page 3); a partial crawl of 10 pages is a significant improvement
- The `stopReason` will be `"budget_time"` — surfaced in admin dashboard so the product owner knows the site was partially crawled
- Consider raising wall clock ceiling to 90 seconds in a future iteration if time-limit stops are frequent

---

### Risk 6: Perplexity/SerpAPI Rate Limits

**Probability**: Low. **Impact**: Low — recovery degrades to common-path probes only.

**Description**: Perplexity's sonar model and SerpAPI both have per-day request limits. URL recovery only calls these services when a venue's `calendar_url` fails — not on every venue every run. At a maximum of 8 schools with bad URLs per weekly run, the exposure is at most 8 Perplexity calls and 8 SerpAPI calls per week, well within any tier limit.

**Mitigation**: Recovery is designed fail-silently at each step. If Perplexity returns a non-200 or times out, recovery proceeds to SerpAPI. If SerpAPI also fails, the run concludes with `status = "recovery_exhausted"`. No exception is surfaced to the caller.

---

### Risk 7: Perplexity Returns Wrong URL

**Probability**: Medium. **Impact**: Low — wrong URL is verified before adoption.

**Description**: Perplexity's web index may return a stale or incorrect URL for a venue, particularly for schools that have recently rebranded or restructured their site.

**Mitigation**: Every candidate URL from Perplexity is domain-restricted (hostname must match the venue's root domain) before it is probed. The probe must return a 2xx response AND cleaned content >= 300 chars AND AI extraction must yield >= 1 event. A URL that passes all three checks is highly unlikely to be wrong for the venue's purpose.

---

### Risk 8: Self-Healing Overwrites a Good URL

**Probability**: Very low. **Impact**: Medium — a working `calendar_url` is replaced with a subpage URL.

**Description**: If `calendar_url` happens to be temporarily unavailable (e.g., server maintenance) during a scrape run, recovery might find a different working page and overwrite the good `calendar_url` with a more specific subpage URL.

**Mitigation**: The self-healing update only fires when the recovered URL yields >= 1 event after full AI extraction. A maintenance page would return 0 events and would not trigger the update. Additionally, `calendar_url` updates are logged in the strategy trace, making any unexpected changes visible in the admin dashboard. If a venue's `calendar_url` regresses to a subpage, it can be corrected manually in the admin panel.

---

## 12. Open Questions

**OQ-01 — Jina Authentication**: Does the Jina Reader API free tier require any authentication header? The external panel noted it requires no key, but this should be confirmed with a live test call before the rollout.

*Owner*: Engineering  
*Resolution needed by*: End of Phase 1  

**OQ-02 — TIC Integration with BFS**: The TIC aggregator lookup currently runs in parallel with the initial calendar fetch (Step 1). In v3, the TIC lookup is still theater-domain only. Should TIC results also feed into the BFS frontier (e.g., following TIC show detail pages for dates)? Current behavior is preserved as-is — this is a potential v3.1 enhancement.

*Owner*: Product owner  
*Resolution needed by*: Not blocking v3 — document as backlog item  

**OQ-03 — Verification Prompt Capacity**: If BFS discovers 25 events at a school (much more than v2's typical 3–5), the verification prompt receives all 25 in a single AI call. DeepSeek's context window is large, but output token count for 25 events may approach `max_tokens = 8192`. Should the verification call batch events (e.g., 10 at a time)?

*Owner*: Engineering  
*Resolution needed by*: Phase 2 (before strategy agent rewrite)  
*Recommendation*: Batch verification at 15 events per call if total events > 15

**OQ-04 — Photo URL Validation**: Should the extracted `photo_url` be validated (HTTP HEAD request to confirm it returns a 200)? This adds a fetch per event with a photo. Given the cost and time implications, recommendation is to skip validation in v3 and treat broken photo URLs as acceptable noise. Broken images in the app degrade gracefully.

*Owner*: Product owner  
*Resolution needed by*: Phase 1  

**OQ-05 — NYC/LA Domain Classification**: When NYC and LA venues are added, how will the scraper know whether a venue is `domain: "theater"` or `domain: "class"`? Currently this is set on the `StrategyProfile` passed from the entry point function, which distinguishes `event-scraper` (theater) from `class-discovery` (school). For the new cities, the same split will apply — theater venues go into `event-scraper` batch, schools go into `class-discovery` batch. No new domain classification logic is needed for v3.

*Owner*: Engineering  
*Resolution needed by*: Not blocking v3

---

*Document Version History*  
v1.1 — 2026-08-17 — Added §5.10 Self-Correcting URL Resolution (FR-28–FR-35), §7.9 URL Resolution Architecture, and Risks 6–8. prd-specialist.  
v1.0 — 2026-08-17 — Initial draft. prd-specialist.

---

[timestamp] 2026-08-17 00:00 CST
