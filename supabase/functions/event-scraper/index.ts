import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { cleanHtml } from "../_shared/scraper/html-cleaner.ts";
import { buildExtractionPrompt } from "../_shared/scraper/extraction-prompt.ts";
import { generateSlug } from "../_shared/scraper/slug-generator.ts";
import type {
  VenueTarget,
  ScrapedEvent,
  ScrapeResult,
  DeepSeekResponse,
} from "../_shared/scraper/types.ts";

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
        max_tokens: 8192,
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

async function processVenue(
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  // Shared secret auth (not JWT — this is a server-to-server cron call)
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${SCRAPER_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const runId = crypto.randomUUID();
  console.log(`[event-scraper] Starting run ${runId}`);

  // Get all venues with calendar URLs
  const { data: venues, error: venueError } = await supabase
    .from("venues")
    .select("id, name, slug, calendar_url")
    .not("calendar_url", "is", null);

  if (venueError || !venues) {
    return new Response(
      JSON.stringify({ error: "Failed to load venues", detail: venueError?.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Stream results as NDJSON to keep connection alive (avoids idle timeout)
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
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
    headers: { "Content-Type": "application/x-ndjson" },
  });
});
