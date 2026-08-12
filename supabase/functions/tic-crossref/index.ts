import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { parseTicListingPage } from "../_shared/scraper/tic-parser.ts";
import { matchVenueName } from "../_shared/scraper/venue-name-matcher.ts";
import type { TicShow } from "../_shared/scraper/types.ts";

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
const TIC_BASE = "https://www.theatreinchicago.com";
const UA = "Mozilla/5.0 (compatible; ArtOfArt-EventBot/1.0; +https://aoa-nine.vercel.app)";

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

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
    const allShows: TicShow[] = [];

    const comingSoonHtml = await fetchPage(`${TIC_BASE}/comingsoonrs.php?viewall=1`);
    allShows.push(...parseTicListingPage(comingSoonHtml));

    await new Promise(r => setTimeout(r, 500));

    const nowPlayingHtml = await fetchPage(`${TIC_BASE}/nowplayingrs.php?viewall=1`);
    allShows.push(...parseTicListingPage(nowPlayingHtml));

    const { data: events } = await supabase
      .from("events")
      .select("id, title, venue_id, start_date, end_date, source, venues(name)")
      .is("start_date", null)
      .eq("source", "scraped");

    let enriched = 0;
    let unmatched = 0;

    for (const event of events ?? []) {
      const venueName = (event as any).venues?.name ?? "";
      const matchingShows = allShows.filter(
        s => matchVenueName(venueName, s.venueName) >= 0.6 &&
          matchVenueName(event.title, s.title) >= 0.6,
      );

      if (matchingShows.length === 0) {
        unmatched++;
        continue;
      }

      const best = matchingShows[0];
      if (!best.startDate && !best.endDate) {
        unmatched++;
        continue;
      }

      const updates: Record<string, unknown> = {};
      if (best.startDate) updates.start_date = best.startDate;
      if (best.endDate) updates.end_date = best.endDate;
      updates.extraction_status = "complete";
      updates.missing_fields = [];
      updates.source_url = best.detailUrl;

      await supabase.from("events").update(updates).eq("id", event.id);
      enriched++;
    }

    return new Response(
      JSON.stringify({
        tic_shows_found: allShows.length,
        events_with_null_dates: (events ?? []).length,
        enriched,
        unmatched,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[tic-crossref] Error:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
