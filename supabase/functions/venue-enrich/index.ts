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

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

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
    // Step 1: Enrich pending items
    const { data: candidates } = await supabase
      .from("venue_discovery_queue")
      .select("id, raw_name, raw_address, raw_website_url, raw_genre_tags, raw_category, detail_page_url")
      .eq("dedup_status", "new")
      .eq("enrichment_status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    let enrichedCount = 0;
    let failedCount = 0;

    if (candidates && candidates.length > 0) {
      const result = await enrichBatch(supabase, candidates);
      enrichedCount = result.success + result.failed;
      failedCount = result.failed;
    }

    // Step 2: Auto-promote enriched items that have coordinates
    const { data: promotable } = await supabase
      .from("venue_discovery_queue")
      .select("id, raw_name, raw_address, raw_website_url, raw_genre_tags, raw_neighborhood, raw_description, raw_photo_url, enriched_latitude, enriched_longitude, enriched_calendar_url, enriched_photo_url, enriched_venue_type, source_id")
      .eq("dedup_status", "new")
      .eq("enrichment_status", "complete")
      .eq("promoted", false)
      .not("enriched_latitude", "is", null)
      .not("enriched_longitude", "is", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    let promoted = 0;

    if (promotable) {
      for (const item of promotable) {
        let slug = generateSlug(item.raw_name);

        const { data: existing } = await supabase
          .from("venues")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

        if (existing) {
          for (let i = 2; i <= 10; i++) {
            const candidate = `${slug}-${i}`;
            const { data: check } = await supabase
              .from("venues")
              .select("id")
              .eq("slug", candidate)
              .maybeSingle();
            if (!check) { slug = candidate; break; }
          }
        }

        const { data: venue, error } = await supabase
          .from("venues")
          .insert({
            name: item.raw_name,
            slug,
            description: item.raw_description || null,
            venue_type: item.enriched_venue_type || "storefront",
            address: item.raw_address || null,
            neighborhood: item.raw_neighborhood || null,
            latitude: item.enriched_latitude,
            longitude: item.enriched_longitude,
            website_url: item.raw_website_url || null,
            photo_url: item.enriched_photo_url || item.raw_photo_url || null,
            calendar_url: item.enriched_calendar_url || null,
            genre_tags: item.raw_genre_tags || [],
            source: "discovered",
            discovered_from_source_id: item.source_id,
          })
          .select("id")
          .single();

        if (!error && venue) {
          await supabase
            .from("venue_discovery_queue")
            .update({ promoted: true, promoted_venue_id: venue.id })
            .eq("id", item.id);
          promoted++;
        } else if (error) {
          console.error(`[venue-enrich] Promote failed for ${item.raw_name}:`, error.message);
        }
      }
    }

    // Step 3: Count remaining work (pending enrichment + un-promoted with coordinates)
    const { count: pendingEnrich } = await supabase
      .from("venue_discovery_queue")
      .select("id", { count: "exact", head: true })
      .eq("dedup_status", "new")
      .eq("enrichment_status", "pending");

    const { count: pendingPromote } = await supabase
      .from("venue_discovery_queue")
      .select("id", { count: "exact", head: true })
      .eq("dedup_status", "new")
      .eq("enrichment_status", "complete")
      .eq("promoted", false)
      .not("enriched_latitude", "is", null)
      .not("enriched_longitude", "is", null);

    const remaining = (pendingEnrich ?? 0) + (pendingPromote ?? 0);

    return new Response(
      JSON.stringify({ enriched: enrichedCount, promoted, remaining, failed: failedCount }),
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
