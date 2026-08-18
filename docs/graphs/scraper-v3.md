# Graph Engineering: Scraper v3 — Completeness-Driven BFS Crawling

**Version:** 3.1.0
**Generated:** 2026-08-17
**Supersedes:** `docs/graphs/multi-pass-extraction.md` v2.2.0 (partial — v3 extends, not replaces)
**Nodes:** 17 | **Phases:** 6 | **Loop specs:** 7

> **Scope note:** This graph documents only the delta from v2. The shared modules
> (`completeness-evaluator.ts`, `targeted-prompt.ts`, `verification-prompt.ts`,
> `process-venue.ts` upsert logic) from the v2 graph remain valid and are not re-specified here.
> The v3 graph supersedes only the nodes listed below. Nodes not listed here are unchanged from v2.
>
> **Decision authority:** ADR `docs/adr/0007-completeness-driven-crawling.md` governs all
> architectural choices in this graph.

---

## Section 1: Task Graph Topology

### Nodes

```
PHASE 0 — FOUNDATION (parallel):
  sv3-types-update
  sv3-budget-upgrade

PHASE 1.5 — URL RESOLUTION (sequential):
  sv3-url-resolver
  sv3-perplexity-integration
  sv3-non-fatal-seed
  sv3-self-healing-urls

PHASE 1 — EXTRACTION IMPROVEMENTS (parallel):
  sv3-json-ld-extractor
  sv3-html-cleaner-update
  sv3-prompt-photo-url

PHASE 2 — LINK SCORING:
  sv3-domain-aware-scoring

PHASE 3 — STRATEGY TREE REWRITE (sequential):
  sv3-bfs-frontier
  sv3-discovery-mode
  sv3-dateless-events
  sv3-jina-fallback
  sv3-source-url-tracking

PHASE 4 — INTEGRATION (parallel):
  sv3-process-venue-update
  sv3-class-discovery-wire

PHASE 5 — VERIFICATION (sequential):
  sv3-test-acting-studio
  sv3-test-theater-regression
  sv3-test-jina-fallback
```

### Edges

```
sv3-types-update     → sv3-url-resolver
sv3-url-resolver     → sv3-perplexity-integration
sv3-url-resolver     → sv3-non-fatal-seed
sv3-non-fatal-seed   → sv3-self-healing-urls
sv3-self-healing-urls → sv3-process-venue-update
sv3-types-update     → sv3-json-ld-extractor
sv3-types-update     → sv3-html-cleaner-update
sv3-types-update     → sv3-bfs-frontier
sv3-types-update     → sv3-process-venue-update
sv3-budget-upgrade   → sv3-bfs-frontier
sv3-json-ld-extractor → sv3-html-cleaner-update
sv3-html-cleaner-update → sv3-bfs-frontier
sv3-prompt-photo-url → sv3-bfs-frontier
sv3-domain-aware-scoring → sv3-bfs-frontier
sv3-bfs-frontier     → sv3-discovery-mode
sv3-bfs-frontier     → sv3-dateless-events
sv3-bfs-frontier     → sv3-jina-fallback
sv3-bfs-frontier     → sv3-source-url-tracking
sv3-source-url-tracking → sv3-process-venue-update
sv3-process-venue-update → sv3-class-discovery-wire
sv3-process-venue-update → sv3-test-acting-studio
sv3-process-venue-update → sv3-test-theater-regression
sv3-jina-fallback    → sv3-test-jina-fallback
```

### DAG

```
Phase 0 (parallel):
  sv3-types-update ──────────────────────────────────┐
  sv3-budget-upgrade ─────────────────────────────────┤
                                                      │
Phase 1 (parallel):                                  │
  sv3-json-ld-extractor ◄──── sv3-types-update       │
  sv3-html-cleaner-update ◄── sv3-json-ld-extractor  │
  sv3-prompt-photo-url (standalone) ─────────────────┤
                                                      │
Phase 2 (sequential after Phase 1):                  │
  sv3-domain-aware-scoring ──────────────────────────┤
                                                      │
Phase 3 (sequential — all converge into BFS):        │
  sv3-bfs-frontier ◄──── ALL ABOVE ──────────────────┘
    ├── sv3-discovery-mode
    ├── sv3-dateless-events
    ├── sv3-jina-fallback
    └── sv3-source-url-tracking
                  │
Phase 4 (parallel):
  sv3-process-venue-update ◄── sv3-source-url-tracking
  sv3-class-discovery-wire ◄── sv3-process-venue-update
                  │
Phase 5 (sequential — gate on Phase 4 complete):
  sv3-test-acting-studio
  sv3-test-theater-regression
  sv3-test-jina-fallback
```

---

## Section 2: Node Specifications

---

### Phase 0: Foundation

---

#### Node: sv3-types-update

- **Type**: types
- **Depends on**: (none)
- **Outputs**: `supabase/functions/_shared/scraper/types.ts`
- **Loop pattern**: one-shot
- **Success criteria**: TypeScript build passes. `ScrapedEvent`, `Pass1Event`, and `TargetedEnrichment` each have `photo_url`, `schedule`, `no_experience`, `drop_in_class`, `audition_required`, `prerequisite`. `MergedEvent` (in `strategy-agent.ts`) gains `source_url` and `photo_url` if not already present.
- **Estimated effort**: Trivial

**Context:** Audit current state of `types.ts` before touching. As of v0.16.x:
- `ScrapedEvent` already has: `photo_url`, `schedule`, `no_experience`, `drop_in_class`, `audition_required`, `prerequisite`. No change needed.
- `Pass1Event` already has: `schedule`, `no_experience`, `drop_in_class`, `audition_required`, `prerequisite`. No change needed.
- `TargetedEnrichment` already has: `schedule`, `no_experience`, `drop_in_class`, `audition_required`, `prerequisite`. No change needed.
- `MergedEvent` (exported from `strategy-agent.ts`, not defined in `types.ts`) does NOT have `source_url`. This must be added.
- `Pass2Verification` does NOT have `photo_url`. The extraction prompt requests `photo_url` from Pass 1, but the verification prompt schema does not carry it through. This must be added.

**Changes required:**

In `supabase/functions/_shared/scraper/strategy-agent.ts`, extend `MergedEvent`:

```typescript
export interface MergedEvent {
  // ... existing fields ...
  source_url: string | null;       // ADD: the page URL where this event was found
  photo_url: string | null;        // already present — verify
  schedule: string | null;         // ADD: propagated from Pass1Event
  no_experience: boolean | null;   // ADD: propagated from Pass1Event
  drop_in_class: boolean | null;   // ADD: propagated from Pass1Event
  audition_required: boolean | null; // ADD: propagated from Pass1Event
  prerequisite: string | null;     // ADD: propagated from Pass1Event
}
```

In `supabase/functions/_shared/scraper/types.ts`, extend `Pass2Verification`:

```typescript
export interface Pass2Verification {
  // ... existing fields ...
  photo_url: string | null;        // ADD: pass through from extraction
  schedule: string | null;         // ADD
  no_experience: boolean | null;   // ADD
  drop_in_class: boolean | null;   // ADD
  audition_required: boolean | null; // ADD
  prerequisite: string | null;     // ADD
}
```

---

#### Node: sv3-budget-upgrade

- **Type**: config
- **Depends on**: (none)
- **Outputs**: `supabase/functions/_shared/scraper/cost-budget.ts`
- **Loop pattern**: one-shot
- **Success criteria**: Default budget allows BFS to process a 6-subpage school site (Acting Studio Chicago) without hitting ceiling prematurely. Safety ceiling prevents runaway crawls.
- **Estimated effort**: Trivial

**Rationale:** The v2 defaults (`maxAiCalls: 6`, `maxFetches: 5`, `maxUsd: 0.012`, `wallClockMs: 120_000`) were designed for the theater domain: 1 initial fetch + TIC + 3 link follows + 1 verify = 6 calls, 5 fetches. BFS on a class site with 6 subpages requires 1 initial + 6 subpage fetches + 6 AI calls + 1 verify = 8 AI calls minimum, 8 fetches minimum.

**New defaults:**

```typescript
const DEFAULTS: BudgetOpts = {
  maxAiCalls: 20,      // was 6  — supports 15-20 page BFS + 1 verify + headroom
  maxFetches: 30,      // was 5  — supports deep BFS without hitting ceiling on page 6
  maxUsd: 0.10,        // was 0.012 — $0.05/venue expected cost, $0.10 safety ceiling
  wallClockMs: 60_000, // was 120_000 — Edge Function has 90s timeout; 60s leaves 30s headroom
};
```

**Note on wallClockMs reduction:** The wall clock is lowered from 120s to 60s because the Supabase Edge Function hard timeout is 90s. At v2's 120s setting, the budget would never trigger the time guard before the function was killed externally. 60s ensures the scraper returns a clean result with `stopReason: 'budget_time'` rather than a timeout error.

---

### Phase 1.5: URL Resolution

---

#### Node: sv3-url-resolver

- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: sv3-types-update
- **Inputs**: VenueTarget with calendar_url, website_url, name, domain
- **Outputs**: `supabase/functions/_shared/scraper/url-resolver.ts` (NEW FILE)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: resolveVenueUrl returns a working URL for a venue with a dead calendar_url
- **Estimated effort**: Medium

**What this solves:** Stored `calendar_url` values go stale as venues redesign their sites, move to new domains, or restructure their URL hierarchy. The scraper has no recovery mechanism — a dead URL kills the entire run for that venue with no fallback. This module provides a priority-ordered candidate queue that is exhausted before the scraper gives up.

**Interface:**

```typescript
// supabase/functions/_shared/scraper/url-resolver.ts

export type UrlRecoveryResult =
  | { status: "resolved"; url: string; strategy: string }
  | { status: "recovery_exhausted" };

/**
 * Attempts to find a working URL for a venue whose calendar_url is dead.
 * Tries candidates in priority order: website_url, common paths,
 * Perplexity search, SerpAPI search.
 * Returns the first URL that yields HTTP 2xx + ≥ 300 chars + ≥ 1 extracted event.
 */
export async function resolveVenueUrl(
  venue: Pick<VenueTarget, "calendar_url" | "website_url" | "name" | "domain">,
  extract: (url: string) => Promise<number>,  // returns event count from URL
): Promise<UrlRecoveryResult>
```

**Candidate queue (priority order):**

```
1. website_url (the venue's homepage — often has a link to the class calendar)
2. Common paths off website_url domain:
   /classes, /schedule, /training, /events, /shows, /workshops,
   /adult-classes, /courses, /programs, /calendar
3. Perplexity API search: "site:{domain} classes schedule"
4. SerpAPI search: "{venue name} Chicago classes schedule site:{domain}"
```

**Acceptance criteria per candidate:**

```
- HTTP 2xx response
- Cleaned text length ≥ 300 chars
- AI extraction returns ≥ 1 event
```

All three conditions must be met. A URL that returns 200 with thin content or 200 with no extractable events is not accepted.

---

#### Node: sv3-perplexity-integration

- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: sv3-url-resolver
- **Inputs**: Perplexity API key (PERPLEXITY_API_KEY secret), venue name, domain
- **Outputs**: `supabase/functions/_shared/scraper/url-resolver.ts` (perplexity search function)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Perplexity returns a valid URL for "Acting Studio Chicago classes page"
- **Estimated effort**: Small

**Implementation:**

```typescript
// Inside url-resolver.ts

async function searchPerplexity(
  venueName: string,
  domain: string,
): Promise<string | null> {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  if (!PERPLEXITY_API_KEY) return null;

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-sonar-small-128k-online",
      messages: [
        {
          role: "user",
          content: `Find the classes or schedule page URL for "${venueName}". Only return URLs from the domain ${domain}. Return only the URL, nothing else.`,
        },
      ],
      max_tokens: 100,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";

  // Extract URL from response
  const urlMatch = text.match(/https?:\/\/[^\s"'<>]+/);
  if (!urlMatch) return null;

  const url = urlMatch[0];
  // Domain restriction: only accept URLs from the venue's own domain
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(domain.replace(/^www\./, ""))) return null;
  } catch {
    return null;
  }

  return url;
}
```

**Security note:** `PERPLEXITY_API_KEY` is set via `supabase secrets set PERPLEXITY_API_KEY=<value>`. Never hardcoded or in VITE_ variables.

---

#### Node: sv3-non-fatal-seed

- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: sv3-url-resolver, sv3-bfs-frontier
- **Inputs**: strategy-agent.ts current Promise.all pattern
- **Outputs**: `supabase/functions/_shared/scraper/strategy-agent.ts` (modified seed fetch)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: A venue with 404 calendar_url does NOT throw. Recovery runs and finds events.
- **Estimated effort**: Medium

**Root cause of current failure:**

```typescript
// CURRENT — fatal if calendar_url is dead:
const rawHtml = await fetchHtml(venue.calendar_url);
// fetchHtml throws on 4xx/5xx — propagates up, kills the entire venue run
```

**Fix — wrap in try/catch, trigger recovery on any fetch failure:**

```typescript
// v3.1 — non-fatal seed fetch with URL recovery
let seedUrl = venue.calendar_url;
let rawHtml = "";

try {
  rawHtml = await fetchHtml(seedUrl);
  budget.recordFetch();
  visitedUrls.add(seedUrl);
} catch (seedErr) {
  console.warn(`[scraper-v3.1] Dead calendar_url for ${venue.name}: ${seedUrl}`, seedErr);

  // Trigger URL recovery
  const recovery = await resolveVenueUrl(venue, async (candidateUrl) => {
    try {
      const html = await fetchHtml(candidateUrl);
      budget.recordFetch();
      const { cleaned } = cleanHtml(html);
      if (cleaned.length < 300) return 0;
      // Quick extraction to count events
      const result = await callDeepSeek(buildExtractionPrompt(venue.name), cleaned, 2048);
      budget.recordAiCall(result.inputTokens, result.outputTokens);
      const parsed = JSON.parse(result.content ?? "{}");
      return (parsed.events ?? []).length;
    } catch {
      return 0;
    }
  });

  if (recovery.status === "resolved") {
    seedUrl = recovery.url;
    rawHtml = await fetchHtml(seedUrl);
    budget.recordFetch();
    visitedUrls.add(seedUrl);
    console.log(`[scraper-v3.1] Recovered URL for ${venue.name}: ${seedUrl} via ${recovery.strategy}`);
  } else {
    // All recovery strategies exhausted — return recovery_exhausted result
    return {
      venueId: venue.id,
      events: [],
      cost: budget.currentCost(),
      stopReason: "recovery_exhausted",
      steps: [],
    };
  }
}
```

**Loop spec:**

1. Plan: Identify the exact line in `executeStrategyTree` where `fetchHtml(venue.calendar_url)` is called. Map all variables that must be available inside the catch block (`budget`, `venue`, `cleanHtml`, `callDeepSeek`, `buildExtractionPrompt`).
2. Execute: Wrap the seed fetch. Import `resolveVenueUrl` from `./url-resolver`. Implement the recovery branch.
3. Verify: Test against a venue with a deliberately broken `calendar_url` (update a test venue's `calendar_url` to `https://actingstudiochicago.com/dead-page-404`). Confirm the scraper does NOT throw. Confirm strategy trace shows `recovery_exhausted` OR a recovered event list. Confirm a venue with a working `calendar_url` is unaffected.

---

#### Node: sv3-self-healing-urls

- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: sv3-non-fatal-seed, sv3-process-venue-update
- **Inputs**: Recovered URL from url-resolver, venues table
- **Outputs**: `supabase/functions/_shared/scraper/process-venue.ts` (modified to write back URL)
- **Loop pattern**: one-shot
- **Success criteria**: After successful recovery, venues.calendar_url is updated in the database
- **Estimated effort**: Small

**Implementation — write recovered URL back to venues table:**

```typescript
// In process-venue.ts, after a successful scrape where recovery occurred:

export async function processVenue(
  venue: VenueTarget,
  result: ScrapeResult,
  recoveredUrl?: string,  // ADD — set when url-resolver found a new URL
): Promise<void> {
  // ... existing upsert logic ...

  // Self-healing: update calendar_url if recovery found a better URL
  if (recoveredUrl && recoveredUrl !== venue.calendar_url) {
    const { error: urlUpdateErr } = await supabase
      .from("venues")
      .update({ calendar_url: recoveredUrl })
      .eq("id", venue.id);

    if (urlUpdateErr) {
      console.warn(`[process-venue] Failed to heal URL for ${venue.name}:`, urlUpdateErr);
    } else {
      console.log(`[process-venue] Self-healed URL for ${venue.name}: ${recoveredUrl}`);
    }
  }
}
```

**Caller in strategy-agent.ts:** Pass `seedUrl` as `recoveredUrl` if `seedUrl !== venue.calendar_url`. If the seed fetch never needed recovery (the original URL worked), `recoveredUrl` is omitted/undefined and no update is made.

**RLS consideration:** The `processVenue` function runs in a Supabase Edge Function with the service role key. The `venues` table allows service role writes. No policy change needed.

---

### Phase 1: Extraction Improvements

---

#### Node: sv3-json-ld-extractor

- **Type**: feature (new module)
- **Depends on**: sv3-types-update
- **Outputs**: `supabase/functions/_shared/scraper/structured-data.ts` (NEW FILE)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Function correctly parses `<script type="application/ld+json">` blocks from raw HTML. Returns structured event data for Event and Course schema types. Does not throw on malformed JSON. Returns `null` when no relevant LD+JSON is found.
- **Estimated effort**: Small

**What this solves:** Many venues (especially institutional and school sites) embed machine-readable event data via JSON-LD schema.org annotations. This data includes exact dates, prices, and registration URLs that the AI extractor may miss in plain text. Parsing JSON-LD before running the AI reduces AI token cost and improves date accuracy.

**Interface:**

```typescript
// supabase/functions/_shared/scraper/structured-data.ts

export interface LdJsonEvent {
  name: string;
  startDate: string | null;
  endDate: string | null;
  url: string | null;
  offers: Array<{ price: number | null; priceCurrency: string | null }> | null;
  location: string | null;
  image: string | null;
  description: string | null;
}

/**
 * Parses all <script type="application/ld+json"> blocks from raw HTML.
 * Filters to schema.org Event, CourseInstance, and Course types.
 * Returns null if no relevant structured data is found.
 */
export function extractLdJsonEvents(rawHtml: string): LdJsonEvent[] | null
```

**Implementation notes:**

```
1. Regex to find all ld+json script blocks:
   /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

2. For each block:
   a. Try JSON.parse — skip on SyntaxError
   b. Normalize: if top-level object has @type, wrap in array
   c. Filter @graph arrays by @type
   d. Accept @type values: "Event", "TheaterEvent", "CourseInstance", "Course", "EducationEvent"
   e. Map to LdJsonEvent: extract name, startDate, endDate, url, offers[].price, image

3. Return null if array is empty after filtering
```

**Loop spec:**

1. Plan: Read raw HTML from Acting Studio Chicago (`https://actingstudiochicago.com/classes`). Identify which ld+json blocks are present (if any). Design regex to capture them.
2. Execute: Implement `extractLdJsonEvents`. Test against 3 fixtures: (a) page with Event ld+json, (b) page with `@graph` array, (c) page with malformed JSON (must not throw).
3. Verify: `extractLdJsonEvents` returns non-null array for a page known to have schema.org Event markup. Returns `null` for a page with no ld+json. Does not throw on `{"broken": }`.

---

#### Node: sv3-html-cleaner-update

- **Type**: feature (modify)
- **Depends on**: sv3-json-ld-extractor
- **Outputs**: `supabase/functions/_shared/scraper/html-cleaner.ts`
- **Loop pattern**: one-shot
- **Success criteria**: `cleanHtml` signature unchanged. Callers receive structured data via a second return value. Raw LD+JSON script blocks are stripped from cleaned text (they are not useful as plain text for the AI).
- **Estimated effort**: Small

**Change:** Modify `cleanHtml` to extract structured data before cleaning:

```typescript
// Before (current signature):
export function cleanHtml(raw: string, maxChars?: number): string

// After (new signature — backward compatible via overload):
export function cleanHtml(
  raw: string,
  maxChars?: number,
): { cleaned: string; ldJsonEvents: LdJsonEvent[] | null }
```

**Important:** This is a breaking change to the call signature. All callers in `strategy-agent.ts` currently use the string return. They must be updated to destructure: `const { cleaned, ldJsonEvents } = cleanHtml(rawHtml)`.

Callers to update in `strategy-agent.ts`:
- Line ~194: `const cleaned = cleanHtml(rawHtml)` → `const { cleaned, ldJsonEvents } = cleanHtml(rawHtml)`
- Line ~331: `const fbCleaned = cleanHtml(fbHtml)` → `const { cleaned: fbCleaned } = cleanHtml(fbHtml)`
- Line ~387: `const linkCleaned = cleanHtml(linkHtml)` → `const { cleaned: linkCleaned, ldJsonEvents: linkLdJson } = cleanHtml(linkHtml)`

The `ldJsonEvents` from the initial extraction page are passed to the AI context as a prefix in the user message (see `sv3-bfs-frontier` node for how they are used).

---

#### Node: sv3-prompt-photo-url

- **Type**: verification
- **Depends on**: (none — independent)
- **Outputs**: `supabase/functions/_shared/scraper/extraction-prompt.ts`
- **Loop pattern**: one-shot
- **Success criteria**: `buildExtractionPrompt` schema includes `photo_url`. Existing `photo_url: null` return from the function already works — verify that the schema and rules comment both document it.
- **Estimated effort**: Trivial

**Context:** The extraction prompt already requests `photo_url` via the `cleanHtml` image preservation step (`[img: https://...]` tokens in cleaned text). The prompt schema block at the top of `buildExtractionPrompt` does not currently list `photo_url` in the example JSON structure, which means the AI treats it as optional and often omits it even when an image URL is present in the text.

**Change:** Add `photo_url` to the example JSON in `buildExtractionPrompt`:

```typescript
// In the return string of buildExtractionPrompt:
// Add after "show_times": {...}:
"photo_url": "https://... or null"
```

Add a rule:

```
PHOTO RULES:
- photo_url: If the text contains [img: https://...] inline after or near the event title, extract that URL as photo_url
- Only use URLs that end in .jpg, .jpeg, .png, .webp, or .gif
- Do NOT use thumbnail URLs or tracking pixels (e.g., width < 50px from URL parameters)
- If no image is clearly associated with this specific event, set to null
```

This applies to both the full extraction prompt and the verification prompt. The verification prompt in `verification-prompt.ts` should also be audited to confirm it passes `photo_url` through in corrections — add `photo_url` to the corrections block if absent.

---

### Phase 2: Link Scoring

---

#### Node: sv3-domain-aware-scoring

- **Type**: feature (modify)
- **Depends on**: (sv3-types-update — for function signature awareness; no type changes needed here)
- **Outputs**: `supabase/functions/_shared/scraper/link-extractor.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Links from class school sites score correctly. `/education` path no longer excluded for class domain. Class keyword set scores class-domain links higher. Theater keyword set unchanged. All matching keywords contribute to score (no early `break`).
- **Estimated effort**: Small

**Problem with current implementation:**

1. `EXCLUDED_PATHS` contains `/education`. For a theater venue, `/education` might be a donor program or youth outreach (not relevant to event scraping). For a class school, `/education` IS the primary catalog path. The exclusion is domain-blind.

2. The keyword scoring loop uses a `break` after the first match:
```typescript
for (const kw of SHOW_KEYWORDS) {
  if (lowerHref.includes(kw) || lowerText.includes(kw)) {
    score += 2;
    break;  // ← only scores the first match
  }
}
```
A URL like `/classes/acting/level-1` matches `classes`, `acting`, and `level` — but only gets +2 instead of +6.

3. `extractCandidateLinks` does not accept a domain parameter, so it cannot differentiate theater vs class scoring.

**Changes:**

```typescript
// Add domain parameter — defaults to "theater" for backward compatibility:
export function extractCandidateLinks(
  rawHtml: string,
  baseUrl: string,
  eventTitles: string[],
  domain?: "theater" | "class",  // ADD
): CandidateLink[]

// Separate keyword sets:
const THEATER_KEYWORDS = [
  "show", "production", "event", "ticket", "performance",
  "season", "play", "musical", "program", "whats-on",
];

const CLASS_KEYWORDS = [
  "class", "classes", "course", "courses", "workshop",
  "level", "beginner", "intermediate", "advanced",
  "enroll", "register", "training", "curriculum", "adult",
  "schedule", "session", "education",
];

// In extractCandidateLinks:
const keywords = domain === "class"
  ? [...CLASS_KEYWORDS, ...THEATER_KEYWORDS]
  : THEATER_KEYWORDS;

// Scoring loop — remove break:
for (const kw of keywords) {
  if (lowerHref.includes(kw) || lowerText.includes(kw)) {
    score += 2;
    // no break — accumulate all matching keywords
  }
}

// Excluded paths — remove /education from the list.
// The full exclusion list becomes:
const EXCLUDED_PATHS = [
  "/about", "/contact", "/donate", "/careers", "/privacy", "/terms",
  "/login", "/cart", "/press", "/accessibility", "/faq", "/board",
  "/staff", "/support", "/membership", "/volunteer",
];
// Note: /education removed. It is a primary path on class school sites.
```

**Callers to update:** `strategy-agent.ts` calls `extractCandidateLinks(rawHtml, venue.calendar_url, events.map(e => e.title))`. Add `effectiveProfile.domain` as the fourth argument.

**Loop spec:**

1. Plan: Write unit tests for the scoring changes. Test cases: (a) theater domain URL `/education` → excluded; (b) class domain URL `/education` → not excluded; (c) URL `/classes/acting/level-1` → scores 3 keywords × 2 = 6; (d) theater URL `/season/2025-hamlet` → scores 2 (season) + 2 (play implicit from context... no, just `season` = 2).
2. Execute: Implement changes. Run `src/lib/genre.test.ts` to confirm no regressions in adjacent modules.
3. Verify: Test extraction against Acting Studio Chicago's root page. Confirm `/classes/acting/`, `/classes/improv/`, `/classes/directing/` all score ≥ 6 and appear in the frontier. Confirm `/contact`, `/about` are excluded.

---

### Phase 3: Strategy Tree Rewrite

All nodes in Phase 3 modify `supabase/functions/_shared/scraper/strategy-agent.ts`. They are specified as sequential sub-changes to the same file. Each node describes a localized change and its verification. They must be built in order because each node changes the state that the next node depends on.

---

#### Node: sv3-bfs-frontier

- **Type**: feature (modify)
- **Depends on**: sv3-budget-upgrade, sv3-html-cleaner-update, sv3-prompt-photo-url, sv3-domain-aware-scoring, sv3-types-update
- **Outputs**: `supabase/functions/_shared/scraper/strategy-agent.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: The fixed 3-link loop is replaced with a BFS queue. Frontier grows as new pages are processed. Loop terminates on budget exhaustion or empty frontier. Strategy trace records all followed URLs. Visited URLs set prevents cycles.
- **Estimated effort**: Medium

**Current code to replace** (lines ~373–430 in `strategy-agent.ts`):

```typescript
// CURRENT v2 — replace this entire block:
if (shouldFollow) {
  const linksToFollow = prioritizeLinks(candidateLinks, incompleteEvents, visitedUrls, 3);
  let noProgressCount = 0;

  for (const link of linksToFollow) {
    if (budget.isExhausted()) break;
    // ... per-link logic ...
  }
}
```

**Replacement — BFS frontier:**

```typescript
// v3 BFS FRONTIER
if (shouldFollow) {
  // Initialize frontier with scored links from the root page.
  // prioritizeLinks with maxLinks=Infinity — budget is the only throttle.
  const initialLinks = prioritizeLinks(
    candidateLinks,
    incompleteEvents,
    visitedUrls,
    Infinity,
  );
  const frontier: CandidateLink[] = [...initialLinks];
  let noProgressCount = 0;

  while (frontier.length > 0 && !budget.isExhausted()) {
    if (!budget.canAffordFetch() || !budget.canAffordAiCall()) break;
    if (noProgressCount >= 2) {
      budget.setStopReason("no_progress");
      break;
    }

    // Take the highest-scored link from the frontier.
    // frontier is maintained in descending score order by prioritizeLinks.
    const link = frontier.shift()!;

    const lfStart = Date.now();
    let rawLinkHtml = "";
    try {
      rawLinkHtml = await fetchHtml(link.url);
      visitedUrls.add(link.url);
      budget.recordFetch();
    } catch (e) {
      console.warn(`[scraper-v3] Fetch failed: ${link.url}`, e);
      continue;
    }

    // sv3-jina-fallback fires here (see sv3-jina-fallback node for the block)
    const { cleaned: linkCleaned, ldJsonEvents: linkLdJson } = cleanHtml(rawLinkHtml);
    if (linkCleaned.length < 100) continue;

    // sv3-discovery-mode or targeted enrichment (see sv3-discovery-mode node)
    // ...

    // After extraction: extract new candidate links from this page
    // and push unvisited ones onto the frontier.
    const pageLinks = extractCandidateLinks(
      rawLinkHtml,
      link.url,
      events.map(e => e.title),
      effectiveProfile.domain,
    );
    const newLinks = prioritizeLinks(pageLinks, incompleteEvents, visitedUrls, Infinity)
      .filter(l => !visitedUrls.has(l.url));

    // Insert new links into frontier maintaining score order.
    frontier.push(...newLinks);
    frontier.sort((a, b) => b.score - a.score);
  }
}
```

**Note on `prioritizeLinks` with `Infinity`:** The current `prioritizeLinks` signature accepts `maxLinks: number`. When called with `Infinity`, `Array.slice(0, Infinity)` returns the full array. No change to `prioritizeLinks` is required.

**Loop spec:**

1. Plan: Read the current STEP 3 block in `strategy-agent.ts` in its entirety (lines 372–430). Identify all variables that the loop reads from outer scope (`events`, `visitedUrls`, `budget`, `weights`, `effectiveProfile`, `steps`, `foundByMap`). Confirm these are all available in the new while loop without refactoring.
2. Execute: Replace the for-loop with the while-loop BFS frontier. Ensure the frontier sort maintains descending score order. Ensure `visitedUrls` is checked BEFORE fetching (not after) to prevent race conditions.
3. Verify: Deploy `event-scraper`. Curl test against Acting Studio Chicago (`https://actingstudiochicago.com`). Confirm strategy trace in `scrape_logs` shows more than 3 `link_follow` steps. Confirm budget exhaustion logs a `stopReason`. Confirm no URL is visited twice.

---

#### Node: sv3-discovery-mode

- **Type**: feature (modify)
- **Depends on**: sv3-bfs-frontier
- **Outputs**: `supabase/functions/_shared/scraper/strategy-agent.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Class-domain crawls use full extraction prompt on each subpage to discover new events. New events are title-deduped before appending. Theater-domain crawls continue to use targeted enrichment prompt (no regression). Discovery mode events have `found_by` populated with the subpage URL.
- **Estimated effort**: Small

**The core distinction between v2 link following and v3 discovery mode:**

- **v2 targeted mode** (theater domain): "We already know about Hamlet. This link might have Hamlet's dates. Extract ONLY Hamlet's missing fields."
- **v3 discovery mode** (class domain): "We don't know what classes exist on this subpage. Extract ALL events you find here."

Discovery mode fires inside the BFS while-loop when `effectiveProfile.domain === 'class'`:

```typescript
// Inside the BFS while-loop, after cleaning linkHtml:

let fieldsFilledIn: string[] = [];

if (isClassDomain) {
  // DISCOVERY MODE: full extraction to find new events on this page
  if (!budget.canAffordAiCall()) break;

  const discoveryResult = await callDeepSeek(
    buildExtractionPrompt(venue.name),
    linkCleaned,
    8192,
  );
  budget.recordAiCall(discoveryResult.inputTokens, discoveryResult.outputTokens);
  totalInputTokens += discoveryResult.inputTokens;
  totalOutputTokens += discoveryResult.outputTokens;

  if (discoveryResult.content) {
    try {
      const parsed = JSON.parse(discoveryResult.content);
      const discovered: Pass1Event[] = parsed.events ?? [];

      // Title dedup: normalize to lowercase, strip punctuation
      const existingTitles = new Set(
        events.map(e => e.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim())
      );

      for (const newEvent of discovered) {
        const normalized = newEvent.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
        if (!existingTitles.has(normalized)) {
          // Tag with source URL for tracking (sv3-source-url-tracking)
          (newEvent as any)._sourceUrl = link.url;
          events.push(newEvent);
          existingTitles.add(normalized);
          foundByMap.set(newEvent.title.toLowerCase(), new Set([link.url]));
          fieldsFilledIn.push(`new_event:${newEvent.title}`);
        }
      }
    } catch { /* parse error */ }
  }
} else {
  // TARGETED MODE: existing v2 enrichment logic (unchanged)
  const incomplete = events
    .map((e, i) => evaluateCompleteness(e, i, weights))
    .filter(c => c.needsFollow)
    .map(c => ({ title: c.title, missingFields: c.missingFields }));

  if (incomplete.length === 0) {
    noProgressCount++;
    continue;
  }

  // ... existing targeted enrichment call (unchanged from v2) ...
}
```

**Dedup normalization:** The normalization (`toLowerCase`, strip non-alphanumeric) handles common title variants: "Acting I" vs "Acting 1", "Scene Study: Level One" vs "Scene Study Level One". Fuzzy matching (substring or Levenshtein) is not needed at this stage — exact normalized match is sufficient for dedup.

**Loop spec:**

1. Plan: Identify the insertion point in the BFS while-loop. The discovery/targeted branch replaces the single targeted-enrichment block. Confirm `isClassDomain` is already declared in the outer scope of `executeStrategyTree`.
2. Execute: Implement the branch. Keep the targeted-mode path byte-for-byte identical to v2 (no unintended changes).
3. Verify: Run class-discovery against Acting Studio Chicago. Confirm scrape_logs shows `link_follow` steps with `fieldsFilledIn` containing `new_event:` prefixed entries. Run event-scraper against a known theater (e.g., Steppenwolf) — confirm no regression in targeted mode. Check that events from theater scrape do NOT have `new_event:` in `fieldsFilledIn`.

---

#### Node: sv3-dateless-events

- **Type**: feature (modify)
- **Depends on**: sv3-bfs-frontier
- **Outputs**: `supabase/functions/_shared/scraper/strategy-agent.ts`
- **Loop pattern**: one-shot
- **Success criteria**: Dateless events are not filtered before verification. They are passed through with `extraction_status: 'no_dates_on_site'`. Verification step only runs on events with `start_date != null` (existing behavior, preserved).
- **Estimated effort**: Trivial

**Current problematic filter** (lines ~441–442 in `strategy-agent.ts`):

```typescript
// REMOVE THIS LINE:
const eventsForVerify = events.filter(e => e.start_date != null);
const eventsSkipVerify = events.filter(e => e.start_date == null);
```

The current code correctly separates events for verify vs. skip-verify — the only change is that `eventsSkipVerify` events should still be written to the database as `extraction_status: 'no_dates_on_site'`, not discarded. This behavior already exists — the filter creates the `unverifiedMerged` array that is concatenated into `mergedEvents`. No logic change is needed; the note here is to confirm this path is working and add a log line:

```typescript
if (eventsSkipVerify.length > 0) {
  console.log(
    `[scraper-v3] ${venue.name}: ${eventsSkipVerify.length} dateless events → no_dates_on_site`
  );
}
```

The real change is in `process-venue.ts`: confirm that `extraction_status: 'no_dates_on_site'` events are NOT filtered from the upsert loop. Search `process-venue.ts` for any `filter(e => e.start_date)` or similar guards and remove them.

---

#### Node: sv3-jina-fallback

- **Type**: feature (modify)
- **Depends on**: sv3-bfs-frontier
- **Outputs**: `supabase/functions/_shared/scraper/strategy-agent.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: When `cleanHtml` returns fewer than 300 characters after a successful fetch, a Jina Reader re-fetch is attempted. Jina response replaces the cleaned text for AI extraction. Jina failure is logged but non-fatal (falls back to empty, skips this URL). Strategy trace records a `jina_fallback` step.
- **Estimated effort**: Small

**Jina Reader API:** Public endpoint, no API key required. Takes up to 30s for complex pages.
- URL format: `https://r.jina.ai/{target_url}` (no URL encoding needed for simple URLs)
- Returns: clean markdown text of the rendered page content
- Rate limit: ~20 requests/minute on public endpoint (acceptable for our use case)

**Implementation — add to `StrategyStep.step` union type in `types.ts`:**

```typescript
export interface StrategyStep {
  step: "initial_extract" | "link_follow" | "website_fallback" | "verify"
      | "aggregator_crossref" | "aggregator_detail"
      | "jina_fallback";  // ADD
  // ... rest unchanged
}
```

**Fallback logic — fires in two locations:**

1. After the initial `cleanHtml(rawHtml)` call (the venue's calendar URL):

```typescript
let { cleaned, ldJsonEvents } = cleanHtml(rawHtml);

if (cleaned.length < 300 && budget.canAffordFetch()) {
  try {
    const jinaUrl = `https://r.jina.ai/${venue.calendar_url}`;
    const jinaHtml = await fetchHtml(jinaUrl);
    budget.recordFetch();
    cleaned = jinaHtml; // Jina returns clean markdown, no further cleaning needed
    steps.push({
      step: "jina_fallback", url: venue.calendar_url, aiCalls: 0,
      inputTokens: 0, outputTokens: 0,
      eventsAffected: 0, fieldsFilledIn: ["jina_rendered"],
      durationMs: 0, // will be measured properly in full implementation
    });
  } catch (e) {
    console.warn(`[scraper-v3] Jina fallback failed for ${venue.calendar_url}:`, e);
  }
}
```

2. Inside the BFS while-loop, after `cleanHtml(rawLinkHtml)`:

```typescript
let { cleaned: linkCleaned } = cleanHtml(rawLinkHtml);

if (linkCleaned.length < 300 && budget.canAffordFetch()) {
  try {
    const jinaUrl = `https://r.jina.ai/${link.url}`;
    const jinaRaw = await fetchHtml(jinaUrl);
    budget.recordFetch();
    linkCleaned = jinaRaw;
  } catch (e) {
    console.warn(`[scraper-v3] Jina fallback failed for ${link.url}:`, e);
    continue; // skip this link entirely if Jina also fails
  }
}
if (linkCleaned.length < 100) continue;
```

**Threshold:** 300 characters is the detection threshold for "probably JS-rendered." The existing logic uses 100 characters as the minimum for extraction. 300 gives a buffer: a page that renders some static HTML but not its class catalog (common on hybrid sites) might return 150–250 characters of navigation chrome — Jina should still be attempted.

**Loop spec:**

1. Plan: Identify a known JS-rendered venue site in the database (or use a public example). Confirm that `fetchHtml` returns `< 300 chars` for it.
2. Execute: Implement the fallback in both locations. Add `jina_fallback` to `StrategyStep.step` union.
3. Verify: Run event-scraper against the JS-rendered venue. Confirm strategy trace shows a `jina_fallback` step. Confirm events are extracted from the Jina-cleaned text. Confirm that a non-JS site (e.g., Red Orchid Theatre) does NOT trigger the fallback.

---

#### Node: sv3-source-url-tracking

- **Type**: feature (modify)
- **Depends on**: sv3-bfs-frontier, sv3-discovery-mode
- **Outputs**: `supabase/functions/_shared/scraper/strategy-agent.ts`, `supabase/functions/_shared/scraper/process-venue.ts`
- **Loop pattern**: one-shot
- **Success criteria**: Each `MergedEvent` has a `source_url` set to the page URL where it was found. Events found on the initial calendar page have `source_url: venue.calendar_url`. Events discovered on subpages have `source_url: <subpage_url>`. `process-venue.ts` writes `source_url` to the events table.
- **Estimated effort**: Small

**Mechanism:** The `_sourceUrl` private tag set in `sv3-discovery-mode` (via `(newEvent as any)._sourceUrl = link.url`) is a temporary marker. Before the merge step, this tag is promoted to a proper field. After `mergeExtractionResults`, each event in `mergedEvents` should have `source_url` set.

**In `strategy-agent.ts`:** After the BFS loop completes, before `mergeExtractionResults`:

```typescript
// Attach source_url to each Pass1Event before merge
for (const event of events) {
  const rawSource = (event as any)._sourceUrl;
  if (!rawSource) {
    (event as any)._sourceUrl = venue.calendar_url;
  }
}
```

In `mergeExtractionResults` (the private function within `strategy-agent.ts`), propagate `_sourceUrl` into `MergedEvent.source_url`:

```typescript
merged.push({
  ...finalEvent,
  source_url: (finalEvent as any)._sourceUrl ?? venue.calendar_url,
  // ... rest of merged fields
});
```

**In `process-venue.ts`:** The upsert loop must include `source_url` in the upserted columns. Verify the events table has a `source_url` column — if not, add a migration:

```sql
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS source_url text;
```

Migration file: `supabase/migrations/20260817000001_events_source_url.sql`

---

### Phase 4: Integration

---

#### Node: sv3-process-venue-update

- **Type**: feature (modify)
- **Depends on**: sv3-source-url-tracking, sv3-types-update
- **Outputs**: `supabase/functions/_shared/scraper/process-venue.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Upsert loop writes `source_url`, `schedule`, `no_experience`, `drop_in_class`, `audition_required`, `prerequisite` from `MergedEvent` to the events table. No dateless events are filtered before upsert. `field_summary` in `ScrapeResult` reflects the new fields.
- **Estimated effort**: Small

**Changes to `process-venue.ts`:**

1. Add new fields to the upsert object:

```typescript
// In the upsert loop, add these columns alongside existing ones:
source_url: event.source_url ?? null,
schedule: event.schedule ?? null,
no_experience: event.no_experience ?? null,
drop_in_class: event.drop_in_class ?? null,
audition_required: event.audition_required ?? null,
prerequisite: event.prerequisite ?? null,
```

2. Audit for any `filter(e => e.start_date)` guards. Remove if found.

3. Update `field_summary.event_details` to include `has_source_url`:

```typescript
event_details: mergedEvents.map(e => ({
  title: e.title,
  start_date: e.start_date,
  end_date: e.end_date,
  price_min: e.price_min,
  price_max: e.price_max,
  has_ticket: !!e.ticket_url,
  has_times: !!e.show_times,
  found_by: e.found_by,
  source_url: e.source_url,   // ADD
})),
```

**Loop spec:**

1. Plan: Read `process-venue.ts` in full. Note the current upsert column list and confirm which columns from `MergedEvent` are missing. Note line numbers for the upsert object.
2. Execute: Add the new columns. Confirm the DB migration for `source_url` is applied before testing (migration from `sv3-source-url-tracking`).
3. Verify: After deploying, trigger a scrape of Acting Studio Chicago via the admin UI. Query the events table: `SELECT title, source_url, schedule, no_experience FROM events WHERE venue_id = '<acting_studio_id>' ORDER BY created_at DESC LIMIT 10`. Confirm `source_url` is populated with subpage URLs (not just the root URL) for events discovered on subpages.

---

#### Node: sv3-class-discovery-wire

- **Type**: feature (modify)
- **Depends on**: sv3-process-venue-update
- **Outputs**: `supabase/functions/class-discovery/index.ts`
- **Loop pattern**: one-shot
- **Success criteria**: `class-discovery` function passes the updated `StrategyProfile` with `domain: "class"`. New fields from `MergedEvent` (`source_url`, class-specific fields) are propagated through to the `processVenue` call. Class-discovery scrape logs show the BFS strategy trace.
- **Estimated effort**: Trivial

**Context:** `class-discovery/index.ts` calls `processVenue` with a `StrategyProfile` of `domain: "class"`. Because `processVenue` delegates to `executeStrategyTree`, all v3 changes (BFS frontier, discovery mode, Jina fallback) automatically apply to class-discovery runs. No structural changes are needed — this node is a verification pass.

**Specific checks:**

1. Confirm `class-discovery/index.ts` passes `{ domain: "class", fieldWeights: CLASS_FIELD_WEIGHTS, logFeaturePrefix: "class-discovery" }` as the profile to `processVenue`. If it passes `undefined`, update to pass the explicit class profile.
2. Confirm the `CLASS_FIELD_WEIGHTS` object includes the class-specific fields (`instructor_name`, `skill_level`) from ADR-0006 Decision 4.
3. Confirm no `start_date != null` filter in `class-discovery/index.ts` itself (separate from `strategy-agent.ts`).

---

### Phase 5: Verification

---

#### Node: sv3-test-acting-studio

- **Type**: test
- **Depends on**: sv3-process-venue-update, sv3-class-discovery-wire
- **Outputs**: (no file changes — verification only)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Acting Studio Chicago scrape returns at least 4 distinct class events with `event_type: 'class'`. At least 2 events have non-null `instructor_name`. At least 1 event has a `source_url` different from the root calendar URL. No duplicate events (normalized title dedup working).
- **Estimated effort**: Small

**Test procedure:**

1. Deploy `event-scraper` (or `class-discovery`) to Supabase.
2. Trigger scrape of Acting Studio Chicago via curl:

```bash
curl -X POST \
  "$(supabase functions url event-scrape-batch)" \
  -H "Authorization: Bearer $(supabase secrets get SUPABASE_SERVICE_ROLE_KEY)" \
  -H "Content-Type: application/json" \
  -d '{"venue_ids": ["<acting_studio_venue_id>"]}'
```

3. Query results:

```sql
SELECT
  title,
  event_type,
  start_date,
  instructor_name,
  skill_level,
  schedule,
  source_url,
  extraction_status
FROM events
WHERE venue_id = '<acting_studio_venue_id>'
  AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY title;
```

4. Check `scrape_logs` for the strategy trace:

```sql
SELECT
  strategy_trace -> 'steps' AS steps,
  strategy_trace -> 'linksFollowed' AS links_followed,
  strategy_trace -> 'stopReason' AS stop_reason
FROM scrape_logs
WHERE venue_id = '<acting_studio_venue_id>'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:** `links_followed` array has ≥ 4 entries. `stop_reason` is `null` (frontier exhausted naturally) or `budget_calls`/`budget_time` (safety ceiling hit cleanly). NOT `no_progress` (which would indicate the discovery mode found nothing on consecutive pages).

**Loop spec:**

1. Plan: Get the venue ID for Acting Studio Chicago from the DB. Confirm the venue has `calendar_url` set to the classes page. Confirm `class-discovery` is deployed.
2. Execute: Run the curl command. Wait for response (expect 30–60s).
3. Verify: Run the SQL queries. If `< 4 events` returned, check the strategy trace for stop reason. If `no_progress` on the first page, the discovery mode is not finding events — check that `buildExtractionPrompt` is being called (not `buildTargetedExtractionPrompt`) in the class branch.

---

#### Node: sv3-test-theater-regression

- **Type**: test
- **Depends on**: sv3-process-venue-update
- **Outputs**: (no file changes — verification only)
- **Loop pattern**: one-shot
- **Success criteria**: Three known theater venues (Steppenwolf, Red Orchid, Chicago Shakespeare) return the same or greater event count as their most recent v2 scrape. No events have `new_event:` in strategy trace `fieldsFilledIn` (discovery mode must not fire for theater domain). Strategy trace `stopReason` is not `no_progress` on the first step.
- **Estimated effort**: Small

**Test procedure:**

```bash
# Scrape 3 theaters
curl -X POST \
  "$(supabase functions url event-scrape-batch)" \
  -H "Authorization: Bearer $(supabase secrets get SUPABASE_SERVICE_ROLE_KEY)" \
  -H "Content-Type: application/json" \
  -d '{"venue_ids": ["<steppenwolf_id>", "<red_orchid_id>", "<chicago_shakespeare_id>"]}'
```

Query:

```sql
SELECT
  v.name,
  COUNT(e.id) AS event_count,
  sl.strategy_trace -> 'stopReason' AS stop_reason,
  sl.strategy_trace -> 'linksFollowed' AS links_followed
FROM venues v
JOIN events e ON e.venue_id = v.id
JOIN scrape_logs sl ON sl.venue_id = v.id
WHERE v.id IN ('<steppenwolf_id>', '<red_orchid_id>', '<chicago_shakespeare_id>')
  AND sl.created_at > NOW() - INTERVAL '10 minutes'
GROUP BY v.name, sl.strategy_trace;
```

**Pass criteria:** Event counts match or exceed the last known values (check against previous `scrape_logs` run). No `link_follow` steps with `new_event:` fields. TIC crossref steps still present in trace for theater venues.

---

#### Node: sv3-test-jina-fallback

- **Type**: test
- **Depends on**: sv3-jina-fallback
- **Outputs**: (no file changes — verification only)
- **Loop pattern**: one-shot
- **Success criteria**: A known JS-heavy site triggers the Jina fallback. Strategy trace shows a `jina_fallback` step. Events are extracted from the Jina-rendered text.
- **Estimated effort**: Trivial

**Test procedure:** Identify a venue in the DB whose site is React-rendered. If none is currently in the DB, add a test venue temporarily:

```sql
INSERT INTO venues (name, slug, calendar_url, website_url, venue_type, city, state, is_active)
VALUES (
  'Test JS Venue',
  'test-js-venue',
  'https://example-react-rendered-site.com/events',
  'https://example-react-rendered-site.com',
  'storefront',
  'Chicago',
  'IL',
  false  -- inactive so it does not appear on the map
);
```

Trigger scrape. Check `scrape_logs.strategy_trace` for `jina_fallback` step.

If no suitable JS-rendered site is available: instrument `cleanHtml` to log `cleaned.length` in dev mode and monitor the next full batch run for any venue that triggers the `< 300 chars` threshold.

---

## Section 3: Loop Specifications

### Loop: sv3-url-resolver

- **Trigger**: executeStrategyTree called for a venue
- **Inner cycle**:
  1. Plan: Build candidate URL queue [calendar_url, website_url, common paths, Perplexity results, SerpAPI results]
  2. Execute: For each candidate in priority order: fetch URL, check HTTP 2xx AND content ≥ 300 chars
  3. Verify: Run AI extraction on first valid candidate. If events.length > 0, URL is verified.
- **Evaluator**: resolved URL yields ≥ 1 extracted event
- **Retry**: Next candidate URL in queue
- **Stop condition**: First URL yields events OR all candidates exhausted (return recovery_exhausted)

---

### Loop: sv3-non-fatal-seed

- **Trigger**: fetchHtml(calendar_url) throws or returns thin content or extraction returns 0 events
- **Inner cycle**:
  1. Plan: Identify failure type (404, SSL, timeout, empty extraction)
  2. Execute: Call resolveVenueUrl() to find alternative
  3. Verify: Check resolved URL produced ≥ 1 event
- **Evaluator**: events.length > 0 after extraction
- **Retry**: resolveVenueUrl tries next recovery strategy internally
- **Stop condition**: Events found OR resolveVenueUrl returns null (all strategies exhausted)

---

### Loop: sv3-json-ld-extractor

- **Trigger**: Phase 1 begins (sv3-types-update complete)
- **Inner cycle**:
  1. Plan: Fetch raw HTML from 3 venues with known LD+JSON (check schema.org/Event usage). Draft the regex and parsing logic. Define the `LdJsonEvent` interface.
  2. Execute: Implement `extractLdJsonEvents`. Write 3 unit tests in `src/lib/settingsStorage.test.ts` or a new `supabase/functions/_shared/scraper/structured-data.test.ts` if the test runner supports Deno tests.
  3. Verify: Function returns correct `LdJsonEvent[]` for a page with schema.org Event markup. Returns `null` for a page with no ld+json. Does not throw on malformed JSON. Passes `deno check` without type errors.
- **Evaluator**: `extractLdJsonEvents` returns non-null for at least one real venue site.
- **Retry**: Fix regex or JSON parsing (max 1 cycle). Most failures will be malformed LD+JSON on specific sites — the `try/catch` already handles these gracefully.
- **Stop condition**: 3 test cases pass.

---

### Loop: sv3-domain-aware-scoring

- **Trigger**: Phase 1 complete
- **Inner cycle**:
  1. Plan: Write test cases for the scoring changes (see node spec). Identify the exact lines to change in `link-extractor.ts`.
  2. Execute: Remove `/education` from `EXCLUDED_PATHS`. Split into `THEATER_KEYWORDS` and `CLASS_KEYWORDS`. Add `domain` param. Remove the `break`. Update callers in `strategy-agent.ts`.
  3. Verify: Run the test cases. Test extraction against Acting Studio Chicago root page — confirm at least 6 class subpage links appear in the scored output. Confirm theater scrape links do not include `/education` path.
- **Evaluator**: Acting Studio class subpages score ≥ 6. Theater `/education` path scores 0 (excluded path filter still applies when domain=theater — wait, we removed /education from EXCLUDED_PATHS entirely). Re-evaluate: since `/education` is removed from excluded paths globally, theater venues will now score `/education` links using theater keywords. `/education` contains no theater keywords, so score = 0 and it will rank at the bottom of the frontier — effectively deprioritized without being explicitly excluded. This is acceptable.
- **Retry**: Adjust keyword sets if theater regression occurs (max 1 cycle).
- **Stop condition**: Acting Studio root page frontier contains the 6 known class subpages.

---

### Loop: sv3-bfs-frontier

- **Trigger**: All Phase 1 and Phase 2 nodes complete
- **Inner cycle**:
  1. Plan: Read the full `executeStrategyTree` function. Map all outer-scope variables the current link-follow loop reads. Design the while-loop structure including frontier initialization, score-ordering, and progress tracking.
  2. Execute: Replace the for-loop with the while-loop BFS frontier. Update `prioritizeLinks` call to pass `Infinity`. Add frontier expansion after each page is processed.
  3. Verify: Deploy and test against Acting Studio Chicago. Strategy trace shows > 3 `link_follow` steps. No URL appears twice in `linksFollowed`. Budget exhaustion stops the loop cleanly.
- **Evaluator**: `scrape_logs.strategy_trace.linksFollowed.length` > 3 for Acting Studio Chicago. `stopReason` is not `no_progress` immediately.
- **Retry**: Fix frontier expansion or score ordering (max 2 cycles).
- **Stop condition**: Acting Studio Chicago returns ≥ 4 class events in a single scrape run.

---

### Loop: sv3-discovery-mode

- **Trigger**: sv3-bfs-frontier complete
- **Inner cycle**:
  1. Plan: Identify the exact line in the BFS while-loop where the targeted/discovery branch must be inserted. Confirm `isClassDomain` is in scope. Review the dedup normalization logic.
  2. Execute: Insert the discovery/targeted branch. Test the dedup normalization against "Acting I" vs "acting i" and "Scene Study: Level One" vs "Scene Study Level One".
  3. Verify: Class-domain scrape of Acting Studio Chicago returns events with `new_event:` in `fieldsFilledIn` for each subpage where new classes were discovered. Theater-domain scrape shows no `new_event:` entries.
- **Evaluator**: At least 2 `link_follow` steps in the Acting Studio trace have `fieldsFilledIn` containing `new_event:` prefixed entries. Theater venues do not.
- **Retry**: If discovery mode returns 0 new events, check that `buildExtractionPrompt` is called (not `buildTargetedExtractionPrompt`). Check that dedup normalization is not over-aggressively collapsing distinct classes (max 1 cycle).
- **Stop condition**: Acting Studio Chicago returns ≥ 4 distinct class events discovered across ≥ 3 subpages.

---

### Loop: sv3-process-venue-update

- **Trigger**: sv3-source-url-tracking complete
- **Inner cycle**:
  1. Plan: Read `process-venue.ts` in full. List the current upsert columns. Identify the delta (new columns from sv3-types-update). Confirm the DB migration for `source_url` is applied.
  2. Execute: Add new columns to the upsert object. Update `field_summary`. Apply the migration.
  3. Verify: After deployment, query events table for Acting Studio Chicago. Confirm `source_url`, `schedule`, `no_experience` are populated. Confirm no null-constraint errors in function logs.
- **Evaluator**: `SELECT source_url, schedule, no_experience FROM events WHERE venue_id = '<acting_studio_id>' LIMIT 5` returns non-null `source_url` for at least one row and non-null `schedule` for at least one row.
- **Retry**: Fix column name mismatches or missing migration (max 1 cycle).
- **Stop condition**: Full scrape run completes without database errors. New columns populated.

---

## Section 4: Shared State

| Key | Type | Set by | Consumed by |
|-----|------|--------|-------------|
| `frontier: CandidateLink[]` | in-memory | sv3-bfs-frontier (init from root page), BFS loop (expansion) | BFS while-loop (dequeue) |
| `visitedUrls: Set<string>` | in-memory | strategy-agent (init), BFS loop (add after fetch) | frontier expansion (filter), fetchHtml guard |
| `events: Pass1Event[]` | in-memory | extractEventsPass1 (init), discovery-mode (append) | completeness-evaluator, targeted enrichment, verify step |
| `foundByMap: Map<string, Set<string>>` | in-memory | strategy-agent | process-venue (field_summary.found_by) |
| `_sourceUrl: string` | in-memory (temp tag) | discovery-mode (set on new events) | sv3-source-url-tracking (promotes to MergedEvent.source_url) |
| `ldJsonEvents: LdJsonEvent[] \| null` | in-memory | sv3-html-cleaner-update (from cleanHtml) | BFS loop (prepended to user message for AI context) |
| `source_url` | DB column (events) | process-venue upsert | admin UI, analytics, debugging |
| `schedule, no_experience, drop_in_class, audition_required, prerequisite` | DB columns (events) | process-venue upsert | VenueSheet class section, filter chips |
| `jina_fallback` step | StrategyTrace | sv3-jina-fallback | scrape_logs JSONB, admin monitoring |

---

## Section 5: Build Phases

### Phase 0: Foundation (parallel — no dependencies)
- [ ] sv3-types-update — extend `MergedEvent` and `Pass2Verification` in `strategy-agent.ts` and `types.ts`
- [ ] sv3-budget-upgrade — raise defaults in `cost-budget.ts`

### Phase 1.5: URL Resolution (sequential — depends on Phase 0)
- [ ] sv3-url-resolver — create `url-resolver.ts` with candidate queue logic
- [ ] sv3-perplexity-integration — add Perplexity search function to `url-resolver.ts`
- [ ] sv3-non-fatal-seed → sv3-self-healing-urls — wrap seed fetch, write recovered URL back to venues

### Phase 1: Extraction Improvements (parallel — depend only on Phase 0)
- [ ] sv3-json-ld-extractor — create `structured-data.ts`
- [ ] sv3-html-cleaner-update — modify `html-cleaner.ts` signature, call `extractLdJsonEvents`
- [ ] sv3-prompt-photo-url — update `extraction-prompt.ts` schema block

### Phase 2: Link Scoring (sequential — depends on Phase 1 for caller context)
- [ ] sv3-domain-aware-scoring — modify `link-extractor.ts`

### Phase 3: Strategy Tree Rewrite (sequential — all modify `strategy-agent.ts`)
- [ ] sv3-bfs-frontier — replace 3-link loop with BFS while-loop
- [ ] sv3-discovery-mode — insert class/theater branch inside BFS loop
- [ ] sv3-dateless-events — confirm no filtering of dateless events, add log line
- [ ] sv3-jina-fallback — add Jina re-fetch on `cleaned.length < 300`
- [ ] sv3-source-url-tracking — attach `_sourceUrl` tag, promote to `MergedEvent.source_url`, add migration

### Phase 4: Integration (parallel — depend on Phase 3 complete)
- [ ] sv3-process-venue-update — add new columns to upsert loop, apply migration
- [ ] sv3-class-discovery-wire — verify class-discovery passes correct profile, audit for filters

### Phase 5: Verification (sequential — gate on Phase 4 deployed)
- [ ] sv3-test-acting-studio — curl scrape, verify ≥ 4 class events across ≥ 3 subpages
- [ ] sv3-test-theater-regression — curl scrape 3 theaters, verify no regression
- [ ] sv3-test-jina-fallback — identify JS-rendered venue, verify jina_fallback step in trace

---

## Section 6: File Index

| File | Node(s) | Action |
|------|---------|--------|
| `supabase/functions/_shared/scraper/types.ts` | sv3-types-update | Modify — extend `Pass2Verification` |
| `supabase/functions/_shared/scraper/strategy-agent.ts` | sv3-types-update, sv3-bfs-frontier, sv3-discovery-mode, sv3-dateless-events, sv3-jina-fallback, sv3-source-url-tracking | Modify — extend `MergedEvent`, rewrite STEP 3 block |
| `supabase/functions/_shared/scraper/cost-budget.ts` | sv3-budget-upgrade | Modify — raise DEFAULTS |
| `supabase/functions/_shared/scraper/structured-data.ts` | sv3-json-ld-extractor | Create — new module |
| `supabase/functions/_shared/scraper/html-cleaner.ts` | sv3-html-cleaner-update | Modify — call `extractLdJsonEvents`, change return type |
| `supabase/functions/_shared/scraper/extraction-prompt.ts` | sv3-prompt-photo-url | Modify — add photo_url to schema |
| `supabase/functions/_shared/scraper/link-extractor.ts` | sv3-domain-aware-scoring | Modify — add domain param, split keywords, remove break |
| `supabase/functions/_shared/scraper/process-venue.ts` | sv3-source-url-tracking, sv3-process-venue-update | Modify — add new columns to upsert |
| `supabase/functions/class-discovery/index.ts` | sv3-class-discovery-wire | Verify/Modify — confirm class profile, remove date filters |
| `supabase/migrations/20260817000001_events_source_url.sql` | sv3-source-url-tracking | Create — add `source_url text` column to events |

---

## Section 7: Decision Cross-References

| Decision | ADR | Node |
|----------|-----|------|
| BFS over fixed cap | ADR-0007 § "Option D (Chosen)" | sv3-bfs-frontier |
| No headless browser — Jina Reader instead | ADR-0007 § "Option B: Rejected" | sv3-jina-fallback |
| No per-site configs | ADR-0007 § "Option C: Rejected" | sv3-discovery-mode |
| Safety ceiling governs crawl depth | ADR-0007 § "Consequences — Negative" | sv3-budget-upgrade |
| Dateless class events preserved | ADR-0007 § "Context — Problem 2" | sv3-dateless-events |
| Domain-aware link scoring | ADR-0007 § "Context — Problem 4" | sv3-domain-aware-scoring |
| StrategyProfile domain distinction preserved | ADR-0006 § "Decision 4" | sv3-discovery-mode, sv3-class-discovery-wire |
