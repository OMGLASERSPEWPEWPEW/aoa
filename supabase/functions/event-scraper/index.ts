import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { cleanHtml } from "../_shared/scraper/html-cleaner.ts";
import { buildExtractionPrompt } from "../_shared/scraper/extraction-prompt.ts";
import { buildVerificationPrompt } from "../_shared/scraper/verification-prompt.ts";
import { generateSlug } from "../_shared/scraper/slug-generator.ts";
import { extractOgImage } from "../_shared/scraper/og-image-extractor.ts";
import type {
  VenueTarget,
  ScrapedEvent,
  ScrapeResult,
  EnrichmentResult,
  DeepSeekResponse,
  Pass1Event,
  Pass2Verification,
} from "../_shared/scraper/types.ts";
import { logUsage } from "../_shared/logUsage.ts";
import { guardedUpdate } from "../_shared/curator/overrides.ts";

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

async function callDeepSeek(
  systemPrompt: string,
  userContent: string,
  maxTokens = 8192,
): Promise<{ content: string | null; inputTokens: number; outputTokens: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        max_tokens: maxTokens,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API error (${response.status}): ${errText}`);
    }

    const data: DeepSeekResponse = await response.json();
    return {
      content: data.choices[0]?.message?.content ?? null,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function extractEventsPass1(
  html: string,
  venueName: string,
): Promise<{ events: Pass1Event[]; inputTokens: number; outputTokens: number }> {
  const cleaned = cleanHtml(html);
  if (cleaned.length < 100) {
    return { events: [], inputTokens: 0, outputTokens: 0 };
  }

  const result = await callDeepSeek(buildExtractionPrompt(venueName), cleaned);
  if (!result.content) {
    return { events: [], inputTokens: result.inputTokens, outputTokens: result.outputTokens };
  }

  const parsed = JSON.parse(result.content);
  return {
    events: parsed.events ?? [],
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

async function verifyEventsPass2(
  venueName: string,
  pass1Events: Pass1Event[],
): Promise<{ events: Pass2Verification[]; inputTokens: number; outputTokens: number }> {
  if (pass1Events.length === 0) {
    return { events: [], inputTokens: 0, outputTokens: 0 };
  }

  const result = await callDeepSeek(
    buildVerificationPrompt(venueName, pass1Events),
    "Verify and enrich these events.",
  );
  if (!result.content) {
    return { events: [], inputTokens: result.inputTokens, outputTokens: result.outputTokens };
  }

  const parsed = JSON.parse(result.content);
  return {
    events: parsed.events ?? [],
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

interface MergedEvent {
  title: string;
  event_type: string;
  start_date: string | null;
  end_date: string | null;
  price_min: number | null;
  price_max: number | null;
  ticket_url: string | null;
  show_times: Record<string, string[]> | null;
  description: string | null;
  genre_tags: string[];
  cast_members: Array<{ name: string; role: string | null }> | null;
  photo_url: string | null;
  confidence: number;
  instructor_name: string | null;
  skill_level: string | null;
  session_count: number | null;
  class_format: string | null;
}

function mergeExtractionResults(
  pass1Events: Pass1Event[],
  pass2Events: Pass2Verification[],
): MergedEvent[] {
  const merged: MergedEvent[] = [];

  for (let i = 0; i < pass1Events.length; i++) {
    const p1 = pass1Events[i];
    const p2 = pass2Events[i] ?? pass2Events.find((e) => e.title === p1.title);

    if (!p2) {
      merged.push({
        ...p1,
        start_date: p1.start_date ?? null,
        end_date: p1.end_date ?? null,
        description: null,
        genre_tags: [],
        cast_members: null,
        photo_url: null,
        confidence: 0.5,
        instructor_name: p1.instructor_name ?? null,
        skill_level: p1.skill_level ?? null,
        session_count: p1.session_count ?? null,
        class_format: p1.class_format ?? null,
      });
      continue;
    }

    if (p2.status === "rejected") continue;

    const c = p2.corrections ?? {};
    merged.push({
      title: p1.title,
      event_type: c.event_type ?? p1.event_type,
      start_date: c.start_date !== undefined ? c.start_date : (p1.start_date ?? null),
      end_date: c.end_date !== undefined ? c.end_date : (p1.end_date ?? null),
      price_min: c.price_min !== undefined ? c.price_min : p1.price_min,
      price_max: c.price_max !== undefined ? c.price_max : p1.price_max,
      ticket_url: p1.ticket_url,
      show_times: p1.show_times,
      description: p2.description,
      genre_tags: p2.genre_tags ?? [],
      cast_members: p2.cast_members,
      photo_url: p2.photo_url ?? null,
      confidence: p2.confidence,
      instructor_name: p2?.instructor_name ?? p1.instructor_name ?? null,
      skill_level: p2?.skill_level ?? p1.skill_level ?? null,
      session_count: p2?.session_count ?? p1.session_count ?? null,
      class_format: p2?.class_format ?? p1.class_format ?? null,
    });
  }

  return merged;
}

// LEGACY: superseded by _shared/scraper/process-venue.ts — do not extend
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

    // --- Pass 1: Extract structural data ---
    const pass1 = await extractEventsPass1(html, venue.name);
    result.ai_input_tokens += pass1.inputTokens;
    result.ai_output_tokens += pass1.outputTokens;
    result.events_found = pass1.events.length;

    if (pass1.inputTokens > 0) {
      try {
        await logUsage(supabase, {
          userId: null,
          model: "deepseek-v4-flash",
          provider: "deepseek",
          feature: "event-scraper-extract",
          inputTokens: pass1.inputTokens,
          outputTokens: pass1.outputTokens,
          metadata: { venue_id: venue.id, venue_name: venue.name, run_id: runId, pass: 1 },
        });
      } catch (e) {
        console.error("[event-scraper] Pass 1 usage logging failed:", e);
      }
    }

    if (pass1.events.length === 0) {
      result.duration_ms = Date.now() - start;
      await supabase.from("scrape_logs").insert({
        run_id: runId, venue_id: venue.id, venue_name: venue.name,
        status: result.status, events_found: 0, events_created: 0, events_updated: 0,
        error_message: null, ai_input_tokens: result.ai_input_tokens,
        ai_output_tokens: result.ai_output_tokens, duration_ms: result.duration_ms,
      });
      return result;
    }

    // --- Pass 2: Verify & enrich ---
    let mergedEvents: MergedEvent[];
    try {
      const pass2 = await verifyEventsPass2(venue.name, pass1.events);
      result.ai_input_tokens += pass2.inputTokens;
      result.ai_output_tokens += pass2.outputTokens;

      if (pass2.inputTokens > 0) {
        try {
          await logUsage(supabase, {
            userId: null,
            model: "deepseek-v4-flash",
            provider: "deepseek",
            feature: "event-scraper-verify",
            inputTokens: pass2.inputTokens,
            outputTokens: pass2.outputTokens,
            metadata: { venue_id: venue.id, venue_name: venue.name, run_id: runId, pass: 2 },
          });
        } catch (e) {
          console.error("[event-scraper] Pass 2 usage logging failed:", e);
        }
      }

      mergedEvents = mergeExtractionResults(pass1.events, pass2.events);
    } catch (pass2Error) {
      console.error(`[event-scraper] Pass 2 failed for ${venue.name}, using Pass 1 data:`, pass2Error);
      mergedEvents = pass1.events.map((p1) => ({
        ...p1,
        start_date: p1.start_date ?? null,
        end_date: p1.end_date ?? null,
        description: null,
        genre_tags: [],
        cast_members: null,
        photo_url: null,
        confidence: 0.5,
        instructor_name: p1.instructor_name ?? null,
        skill_level: p1.skill_level ?? null,
        session_count: p1.session_count ?? null,
        class_format: p1.class_format ?? null,
      }));
    }

    // --- Insert/update verified events ---
    for (const event of mergedEvents) {
      const slug = generateSlug(event.title, venue.slug);

      const { data: existing } = await supabase
        .from("events")
        .select("id, source")
        .eq("slug", slug)
        .maybeSingle();

      if (existing?.source === "manual") continue;

      const row = {
        venue_id: venue.id,
        title: event.title,
        slug,
        description: event.description,
        event_type: ["show", "class", "workshop", "festival", "open-call"].includes(event.event_type)
          ? event.event_type : "show",
        genre_tags: event.genre_tags,
        start_date: event.start_date,
        end_date: event.end_date,
        price_min: event.price_min,
        price_max: event.price_max,
        ticket_url: event.ticket_url || venue.calendar_url,
        hottix_available: false,
        show_times: event.show_times ?? null,
        photo_url: event.photo_url || null,
        cast_members: event.cast_members ?? null,
        source: "scraped" as const,
        scraped_at: new Date().toISOString(),
        source_url: venue.calendar_url,
        extraction_confidence: event.confidence,
        instructor_name: event.instructor_name ?? null,
        skill_level: ['beginner','intermediate','advanced','all-levels','drop-in'].includes(event.skill_level ?? '')
          ? event.skill_level : null,
        session_count: typeof event.session_count === 'number' ? event.session_count : null,
        class_format: ['ongoing','workshop','intensive','drop-in','series'].includes(event.class_format ?? '')
          ? event.class_format : null,
      };

      if (existing) {
        await guardedUpdate(supabase, "event", existing.id, row, {
          source_url: venue.calendar_url,
        });
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

  await supabase.from("scrape_logs").insert({
    run_id: runId, venue_id: venue.id, venue_name: venue.name,
    status: result.status, events_found: result.events_found,
    events_created: result.events_created, events_updated: result.events_updated,
    error_message: result.error_message, ai_input_tokens: result.ai_input_tokens,
    ai_output_tokens: result.ai_output_tokens, duration_ms: result.duration_ms,
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

        await guardedUpdate(supabase, "venue", venue.id, {
          photo_url: ogImage,
          photo_url_source: "og_image",
        }, { source_url: venue.website_url ?? undefined });
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
