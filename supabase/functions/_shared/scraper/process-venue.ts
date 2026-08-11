import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { cleanHtml } from "./html-cleaner.ts";
import { buildExtractionPrompt } from "./extraction-prompt.ts";
import { buildVerificationPrompt } from "./verification-prompt.ts";
import { generateSlug } from "./slug-generator.ts";
import type {
  VenueTarget,
  ScrapeResult,
  DeepSeekResponse,
  Pass1Event,
  Pass2Verification,
} from "./types.ts";
import { logUsage } from "../logUsage.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fetchVenueHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ArtOfArt-EventBot/1.0; +https://aoa-nine.vercel.app)" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
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
      headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
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
  if (cleaned.length < 100) return { events: [], inputTokens: 0, outputTokens: 0 };

  const result = await callDeepSeek(buildExtractionPrompt(venueName), cleaned);
  if (!result.content) return { events: [], inputTokens: result.inputTokens, outputTokens: result.outputTokens };

  const parsed = JSON.parse(result.content);
  return { events: parsed.events ?? [], inputTokens: result.inputTokens, outputTokens: result.outputTokens };
}

async function verifyEventsPass2(
  venueName: string,
  pass1Events: Pass1Event[],
): Promise<{ events: Pass2Verification[]; inputTokens: number; outputTokens: number }> {
  if (pass1Events.length === 0) return { events: [], inputTokens: 0, outputTokens: 0 };

  const result = await callDeepSeek(buildVerificationPrompt(venueName, pass1Events), "Verify and enrich these events.");
  if (!result.content) return { events: [], inputTokens: result.inputTokens, outputTokens: result.outputTokens };

  const parsed = JSON.parse(result.content);
  return { events: parsed.events ?? [], inputTokens: result.inputTokens, outputTokens: result.outputTokens };
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
}

function mergeExtractionResults(pass1Events: Pass1Event[], pass2Events: Pass2Verification[]): MergedEvent[] {
  const merged: MergedEvent[] = [];
  for (let i = 0; i < pass1Events.length; i++) {
    const p1 = pass1Events[i];
    const p2 = pass2Events[i] ?? pass2Events.find((e) => e.title === p1.title);

    if (!p2) {
      merged.push({ ...p1, start_date: p1.start_date ?? null, end_date: p1.end_date ?? null, description: null, genre_tags: [], cast_members: null, photo_url: null, confidence: 0.5 });
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
    });
  }
  return merged;
}

export async function processVenue(venue: VenueTarget, runId: string): Promise<ScrapeResult> {
  const start = Date.now();
  const result: ScrapeResult = {
    venue_id: venue.id, venue_name: venue.name, status: "success",
    events_found: 0, events_created: 0, events_updated: 0,
    error_message: null, ai_input_tokens: 0, ai_output_tokens: 0, duration_ms: 0,
  };

  try {
    const html = await fetchVenueHtml(venue.calendar_url);

    const pass1 = await extractEventsPass1(html, venue.name);
    result.ai_input_tokens += pass1.inputTokens;
    result.ai_output_tokens += pass1.outputTokens;
    result.events_found = pass1.events.length;

    if (pass1.inputTokens > 0) {
      try {
        await logUsage(supabase, { userId: null, model: "deepseek-v4-flash", provider: "deepseek", feature: "event-scraper-extract", inputTokens: pass1.inputTokens, outputTokens: pass1.outputTokens, metadata: { venue_id: venue.id, venue_name: venue.name, run_id: runId, pass: 1 } });
      } catch (e) { console.error("[event-scraper] Pass 1 usage logging failed:", e); }
    }

    if (pass1.events.length === 0) {
      result.duration_ms = Date.now() - start;
      await supabase.from("scrape_logs").insert({ run_id: runId, venue_id: venue.id, venue_name: venue.name, status: result.status, events_found: 0, events_created: 0, events_updated: 0, error_message: null, ai_input_tokens: result.ai_input_tokens, ai_output_tokens: result.ai_output_tokens, duration_ms: result.duration_ms });
      return result;
    }

    let mergedEvents: MergedEvent[];
    try {
      const pass2 = await verifyEventsPass2(venue.name, pass1.events);
      result.ai_input_tokens += pass2.inputTokens;
      result.ai_output_tokens += pass2.outputTokens;
      if (pass2.inputTokens > 0) {
        try {
          await logUsage(supabase, { userId: null, model: "deepseek-v4-flash", provider: "deepseek", feature: "event-scraper-verify", inputTokens: pass2.inputTokens, outputTokens: pass2.outputTokens, metadata: { venue_id: venue.id, venue_name: venue.name, run_id: runId, pass: 2 } });
        } catch (e) { console.error("[event-scraper] Pass 2 usage logging failed:", e); }
      }
      mergedEvents = mergeExtractionResults(pass1.events, pass2.events);
    } catch (pass2Error) {
      console.error(`[event-scraper] Pass 2 failed for ${venue.name}, using Pass 1 data:`, pass2Error);
      mergedEvents = pass1.events.map((p1) => ({ ...p1, start_date: p1.start_date ?? null, end_date: p1.end_date ?? null, description: null, genre_tags: [], cast_members: null, photo_url: null, confidence: 0.5 }));
    }

    for (const event of mergedEvents) {
      const slug = generateSlug(event.title, venue.slug);
      const { data: existing } = await supabase.from("events").select("id, source").eq("slug", slug).maybeSingle();
      if (existing?.source === "manual") continue;

      const row = {
        venue_id: venue.id, title: event.title, slug, description: event.description,
        event_type: ["show", "class", "workshop", "festival", "open-call"].includes(event.event_type) ? event.event_type : "show",
        genre_tags: event.genre_tags, start_date: event.start_date, end_date: event.end_date,
        price_min: event.price_min, price_max: event.price_max,
        ticket_url: event.ticket_url || venue.calendar_url, hottix_available: false,
        show_times: event.show_times ?? null, photo_url: event.photo_url || null,
        cast_members: event.cast_members ?? null, source: "scraped" as const,
        scraped_at: new Date().toISOString(), source_url: venue.calendar_url,
        extraction_confidence: event.confidence,
      };

      if (existing) {
        const { error } = await supabase.from("events").update(row).eq("id", existing.id);
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
    if (msg.includes("DeepSeek API error")) result.status = "ai_error";
    else if (msg.includes("HTTP ") || msg.includes("fetch")) result.status = "fetch_error";
    else result.status = "parse_error";
    result.error_message = msg;
    console.error(`[event-scraper] ${venue.name}: ${msg}`);
  }

  result.duration_ms = Date.now() - start;
  await supabase.from("scrape_logs").insert({ run_id: runId, venue_id: venue.id, venue_name: venue.name, status: result.status, events_found: result.events_found, events_created: result.events_created, events_updated: result.events_updated, error_message: result.error_message, ai_input_tokens: result.ai_input_tokens, ai_output_tokens: result.ai_output_tokens, duration_ms: result.duration_ms });

  return result;
}
