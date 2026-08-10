import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { cleanHtml } from "../_shared/scraper/html-cleaner.ts";
import { buildExtractionPrompt } from "../_shared/scraper/extraction-prompt.ts";
import { generateSlug } from "../_shared/scraper/slug-generator.ts";
import { extractOgImage } from "../_shared/scraper/og-image-extractor.ts";
import type {
  VenueTarget,
  ScrapedEvent,
  ScrapeResult,
  EnrichmentResult,
  DeepSeekResponse,
} from "../_shared/scraper/types.ts";
import { logUsage } from "../_shared/logUsage.ts";

const SCRAPER_SECRET = Deno.env.get("SCRAPER_SECRET")!;
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchVenueHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ArtOfArt-EventBot/1.0; +https://aoa-nine.vercel.app)",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function extractEvents(
  html: string,
  venueName: string,
): Promise<{ events: ScrapedEvent[]; inputTokens: number; outputTokens: number }> {
  const cleaned = cleanHtml(html);

  if (cleaned.length < 100) {
    return { events: [], inputTokens: 0, outputTokens: 0 };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  let response: Response;
  try {
    response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: buildExtractionPrompt(venueName) },
          { role: "user", content: cleaned },
        ],
        response_format: { type: "json_object" },
        max_tokens: 16384,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${errText}`);
  }

  const data: DeepSeekResponse = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    return {
      events: [],
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  }

  const parsed = JSON.parse(content);
  return {
    events: parsed.events ?? [],
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

export async function processVenue(
  venue: VenueTarget,
  runId: string,
): Promise<ScrapeResult> {
  const start = Date.now();
  const result: ScrapeResult = {
    venue_id: venue.id,
    venue_name: venue.name,
    status: "success",
    events_found: 0,
    events_created: 0,
    events_updated: 0,
    error_message: null,
    ai_input_tokens: 0,
    ai_output_tokens: 0,
    duration_ms: 0,
  };

  try {
    const html = await fetchVenueHtml(venue.calendar_url);

    const { events, inputTokens, outputTokens } = await extractEvents(
      html,
      venue.name,
    );
    result.ai_input_tokens = inputTokens;
    result.ai_output_tokens = outputTokens;
    result.events_found = events.length;

    if (inputTokens > 0) {
      try {
        await logUsage(supabase, {
          userId: null,
          model: "deepseek-v4-flash",
          provider: "deepseek",
          feature: "event-scraper",
          inputTokens,
          outputTokens,
          metadata: { venue_id: venue.id, venue_name: venue.name, run_id: runId },
        });
      } catch (e) {
        console.error("[event-scraper] Usage logging failed:", e);
      }
    }

    for (const event of events) {
      const slug = generateSlug(event.title, venue.slug);

      const { data: existing } = await supabase
        .from("events")
        .select("id, source")
        .eq("slug", slug)
        .maybeSingle();

      // Never overwrite manually curated events
      if (existing?.source === "manual") {
        continue;
      }

      const row = {
        venue_id: venue.id,
        title: event.title,
        slug,
        description: event.description,
        event_type: ["show", "class", "workshop", "festival", "open-call"].includes(event.event_type)
          ? event.event_type
          : "show",
        genre_tags: event.genre_tags,
        start_date: event.start_date,
        end_date: event.end_date,
        price_min: event.price_min,
        price_max: event.price_max,
        ticket_url: event.ticket_url || venue.calendar_url,
        hottix_available: event.hottix_available,
        show_times: event.show_times ?? null,
        photo_url: event.photo_url || null,
        cast_members: event.cast_members ?? null,
        source: "scraped" as const,
        scraped_at: new Date().toISOString(),
        source_url: venue.calendar_url,
      };

      if (existing) {
        const { error } = await supabase
          .from("events")
          .update(row)
          .eq("id", existing.id);
        if (error) throw new Error(`Update failed: ${error.message}`);
        result.events_updated++;
      } else {
        const { error } = await supabase.from("events").insert(row);
        if (error) throw new Error(`Insert failed: ${error.message}`);
        result.events_created++;
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("DeepSeek API error")) {
      result.status = "ai_error";
    } else if (msg.includes("HTTP ") || msg.includes("fetch")) {
      result.status = "fetch_error";
    } else {
      result.status = "parse_error";
    }
    result.error_message = msg;
    console.error(`[event-scraper] ${venue.name}: ${msg}`);
  }

  result.duration_ms = Date.now() - start;

  // Log to scrape_logs
  await supabase.from("scrape_logs").insert({
    run_id: runId,
    venue_id: venue.id,
    venue_name: venue.name,
    status: result.status,
    events_found: result.events_found,
    events_created: result.events_created,
    events_updated: result.events_updated,
    error_message: result.error_message,
    ai_input_tokens: result.ai_input_tokens,
    ai_output_tokens: result.ai_output_tokens,
    duration_ms: result.duration_ms,
  });

  return result;
}

async function enrichVenue(
  venue: VenueTarget,
  runId: string,
): Promise<EnrichmentResult> {
  const start = Date.now();
  const result: EnrichmentResult = {
    venue_id: venue.id,
    venue_name: venue.name,
    photo_extracted: false,
    photo_url: null,
    website_url_valid: null,
    error_message: null,
    duration_ms: 0,
  };

  if (!venue.website_url) {
    result.duration_ms = Date.now() - start;
    return result;
  }

  try {
    const html = await fetchVenueHtml(venue.website_url);
    result.website_url_valid = true;

    // Extract og:image if venue needs a photo
    const needsPhoto = !venue.photo_url || venue.photo_url_source === "og_image";
    if (needsPhoto) {
      const ogImage = extractOgImage(html, venue.website_url);
      if (ogImage) {
        result.photo_extracted = true;
        result.photo_url = ogImage;

        await supabase
          .from("venues")
          .update({ photo_url: ogImage, photo_url_source: "og_image" })
          .eq("id", venue.id);
      }
    }

    await supabase
      .from("venues")
      .update({ website_url_checked_at: new Date().toISOString() })
      .eq("id", venue.id);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.website_url_valid = false;
    result.error_message = msg;
    console.warn(`[enrichment] ${venue.name}: ${msg}`);

    await supabase
      .from("venues")
      .update({ website_url_checked_at: new Date().toISOString() })
      .eq("id", venue.id);
  }

  result.duration_ms = Date.now() - start;

  await supabase.from("scrape_logs").insert({
    run_id: runId,
    venue_id: venue.id,
    venue_name: venue.name,
    status: result.error_message ? "fetch_error" : "success",
    events_found: 0,
    events_created: 0,
    events_updated: 0,
    error_message: result.error_message,
    ai_input_tokens: 0,
    ai_output_tokens: 0,
    duration_ms: result.duration_ms,
    phase: "enrichment",
  });

  return result;
}

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

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const scraperKey = req.headers.get("x-scraper-key") ?? req.headers.get("Authorization")?.replace("Bearer ", "");
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

  const runId = crypto.randomUUID();
  console.log(`[event-scraper] Starting run ${runId}`);

  // Get all venues for enrichment + scraping
  const { data: allVenues, error: venueError } = await supabase
    .from("venues")
    .select("id, name, slug, calendar_url, website_url, photo_url, photo_url_source");

  if (venueError || !allVenues) {
    return new Response(
      JSON.stringify({ error: "Failed to load venues", detail: venueError?.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const venues = allVenues.filter((v) => v.calendar_url) as VenueTarget[];
  const enrichmentVenues = allVenues.filter((v) => v.website_url) as VenueTarget[];

  // Stream results as NDJSON to keep connection alive (avoids idle timeout)
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // --- Phase 1: Venue enrichment (photos + URL validation) ---
      const enrichResults: EnrichmentResult[] = [];
      const ENRICH_BATCH = 5;

      for (let i = 0; i < enrichmentVenues.length; i += ENRICH_BATCH) {
        const batch = enrichmentVenues.slice(i, i + ENRICH_BATCH);
        const batchResults = await Promise.all(
          batch.map((v) => enrichVenue(v, runId)),
        );
        enrichResults.push(...batchResults);

        for (const r of batchResults) {
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "enrichment", data: r }) + "\n"),
          );
        }

        if (i + ENRICH_BATCH < enrichmentVenues.length) {
          await delay(500);
        }
      }

      // --- Phase 2: Event scraping ---
      const results: ScrapeResult[] = [];
      const BATCH_SIZE = 3;

      for (let i = 0; i < venues.length; i += BATCH_SIZE) {
        const batch = venues.slice(i, i + BATCH_SIZE) as VenueTarget[];
        console.log(
          `[event-scraper] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.map((v) => v.name).join(", ")}`,
        );

        const batchResults = await Promise.all(
          batch.map((venue) => processVenue(venue, runId)),
        );
        results.push(...batchResults);

        for (const r of batchResults) {
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "venue", data: r }) + "\n"),
          );
        }

        if (i + BATCH_SIZE < venues.length) {
          await delay(1000);
        }
      }

      const summary = {
        run_id: runId,
        enrichment: {
          venues_checked: enrichResults.length,
          photos_found: enrichResults.filter((r) => r.photo_extracted).length,
          url_failures: enrichResults.filter((r) => r.website_url_valid === false).length,
        },
        venues_scraped: results.length,
        total_events_found: results.reduce((s, r) => s + r.events_found, 0),
        total_created: results.reduce((s, r) => s + r.events_created, 0),
        total_updated: results.reduce((s, r) => s + r.events_updated, 0),
        errors: results.filter((r) => r.status !== "success").length,
      };

      controller.enqueue(
        encoder.encode(JSON.stringify({ type: "summary", data: summary }) + "\n"),
      );

      console.log(
        `[event-scraper] Run ${runId} complete: ${summary.total_events_found} found, ${summary.total_created} created, ${summary.total_updated} updated, ${summary.errors} errors`,
      );

      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { ...cors, "Content-Type": "application/x-ndjson" },
  });
});
