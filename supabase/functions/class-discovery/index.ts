import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { cleanHtml } from "../_shared/scraper/html-cleaner.ts";
import { buildExtractionPrompt } from "../_shared/scraper/extraction-prompt.ts";
import { buildVerificationPrompt } from "../_shared/scraper/verification-prompt.ts";
import { generateSlug } from "../_shared/scraper/slug-generator.ts";
import type {
  VenueTarget,
  ScrapeResult,
  DeepSeekResponse,
  Pass1Event,
  Pass2Verification,
} from "../_shared/scraper/types.ts";
import { logUsage } from "../_shared/logUsage.ts";

// --- Config ---

const SCRAPER_SECRET = Deno.env.get("SCRAPER_SECRET")!;
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY") ?? null;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ALLOWED_ORIGINS = [
  "http://localhost:5204",
  "https://aoa-nine.vercel.app",
];

// --- CORS ---

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

// --- Helpers ---

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string): Promise<string> {
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

// --- AI Extraction (reuses shared prompts) ---

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

// --- Merged event with class fields ---

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

// --- School scraping (processSchool is analogous to processVenue) ---

async function processSchool(
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
    const html = await fetchHtml(venue.calendar_url);

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
          feature: "class-discovery-extract",
          inputTokens: pass1.inputTokens,
          outputTokens: pass1.outputTokens,
          metadata: { venue_id: venue.id, venue_name: venue.name, run_id: runId, pass: 1 },
        });
      } catch (e) {
        console.error("[class-discovery] Pass 1 usage logging failed:", e);
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
            feature: "class-discovery-verify",
            inputTokens: pass2.inputTokens,
            outputTokens: pass2.outputTokens,
            metadata: { venue_id: venue.id, venue_name: venue.name, run_id: runId, pass: 2 },
          });
        } catch (e) {
          console.error("[class-discovery] Pass 2 usage logging failed:", e);
        }
      }

      mergedEvents = mergeExtractionResults(pass1.events, pass2.events);
    } catch (pass2Error) {
      console.error(`[class-discovery] Pass 2 failed for ${venue.name}, using Pass 1 data:`, pass2Error);
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
          ? event.event_type : "class",
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
    if (msg.includes("DeepSeek API error")) {
      result.status = "ai_error";
    } else if (msg.includes("HTTP ") || msg.includes("fetch")) {
      result.status = "fetch_error";
    } else {
      result.status = "parse_error";
    }
    result.error_message = msg;
    console.error(`[class-discovery] ${venue.name}: ${msg}`);
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

// --- SerpAPI school discovery ---

interface SerpSearchResult {
  query: string;
  link: string;
  title: string;
  snippet: string;
  domain: string;
}

const CLASS_SEARCH_QUERIES = [
  "chicago improv classes 2026",
  "chicago acting classes adults 2026",
  "chicago theater workshops beginners 2026",
  "chicago sketch comedy classes 2026",
  "chicago musical theater classes adults 2026",
];

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function searchForSchools(): Promise<SerpSearchResult[]> {
  if (!SERPAPI_KEY) return [];

  const allResults: SerpSearchResult[] = [];
  const seenDomains = new Set<string>();

  for (const query of CLASS_SEARCH_QUERIES) {
    try {
      const params = new URLSearchParams({
        q: query,
        location: "Chicago, Illinois, United States",
        hl: "en",
        gl: "us",
        num: "10",
        api_key: SERPAPI_KEY,
        engine: "google",
      });

      const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
      if (!res.ok) {
        console.warn(`[class-discovery] SerpAPI error for "${query}": HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const organicResults = data.organic_results ?? [];

      for (const r of organicResults) {
        const link = r.link as string;
        if (!link) continue;
        const domain = extractDomain(link);
        if (seenDomains.has(domain)) continue;
        seenDomains.add(domain);

        allResults.push({
          query,
          link,
          title: r.title ?? "",
          snippet: r.snippet ?? "",
          domain,
        });
      }

      // Rate limit between queries
      await delay(500);
    } catch (err) {
      console.warn(`[class-discovery] SerpAPI fetch failed for "${query}":`, err);
    }
  }

  return allResults;
}

async function deduplicateAndQueue(
  results: SerpSearchResult[],
  runId: string,
): Promise<Array<{ query: string; link: string; queued: boolean; reason?: string }>> {
  const output: Array<{ query: string; link: string; queued: boolean; reason?: string }> = [];

  // Get existing venue domains for dedup
  const { data: existingVenues } = await supabase
    .from("venues")
    .select("website_url, calendar_url");

  const existingDomains = new Set<string>();
  for (const v of existingVenues ?? []) {
    if (v.website_url) existingDomains.add(extractDomain(v.website_url));
    if (v.calendar_url) existingDomains.add(extractDomain(v.calendar_url));
  }

  // Also check domains already in the discovery queue
  const { data: queuedVenues } = await supabase
    .from("venue_discovery_queue")
    .select("raw_website_url, detail_page_url");

  for (const q of queuedVenues ?? []) {
    if (q.raw_website_url) existingDomains.add(extractDomain(q.raw_website_url));
    if (q.detail_page_url) existingDomains.add(extractDomain(q.detail_page_url));
  }

  for (const result of results) {
    if (existingDomains.has(result.domain)) {
      output.push({ query: result.query, link: result.link, queued: false, reason: "already_known" });
      continue;
    }

    // Queue as a new potential school venue
    const { error } = await supabase.from("venue_discovery_queue").insert({
      source_id: null,
      run_id: runId,
      raw_name: result.title,
      raw_address: null,
      raw_website_url: result.link,
      raw_genre_tags: [],
      raw_neighborhood: null,
      raw_category: "school",
      raw_description: result.snippet,
      raw_phone: null,
      raw_photo_url: null,
      detail_page_url: result.link,
    });

    if (error) {
      // Likely a unique constraint violation — already queued
      output.push({ query: result.query, link: result.link, queued: false, reason: "insert_error" });
    } else {
      existingDomains.add(result.domain);
      output.push({ query: result.query, link: result.link, queued: true });
    }
  }

  return output;
}

// --- Main handler ---

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  // Auth: same pattern as event-scraper
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
  console.log(`[class-discovery] Starting run ${runId}`);

  // Fetch school venues (venue_type = 'school')
  const { data: schools, error: schoolError } = await supabase
    .from("venues")
    .select("id, name, slug, calendar_url, website_url, photo_url, photo_url_source")
    .eq("venue_type", "school");

  if (schoolError || !schools) {
    return new Response(
      JSON.stringify({ error: "Failed to load school venues", detail: schoolError?.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const schoolsWithCalendar = schools.filter((s) => s.calendar_url) as VenueTarget[];

  // Stream results as NDJSON
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // --- Phase 1: Scrape each school's calendar for class events ---
      const scrapeResults: ScrapeResult[] = [];

      for (let i = 0; i < schoolsWithCalendar.length; i++) {
        const school = schoolsWithCalendar[i];
        console.log(`[class-discovery] Scraping school ${i + 1}/${schoolsWithCalendar.length}: ${school.name}`);

        const result = await processSchool(school, runId);
        scrapeResults.push(result);

        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "school_scrape", data: result }) + "\n"),
        );

        // Rate limit between schools
        if (i < schoolsWithCalendar.length - 1) {
          await delay(1000);
        }
      }

      // --- Phase 2: SerpAPI search for new schools (optional) ---
      let searchResults: Array<{ query: string; link: string; queued: boolean; reason?: string }> = [];
      let searchWarning: string | null = null;

      if (SERPAPI_KEY) {
        try {
          const serpResults = await searchForSchools();
          searchResults = await deduplicateAndQueue(serpResults, runId);

          for (const sr of searchResults) {
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: "search_result", data: sr }) + "\n"),
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          searchWarning = `SerpAPI search failed: ${msg}`;
          console.error(`[class-discovery] ${searchWarning}`);
        }
      } else {
        searchWarning = "SERPAPI_KEY not set — skipping web search for new schools";
        console.warn(`[class-discovery] ${searchWarning}`);
      }

      // --- Summary ---
      const summary: Record<string, unknown> = {
        run_id: runId,
        schools_scraped: scrapeResults.length,
        total_events_found: scrapeResults.reduce((s, r) => s + r.events_found, 0),
        total_created: scrapeResults.reduce((s, r) => s + r.events_created, 0),
        total_updated: scrapeResults.reduce((s, r) => s + r.events_updated, 0),
        scrape_errors: scrapeResults.filter((r) => r.status !== "success").length,
        ai_input_tokens: scrapeResults.reduce((s, r) => s + r.ai_input_tokens, 0),
        ai_output_tokens: scrapeResults.reduce((s, r) => s + r.ai_output_tokens, 0),
        search_results_total: searchResults.length,
        search_results_queued: searchResults.filter((r) => r.queued).length,
        search_results_known: searchResults.filter((r) => !r.queued).length,
      };

      if (searchWarning) {
        summary.warning = searchWarning;
      }

      controller.enqueue(
        encoder.encode(JSON.stringify({ type: "summary", data: summary }) + "\n"),
      );

      console.log(
        `[class-discovery] Run ${runId} complete: ${summary.schools_scraped} schools scraped, ` +
        `${summary.total_events_found} events found, ${summary.total_created} created, ` +
        `${summary.total_updated} updated, ${summary.scrape_errors} errors, ` +
        `${summary.search_results_queued} new schools queued`,
      );

      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { ...cors, "Content-Type": "application/x-ndjson" },
  });
});
