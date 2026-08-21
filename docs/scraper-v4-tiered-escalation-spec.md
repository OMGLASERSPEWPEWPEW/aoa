# Scraper v4 — Tiered Escalation Architecture

**Technical Specification for Implementation**

| | |
|---|---|
| **Status** | Draft for implementation |
| **Date** | 2026-08-20 |
| **Extends** | ADR-0006 (art classes discovery), ADR-0007 (completeness-driven crawling) + v3.1 addendum (URL resolution) |
| **Audience** | Implementing agent (Claude Opus) working in `~/Development/aoa` and `~/Development/transformers` |
| **Node prefix** | `sv4-*` (continues the `docs/graphs/` convention) |

## Purpose

Scraper v3 (BFS frontier + Jina fallback + discovery mode) crawls but does not converge: Acting Studio Chicago burns 30 fetches and returns 3 category names at 65% completeness while the real data (sections, dates, prices, instructors, the street address) sits in plain server-rendered HTML one or two clicks away. Other schools fail for entirely different reasons. v4 replaces the single-strategy scraper with a **four-tier escalation ladder** plus a **learning layer** (machine-emitted site profiles), so each site gets the cheapest strategy that works and every successful run makes the next run cheaper. This is the architecture that scales to NYC/LA without per-city rework.

**Ground truth established 2026-08-20 (do not re-litigate, but do re-verify at implementation time):**

1. `https://www.actingstudiochicago.com/adult-acting-classes/core/iii` is fully **server-rendered**. A plain HTTP fetch returns: program name, tuition ($425), duration (8 weeks), prerequisite, five sections with day/time, start dates (Sept 21/23/26, Nov 30, Dec 5), instructor names, and full/waitlist status. **No browser or Jina was required for this site.** The v3 failure was prioritization + budget + schema, not capability.
2. The site footer on every page contains the street address: **10 W Hubbard Suite 2E, Chicago, IL 60654**. Note "Hubbard" has no street-type suffix — exactly why the current regex misses it. ⚠️ The earlier fix-plan cited "4753 N Broadway" as ASC's address; the **live footer says 10 W Hubbard**. Trust the live footer; do not hardcode Broadway. Expected coordinates ≈ (41.890, −87.628), River North.
3. `https://www.actingstudiochicago.com/class-catalog?sub=all` exists one click from the homepage and appears to be a full catalog index. v3 never prioritized it; it fetched `/blog`, `/webinars`, and `/kids-teens-*` instead.
4. The "3 events found on every page" symptom is **nav-menu bleed**: the mega-nav repeats the program category names ("Core Acting Classes", "Intermediate Acting", …) on every page, and htmlToMarkdown preserves it, so extraction rediscovers the same three categories everywhere.

---

## Section 0 — Assumptions to Verify Before Writing Code (`sv4-phase0-verify`)

This spec was written from ADRs, task graphs, strategy traces, and live fetches — not from reading every line of current source. **Verify each assumption first; where one fails, adapt the integration point but keep the contracts (interfaces, table schemas, prompts) as specified.**

| # | Assumption | How to verify |
|---|---|---|
| A1 | BFS frontier loop lives in `supabase/functions/_shared/scraper/strategy-agent.ts` (~lines 373–430 pre-v3; now a `while (frontier.length > 0 && !budget.isExhausted())` loop) | `grep -n "frontier" supabase/functions/_shared/scraper/strategy-agent.ts` |
| A2 | `CostBudget` defaults ≈ {30 fetches, 20 AI calls, $0.10, 60s} in `_shared/scraper/cost-budget.ts` | Read the file |
| A3 | Jina fallback triggers on `cleaned.length < 300` (ADR says 300; one graph says 100) after `cleanHtml()` | `grep -n "jina\|r.jina.ai" -r supabase/functions/_shared/scraper/` |
| A4 | Class rows are stored in the `events` table (via shared `process-venue.ts` upsert) with class-specific fields; there is **no** separate `classes` table | `curl "$VITE_SUPABASE_URL/rest/v1/events?select=*&limit=1"` with anon key; inspect columns. If a dedicated classes table exists, apply §3.4 columns there instead |
| A5 | `venues` has `address` (currently null for ASC); `schools` may not have `address` | REST select on both tables |
| A6 | Secrets available to Edge Functions: `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY`, `SERPAPI_KEY` (v3.1). `GOOGLE_PLACES_API_KEY` and/or a Mapbox token: **check which exists** (§9.3 supports either) | `supabase secrets list --project-ref rytjrterecygirttvtdn` |
| A7 | `geocodeSchool()` with the narrow address regex is in `supabase/functions/school-discovery/index.ts` (~line 107) | Read the file |
| A8 | The archived geocode-backfill lives at `_archive/class-discovery-v1/index.ts` lines ~550–630 | Read the file |
| A9 | Transformers repo at `~/Development/transformers` exposes: Playwright launcher in `src/core/browser.ts`, agent loop in `src/agents/agent/agentLoop.ts`, aria observation in `src/agents/agent/accessibilityObserve.ts`, Gemini provider in `src/llm/provider.ts`, SQLite cost tracking | Read those files; note the actual launch function signature before wiring §7 |
| A10 | `StrategyProfile` = `{ domain: 'theater'\|'class', fieldWeights, logFeaturePrefix }` and class-discovery passes `domain: 'class'` | `grep -n "StrategyProfile" -r supabase/functions/` |
| A11 | `structured-data.ts` already extracts JSON-LD events (`extractLdJsonEvents`) inside `cleanHtml()` | Read `_shared/scraper/html-cleaner.ts` |
| A12 | Edge Function wall-clock limit constrains a single invocation (v3 worst case ~45s). Resumability (§5.5) exists to respect this, **not** to be optimized away | Supabase plan docs / observed timeouts |

Record verification results as a checklist comment at the top of the first PR.

---

## Section 1 — Failure Taxonomy (`sv4-taxonomy`)

Six Chicago schools fail for **five distinct reasons**. No single navigation strategy fixes all five; that is why days of tuning one scraper did not converge. Every change in this spec maps back to exactly one row.

| # | Failure mode | Schools (observed) | Evidence from traces | Root cause | Fixed by |
|---|---|---|---|---|---|
| F1 | Budget exhaustion + blind link scoring | Acting Studio Chicago, Green Shirt Studio | ASC: 28 fetches, `stopReason: frontier_exhausted` at budget cap, `/blog` `/webinars` `/kids-teens-*` fetched, `/class-catalog` and `/core/iii` never reached. Green Shirt: 14 classes at 28% completeness, only 5 links followed | Keyword scorer can't distinguish adult-class pages from kids/blog/policy; 30-fetch cap too small for deep hierarchies; nav bleed wastes extraction on category names | Tier 1 upgrades (§5): LLM frontier, classifier gate, boilerplate strip, resumable budget |
| F2 | JS-rendered content invisible to plain fetch | Comedy Plex | 12 fetches, 10 links, 0 events on `/classes`, `/event`, `/training-center-interest-form` | Content rendered client-side; Jina trigger (`cleaned < 300 chars`) misses pages whose server-rendered *nav alone* exceeds 300 chars of contentless text | Tier 2 evidence-based trigger (§6) |
| F3 | Wrong-but-alive seed URL | The Revival | Crawling `loopchicago.com` (a neighborhood site) | v3.1 URL resolution heals **dead** URLs (404/SSL/timeout); it never fires for a live page that simply isn't the school | Tier 0 identity validation (§4.1) → re-trigger v3.1 resolution |
| F4 | Bot-blocked / hostile to datacenter fetches | Factory Theater, McAninch Arts Center, Filament Theatre | Timeouts and 403s on fetch | Cloudflare-class bot checks reject plain `fetch()` fingerprints; some ticketing platforms block by default | Tier 3 real-browser agent (§7) + politeness (§4.4) reduces future blocks |
| F5 | Address capture failure → invisible on map | ASC (+ any school on a suffix-less street) | ASC at default coords (41.8781, −87.6298); `MapView.tsx:211` filters defaults; `address: null` even though every page footer has it | Regex requires a street-type suffix ("Broadway", "Wacker", "Hubbard" all fail); discovered addresses were discarded before insert; no backfill since the v1 archive | §9 geocoding bundle |

---

## Section 2 — Architecture Overview (`sv4-architecture`)

### 2.1 The ladder

```
  TIER 0  Reconnaissance          ≤4 fetches, ≤1 AI call     Edge Function
          identity check · platform fingerprint · sitemap ·
          catalog discovery · robots.txt
              │ pass
              ▼
  TIER 1  Fetch + BFS (upgraded)  ~$0.05–0.15/site           Edge Function (resumable)
          LLM-scored frontier · classifier gate ·
          class-native extraction · boilerplate strip
              │ per-page evidence of hidden content
              ▼
  TIER 2  Rendered fetch (Jina)   +$0/req (public endpoint)  Edge Function (same loop)
          r.jina.ai re-fetch of specific pages
              │ blocked / interactive / plateaued
              ▼
  TIER 3  Browser agent           ~$0.20–0.50/site, minutes  Transformers worker (Node)
          Playwright + agent loop ("Cartographer") — real
          browser defeats 403 walls, drives interactive UIs
```

### 2.2 Control & data flow

```
 cron ──▶ class-discovery (Edge Fn)
            │  1. load site_profiles[domain] ── fresh? ──▶ WARM START (skip T0, seed
            │  2. else Tier 0 recon                        frontier from entry_points,
            │  3. Tier 1 BFS loop (T2 Jina per-page)       run at profile.tier_required)
            │  4. persist crawl_state each invocation
            │  5. on completion: flatten → upsert events,
            │     write/refresh site_profiles, trace
            │
            ├── escalation signals (§10) ──▶ INSERT scrape_jobs
            │
 transformers scout worker (Node + Playwright, polls every 30s)
            │  claim job → Cartographer agent quest →
            │  programs JSON + SiteProfile JSON + screenshots
            ▼
 scrape-ingest (new Edge Fn) ── validates → same flatten/upsert path → marks job done
```

### 2.3 Design principles

1. **Cheapest tier that works.** Most arts-school sites are server-rendered WordPress/Squarespace; Tier 1 should handle the majority once it stops fetching blogs.
2. **Every run teaches.** Success at any tier writes a site profile; the next run warm-starts (~5 fetches instead of 30). Failure increments staleness and can trigger relearning.
3. **One write path.** All class data — whether produced by the Edge Function or the browser agent — flows through the same flatten/upsert code (`process-venue.ts` + `scrape-ingest`). No duplicated storage logic (this preserved ADR-0006 Decision 4).
4. **Escalate on evidence, not vibes.** Triggers are computed from signals already logged: `stopReason`, fetch error classes, completeness scores, classifier verdicts.
5. **Polite by default.** Identified UA, robots.txt respect, per-domain rate limiting, content-hash caching. AOA's pitch to schools is "we send you students" — crawl like it. It also empirically reduces F4.

---

## Section 3 — Data Model Changes (`sv4-migrations`)

All migrations are additive and nullable-safe; nothing breaks the running v3 scraper mid-rollout. Use the next timestamps in `supabase/migrations/`.

### 3.1 `site_profiles` — the learning layer (`sv4-mig-site-profiles`)

```sql
create table if not exists site_profiles (
  id                    uuid primary key default gen_random_uuid(),
  domain                text not null unique,          -- registrable domain, lowercase, no www
  venue_id              uuid references venues(id),
  platform              text,                          -- 'wordpress'|'squarespace'|'wix'|'mindbody'|'sawyer'
                                                       -- |'coursestorm'|'eventbrite'|'custom'|null
  tier_required         smallint not null default 1,   -- 0..3 = lowest tier that last succeeded
  render_needed         boolean  not null default false,
  entry_points          jsonb    not null default '[]'::jsonb,
    -- [{ "url": "...", "kind": "catalog_index"|"program_detail"|"schedule_calendar",
    --    "last_ok": "2026-08-20T00:00:00Z" }]
  url_patterns          jsonb    not null default '[]'::jsonb,
    -- glob-ish patterns where class data lived, e.g. ["/adult-acting-classes/*/*", "/class-catalog*"]
  dead_end_patterns     jsonb    not null default '[]'::jsonb,
    -- e.g. ["/blog/", "/kids-teens-", "/webinars", "/asc-faculty/", "/policies"]
  robots                jsonb,                         -- { "fetched_at": ..., "disallow": ["/account/"] }
  address               text,
  last_success_at       timestamptz,
  last_completeness     numeric,
  consecutive_failures  int not null default 0,
  profile_version       int not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists site_profiles_venue_idx on site_profiles(venue_id);
```

**Rationale note (append as ADR-0008, see §12 Phase 4 deliverables):** ADR-0007 rejected *per-site configs* because they are human-authored selector files with O(venues) maintenance cost. `site_profiles` is a different animal: **machine-emitted, hint-based (URLs and patterns, never CSS selectors), self-refreshing, and self-healing** — when stale, the system falls back to a cold crawl and rewrites the profile. Zero human maintenance. The ADR-0007 objection does not apply.

### 3.2 `crawl_state` — resumable BFS across invocations (`sv4-mig-crawl-state`)

```sql
create table if not exists crawl_state (
  id                uuid primary key default gen_random_uuid(),
  venue_id          uuid not null references venues(id),
  domain            text not null,
  tier              smallint not null default 1,
  status            text not null default 'running',   -- running|complete|failed|escalated
  frontier          jsonb not null default '[]'::jsonb, -- [{url, anchorText, score, source}]
  visited           jsonb not null default '[]'::jsonb, -- [canonicalUrl, ...]
  programs_partial  jsonb not null default '[]'::jsonb, -- accumulated Program[] (§5.3 schema)
  school_address    text,                               -- first non-null address seen (§9.2)
  block_hashes      jsonb not null default '{}'::jsonb, -- { fnv1aHash: seenCount } (§5.4)
  link_score_cache  jsonb not null default '{}'::jsonb, -- { canonicalUrl: score } (§5.1)
  budget_used       jsonb not null default '{}'::jsonb, -- { fetches, aiCalls, usd, wallMs }
  invocation_count  int  not null default 0,
  stop_reason       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists crawl_state_one_running
  on crawl_state(venue_id) where status = 'running';
```

### 3.3 `scrape_jobs` — Tier 3 queue (`sv4-mig-scrape-jobs`)

```sql
create table if not exists scrape_jobs (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references venues(id),
  domain      text not null,
  reason      text not null,      -- 'fetch_blocked'|'js_interactive'|'low_completeness'
                                  -- |'zero_events_complete'|'manual'
  status      text not null default 'pending',  -- pending|claimed|running|done|failed
  claimed_by  text,               -- worker hostname/handle
  claimed_at  timestamptz,
  payload     jsonb,              -- { seed_url, school_name, city, known_good_urls?, notes? }
  result      jsonb,              -- worker writes summary here; full data goes via scrape-ingest
  attempts    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists scrape_jobs_pending_idx on scrape_jobs(status, created_at);
```

### 3.4 Class-shaped columns on `events` (`sv4-mig-events-class-cols`)

Verify A4 first. If classes live in `events`:

```sql
alter table events
  add column if not exists program_name     text,     -- "Level 3: Scene Study"
  add column if not exists section_schedule text,     -- "Saturdays 1:00p–4:30p"
  add column if not exists section_status   text,     -- 'open'|'full'|'waitlist'|'unknown'
  add column if not exists prerequisite     text,
  add column if not exists duration_weeks   int,
  add column if not exists audience         text;     -- 'adult'|'youth'|'teen'|'mixed'
```

Storage model: **one `events` row per enrollable section** (that is what a user can actually join), carrying program-level fields denormalized onto each row, grouped in the UI by `program_name`. See §5.7 for flattening and upsert-key rules.

### 3.5 Geocode bookkeeping on `venues` / `schools` (`sv4-mig-geocode-cols`)

```sql
alter table venues
  add column if not exists geocode_source text,   -- 'llm_extracted'|'regex'|'places_api'
                                                  -- |'mapbox'|'perplexity'|'default'
  add column if not exists geocode_status text;   -- 'ok'|'default'|'failed'

alter table schools
  add column if not exists address text;          -- only if missing (verify A5)
```

`MapView.tsx` stays unchanged (the coordinate filter at line 211 is correct); `geocode_status` exists so the backfill query (§9.4) doesn't have to match float literals forever.

---

## Section 4 — Tier 0: Reconnaissance (`sv4-tier0`)

**New module:** `supabase/functions/_shared/scraper/recon.ts`
**Budget:** ≤4 fetches, ≤1 AI call. Runs once per cold crawl, before the BFS loop. Skipped entirely on warm starts (§8.2), except a weekly robots refresh.

```ts
export interface ReconResult {
  identity: 'match' | 'mismatch' | 'uncertain';
  identityConfidence: number;         // 0–1
  platform: string | null;            // see PLATFORM_SIGNATURES
  platformConfidence: number;
  renderNeededPrior: boolean;         // platform implies JS widgets
  catalogUrls: string[];              // discovered catalog/schedule index pages (top-priority seeds)
  sitemapUrls: string[];              // class-relevant URLs mined from sitemap.xml
  registerDomains: string[];          // external hosts behind register/enroll/sign-up links
  allowedExternalHosts: string[];     // registerDomains that match a known platform (crawl exception)
  robotsDisallow: string[];
  fetchesUsed: number;
}

export async function runRecon(
  venue: { name: string; city: string },
  seedUrl: string,
  seedRawHtml: string,
  seedCleaned: string,
  budget: CostBudget,
): Promise<ReconResult>
```

### 4.1 Identity validation (`sv4-recon-identity`) — kills F3

One DeepSeek call (temperature 0) on the seed page. **Full prompt:**

```
System: You verify whether a web page belongs to a specific organization. Answer only in JSON.

User: Organization: "{venue.name}" — a class-offering arts school in {venue.city}.
URL fetched: {seedUrl}
Page title and first 1200 characters of page text:
---
{title}
{cleaned.slice(0, 1200)}
---
Is this page the official website of that organization (or a page on it)?
A city guide, neighborhood directory, review site, or news article ABOUT the
organization is a MISMATCH.
Respond with only: {"identity":"match"|"mismatch"|"uncertain","confidence":0.0-1.0,"reason":"<10 words"}
```

Routing:
- `mismatch` with confidence ≥ 0.7 → invoke the existing v3.1 URL-resolution stage (Perplexity/SerpAPI) **once**, re-fetch the resolved URL, re-run the identity check. Second mismatch → set the venue's URL status to `needs_review`, write the trace with `stopReason: 'identity_mismatch'`, stop. Do **not** burn 30 fetches crawling loopchicago.com.
- `uncertain` → proceed to Tier 1 but cap the crawl at 12 fetches until the first program is extracted (which retroactively confirms identity).

### 4.2 Platform fingerprinting (`sv4-recon-fingerprint`) — 0 extra fetches

All signals come from the seed's **raw HTML** (not the cleaned markdown). Keep the table in code as `PLATFORM_SIGNATURES`, extensible per city:

| platform | detection signals (any) | consequences |
|---|---|---|
| `wordpress` | `/wp-content/`, `wp-json`, generator meta | none — server-rendered, Tier 1 fine (ASC is this) |
| `squarespace` | `static1.squarespace.com`, `Squarespace` generator | Tier 1 fine |
| `wix` | `wixstatic.com`, `wix.com` assets | often JS-heavy → `renderNeededPrior = true` |
| `mindbody` | links to `clients.mindbodyonline.com` or `mindbodyonline` widgets | schedule is a JS widget → `renderNeededPrior = true`; widget URL is an entry point |
| `sawyer` | links/iframes to `hisawyer.com` | add the `hisawyer.com` schedule URL to `allowedExternalHosts` + `catalogUrls` (server-rendered catalog) |
| `coursestorm` | links to `*.coursestorm.com` | CourseStorm catalogs are server-rendered — add to `allowedExternalHosts` + `catalogUrls` |
| `eventbrite` | links to `eventbrite.com/o/…` or `/e/…` | organizer page carries JSON-LD — add to `allowedExternalHosts` |
| `custom` | none of the above | no prior |

`allowedExternalHosts` is the **only** exception to the same-origin rule in `extractCandidateLinks`: the specific discovered platform host may be crawled (it is where the clean structured data lives). Everything else stays same-domain (preserves the ADR-0007 runaway-crawl guard).

Register-button harvesting: collect `href` hosts for links whose anchor text matches `/(register|enroll|sign\s*up|book now|class catalog)/i`. External hosts → `registerDomains`; if a host matches a signature row → also `allowedExternalHosts`.

### 4.3 Sitemap + catalog discovery (`sv4-recon-catalog`)

1. Fetch `{origin}/sitemap.xml` (1 fetch; if it is a sitemap index, fetch the single most class-relevant child, max 1 more fetch). Extract `<loc>` URLs; keep those matching `/(class|catalog|schedule|calendar|course|workshop|program|training|education)/i`; cap 40 → `sitemapUrls`. Silent no-op on 404.
2. From the seed's links, hunt catalog indexes by path: `/(class-catalog|all-classes|classes\/?$|schedule|calendar|catalog|course-catalog)/i` → `catalogUrls`. These are seeded into the frontier with score 100 (§5.1) ahead of everything else. *For ASC this is what puts `/class-catalog?sub=all` first instead of never.*

### 4.4 robots.txt + politeness (`sv4-recon-politeness`) — reduces F4 over time

**New module:** `supabase/functions/_shared/scraper/politeness.ts`

- `export const AOA_UA = 'AOA-ClassFinder/1.0 (+https://<AOA-public-domain>/bot; class-listing crawler; contact: <ops email>)'` — TODO: fill the real domain/email; send this UA on **every** fetch (plain and Jina via `X-User-Agent`).
- Fetch `/robots.txt` once per cold crawl (1 fetch). Minimal parser: collect `Disallow:` lines under `User-agent: *` and under any agent token our UA contains. Store in `site_profiles.robots`. The frontier hard-filter (§5.1) drops any URL whose path starts with a disallowed prefix.
- Per-domain rate limiter: minimum 1200ms + 0–600ms jitter between fetches to the same registrable domain (module-level timestamp map; single-threaded Edge Function makes this trivial). Applies to Jina fetches of that domain too.
- On 429: back off 30s once, then treat as `fetch_blocked` evidence for §10.

---

## Section 5 — Tier 1: Fetch + BFS Upgrades (`sv4-tier1`)

Five changes to the existing loop in `strategy-agent.ts`. Together they turn ASC from "3 categories at 65%" into "~30 sections at 90%+" **without** a browser.

### 5.1 LLM-scored frontier (`sv4-frontier-llm`) — replaces keyword scoring as primary

**File:** `_shared/scraper/link-extractor.ts` — add `scoreLinksLLM()`; keep the existing keyword scorer as the fallback.

Hard filters run **before** the LLM (free, deterministic), in this order:
1. Canonicalize: lowercase host, strip `www.`, strip fragment, strip `utm_*`/`fbclid` params, strip trailing slash. Dedupe against `visited` and `link_score_cache`.
2. Same-origin, **plus** hosts in `recon.allowedExternalHosts`.
3. Drop asset/document extensions (`.jpg .png .gif .webp .svg .css .js .pdf .ics .zip .mp4`).
4. Drop robots-disallowed prefixes (§4.4).
5. Drop `site_profiles.dead_end_patterns` matches (warm starts only).

Then one DeepSeek call per **harvest batch** (the new links found on one fetched page; cap 60 links/call, anchor text truncated to 80 chars). Cache results in `crawl_state.link_score_cache` keyed by canonical URL so re-encountered links cost nothing. **Full prompt:**

```
System: You rank crawler links. Output only JSON.

User: We are collecting ADULT class offerings (acting, improv, voice-over, on-camera,
movement, audition, comedy) for the school "{school_name}" in {city}.
Score each link 0-100 for how likely it leads to a page with ENROLLABLE ADULT CLASS
DETAILS (dates, times, prices, instructors) or an index of such pages.

100 = class catalog / full schedule index
80-95 = specific adult program or class-detail page, registration page with dates
40-60 = adult class category/landing page (links onward to details)
0-10 = kids/teens/youth/camps, blog, news, faculty bios, testimonials, about,
       policies, donations, rentals, gift certificates, login/account, contact

Links (JSON): {[{ "i": 0, "url": "...", "anchor": "..." }, ...]}

Respond with only a JSON array: [{"i":0,"score":95}, ...]. Every input i exactly once.
```

Temperature 0, `max_tokens` 1500. On parse/HTTP failure: log a warning, fall back to the existing keyword scores for that batch. Frontier push: `score >= 25` only; frontier remains sorted descending as today. Catalog URLs from recon (§4.3) enter pre-scored at 100.

**Cost:** ~1 cheap call per fetched page that yields new links; input is URLs+anchors only (tiny). This is agentic navigation at roughly 1% of browser-agent cost.

### 5.2 Page classifier gate (`sv4-classifier-gate`) — skips the expensive call

**File:** `_shared/scraper/page-classifier.ts` (new). Runs after `cleanHtml()` on every BFS page, on a **truncated** input (URL + title + headings + first 1200 chars of cleaned text) — ~1/10 the tokens of full extraction. **Full prompt:**

```
System: You classify web pages for a class-listing crawler. Output only JSON.

User: School: "{school_name}". URL: {url}
Title: {title}
Headings: {first 10 headings, joined by " | "}
First 1200 chars of page text:
---
{snippet}
---
Classify as exactly one page_kind:
"catalog_index"       - lists many classes/programs, possibly with dates
"program_detail"      - one program/class with description and/or sections
"schedule_calendar"   - a schedule or calendar of class sessions
"registration_portal" - signup/login/cart/account page
"faculty"             - instructor bios
"youth_only"          - exclusively kids/teens/camps content
"blog_or_news"        - articles, tips, alumni news, testimonials
"policy_or_admin"     - policies, FAQs, rentals, donations, contact, about
"other"

Respond with only:
{"page_kind":"...", "has_dates":true|false, "has_prices":true|false}
```

Routing table (implement as a constant):

| page_kind | run class extraction? | harvest links? |
|---|---|---|
| catalog_index, program_detail, schedule_calendar | **yes** | yes |
| other | no | yes |
| registration_portal | no — but record URL as `register_url` candidate for programs missing one | no |
| faculty, youth_only, blog_or_news, policy_or_admin | no | no |

The classifier verdict is also Tier 2 evidence (§6): `page_kind ∈ {catalog_index, program_detail, schedule_calendar}` but extraction returned zero programs is the signature of a JS-rendered page.

### 5.3 Class-native extraction (`sv4-class-schema`) — replaces the show-shaped prompt for `domain: 'class'`

**File:** `_shared/scraper/extraction-prompt.ts` — add `buildClassExtractionPrompt(schoolName, city, runDateISO)`. The show prompt is untouched for `domain: 'theater'`.

Classes are **programs containing sections**; the show prompt flattens this hierarchy, which is a large share of the 65%-completeness ceiling. **Full prompt:**

```
System: You extract structured class data from a school's web page. Output only JSON.
Never invent data; use null for anything not on the page.

User: School: "{school_name}" in {city}. Today's date: {run_date}.
Page URL: {url}
Page content (markdown):
---
{content}
---
Extract every ADULT class offering on this page into this exact JSON shape:

{
  "school_address": "street address if shown anywhere on the page (footers count), else null",
  "programs": [
    {
      "program_name": "e.g. 'Level 3: Scene Study' - a distinct enrollable offering,
                       NOT a category like 'Core Acting Classes'",
      "discipline": "acting|improv|voiceover|oncamera|movement|audition|comedy|other",
      "audience": "adult|teen|youth|mixed",
      "skill_level": "beginner|intermediate|advanced|all|null",
      "prerequisite": "string|null",
      "description": "1-2 sentences from the page, or null",
      "price_min": number|null,
      "price_max": number|null,
      "duration_weeks": number|null,
      "register_url": "absolute URL|null",
      "sections": [
        {
          "schedule": "e.g. 'Saturdays 1:00p-4:30p'",
          "day_of_week": "Monday..Sunday|null",
          "start_time": "HH:MM 24h|null",
          "end_time": "HH:MM 24h|null",
          "start_date": "YYYY-MM-DD|null",
          "end_date": null,
          "instructor_name": "string|null",
          "status": "open|full|waitlist|unknown",
          "register_url": "absolute URL|null",
          "notes": "e.g. 'NO CLASS Dec 21 & 28'|null"
        }
      ]
    }
  ]
}

Rules:
- Categories in navigation menus are NOT programs. Ignore navigation, footers,
  testimonials, alumni news, and instructor bios.
- Dates without a year ("Starts September 21"): choose the next occurrence relative
  to today ({run_date}) - this year if that month/day is today or later, else next year.
- A page describing one program with several day/time blocks = ONE program with
  MULTIPLE sections.
- Include youth offerings only if the page mixes them with adult ones; set audience.
- If the page lists classes but shows no dates, still emit the programs (sections
  may be empty or dateless).
Respond with only the JSON object.
```

**Worked example for the implementer's test fixture** — `adult-acting-classes/core/iii` must yield one program (`Level 3: Scene Study`, acting, adult, prerequisite referencing Level 2, price_min 425, duration_weeks 8, `school_address` `"10 W Hubbard Suite 2E, Chicago, IL 60654"`) with five sections, including `{schedule: "Mondays 6:00p-9:30p", start_date: "2026-09-21", instructor_name: "Sarafina Vecchio", status: "full"}` and `{schedule: "Saturdays 1:00p-4:30p", start_date: "2026-12-05", notes: "NO CLASS Dec 26 & Jan 2"}`. Save the fetched markdown of that page as a fixture and assert on it.

Model routing is unchanged: 3-model race on the seed, DeepSeek on BFS pages — both now receive the class prompt when `profile.domain === 'class'`.

**Completeness scoring update** (`_shared/scraper/completeness.ts`): score at the section level. Weights for `domain: 'class'`: `start_date` 25, `schedule` (day+time) 20, `price` 15, `instructor_name` 15, `register_url` 5, `status` 5 — max 85, consistent with the existing scale. A program with zero sections scores 15 (name+description only).

### 5.4 Cross-page boilerplate stripping (`sv4-boilerplate-strip`) — kills nav bleed

**File:** `_shared/scraper/boilerplate.ts` (new). Applied to cleaned markdown **before** classification and extraction, per crawl:

```
split cleaned markdown into blocks on /\n{2,}/
for each block: norm = lowercase, collapse whitespace; h = fnv1a(norm)
if crawl_state.block_hashes[h] >= 2  → drop the block        // seen on 2+ prior pages
after processing the page: increment counts for all its blocks
GUARD: never drop a block that matches /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|
nov|dec)[a-z]*\b|\$\d|(\d{1,2}:\d{2})/i  — schedules and prices may legitimately repeat
```

Effect on ASC: from page 3 onward the mega-nav, footer, and testimonial carousels vanish from extraction input — the "3 events on every page" symptom disappears and per-page token cost drops sharply. Counts persist in `crawl_state.block_hashes` for resumability.

### 5.5 Resumable crawls (`sv4-resumable`) — the real budget raise

Edge Functions cannot host a 90-fetch crawl in one invocation (A12). Persist the crawl instead of shrinking it.

**Per-invocation caps:** 22 fetches, 40s wall clock, 18 AI calls.
**Per-crawl totals:** 90 fetches, 60 AI calls, $0.60, 4 invocations — constants in `cost-budget.ts` as `CLASS_CRAWL_TOTALS`; a `CostBudget` is constructed each invocation from `totals − crawl_state.budget_used`.

Invocation flow in `class-discovery/index.ts`:

```
1. state = select crawl_state where venue_id = X and status = 'running'
   - none → cold start: run recon (§4) or warm start (§8.2); create state with seeded frontier
   - exists → hydrate frontier/visited/block_hashes/link_score_cache/programs_partial
2. run the BFS loop until invocation caps or frontier empty
3. frontier non-empty AND totals remain → persist state, invocation_count++, return
   { status: 'in_progress' }   // the existing batch cron picks running states FIRST
   before starting new venues on its next tick
4. frontier empty OR totals exhausted → completion path:
   flatten programs → upsert events (§5.7); geocode/address hook (§9.2);
   write site_profiles (§8.1); state.status = 'complete'; write strategy trace
5. escalation check (§10) may instead set status = 'escalated' + insert scrape_jobs
```

The existing `no_progress >= 2` early-stop is kept and now counts **across** invocations (persist the counter in `budget_used`).

### 5.6 Storage flattening & upsert keys (`sv4-storage-flatten`)

**File:** `_shared/scraper/process-venue.ts`. One `events` row per section; program-level fields denormalized onto each row:

- `title` = `program_name` (display grouping key), `program_name` = same, `section_schedule`, `section_status`, `instructor_name`, `start_date`, `price_min/max` (program-level unless the section overrides), `prerequisite`, `duration_weeks`, `audience`, `ticket_url` = section `register_url` ?? program `register_url` ?? null, `source_url` = page the section came from, `event_type` = `'class'`.
- A program with no sections → one row with section fields null and `extraction_status: 'program_no_sections'`. Dateless sections keep `extraction_status: 'no_dates_on_site'` (preserves ADR-0007).
- **Dedupe/upsert key:** `(venue_id, normalized(program_name), normalized(section_schedule), start_date)` where `normalized` = trim, collapse whitespace, lowercase. Merge rule: incoming non-null beats stored null; incoming `status` always wins (full/waitlist changes are the freshest signal).
- **Audience filter:** store `audience` but do not upsert `youth`-only rows unless a future product decision says otherwise; log the skip count in the trace.

---

## Section 6 — Tier 2: Rendered Fetch via Jina (`sv4-tier2`)

Jina Reader stays (ADR-0007 correctly rejected in-function headless browsers). What changes is the **trigger**: length alone misses Comedy Plex, whose server-rendered chrome exceeds 300 chars while the class content is client-rendered.

**Decision function** (in `strategy-agent.ts`, per page, after classify+extract):

```ts
function needsRender(page): boolean {
  if (page.cleaned.length < 300) return true;                       // existing rule, keep
  const contentKind = ['catalog_index','program_detail','schedule_calendar']
    .includes(page.pageKind);
  if (contentKind && page.programsExtracted === 0
      && page.sameDomainLinkCount >= 8) return true;                // "should have data, doesn't"
  if (page.boilerplateDroppedRatio > 0.9) return true;              // page was ~all nav/footer
  return false;
}
```

On trigger: re-fetch `https://r.jina.ai/{encodeURIComponent(url)}` (public endpoint, no key; send `X-User-Agent: AOA_UA`; counts against the fetch budget and the domain rate limiter), then re-run classify → extract on the Jina markdown. **Retry once per URL, never loop.**

Learning hooks:
- Any URL where plain fetch produced 0 programs but Jina produced ≥1 → `site_profiles.render_needed = true`. When `render_needed` is true, **skip plain fetches for that domain entirely** and go straight through Jina (halves wasted fetches on JS sites).
- Jina also yields 0 programs on ≥2 content-classified pages → the site is interactive beyond static rendering (calendars, load-more, tabs) → escalation reason `js_interactive` (§10).

---

## Section 7 — Tier 3: Transformers Browser Agent (`sv4-tier3`)

Playwright cannot live in Deno Edge Functions (ADR-0007, Option B — still correct). It doesn't need to: **transformers already is** a Node + Playwright agent service with a Claude/Gemini agent loop, accessibility-tree observation, persistent browser profiles, and SQLite cost tracking. Tier 3 is a new *mode* of that service — the **Scout** — running as a worker that polls `scrape_jobs`.

**Why a real browser fixes F4:** Cloudflare-class checks reject datacenter `fetch()` fingerprints; a real Chromium with human pacing passes most of them. It also drives interactive schedule widgets (Mindbody), "load more" buttons, and tabbed calendars that no fetch-based tier can see.

### 7.1 Worker architecture (`sv4-scout-worker`) — in `~/Development/transformers`

New directory `src/scout/`:

| file | responsibility |
|---|---|
| `runner.ts` | Poll loop (every 30s): claim job → run quest → report. Entry: `npm run scout` |
| `cartographer.ts` | The agent quest: goal, action set, loop wiring, result assembly |
| `extract.ts` | Page-text → class extraction (same prompt as §5.3 — copy the prompt constant verbatim; add a header comment `// KEEP IN SYNC with aoa _shared/scraper/extraction-prompt.ts`) |
| `ingest.ts` | POST results to the `scrape-ingest` Edge Function |

Config additions (`src/core/config.ts`): `AOA_SUPABASE_URL`, `AOA_SERVICE_ROLE_KEY`, `SCOUT_MAX_STEPS = 40`, `SCOUT_MAX_COST_USD = 0.50`, `SCOUT_ACTION_DELAY_MS = [1500, 3500]`, `SCOUT_POLL_MS = 30000`.

**Job claim** (optimistic lock, no extra infra):

```sql
update scrape_jobs
   set status = 'claimed', claimed_by = $worker, claimed_at = now(), attempts = attempts + 1
 where id = ( select id from scrape_jobs
               where status = 'pending' and attempts < 2
               order by created_at limit 1 )
returning *;
```

Reuse from transformers as-is: the Playwright launcher (`src/core/browser.ts` — launch **without** any product auth; fresh non-persistent context is fine), `accessibilityObserve.ts` for snapshots, `src/llm/provider.ts`, and SQLite cost events (project id `aoa-scout`). No `ProductAdapter` is required — the Scout is read-only public browsing; wire `agentLoop` directly with the action set below (or a thin `ScoutAdapter` if the loop demands the interface; verify A9 and take the cheaper path).

### 7.2 The Cartographer quest (`sv4-cartographer`)

Action set exposed to the agent: `NAVIGATE <url>`, `CLICK <index>`, `SCROLL`, `BACK`, `EXTRACT`, `DONE`. `EXTRACT` dumps the current page's aria/inner text and runs the §5.3 extraction; results accumulate. Observation per step: URL + page type + indexed interactive elements + headings (existing `accessibilityObserve`). Termination: `DONE`, `SCOUT_MAX_STEPS`, or cost cap. Screenshot each `EXTRACT` to `artifacts/scout/{domain}/` (local diagnostics only). **Full system prompt:**

```
You are the Cartographer: you map an arts school's website and collect every ADULT
class offering (dates, times, prices, instructors), producing a reusable site map.

School: "{school_name}" in {city}. Start URL: {seed_url}.
{if known_good_urls: "Previously productive pages: {list}. Check these first."}

Mission, in order of priority:
1. Find the class catalog / schedule index and EXTRACT it.
2. Visit each distinct adult program's detail page and EXTRACT it. If a schedule
   widget requires clicking tabs, "load more", month arrows, or date pickers,
   click through them and EXTRACT after each new batch of classes appears.
3. Note the school's street address when you see it (footers usually have it).

Rules:
- NEVER log in, create accounts, or submit forms. Dismissing cookie/newsletter
  popups is the only permitted form interaction.
- Stay on {domain} and on registration-platform pages it links to
  (Mindbody/Sawyer/CourseStorm/Eventbrite). Nowhere else.
- Skip kids/teens/camps, blog, faculty bios, testimonials, policies.
- If a page is clearly a class page, EXTRACT before navigating away.
- You have at most {max_steps} actions. When the catalog is covered or steps run
  low, respond DONE.

At every step, reply with exactly one action:
NAVIGATE <url> | CLICK <index> | SCROLL | BACK | EXTRACT | DONE
followed by one short line of reasoning.
```

### 7.3 Output contract & write-back (`sv4-scout-ingest`)

On termination the runner assembles and POSTs to `{AOA_SUPABASE_URL}/functions/v1/scrape-ingest` (Authorization: service role key):

```jsonc
{
  "job_id": "...", "venue_id": "...", "domain": "...",
  "school_address": "10 W Hubbard Suite 2E, Chicago, IL 60654" | null,
  "programs": [ /* exact §5.3 Program[] shape, merged & deduped by program_name */ ],
  "site_profile": {
    "tier_required": 3, "render_needed": true, "platform": "... | null",
    "entry_points": [ { "url": "...", "kind": "catalog_index" } /* pages where EXTRACT succeeded */ ],
    "url_patterns": [ "/classes/*" ], "dead_end_patterns": [ "/blog/" ]
  },
  "diagnostics": { "steps": 27, "cost_usd": 0.31, "pages_extracted": 6 }
}
```

**New Edge Function `supabase/functions/scrape-ingest/index.ts`:** validates the payload shape (manual checks, no new deps), then calls the **same** flatten/upsert path (§5.6), the §9.2 address hook, and the §8.1 profile writer; sets `scrape_jobs.status = 'done'` with `result = diagnostics`. Failures → `status = 'failed'` with the error; `attempts < 2` makes one retry possible. This is the single-write-path principle: the Scout never touches `events` directly.

### 7.4 What Tier 3 does NOT do

- No login-walled portals. If registration requires an account (ASC's is one), capture the public class details and leave `ticket_url`/`register_url` pointing at the public signup page or null. Auth-walled scraping is out of scope (§14).
- No CAPTCHA solving. A CAPTCHA is a stop: mark the job failed with reason, surface for human review.
- No parallel tabs against one domain; keep the action delay. The Scout is a polite visitor, not a load test.

---

## Section 8 — Learning Layer: Site Profile Lifecycle (`sv4-profiles`)

### 8.1 Writing profiles (every completion path)

On any crawl completion (Tier 1/2 in `class-discovery`, Tier 3 via `scrape-ingest`), upsert `site_profiles[domain]`:

- `tier_required` = the tier that actually produced the accepted result (0 if platform/JSON-LD alone sufficed, else 1/2/3).
- `entry_points` = pages where extraction yielded ≥1 program, tagged with their classifier kind, most productive first, cap 10.
- `url_patterns` = generalized paths of productive pages: replace the last one or two path segments of sibling productive URLs with `*` (e.g. `/adult-acting-classes/core/iii` + `/adult-acting-classes/core/ii` → `/adult-acting-classes/*/*`). Simple heuristic; do not over-engineer.
- `dead_end_patterns` = path prefixes classified `youth_only | blog_or_news | policy_or_admin | faculty` on ≥2 pages this crawl.
- `render_needed`, `platform`, `address`, `robots` from this crawl; `last_completeness`, `last_success_at = now()`, `consecutive_failures = 0`, `profile_version++` when contents changed.

### 8.2 Warm start (read path — the multi-city payoff)

At crawl start: `profile = site_profiles[domain]`. **Fresh** = `last_success_at` within 14 days AND `consecutive_failures == 0`. When fresh:

- Skip Tier 0 (refresh robots only if `robots.fetched_at` > 7 days old — 1 fetch).
- Seed the frontier from `entry_points` (score 100) and pattern-expanded known URLs; apply `dead_end_patterns` as hard filters.
- Start directly at `tier_required` (e.g., `render_needed` domains go straight through Jina; `tier_required = 3` re-enqueues a Scout job **only if** the Tier 1 warm pass fails — always try the cheap refresh first, because sites that once needed a browser sometimes ship server-rendered redesigns).
- Expected warm cost: **~5–8 fetches** for a weekly refresh vs 30–90 cold. This is what makes 70 NYC/LA schools affordable.

### 8.3 Staleness & self-healing

A warm run is **stale** when: completeness drops > 25 points below `last_completeness`, OR ≥2 entry points 404, OR 0 programs extracted. Then: `consecutive_failures++`, fall back to a full cold crawl (Tier 0 onward) in the same or next invocation, and rewrite the profile from scratch. Profiles are hints, never contracts — when wrong, the system pays one cold crawl and heals. After 3 consecutive failures, escalate (§10) with reason `low_completeness`.

---

## Section 9 — Geocoding & Address Capture (`sv4-geocode`) — kills F5

Four fixes, in order of authority. The LLM already reads every page; asking a regex to compete with it was the original sin.

### 9.1 `school_address` extraction field (`sv4-address-llm`) — primary

Already in the §5.3 prompt. Plumbing: each extraction response's non-null `school_address` → keep the first (or most complete — prefer the one containing a 5-digit ZIP) in `crawl_state.school_address`. The Scout captures it the same way (§7.3).

### 9.2 Completion hook (`sv4-address-thread`)

On the completion path (§5.5 step 4 / `scrape-ingest`): if the venue's `address` is null and `school_address` exists → geocode it (existing geocoder), update **both** `venues` and `schools` with `address`, `latitude`, `longitude`, `geocode_source = 'llm_extracted'`, `geocode_status = 'ok'`. Never overwrite a non-default coordinate with a worse-sourced one (source precedence: `llm_extracted` > `regex` > `places_api`/`mapbox` > `perplexity` > `default`).

### 9.3 Name-search fallback (`sv4-places-fallback`)

When no address was extracted or geocoding it failed, resolve by **business name** before falling to default. Check A6 for which key exists and implement one (both specs below); add the missing secret if neither exists:

**Google Places (preferred):**
```
POST https://places.googleapis.com/v1/places:searchText
Headers: X-Goog-Api-Key: {GOOGLE_PLACES_API_KEY}
         X-Goog-FieldMask: places.displayName,places.formattedAddress,places.location
Body:    { "textQuery": "{venue.name}, {city}, {state}" }
```
Accept the top result only if lowercase-token overlap between `displayName` and `venue.name` ≥ 0.5. → `geocode_source = 'places_api'`.

**Mapbox alternative (token already exists for the map):**
```
GET https://api.mapbox.com/geocoding/v5/mapbox.places/{urlencode(name + ", " + city)}.json
    ?access_token={token}&proximity=-87.6298,41.8781&types=poi,address&limit=1
```
→ `geocode_source = 'mapbox'`.

### 9.4 Regex backstop (`sv4-regex-fix`) — `school-discovery/index.ts` (~line 107)

Make the street-type suffix **optional**, add suite support, bound the street-name length, keep the city anchor (and parameterize it — `venue.city ?? 'Chicago'` — for multi-city):

```ts
const cityAnchor = escapeRegExp(venue.city ?? 'Chicago');
const ADDRESS_RE = new RegExp(
  String.raw`(\d{1,5}\s+[NSEW]?\.?\s*[A-Za-z][\w.'\-]*(?:\s+[\w.'\-]+){0,3}` +
  String.raw`(?:\s+(?:Ave(?:nue)?|St(?:reet)?|Blvd|Boulevard|Rd|Road|Dr(?:ive)?|Way|` +
  String.raw`Ln|Lane|Pl(?:ace)?|Ct|Court|Pkwy|Parkway|Ter(?:race)?|Cir(?:cle)?|` +
  String.raw`Hwy|Highway))?\.?` +
  String.raw`(?:\s*,?\s*(?:Suite|Ste\.?|Unit|#|Fl(?:oor)?)\s*[\w\-]+)?)` +
  String.raw`\s*,?\s*` + cityAnchor,
  'i'
);
```

Validates against: `10 W Hubbard Suite 2E, Chicago` ✓ · `4753 N Broadway, Chicago` ✓ · `1350 N Wells St, Chicago` ✓. Add these three as unit-style assertions in a comment or test.

### 9.5 Backfill action (`sv4-geocode-backfill`)

Port `_archive/class-discovery-v1/index.ts:550–630` into `school-discovery` as action `geocode-backfill`:

```
POST /functions/v1/school-discovery   body: { "action": "geocode-backfill", "limit": 25 }
```

Select `venues` (and matching `schools`) where `geocode_status = 'default'` OR (`latitude = 41.8781` AND `longitude = -87.6298`) OR `latitude IS NULL`. For each: run the new cascade — (1) stored/extracted address → geocode, (2) fetch the site's homepage + contact/location pages and apply §9.4 regex, (3) §9.3 name search, (4) existing Perplexity strategy, (5) leave at default with `geocode_status = 'default'`. Update both tables + `geocode_source/status`. Return `{ processed, fixed, still_default: [names] }`.

**MapView.tsx: no changes.** The line-211 filter is correct behavior; the backfill makes it moot.

---

## Section 10 — Escalation Controller (`sv4-controller`)

One function decides the path; call sites: crawl start, per-fetch error handling, completion.

```ts
function chooseStartingTier(profile?: SiteProfile): Tier {
  if (profile && isFresh(profile)) return Math.min(profile.tier_required, 2) as Tier; // warm; T3 only on warm failure (§8.2)
  return 0;                                                                          // cold: recon first
}

function classifyFetchError(e): 'blocked' | 'timeout' | 'dead' | 'other'  // 403/429→blocked, abort→timeout, ENOTFOUND/SSL→dead

function shouldEscalateToScout(state: CrawlState, trace: StrategyTrace): ScrapeJobReason | null {
  const errs = trace.fetchErrors;                       // add to StrategyTrace (§11)
  if (errs.blocked >= 2 || (errs.blocked + errs.timeout) >= 4) return 'fetch_blocked';
  if (trace.jinaContentPagesEmpty >= 2)                        return 'js_interactive';
  if (state.status === 'complete' && totalPrograms(state) === 0) return 'zero_events_complete';
  if (state.status === 'complete' && trace.completenessAfterFollows < 60
      && profile?.consecutive_failures >= 1)                   return 'low_completeness';
  return null;
}
```

On a non-null reason: `crawl_state.status = 'escalated'`, insert into `scrape_jobs` with payload `{ seed_url, school_name, city, known_good_urls: profile?.entry_points }`. Dedupe: skip insert if a pending/claimed job already exists for the venue. `dead` seed errors keep routing to the existing v3.1 URL resolution, not to the Scout.

---

## Section 11 — Observability (`sv4-observability`)

Extend `StrategyTrace` (`_shared/scraper/types.ts`) — all additive:

```ts
tier: 0 | 1 | 2 | 3;
profileUsed: boolean; profileVersion?: number;
recon?: { identity: string; platform: string | null; catalogUrls: string[]; fetches: number };
classifierCounts?: Record<string, number>;      // page_kind → count
frontierLlmCalls?: number;
jinaFetches?: number; jinaContentPagesEmpty?: number;
fetchErrors?: { blocked: number; timeout: number; dead: number; other: number };
boilerplateDroppedBlocks?: number;
invocations?: number;
addressFound?: string | null;
programsFound?: number; sectionsFound?: number;
```

Traces continue to land in `scrape_logs.strategy_trace` (jsonb — no migration). Scout runs are observable via `scrape_jobs.result`, the existing transformers dashboard (port 3030), and `artifacts/scout/{domain}/` screenshots. Log one summary line per invocation: `[sv4] {venue} tier={t} inv={n} fetches={f} programs={p} completeness={c} stop={reason}`.


---

## Section 12 — Rollout Plan (`sv4-rollout`)

Five phases, each independently shippable and verified before the next. Phase order optimizes for visible wins first (the map fills in on day one) and infrastructure last.

### Phase 1 — Geocoding & address bundle (F5) — smallest, ship first
**Scope:** §3.5 migration, §9.4 regex fix, §9.3 name-search fallback, §9.5 backfill action. (§9.1/9.2 land with Phase 2's prompt.)
**Verify:**
1. Deploy `school-discovery`; `POST {action: "geocode-backfill"}`.
2. `select count(*) from venues where latitude = 41.8781 and longitude = -87.6298;` → expect 0 (or only `geocode_status='default'` stragglers listed in the response).
3. Acting Studio Chicago: `address` non-null matching the **live footer** (10 W Hubbard Suite 2E as of 2026-08-20 — re-check the footer, don't assume), coordinates ≈ (41.890, −87.628), pin visible on the map in the browser.

### Phase 2 — Class-native extraction (F1 part 1)
**Scope:** §3.4 migration, §5.3 class prompt + completeness weights, §5.2 classifier, §5.4 boilerplate strip, §5.6 flattening/upsert, §9.1/9.2 address threading.
**Verify:**
1. Fixture test: saved markdown of `/adult-acting-classes/core/iii` through `buildClassExtractionPrompt` → 1 program, 5 sections, correct dates/instructors/statuses, `school_address` captured (§5.3 worked example).
2. Live single-venue run against ASC (existing per-venue invoke): trace shows `classifierCounts`, `boilerplateDroppedBlocks > 0`, and category names ("Core Acting Classes") absent from stored `program_name`s.

### Phase 3 — Smart frontier + resumable budget (F1 part 2) + Tier 0 (F3)
**Scope:** §3.2 migration, §5.1 LLM frontier, §5.5 resumable crawls + `CLASS_CRAWL_TOTALS`, §4 recon module + politeness, wiring in `class-discovery`.
**Verify:**
1. ASC cold crawl: trace shows recon (platform `wordpress`), `/class-catalog` fetched within the first 5 fetches, zero fetches of `/blog|/webinars|/kids-teens`, ≥20 sections, completeness ≥ 85, `stopReason: 'frontier_exhausted'` or `'complete'` across ≤3 invocations.
2. The Revival: trace `stopReason: 'identity_mismatch'` on loopchicago.com, v3.1 resolution attempted, venue flagged `needs_review` if unresolved — **≤6 fetches total** (was 30 wasted).
3. `crawl_state` row transitions running → complete; re-invoking mid-crawl resumes rather than restarts (visited count grows, no URL fetched twice).

### Phase 4 — Tier 2 trigger + learning layer (F2)
**Scope:** §6 `needsRender`, §3.1 migration, §8 profile read/write, §10 controller (Tier 0–2 paths), §11 trace fields, ADR-0008 documenting profiles-vs-configs rationale.
**Verify:**
1. Comedy Plex: trace shows `jinaFetches > 0` on content-classified pages, programs > 0; `site_profiles.render_needed = true`.
2. ASC second run within 14 days: `profileUsed: true`, total fetches ≤ 8, completeness within 5 points of the cold run.
3. Corrupt an ASC entry point URL manually → next run detects staleness, falls back to cold, rewrites profile (`profile_version` incremented).

### Phase 5 — Tier 3 Scout (F4)
**Scope:** §3.3 migration, §10 escalation inserts, transformers `src/scout/` (§7.1–7.2), `scrape-ingest` Edge Function (§7.3).
**Verify:**
1. Manual job: insert `scrape_jobs` for Factory Theater with reason `manual`; `npm run scout` claims it, quest completes under caps, `scrape-ingest` upserts ≥1 program, job `done`, screenshots in `artifacts/scout/`.
2. Organic escalation: run Factory Theater through `class-discovery` → `fetch_blocked` job auto-inserted; no duplicate job on re-run.
3. Cost receipt in transformers SQLite ≤ $0.50 for the run.

**Final acceptance:** re-run the full Chicago cohort and diff traces against §13.

---

## Section 13 — Acceptance Criteria: Chicago Cohort (`sv4-acceptance`)

| School | v3 observed | v4 required | Expected path |
|---|---|---|---|
| Acting Studio Chicago | 3 events, 65%, 30 fetches, default coords, off map | ≥20 sections across ≥6 programs, completeness ≥85, address = live footer value, on map, cold ≤3 invocations, warm ≤8 fetches | T0→T1 |
| Green Shirt Studio | 14 classes, 28%, 5 links | ≥14 sections, completeness ≥75 (dates/prices filled from detail pages) | T0→T1 |
| Comedy Plex | 0 events, 12 fetches | ≥1 program with sections; `render_needed=true` persisted | T1→T2 |
| The Revival | crawling loopchicago.com | identity mismatch caught ≤6 fetches; correct URL resolved or venue `needs_review` | T0 (+v3.1) |
| Factory Theater / McAninch / Filament | fetch errors (403/timeout) | `fetch_blocked` job auto-created; Scout returns ≥1 program each OR a documented failure reason (CAPTCHA/login) in `scrape_jobs.result` | T1→T3 |
| All schools | — | zero rows at (41.8781, −87.6298); every stored row has `source_url`; no robots-disallowed URL in any `visited` list | — |

---

## Section 14 — Out of Scope (explicitly)

- **Auth-walled registration portals** (ASC's login-required signup): capture public details, leave `register_url` at the public page or null. Revisit only as an opt-in partnership feature.
- **CAPTCHA solving** — never.
- **Partnership/feed ingestion** (schools emailing schedules or exposing iCal): the correct Tier 4 for chronic blockers, but a product/BD workflow, not a scraper change. The `scrape-ingest` endpoint is deliberately shaped so a feed adapter could reuse it later.
- **Multi-city seeding** (discovering the school list for NYC/LA): separate pipeline. v4's contribution is that everything downstream of "here is a school + URL" is already city-agnostic (the only Chicago-specific literal left is the parameterized city anchor in §9.4).
- **Show/theater scraping changes**: `domain: 'theater'` behavior is untouched throughout.

---

## Appendix A — File Change Manifest

| File | Node(s) | Phase | Change |
|---|---|---|---|
| `supabase/migrations/2026082x_*.sql` (×5) | sv4-mig-* | 1–5 | New tables `site_profiles`, `crawl_state`, `scrape_jobs`; columns on `events`, `venues`, `schools` |
| `supabase/functions/school-discovery/index.ts` | sv4-regex-fix, sv4-places-fallback, sv4-geocode-backfill | 1 | Regex, name-search fallback, backfill action, city-anchor parameterization |
| `supabase/functions/_shared/scraper/extraction-prompt.ts` | sv4-class-schema | 2 | Add `buildClassExtractionPrompt` (+ `school_address` field) |
| `supabase/functions/_shared/scraper/page-classifier.ts` | sv4-classifier-gate | 2 | **New** — classify + routing table |
| `supabase/functions/_shared/scraper/boilerplate.ts` | sv4-boilerplate-strip | 2 | **New** — block hashing with schedule guard |
| `supabase/functions/_shared/scraper/completeness.ts` | sv4-class-schema | 2 | Section-level class weights |
| `supabase/functions/_shared/scraper/process-venue.ts` | sv4-storage-flatten, sv4-address-thread | 2 | Programs→sections flattening, upsert key, address hook |
| `supabase/functions/_shared/scraper/link-extractor.ts` | sv4-frontier-llm | 3 | `scoreLinksLLM`, canonicalization, hard filters, keyword fallback |
| `supabase/functions/_shared/scraper/recon.ts` | sv4-recon-* | 3 | **New** — identity, fingerprint, sitemap/catalog, robots |
| `supabase/functions/_shared/scraper/politeness.ts` | sv4-recon-politeness | 3 | **New** — UA constant, rate limiter, robots parser |
| `supabase/functions/_shared/scraper/cost-budget.ts` | sv4-resumable | 3 | `CLASS_CRAWL_TOTALS`, per-invocation construction |
| `supabase/functions/_shared/scraper/strategy-agent.ts` | sv4-frontier-llm, sv4-classifier-gate, sv4-resumable, sv4-tier2, sv4-controller | 3–4 | Wire classifier/frontier/boilerplate; hydrate/persist `crawl_state`; `needsRender`; escalation calls |
| `supabase/functions/class-discovery/index.ts` | sv4-resumable, sv4-profiles, sv4-controller | 3–4 | Invocation flow, warm start, profile write, running-state-first batching |
| `supabase/functions/_shared/scraper/types.ts` | sv4-observability | 3–4 | Trace additions, `SiteProfile`, `Program`/`Section` types |
| `supabase/functions/scrape-ingest/index.ts` | sv4-scout-ingest | 5 | **New** — validate + shared upsert path + job completion |
| `transformers/src/scout/{runner,cartographer,extract,ingest}.ts` | sv4-scout-worker, sv4-cartographer | 5 | **New** — poll/claim, agent quest, extraction, write-back |
| `transformers/src/core/config.ts`, `package.json` | sv4-scout-worker | 5 | AOA config, `npm run scout` |
| `docs/adr/0008-tiered-escalation-and-site-profiles.md` | sv4-profiles | 4 | ADR referencing this spec; profiles-vs-configs rationale |
| `src/components/MapView.tsx` | — | — | **No changes** (filter is correct) |

## Appendix B — Budget & Cost Summary

| Path | Fetches | AI calls | Est. cost | When |
|---|---|---|---|---|
| Tier 0 recon | ≤4 | ≤1 | <$0.01 | Cold starts |
| Tier 1 cold crawl | ≤90 (≤4 invocations) | ≤60 | $0.05–0.15 | New/stale sites |
| Warm refresh | 5–8 | 5–10 | ~$0.01 | Weekly, per known site |
| Tier 2 (per page) | +1 | +1 | ~$0.001 | Evidence-triggered |
| Tier 3 Scout | n/a (browser) | ≤40 steps | ≤$0.50 cap | Escalations + first contact on hard sites |

Steady state for a 70-school city: one cold crawl each (~$7 + a handful of Scout runs), then ~$1/week in warm refreshes. The learning layer is what bends this curve.

— End of specification —
