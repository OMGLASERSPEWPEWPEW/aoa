import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { processVenue, processClassSessions } from "../_shared/scraper/process-venue.ts";
import { CLASS_FIELD_WEIGHTS } from "../_shared/scraper/completeness-evaluator.ts";
import type { VenueTarget, ScrapeResult, StrategyProfile } from "../_shared/scraper/types.ts";

// --- Config ---

const SCRAPER_SECRET = Deno.env.get("SCRAPER_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY") ?? null;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CLASS_PROFILE: StrategyProfile = {
  domain: "class",
  fieldWeights: CLASS_FIELD_WEIGHTS,
  logFeaturePrefix: "class-discovery",
};

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

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
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

  const { data: existingVenues } = await supabase
    .from("venues")
    .select("website_url, calendar_url");

  const existingDomains = new Set<string>();
  for (const v of existingVenues ?? []) {
    if (v.website_url) existingDomains.add(extractDomain(v.website_url));
    if (v.calendar_url) existingDomains.add(extractDomain(v.calendar_url));
  }

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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // --- Phase 1: Scrape each school using the shared strategy tree ---
      const scrapeResults: ScrapeResult[] = [];

      for (let i = 0; i < schoolsWithCalendar.length; i++) {
        const school = schoolsWithCalendar[i];
        console.log(`[class-discovery] Scraping school ${i + 1}/${schoolsWithCalendar.length}: ${school.name}`);

        const result = await processVenue(school, runId, {
          profile: CLASS_PROFILE,
          defaultEventType: "class",
        });
        scrapeResults.push(result);

        // Write scraped classes to class_sessions table
        try {
          if (result.status === "success" && result.events_found > 0) {
            const { data: schoolRow, error: schoolErr } = await supabase
              .from("schools")
              .select("id")
              .eq("venue_id", school.id)
              .maybeSingle();

            if (schoolErr) {
              console.error(`[class-discovery] School lookup failed for ${school.name}:`, schoolErr.message);
            } else if (schoolRow) {
              const { data: eventsForSchool, error: eventsErr } = await supabase
                .from("events")
                .select("title, event_type, start_date, price_min, price_max, ticket_url, skill_level, session_count, class_format, instructor_name")
                .eq("venue_id", school.id)
                .eq("source", "scraped")
                .in("event_type", ["class", "workshop"]);

              if (eventsErr) {
                console.error(`[class-discovery] Events query failed for ${school.name}:`, eventsErr.message);
              } else if (eventsForSchool && eventsForSchool.length > 0) {
                const sessionResult = await processClassSessions(
                  eventsForSchool as any[],
                  schoolRow.id,
                  school.calendar_url,
                );
                controller.enqueue(
                  encoder.encode(JSON.stringify({ type: "class_sessions", data: { school: school.name, ...sessionResult } }) + "\n"),
                );
              }
            } else {
              console.warn(`[class-discovery] No school row found for venue ${school.name} (venue_id: ${school.id})`);
            }
          }
        } catch (e) {
          console.error(`[class-discovery] class_sessions processing failed for ${school.name}:`, e instanceof Error ? e.message : e);
        }

        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "school_scrape", data: result }) + "\n"),
        );

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
