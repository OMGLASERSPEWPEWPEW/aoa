import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { processVenue, processClassSessions } from "../_shared/scraper/process-venue.ts";
import { CLASS_FIELD_WEIGHTS } from "../_shared/scraper/completeness-evaluator.ts";
import type { VenueTarget, StrategyProfile } from "../_shared/scraper/types.ts";

const SCRAPER_SECRET = Deno.env.get("SCRAPER_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY") ?? null;

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

// FR-2: Aggregator domain blocklist
const AGGREGATOR_DOMAINS = new Set([
  "yelp.com",
  "classpass.com",
  "coursehorse.com",
  "facebook.com",
  "eventbrite.com",
  "goldstar.com",
  "groupon.com",
  "timeout.com",
  "choosechicago.com",
  "dochub.com",
  "meetup.com",
  "thumbtack.com",
  "bark.com",
  "lessons.com",
  "takelessons.com",
]);

const DISCOVERY_PROMPTS = [
  "List every improv and comedy training center in Chicago that offers adult classes. For each, provide the school name and the URL of their classes or training page. Include smaller studios, not just Second City and iO.",
  "List every acting studio in Chicago that offers adult classes in Meisner, scene study, on-camera, voiceover, or audition technique. For each, provide the school name and website URL. Include independent studios and conservatories, not just university programs.",
  "List every musical theater, physical theater, sketch comedy, and comedy writing school in Chicago that offers adult classes or workshops. For each, provide the school name and website URL.",
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

function isAggregatorDomain(domain: string): boolean {
  return [...AGGREGATOR_DOMAINS].some(agg =>
    domain === agg || domain.endsWith(`.${agg}`)
  );
}

// --- FR-4: Discovery observability logging ---

interface DiscoveryLogEntry {
  run_id: string;
  query: string;
  raw_url: string;
  raw_title: string;
  domain: string;
  disposition: "queued" | "blocked_aggregator" | "already_known_venue" | "already_in_queue" | "insert_error";
  reason?: string;
}

async function logDiscoveryResult(entry: DiscoveryLogEntry): Promise<void> {
  try {
    await supabase.from("discovery_logs").insert(entry);
  } catch {
    console.warn("[class-discovery] Failed to write discovery_log entry for", entry.raw_url);
  }
}

// --- SerpAPI school discovery ---

interface DiscoveryResult {
  query: string;
  link: string;
  title: string;
  snippet: string;
  domain: string;
}

async function searchForSchools(): Promise<{ results: DiscoveryResult[]; queriesRun: number }> {
  if (!PERPLEXITY_API_KEY) return { results: [], queriesRun: 0 };

  const allResults: DiscoveryResult[] = [];
  const seenDomains = new Set<string>();
  let queriesRun = 0;

  for (const prompt of DISCOVERY_PROMPTS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      let res: Response;
      try {
        res = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 2000,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`[class-discovery] Perplexity ${res.status}: ${errBody.slice(0, 200)}`);
        await logDiscoveryResult({
          run_id: "api-error",
          query: prompt.slice(0, 60),
          raw_url: "https://api.perplexity.ai",
          raw_title: `Perplexity API error ${res.status}`,
          domain: "perplexity.ai",
          disposition: "insert_error",
          reason: `HTTP ${res.status}: ${errBody.slice(0, 200)}`,
        });
        continue;
      }

      queriesRun++;
      const data = await res.json();
      const text: string = data.choices?.[0]?.message?.content ?? "";

      const urlMatches = text.matchAll(/https?:\/\/[^\s"'<>)\]]+/g);
      for (const m of urlMatches) {
        const link = m[0].replace(/[.,;:!?)]+$/, "");
        const domain = extractDomain(link);
        if (!domain || seenDomains.has(domain)) continue;
        seenDomains.add(domain);

        const nameMatch = text.substring(Math.max(0, m.index! - 120), m.index!).match(/(?:\*\*|^|\n)([A-Z][A-Za-z\s&''.\-]+?)(?:\*\*|:|\s*[-–—]\s*|\s*\()/);
        const title = nameMatch ? nameMatch[1].trim() : domain;

        allResults.push({
          query: prompt.slice(0, 60),
          link,
          title,
          snippet: text.substring(Math.max(0, m.index! - 50), Math.min(text.length, m.index! + link.length + 80)).trim(),
          domain,
        });
      }

      await delay(500);
    } catch (err) {
      console.warn(`[class-discovery] Perplexity search failed:`, err);
    }
  }

  return { results: allResults, queriesRun };
}

async function deduplicateAndQueue(
  results: SerpSearchResult[],
  runId: string,
): Promise<{ queued: number; known: number; blocked: number }> {
  // FR-2: Pre-filter aggregator domains
  const filtered: SerpSearchResult[] = [];
  let blocked = 0;

  for (const result of results) {
    if (isAggregatorDomain(result.domain)) {
      blocked++;
      await logDiscoveryResult({
        run_id: runId,
        query: result.query,
        raw_url: result.link,
        raw_title: result.title,
        domain: result.domain,
        disposition: "blocked_aggregator",
        reason: "Domain matched aggregator blocklist",
      });
      continue;
    }
    filtered.push(result);
  }

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

  const queuedDomains = new Set<string>();
  for (const q of queuedVenues ?? []) {
    if (q.raw_website_url) queuedDomains.add(extractDomain(q.raw_website_url));
    if (q.detail_page_url) queuedDomains.add(extractDomain(q.detail_page_url));
  }

  let queued = 0;
  let known = 0;

  for (const result of filtered) {
    if (existingDomains.has(result.domain)) {
      known++;
      await logDiscoveryResult({
        run_id: runId,
        query: result.query,
        raw_url: result.link,
        raw_title: result.title,
        domain: result.domain,
        disposition: "already_known_venue",
        reason: "Domain matches existing venue",
      });
      continue;
    }

    if (queuedDomains.has(result.domain)) {
      known++;
      await logDiscoveryResult({
        run_id: runId,
        query: result.query,
        raw_url: result.link,
        raw_title: result.title,
        domain: result.domain,
        disposition: "already_in_queue",
        reason: "Domain already in discovery queue",
      });
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
      await logDiscoveryResult({
        run_id: runId,
        query: result.query,
        raw_url: result.link,
        raw_title: result.title,
        domain: result.domain,
        disposition: "insert_error",
        reason: error.message,
      });
    } else {
      existingDomains.add(result.domain);
      queuedDomains.add(result.domain);
      queued++;
      await logDiscoveryResult({
        run_id: runId,
        query: result.query,
        raw_url: result.link,
        raw_title: result.title,
        domain: result.domain,
        disposition: "queued",
      });
    }
  }

  return { queued, known, blocked };
}

// --- Get next unprocessed school for this job ---

async function getNextSchool(
  jobId: string,
  processedIds: string[],
): Promise<{ school: VenueTarget | null; totalSchools: number; remaining: number }> {
  const { data: schools, error } = await supabase
    .from("venues")
    .select("id, name, slug, calendar_url, website_url, photo_url, photo_url_source")
    .eq("venue_type", "school")
    .not("calendar_url", "is", null);

  if (error || !schools) return { school: null, totalSchools: 0, remaining: 0 };

  const unprocessed = schools.filter((s) => !processedIds.includes(s.id));
  const next = unprocessed.length > 0 ? unprocessed[0] as VenueTarget : null;

  return {
    school: next,
    totalSchools: schools.length,
    remaining: unprocessed.length,
  };
}

// --- FR-1: Standalone discovery action ---

async function runDiscoverAction(runId: string, cors: Record<string, string>): Promise<Response> {
  if (!PERPLEXITY_API_KEY) {
    return new Response(
      JSON.stringify({ action: "discover", run_id: runId, queued: 0, known: 0, blocked: 0, queries_run: 0, warning: "PERPLEXITY_API_KEY not set" }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const { results: serpResults, queriesRun } = await searchForSchools();
  const { queued, known, blocked } = await deduplicateAndQueue(serpResults, runId);

  console.log(`[class-discovery] Discovery run ${runId}: ${queriesRun} queries, ${serpResults.length} raw results, ${blocked} blocked, ${known} known, ${queued} queued`);

  return new Response(
    JSON.stringify({ action: "discover", run_id: runId, queued, known, blocked, queries_run: queriesRun }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
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

  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* no body is fine */ }

    const jobId = body.job_id as string | undefined;
    const action = body.action as string | undefined;
    const processedIds = (body.processed_ids as string[]) ?? [];

    // FR-1: Standalone discovery action — runs SerpAPI immediately, independent of school scraping
    if (action === "discover") {
      const runId = crypto.randomUUID();
      return await runDiscoverAction(runId, cors);
    }

    // --- Start a new scrape job ---
    if (action === "start" || (!jobId && !action)) {
      const { data: existingJob } = await supabase
        .from("scrape_jobs")
        .select("id")
        .eq("job_type", "class")
        .eq("status", "running")
        .maybeSingle();

      if (existingJob) {
        return new Response(
          JSON.stringify({ error: "A class discovery job is already running", job_id: existingJob.id }),
          { status: 409, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      const { school, totalSchools } = await getNextSchool("", []);

      if (!school) {
        return new Response(
          JSON.stringify({ job_id: null, schools_processed: 0, remaining: 0 }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      const { data: newJob } = await supabase
        .from("scrape_jobs")
        .insert({
          job_type: "class",
          status: "running",
          total_venues: totalSchools,
        })
        .select("id")
        .single();

      const newJobId = newJob?.id;
      const runId = crypto.randomUUID();
      const result = await processFirstSchool(school, runId, newJobId!, []);

      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // --- Continue an existing job ---
    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "Missing job_id for continuation" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const { data: job } = await supabase
      .from("scrape_jobs")
      .select("status")
      .eq("id", jobId)
      .maybeSingle();

    if (!job || job.status === "cancelled" || job.status === "completed") {
      return new Response(
        JSON.stringify({ job_id: jobId, job_status: job?.status ?? "not_found" }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const { school, remaining } = await getNextSchool(jobId, processedIds);

    if (!school) {
      // All schools processed — just complete, no SerpAPI (FR-1: discovery is decoupled)
      await supabase.from("scrape_jobs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);

      return new Response(
        JSON.stringify({ job_id: jobId, job_status: "completed", remaining: 0 }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const runId = crypto.randomUUID();
    const result = await processFirstSchool(school, runId, jobId, processedIds);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[class-discovery] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});

async function processFirstSchool(
  school: VenueTarget,
  runId: string,
  jobId: string,
  previousProcessedIds: string[],
): Promise<Record<string, unknown>> {
  console.log(`[class-discovery] Processing school: ${school.name}`);

  const result = await processVenue(school, runId, {
    profile: CLASS_PROFILE,
    defaultEventType: "class",
  });

  try {
    if (result.status === "success" && result.events_found > 0) {
      const { data: schoolRow } = await supabase
        .from("schools")
        .select("id")
        .eq("venue_id", school.id)
        .maybeSingle();

      if (schoolRow) {
        const { data: eventsForSchool } = await supabase
          .from("events")
          .select("title, event_type, start_date, price_min, price_max, ticket_url, skill_level, session_count, class_format, instructor_name")
          .eq("venue_id", school.id)
          .eq("source", "scraped")
          .in("event_type", ["class", "workshop"]);

        if (eventsForSchool && eventsForSchool.length > 0) {
          await processClassSessions(
            eventsForSchool as any[],
            schoolRow.id,
            school.calendar_url,
          );
        }
      }
    }
  } catch (e) {
    console.error(`[class-discovery] class_sessions processing failed for ${school.name}:`, e instanceof Error ? e.message : e);
  }

  const { data: currentJob } = await supabase
    .from("scrape_jobs")
    .select("schools_processed, events_found, events_created, events_updated, errors_count, recent_schools")
    .eq("id", jobId)
    .single();

  const newProcessed = (currentJob?.schools_processed ?? 0) + 1;
  const newEventsFound = (currentJob?.events_found ?? 0) + result.events_found;
  const newEventsCreated = (currentJob?.events_created ?? 0) + result.events_created;
  const newEventsUpdated = (currentJob?.events_updated ?? 0) + result.events_updated;
  const newErrors = (currentJob?.errors_count ?? 0) + (result.status !== "success" ? 1 : 0);

  const recentSchools = (currentJob?.recent_schools as Array<Record<string, unknown>> ?? []);
  recentSchools.unshift({
    name: school.name,
    status: result.status,
    eventsFound: result.events_found,
    eventsCreated: result.events_created,
  });
  if (recentSchools.length > 20) recentSchools.length = 20;

  await supabase.from("scrape_jobs").update({
    schools_processed: newProcessed,
    events_found: newEventsFound,
    events_created: newEventsCreated,
    events_updated: newEventsUpdated,
    errors_count: newErrors,
    current_venue: school.name,
    recent_schools: recentSchools,
  }).eq("id", jobId);

  const allProcessedIds = [...previousProcessedIds, school.id];
  const { remaining } = await getNextSchool(jobId, allProcessedIds);

  if (remaining > 0) {
    const selfUrl = `${SUPABASE_URL}/functions/v1/class-discovery`;
    const chainController = new AbortController();
    setTimeout(() => chainController.abort(), 8000);
    try {
      await fetch(selfUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "x-scraper-key": SCRAPER_SECRET,
        },
        body: JSON.stringify({
          job_id: jobId,
          processed_ids: allProcessedIds,
        }),
        signal: chainController.signal,
      });
    } catch {
      // Timeout or abort is expected — the next invocation runs independently
    }
  } else {
    // FR-1: No runSerpSearch here — discovery is decoupled
    await supabase.from("scrape_jobs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);
  }

  return {
    job_id: jobId,
    school: school.name,
    events_found: result.events_found,
    events_created: result.events_created,
    remaining,
  };
}
