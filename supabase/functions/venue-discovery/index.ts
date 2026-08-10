import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { parseChicagoPlays } from "./chicagoplays-parser.ts";
import { deduplicateQueue } from "./dedup.ts";

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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const scraperKey =
    req.headers.get("x-scraper-key") ??
    req.headers.get("Authorization")?.replace("Bearer ", "");

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

  const { data: source } = await supabase
    .from("venue_sources")
    .select("id, base_url, is_active")
    .eq("source_type", "directory")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!source) {
    return new Response(JSON.stringify({ error: "No active directory source" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const runId = crypto.randomUUID();

  const { data: inProgress } = await supabase
    .from("discovery_runs")
    .select("id")
    .eq("source_id", source.id)
    .is("completed_at", null)
    .gte("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .limit(1)
    .maybeSingle();

  if (inProgress) {
    return new Response(JSON.stringify({ status: "already_running", venues_new: 0 }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  await supabase.from("discovery_runs").insert({
    source_id: source.id,
    run_id: runId,
    fetch_status: "running",
  });

  let venuesFound = 0;
  let venuesNew = 0;
  let venuesMatched = 0;
  let fetchStatus = "success";
  let alertAdmin = false;
  let errorMessage: string | null = null;

  try {
    const res = await fetch(source.base_url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ArtOfArt-EventBot/1.0; +https://aoa-nine.vercel.app)" },
    });

    if (!res.ok) {
      fetchStatus = "fetch_error";
      errorMessage = `HTTP ${res.status} fetching ${source.base_url}`;
      alertAdmin = true;

      await supabase.from("venue_sources").update({
        last_checked_at: new Date().toISOString(),
        last_error: errorMessage,
        consecutive_failures: 1,
      }).eq("id", source.id);
    } else {
      const html = await res.text();
      const discovered = parseChicagoPlays(html);
      venuesFound = discovered.length;

      if (venuesFound === 0) {
        fetchStatus = "parse_error";
        errorMessage = "Zero venues parsed — HTML structure may have changed";
        alertAdmin = true;
      } else if (venuesFound < 20) {
        fetchStatus = "parse_warning";
        errorMessage = `Only ${venuesFound} venues parsed (expected 200+)`;
        alertAdmin = true;
      }

      for (const venue of discovered) {
        await supabase.from("venue_discovery_queue").upsert(
          {
            source_id: source.id,
            run_id: runId,
            raw_name: venue.raw_name,
            raw_address: venue.raw_address,
            raw_website_url: venue.raw_website_url,
            raw_genre_tags: venue.raw_genre_tags,
            raw_neighborhood: venue.raw_neighborhood,
            raw_category: venue.raw_category,
            raw_description: venue.raw_description,
            raw_phone: venue.raw_phone,
            raw_photo_url: venue.raw_photo_url,
            detail_page_url: venue.detail_page_url,
          },
          { onConflict: "source_id,raw_name,raw_address", ignoreDuplicates: true },
        );
      }

      await supabase.from("venue_sources").update({
        last_checked_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        last_error: null,
        consecutive_failures: 0,
      }).eq("id", source.id);

      const dedupStats = await deduplicateQueue(supabase, runId);
      venuesNew = dedupStats.newCount;
      venuesMatched = dedupStats.matchedCount;
    }
  } catch (err) {
    fetchStatus = "fetch_error";
    errorMessage = err instanceof Error ? err.message : String(err);
    alertAdmin = true;
  }

  await supabase.from("discovery_runs").update({
    completed_at: new Date().toISOString(),
    venues_found: venuesFound,
    venues_new: venuesNew,
    venues_matched: venuesMatched,
    fetch_status: fetchStatus,
    alert_admin: alertAdmin,
    error_message: errorMessage,
  }).eq("run_id", runId);

  return new Response(
    JSON.stringify({ venues_found: venuesFound, venues_new: venuesNew, venues_matched: venuesMatched, error: errorMessage }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
