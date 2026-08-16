# ADR 0006: Art Classes Discovery — Architecture Decisions

**Date:** 2026-08-15
**Status:** Accepted
**Feature:** Art Classes Discovery
**PRD:** `.claude/docs/prd/art-classes-discovery.md`

---

## Context

The Art of Art is expanding from theater show listings to art education. This requires three architectural decisions:

1. Should class-specific metadata (instructor, level, format, session count) live in the existing `events` table or in a new `class_sessions` table?
2. Should discovering art education venues use the same `venue-discovery` pipeline (ChicagoPlays-based) or a new web-search-based approach?
3. Should class markers on the map use the existing venue-type-based marker system with a new style, or a fundamentally different marker layer (e.g., a separate Mapbox GeoJSON source)?

---

## Decision 1: Extend `events` Table with Class-Specific Columns (Not a New Table)

### Decision

Class-specific metadata (instructor_name, skill_level, session_count, class_format) is stored as **nullable columns on the existing `events` table**, not in a separate `class_sessions` or `class_metadata` table.

### Alternatives Considered

**Option A: New `class_sessions` table (normalized)**

A separate table `class_sessions` with columns `event_id uuid REFERENCES events`, `instructor_name`, `skill_level`, `session_count`, `class_format`. Joined on demand.

- Pro: Perfectly normalized. Show events have zero class columns. Schema is semantically clean.
- Pro: Could support multiple instructors per class (array join) in a future version.
- Con: Every class data query requires a JOIN. The existing `fetchMapData` query in `mapData.ts` fetches `events` flat. Adding a JOIN changes the query shape, the TypeScript interface, and every consumer of the `Event` type — for 4 optional fields.
- Con: The `VenueSheet`, `FilterChips`, `PlaySearchResults`, and `EventCard` components all consume `Event` objects. A joined shape requires either a discriminated union (`Event | ClassEvent`) or a nullable join result — both complicate downstream types.
- Con: Over-engineered for the data volume. There will be ~30–100 class events at launch. Join overhead is negligible but the schema complexity cost is real.

**Option B: JSONB `class_metadata` column on `events`**

One nullable `class_metadata jsonb` column containing `{instructor_name, skill_level, session_count, class_format}`.

- Pro: No schema change required if new class fields are added later.
- Pro: One column, zero JOIN overhead.
- Con: Loses CHECK constraint type safety (can't `CHECK (skill_level IN (...))` on a JSONB field).
- Con: TypeScript typing becomes `Record<string, unknown>` unless manually typed — more fragile than a typed interface.
- Con: Harder to query with simple SQL (`WHERE class_metadata->>'skill_level' = 'beginner'` vs. `WHERE skill_level = 'beginner'`). Admin RPC queries would be uglier.

**Option C: Nullable columns on `events` (selected)**

Four nullable columns added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

- Pro: No JOIN required. `Event` type stays flat.
- Pro: CHECK constraints enforce valid enum values at the database level.
- Pro: All existing consumers of `events` are unaffected — nullable columns are transparent.
- Pro: Admin RPCs use simple `WHERE skill_level IS NOT NULL` predicates.
- Pro: Matches the existing pattern: `extraction_confidence`, `missing_fields`, `extraction_status` are all nullable metadata columns added to `events` over time without new tables.
- Con: The `events` table has class columns that are always null for `event_type = 'show'`. This is semantic pollution.
- Con: Future multi-instructor support would require an `instructors` array or a join table anyway.

### Rationale

The `events` table has been extended with nullable metadata columns throughout the project's life — `extraction_confidence` (added in migration 20260810000003), `missing_fields`, `extraction_status`, `cast_members` (a JSONB array). The project's pattern is: extend with nullable columns when the data is conceptually part of an event record and the column count stays manageable. Four columns maintain that pattern.

The JOIN complexity cost of Option A outweighs the semantic cleanliness benefit, especially given that the feature's primary UI (VenueSheet class section) reads events from an already-fetched array in memory — adding a JOIN would require a second API call or a query shape change that propagates through `fetchMapData`, `mapDataQueryKey`, and every component consuming `MapData`.

If class events grow to a volume where a separate table provides a meaningful query performance benefit, migration to Option A is straightforward: `CREATE TABLE class_sessions AS SELECT ...` with a backfill.

### Consequences

- **Positive**: Zero changes to existing consumers of `events`. `MapData` stays flat. No JOIN required anywhere.
- **Positive**: Type safety maintained via CHECK constraints and TypeScript literal union types.
- **Negative**: Show events carry 4 always-null columns — accepted as technical debt.
- **Neutral**: Future multi-instructor support requires a new column or JSONB field, but that is a future concern.

---

## Decision 2: Separate `class-discovery` Edge Function with SerpAPI (Not ChicagoPlays Extension)

### Decision

Art education venue discovery uses a **new `class-discovery` Edge Function** that combines (a) direct calendar scraping of known school venues and (b) web search via SerpAPI for unknown venues. This is separate from the existing `venue-discovery` function.

### Alternatives Considered

**Option A: Extend `venue-discovery` to parse new source sites (Second City, iO, etc.)**

Add each school's website as a `venue_sources` record in the DB with `source_type = 'listing_site'`. Extend `venue-discovery/index.ts` to detect the source type and call a site-specific parser.

- Pro: Reuses the existing discovery queue, dedup, and enrichment infrastructure.
- Pro: All venues (theater + school) flow through the same admin promotion interface.
- Con: Each school has a different HTML structure — requires writing 8 parser functions. ChicagoPlays works because it's a single consistent directory. There is no equivalent directory for art schools.
- Con: School class calendars change far more frequently than a venue directory. Running weekly discovery for the entire venue discovery pipeline just to pick up class schedule changes is architecturally wrong — venue discovery is about new venues, class discovery is about new class offerings.
- Con: The `venue-discovery` pipeline is designed for discovery → dedup → enrich → promote (a 4-step human-reviewed process). Class offerings need to be in the `events` table (not the `venues` table) and don't require human review per offering.

**Option B: Extend `event-scraper` to also run web searches**

Make `event-scraper` aware of web search — before scraping known venues, search the web for class offerings from unknown venues.

- Pro: One function to trigger for all event ingestion.
- Con: `event-scraper` is already complex (multi-pass strategy tree with link following, enrichment, batch streaming). Adding web search to it creates a monolith where a single failure (SerpAPI down) could affect all event scraping, not just class discovery.
- Con: Conceptually wrong: `event-scraper` processes known venue records. Web search is about finding unknown venues/schools that aren't yet in the DB. These are different concerns.
- Con: The admin needs separate control over class discovery (trigger weekly class-specific run) vs. show scraping (trigger after venue changes). Combining them removes that control.

**Option C: Separate `class-discovery` function with SerpAPI (selected)**

New Edge Function that:
1. Scrapes known school venues (from `venues WHERE venue_type = 'school'`) using the existing scraper logic
2. Runs SerpAPI searches to find new schools not yet in the DB
3. Queues discovered new schools in `venue_discovery_queue` (following ADR-0002's queue-first pattern)
4. Writes class events from known schools directly to `events`

- Pro: Clean separation of concerns. The function has one job: find and process art education offerings.
- Pro: Can be triggered independently of the main event scraper.
- Pro: SerpAPI failure only affects class discovery, not show scraping.
- Pro: Discovered new schools still go through the existing admin promotion queue (preserving the human-review gate from ADR-0002).
- Con: ~~Code duplication — resolved in v0.2.0 by using the shared `processVenue` from `_shared/scraper/process-venue.ts` with a `StrategyProfile` (see Decision 4).~~

### Rationale

Separation of concerns wins. The event scraper and class discovery have different triggers, different data sources, different data destinations (events table vs. venue queue), and different admin control surfaces. The code duplication risk is mitigated by the existing `_shared/scraper/` directory — the `processVenue` logic can be extracted to `_shared/scraper/process-venue.ts` if it doesn't exist there yet, making it importable by both functions.

The SerpAPI dependency is isolated: if SerpAPI's pricing or availability changes, it only affects class discovery. The main event scraper (which runs daily and is the primary data pipeline) is unaffected.

### Consequences

- **Positive**: Event scraper is unaffected by class discovery changes.
- **Positive**: Admin has independent control buttons for each pipeline.
- **Positive**: SerpAPI failure degrades gracefully (class discovery falls back to known-venue scraping only).
- **Negative**: Some code duplication between `event-scraper` and `class-discovery`. Mitigated by `_shared/scraper/` utilities.
- **Neutral**: A new Edge Function to deploy and monitor.

---

## Decision 3: DOM-Element Class Markers with a Size+Shape Override (Not a New Mapbox Layer)

### Decision

Class markers use the **existing DOM-element Mapbox marker pattern** with a `hasClassEvents` prop override that changes size, glyph (`◇`), and color. No new Mapbox GeoJSON source or layer is added.

### Alternatives Considered

**Option A: New Mapbox GeoJSON source + symbol layer for class markers**

Add a `addSource('class-venues', {type: 'geojson', ...})` and `addLayer({type: 'symbol', ...})` to the Mapbox map instance for class-specific rendering.

- Pro: More performant at high marker counts (GPU-rendered).
- Pro: Enables clustering (combine nearby class markers into a count bubble).
- Pro: Better touch targeting (Mapbox handles click detection natively for symbol layers).
- Con: Requires migrating from the current DOM-element marker approach to a mixed model — some markers are DOM elements, some are symbol layer features. This creates two maintenance surfaces.
- Con: Symbol layers require a Mapbox sprite for custom icons. Adding the `◇` glyph requires either a sprite PNG or a raster image source. The current marker system uses Unicode glyphs rendered by the browser — no sprites, no assets.
- Con: Overkill for ~8–12 class venue markers. Symbol layers provide meaningful performance benefits above ~500 markers. The map will never have more than ~50 school venues.
- Con: All existing marker interactivity (watchlist status coloring, tonight border, dimming, selection scale) is implemented in the DOM-element pattern. Duplicating this logic for a symbol layer would double the maintenance burden.

**Option B: SVG-based class markers (replacing DOM element)**

Replace the `chip` div with an SVG element for class markers specifically — renders a diamond shape natively rather than a square with a `◇` glyph.

- Pro: Crisp rendering at all pixel densities. No font rendering variance.
- Pro: True diamond shape without relying on Unicode glyph rendering.
- Con: The `createMarkerElement` function returns an `HTMLDivElement`. Embedding SVG inside a div is fine, but it adds complexity.
- Con: SVG rendering in a Mapbox marker requires careful sizing and anchor point management. The existing approach with `anchor: 'bottom'` and `top: 29px` tail positioning already handles this via CSS.
- Con: No meaningful visual improvement over the Unicode `◇` glyph at the marker size in question (34px chip). The diamond glyph is clearly readable.

**Option C: DOM-element marker with size+glyph+color override (selected)**

The existing `createMarkerElement` function receives a `hasClassEvents: boolean` prop. When true:
- Container: 38×44px (was 34×40px)
- Chip: 34×34px (was 30×30px)
- Glyph: `◇` (always, regardless of venue_type)
- Background: `#1a1005` (near-black)
- Accent: `#D4A017` (amber gold)

- Pro: Zero new Mapbox infrastructure. The existing marker lifecycle (create, update, remove on data change) handles class markers identically.
- Pro: The `◇` Unicode character renders cleanly at 16px in the Courier Prime / system monospace stack used throughout the app.
- Pro: The `hasClassEvents` boolean is computed synchronously from the already-fetched `events` array — no additional API call.
- Pro: All existing marker behaviors (dimming, selection scale, watchlist border style, tonight border) work without modification — they apply before the class override block.
- Con: DOM-element markers are less performant than symbol layers at very high counts. Acceptable at ≤50 school venues.

### Rationale

The current architecture is DOM-element markers for all venues. Introducing a mixed model (DOM for shows, Mapbox layer for classes) for a feature that will have 8–12 markers at launch is a disproportionate response. The override approach maintains a single marker creation pathway. The `◇` glyph visually distinguishes classes (open/hollow) from shows (filled/geometric) — the semantic contrast reinforces the mental model.

The amber gold `#D4A017` color was chosen over alternatives (purple, teal, red) because:
1. It is not used anywhere else in the marker color system (which uses venue-relationship colors and the green `--live` for tonight)
2. Gold connotes learning, achievement, and excellence — appropriate for education
3. 8.7:1 contrast on `#1a1005` background satisfies WCAG AAA

### Consequences

- **Positive**: No new Mapbox infrastructure to maintain.
- **Positive**: Single code path for all marker creation.
- **Positive**: Class markers benefit from all existing marker behaviors automatically.
- **Negative**: DOM-element markers are less GPU-efficient than symbol layers. Acceptable for current scale.
- **Neutral**: If class venue count ever exceeds ~100, this decision should be revisited in favor of Option A.

---

## Decision 4: Configurable Strategy Tree (Not Duplicated Scraper Code)

### Decision

The class-discovery function uses the **shared v2 deterministic strategy tree** (`executeStrategyTree` from `_shared/scraper/strategy-agent.ts`) via a configurable `StrategyProfile`, rather than duplicating the scraper logic inline.

### Alternatives Considered

**Option A: Duplicate processVenue logic in class-discovery (original v0.1.0 approach)**

Copy the extract→verify→merge→upsert logic into `class-discovery/index.ts` as `processSchool()`.

- Pro: No changes to shared modules. Zero risk of breaking event-scraper.
- Con: 430 lines of duplicated code (fetchHtml, callDeepSeek, extractEventsPass1, verifyEventsPass2, mergeExtractionResults).
- Con: class-discovery lacks link following, completeness evaluation, budget enforcement, and gap annotations — the same problems that motivated the v2 event scraper upgrade.
- Con: Bug fixes to the scraper must be applied in two places.

**Option B: Configurable strategy tree via StrategyProfile (selected)**

Add a `StrategyProfile` type with `domain`, `fieldWeights`, and `logFeaturePrefix`. Make `executeStrategyTree`, `evaluateCompleteness`, `processVenue`, and `buildTargetedExtractionPrompt` accept the profile as an optional parameter (backward compatible).

- Pro: Class-discovery gets link following, completeness scoring, budget enforcement, gap annotations, and strategy traces for free.
- Pro: Class-specific field weights (instructor_name: 15, skill_level: 10) tune the completeness evaluator for class content.
- Pro: class-discovery drops from 680 lines to 307 — pure deletion of duplicated code.
- Pro: All shared modules remain backward compatible (optional params with defaults).
- Con: Shared modules become slightly more complex (optional parameters, conditional TIC skip).

### Rationale

The v1 two-pass approach for class-discovery suffered from the same 60% NULL start_date problem that motivated building the v2 strategy tree for events. Class websites (Second City, iO, etc.) list class names on their main page but put dates, pricing, and instructor info on linked detail pages. The strategy tree's link-following phase directly addresses this.

The `StrategyProfile` config surface is small (3 fields) and well-bounded. The conditionals it introduces are limited to: TIC on/off (1 line), play-matcher on/off (1 line), and weights passthrough (6 call sites). The risk of breaking the event scraper is minimal because all new parameters are optional with defaults that preserve existing behavior.

### Consequences

- **Positive**: Single scraper pipeline for both domains — bug fixes apply once.
- **Positive**: Class-discovery gets full gap annotation, strategy traces, and budget enforcement.
- **Positive**: Class-specific completeness scoring catches missing instructor/level data.
- **Negative**: Shared modules have slightly more parameters. Acceptable given the small config surface.
- **Neutral**: Future domain types (e.g., "gallery", "music") can be added by defining a new profile.

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-15 | prd-specialist | Initial draft |
| 1.1 | 2026-08-16 | backend-architect | Added Decision 4: configurable strategy tree |
