# PRD: Play Catalog Backfill

**Feature:** Backfill button in admin dashboard + Edge Function to process all unlinked events
**Priority:** P0
**Size:** Small (< 1 day)
**Date:** 2026-08-14
**Dependencies:** play-matcher.ts (shipped), play catalog seed (shipped, 177 plays)

---

## 1. Problem

177 plays are in the catalog. The play-matcher runs on NEW scraper events automatically. But ~1000 events scraped BEFORE the matcher was deployed still have `play_id = NULL`. There's no way to trigger the matcher against them. The admin needs a button.

## 2. Solution

1. **Edge Function** `play-catalog-backfill` — queries events with null play_id, runs `runPlayMatcherBatch`
2. **Admin button** in the Coverage tab of Docs.tsx — triggers the backfill, shows results

## 3. External Source Research

**What exists for play data:**

| Source | What it has | Play data? | Accessible? |
|--------|------------|------------|-------------|
| TheatreInChicago.com | Event titles, dates, venues | Titles only (no playwright) | Already scraped via TIC parser |
| ChicagoPlays.com | Venue directory | No play/event data | Already scraped for venues |
| Venue calendar pages | Event titles, descriptions, cast | Titles + AI-extracted cast | Already scraped by event scraper |
| IBDb (Internet Broadway Database) | Broadway shows, cast, awards | Yes but no public API | Manual only |
| Dramatists Play Service | Published play catalog | Yes but no public API | Manual only |
| Playbill.com | Show listings, news | Archives behind paywall | Not accessible |

**Conclusion:** There is no public API for a comprehensive play database. The play catalog grows through three channels:
1. Manual curation (seed migrations — the 177 we have)
2. AI identification during scraping (play-matcher creates new plays when it recognizes canonical works)
3. Backfill processing (this feature — re-processes historical events)

The most comprehensive approach is to run the backfill, let the AI identify and create plays it recognizes, then periodically re-seed with manually curated additions as new award winners and Chicago premieres emerge.

## 4. Functional Requirements

**FR1: Backfill Edge Function**
- **Trigger:** POST to `/functions/v1/play-catalog-backfill`
- **Auth:** `Authorization: Bearer {jwt}` (authenticated users only — admin check via profile)
- **Body:** `{ batch_size?: number, dry_run?: boolean }` — defaults: batch_size=50, dry_run=false
- **Behavior:** Queries `events WHERE play_id IS NULL AND event_type = 'show' ORDER BY created_at DESC LIMIT batch_size`, passes IDs to `runPlayMatcherBatch`, returns `PlayMatchSummary`
- **Error:** If matcher fails, returns `{ error: "Backfill failed: {message}" }` with status 500
- **Scope:** Idempotent — re-running skips already-matched events. Multiple runs with batch_size=50 process the full backlog incrementally.

**FR2: Admin button in Coverage tab**
- **Trigger:** Admin taps "Run Play Backfill" button in Docs.tsx Coverage tab
- **Behavior:** Calls the backfill Edge Function with `{ batch_size: 100 }`. While running, button shows "MATCHING..." in disabled state. On completion, displays results inline: `{exact_matches} exact · {fuzzy_matches} fuzzy · {ai_matches} AI · {plays_created} new plays · {events_unmatched} unmatched`
- **Error:** Shows error message inline in `--danger` color
- **Scope:** Button appears after the existing "Run Scraper" button. No modal — results show inline.

**FR3: Remaining count display**
- **Trigger:** Coverage tab loads
- **Behavior:** Shows count of events with `play_id IS NULL AND event_type = 'show'` next to the backfill button: `{count} UNLINKED EVENTS`
- **Data:** Query from client side via supabase `.select('id', { count: 'exact', head: true })`

## 5. Architecture

**New files:**
- `supabase/functions/play-catalog-backfill/index.ts` — Edge Function

**Modified files:**
- `src/pages/Docs.tsx` — add backfill button + results display in CoverageTab

**Reuse:**
- `runPlayMatcherBatch` from `supabase/functions/_shared/scraper/play-matcher.ts` — called directly
- Admin button pattern from Docs.tsx lines 409-446 (Run Discovery / Run Scraper buttons)
- Supabase client pattern from existing Edge Functions

**Edge Function implementation:**
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { runPlayMatcherBatch } from "../_shared/scraper/play-matcher.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { batch_size = 50, dry_run = false } = await req.json().catch(() => ({}));
  const limit = Math.min(batch_size, 200);

  const { data: events } = await supabase
    .from("events")
    .select("id")
    .is("play_id", null)
    .eq("event_type", "show")
    .order("created_at", { ascending: false })
    .limit(limit);

  const eventIds = (events ?? []).map((e: { id: string }) => e.id);

  if (eventIds.length === 0) {
    return Response.json({ message: "No unlinked events", events_processed: 0 });
  }

  const summary = await runPlayMatcherBatch(eventIds, supabase, `backfill-${Date.now()}`);
  return Response.json(summary);
});
```

**Admin button (Docs.tsx CoverageTab):**
- Add state: `const [backfillResult, setBackfillResult] = useState<PlayMatchSummary | null>(null)`
- Add state: `const [backfillRunning, setBackfillRunning] = useState(false)`
- Add state: `const [unlinkedCount, setUnlinkedCount] = useState(0)`
- On mount: query unlinked event count
- Button handler: POST to `/functions/v1/play-catalog-backfill`, set result on completion
- Display: inline results row with match counts

## 6. Deploy steps
1. Create Edge Function file
2. `supabase functions deploy play-catalog-backfill --no-verify-jwt`
3. Add button to Docs.tsx
4. `npm run build` → commit → push → `vercel deploy --prod`
