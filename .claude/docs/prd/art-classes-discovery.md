# PRD: Art Classes Discovery

**Version:** 1.0
**Date:** 2026-08-15
**Status:** Approved — Ready for Implementation
**PRD Author:** prd-specialist
**Graph:** `docs/graphs/art-classes-discovery.md`
**ADR:** `docs/adr/0006-art-classes-discovery.md`
**QA:** `docs/qa/art-classes-discovery.md`

---

## 1. Executive Summary

### Problem Statement

The Art of Art helps newcomers discover Chicago theater. Right now the app is passive: it shows shows happening at venues, but it does not help users learn the craft. Theater education — improv classes, acting conservatories, movement workshops, writing for the stage — is how people move from curious outsider to confident participant. That education is invisible on the map today.

The infrastructure gap: the existing event scraper targets venues that already have `calendar_url` records. Art schools, conservatories, and continuing-ed programs are not in the venues table. They cannot be scraped because they are not yet venue records. Class-specific data (instructor name, skill level, session format, number of sessions) is not in the `events` schema. And even if classes were in the database, they would render as identically-sized show markers on the map — offering no visual distinction for something fundamentally different from a one-time performance.

### Solution Overview

This feature delivers four things in sequence:

1. **Schema** — Three class-specific columns added to `events`, plus a migration to seed the 8 canonical art-education venues as full venue records with `calendar_url`.
2. **Scraper Extension** — The existing `event-scraper` Edge Function is extended to recognize class-type events and populate class fields. A new `class-discovery` Edge Function handles web-search-based discovery for schools that don't yet have venue records.
3. **Map Markers** — Class markers are 38×44px (vs. 34×40px for shows), use a distinct diamond shape with glyph `◇` (open diamond), and carry a fixed amber/gold accent color that immediately distinguishes them from venue-colored show markers.
4. **Class Detail UI** — When a user taps a class marker, the VenueSheet expands with a class-specific section: instructor, skill level, session format, session count, and an enrollment CTA.

### Business Impact

- Addresses the "how do I get started?" top question from theater newcomers
- Creates a second content type that keeps users returning (classes run on weekly/monthly cadences, not one-off show schedules)
- Enables the belt progression system to reward class attendance alongside show attendance
- Differentiates from show-listing competitors — none of them surface classes on a geographic map

### Resource Requirements

- 1 migration (schema extension)
- 1 migration (seed 8 school venues)
- 1 migration (seed known class events from those schools)
- 1 extension to `event-scraper` Edge Function (add class-field handling)
- 1 new `class-discovery` Edge Function (web-search-based discovery)
- 1 extraction prompt extension (class-specific fields)
- 1 verification prompt extension (class-specific enrichment)
- Frontend: `MapMarker.tsx` (class marker shape), `VenueSheet.tsx` (class section), `MapFilterChips.tsx` (CLASSES filter), `MapView.tsx` (marker routing)
- Admin: extend `ScraperDashboard` to show class discovery stats

### Risk Assessment

- Medium: Web search APIs have rate limits and cost money — mitigated by SerpAPI with caching
- Low: Schools change their URLs/calendars more often than theaters — mitigated by the existing dead-URL guard in the scraper
- Low: Class markers could clutter the map if there are ever many schools — mitigated by distinct visual treatment that lets users filter

---

## 2. Product Overview

### Product Vision

The map becomes a learning map, not just a performance map. A theater newcomer opens the app, sees amber diamond markers scattered among the gray/colored show squares, taps one, and immediately sees "Improv 101 — Wednesdays 7pm — Instructor: Dave Koechner — $325/8 sessions — Enroll." The mental model is: square = see it, diamond = learn it.

### Target Users

**User A: Theater Newcomer (Deric, 30s, Acting 2)**
Wants to take the next class but doesn't know what exists beyond Second City. Will tap class markers while browsing the map for shows. Needs to see level, price, and enrollment link immediately — not navigate to a school website and hunt.

**User B: Experienced Actor Seeking Advanced Training**
Already has improv training. Looking for advanced scene study, movement work, or specialized workshops. Needs to filter by skill level and see format (ongoing vs. workshop). Trusts instructor name more than school brand.

**User C: Casual Explorer**
Browses the map on weekends. Sees a class marker near a show they want to attend. Taps it out of curiosity. An enrollment link to a drop-in workshop within their budget converts them from passive browser to active participant.

### Value Proposition

The only map in Chicago that shows both what's playing tonight AND where you can learn to perform next week. All in one view, geographically anchored.

### Success Criteria

| Metric | Target (90 days post-launch) |
|--------|------------------------------|
| Class venues in DB | ≥ 8 (seeded), ≥ 12 (discovered) |
| Class events in DB | ≥ 30 |
| Map has class markers visible | Yes (8 amber diamonds visible on default Chicago view) |
| Class filter on map works | Yes |
| Class detail sheet shows instructor + level | Yes for ≥ 80% of seeded classes |
| Weekly class discovery run | Yes (cron configured) |

### Assumptions

- SerpAPI (or equivalent) is available and the key is set via `supabase secrets set SERPAPI_KEY=...`
- The 8 seeded venues have stable website URLs (verified as of 2026-08-15)
- Schools' class pages are HTML-renderable without JavaScript client-side execution (verified for Second City, iO, Annoyance — others TBD)
- Belt progression system will consume class `event_type` values the same way it consumes show events — no changes to belt logic required for initial launch

---

## 3. Functional Requirements

All FRs are numbered and independently testable. An implementing agent must be able to build each FR without questions.

---

### FR-1: Class-Specific Schema Fields (Migration)

**Trigger:** Implementing agent runs `supabase db push` before any other FR.

**Behavior:** Add three columns to the `public.events` table. These columns are nullable for backward compatibility — all existing `event_type = 'show'` rows are unaffected.

**Exact SQL (create file `supabase/migrations/20260815000010_class_fields.sql`):**

```sql
-- Art Classes Discovery: class-specific event fields
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS instructor_name text,
  ADD COLUMN IF NOT EXISTS skill_level text
    CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'all-levels', 'drop-in')),
  ADD COLUMN IF NOT EXISTS session_count int,
  ADD COLUMN IF NOT EXISTS class_format text
    CHECK (class_format IN ('ongoing', 'workshop', 'intensive', 'drop-in', 'series'));

COMMENT ON COLUMN public.events.instructor_name IS 'Primary instructor name. Null for show events.';
COMMENT ON COLUMN public.events.skill_level IS 'Required experience level for classes/workshops. Null for show events.';
COMMENT ON COLUMN public.events.session_count IS 'Number of sessions for multi-week courses. Null for single events and shows.';
COMMENT ON COLUMN public.events.class_format IS 'Temporal format of the class. Null for show events.';
```

**Data contract (TypeScript — update `src/lib/types.ts`):**

Add to the `Event` interface (after `cast_members`):
```typescript
instructor_name: string | null
skill_level: 'beginner' | 'intermediate' | 'advanced' | 'all-levels' | 'drop-in' | null
session_count: number | null
class_format: 'ongoing' | 'workshop' | 'intensive' | 'drop-in' | 'series' | null
```

**Error state:** If the migration fails due to existing column, the `IF NOT EXISTS` clause prevents an error. If the CHECK constraint conflicts with existing data (impossible for new columns), the migration will error — review `extraction_status` values in prod before running.

**Scope boundary:** No data backfill required. The 3 existing class events in the database (Improv 101, Writing for Stage, Musical Improv Drop-In) will have these columns as NULL until re-scraped.

---

### FR-2: Art Education Venue Seed (Migration)

**Trigger:** Runs after FR-1. Seeds 8 art-education venues as `venue_type = 'school'` records with `calendar_url` values that the existing `event-scraper` can immediately target.

**Exact SQL (create file `supabase/migrations/20260815000011_seed_class_venues.sql`):**

```sql
-- Art Classes Discovery: seed 8 canonical Chicago art education venues
INSERT INTO public.venues (name, slug, description, venue_type, address, neighborhood, city, latitude, longitude, website_url, calendar_url, price_range, genre_tags, source)
VALUES
  (
    'The Second City Training Center',
    'second-city-training',
    'The world-famous comedy and improv conservatory. Programs range from beginner drop-ins to the full conservatory track.',
    'school',
    '1616 N Wells St, Chicago, IL 60614',
    'Old Town',
    'chicago',
    41.9132, -87.6362,
    'https://www.secondcity.com/training/',
    'https://www.secondcity.com/chicago/training/schedule/',
    '$$',
    ARRAY['improv', 'comedy', 'sketch'],
    'manual'
  ),
  (
    'iO Chicago',
    'io-chicago',
    'The home of long-form improv. Offers classes from Harold basics through advanced ensemble training.',
    'school',
    '1501 N Kingsbury St, Chicago, IL 60642',
    'Lincoln Park',
    'chicago',
    41.9077, -87.6401,
    'https://ioimprov.com/',
    'https://ioimprov.com/chicago/classes/',
    '$$',
    ARRAY['improv', 'long-form'],
    'manual'
  ),
  (
    'The Annoyance Theatre & Bar',
    'annoyance-theatre',
    'Chicago's irreverent home for avant-garde comedy and improv. Classes focus on character-based work and devised performance.',
    'school',
    '851 W Belmont Ave, Chicago, IL 60657',
    'Lakeview',
    'chicago',
    41.9394, -87.6501,
    'https://theannoyance.com/',
    'https://theannoyance.com/classes/',
    '$',
    ARRAY['improv', 'comedy', 'experimental'],
    'manual'
  ),
  (
    'Chicago Improv Studio',
    'chicago-improv-studio',
    'Founded by veteran iO instructors. Smaller class sizes and a curriculum built around the Harold form.',
    'school',
    '3541 N Clark St, Chicago, IL 60657',
    'Wrigleyville',
    'chicago',
    41.9497, -87.6555,
    'https://chicagoimprovstudio.com/',
    'https://chicagoimprovstudio.com/classes/',
    '$',
    ARRAY['improv', 'comedy'],
    'manual'
  ),
  (
    'Acting Studio Chicago',
    'acting-studio-chicago',
    'Meisner-based acting training for adults. Programs span scene study, audition technique, and on-camera work.',
    'school',
    '5955 N Broadway, Chicago, IL 60660',
    'Edgewater',
    'chicago',
    41.9899, -87.6600,
    'https://actingstudiochicago.com/',
    'https://actingstudiochicago.com/classes/',
    '$$',
    ARRAY['acting', 'meisner', 'scene-study'],
    'manual'
  ),
  (
    'Piven Theatre Workshop',
    'piven-theatre-workshop',
    'Story Theater and ensemble training rooted in the Piven tradition. Adult programs in improvisation, storytelling, and performance.',
    'school',
    '927 Noyes St, Evanston, IL 60201',
    'Evanston',
    'chicago',
    42.0594, -87.6827,
    'https://piventheatre.org/',
    'https://piventheatre.org/classes/',
    '$$',
    ARRAY['story-theater', 'improvisation', 'ensemble'],
    'manual'
  ),
  (
    'Old Town School of Folk Music',
    'old-town-school',
    'Community arts institution. Theater and performance classes alongside music — including storytelling, puppetry, and musical theater.',
    'school',
    '4544 N Lincoln Ave, Chicago, IL 60625',
    'Lincoln Square',
    'chicago',
    41.9672, -87.6857,
    'https://www.oldtownschool.org/',
    'https://www.oldtownschool.org/classes/?category=theater',
    '$',
    ARRAY['storytelling', 'musical-theater', 'community'],
    'manual'
  ),
  (
    'Steppenwolf Theatre — Education',
    'steppenwolf-education',
    'Steppenwolf's education division. Adult acting intensives and scene study workshops led by ensemble members.',
    'school',
    '1650 N Halsted St, Chicago, IL 60614',
    'Lincoln Park',
    'chicago',
    41.9126, -87.6482,
    'https://www.steppenwolf.org/education/',
    'https://www.steppenwolf.org/education/adult-programs/',
    '$$$',
    ARRAY['acting', 'scene-study', 'ensemble'],
    'manual'
  )
ON CONFLICT (slug) DO NOTHING;
```

**Error state:** `ON CONFLICT (slug) DO NOTHING` — re-running this migration is safe. If the `calendar_url` column doesn't exist yet on `venues`, this migration will fail — FR-1 must run first (but `calendar_url` exists already in the current schema per `20260731000003_fix_calendar_urls.sql`).

**Scope boundary:** These are the only 8 seeded venues. The `class-discovery` Edge Function (FR-4) will discover more via web search. No auto-promotion — discovered venues go through the existing `venue_discovery_queue` flow.

---

### FR-3: Class-Field Extraction in Existing Scraper

**Trigger:** When `event-scraper` processes a venue with `venue_type = 'school'` OR extracts an event with `event_type = 'class'` or `'workshop'`.

**Behavior:** The existing two-pass extraction/verification pipeline adds class-specific fields to its JSON output. The `processVenue` function in `supabase/functions/event-scraper/index.ts` writes these fields to the database.

**Changes to `supabase/functions/_shared/scraper/extraction-prompt.ts`:**

Append the following block immediately before the closing backtick of the `buildExtractionPrompt` return string (after the "Do NOT invent events" line):

```
CLASS-SPECIFIC FIELDS (for event_type "class" or "workshop" ONLY — null for shows):
- instructor_name: The name of the instructor or lead facilitator. String or null.
- skill_level: One of "beginner", "intermediate", "advanced", "all-levels", "drop-in". Null if not stated.
- session_count: Integer number of sessions in the course (e.g., 8 for an 8-week class). Null for single sessions.
- class_format: One of "ongoing" (rolling enrollment, no fixed end), "workshop" (one or two days), "intensive" (3–5 day immersive), "drop-in" (no commitment), "series" (fixed number of sessions with defined start/end). Null if unclear.

Add these fields to the JSON output for class/workshop events:
{
  "events": [
    {
      "title": "Improv 101",
      "event_type": "class",
      "instructor_name": "Dave Koechner",
      "skill_level": "beginner",
      "session_count": 8,
      "class_format": "series",
      ...existing fields...
    }
  ]
}
For show events, omit these keys entirely (do not include them as null).
```

**Changes to `supabase/functions/_shared/scraper/types.ts`:**

Add to `Pass1Event` interface (after `show_times`):
```typescript
instructor_name?: string | null;
skill_level?: string | null;
session_count?: number | null;
class_format?: string | null;
```

Add to `ScrapedEvent` interface (after `cast_members`):
```typescript
instructor_name: string | null;
skill_level: string | null;
session_count: number | null;
class_format: string | null;
```

**Changes to `supabase/functions/event-scraper/index.ts`:**

In the `MergedEvent` interface, add after `confidence`:
```typescript
instructor_name: string | null;
skill_level: string | null;
session_count: number | null;
class_format: string | null;
```

In `mergeExtractionResults`, add to the merged push object (both the p2-missing path and the main merge path):
```typescript
instructor_name: p1.instructor_name ?? null,
skill_level: p1.skill_level ?? null,
session_count: p1.session_count ?? null,
class_format: p1.class_format ?? null,
```

In the `row` construction within `processVenue` (the `INSERT/UPDATE` section), add after `extraction_confidence`:
```typescript
instructor_name: event.instructor_name ?? null,
skill_level: ['beginner','intermediate','advanced','all-levels','drop-in'].includes(event.skill_level ?? '')
  ? event.skill_level : null,
session_count: event.session_count ?? null,
class_format: ['ongoing','workshop','intensive','drop-in','series'].includes(event.class_format ?? '')
  ? event.class_format : null,
```

**Changes to `supabase/functions/_shared/scraper/verification-prompt.ts`:**

Add to the ENRICHMENT section (after the genre_tags line):
```
- instructor_name: Include if you know the instructor from the extracted data or your training. Do NOT hallucinate names. Null if unsure.
- skill_level: Infer from class title/description if not explicit ("101" → "beginner", "Advanced Harold" → "advanced"). Null if ambiguous.
- session_count: Infer from title if pattern matches ("8-Week", "6-Session"). Null if not determinable.
- class_format: Infer from structure ("Drop-In" → "drop-in", "Conservatory Level 1" → "series"). Null if unclear.
```

Add these fields to the Pass2Verification return schema in the verification prompt:
```
"instructor_name": "Name or null",
"skill_level": "beginner|intermediate|advanced|all-levels|drop-in|null",
"session_count": 8,
"class_format": "series|ongoing|workshop|intensive|drop-in|null"
```

Add to `Pass2Verification` interface in `types.ts`:
```typescript
instructor_name?: string | null;
skill_level?: string | null;
session_count?: number | null;
class_format?: string | null;
```

And use p2 values in `mergeExtractionResults` with p1 as fallback:
```typescript
instructor_name: p2?.instructor_name ?? p1.instructor_name ?? null,
skill_level: p2?.skill_level ?? p1.skill_level ?? null,
session_count: p2?.session_count ?? p1.session_count ?? null,
class_format: p2?.class_format ?? p1.class_format ?? null,
```

**Error state:** If the AI does not return class fields, all four columns default to null. The event is still created/updated. No retry is triggered for missing class metadata.

**Scope boundary:** The scraper only writes class fields for events with `event_type IN ('class', 'workshop')`. Show events do not receive these columns.

---

### FR-4: Class Discovery Edge Function (Web Search)

**Trigger:** Admin presses "Discover Classes" button in the Admin panel (new button, FR-8), or the pg_cron job fires weekly. Can also be triggered via:
```
curl -X POST https://rytjrterecygirttvtdn.supabase.co/functions/v1/class-discovery \
  -H "x-scraper-key: $SCRAPER_SECRET"
```

**Behavior:** New Edge Function at `supabase/functions/class-discovery/index.ts` that:

1. Fetches the list of known school venues from `venues` where `venue_type = 'school'`
2. For each school venue, fetches its `calendar_url` and runs the existing `processVenue` logic (re-used from `_shared/scraper/process-venue.ts` — see Prior Art section)
3. After processing known venues, calls SerpAPI to search for Chicago art class listings not yet in the DB
4. Parsed search results are inserted into `venue_discovery_queue` with `raw_category = 'school'`
5. Streams NDJSON results (same pattern as `event-scraper`)

**SerpAPI integration spec:**

Secret: `SERPAPI_KEY` (set via `supabase secrets set SERPAPI_KEY=...`)

Search queries to execute (in order, stop after 5 results per query to control cost):
```
"chicago improv classes 2026"
"chicago acting classes adults 2026"
"chicago theater workshops 2026"
"chicago movement theater classes 2026"
"chicago musical theater adult classes 2026"
```

SerpAPI call pattern:
```typescript
async function searchClasses(query: string): Promise<SearchResult[]> {
  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('api_key', SERPAPI_KEY);
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', query);
  url.searchParams.set('location', 'Chicago, Illinois, United States');
  url.searchParams.set('num', '5');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('gl', 'us');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.organic_results ?? []).map((r: any) => ({
    title: r.title,
    link: r.link,
    snippet: r.snippet,
  }));
}
```

**Discovery dedup logic:**

Before inserting a search result into `venue_discovery_queue`, check:
1. `SELECT id FROM venues WHERE website_url ILIKE '%' || extractDomain(result.link) || '%'` — if match found, skip (already a venue)
2. `SELECT id FROM venue_discovery_queue WHERE raw_website_url ILIKE '%' || extractDomain(result.link) || '%'` — if match found, skip (already queued)

**AI extraction from search results:**

For each search result not already in DB/queue, the function fetches the page HTML and passes it through the existing `extractEventsPass1` + `verifyEventsPass2` functions from `_shared/scraper/process-venue.ts`. This ensures class fields are extracted via FR-3.

**Response shape (NDJSON, one JSON object per line):**

```typescript
// For each known school venue scraped:
{ "type": "school_scrape", "data": ScrapeResult }
// For each web search result processed:
{ "type": "search_result", "data": { query: string, link: string, queued: boolean, reason?: string } }
// Final summary:
{ "type": "summary", "data": {
    run_id: string,
    schools_scraped: number,
    schools_events_found: number,
    search_queries_run: number,
    new_venues_queued: number,
    ai_input_tokens: number,
    ai_output_tokens: number,
    serpapi_calls: number
  }
}
```

**Auth:** Same pattern as `event-scraper` — accepts `x-scraper-key` header OR JWT bearer token from authenticated user.

**CORS origins:** Same allowlist as all other Edge Functions:
```typescript
const ALLOWED_ORIGINS = [
  "http://localhost:5204",
  "https://aoa-nine.vercel.app",
];
```

**Error state:** If SerpAPI key is missing (`SERPAPI_KEY` is undefined), the function logs a warning and skips the web search phase — it still processes all known school venues via `calendar_url`. It does not return 500; it returns a summary with `search_queries_run: 0` and a `warning: "SERPAPI_KEY not configured"`.

**Scope boundary:** This function does NOT auto-promote venues to the `venues` table. Discovered venues from web search go to `venue_discovery_queue` for admin review, following the same queue-first pattern established in ADR-0002.

---

### FR-5: Class-Specific Map Markers

**Trigger:** When `MapView.tsx` renders markers for venues, class markers must visually distinguish from show markers.

**Behavior:** A venue with `venue_type = 'school'` AND at least one event with `event_type IN ('class', 'workshop')` in the current time window receives a class marker. A venue with `venue_type = 'school'` but only show-type events (edge case) receives a standard show marker.

**Exact marker specification (`src/components/MapMarker.tsx`):**

Add a `hasClassEvents` boolean to the `Props` interface:
```typescript
interface Props {
  venue: Venue
  relationship: WatchlistStatus | null
  dominantColor: string | null
  isTonight: boolean
  isSelected: boolean
  dimmed: boolean
  hasClassEvents: boolean  // NEW
  onClick: () => void
}
```

When `hasClassEvents === true`, the marker uses these dimensions instead of the standard 34×40px container / 30×30px chip:

| Property | Show marker | Class marker |
|----------|-------------|--------------|
| Container width | `34px` | `38px` |
| Container height | `40px` | `44px` |
| Chip width | `30px` | `34px` |
| Chip height | `30px` | `34px` |
| Chip border-radius | `4px` | `4px` (same) |
| Glyph | venue_type glyph | `◇` (always) |
| Base chip background | `var(--bg-card)` | `#1a1005` (near-black) |
| Accent color for border | varies by relationship | `#D4A017` (amber gold) |
| Font size | `14px` | `16px` |
| Tail left offset | `12px` | `14px` |
| Tail top offset | `29px` | `33px` |

**Class marker color rules (override the standard relationship coloring):**

```typescript
if (hasClassEvents) {
  const classAmber = '#D4A017'
  chip.style.width = '34px'
  chip.style.height = '34px'
  chip.style.fontSize = '16px'
  chip.style.backgroundColor = '#1a1005'
  chip.textContent = '◇'

  if (relationship === 'booked') {
    chip.style.border = tonightBorder ?? `2px solid ${classAmber}`
    chip.style.color = classAmber
  } else if (relationship === 'want_to_see') {
    chip.style.border = tonightBorder ?? `1.5px dashed ${classAmber}`
    chip.style.color = classAmber
  } else {
    chip.style.border = tonightBorder ?? `1.5px solid ${classAmber}`
    chip.style.color = classAmber
  }

  // Tail uses amber
  tail.style.left = '14px'
  tail.style.top = '33px'
  const classTailBorder = tonightBorder ?? `1.5px solid ${classAmber}`
  tail.style.borderRight = classTailBorder
  tail.style.borderBottom = classTailBorder
}
```

**Container dimensions for class markers:**
```typescript
if (hasClassEvents) {
  el.style.width = '38px'
  el.style.height = '44px'
}
```

**Changes to `MapView.tsx`:**

Compute `hasClassEvents` per venue in the marker render loop:
```typescript
const venueEvents = events.filter(e => e.venue_id === venue.id)
const hasClassEvents = venueEvents.some(e => e.event_type === 'class' || e.event_type === 'workshop')
```

Pass to `createMarkerElement`:
```typescript
const el = createMarkerElement({
  venue,
  relationship: firstEventStatus,
  dominantColor: venueEmotionColors[venue.id] ?? null,
  isTonight: tonightEvts.length > 0,
  isSelected: selectedVenue?.id === venue.id,
  dimmed,
  hasClassEvents,  // NEW
  onClick: () => { ... }
})
```

**Error state:** If `hasClassEvents` is not provided, it defaults to `false` (standard show marker renders). No runtime error.

**Map Key update (`src/components/MapKey.tsx`):** Add a legend entry for the class diamond. The key already shows venue types — add one line:

```
◇  Art Classes & Workshops
```

Rendered as amber `#D4A017` text, same monospace font as other key entries.

**Scope boundary:** No changes to Mapbox layer configuration. These are DOM-element Mapbox markers (the existing `mapboxgl.Marker({ element: el })` pattern), not GeoJSON source/layer markers.

---

### FR-6: Class Detail View in VenueSheet

**Trigger:** User taps a class marker on the map. The `VenueSheet` opens for that venue.

**Behavior:** The existing `VenueSheet.tsx` component renders an additional "Classes at this venue" section between the tonight-status block and the upcoming-events block. This section only renders when the venue has events with `event_type IN ('class', 'workshop')`.

**Changes to `src/components/VenueSheet.tsx`:**

After the `upcomingEvents` computation (line 132 in current file), add:
```typescript
const classEvents = useMemo(() => {
  return allEvents
    .filter(e => e.venue_id === venue.id && (e.event_type === 'class' || e.event_type === 'workshop'))
    .filter(e => !e.end_date || e.end_date >= today)
    .sort((a, b) => (a.start_date ?? 'z').localeCompare(b.start_date ?? 'z'))
}, [venue, allEvents, today])
```

**New section — insert after the PWYC/Usher block and before the action buttons block:**

```tsx
{classEvents.length > 0 && (
  <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 3, padding: '12px 14px', marginBottom: 14, border: '1px solid #D4A017' }}>
    <div style={{ ...mono, fontSize: 9, letterSpacing: '0.1em', color: '#D4A017', marginBottom: 10 }}>
      CLASSES AT THIS VENUE
    </div>
    {classEvents.map((e, i) => (
      <div key={e.id}>
        {i > 0 && <div style={{ borderTop: '1px dotted var(--rule)', margin: '8px 0' }} />}
        <div style={{ ...serif, fontStyle: 'italic', fontSize: 15, color: 'var(--ink)' }}>{e.title}</div>
        {e.instructor_name && (
          <div style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)', marginTop: 2 }}>
            INSTRUCTOR: {e.instructor_name.toUpperCase()}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
          {e.skill_level && (
            <span style={{ ...mono, fontSize: 9, padding: '2px 6px', borderRadius: 2, backgroundColor: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.4)', color: '#D4A017' }}>
              {e.skill_level.toUpperCase()}
            </span>
          )}
          {e.class_format && (
            <span style={{ ...mono, fontSize: 9, padding: '2px 6px', borderRadius: 2, border: '1px solid var(--rule)', color: 'var(--ink-dim)' }}>
              {e.class_format.toUpperCase()}
            </span>
          )}
          {e.session_count && (
            <span style={{ ...mono, fontSize: 9, color: 'var(--ink-dim)' }}>
              {e.session_count} SESSIONS
            </span>
          )}
          {e.price_min != null && (
            <span style={{ ...mono, fontSize: 9, color: 'var(--ink-dim)' }}>
              ${e.price_min}{e.price_max && e.price_max !== e.price_min ? `–$${e.price_max}` : ''}
            </span>
          )}
        </div>
        {e.start_date && (
          <div style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)', marginTop: 2 }}>
            {fmtDate(e.start_date)}{e.end_date ? ` – ${fmtDate(e.end_date)}` : '+'}
          </div>
        )}
        {e.ticket_url && /^https?:\/\//i.test(e.ticket_url) && (
          <a href={e.ticket_url} target="_blank" rel="noopener noreferrer"
            style={{ ...mono, fontSize: 8.5, letterSpacing: '0.08em', color: '#D4A017', textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>
            ENROLL →
          </a>
        )}
      </div>
    ))}
  </div>
)}
```

**Empty state:** If `classEvents.length === 0`, the classes section does not render. No empty state message needed.

**Error state:** If `e.ticket_url` is present but does not start with `https?://`, the ENROLL link is suppressed (same guard already used in VenueSheet for other ticket links).

**Scroll behavior:** The VenueSheet already scrolls to `maxHeight: 75dvh`. The classes section adds content above the action buttons — no scroll position reset needed.

**Scope boundary:** The class detail view is inside `VenueSheet`. There is no standalone class detail page in this feature. Future feature (Phase 5+) may add `/app/class/:id`.

---

### FR-7: Class Filter on Discover Page

**Trigger:** User visits `/app/discover` and sees the existing FilterChips component.

**Behavior:** The existing `event_type` filter chip array already contains `'class'` and `'workshop'` chips (they exist in the Discover page's static filter list). The Discover page query must return events of these types from school venues.

**Investigation required:** Read `src/pages/Discover.tsx` and the `fetchDiscover` function in `src/lib/` to confirm the query includes `event_type IN ('class', 'workshop')` events from school venues. If it filters to `event_type = 'show'` anywhere, remove that filter.

**Exact change (if query filter is wrong):** In whatever file executes the Discover query, ensure:
```typescript
// If there's a hardcoded event_type filter, change:
.eq('event_type', 'show')
// To:
.in('event_type', ['show', 'class', 'workshop', 'festival', 'open-call'])
// Or remove the event_type filter entirely and let the FilterChips control it
```

**Map filter — add CLASSES chip to `MapFilterChips.tsx`:**

Add to the `FILTERS` array:
```typescript
{ key: 'classes', label: 'CLASSES' },
```

Add filter logic to `isVenueDimmed` in `MapView.tsx`:
```typescript
if (f === 'classes' && !venueEvents.some(e => e.event_type === 'class' || e.event_type === 'workshop')) return true
```

Add to `filterCounts` in `MapView.tsx`:
```typescript
classes: timeFilteredVenues.filter(v => events.some(e => e.venue_id === v.id && (e.event_type === 'class' || e.event_type === 'workshop'))).length,
```

**Error state:** If no class events are in DB, the CLASSES filter shows `CLASSES 0` and toggling it dims all markers. This is the correct behavior for an empty state — it signals to the admin that class data needs to be populated.

---

### FR-8: Admin Tools for Class Data

**Trigger:** Admin visits the Admin panel and sees class-specific tooling.

**Behavior:** Two additions to the existing `ScraperDashboard.tsx`:

**Addition 1 — "Discover Classes" button on the Coverage tab:**

Add alongside the existing "Run Scraper" button:
```tsx
<button
  onClick={handleDiscoverClasses}
  disabled={classDiscoveryRunning}
  style={{ /* same styling as existing Run Scraper button */ }}
>
  {classDiscoveryRunning ? 'DISCOVERING...' : 'DISCOVER CLASSES'}
</button>
```

`handleDiscoverClasses` function:
```typescript
async function handleDiscoverClasses() {
  setClassDiscoveryRunning(true)
  setClassDiscoveryLog([])
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/class-discovery`,
    {
      method: 'POST',
      headers: {
        'x-scraper-key': SCRAPER_SECRET,  // from env or admin context
        'Content-Type': 'application/json',
      },
    }
  )
  // Stream NDJSON same as existing scraper streaming pattern in ScraperDashboard
  const reader = res.body!.getReader()
  // ... (follow exact pattern of existing scraper streaming in ScraperDashboard.tsx)
  setClassDiscoveryRunning(false)
}
```

**Addition 2 — Class stats row on Coverage tab:**

Below the existing coverage metrics cards, add a "CLASS COVERAGE" stats row:
```tsx
<div style={{ ...mono, fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-ghost)', marginTop: 14 }}>
  CLASS COVERAGE
</div>
<div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
  <div><span style={{ fontSize: 18 }}>{classVenueCount}</span><br /><span>SCHOOLS</span></div>
  <div><span style={{ fontSize: 18 }}>{classEventCount}</span><br /><span>CLASSES</span></div>
  <div><span style={{ fontSize: 18 }}>{classWithInstructor}</span><br /><span>W/ INSTRUCTOR</span></div>
  <div><span style={{ fontSize: 18 }}>{classWithLevel}</span><br /><span>W/ LEVEL</span></div>
</div>
```

These counts come from a new RPC `get_class_coverage_metrics()`:

```sql
-- Add to supabase/migrations/20260815000012_class_coverage_rpc.sql
CREATE OR REPLACE FUNCTION public.get_class_coverage_metrics()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'class_venue_count', (SELECT COUNT(*) FROM venues WHERE venue_type = 'school'),
    'class_event_count', (SELECT COUNT(*) FROM events WHERE event_type IN ('class', 'workshop') AND (end_date IS NULL OR end_date >= CURRENT_DATE)),
    'class_with_instructor', (SELECT COUNT(*) FROM events WHERE event_type IN ('class', 'workshop') AND instructor_name IS NOT NULL),
    'class_with_level', (SELECT COUNT(*) FROM events WHERE event_type IN ('class', 'workshop') AND skill_level IS NOT NULL)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_class_coverage_metrics() TO authenticated;
```

**Error state:** If the RPC returns null (DB error), the stats show `–` placeholders. The "Discover Classes" button disables while a discovery run is in progress (same guard as existing scraper button).

---

## 4. Non-Functional Requirements

### Performance

- Class markers must render within the same frame as show markers — no additional async data fetching. The `hasClassEvents` boolean is computed synchronously from the already-fetched `events` array.
- The `class-discovery` Edge Function must stream NDJSON within 30 seconds for the first NDJSON line — the admin UI must not show a blank spinner for longer than 30 seconds.
- The `class-discovery` Edge Function total runtime budget: 90 seconds (3 schools scraped at 15 seconds each = 45 seconds, plus 5 SerpAPI calls at 2 seconds each = 10 seconds, plus overhead).
- SerpAPI calls: maximum 5 queries × 5 results = 25 search result URLs to process. At 15 seconds per page fetch + AI extraction, that is 375 seconds — which exceeds the budget. Implement a 10-result-per-discovery-run limit for web search (not per query). First 10 unique search results are processed; remainder are queued for the next run.

### Security

- `class-discovery` Edge Function uses the same auth pattern as all other scraper functions: `x-scraper-key` header OR authenticated JWT. Unauthenticated requests receive 401.
- `SERPAPI_KEY` must be stored in Supabase secrets, never in `VITE_` env vars or client-side code.
- The new `get_class_coverage_metrics()` RPC is readable by `authenticated` role only. Anon users cannot call it.
- All external URLs fetched during discovery have a 15-second abort timeout (same as `fetchVenueHtml` in `event-scraper`).

### Accessibility

- Class markers: the amber `#D4A017` on `#1a1005` background achieves 8.7:1 contrast ratio (WCAG AAA). Acceptable.
- All new interactive elements in VenueSheet (ENROLL link, class chips) are keyboard-navigable.
- The ENROLL link opens in a new tab with `rel="noopener noreferrer"` — no surprise navigation.
- Class filter chip on MapFilterChips has `min-height: 44px` touch target (already enforced by existing chip style — verify padding achieves this).
- Screen reader: amber amber glyph `◇` should have aria-label when implemented — out of scope for this feature (markers are DOM elements, not SVG/ARIA-annotated).

### Reliability

- If SerpAPI is down, the `class-discovery` function degrades gracefully: processes school venues via `calendar_url` only, skips search phase, returns summary with `warning`.
- If a school's `calendar_url` returns a non-200 status, it is logged as `fetch_error` in `scrape_logs` and the next school in the batch proceeds (existing error-isolation per venue in `event-scraper`).
- The `ON CONFLICT (slug) DO NOTHING` clause in the venue seed migration ensures re-running is always safe.

### Compliance

- SerpAPI Terms of Service permit programmatic use for application development. Verify current ToS before launch.
- Schools' websites do not have robots.txt restrictions against automated fetching for the User-Agent string used (`ArtOfArt-EventBot/1.0`). Verify for each school before launch.

---

## 5. Technical Considerations

### Prior Art: What to Reuse

| New requirement | Reuse from |
|-----------------|------------|
| Class venue scraping | `supabase/functions/event-scraper/index.ts` — `processVenue()` function handles fetch + two-pass extraction. Call it directly for school venues. |
| NDJSON streaming | `supabase/functions/event-scraper/index.ts` — copy the `ReadableStream` pattern with `encoder.encode(JSON.stringify(...) + "\n")` |
| AI extraction | `supabase/functions/_shared/scraper/extraction-prompt.ts` and `verification-prompt.ts` — extend, not replace |
| Venue queue insertion | `supabase/functions/venue-discovery/index.ts` — the `supabase.from("venue_discovery_queue").upsert(...)` pattern |
| Auth pattern | All Edge Functions — `x-scraper-key` header check + JWT fallback |
| CORS headers | `getCorsHeaders()` in any existing Edge Function — copy verbatim |
| Admin streaming UI | `src/components/ScraperDashboard.tsx` — the existing NDJSON streaming loop |
| Map filter dimming | `MapView.tsx:isVenueDimmed()` — add `'classes'` case to the existing switch-style pattern |

### Architecture: Extend vs. New

The `class-discovery` function is a **new** Edge Function rather than an extension to `event-scraper` because:
- It has a different discovery loop (web search + scrape) vs. `event-scraper`'s (query DB venues → scrape)
- It writes to `venue_discovery_queue` for new venues; `event-scraper` never does
- It has a separate admin trigger button
- The existing `event-scraper` is already complex; adding web-search discovery to it creates a monolith

The extraction/verification prompts are **extended** (not replaced) because class fields are additive — existing shows are unaffected.

### Data Model

New columns on `events` (per FR-1):
```
instructor_name  text
skill_level      text CHECK (... 5 values ...)
session_count    int
class_format     text CHECK (... 5 values ...)
```

No new tables required. Class events are first-class events in the existing `events` table.

### Integration Points

- `event-scraper` (extended): reads and writes class fields
- `class-discovery` (new): reads from `venues WHERE venue_type = 'school'`, writes to `venue_discovery_queue` and `events`
- `scrape_logs`: unchanged — class scrapes log the same `ScrapeResult` shape
- Mapbox GL JS: unchanged — still using DOM-element markers
- SerpAPI: new external dependency

### Infrastructure

- Deploy `class-discovery` function: `supabase functions deploy class-discovery`
- Set secret: `supabase secrets set SERPAPI_KEY=<key>`
- Add to pg_cron (after existing scraper cron): weekly on Mondays at 7 AM CST:
  ```sql
  SELECT cron.schedule(
    'class-discovery-weekly',
    '0 13 * * 1',  -- Mondays 7 AM CST = 1 PM UTC
    $$SELECT net.http_post(
      url := 'https://rytjrterecygirttvtdn.supabase.co/functions/v1/class-discovery',
      headers := jsonb_build_object('x-scraper-key', current_setting('app.settings.scraper_secret', true))
    )$$
  );
  ```

---

## 6. UI/UX Specifications

### Map Marker Design (Final Spec)

```
CLASS MARKER (38×44px total):

  ┌──────────────┐
  │  ◇           │  ← 34×34px chip
  │              │    amber gold #D4A017
  │   amber bg   │    near-black bg #1a1005
  │   #1a1005    │    4px border-radius
  └──────────────┘
         ╲        ← 6×6px tail, 14px from left, 33px from top
```

Contrast ratios:
- `◇` glyph (#D4A017) on #1a1005 background: 8.7:1 (WCAG AAA)
- Chip border (#D4A017) on map background: sufficient at typical zoom levels

Selected state: `scale(1.18)` transform + glow shadow (same as show markers, but amber glow):
```typescript
chip.style.boxShadow = isSelected
  ? '0 3px 8px rgba(0,0,0,.7), 0 0 12px #D4A017'
  : '0 3px 8px rgba(0,0,0,.7)'
```

### Class Detail Section in VenueSheet

Visual hierarchy:
```
┌─────────────────────────────────────────┐
│ CLASSES AT THIS VENUE          [amber]  │
│─────────────────────────────────────────│
│ Improv 101                [serif italic]│
│ INSTRUCTOR: DAVE KOECHNER     [mono 9]  │
│ [BEGINNER] [SERIES] 8 SESSIONS $325     │
│ SEP 15 – NOV 3                         │
│ ENROLL →                     [amber]   │
│·········································│
│ Advanced Harold                        │
│ INSTRUCTOR: ANNE LIBERA               │
│ [ADVANCED] [SERIES] 8 SESSIONS $349   │
│ OCT 1 – NOV 19                        │
│ ENROLL →                              │
└─────────────────────────────────────────┘
```

The amber border on the classes block (`border: '1px solid #D4A017'`) visually ties the detail section to the amber marker on the map.

### Mobile Considerations (375px viewport)

- Skill level chip + class format chip + session count + price must fit on one line — use `flexWrap: 'wrap'`
- ENROLL link minimum touch target: the text is small (8.5px) but the `<a>` element should have `padding: '6px 0'` to achieve 44px-equivalent tap area (add padding)
- The classes section appears above the action buttons (WEBSITE + directions arrow) — this is correct priority ordering: see class details before navigating away

### Map Key

Update `MapKey.tsx` to add:
```
◇  Classes & Workshops
```

Rendered in amber `#D4A017`, same 10px monospace font, same left-aligned layout as existing key entries.

---

## 7. Success Metrics

| Metric | Measured by | Target |
|--------|-------------|--------|
| Class venues in DB | `SELECT COUNT(*) FROM venues WHERE venue_type = 'school'` | ≥ 8 at launch |
| Class events in DB | `SELECT COUNT(*) FROM events WHERE event_type IN ('class', 'workshop')` | ≥ 30 at launch |
| Class events with instructor | `SELECT COUNT(*) FROM events WHERE event_type IN ('class','workshop') AND instructor_name IS NOT NULL` | ≥ 50% |
| Class events with level | `SELECT COUNT(*) FROM events WHERE event_type IN ('class','workshop') AND skill_level IS NOT NULL` | ≥ 60% |
| Map renders class diamonds | Visual QA: open map, confirm 8 amber diamonds visible | Yes |
| Class filter works | Tap CLASSES chip → non-school markers dim | Yes |
| ENROLL link opens correct page | Tap ENROLL on Improv 101 at Second City → Second City enrollment page opens | Yes |
| Admin can trigger class discovery | Press DISCOVER CLASSES → NDJSON stream appears → class venues scraped | Yes |

---

## 8. Rollout Plan

**Phase A (1 session): Schema + Seeds**
- Run migration FR-1 (class fields)
- Run migration FR-2 (8 school venues)
- Verify: `SELECT COUNT(*) FROM venues WHERE venue_type = 'school'` returns 8

**Phase B (1 session): Scraper Extension**
- Extend extraction prompt (FR-3)
- Extend verification prompt (FR-3)
- Extend types and scraper write logic (FR-3)
- Run existing event-scraper against the 8 school venues
- Verify: class events appear in DB with instructor/level data

**Phase C (1 session): Class Discovery Edge Function**
- Implement `class-discovery/index.ts` (FR-4)
- Deploy: `supabase functions deploy class-discovery`
- Set secret: `supabase secrets set SERPAPI_KEY=<key>`
- Curl test: `curl -X POST ... -H "x-scraper-key: $SCRAPER_SECRET"`
- Verify: NDJSON streams, schools scraped, search results processed

**Phase D (1 session): Frontend**
- Update `MapMarker.tsx` (FR-5 — class diamond)
- Update `MapView.tsx` (FR-5 — hasClassEvents)
- Update `VenueSheet.tsx` (FR-6 — class detail section)
- Update `MapFilterChips.tsx` (FR-7 — CLASSES chip)
- Update `MapKey.tsx` (FR-5 — legend entry)
- Update `src/lib/types.ts` (FR-1 — Event interface)

**Phase E (1 session): Admin Tools + Cron**
- Update `ScraperDashboard.tsx` (FR-8)
- Add `get_class_coverage_metrics()` RPC (FR-8)
- Configure pg_cron entry for weekly class discovery

**Deploy:** `/cap` after each phase completes and passes QA checklist.

---

## 9. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| School website HTML requires JavaScript rendering | Medium | High (pages return empty body) | Test each `calendar_url` with a raw `fetch()` before seeding. If JS-required, use a static API URL (Second City has a JSON feed) or mark `calendar_url` as null and rely on web search results only. |
| SerpAPI cost overrun | Low | Medium | Cap at 10 web results processed per run. SerpAPI free tier allows 100 searches/month — 4 weekly runs × 5 queries = 20 queries/month, well within free tier. |
| Class marker amber too similar to "tonight" green | Low | Low | Tonight shows use `var(--live)` CSS variable (typically a green-yellow in both light and dark themes). Amber `#D4A017` is a clearly distinct warm gold. Verify in both light and dark themes. |
| Venues have duplicate `calendar_url` entries (school and theater) | Low | Low | Steppenwolf appears as both a performing venue and an education venue. The education venue (slug: `steppenwolf-education`) is a separate row with its own `calendar_url`. The performing venue (slug: `steppenwolf`) has its own calendar URL. The scraper uses `venue_id` as the primary key — no conflict. |
| `session_count` hallucinated by DeepSeek | Medium | Low | The verification prompt explicitly says "Infer from title only — do NOT hallucinate" and the write logic requires the value to be a valid integer. Null is always acceptable. |
| Class pages return thousands of past sessions (e.g., Old Town School) | Medium | Medium | The existing extraction prompt already filters to future-dated events only. Old sessions are excluded by the date rule. |

---

## Appendix A: Class Venue Seed Data Verification

Before running migration FR-2, verify that each `calendar_url` returns a 200 status:

```bash
curl -sI https://www.secondcity.com/chicago/training/schedule/ | head -1
curl -sI https://ioimprov.com/chicago/classes/ | head -1
curl -sI https://theannoyance.com/classes/ | head -1
curl -sI https://chicagoimprovstudio.com/classes/ | head -1
curl -sI https://actingstudiochicago.com/classes/ | head -1
curl -sI https://piventheatre.org/classes/ | head -1
curl -sI https://www.oldtownschool.org/classes/?category=theater | head -1
curl -sI https://www.steppenwolf.org/education/adult-programs/ | head -1
```

If any return non-200, use the venue's homepage as `calendar_url` fallback and note in admin_notes.
