import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { processVenue, processClassSessions } from "../_shared/scraper/process-venue.ts";
import { CLASS_FIELD_WEIGHTS } from "../_shared/scraper/completeness-evaluator.ts";
import type { VenueTarget, StrategyProfile } from "../_shared/scraper/types.ts";
import { geocode } from "../_shared/geocoder.ts";

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
  "List every musical theater performance training program, physical theater, sketch comedy, and comedy writing program in Chicago that offers adult classes or workshops. Exclude music conservatories, instrumental music schools, classical music programs, dance-only studios, and orchestral training. For each, provide the school name and website URL.",
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

async function extractAddressFromUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      headers: { "User-Agent": "ArtOfArt-EventBot/1.0" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();

    const patterns = [
      /(\d{1,5}\s+[NSEW]\.?\s+[\w\s.]+(?:Ave|Avenue|St|Street|Blvd|Boulevard|Rd|Road|Dr|Drive|Way|Ln|Lane|Pl|Place|Ct|Court)\.?(?:\s*,?\s*(?:Suite|Ste|Unit|Apt|#)\s*[\w-]+)?)\s*,?\s*Chicago/i,
      /(\d{1,5}\s+[\w\s.]+(?:Ave|Avenue|St|Street|Blvd|Boulevard|Rd|Road|Dr|Drive|Way|Ln|Lane|Pl|Place|Ct|Court)\.?(?:\s*,?\s*(?:Suite|Ste|Unit|Apt|#)\s*[\w-]+)?)\s*,?\s*Chicago/i,
    ];

    for (const pat of patterns) {
      const m = html.match(pat);
      if (m) return `${m[1]}, Chicago, IL`;
    }
    return null;
  } catch {
    return null;
  }
}

async function geocodeSchool(name: string, websiteUrl: string): Promise<{ lat: number; lng: number }> {
  const address = await extractAddressFromUrl(websiteUrl);
  if (address) {
    const geo = await geocode(address);
    if (geo) {
      console.log(`[class-discovery] Geocoded ${name} via address: ${address} → ${geo.lat}, ${geo.lng}`);
      return { lat: geo.lat, lng: geo.lng };
    }
  }

  const geo = await geocode(`${name}, Chicago, IL`);
  if (geo) {
    console.log(`[class-discovery] Geocoded ${name} via name → ${geo.lat}, ${geo.lng}`);
    return { lat: geo.lat, lng: geo.lng };
  }

  console.log(`[class-discovery] Could not geocode ${name}, using Chicago center`);
  return { lat: 41.8781, lng: -87.6298 };
}

function humanizeDomain(domain: string): string {
  const base = domain.replace(/\.(com|org|net|edu|co|io)$/i, "");
  return base
    .split(/[-.]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function extractSchoolName(text: string, urlIndex: number, domain: string): string {
  const window = text.substring(Math.max(0, urlIndex - 250), urlIndex);

  const bold = window.match(/\*\*([^*]{3,60})\*\*[^*]*$/);
  if (bold) return bold[1].trim();

  const numbered = window.match(/\d+\.\s+\*?\*?([A-Z][A-Za-z0-9\s&'''.,\-/]+?)\*?\*?\s*[-–—:(]\s*[^]*$/);
  if (numbered) return numbered[1].trim();

  const bulleted = window.match(/[-•]\s+\*?\*?([A-Z][A-Za-z0-9\s&'''.,\-/]+?)\*?\*?\s*[-–—:(]\s*[^]*$/);
  if (bulleted) return bulleted[1].trim();

  const loose = window.match(/(?:^|\n)\s*([A-Z][A-Za-z0-9\s&'''.,\-/]{2,55}?)(?:\s*[-–—:(]|\s*https?:)/);
  if (loose) return loose[1].trim();

  return humanizeDomain(domain);
}

// --- FR-4: Discovery observability logging ---

interface DiscoveryLogEntry {
  run_id: string;
  query: string;
  raw_url: string;
  raw_title: string;
  domain: string;
  disposition: "inserted" | "queued" | "blocked_aggregator" | "already_known_venue" | "already_in_queue" | "insert_error";
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

      const urlMatches = text.matchAll(/https?:\/\/[^\s"'<>)\[\]]+/g);
      for (const m of urlMatches) {
        const link = m[0].replace(/[.,;:!?)]+$/, "").replace(/\[\d*$/, "");
        const domain = extractDomain(link);
        if (!domain || seenDomains.has(domain)) continue;
        seenDomains.add(domain);

        const title = extractSchoolName(text, m.index!, domain);

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

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

async function resolveUniqueSlug(baseSlug: string): Promise<string> {
  const { data } = await supabase.from("venues").select("slug").eq("slug", baseSlug).maybeSingle();
  if (!data) return baseSlug;
  for (let i = 2; i <= 10; i++) {
    const candidate = `${baseSlug}-${i}`;
    const { data: dup } = await supabase.from("venues").select("slug").eq("slug", candidate).maybeSingle();
    if (!dup) return candidate;
  }
  return `${baseSlug}-${Date.now()}`;
}

async function deduplicateAndInsert(
  results: DiscoveryResult[],
  runId: string,
): Promise<{ inserted: number; known: number; blocked: number }> {
  const filtered: DiscoveryResult[] = [];
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

  let inserted = 0;
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

    const slug = await resolveUniqueSlug(generateSlug(result.title));

    const { lat, lng } = await geocodeSchool(result.title, result.link);
    await delay(1100);

    const { data: newVenue, error: venueError } = await supabase.from("venues").insert({
      name: result.title,
      slug,
      venue_type: "school",
      website_url: result.link,
      calendar_url: result.link,
      city: "chicago",
      source: "discovery",
      latitude: lat,
      longitude: lng,
    }).select("id").single();

    if (venueError) {
      await logDiscoveryResult({
        run_id: runId,
        query: result.query,
        raw_url: result.link,
        raw_title: result.title,
        domain: result.domain,
        disposition: "insert_error",
        reason: `Venue insert: ${venueError.message}`,
      });
      continue;
    }

    const { error: schoolError } = await supabase.from("schools").insert({
      name: result.title,
      short_name: result.title.slice(0, 14).toUpperCase(),
      slug,
      latitude: lat,
      longitude: lng,
      neighborhood: "Chicago",
      discipline: "acting",
      venue_id: newVenue.id,
      url: result.link,
    });

    if (schoolError) {
      console.warn(`[class-discovery] School insert failed for ${result.title}: ${schoolError.message}`);
    }

    existingDomains.add(result.domain);
    inserted++;
    await logDiscoveryResult({
      run_id: runId,
      query: result.query,
      raw_url: result.link,
      raw_title: result.title,
      domain: result.domain,
      disposition: "inserted",
    });
  }

  return { inserted, known, blocked };
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
      JSON.stringify({ action: "discover", run_id: runId, inserted: 0, known: 0, blocked: 0, queries_run: 0, warning: "PERPLEXITY_API_KEY not set" }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const { results: serpResults, queriesRun } = await searchForSchools();
  const { inserted, known, blocked } = await deduplicateAndInsert(serpResults, runId);

  console.log(`[class-discovery] Discovery run ${runId}: ${queriesRun} queries, ${serpResults.length} raw results, ${blocked} blocked, ${known} known, ${inserted} inserted`);

  return new Response(
    JSON.stringify({ action: "discover", run_id: runId, inserted, known, blocked, queries_run: queriesRun, schools: serpResults.map(r => ({ name: r.title, url: r.link, domain: r.domain })) }),
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

    // Geocode backfill — fix existing schools stuck at Chicago center
    if (action === "geocode-backfill") {
      const { data: stuckSchools } = await supabase
        .from("schools")
        .select("id, name, url, venue_id, latitude, longitude")
        .eq("latitude", 41.8781)
        .eq("longitude", -87.6298);

      let updated = 0;
      for (const school of stuckSchools ?? []) {
        const { lat, lng } = await geocodeSchool(school.name, school.url ?? "");
        if (lat !== 41.8781 || lng !== -87.6298) {
          await supabase.from("schools").update({ latitude: lat, longitude: lng }).eq("id", school.id);
          await supabase.from("venues").update({ latitude: lat, longitude: lng }).eq("id", school.venue_id);
          updated++;
        }
        await delay(1100);
      }

      return new Response(
        JSON.stringify({ action: "geocode-backfill", total: stuckSchools?.length ?? 0, updated }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // --- Start a new scrape job ---
    if (action === "start" || (!jobId && !action)) {
      // Auto-cleanup stale jobs (stuck > 30 min)
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      await supabase
        .from("scrape_jobs")
        .update({ status: "failed", error: "Stale job auto-cleanup (>30 min)" })
        .eq("job_type", "class")
        .eq("status", "running")
        .lt("created_at", thirtyMinAgo);

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
      const result = await processSchoolWithEarlyChain(school, runId, newJobId!, []);

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
    const result = await processSchoolWithEarlyChain(school, runId, jobId, processedIds);

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

// Fire chain BEFORE processing so the next invocation starts independently,
// even if the current school takes longer than the Deno isolate timeout.
function fireChain(jobId: string, processedIds: string[]): void {
  const selfUrl = `${SUPABASE_URL}/functions/v1/class-discovery`;
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 8000);
  fetch(selfUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "x-scraper-key": SCRAPER_SECRET,
    },
    body: JSON.stringify({ job_id: jobId, processed_ids: processedIds }),
    signal: controller.signal,
  }).then(
    (r) => console.log(`[class-discovery] Chain fired: ${r.status}`),
    () => console.log("[class-discovery] Chain aborted (expected)"),
  );
}

async function processSchoolWithEarlyChain(
  school: VenueTarget,
  runId: string,
  jobId: string,
  previousProcessedIds: string[],
): Promise<Record<string, unknown>> {
  const allProcessedIds = [...previousProcessedIds, school.id];

  // Check remaining BEFORE processing — fire chain immediately
  const { remaining } = await getNextSchool(jobId, allProcessedIds);
  if (remaining > 0) {
    console.log(`[class-discovery] Early chain: ${remaining} remaining after ${school.name}`);
    fireChain(jobId, allProcessedIds);
  }

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

  const trace = result.strategy_links_followed !== undefined ? {
    stopReason: result.strategy_stop_reason ?? null,
    aiCalls: (result as any).ai_input_tokens !== undefined ? Math.round(((result as any).ai_input_tokens + (result as any).ai_output_tokens) / 1000) : null,
    fetches: result.strategy_links_followed ?? 0,
    durationMs: result.duration_ms,
    modelResults: null as unknown,
  } : null;

  if (trace) {
    const { data: logRow } = await supabase
      .from("scrape_logs")
      .select("strategy_trace")
      .eq("venue_id", school.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (logRow?.strategy_trace) {
      const steps = (logRow.strategy_trace as any).steps ?? [];
      const initialStep = steps.find((s: any) => s.step === "initial_extract");
      trace.modelResults = initialStep?.modelResults ?? null;
      trace.aiCalls = (logRow.strategy_trace as any).totalAiCalls ?? trace.aiCalls;
      trace.fetches = (logRow.strategy_trace as any).totalFetches ?? trace.fetches;
      trace.stopReason = (logRow.strategy_trace as any).stopReason ?? trace.stopReason;
    }
  }

  const recentSchools = (currentJob?.recent_schools as Array<Record<string, unknown>> ?? []);
  recentSchools.unshift({
    name: school.name,
    status: result.status,
    eventsFound: result.events_found,
    eventsCreated: result.events_created,
    durationMs: result.duration_ms,
    errorMessage: result.error_message,
    calendarUrl: school.calendar_url,
    websiteUrl: school.website_url ?? null,
    trace,
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

  if (remaining === 0) {
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
