import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { processVenue } from "../_shared/scraper/process-venue.ts";
import type { VenueTarget } from "../_shared/scraper/types.ts";

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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-scraper-key",
    "Vary": "Origin",
  };
}

const SCRAPER_SECRET = Deno.env.get("SCRAPER_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH_SIZE = 3;

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const scraperKey =
    req.headers.get("x-scraper-key") ??
    req.headers.get("Authorization")?.replace("Bearer ", "");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let authed = scraperKey === SCRAPER_SECRET;
  if (!authed && scraperKey) {
    const { data: { user } } = await supabase.auth.getUser(scraperKey);
    if (user) authed = true;
  }

  if (!authed) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const runId = crypto.randomUUID();

    const { data: venues } = await supabase
      .from("venues")
      .select("id, name, slug, calendar_url, website_url, photo_url, photo_url_source")
      .not("calendar_url", "is", null)
      .or("scraped_at.is.null,scraped_at.lt." + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("scraped_at", { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);

    if (!venues || venues.length === 0) {
      return new Response(
        JSON.stringify({ scraped: 0, events_found: 0, events_created: 0, remaining: 0 }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    let totalFound = 0;
    let totalCreated = 0;
    let totalUpdated = 0;

    for (const venue of venues as VenueTarget[]) {
      const result = await processVenue(venue, runId);
      totalFound += result.events_found;
      totalCreated += result.events_created;
      totalUpdated += result.events_updated;

      await supabase
        .from("venues")
        .update({ scraped_at: new Date().toISOString() })
        .eq("id", venue.id);
    }

    const { count } = await supabase
      .from("venues")
      .select("id", { count: "exact", head: true })
      .not("calendar_url", "is", null)
      .or("scraped_at.is.null,scraped_at.lt." + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return new Response(
      JSON.stringify({
        scraped: venues.length,
        events_found: totalFound,
        events_created: totalCreated + totalUpdated,
        remaining: count ?? 0,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[event-scrape-batch] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
