# ADR 0002: Venue Discovery Pipeline Architecture

**Date:** 2026-08-09
**Status:** Accepted
**Feature:** Venue Discovery Pipeline
**PRD:** `.claude/docs/prd/venue-discovery-pipeline.md`

---

## Context

The Art of Art covers approximately 18% of the Chicago theater landscape with 37 hand-curated venues. Adding a venue currently requires a developer SQL migration — a 20–30 minute manual process. The League of Chicago Theatres publishes a public member directory at chicagoplays.com that lists 200+ theaters. We need an automated mechanism to discover, validate, and incorporate new venues into the database without ongoing developer intervention.

Three architectural questions required explicit decisions before implementation:

1. Should discovered venues be auto-inserted into `venues` or queued for admin review?
2. Which geocoding provider should we use: Google Places API or Nominatim (OpenStreetMap)?
3. Should the ChicagoPlays directory scrape use AI extraction (as `event-scraper` does for events) or structured HTML parsing?

---

## Decision 1: Append-Only Queue with Admin Promotion

### Decision

Discovered venues are **never written directly to the `venues` table**. All pipeline output is append-only to a `venue_discovery_queue` table. Only an explicit admin promotion action writes to `venues`.

### Alternatives Considered

**Option A: Auto-insert discovered venues as `status = 'draft'` in `venues`**

The pipeline writes directly to `venues` with a `status` column (`draft` | `live`). End users only see `live` venues. Admin approves drafts by flipping status.

- Pro: Simpler schema — one fewer table.
- Con: The `venues` table is the source of truth for the map, the AI mentor's knowledge base, and the event scraper's target list. Drafts would need RLS filtering on every query across every consumer. A missed filter anywhere exposes unreviewed data to users.
- Con: The event scraper would need to explicitly exclude `status = 'draft'` venues — a cross-cutting concern that is easy to forget and hard to test.
- Con: The schema change propagates to every place `venues` is consumed (map, mentor context injection, watchlist, reviews).

**Option B: Fully automated with deduplication gate (no human review)**

Venues passing dedup and enrichment with high confidence are inserted directly into `venues`. Low-confidence results are queued.

- Pro: Completely hands-off operation.
- Con: Classification confidence thresholds are heuristic — false positives (non-theaters, duplicate venues under different name spellings) would appear on the user map before anyone notices.
- Con: Venue data quality is the app's core differentiation. A map with bad data is worse than a map with fewer venues. The risk-to-benefit ratio does not favor automation here, given that admin time to review a queue is 2–3 minutes per venue and runs happen weekly (not daily).

### Rationale

The `venue_discovery_queue` table creates a hard boundary between pipeline output and live data. This boundary is enforced at the database level (RLS on the queue table; pipeline function uses service role, not anon key). No amount of application bugs can accidentally promote a venue to the live map.

The append-only property provides a complete audit trail: every venue the pipeline has ever discovered, its dedup outcome, enrichment data, and whether it was promoted or dismissed. This provenance is operationally valuable — it answers "where did this venue come from?" for every record in the database.

The admin promotion path costs less than the complexity of any automated alternative. The admin reviews a queue once per week after a discovery run. The promotion form pre-fills all enriched data, leaving only a confirmation click (and optional description/price edits) before the venue is live. Measured against the alternative of maintaining confidence thresholds, re-running dedup on ambiguous cases, and building rollback machinery for false positives, the human review step is strictly simpler.

### Consequences

- The `venues` table schema is clean — no status column, no draft logic, no multi-consumer filtering.
- All consumers of `venues` (map, mentor, event scraper) continue to work without modification.
- The pipeline is trivially testable: run discovery, inspect the queue table, promote a row, verify it appears in `venues`.
- Admin must be online at least weekly if they want to keep up with discovery runs. For a single-admin application owned by the founder, this is acceptable.

---

## Decision 2: Nominatim as Default Geocoding Provider

### Decision

The enrichment pipeline uses **Nominatim (OpenStreetMap)** as the default geocoding provider. Google Places API is supported as an opt-in upgrade via the `GOOGLE_PLACES_API_KEY` secret — if the secret is set, the function uses Google; if absent, it uses Nominatim.

### Alternatives Considered

**Option A: Google Places Geocoding API (default)**

Google's geocoding is more accurate for US addresses, handles abbreviations and unit numbers better, and returns richer structured data.

- Pro: Higher accuracy, especially for addresses with suite numbers or non-standard formatting.
- Pro: Returns neighborhood and administrative boundary data alongside lat/lng.
- Con: $0.005 per request. For 150 new venues in the first run plus weekly maintenance calls, this is $0.75–$2.00/month initially. Cost scales if multi-city expansion happens.
- Con: Requires a billing account and API key management. Another secret to rotate and secure.
- Con: The CLAUDE.md anti-patterns doc explicitly prohibits API keys in VITE_ env vars. Using Google Places correctly requires `supabase secrets set`, which is the right approach — but adds operational overhead that Nominatim avoids entirely.

**Option B: Nominatim only (no Google option)**

- Pro: Zero cost. No API key. Perfectly aligned with the MVP scope (single city, modest venue count).
- Pro: OpenStreetMap data for Chicago theater addresses is reliable — these are established business addresses, not informal locations.
- Con: Nominatim's free usage policy requires a User-Agent header and limits bulk geocoding to 1 request/second. This matches the enrichment pipeline's 10-venues-per-batch / 200ms-delay design.
- Con: Lower accuracy for edge cases (unusual address formats, newer buildings not yet in OSM).

**Option C: Supabase PostGIS extension + manual coordinate entry**

Defer geocoding entirely — admin enters coordinates manually in the promotion form.

- Pro: Zero dependencies, maximum control.
- Con: Manual coordinate entry for 150 venues is a significant admin burden. The promotion form's UX goal is < 3 minutes per venue. Manual lat/lng lookup breaks that target.

### Rationale

Nominatim satisfies the geocoding requirement at zero marginal cost for MVP. Chicago theater addresses are well-represented in OpenStreetMap — they are established venues with permanent addresses, not pop-up locations. The 200+ venues on ChicagoPlays have been at their addresses for years. OSM data quality for this specific use case is adequate.

The opt-in Google Places path (env var present = Google, absent = Nominatim) means the operator can upgrade accuracy for zero code change if Nominatim misses too many addresses. The promotion form includes a "Geocode Now" retry button that will use whichever provider is configured at that time.

The cost argument is not the primary driver — $2/month is trivial. The primary driver is reducing external dependencies in MVP. Nominatim requires no API key, no billing account, and no secret rotation. This reduces operational surface area and eliminates a class of failure mode (expired key, billing limit reached) during the first weeks of operation.

### Consequences

- Geocoding calls must respect Nominatim's rate limit: 1 request/second maximum. The enrichment pipeline's 200ms inter-call delay satisfies this.
- The `geocode_source` column in `venue_discovery_queue` records which provider was used per venue, enabling future analysis of accuracy differences.
- The promotion form blocks confirmation if lat/lng is null, requiring the admin to geocode inline or enter coordinates manually — protecting the map from null-island markers.

---

## Decision 3: Structured HTML Parsing for Directory Scrape (No AI)

### Decision

The ChicagoPlays member directory scrape uses **structured regex/DOM parsing** — not AI extraction. The event scraper uses DeepSeek V4 Flash for event data because event pages are unstructured prose (show descriptions, cast lists, ticket info embedded in marketing copy). The directory page is a structured listing with consistent markup per member entry.

### Alternatives Considered

**Option A: DeepSeek V4 Flash (same as event-scraper)**

Reuse the AI extraction pattern from `event-scraper/index.ts` — send cleaned HTML to DeepSeek with a structured prompt, receive JSON.

- Pro: Robust to minor HTML structure changes. If ChicagoPlays changes their markup slightly, the AI adapts.
- Pro: Minimal implementation effort — the pattern already exists.
- Con: Cost. A directory of 200 venues in cleaned HTML is approximately 8,000–15,000 tokens per call. At $0.10/1M input tokens (DeepSeek V4 Flash), that is $0.001–$0.002 per run. Not significant. However, the directory scrape runs weekly — the cost argument is weak.
- Con: AI introduces non-determinism. The same HTML may produce slightly different field extractions on different runs. For a structured directory page, this is unnecessary variance. Structured parsing produces identical output for identical input.
- Con: If ChicagoPlays has a robots.txt or rate-limit concern, sending their entire directory to a third-party AI API introduces unnecessary data sharing that isn't required for this use case.

**Option B: Structured regex/DOM parsing (selected)**

Parse HTML using `DOMParser` (available in Deno via `deno-dom`) or regex patterns targeting consistent CSS classes/structure of the ChicagoPlays member listing.

- Pro: Deterministic. Same input, same output. Makes the deduplication and idempotency logic simpler to reason about.
- Pro: No AI cost. No external API dependency for the scrape phase.
- Pro: Explicit about what is being extracted — the parser is the specification of the data structure.
- Con: Brittle to HTML structure changes. If ChicagoPlays redesigns their directory, the parser breaks. This is mitigated by the zero-result guard (FR-2: fewer than 20 venues parsed triggers `alert_admin = true`).

**Option C: League API (if available)**

If the League of Chicago Theatres provides a member API (they are a trade organization and may have one), use it instead of scraping.

- Status: Unknown at design time. OQ-1 in the PRD documents this as unresolved. If a League API is discovered during implementation, it should be used in preference to HTML scraping — it eliminates the fragility problem entirely.

### Rationale

The directory page is structured data rendered as HTML. A directory listing has predictable markup: each member theater occupies a card or list item with consistent class names, the name is in a heading element, the address and website are in known positions. This is not the same problem as extracting events from unstructured calendar copy. Applying AI to a structured problem is unnecessary complexity and introduces variance where none should exist.

The failure mode of structured parsing — HTML structure change — is explicitly monitored (zero-result guard). The failure mode of AI parsing — hallucinated fields, inconsistent extraction across runs — is harder to detect and would corrupt the queue with plausible-but-wrong data.

The deduplication layer depends on consistent field extraction. If the parser extracts `raw_name` and `raw_address` consistently, dedup works cleanly. If an AI extractor normalizes names differently across runs ("The Neo-Futurists" vs. "Neo-Futurists"), an existing venue could appear as a new candidate on a subsequent run — defeating the idempotency guarantee.

AI classification is still used in the enrichment phase (venue type assignment) where rule-based classification is ambiguous. That is the right place for AI: where the input is genuinely unstructured (website text, genre tags, marketing copy) and determinism is not required.

### Consequences

- The ChicagoPlays HTML parser must be updated manually if chicagoplays.com changes their directory markup. Expected frequency: 1–2 times per year based on typical organizational website refresh cycles.
- The `alert_admin` flag on zero-result runs provides timely notification (next admin visit) when the parser breaks.
- Parser implementation requires inspecting the actual chicagoplays.com HTML before coding. OQ-1 (does the page require JavaScript?) must be resolved first. If the page requires client-side rendering, `deno-dom` alone is insufficient and a headless approach (or CSV fallback from the League) must be evaluated.

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-09 | Sashiko (code-architect) | Initial draft |
