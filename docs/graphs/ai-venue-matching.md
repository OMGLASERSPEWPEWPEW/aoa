# Graph Engineering: AI-Powered Venue Matching + Trainable Logs

**Version:** 1.0.0
**Generated:** 2026-08-12
**Nodes:** 6 | **Phases:** 3 | **Loop specs:** 1

---

## Section 1: Task Graph Topology

### Nodes
```
FOUNDATION:  avm-migration
FIXES:       avm-pagination, avm-company-split
INTELLIGENCE: avm-ai-judgment, avm-known-pairs, avm-integration
```

### Edges
```
avm-migration → avm-ai-judgment → avm-integration
avm-migration → avm-known-pairs → avm-integration
avm-pagination → avm-integration
avm-company-split → avm-integration
```

---

## Section 2: Node Specifications

#### Node: avm-migration
- **Type**: migration
- **Depends on**: (none)
- **Outputs**: `supabase/migrations/20260812000009_match_decisions.sql`
- **Loop pattern**: one-shot
- **Success criteria**: `supabase db push` succeeds, table exists
- **Estimated effort**: Trivial

```sql
CREATE TABLE public.match_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  our_venue_name text NOT NULL,
  our_venue_id uuid REFERENCES venues(id),
  external_venue_name text NOT NULL,
  source text NOT NULL,
  heuristic_score numeric(4,3),
  ai_verdict boolean,
  ai_confidence numeric(3,2),
  final_decision text NOT NULL CHECK (final_decision IN ('matched', 'rejected', 'ai_matched', 'ai_rejected')),
  human_override boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_match_decisions_pair ON match_decisions(our_venue_name, external_venue_name, source);
ALTER TABLE match_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read match decisions" ON match_decisions FOR SELECT USING (true);
CREATE POLICY "Service role can insert match decisions" ON match_decisions FOR INSERT WITH CHECK (true);
```

#### Node: avm-pagination
- **Type**: feature
- **Depends on**: (none)
- **Outputs**: `supabase/functions/_shared/scraper/tic-lookup.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `getComingSoon()` returns ~90 shows, `getNowPlaying()` returns ~24 shows
- **Estimated effort**: Small

Replace the single-page fetch in `getComingSoon()` and `getNowPlaying()` with a pagination loop:

```typescript
async function fetchAllPages(baseUrl: string, pageParam: string, totalParam: string): Promise<string> {
  const page0Html = await fetchTicPage(baseUrl);
  // Extract total from pagination: totalRows_rsComingSoon=90
  const totalMatch = page0Html.match(new RegExp(`${totalParam}=(\\d+)`));
  const total = totalMatch ? parseInt(totalMatch[1]) : 0;
  const pageCount = Math.ceil(total / 16);
  
  let allHtml = page0Html;
  for (let i = 1; i < pageCount; i++) {
    await new Promise(r => setTimeout(r, 500)); // polite delay
    const pageHtml = await fetchTicPage(`${baseUrl}?${pageParam}=${i}&${totalParam}=${total}`);
    allHtml += pageHtml;
  }
  return allHtml;
}
```

#### Node: avm-company-split
- **Type**: feature
- **Depends on**: (none)
- **Outputs**: `supabase/functions/_shared/scraper/venue-name-matcher.ts`
- **Loop pattern**: one-shot
- **Success criteria**: "Music Theater Works at North Shore Center" matches "North Shore Center for the Performing Arts"
- **Estimated effort**: Trivial

In `matchVenueName`, after the initial score calculation, if score < 0.6 and the TIC name contains " at ", try matching just the venue part:

```typescript
if (score < 0.6) {
  const atIdx = ticName.toLowerCase().indexOf(' at ');
  if (atIdx > 0) {
    const venuePart = ticName.slice(atIdx + 4);
    const venueScore = matchVenueName(ourName, venuePart);
    if (venueScore > score) score = venueScore;
  }
}
```

#### Node: avm-ai-judgment
- **Type**: feature
- **Depends on**: avm-migration
- **Outputs**: `supabase/functions/_shared/scraper/venue-name-matcher.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Ambiguous pairs (0.3-0.6 score) get AI verdict, logged to match_decisions
- **Estimated effort**: Small

```typescript
export async function aiMatchVenues(
  pairs: Array<{ ourName: string; ourId: string; ticName: string; heuristicScore: number }>,
  supabase: SupabaseClient,
): Promise<Map<string, boolean>>
```

Batches all ambiguous pairs into one DeepSeek Flash call. Logs each verdict to `match_decisions`.

#### Node: avm-known-pairs
- **Type**: feature
- **Depends on**: avm-migration
- **Outputs**: `supabase/functions/_shared/scraper/venue-name-matcher.ts`
- **Loop pattern**: one-shot
- **Success criteria**: Previously-decided pairs skip heuristic + AI matching
- **Estimated effort**: Trivial

```typescript
export async function lookupKnownPair(
  ourName: string, externalName: string, source: string, supabase: SupabaseClient,
): Promise<{ matched: boolean } | null>
```

#### Node: avm-integration
- **Type**: feature
- **Depends on**: avm-pagination, avm-company-split, avm-ai-judgment, avm-known-pairs
- **Outputs**: `supabase/functions/_shared/scraper/tic-lookup.ts`, `supabase/functions/tic-crossref/index.ts`
- **Loop pattern**: plan-execute-verify
- **Success criteria**: TIC cross-reference matches 30+ events. Match decisions logged. Known pairs cached.
- **Estimated effort**: Small

Wire the improved matching into `lookupVenueOnTic` and `tic-crossref`:
1. Check known-pairs cache first
2. Run heuristic with company-split
3. Batch ambiguous pairs for AI judgment
4. Log all decisions

---

## Section 3: Loop Specifications

### Loop: avm-integration
- **Trigger**: All dependency nodes complete
- **Inner cycle**:
  1. Plan: Read tic-lookup.ts and tic-crossref/index.ts, identify matching call sites
  2. Execute: Wire up known-pair check → heuristic with company-split → AI for ambiguous → log decision
  3. Verify: Run tic-crossref via curl. Check match_decisions table for logged decisions. Check events table for newly-filled dates.
- **Evaluator**: 30+ events get TIC dates (up from 7). match_decisions has entries. Known pairs skip AI on re-run.
- **Retry**: Fix matching threshold or AI prompt (max 2 cycles)
- **Stop condition**: TIC cross-reference fills 30+ NULL dates

---

## Section 5: Build Phases

### Phase 1: Foundation (parallel)
- [ ] avm-migration
- [ ] avm-pagination
- [ ] avm-company-split

### Phase 2: Intelligence (parallel)
- [ ] avm-ai-judgment
- [ ] avm-known-pairs

### Phase 3: Integration
- [ ] avm-integration

---

## File Index

| File | Node | Action |
|------|------|--------|
| `supabase/migrations/20260812000009_match_decisions.sql` | avm-migration | Create |
| `supabase/functions/_shared/scraper/tic-lookup.ts` | avm-pagination, avm-integration | Modify |
| `supabase/functions/_shared/scraper/venue-name-matcher.ts` | avm-company-split, avm-ai-judgment, avm-known-pairs | Modify |
| `supabase/functions/_shared/scraper/tic-parser.ts` | avm-pagination | Modify (extract totalRows) |
| `supabase/functions/tic-crossref/index.ts` | avm-integration | Modify |
