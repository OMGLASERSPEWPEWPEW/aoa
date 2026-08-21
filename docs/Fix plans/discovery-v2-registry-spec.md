# Discovery v2 + v4.3 — Registry, Idempotent Discovery, Metro Guard, Honest UI

**Technical Specification for Implementation** (patch-spec; companion to scraper-v4, geocoding-v2, v4.2)

| | |
|---|---|
| **Status** | Draft for implementation |
| **Date** | 2026-08-21 |
| **Inputs** | `edge-functions-reference-2026-08-22.md` (source dump), `class-scrape-log-2026-08-22.md` (template — note its queries are pre-dated to 8/22), device screenshot (v0.22.0 header, 25 schools / 15 pins, cross-country strays) |
| **Audience** | Implementing agent (Claude Opus) in `~/Development/aoa` |
| **Node prefix** | `dv2-*` |

---

## Section 0 — Layer Map & Tier Verdict (`dv2-triage`)

The tier ladder governs **how we crawl a school once we know it**. Today's issues live before that (which schools? which URLs? where are they?) and after it (what do we display?). Verdict per reported issue:

| # | Issue | Layer | Root cause | Fixed by Tier 2/3? |
|---|---|---|---|---|
| 1 | Out-of-Chicago schools on map | Discovery + map filter | `url_status='out_of_city'` is set at crawl completion but `fetchClassMapData` never filters it; discovery admits them in the first place | **No** — §1, §3 |
| 2 | "The Lab" → Ambler PA event page; pin on a yoga studio | Discovery + geocoding | Domain-only dedupe accepted a wrong-city URL; generic-name business search matched the wrong "The Lab"; no metro guard | **No** — §1.3, §2 |
| 3 | "Cut to the Chase" festival ingested as a class | Extraction guardrail | Play-festival/production pages pass the classifier; prompt lacks an exclusion | **No** — §5 |
| 4 | "Hold a spot" implies booking we can't do | Frontend honesty | Design placeholder | **No** — §4 |
| 5 | Vagabond covers Green Shirt (same building) | Frontend rendering | No co-located marker handling | **No** — §4.3 |
| 6 | "N ENROLLING" / seat numbers look fake | Frontend honesty | Derived/placeholder values, never scraped | **No** — §4.2 |
| 7 | "The Revival" → loopchicago.com 404 | Discovery memory | Rejected URL from two runs ago re-inserted under a new row; nothing remembers rejections; loopchicago.com not blocklisted | **No** — §1 |
| 8 | Chicago Actors Studio → backstage.com listicle | Discovery validation | backstage.com not blocklisted; no identity check before insert | **No** — §1.3 |
| 9 | North-side schools missing; 15 → 18 → 25 ballooning | Discovery consistency | Each run is a fresh draw from a non-deterministic LLM into wiped data; no registry, no union semantics | **No** — §1.4 |
| — | Costs "not showing" | Audit queries | Template filters `created_at > '2026-08-22'` — run on the 21st, matches nothing. `cost_usd`/`total_cost_usd` are being written | **No** — §6 |

Tier 3's outstanding constituency remains exactly the two `seed_fetch_failed` venues from the 8/21 run. Nothing else on this list touches the tiers.

---

## Section 1 — Discovery v2: Registry + Idempotent Reconciliation (`dv2-registry`)

**Design goal:** running discovery N times in a row produces the same school set as running it once, and recall only ever increases across runs. Discovery stops being "replace with today's Perplexity draw" and becomes "reconcile candidates against a canonical registry."

### 1.1 Registry = `venues` + rejection memory (`dv2-schema`)

Migration `2026082N_discovery_v2.sql`:

```sql
alter table venues add column if not exists status text not null default 'active',
  -- 'active' | 'candidate' | 'rejected' | 'out_of_city' | 'fetch_blocked' | 'duplicate'
  add column if not exists duplicate_of uuid references venues(id),
  add column if not exists aliases jsonb not null default '[]'::jsonb,   -- ["The Revival", "The Revival Improv Theater"]
  add column if not exists verified_at timestamptz;

create table if not exists discovery_rejections (
  id uuid primary key default gen_random_uuid(),
  domain text,                      -- reject whole domain (aggregators, city guides)
  url text,                         -- or a specific URL
  school_name text,                 -- what it was proposed as
  reason text not null,             -- 'aggregator' | 'identity_mismatch' | 'not_an_organization'
                                    -- | 'out_of_city' | 'dead_url' | 'manual'
  created_at timestamptz not null default now()
);
create index if not exists discovery_rejections_domain_idx on discovery_rejections(domain);
```

Backfill existing statuses: `update venues set status='out_of_city' where url_status='out_of_city'; update venues set status='fetch_blocked' where url_status='fetch_blocked';` (keep `url_status` for crawl mechanics; `status` is the registry's word).

### 1.2 Reconciliation replaces the insert loop (`dv2-merge`)

In `school-discovery`, for each parsed candidate `{name, address, url}` the current code does *domain-check → insert*. Replace with this pipeline — **order matters**:

```
for each candidate:
  1. REJECTION MEMORY   domain or url in discovery_rejections            → log 'previously_rejected', skip
  2. AGGREGATOR LIST    isAggregatorDomain(domain)                       → log + INSERT into discovery_rejections, skip
  3. DOMAIN MATCH       domain in existingDomains                        → log 'already_known_venue', skip (today's behavior)
  4. NAME MATCH         fuzzy-match candidate name against venues.name
                        AND venues.aliases (schools of any status)       → same school:
                          - append candidate name to aliases if new
                          - if matched venue status='active': keep its URL; log 'alias_matched'
                          - if matched venue is rejected/dead-URL: treat candidate.url as a
                            REPLACEMENT candidate → run step 5 on it; on pass, update the
                            EXISTING row's URL instead of inserting a new row
                        → never insert a second row for a name match
  5. VALIDATION GATE    (§1.3) fetch + identity/locality/organization check
                          - fail → INSERT into discovery_rejections with reason, skip
  6. GEOCODE + INSERT   geocodeSchool(...) with metro guard (§2); insert venue status='active'
                        + schools row (existing code), log 'inserted'
```

**Name matching (step 4):** reuse/extend `_shared/scraper/venue-name-matcher.ts` (it exists; discovery doesn't use it). Normalization: lowercase → strip punctuation → drop leading articles (`the/a/an`) → drop generic suffix tokens (`theater, theatre, studio, school, center, chicago, improv, comedy, acting`) → compare remaining token sets; match at Jaccard ≥ 0.6 **or** normalized-string Levenshtein ratio ≥ 0.85. "The Revival" vs "The Revival Improv Theater" → tokens {revival} vs {revival} → match. "Chris Thatcher" vs anything → no match → proceeds to the gate, which kills it (§1.3).

### 1.3 Validation gate before any insert (`dv2-gate`)

New candidates cost 1 fetch + 1 cheap LLM call — the same recon identity check the crawler already runs, moved to where it prevents damage instead of discovering it later:

1. **Blocklist expansion** (immediate, in `AGGREGATOR_DOMAINS`): add `loopchicago.com`, `backstage.com`, `chicagoreader.com`, `tripadvisor.com`, `wikipedia.org`, `instagram.com`, `linkedin.com`, `tiktok.com`, `youtube.com`, `x.com`, `twitter.com`, `patch.com`, `nextdoor.com`, `google.com`, `maps.google.com`, `reddit.com`. (loopchicago and backstage have each burned a run.)
2. **Fetch the candidate URL once** (politeFetch, UA, 8s). Dead/403 → rejection `dead_url` (memory means Perplexity can't re-propose it next run).
3. **Identity + locality + organization check** — extend the existing recon prompt with one question and reuse it verbatim otherwise:

```
Is this page the official website of "{name}", an organization offering
in-person adult classes in {city}? Answer mismatch if: the page is an article,
directory, or city guide ABOUT such organizations; the organization is based in
a different city; or "{name}" appears to be a person rather than an organization.
Respond only: {"identity":"match"|"mismatch"|"uncertain","confidence":0-1,"reason":"<10 words"}
```

   `mismatch ≥ 0.7` → rejection row (`identity_mismatch` / `not_an_organization` / `out_of_city` per reason), no insert, no pin. This is what stops Chris Thatcher, the backstage listicle, and the Ambler "The Lab" at the door. `uncertain` → insert with `status='candidate'` — crawled normally, **not shown on the map** until a successful crawl promotes it to `active` (promotion happens in `class-scrape-batch` on first completion with ≥1 program and no identity failure).

### 1.4 Consistency semantics (`dv2-consistency`)

- **Never wipe.** Retire the wipe-and-rediscover workflow; the registry is the durable asset. A "reset" during development means truncating `class_sessions`/`crawl_state`, never `venues`/`schools`/`discovery_rejections`.
- **Union across runs.** A discovery run can add, alias, or upgrade — it can never remove. Removal is manual (admin sets `status`).
- **Recall via sliced prompts, not re-rolls.** Add region-sliced variants of the three existing prompts (append: `Focus on the North Side: Andersonville, Uptown, Lakeview, Lincoln Square, Rogers Park, Edgewater.` / `Focus on the West and South Sides: Logan Square, Wicker Park, Pilsen, Hyde Park, Bridgeport.`). Six prompts total, all run every time; Perplexity's per-call variance stops mattering because the registry accumulates.
- **Restore the lost north-siders now:** the 8/21 run log lists the 18-school set; any of those missing from today's registry get re-inserted from that log (one-time script or manual admin add), bypassing the gate (they already passed a crawl).
- **Reconciliation report:** discovery's response body becomes `{ inserted: [...], alias_matched: [...], rejected: [{name, reason}], already_known: n }` and is rendered in the admin dashboard — every run explains itself.

### 1.5 One-time cleanup of the current 25 (`dv2-cleanup`)

Reconcile the live table in this order: (a) mark the loopchicago "Revival" row `duplicate` → `duplicate_of` the-revival.com row; (b) reject + remember the backstage "Chicago Actors Studio" row (the real chicagoactorsstudio.com row stays `fetch_blocked`); (c) reject "Chris Thatcher" (`not_an_organization`); (d) mark All Out Comedy + Third Coast `out_of_city` (v4.2 A4 carryover) and delete their sessions; (e) resolve "The Lab": reject the Ambler URL, re-gate the real Chicago improv venue (`thelab-chicago.com` or per search) as a fresh candidate; (f) re-insert any 8/21 schools now missing. Deliver as a `{"action":"reconcile-registry"}` admin action or a documented one-time script — implementer's choice, but it must write `discovery_rejections` rows so the cleanup is permanent.

---

## Section 2 — Metro-Radius Geocode Guard (`dv2-metro-guard`)

Black Box pinned near the Great Lakes' far north, "The Chicago AC" on the east coast, The Lab on a yoga studio — nothing rejects a geocode result hundreds of miles from the target city. Add to `_shared/geocoder.ts`:

```ts
const METRO_CENTERS: Record<string, { lat: number; lng: number; radiusKm: number }> = {
  chicago: { lat: 41.8781, lng: -87.6298, radiusKm: 40 },   // covers Evanston/Oak Park/near burbs
};

export function isOutsideMetro(lat: number, lng: number, city = "Chicago"): boolean {
  const m = METRO_CENTERS[city.toLowerCase()];
  if (!m) return false;
  return haversineKm(lat, lng, m.lat, m.lng) > m.radiusKm;   // hoist haversine from ClassSheet into a shared util
}
```

Enforcement points — a result failing the guard is a **miss** (continue the cascade), identical to `isBadCoordinate`:
1. Inside `resolveCoordinates` after each provider (alongside the bad-coordinate check).
2. Inside `geocodeBusinessByName` (both Places and Mapbox POI branches) — this is what stops a generic name like "The Lab" from matching Ambler, PA. Same-metro wrong-POI (the yoga studio) remains possible; mitigations already in place are address-first ordering and the name-overlap ≥ 0.5 check — the residual risk is accepted and made visible by the pin ledger (§3.2).
3. In `processClassPrograms`' address hook and the backfill before any write.

Multi-city note: when NYC/LA launch, they add one `METRO_CENTERS` row each — the guard is data, not code.

---

## Section 3 — Map Truthfulness (`dv2-map`)

### 3.1 Filter quarantined schools (`dv2-map-filter`)
`fetchClassMapData` (and any schools query feeding markers) adds: exclude venues/schools whose registry `status ∈ {rejected, out_of_city, fetch_blocked, duplicate, candidate}`. Simplest join-free path: mirror `status` onto `schools` in the same write that sets it on `venues` (both writers: discovery gate, crawl completion, reconcile action). The existing default-coordinates filter stays. This removes Oakland from the map today.

### 3.2 Pin ledger — every school explains itself (`dv2-ledger`)
Admin panel addition (extend the existing scrape dashboard): a table of **all** schools with a computed disposition so "25 schools, 15 pins" is never a mystery again:

| Disposition | Rule |
|---|---|
| `SHOWN` | status=active, coords pass filters |
| `HIDDEN · unresolved geocode` | default coords / `geocode_status='default'` |
| `HIDDEN · out of city` | status=out_of_city |
| `HIDDEN · blocked site` | status=fetch_blocked |
| `MERGED` | status=duplicate (→ shows canonical name) |
| `PENDING · candidate` | status=candidate, awaiting first successful crawl |
| `REJECTED` | status=rejected (+ reason from discovery_rejections) |

Implementation: one query over venues+schools, computed client-side; counts render as the header (`25 in registry · 15 shown · 4 hidden · 3 rejected · 2 merged · 1 pending`).

---

## Section 4 — Sheet & Marker Honesty (`dv2-sheet`)

### 4.1 Kill implied-booking language (`dv2-sheet-cta`)
`ClassSheet.tsx`: remove the `Hold a spot / Just show up / Join the waitlist` primary button. Replace with a single primary action rendered only when a URL exists: `SIGN UP ↗` (filled `--dc`, opens `session.signup_url ?? session.source_url ?? school.url` in a new tab). No URL → no primary button; THE CLASSES rows remain the per-class links. AOA never implies it can reserve anything.

### 4.2 Remove fabricated numbers (`dv2-sheet-numbers`)
Delete: the seats line (`12 OF 16 TAKEN` — never scraped, pure placeholder) and the `N ENROLLING` count. For the record, `N ENROLLING` was computed as `sessions.filter(isEnrolling).length` — real code over shaky inputs (date-inferred `starts_on`, `status='unknown'` defaults), which is why it reads as fake. Policy going forward: **the sheet displays only extraction truth** — `FULL` / `WAITLIST OPEN` chips when `section_status` says so, dates/prices/instructors as scraped, nothing derived-and-numeric. `WALK-INS WELCOME` renders only when `drop_in=true` came from extraction.

### 4.3 Co-located marker fan-out (`dv2-markers`)
Vagabond and Green Shirt share a building; the later marker fully covers the earlier. In the marker layer (MapView/ClassMarker): group schools by coordinate key `(lat.toFixed(4), lng.toFixed(4))` (~11m). Groups of n>1 get deterministic radial pixel offsets applied to the marker element (not the data): `angle = 2π·i/n`, radius 16px — both markers visible and tappable at every zoom; single-school keys render exactly as today. (The ui-designer journal's zoom<12 clustering remains a separate future item; this is the minimal same-building fix.)

---

## Section 5 — Extraction Guardrail: Productions Are Not Classes (`dv2-productions`)

"Cut to the Chase" (The Artistic Home) is a festival of plays, ingested as a class program. Three-line defense:

1. **Classifier**: add `production_or_festival` to the page-kind enum — *"a theatrical production, play, festival, or show page: cast lists, 'directed by', performance dates, ticket links"* — routed like `blog_or_news` (no extraction, no link harvest).
2. **Extraction prompt**: add to Rules: *"Theatrical productions, plays, festivals, showcases, and performances are NOT classes. If the page describes something people watch rather than something people enroll in and attend weekly, extract nothing from it."*
3. **Frontier scorer**: add to the zero-value list: `productions, shows, festival pages, season announcements, 'program' pages that are playbills`.

Cleanup: delete `class_sessions` rows for The Artistic Home whose titles match its production names (`Cut to the Chase%`, `Hedda Gabler%`, `Eurydice%`, `The Pavilion%`, …) — or simpler, purge all Artistic Home sessions and let the next crawl repopulate under the new rules.

---

## Section 6 — Cost Bookkeeping Cleanup (`dv2-costs`)

Costs are recorded; the audit couldn't see them:

1. **The date bug**: the log template's every query filters `created_at > '2026-08-22'` — generated with tomorrow's date, run on the 21st, matches nothing. Fix the template generator to use the actual run date (`>= current_date` or an injected `{{RUN_DATE}}`), and rename the file to match. Re-run today's queries with `>= '2026-08-21'` — `cost_usd` and `total_cost_usd` will populate.
2. **Garbled fields** in the `scrape_logs` insert (`class-scrape-batch`): `duration_ms: Math.round((trace.budgetUsed ?? 0) * 1000)` stores *dollars × 1000* — thread real wall time (add `wallMs` to the trace where the invocation timer already exists) or write `null`; `ai_input_tokens: trace.totalAiCalls` stores a *call count* as tokens — write real token sums if `recordAiCall` receives them, else `null`. Never repurpose a column; `cost_usd` stays as-is (correct).
3. **Frontend**: confirm the dashboard footer renders `$ {total_cost_usd}` (v4.2 §6.3); the screenshot header showing `v0.22.0` against a v0.23.0 deploy suggests a stale frontend build — redeploy before judging any UI-side verification.

---

## Section 7 — Acceptance Criteria (`dv2-acceptance`)

| # | Check | Pass condition |
|---|---|---|
| A1 | **Idempotence** — run discovery 3× consecutively | Runs 2 and 3 insert 0 new venues; reconciliation report shows only `already_known` / `alias_matched`; registry count stable |
| A2 | Rejection memory | loopchicago.com, backstage.com, and the Ambler Lab URL each have `discovery_rejections` rows; re-running discovery never re-inserts them |
| A3 | Registry cleanup | "Chris Thatcher" rejected; single Revival row (the-revival.com); Oakland + Nashville `out_of_city`; 8/21's 18-school set fully present as `active` or explained in the ledger |
| A4 | Metro guard | Zero `active` schools with coords >40km from Chicago center; Black Box back at 2625 W North Ave; "Chicago AC" east-coast pin gone |
| A5 | Map | Classes mode shows only `active` schools; Oakland pin gone; ledger counts sum to registry total; ledger explains every non-shown school |
| A6 | Markers | Vagabond and Green Shirt both visible and individually tappable at default zoom |
| A7 | Sheet | No "Hold a spot"; `SIGN UP ↗` opens the class page; no seat counts; no ENROLLING number; FULL/WAITLIST chips only when scraped |
| A8 | Productions | Artistic Home shows zero play-titled sessions after re-crawl; classifier logs `production_or_festival` for its playbill pages |
| A9 | Costs | Queries with `>= current_date` return rows with non-zero `cost_usd`; `scrape_jobs.total_cost_usd ≈ Σ cost_usd` (±rounding); no dollars-as-duration rows created after deploy |
| A10 | Regression | Crawl pipeline untouched: re-run ASC warm start → `profileUsed: true`, sessions persist, pin stays at 10 W Hubbard |

## Appendix — File Change Manifest

| File | Nodes | Change |
|---|---|---|
| `supabase/migrations/2026082N_discovery_v2.sql` | dv2-schema | venues.status/duplicate_of/aliases/verified_at; `discovery_rejections`; status backfill |
| `supabase/functions/school-discovery/index.ts` | dv2-merge, dv2-gate, dv2-consistency, dv2-cleanup | Reconciliation pipeline replaces insert loop; blocklist expansion; gate (fetch + identity/locality/organization); sliced prompts; reconciliation report; `reconcile-registry` action |
| `supabase/functions/_shared/scraper/venue-name-matcher.ts` | dv2-merge | Normalization + fuzzy match exposed for discovery use |
| `supabase/functions/_shared/geocoder.ts` | dv2-metro-guard | `METRO_CENTERS`, `isOutsideMetro`, shared haversine; enforcement in resolver + name search |
| `supabase/functions/_shared/scraper/process-venue.ts` | dv2-metro-guard | Guard in address hook; status mirroring on promotion |
| `supabase/functions/class-scrape-batch/index.ts` | dv2-gate, dv2-costs | Candidate→active promotion on first successful crawl; duration/token field fixes |
| `supabase/functions/_shared/scraper/page-classifier.ts`, `extraction-prompt.ts`, `link-extractor.ts` | dv2-productions | production_or_festival kind; prompt exclusion; frontier zero-value additions |
| `src/lib/classData.ts` | dv2-map-filter | Exclude non-active statuses |
| `src/components/MapView.tsx` / `ClassMarker.ts` | dv2-markers | Co-located radial fan-out |
| `src/components/ClassSheet.tsx` | dv2-sheet-cta, dv2-sheet-numbers | SIGN UP ↗; remove seat/enrolling numbers |
| Admin dashboard component | dv2-ledger | Pin ledger table + reconciliation report rendering |
| Log template generator | dv2-costs | `{{RUN_DATE}}` injection |

— End of specification —
