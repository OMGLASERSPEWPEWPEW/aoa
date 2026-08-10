import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { parseChicagoPlays } from "./chicagoplays-parser.ts";
import { deduplicateQueue } from "./dedup.ts";
import { enrichBatch } from "./enrichment.ts";

const SCRAPER_SECRET = Deno.env.get("SCRAPER_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  // Dual auth: shared secret (cron) OR admin JWT (manual trigger)
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
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get ChicagoPlays source
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
      headers: { "Content-Type": "application/json" },
    });
  }

  const runId = crypto.randomUUID();

  // Concurrent-run guard
  const { data: inProgress } = await supabase
    .from("discovery_runs")
    .select("id")
    .eq("source_id", source.id)
    .is("completed_at", null)
    .gte("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .limit(1)
    .maybeSingle();

  if (inProgress) {
    return new Response(JSON.stringify({ status: "already_running" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create run record
  await supabase.from("discovery_runs").insert({
    source_id: source.id,
    run_id: runId,
    fetch_status: "running",
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let venuesFound = 0;
      let venuesNew = 0;
      let venuesMatched = 0;
      let enrichSuccess = 0;
      let enrichFailed = 0;
      let totalAiIn = 0;
      let totalAiOut = 0;
      let fetchStatus: string = "success";
      let alertAdmin = false;
      let errorMessage: string | null = null;

      try {
        // --- Phase 1: Scrape ChicagoPlays directory ---
        console.log(`[venue-discovery] Run ${runId}: fetching ${source.base_url}`);
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
            consecutive_failures: (source as Record<string, unknown>).consecutive_failures
              ? Number((source as Record<string, unknown>).consecutive_failures) + 1
              : 1,
          }).eq("id", source.id);

          controller.enqueue(encoder.encode(
            JSON.stringify({ type: "error", data: { message: errorMessage } }) + "\n"
          ));
        } else {
          const html = await res.text();
          const discovered = parseChicagoPlays(html);
          venuesFound = discovered.length;

          // Zero-result guard
          if (venuesFound === 0) {
            fetchStatus = "parse_error";
            errorMessage = "Zero venues parsed — HTML structure may have changed";
            alertAdmin = true;
          } else if (venuesFound < 20) {
            fetchStatus = "parse_warning";
            errorMessage = `Only ${venuesFound} venues parsed (expected 200+)`;
            alertAdmin = true;
          }

          controller.enqueue(encoder.encode(
            JSON.stringify({ type: "parse", data: { venues_found: venuesFound } }) + "\n"
          ));

          // Insert discovered venues into queue (idempotent via UNIQUE constraint)
          for (const venue of discovered) {
            const { error } = await supabase.from("venue_discovery_queue").upsert(
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
            if (error) {
              console.error(`[venue-discovery] Queue insert error for ${venue.raw_name}:`, error.message);
            }
          }

          await supabase.from("venue_sources").update({
            last_checked_at: new Date().toISOString(),
            last_success_at: new Date().toISOString(),
            last_error: null,
            consecutive_failures: 0,
          }).eq("id", source.id);

          // --- Phase 2: Deduplication ---
          const dedupStats = await deduplicateQueue(supabase, runId);
          venuesNew = dedupStats.newCount;
          venuesMatched = dedupStats.matchedCount;

          controller.enqueue(encoder.encode(
            JSON.stringify({ type: "dedup", data: { new: venuesNew, matched: venuesMatched, pending: dedupStats.pendingCount } }) + "\n"
          ));

          // --- Phase 3: Enrichment ---
          const { data: candidates } = await supabase
            .from("venue_discovery_queue")
            .select("id, raw_name, raw_address, raw_website_url, raw_genre_tags, raw_category")
            .eq("run_id", runId)
            .eq("dedup_status", "new")
            .eq("enrichment_status", "pending");

          if (candidates && candidates.length > 0) {
            const BATCH_SIZE = 10;
            for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
              const batch = candidates.slice(i, i + BATCH_SIZE);
              const batchResult = await enrichBatch(supabase, batch);
              enrichSuccess += batchResult.success;
              enrichFailed += batchResult.failed;
              totalAiIn += batchResult.aiInputTokens;
              totalAiOut += batchResult.aiOutputTokens;

              controller.enqueue(encoder.encode(
                JSON.stringify({
                  type: "enrich",
                  data: { batch: Math.floor(i / BATCH_SIZE) + 1, success: batchResult.success, failed: batchResult.failed },
                }) + "\n"
              ));

              if (i + BATCH_SIZE < candidates.length) {
                await delay(500);
              }
            }
          }
        }
      } catch (err) {
        fetchStatus = "fetch_error";
        errorMessage = err instanceof Error ? err.message : String(err);
        alertAdmin = true;
        console.error(`[venue-discovery] Run ${runId} error:`, errorMessage);
        controller.enqueue(encoder.encode(
          JSON.stringify({ type: "error", data: { message: errorMessage } }) + "\n"
        ));
      }

      // Update run record
      await supabase.from("discovery_runs").update({
        completed_at: new Date().toISOString(),
        venues_found: venuesFound,
        venues_new: venuesNew,
        venues_matched: venuesMatched,
        enrichment_success: enrichSuccess,
        enrichment_failed: enrichFailed,
        ai_input_tokens: totalAiIn,
        ai_output_tokens: totalAiOut,
        fetch_status: fetchStatus,
        alert_admin: alertAdmin,
        error_message: errorMessage,
      }).eq("run_id", runId);

      // Emit summary
      const summary = {
        run_id: runId,
        source_id: source.id,
        venues_found: venuesFound,
        venues_new: venuesNew,
        venues_matched: venuesMatched,
        enrichment_success: enrichSuccess,
        enrichment_failed: enrichFailed,
        ai_input_tokens: totalAiIn,
        ai_output_tokens: totalAiOut,
        fetch_status: fetchStatus,
        alert_admin: alertAdmin,
        error_message: errorMessage,
      };

      controller.enqueue(encoder.encode(
        JSON.stringify({ type: "summary", data: summary }) + "\n"
      ));

      console.log(`[venue-discovery] Run ${runId} complete: ${venuesFound} found, ${venuesNew} new, ${venuesMatched} matched`);
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
});
