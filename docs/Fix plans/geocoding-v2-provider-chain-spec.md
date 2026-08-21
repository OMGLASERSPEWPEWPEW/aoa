# Geocoding v2 — Provider Chain, Perplexity Elevation, and the Centroid Guard

**Technical Specification for Implementation** (patch-spec; supersedes §9 of `docs/scraper-v4-tiered-escalation-spec.md`)

| | |
|---|---|
| **Status** | Draft for implementation |
| **Date** | 2026-08-21 |
| **Fixes** | ASC (and others) invisible on map; city-centroid pile-up; Perplexity answers being discarded |
| **Audience** | Implementing agent (Claude Opus) in `~/Development/aoa` |
| **Node prefix** | `gv2-*` |
| **Hard requirement** | Works with **zero new paid accounts** — Google Places key is OPTIONAL throughout |

---

## Section 0 — Plain-English Primer: Who Does What

Four external services appear in this spec. They do different jobs; the bugs came from using the wrong one for the wrong job.

| Service | What it actually is | What it's good at | What it's bad at | Key status |
|---|---|---|---|---|
| **Nominatim** | OpenStreetMap's free geocoder (`nominatim.openstreetmap.org`). Address text → lat/lng. No key needed. | Clean street addresses ("1350 N Wells St, Chicago, IL") | **Business names** — "Acting Studio Chicago, Chicago, IL" doesn't fail, it matches "Chicago" and returns the **city centroid (41.8755616, −87.6244212)** as if it succeeded. Also chokes on "Suite 2E" in addresses. | None needed. Rate limit: 1 req/sec (keep `delay(1100)`) |
| **Mapbox Geocoding** | The geocoding API from the same company whose token already renders the AOA map. Address or place text → lat/lng. | Addresses with suites/units; decent POI (business) lookup; 100k free requests/month | POI coverage below Google's for obscure businesses | **Already have the token** (`VITE_MAPBOX_TOKEN`). Must also be added as a Supabase secret — see §5 |
| **Perplexity (sonar)** | A web-searching LLM. Cannot return coordinates — but it can **find address text** ("What is the street address of Acting Studio Chicago?") by actually searching the web. | Finding the address of a named business, including ones no geocoder indexes | It returns *text*, sometimes with extra words; it can occasionally be wrong, so its answer must be validated by geocoding it | **Already have the key** (`PERPLEXITY_API_KEY`, used by discovery) |
| **Google Geocoding + Places** | Paid. Best accuracy for both addresses and business-name search (~$5/1000 lookups). | Everything above, best-in-class | Requires a billing account + key | **OPTIONAL.** If `GOOGLE_PLACES_API_KEY` is ever set, it silently becomes the top provider. Not required for this spec to fully work |

**The core design correction:** separate *finding an address* (crawl-extracted → website regex → **Perplexity**) from *resolving coordinates* (Google → Mapbox → Nominatim, first configured wins), and put a **guard** between every result and the database so a city-centroid junk answer can never again be recorded as success.

---

## Section 1 — Confirmed Bugs This Spec Fixes (`gv2-bugs`)

| # | Bug | Evidence | Fix section |
|---|---|---|---|
| B1 | **Centroid trap**: Nominatim name-lookup returns Chicago's centroid (41.8755616, −87.6244212); cascade treats it as success (`source ≠ 'default'`), backfill stamps `geocode_status='ok'` | Green Shirt Studio and Farwell Acting Studio sit at *exactly* those coordinates in prod. ASC either joined the pile or is still at the filtered default (41.8781, −87.6298) | §3.2, §3.3 |
| B2 | **Regex runs on raw HTML**: ASC's footer is `10 W Hubbard Suite 2E<br>Chicago, IL 60654` — the `<br>` between "2E" and "Chicago" breaks `\s*,?\s*Chicago`, so the website step never fires | Live footer fetched 2026-08-20 | §3.4 |
| B3 | **Perplexity's correct answers get discarded**: `school-discovery` re-filters Perplexity's reply through the city-anchored regex (fails when Perplexity returns just "10 W Hubbard Suite 2E" with no city); `class-discovery`'s copy uses the OLD suffix-required regex (fails on any suffix-less street). Perplexity can be *right* and the code throws it away | Both code paths read in review | §3.5 |
| B4 | **Nominatim + "Suite 2E"**: even a correctly captured address often geocodes to nothing on Nominatim because of the unit token | Known Nominatim behavior | §3.2 |
| B5 | **Backfill can destroy good data**: selection includes `geocode_status.is.null`, sweeping in correctly-placed legacy venues; combined with B1 it can overwrite good coordinates with the centroid. **Do not re-run the backfill until B1's guard ships** | Backfill code in review | §4.1 |
| B6 | **Two divergent geocode paths**: `class-discovery/index.ts` still carries its own old `geocodeSchool` + old narrow regex + auto-geocode on the `start` action — it re-poisons rows even after `school-discovery` is fixed | Both files in review | §4.2 |
| B7 | Places business search is dead code without a Google key (`geocodeByBusinessName` returns `null` immediately) | `_shared/geocoder.ts` in review | §3.3 |

---

## Section 2 — Architecture (`gv2-architecture`)

```
                        ┌─────────── ADDRESS FINDERS (in order) ───────────┐
                        │ 1. crawl-extracted school_address (LLM, exists)  │
                        │ 2. website footer/contact regex — on TAG-STRIPPED │
                        │    text, homepage then /contact* (≤2 fetches)     │
                        │ 3. Perplexity address lookup (JSON, lenient parse)│
                        └───────────────┬───────────────────────────────────┘
                                        │ address string
                                        ▼
                        ┌────── COORDINATE RESOLVER CHAIN ──────┐
                        │ Google Geocoding   (if key set)        │
                        │ Mapbox Geocoding   (if token set)      │   first configured
                        │ Nominatim          (always; suite-strip│   provider wins
                        │                     + type rejection)  │
                        └───────────────┬────────────────────────┘
                                        │ {lat, lng}
                                        ▼
                               ┌─── THE GUARD ───┐        no address found at all?
                               │ isBadCoordinate │◀───── BUSINESS-NAME SEARCH:
                               │ + type checks   │        Google Places (if key)
                               └──────┬──────────┘        else Mapbox POI search
                                      │ pass              (NEVER Nominatim by name — B1)
                                      ▼
                          write venues + schools + source/status
                                      │ fail every stage
                                      ▼
                          default coords + geocode_status='default'
                          (MapView filter hides it — correct behavior)
```

Perplexity's position: **step 3 of the finders** — ahead of business-name search, because it web-searches and works for schools no geocoder's POI index knows. Its answer is never trusted raw: it must survive the resolver chain *and* the guard, which converts "occasionally hallucinates" into "occasionally costs one wasted geocode call."

---

## Section 3 — Code Changes

### 3.1 New provider-chain resolver — `_shared/geocoder.ts` (`gv2-resolver-chain`)

Replace the single `geocode()` dispatch with an explicit chain. Keep the existing exported names working (thin wrappers) so nothing else breaks mid-rollout.

```ts
const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");   // optional
const MAPBOX_TOKEN = Deno.env.get("MAPBOX_TOKEN");                     // §5 — same value as VITE_MAPBOX_TOKEN

export interface GeoResult { lat: number; lng: number; formatted?: string; provider: string; }

export async function resolveCoordinates(address: string, city = "Chicago"): Promise<GeoResult | null> {
  const attempts: Array<() => Promise<GeoResult | null>> = [];
  if (GOOGLE_PLACES_API_KEY) attempts.push(() => geocodeGoogle(address));
  if (MAPBOX_TOKEN)          attempts.push(() => geocodeMapbox(address, city));
  attempts.push(() => geocodeNominatimHardened(address, city));         // always last

  for (const attempt of attempts) {
    const r = await attempt();
    if (r && !isBadCoordinate(r.lat, r.lng)) return r;                  // guard on EVERY provider
  }
  return null;
}
```

**Mapbox implementation** (new — works with the token that already renders the map; public `pk.` tokens are valid for this API):

```ts
async function geocodeMapbox(query: string, city: string): Promise<GeoResult | null> {
  // v5 forward geocoding. proximity biases results toward Chicago; country pin avoids
  // matching a same-named street elsewhere.
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set("access_token", MAPBOX_TOKEN!);
  url.searchParams.set("limit", "1");
  url.searchParams.set("country", "us");
  url.searchParams.set("proximity", "-87.6298,41.8781");
  url.searchParams.set("types", "address,poi");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;          // 403 here usually means a URL-restricted token — see §5
    const data = await res.json();
    const f = data.features?.[0];
    if (!f?.center) return null;
    // Reject city/region-level matches — the Mapbox analogue of the Nominatim trap.
    const placeType: string[] = f.place_type ?? [];
    if (placeType.some((t: string) => ["place", "region", "district", "locality", "postcode"].includes(t))) {
      return null;
    }
    return { lat: f.center[1], lng: f.center[0], formatted: f.place_name, provider: "mapbox" };
  } catch { return null; }
}
```

**Hardened Nominatim** (replaces `geocodeNominatim`; fixes B1 structurally and B4):

```ts
const UNIT_TOKEN_RE = /,?\s*(?:suite|ste\.?|unit|apt\.?|#|fl(?:oor)?|rm|room)\s*[\w-]+/gi;

async function geocodeNominatimHardened(address: string, city: string): Promise<GeoResult | null> {
  // B4: Nominatim frequently fails on unit tokens — strip "Suite 2E" etc. from the QUERY only.
  // The stored address keeps the suite; only the geocode query loses it.
  const query = address.replace(UNIT_TOKEN_RE, "").replace(/\s{2,}/g, " ").trim();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");        // jsonv2 exposes addresstype
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "AOA-ClassFinder/1.0 (contact: deric.o.ortiz@gmail.com)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    if (!hit) return null;

    // B1 structural fix: if Nominatim matched the CITY (or any administrative area)
    // instead of a street address/building, that is a MISS, not a hit. This is what
    // currently returns Chicago's centroid for business-name queries — and it
    // generalizes to NYC/LA without hardcoding their centroids.
    const at = (hit.addresstype ?? hit.type ?? "").toLowerCase();
    const cls = (hit.class ?? "").toLowerCase();
    if (cls === "boundary" || ["city", "town", "administrative", "state", "county", "suburb", "neighbourhood", "postcode"].includes(at)) {
      return null;
    }
    return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), formatted: hit.display_name, provider: "nominatim" };
  } catch { return null; }
}
```

Keep the existing `geocode(address)` export as a one-line wrapper around `resolveCoordinates(address)` returning the legacy shape, so untouched call sites keep compiling.

### 3.2 The coordinate guard — `_shared/geocoder.ts` (`gv2-guard`)

Belt-and-suspenders on top of the type-based rejections above. Covers legacy poisoned rows, any provider oddity, and any future regression:

```ts
// Known junk coordinates that must NEVER be written with geocode_status='ok'.
// Extensible per city as AOA expands (add each city's default + its OSM centroid).
const BAD_COORDS: Array<{ lat: number; lng: number; label: string }> = [
  { lat: 41.8781,     lng: -87.6298,    label: "chicago_default_fallback" },
  { lat: 41.8755616,  lng: -87.6244212, label: "nominatim_chicago_centroid" },
];
const BAD_RADIUS_DEG = 0.0015; // ≈ 165 m box — catches float drift and re-projections

export function isBadCoordinate(lat: number, lng: number): boolean {
  return BAD_COORDS.some(b =>
    Math.abs(lat - b.lat) < BAD_RADIUS_DEG && Math.abs(lng - b.lng) < BAD_RADIUS_DEG);
}
```

**Apply it at every write site**, not just inside the resolver: the crawl completion hook, `geocodeSchool`'s return, the backfill's update branch, and `scrape-ingest`. A result failing the guard is treated exactly like a provider miss (continue the cascade, or fall to `default` status).

### 3.3 Business-name search chain — `_shared/geocoder.ts` (`gv2-name-search`)

Replaces the Google-only `geocodeByBusinessName` (B7). **Nominatim is deliberately absent from this chain — name lookups on Nominatim are the original trap (B1).**

```ts
export async function geocodeBusinessByName(name: string, city: string, state = "IL"):
  Promise<(GeoResult & { address: string | null }) | null> {

  if (GOOGLE_PLACES_API_KEY) {
    const g = await placesTextSearch(name, city, state);       // existing implementation, keep
    if (g && !isBadCoordinate(g.lat, g.lng)) return g;
  }
  if (MAPBOX_TOKEN) {
    // POI-only search: "Acting Studio Chicago" as a place of interest, not an address.
    const m = await geocodeMapboxPoi(`${name} ${city} ${state}`);  // same as geocodeMapbox but types=poi
    if (m && !isBadCoordinate(m.lat, m.lng)) {
      // Token-overlap sanity check, mirroring the existing Places check: require ≥ 0.5
      // overlap between the school name and the returned place_name.
      if (nameOverlap(name, m.formatted ?? "") >= 0.5) return { ...m, address: m.formatted ?? null };
    }
  }
  return null;   // no key/token or nothing credible — cascade falls through to default
}
```

`nameOverlap` = lowercase token intersection over school-name tokens (>1 char), the same logic already in `geocodeByBusinessName`; hoist it into a shared helper.

### 3.4 Tag-stripped website regex — `school-discovery/index.ts` (`gv2-tagstrip`)

Fixes B2. The regex itself (`buildAddressRegex`, suffix-optional with city anchor) is correct — it just needs text, not markup, and a second chance on the contact page:

```ts
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")        // <br> between "Suite 2E" and "Chicago" becomes a space
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");
}

async function extractAddressFromSite(websiteUrl: string, city: string): Promise<string | null> {
  const addrRegex = buildAddressRegex(city);
  const candidates = [websiteUrl];
  try {
    const origin = new URL(websiteUrl).origin;
    candidates.push(`${origin}/contact`, `${origin}/contact-us`);      // ≤ 2 extra fetches, only if needed
  } catch { /* keep just websiteUrl */ }

  for (const url of candidates) {
    const html = await politeFetch(url);                                // existing fetch + UA + timeout
    if (!html) continue;
    const m = htmlToText(html).match(addrRegex);
    if (m) return `${m[1].trim()}, ${city}, IL`;
  }
  return null;
}
```

### 3.5 Perplexity as a first-class address finder (`gv2-perplexity`)

Fixes B3 and implements the elevation. Perplexity moves from last resort to **finder step 3** — before business-name search — and its output is parsed leniently instead of being re-filtered through an address regex.

**New helper in `school-discovery/index.ts`** (or `_shared` if class-discovery will import it — it should, per §4.2):

```ts
async function perplexityFindAddress(name: string, city: string): Promise<string | null> {
  if (!PERPLEXITY_API_KEY) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [{
          role: "user",
          content:
            `What is the current street address of "${name}", an arts/acting school in ${city}, Illinois? ` +
            `Respond with ONLY a JSON object, no prose: ` +
            `{"street_address": "<number street, unit if any>", "confidence": "high"|"medium"|"low"} ` +
            `If you cannot find it, respond {"street_address": null, "confidence": "low"}.`,
        }],
        max_tokens: 200,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = repairJson(data.choices?.[0]?.message?.content ?? "");   // repairJson already exists
    const addr = (parsed as { street_address?: unknown })?.street_address;
    if (typeof addr !== "string" || addr.length < 6) return null;

    // Lenient validation — NOT the address regex (that is bug B3):
    // must start with a street number; append the city if Perplexity omitted it.
    if (!/^\d{1,6}\s+\S/.test(addr.trim())) return null;
    const withCity = new RegExp(`\\b${city}\\b`, "i").test(addr) ? addr.trim() : `${addr.trim()}, ${city}, IL`;
    return withCity;
  } catch { return null; }
  finally { await delay(1100); }
}
```

Hallucination containment: the returned string is **not** written anywhere directly. It must (a) geocode successfully through the §3.1 resolver chain and (b) pass the §3.2 guard. A made-up address that doesn't exist fails (a); a vague one that resolves to the city center fails (b). Cost: one sonar call (~fractions of a cent) per school that reaches step 3.

### 3.6 The new `geocodeSchool` cascade — `school-discovery/index.ts` (`gv2-cascade`)

```ts
async function geocodeSchool(
  name: string, websiteUrl: string, knownAddress?: string | null, city = "Chicago",
): Promise<{ lat: number; lng: number; address: string | null; source: string }> {

  // 1) Address we already hold (crawl-extracted school_address, or discovery-provided)
  if (knownAddress) {
    const geo = await resolveCoordinates(knownAddress, city);
    if (geo) return { lat: geo.lat, lng: geo.lng, address: knownAddress, source: `known_address:${geo.provider}` };
  }

  // 2) The school's own website (tag-stripped footer/contact regex — B2 fixed)
  const siteAddr = websiteUrl ? await extractAddressFromSite(websiteUrl, city) : null;
  if (siteAddr) {
    const geo = await resolveCoordinates(siteAddr, city);
    if (geo) return { lat: geo.lat, lng: geo.lng, address: siteAddr, source: `website:${geo.provider}` };
  }

  // 3) PERPLEXITY — web-searches the address, validated by geocoding + guard (B3 fixed)
  const pplxAddr = await perplexityFindAddress(name, city);
  if (pplxAddr) {
    const geo = await resolveCoordinates(pplxAddr, city);
    if (geo) return { lat: geo.lat, lng: geo.lng, address: pplxAddr, source: `perplexity:${geo.provider}` };
  }

  // 4) Business-name search: Google Places if keyed, else Mapbox POI. NEVER Nominatim-by-name.
  const biz = await geocodeBusinessByName(name, city);
  if (biz) return { lat: biz.lat, lng: biz.lng, address: biz.address, source: biz.provider };

  // 5) Honest failure — MapView's filter hides default-coordinate schools by design.
  return { lat: 41.8781, lng: -87.6298, address: null, source: "default" };
}
```

The `name_lookup` step (bare `geocode("<name>, Chicago, IL")`) is **deleted, not reordered** — with Nominatim it is exactly bug B1, and with Google/Mapbox it is redundant with step 4. The `source` strings now carry provenance (`website:mapbox`, `perplexity:nominatim`, …) for free observability in the backfill response and logs.

---

## Section 4 — Repairing the Damage & Closing the Side Doors

### 4.1 Backfill: safe selection + centroid rescue (`gv2-backfill`) — fixes B5

**Do not run the current backfill again before this lands.** Changes to the `geocode-backfill` action in `school-discovery/index.ts`:

1. **Coordinate-targeted selection** — only rows that are actually broken. Replace the `.or(...)` (whose `geocode_status.is.null` arm sweeps in healthy legacy venues) with:

```ts
const { data: stuckVenues } = await supabase
  .from("venues")
  .select("id, name, website_url, calendar_url, address, latitude, longitude, geocode_status")
  .eq("venue_type", "school")
  .or([
    "latitude.is.null",
    "and(latitude.eq.41.8781,longitude.eq.-87.6298)",          // default fallback
    "and(latitude.eq.41.8755616,longitude.eq.-87.6244212)",    // ← the centroid pile: Green Shirt,
  ].join(","))                                                  //   Farwell, and possibly ASC
  .limit(limit);
```

2. **Guard before every write**: `if (geoResult.source !== "default" && !isBadCoordinate(geoResult.lat, geoResult.lng)) { …update… } else { …stamp geocode_status='default'… }`. A healthy row can now never be degraded, because healthy rows are never selected *and* junk results are never written.
3. Optional `body.names: string[]` filter for targeted re-runs (`{"action":"geocode-backfill","names":["Acting Studio Chicago"]}`) — useful for verification without touching the fleet.
4. Response unchanged (`{ processed, fixed, still_default }`) plus per-row `source` so the log shows *which provider* fixed each school.

### 4.2 Consolidate class-discovery onto the shared path (`gv2-consolidate`) — fixes B6

In `supabase/functions/class-discovery/index.ts`:

- **Delete** its local `geocodeSchool`, `extractAddressFromUrl`, and its private copy of the Perplexity address block (the one with the old suffix-required regex — bug B3's second head).
- Import `geocodeSchool` from the shared module (move the §3.6 implementation into `_shared/geocoder.ts` or a new `_shared/geocode-school.ts` so both functions use one cascade).
- The auto-geocode block inside the `start` action (selects schools at exactly the default coords and re-geocodes them) either **routes through the shared cascade + guard** or is deleted in favor of calling the backfill action — implementer's choice; the requirement is that no code path can still reach Nominatim-by-name.

### 4.3 Crawl completion hook + scrape-ingest (`gv2-completion-hook`)

Wherever `crawl_state.school_address` is consumed on completion (in `executeClassStrategy`'s completion path, and in `scrape-ingest` for Scout results):

- Route through `resolveCoordinates(school_address, city)`; apply `isBadCoordinate` before writing.
- Write **both** `venues` and `schools` (`latitude`, `longitude`, `address`), `geocode_source = 'llm_extracted:' + provider`, `geocode_status = 'ok'`.
- Precedence rule: never overwrite coordinates whose existing `geocode_source` starts with `llm_extracted` or `website` with a result from a weaker finder (`perplexity`, business search). Null/default/centroid coords are always overwritable.

---

## Section 5 — Secrets & Setup (`gv2-secrets`)

| Secret | Required? | How to set | Notes |
|---|---|---|---|
| `MAPBOX_TOKEN` | **Yes (this spec's one setup step)** | `supabase secrets set MAPBOX_TOKEN=<value of VITE_MAPBOX_TOKEN>` | Same token the map already ships to every browser — adding it as a server secret exposes nothing new. Free tier: 100k geocodes/month; AOA's usage is a rounding error. **Caveat:** if the token was created with URL restrictions, server-side calls return 403 — in that case mint a second token in the Mapbox dashboard with no URL restriction, scope "geocoding", and use that value here |
| `PERPLEXITY_API_KEY` | Already set | — | Used by discovery today; §3.5 reuses it |
| `GOOGLE_PLACES_API_KEY` | **No** | (only if ever desired) | Purely optional accuracy upgrade (~$5/1000). If set later, it becomes the top provider in both chains with **zero code changes** — that is the point of the chain design. Skip it for now |

Verification: `supabase secrets list --project-ref rytjrterecygirttvtdn` should show `MAPBOX_TOKEN` and `PERPLEXITY_API_KEY` before deploying.

---

## Section 6 — Tests & Acceptance (`gv2-acceptance`)

**Unit-style fixtures** (pure functions; assert in a test file or a `deno test`):

| # | Input | Through | Must |
|---|---|---|---|
| T1 | `"10 W Hubbard Suite 2E, Chicago, IL 60654"` | `resolveCoordinates` | Return ≈ (41.889–41.891, −87.630…−87.627) — River North — from whichever provider is configured; never null with Mapbox token set |
| T2 | HTML fragment `...<p>10 W Hubbard Suite 2E<br>Chicago, IL 60654</p>...` | `htmlToText` + `buildAddressRegex("Chicago")` | Match `"10 W Hubbard Suite 2E"` (B2) |
| T3 | `"Acting Studio Chicago, Chicago, IL"` | `geocodeNominatimHardened` | Return **null** (addresstype rejection), not the centroid (B1) |
| T4 | (41.8755616, −87.6244212) and (41.8781, −87.6298) and (41.87551, −87.62441) | `isBadCoordinate` | All true |
| T5 | Perplexity reply `{"street_address":"10 W Hubbard Suite 2E","confidence":"high"}` | `perplexityFindAddress` parsing | Return `"10 W Hubbard Suite 2E, Chicago, IL"` — not discarded (B3) |
| T6 | Perplexity reply `{"street_address":"the school is located downtown","confidence":"low"}` | same | Return null (no leading street number) |
| T7 | `"4753 N Broadway, Chicago"` and `"1350 N Wells St, Chicago"` | regex + resolver | Both match and resolve (regression guard for the suffix-optional regex) |

**Live acceptance (run in order):**

1. Deploy; run `{"action":"geocode-backfill","names":["Acting Studio Chicago"]}`. Response shows `fixed: 1` with a real `source` (e.g. `website:mapbox` or `perplexity:mapbox`).
2. `venues?name=ilike.*acting+studio+chicago*&select=name,latitude,longitude,address,geocode_source,geocode_status` → coords ≈ (41.890, −87.628), `address` populated, `status ok`. Same check on `schools`.
3. Full backfill run. Then: `venues?latitude=eq.41.8755616&venue_type=eq.school&select=name` → **0 rows** (Green Shirt and Farwell rescued off the pile to their real, distinct locations); `venues?latitude=eq.41.8781&longitude=eq.-87.6298&select=name` → 0 rows or only rows honestly stamped `geocode_status='default'` and listed in `still_default`.
4. Browser: map in **classes mode** (markers only render there — `MapView` early-returns in shows mode) shows ASC at Hubbard & State-ish, Green Shirt and Farwell at their own distinct pins, no stack of markers near the Loop centroid.
5. Regression: re-run the class scraper `start` action for one school → no row anywhere acquires centroid or default coords with `geocode_status='ok'` (B6 closed).

---

## Section 7 — Rollout Order (`gv2-rollout`)

1. `supabase secrets set MAPBOX_TOKEN=…` (mint an unrestricted token if the map token is URL-locked).
2. Land §3 (`geocoder.ts` chain + guard + Perplexity finder + tag-strip + new cascade) and §4 (backfill selection/guard, class-discovery consolidation, completion-hook guard) in one PR — they are interlocking; shipping the chain without the guard or the guard without the backfill fix reopens B5.
3. Run fixtures T1–T7.
4. Deploy `school-discovery` and `class-discovery`.
5. Targeted backfill on ASC (acceptance 1–2), then full backfill (acceptance 3–4), then the `start`-action regression check (acceptance 5).
6. Log follow-up: after a week of crawls, `select geocode_source, count(*) from venues where venue_type='school' group by 1` — expect `website:*` and `llm_extracted:*` to dominate, `perplexity:*` filling gaps, `default` near zero. If `default` grows for a new city, that city's `BAD_COORDS` entries and centroid probably need adding (§3.2 comment).

## Appendix — File Change Manifest

| File | Nodes | Change |
|---|---|---|
| `supabase/functions/_shared/geocoder.ts` | gv2-resolver-chain, gv2-guard, gv2-name-search | Provider chain (`resolveCoordinates`), Mapbox impls, hardened Nominatim (jsonv2 + addresstype rejection + suite-strip), `isBadCoordinate`, `geocodeBusinessByName` chain, `nameOverlap` helper; legacy `geocode()` becomes a wrapper |
| `supabase/functions/school-discovery/index.ts` | gv2-tagstrip, gv2-perplexity, gv2-cascade, gv2-backfill | `htmlToText`, `extractAddressFromSite` (contact-page fallback), `perplexityFindAddress` (JSON + lenient parse), new `geocodeSchool` cascade (name_lookup deleted), backfill selection + guard + `names` filter |
| `supabase/functions/class-discovery/index.ts` | gv2-consolidate | Delete local geocode code (old regex, old cascade, old Perplexity block); import shared cascade; `start` auto-geocode routed through shared path or removed |
| `supabase/functions/_shared/scraper/strategy-agent.ts` (completion path) + `scrape-ingest` | gv2-completion-hook | `school_address` → `resolveCoordinates` + guard + precedence rule; write both tables |
| `src/components/MapView.tsx` | — | **No changes** — both filters (default-coord skip, classes-mode gating) are correct |

— End of specification —
