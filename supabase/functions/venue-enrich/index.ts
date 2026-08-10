import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { enrichBatch } from "../venue-discovery/enrichment.ts";

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

const BATCH_SIZE = 5;

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
    const { data: candidates } = await supabase
      .from("venue_discovery_queue")
      .select("id, raw_name, raw_address, raw_website_url, raw_genre_tags, raw_category, detail_page_url")
      .eq("dedup_status", "new")
      .eq("enrichment_status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (!candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({ enriched: 0, remaining: 0, failed: 0 }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const result = await enrichBatch(supabase, candidates);

    const { count } = await supabase
      .from("venue_discovery_queue")
      .select("id", { count: "exact", head: true })
      .eq("dedup_status", "new")
      .eq("enrichment_status", "pending");

    return new Response(
      JSON.stringify({
        enriched: result.success + result.failed,
        remaining: count ?? 0,
        failed: result.failed,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[venue-enrich] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
