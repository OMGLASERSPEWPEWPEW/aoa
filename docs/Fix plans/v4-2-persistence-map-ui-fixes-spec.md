# v4.2 — Persistence, Pin Accuracy, Sheet UX, Status Dashboard & Cost Visibility

**Technical Specification for Implementation** (patch-spec on scraper v4 + geocoding v2)

| | |
|---|---|
| **Status** | Draft for implementation |
| **Date** | 2026-08-21 |
| **Inputs** | `class-scrape-log-2026-08-21.md` (run v0.21.1), `edge-functions-reference.md` (source dump 11:08 CST), device screenshot of scrape dashboard |
| **Audience** | Implementing agent (Claude Opus) in `~/Development/aoa` |
| **Node prefix** | `fx-*` |

---

## Section 0 — Verify Before Fixing (`fx-verify`)

The run log's Critical Finding says *"307 programs extracted, 0 written to the events table."* **The code does not write classes to `events`** — `processClassPrograms()` writes to **`class_sessions`**, and the dashboard's "207 created" counter is accumulated from `upsertResult.created`, i.e. real successful inserts. The log almost certainly audited the wrong table.

**Verification (do this first, it changes P0):**

```
curl "$VITE_SUPABASE_URL/rest/v1/class_sessions?select=id&limit=1" -H "apikey: $ANON" -I   # Content-Range header
curl "$VITE_SUPABASE_URL/rest/v1/class_sessions?select=school_id,title,starts_on,price&order=scraped_at.desc&limit=5" -H "apikey: $ANON"
```

- **If `class_sessions` has ~200+ rows** → persistence works; strike the log's finding, fix the log-generation query to audit `class_sessions`, and proceed with the rest of this spec.
- **If it is genuinely near-zero** → the silent-drop path in §2 is live; §2 becomes P0.

Either way, §2's hardening ships — a pipeline that can lose 307 programs without logging one error is a landmine regardless of whether it detonated this run.

---

## Section 1 — Issue Triage: Existing Tiers vs. Unbuilt Tiers (`fx-triage`)

Direct answer to "would implementing the remaining tiers resolve this?" — for each observed issue:

| Issue | Root cause | Layer | Fixed by Tier 2/3? |
|---|---|---|---|
| ASC pin in wrong spot (Clybourn, not Hubbard) | Stale discovery address blocks correct crawl-extracted address via inverted precedence guard (§3.1) | Data / completion hook | **No** — one conditional |
| 8 schools stacked at (41.887063, −87.62925) | Junk discovery address strings ("Chicago, IL", "Unknown, Chicago, IL") geocoded by Mapbox to a downtown city point (§3.2) | Data / geocoding | **No** |
| Third Coast = Nashville, All Out = Oakland on a Chicago map | Discovery admits out-of-city schools; Perplexity even hallucinated Chicago addresses for them. The crawler *extracted their real out-of-state addresses* — nothing acts on it (§3.4) | Discovery validation | **No** — the signal already exists |
| No address in pin sheet; ALSO NEARBY instead of class list; dead TELL ME MORE; ↗ opens geolocation; no photos | `ClassSheet.tsx` as built (§4) | Frontend | **No** |
| Costs "not recorded" | Recorded in `crawl_state.budget_used` (run total $0.0745) but `scrape_logs` hardcodes `ai_input_tokens: 0, duration_ms: 0` and has no cost column; dashboard never shows $ (§6) | Observability plumbing | **No** |
| Duplicate rows per school, everything "IN PROGRESS" | `recent_schools.unshift(...)` runs **once per invocation** including resumes; 4-invocation crawls → 4 rows (§5) | Dashboard plumbing (side-effect of resumable crawls working) | **No** |
| Chicago Actors Studio + Logan Square Improv: `seed_fetch_failed` | Sites unreachable to plain fetch — blocked or down | **Tier 3** | **Yes** — textbook `fetch_blocked` Scout jobs. Until Tier 3 ships: mark venues `fetch_blocked`, exclude from map, queue in `scrape_jobs` |
| iO (2 pages, 0 programs), CIC, Vagabond, Artistic Home: `complete` with 0 programs | Likely JS-rendered content the Tier-2 trigger didn't catch, plus a stop-logic bug (declaring `complete` with 0 programs while score-80+ frontier remains) (§7) | **Tier 2 trigger tuning** + stop-logic fix | **Partially** — investigate trigger first; Tier 3 is the backstop |

Bottom line: ship §2–§6 as existing-tier fixes; the unbuilt tiers earn their keep on exactly the last two rows.

---

## Section 2 — Persistence Hardening (`fx-persist`) — P0 pending §0

In `class-scrape-batch/index.ts`:

1. **Kill the silent drop.** Current guard: `if (result.programs.length > 0 && schoolId) { …processClassPrograms… }`. When the `schools`-row lookup (`.eq("venue_id", school.id)`) misses, `schoolId` is `undefined` and every extracted program is discarded with **zero logging**. Change to:

```ts
if (result.programs.length > 0) {
  if (!schoolId) {
    // Self-heal: create the missing schools row from the venue, then proceed.
    const { data: healed, error: healErr } = await supabase.from("schools").insert({
      name: school.name, short_name: school.name.slice(0, 14).toUpperCase(),
      slug: school.slug, latitude: school.latitude, longitude: school.longitude,
      neighborhood: "Chicago", discipline: "acting", venue_id: school.id,
      url: school.website_url ?? school.calendar_url, address: school.address ?? null,
    }).select("id").single();
    if (healErr || !healed) {
      status = "failed";
      errorMessage = `schools row missing for venue ${school.id} and self-heal failed: ${healErr?.message}`;
      console.error(`[class-scrape-batch] ${errorMessage} — ${result.programs.length} programs NOT persisted`);
    } else { schoolId = healed.id; }
  }
  if (schoolId) { /* existing processClassPrograms call */ }
}
```

2. **Persisted-vs-extracted invariant in the log row.** Add `programs_extracted: result.programs.length` and `sections_persisted: eventsCreated + upsertResult.updated` into `strategy_trace`; if `programs_extracted > 0 && sections_persisted === 0`, set the scrape_logs `status` to `"persist_failed"` — never `"success"`. The dashboard footer must count creations from this, not from optimistic math.
3. **Fix the log generator** (whatever produced `class-scrape-log-2026-08-21.md`) to audit `class_sessions`, and add the §0 curl to its template.

---

## Section 3 — Pin Accuracy: Four Data Fixes (`fx-geocode-data`)

### 3.1 Precedence inversion in the address hook (`fx-precedence`) — the ASC bug

`processClassPrograms()` currently guards the crawl-address update with `venue && !venue.address && !hasStrongSource` — meaning **any** existing address, however bad its source, blocks the correct crawl-extracted one. ASC: discovery stored Perplexity's stale "2222 N Clybourn Ave" (`geocode_source: known_address:mapbox`) → the correct "10 W Hubbard Suite 2E" from the crawl was ignored → pin in Lincoln Park.

Replace with source-ranked precedence (crawl beats discovery):

```ts
const SOURCE_RANK: Record<string, number> = { llm_extracted: 4, website: 4, known_address: 2, perplexity: 2, places_api: 3, mapbox_poi: 3, default: 0 };
const rankOf = (s: string | null) => SOURCE_RANK[(s ?? "").split(":")[0]] ?? 1;

const incomingRank = 4;                                  // crawl-extracted = llm_extracted
const existingRank = rankOf(venue?.geocode_source);
const shouldUpdate = venue && (existingRank < incomingRank ||
                               isBadCoordinate(venue.latitude, venue.longitude) ||
                               venue.latitude == null);
```

When `shouldUpdate`, geocode + guard + write both tables exactly as today. Log the supersession: `[address] llm_extracted supersedes ${venue.geocode_source} for ${schoolName}`.

### 3.2 Junk-address validation before geocoding (`fx-addr-validate`) — the (41.887, −87.629) pile

Discovery passed `knownAddress` strings like `"Chicago, IL"` and `"Unknown, Chicago, IL"` straight into `resolveCoordinates`; Mapbox geocoded the city name to a downtown point for **8 schools**. The Perplexity finder already validates "starts with a street number" — hoist that into a shared predicate and apply it to **every** address before any geocode call:

```ts
export function isPlausibleStreetAddress(s: string | null | undefined): boolean {
  if (!s) return false;
  const t = s.trim();
  if (/^unknown/i.test(t)) return false;
  return /^\d{1,6}\s+\S/.test(t);        // must start with a street number
}
```

Call sites: `geocodeSchool` step 1 (knownAddress), `processClassPrograms` address hook, the backfill, and `parseStructuredResponse` in discovery (store `address: null` instead of `"Unknown, Chicago, IL"` — stop manufacturing junk at the source).

### 3.3 Close the Mapbox city-point hole (`fx-mapbox-guard`)

1. Add the observed point to the blocklist: `{ lat: 41.887063, lng: -87.62925, label: "mapbox_chicago_city_point" }` in `BAD_COORDS`.
2. Verify `geocodeMapbox` rejects non-address results as spec'd in geocoding-v2 §3.1: a feature whose `place_type` contains `place | region | district | locality | postcode` (or, for the v6 API, `feature_type` of `place`/`region`) must return null. If the shipped implementation dropped this check, restore it — the blocklist is the backstop, the type check is the fix.
3. Re-run the backfill **targeted**: `{"action":"geocode-backfill","names":[...the 8 stacked schools...]}`. With junk `knownAddress` now rejected, the cascade proceeds to website-regex → Perplexity → business-name and should place each at its real location; genuinely unresolvable ones fall to honest `geocode_status='default'` and off the map.

### 3.4 Out-of-city quarantine (`fx-city-quarantine`)

Third Coast Comedy (Nashville, TN) and All Out Comedy Theater (Oakland, CA) are on a Chicago map because discovery trusts Perplexity's school list and even its fabricated Chicago addresses. The crawler already extracted their true out-of-state addresses — act on that signal:

1. **At crawl completion**: if the extracted `school_address` matches a US state token other than the venue's target state (regex `/,\s*([A-Z]{2})\s*\d{5}/` or trailing `, XX`), set `venues.url_status = 'out_of_city'` (reuse the existing status column from v3.1; add the enum value), log it in the trace, and **skip the address hook** (never geocode a Nashville address for a Chicago pin).
2. **Frontend**: `fetchClassMapData` excludes schools whose venue is `out_of_city` (join or a mirrored `schools.status` column — implementer's choice, keep it one query).
3. **Recon identity prompt**: extend with locality — after "Is this page the official website of that organization", add: *"If the page clearly indicates the organization is based in a different city than {city}, answer mismatch."* Sanford Meisner proved the mismatch path works; this widens it to catch Oakland/Nashville at fetch #1 next time.
4. Manual cleanup now: mark both venues `out_of_city`; their `class_sessions` rows (16 + 1) are deleted or left orphaned-but-hidden — spec says delete for cleanliness.

---

## Section 4 — ClassSheet Redesign (`fx-sheet`)

File: `src/components/ClassSheet.tsx`. Four changes, all confirmed against the current component. Design tokens (Newsreader/Courier Prime, `--dc`, chip styles, 44px targets) stay exactly as they are.

### 4.1 Address line (`fx-sheet-address`)
Under the header block (`HOOD · DISCIPLINE · PRICE_BAND` row), add the street address when present: Courier Prime 10px, `var(--ink-dim)`, prefixed `⌖ `. **The address line is the tappable directions affordance** — wrap it in the `maps.google.com/maps?q={lat},{lng}` link that currently lives on the ↗ button. Requires `address` on the school payload: add `address` to the `schools` select in `fetchClassMapData` (it's `select('*')` already — just add the field to the `School` type) and backfill `schools.address` from `venues.address` where null (one SQL statement in the §8 migration).

### 4.2 Replace ALSO NEARBY with THE CLASSES (`fx-sheet-classes`)
Delete the `nearby` computation and the ALSO NEARBY block. In its place, list **this school's own upcoming sessions**:

- Data: `useClassMap` currently keeps only `next_session` per school. Extend `SchoolWithSession` with `sessions: ClassSession[]` — all sessions where `starts_on >= today` OR `starts_on IS NULL` (dateless programs render `LATER`), ordered `starts_on asc nulls last`, deduped by `(title, schedule)`, cap 12. `fetchClassMapData` already fetches all sessions; stop discarding them.
- Render per row (reuse the exact ALSO NEARBY row styling — date chip, italic title, right-aligned detail): `SEP 26` / `LATER` · *Level 3: Scene Study* · `SAT 1:00–4:30 · $425`. Row tap → `session.signup_url ?? session.source_url` in a new tab; rows without either are non-tappable (no dead links).
- Section label: `THE CLASSES` (`N ENROLLING` count right-aligned in `--dc`).
- The Next-Session panel stays as the hero summary above; this list is the depth behind it.

### 4.3 Actions row (`fx-sheet-actions`)
- **Remove TELL ME MORE** entirely (it has no handler; user confirms it isn't wanted).
- **↗ now opens the class page**, not geolocation: `session?.signup_url ?? session?.source_url ?? school.url`. Directions live on the address line (§4.1). If no URL exists at all, hide the button.
- Primary button (`Hold a spot` / `Just show up` / `Join the waitlist`) gets the same href as ↗ — today it is also a dead button; make it an `<a>` styled identically.

### 4.4 Hero image (`fx-sheet-image`)
The 88×66 `THE ROOM` placeholder already anticipates `photo_url`. Render `school.photo_url` when non-null (object-fit cover, same frame; keep the placeholder as fallback). Data supply is §5. Per the ui-designer journal commitment, the container is ratio-ready — do not redesign it here.

---

## Section 5 — School Images via og:image (`fx-images`)

No new tier needed — the seed page's raw HTML is already in hand during Tier 1, and `_shared/scraper/og-image-extractor.ts` already exists (built for shows). Wire it for schools:

1. **Migration**: `alter table schools add column if not exists photo_url text; alter table venues add column if not exists photo_url text;` (skip if present — the type dumps show `photo_url` on event-side types only).
2. **Capture**: in `executeClassStrategy`, on the **seed page only**, call the og-image extractor against the raw HTML (`og:image` → `twitter:image` → largest `<img>` heuristic already encoded there). Store the absolute URL in `crawl_state` (add `photo_url text`) alongside `school_address`.
3. **Persist**: in the same completion hook as the address (§3.1), write `photo_url` to `schools` + `venues` when currently null. Never overwrite a non-null value (a hand-curated photo must win).
4. **Hygiene**: require `https:`, resolve relative URLs against the seed origin, reject data-URIs and SVG, cap length 500 chars. Broken images are handled client-side with `onError` → placeholder — no server-side validation fetch (saves budget).
5. **Scope note**: this yields the school's *brand* image (logo/hero). Tier-3 Scout screenshots are diagnostics, not brand assets — they are not a substitute, so this stays the image source even after Tier 3 ships.

---

## Section 6 — Scrape Dashboard: Truthful, Deduped, Priced (`fx-dashboard`)

The duplicate rows are one entry **per invocation**: `recent_schools.unshift({... status: "in_progress"})` runs on every self-chained resume, so a 4-invocation crawl paints 4 rows (screenshot: Green Shirt ×4, All Out ×4, Old Town ×3 — exactly matching the log's invocation counts). The resumable crawl is working; the feed was never taught about it.

### 6.1 Keyed upsert in `recent_schools` (`fx-recent-dedupe`)
In `class-scrape-batch`, replace the unconditional `unshift` with find-and-update by `venueId`:

```ts
const idx = recentSchools.findIndex(r => r.venueId === school.id);
const entry = {
  name: school.name, venueId: school.id, status,
  invocations: (idx >= 0 ? ((recentSchools[idx].invocations as number) ?? 1) : 0) + 1,
  eventsFound, eventsCreated,
  programsExtracted: result?.programs?.length ?? 0,
  completeness: result?.trace?.completenessAfterFollows ?? null,
  costUsd: result?.trace?.budgetUsed?.usd ?? null,
  pagesVisited: result?.trace?.pagesVisited ?? null,
  stopReason: result?.trace?.stopReason ?? null,
  address: result?.schoolAddress ?? null,
  calendarUrl: school.calendar_url,
  timestamp: new Date().toISOString(),
};
if (idx >= 0) { recentSchools.splice(idx, 1); }
recentSchools.unshift(entry);            // one row per school, newest activity first
```

`in_progress` entries thus become the *same row* updating in place, and the terminal invocation overwrites it with `success`/`failed`. Raise the cap from 15 to 25 so an 18-school run fits.

### 6.2 Dashboard row detail (`fx-dashboard-detail`)
The expandable row currently shows only the URL. Show, from the enriched entry: status chip (`SUCCESS n INVOCATIONS` / `IN PROGRESS · INV 3` / `FAILED · seed_fetch_failed`), `programsExtracted` + `eventsCreated` ("72 programs → 89 sessions"), completeness %, `costUsd` (4 decimals), `pagesVisited`, extracted address, and the URL last. Defensive rendering: all fields optional (old entries lack them).

### 6.3 Truthful counters (`fx-dashboard-counters`)
Footer becomes `232 found · 207 persisted · 56% avg · $0.0745`. "Persisted" must come from `events_created` accumulated off real insert results (§2.2's invariant makes fake counts impossible); add `total_cost_usd` to `scrape_jobs` (migration §8), accumulated per invocation from `budget_used.usd`, and render it. If §0 revealed persistence failure, this footer is where it becomes visible instead of silently reading "207 created".

---

## Section 7 — Cost Recording End-to-End (`fx-costs`)

Costs exist in `crawl_state.budget_used` (log proves it: $0.0745/run, per-school detail) but die there:

1. **Migration** (§8): `alter table scrape_logs add column if not exists cost_usd numeric, add column if not exists fetches int, add column if not exists pages_visited int;` and `alter table scrape_jobs add column if not exists total_cost_usd numeric default 0;`
2. **Stop hardcoding zeros**: the `scrape_logs` insert currently writes `ai_input_tokens: 0, ai_output_tokens: 0, duration_ms: 0`. Thread reals from `budget_used`: `ai_input_tokens: budget.inputTokens ?? 0`, `ai_output_tokens: budget.outputTokens ?? 0`, `duration_ms: budget.wallMs ?? 0`, `cost_usd: budget.usd`, `fetches`, `pages_visited`. If token splits aren't tracked in `budget_used` today, add them where `recordAiCall(prompt_tokens, completion_tokens)` already receives both numbers — the data is in hand and being discarded.
3. **Accumulate** `scrape_jobs.total_cost_usd += budget_used.usd` each invocation (same update as §6.1).
4. **Surface**: dashboard footer (§6.3), per-row cost (§6.2), and add cost to the changelog entry template for scrape-affecting releases per `.claude/rules/versioning.md` conventions.

---

## Section 8 — Migration (single file) (`fx-migration`)

`supabase/migrations/2026082N_v42_fixes.sql`:

```sql
alter table schools add column if not exists photo_url text;
alter table venues  add column if not exists photo_url text;
alter table scrape_logs add column if not exists cost_usd numeric,
                        add column if not exists fetches int,
                        add column if not exists pages_visited int;
alter table scrape_jobs add column if not exists total_cost_usd numeric default 0;
alter table crawl_state add column if not exists photo_url text;
update schools s set address = v.address
  from venues v where s.venue_id = v.id and s.address is null and v.address is not null;
```

(RLS: `schools`/`venues` are public-read already; new columns inherit. No policy changes.)

---

## Section 9 — Extraction-Quality Follow-ups (`fx-extraction`) — the Tier 2/3 lane

1. **Never `complete` at zero.** Vagabond and Artistic Home stopped with `stop_reason: complete`, 0 programs, and 13–16 score-80+ URLs still in the frontier. Add to the stop logic: a crawl may not declare `complete` while `programs_partial.length === 0 && frontier.some(l => l.score >= 80)` — keep crawling until budget or frontier exhaustion.
2. **Tier-2 trigger audit (iO, CIC, Vagabond).** For each, check the trace: did `needsRender` fire? If plain-fetch pages classified as `catalog_index/program_detail` produced 0 programs, Jina should have re-fetched. Suspected gap: the classifier may be returning `other` on JS shells (nav-only text), which skips both extraction *and* the zero-programs render signal. Fix: pages classified `other` with ≥8 same-domain links and <400 chars of non-boilerplate text → Jina retry once. Re-run these three schools; whatever still yields zero goes to the Tier-3 queue with reason `js_interactive`.
3. **Queue the blocked pair for Tier 3.** Chicago Actors Studio + Logan Square Improv (`seed_fetch_failed`): insert `scrape_jobs` rows with reason `fetch_blocked` now, venue `url_status = 'fetch_blocked'`, excluded from the map. They become the first real Scout jobs when Tier 3 ships — and its acceptance test.
4. **Old Town scope decision (product, not code).** 117 extracted programs are overwhelmingly music (guitar, accordion, banjo…). Options: (a) keep all and add a `music` discipline color; (b) filter at persistence to `discipline in (acting, improv, comedy, writing, musical, other-performance)`; (c) constrain the crawl via seed (`/classes/adults/theater` only). Recommend (b) now — cheap, reversible, keeps the map on-mission — and revisit (a) if AOA widens scope. Flag in the changelog either way.
5. **All Out garbage title** ("Stand Up Comedy Classes Begins", from a Squarespace calendar item) resolves itself via §3.4 quarantine — no extraction change needed.

---

## Section 10 — Acceptance Criteria (`fx-acceptance`)

| # | Check | Pass condition |
|---|---|---|
| A1 | §0 verification recorded in PR description | `class_sessions` count stated; log generator audits the right table |
| A2 | ASC pin | `venues`+`schools` show address `10 W Hubbard Suite 2E…`, coords ≈ (41.890, −87.628), `geocode_source: llm_extracted:*`; pin renders in River North; sheet shows the address line |
| A3 | The (41.887063, −87.62925) stack | Zero schools at that point; each of the 8 either at a real distinct location or honestly `geocode_status='default'` (off-map) |
| A4 | Out-of-city | Third Coast + All Out absent from map and class list; venues marked `out_of_city`; their sessions removed |
| A5 | Sheet | Address line tappable → directions; THE CLASSES lists ≥5 rows for ASC with dates/prices; rows open signup/source pages; TELL ME MORE gone; ↗ opens class page; hero image renders for schools with `photo_url` (spot-check ASC, Green Shirt) |
| A6 | Dashboard | Re-run scrape: exactly one row per school, updating in place through invocations; expanded row shows programs/sessions/completeness/cost/address; footer shows `$` total; zero-persistence run would display `persist_failed`, not "created" |
| A7 | Costs | New `scrape_logs` rows have non-zero `cost_usd`/`duration_ms` for successful crawls; `scrape_jobs.total_cost_usd` ≈ sum of per-school costs (±rounding) |
| A8 | Stop logic | Re-run Vagabond: crawl does not stop `complete` at 0 programs with high-score frontier remaining |
| A9 | Tier queue | Two `scrape_jobs` rows, reason `fetch_blocked`, for the unreachable schools |
| A10 | Regression | `npm run build` clean; shows mode untouched; VenueSheet untouched; existing map filters work |

## Appendix — File Change Manifest

| File | Nodes | Change |
|---|---|---|
| `supabase/functions/class-scrape-batch/index.ts` | fx-persist, fx-recent-dedupe, fx-dashboard-counters, fx-costs | Self-heal missing school row; persist_failed invariant; keyed recent_schools upsert with rich fields; cost accumulation; thread budget_used into scrape_logs |
| `supabase/functions/_shared/scraper/process-venue.ts` | fx-precedence, fx-images | Source-ranked address precedence; photo_url persistence |
| `supabase/functions/_shared/geocoder.ts` | fx-addr-validate, fx-mapbox-guard | `isPlausibleStreetAddress`; BAD_COORDS + mapbox city point; verify/restore place_type rejection |
| `supabase/functions/school-discovery/index.ts` | fx-addr-validate, fx-city-quarantine | Validate knownAddress; discovery stores null over junk; identity prompt locality clause |
| `supabase/functions/_shared/scraper/strategy-agent.ts` | fx-images, fx-extraction | og-image capture at seed; complete-at-zero stop rule; `other`-page Jina retry; out-of-city detection at completion |
| `src/components/ClassSheet.tsx` | fx-sheet-* | Address line (directions), THE CLASSES list, actions rework, hero image |
| `src/lib/classData.ts`, `src/lib/types.ts` | fx-sheet-classes | `sessions[]` on SchoolWithSession; `address`/`photo_url` on School |
| `supabase/migrations/2026082N_v42_fixes.sql` | fx-migration | photo_url, cost columns, address backfill |
| Log generator (Claude Code command/skill) | fx-verify | Audit `class_sessions`; include §0 curls |

— End of specification —
