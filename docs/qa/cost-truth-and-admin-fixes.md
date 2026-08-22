# QA: Cost Truth + Admin Coverage Remediation (F91)

**Date:** 2026-08-21 · **Entry:** `/app/admin` (admin account) · DevTools at 390×844
**Graph:** `docs/graphs/cost-truth-and-admin-fixes.md` · Run §A at v0.28.0 close, §B at v0.29.0 close — **against the deployed build** (`vercel --prod` first; header meta line shows the new version).

## §A — Cost truth (v0.28.0)

Precondition: run one class curation (any school) and one venue curation after deploy.

- [ ] `ai_usage` has fresh `feature = 'class-curation'` rows with `model` ∈ {gpt-4o-mini, deepseek-chat}, `estimated_cost_usd > 0`, and `metadata.venue_id` set (service-role REST probe)
- [ ] Admin → Costs → TODAY: **By feature** lists `class-curation`; the total moved after the run
- [ ] By-model breakdown shows the real model, priced per `MODEL_PRICING` (spot-check: a gpt-4o-mini row's cost ≈ tokens × 0.15/0.60 per 1M, not 0.10/0.40)
- [ ] Curation dashboard rows show the stats line again: `{n} programs · {a} AI calls · {p} pages · $0.0xxx · {stop}` <!-- qa:human -->
- [ ] Dashboard footer shows `· $X.XXXX` after the run (`scrape_jobs.total_cost_usd` > 0)
- [ ] `scrape_jobs.total_cost_usd` ≈ sum of that job's `ai_usage` class-curation costs (small drift from rounding only — a large gap means a call site missed the sink)
- [ ] Latest **show** `scrape_logs` row has non-null `cost_usd`, `fetches`, `pages_visited`
- [ ] `event-scraper-extract` / `-verify` / `-follow` features still appear once per step (no double logging from the v3 path)
- [ ] §7 census table lists every `rg "recordAiCall\("` hit with model threaded ✓ or n-a

## §B — Admin coverage remediation (v0.29.0)

### Diagnoses & 6a
- [ ] Seed `site_profiles.consecutive_failures = 3` on a live venue's domain → its audit row shows `DEAD SITE ×3` in danger; unseed after
- [ ] A storefront-typed venue named like an institution with 0 events shows `MISTYPED · SHOULD BE INSTITUTIONAL`; an **institutional**-typed college venue does NOT
- [ ] `TYPE · HOOD` lead + source + diagnosis render exactly once per row (no duplicated segments)
- [ ] Theaters panel: exactly four work buttons, two weights (`Find venues` / `Curate shows` primary); no fifth button anywhere; running state disables at reduced opacity with the existing running label
- [ ] All four buttons fire the same pipeline actions as before the redesign (discovery runs, curation runs, backfill runs, QUEUE opens the dashboard)
- [ ] NEEDS A LOOK tiles render `0 EVENTS / NO CAL / NO PHOTO / BLOCKED` from the RPC (not client subtraction); tapping filters the list; active tile gets its border + tint; `BLOCKED` opens the BlockedList
- [ ] List header names the active filter in its color with `TAP FOR WHY` right-aligned; no "Venue Audit (n)" heading remains
- [ ] Legacy `CLASS COVERAGE` 4-stat row and scaffold `BLOCKED (n)` button are gone from the theaters panel; only one `get_class_coverage_metrics` fetch exists (network tab)
- [ ] Lists render all rows (no silent 30-row cap); scroller fits: `scrollHeight - clientHeight === 0` at 390×844, both panels, both themes <!-- qa:human -->

### Blocking
- [ ] Block a school at **entry** scope from the UI → anon REST: the school → `[]`, its `class_sessions` → `[]`; class map loses the pin without reload
- [ ] The consequence sentence for a 0-class school reads `drops 0 classes` (never omitted); school blocks say *classes*, venue blocks say *events*
- [ ] Entry-block two different venues on the **same** domain → both succeed (two BLOCKED rows)
- [ ] Then domain-block that domain → succeeds; repeating it errors `domain already blocked`; re-entry-blocking an already-blocked entry errors `entry already blocked`
- [ ] UNBLOCK each row individually restores exactly its scope (entity returns when its entry row is deleted and no domain row remains)
- [ ] Discovery still rejects a blocked domain and counts it into the ribbon's `blocked` total (regression)

### 6b & row actions
- [ ] With `session_count = 0`: dry card shows `THE PIPELINE IS DRY` label, pulsing dot (static under reduced-motion emulation), spec copy with *curated* wording, full-width danger `Curate all {n} schools` — **and** the DisciplineBar still renders <!-- qa:human motion -->
- [ ] With sessions: DisciplineBar + ClassFieldTiles occupy the slot; no dry card
- [ ] School rows show glyph in discipline hue + `{HOOD} · {price_band} · {n} CLASSES`; aggregator-diagnosed rows show `BLOCK` instead of `CURATE`
- [ ] Row `CURATE` starts a job with `total_venues = 1` for exactly that school (network tab shows `venue_id` in the start body); dashboard tracks the single school across invocations
- [ ] If DG-2 approved venue ↻: it targets one venue the same way; if declined, §7 carries the gap note

### Regressions
- [ ] Field overrides still save/release; held fields still survive a curation run (spot-check one)
- [ ] `rg -i 'scrap' src/ --glob '!*.test.*'` → identifiers only (copy sweep intact)
- [ ] Both changelog entries render in-app; header meta shows `v0.29.0`
