import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getAllTicShows, enrichFromTicDetail } from "../_shared/scraper/tic-lookup.ts";
import {
  matchVenueName,
  lookupKnownPair,
  logMatchDecision,
  aiMatchVenues,
} from "../_shared/scraper/venue-name-matcher.ts";
import type { TicShow } from "../_shared/scraper/types.ts";
import { guardedUpdate } from "../_shared/curator/overrides.ts";

const ALLOWED_ORIGINS = [
  "http://localhost:5204",
  "https://aoa-nine.vercel.app",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Vary": "Origin",
  };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SCRAPER_SECRET = Deno.env.get("SCRAPER_SECRET")!;

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const scraperKey = req.headers.get("x-scraper-key") ?? req.headers.get("Authorization")?.replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let authed = scraperKey === SCRAPER_SECRET;
  if (!authed && scraperKey) {
    const { data: { user } } = await supabase.auth.getUser(scraperKey);
    if (user) authed = true;
  }
  if (!authed) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }

  try {
    const allShows = await getAllTicShows();

    const { data: events } = await supabase
      .from("events")
      .select("id, title, venue_id, start_date, end_date, source, found_by, venues(id, name)")
      .is("start_date", null)
      .eq("source", "scraped");

    const { data: venues } = await supabase
      .from("venues")
      .select("id, name")
      .not("calendar_url", "is", null);

    const venueMap = new Map((venues ?? []).map((v: { id: string; name: string }) => [v.id, v.name]));

    let enriched = 0;
    let unmatched = 0;
    let cachedMatches = 0;
    let aiMatches = 0;

    interface AmbiguousPair {
      ourName: string;
      ourId: string;
      ticName: string;
      heuristicScore: number;
      eventId: string;
      ticShow: TicShow;
    }
    const ambiguousPairs: AmbiguousPair[] = [];

    const eventMatches: Array<{ eventId: string; show: TicShow; decision: string }> = [];

    for (const event of events ?? []) {
      const venueName = (event as any).venues?.name ?? venueMap.get(event.venue_id) ?? "";
      const venueId = (event as any).venues?.id ?? event.venue_id;

      let bestShow: TicShow | null = null;
      let bestScore = 0;
      let matchDecision = "rejected";

      for (const show of allShows) {
        const titleScore = matchVenueName(event.title, show.title);
        if (titleScore < 0.5) continue;

        const known = await lookupKnownPair(venueName, show.venueName, "tic", supabase);
        if (known !== null) {
          if (known.matched) {
            bestShow = show;
            bestScore = 1.0;
            matchDecision = "matched";
            cachedMatches++;
            break;
          }
          continue;
        }

        const venueScore = matchVenueName(venueName, show.venueName);

        if (venueScore >= 0.6) {
          if (venueScore > bestScore) {
            bestShow = show;
            bestScore = venueScore;
            matchDecision = "matched";
          }
          await logMatchDecision(supabase, {
            ourName: venueName,
            ourId: venueId,
            externalName: show.venueName,
            source: "tic",
            heuristicScore: venueScore,
            finalDecision: "matched",
          });
        } else if (venueScore >= 0.3 && titleScore >= 0.6) {
          ambiguousPairs.push({
            ourName: venueName,
            ourId: venueId,
            ticName: show.venueName,
            heuristicScore: venueScore,
            eventId: event.id,
            ticShow: show,
          });
        } else {
          await logMatchDecision(supabase, {
            ourName: venueName,
            ourId: venueId,
            externalName: show.venueName,
            source: "tic",
            heuristicScore: venueScore,
            finalDecision: "rejected",
          });
        }
      }

      if (bestShow) {
        eventMatches.push({ eventId: event.id, show: bestShow, decision: matchDecision });
      } else if (ambiguousPairs.filter(p => p.eventId === event.id).length === 0) {
        unmatched++;
      }
    }

    if (ambiguousPairs.length > 0) {
      const uniquePairs = Array.from(
        new Map(ambiguousPairs.map(p => [`${p.ourName}|||${p.ticName}`, p])).values(),
      );
      const aiResults = await aiMatchVenues(uniquePairs, supabase);

      for (const pair of ambiguousPairs) {
        const key = `${pair.ourName}|||${pair.ticName}`;
        const matched = aiResults.get(key);
        if (matched) {
          eventMatches.push({ eventId: pair.eventId, show: pair.ticShow, decision: "ai_matched" });
          aiMatches++;
        } else {
          unmatched++;
        }
      }
    }

    for (const match of eventMatches) {
      const { eventId, show } = match;
      if (!show.startDate && !show.endDate && show.detailUrl) {
        try {
          const detail = await enrichFromTicDetail(show.detailUrl);
          if (detail) {
            if (detail.startDate) (show as any).startDate = detail.startDate;
            if (detail.endDate) (show as any).endDate = detail.endDate;
          }
        } catch { /* detail fetch failed */ }
      }
      if (!show.startDate && !show.endDate) { unmatched++; continue; }

      const updates: Record<string, unknown> = {};
      if (show.startDate) updates.start_date = show.startDate;
      if (show.endDate) updates.end_date = show.endDate;
      updates.extraction_status = "complete";
      updates.missing_fields = [];
      updates.source_url = show.detailUrl;

      const event = (events ?? []).find((e: any) => e.id === eventId);
      const existingFoundBy = (event as any)?.found_by ?? [];
      if (!existingFoundBy.includes("tic")) {
        updates.found_by = [...existingFoundBy, "tic"];
      }

      await guardedUpdate(supabase, "event", eventId, updates, {
        source_url: show.detailUrl,
      });
      enriched++;
    }

    return new Response(
      JSON.stringify({
        tic_shows_found: allShows.length,
        events_with_null_dates: (events ?? []).length,
        enriched,
        unmatched,
        cached_matches: cachedMatches,
        ai_matches: aiMatches,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[tic-crossref] Error:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
