import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { executeClassStrategy } from "../_shared/scraper/strategy-agent.ts";
import { processClassPrograms } from "../_shared/scraper/process-venue.ts";
import type { VenueTarget, SiteProfileRow } from "../_shared/scraper/types.ts";
import { extractRegistrableDomain } from "../_shared/scraper/politeness.ts";

const SCRAPER_SECRET = Deno.env.get("SCRAPER_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

async function getNextSchool(supabase: ReturnType<typeof createClient>): Promise<{ school: VenueTarget | null; remaining: number }> {
  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Prioritize venues with running crawl_state (resume before starting new)
  const { data: running } = await supabase
    .from("crawl_state")
    .select("venue_id")
    .eq("status", "running")
    .limit(1);

  if (running && running.length > 0) {
    const { data: venue } = await supabase
      .from("venues")
      .select("id, name, slug, calendar_url, website_url, photo_url, photo_url_source")
      .eq("id", running[0].venue_id)
      .single();
    if (venue) {
      const { count } = await supabase
        .from("venues")
        .select("id", { count: "exact", head: true })
        .eq("venue_type", "school")
        .not("calendar_url", "is", null)
        .or(`class_scraped_at.is.null,class_scraped_at.lt.${staleThreshold}`);
      return { school: venue as VenueTarget, remaining: (count ?? 0) + 1 };
    }
  }

  const { data } = await supabase
    .from("venues")
    .select("id, name, slug, calendar_url, website_url, photo_url, photo_url_source")
    .eq("venue_type", "school")
    .not("calendar_url", "is", null)
    .or(`class_scraped_at.is.null,class_scraped_at.lt.${staleThreshold}`)
    .order("class_scraped_at", { ascending: true, nullsFirst: true })
    .limit(1);

  const school = (data?.[0] as VenueTarget | undefined) ?? null;

  const { count } = await supabase
    .from("venues")
    .select("id", { count: "exact", head: true })
    .eq("venue_type", "school")
    .not("calendar_url", "is", null)
    .or(`class_scraped_at.is.null,class_scraped_at.lt.${staleThreshold}`);

  return { school, remaining: count ?? 0 };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const scraperKey = req.headers.get("x-scraper-key") ?? "";
  const bearer = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  let authed = (scraperKey.length > 0 && scraperKey === SCRAPER_SECRET);
  if (!authed && bearer.length > 0) {
    try {
      const payload = JSON.parse(atob(bearer.split(".")[1]));
      if (payload.role === "service_role" && payload.ref === "rytjrterecygirttvtdn") authed = true;
    } catch { /* not a valid JWT */ }
  }
  if (!authed && bearer.length > 0) {
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user } } = await supabaseAuth.auth.getUser(bearer);
    if (user) authed = true;
  }
  if (!authed) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* no body is fine */ }

    const jobId = body.job_id as string | undefined;
    const action = body.action as string | undefined;

    if (action === "start" || (!jobId && !action)) {
      const { data: existingJob } = await supabase
        .from("scrape_jobs")
        .select("id")
        .eq("job_type", "class")
        .eq("status", "running")
        .maybeSingle();

      if (existingJob) {
        return new Response(
          JSON.stringify({ error: "A class scrape job is already running", job_id: existingJob.id }),
          { status: 409, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
    }

    let currentJobId = jobId;

    if (action === "start") {
      const { school: firstCheck, remaining: totalSchools } = await getNextSchool(supabase);

      if (!firstCheck) {
        return new Response(
          JSON.stringify({ scraped: 0, events_found: 0, remaining: 0, job_id: null }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      const { data: newJob } = await supabase
        .from("scrape_jobs")
        .insert({ job_type: "class", status: "running", total_venues: totalSchools })
        .select("id")
        .single();
      currentJobId = newJob?.id;
    }

    if (currentJobId) {
      const { data: job } = await supabase
        .from("scrape_jobs")
        .select("status")
        .eq("id", currentJobId)
        .maybeSingle();
      if (job?.status === "cancelled" || job?.status === "completed") {
        return new Response(
          JSON.stringify({ scraped: 0, events_found: 0, remaining: 0, job_status: job.status }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
    }

    const { school, remaining } = await getNextSchool(supabase);

    if (!school) {
      if (currentJobId) {
        await supabase.from("scrape_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", currentJobId);
      }
      return new Response(
        JSON.stringify({ scraped: 0, events_found: 0, events_created: 0, remaining: 0, job_id: currentJobId, job_status: "completed" }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Resolve school name from schools table
    const { data: schoolRow } = await supabase
      .from("schools")
      .select("id, name")
      .eq("venue_id", school.id)
      .maybeSingle();

    const schoolName = schoolRow?.name ?? school.name;
    let resolvedSchoolId = schoolRow?.id;

    if (!resolvedSchoolId) {
      const { data: healed, error: healErr } = await supabase.from("schools").insert({
        name: schoolName, short_name: schoolName.slice(0, 14).toUpperCase(),
        slug: school.slug ?? schoolName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50),
        latitude: school.latitude ?? 41.8781, longitude: school.longitude ?? -87.6298,
        neighborhood: "Chicago", discipline: "acting", venue_id: school.id,
        url: school.website_url ?? school.calendar_url, address: school.address ?? null,
      }).select("id").single();
      if (healErr || !healed) {
        console.error(`[class-scrape-batch] Self-heal failed for ${school.name}: ${healErr?.message}`);
      } else {
        resolvedSchoolId = healed.id;
        console.log(`[class-scrape-batch] Auto-created school for venue ${school.name}`);
      }
    }

    let eventsFound = 0;
    let eventsCreated = 0;
    let status = "success";
    let errorMessage: string | null = null;
    let result: Awaited<ReturnType<typeof executeClassStrategy>> | null = null;

    try {
      const profileDomain = extractRegistrableDomain(school.calendar_url);
      const { data: siteProfile } = await supabase
        .from("site_profiles")
        .select("*")
        .eq("domain", profileDomain)
        .maybeSingle();

      result = await executeClassStrategy(school, schoolName, "Chicago", siteProfile as SiteProfileRow | null);

      if (result.status === "complete" || result.status === "failed" || result.status === "escalated") {
        if (result.programs.length > 0 && resolvedSchoolId) {
          const upsertResult = await processClassPrograms(
            result.programs, resolvedSchoolId, school.id, school.calendar_url, result.schoolAddress,
          );
          eventsFound = result.programs.reduce((sum, p) => sum + Math.max(p.sections.length, 1), 0);
          eventsCreated = upsertResult.created;

          if (result.programs.length > 0 && eventsCreated === 0) {
            status = "persist_failed";
            errorMessage = `${result.programs.length} programs extracted but 0 persisted`;
          }
        }

        if (result.photoUrl) {
          await supabase.from("venues").update({ photo_url: result.photoUrl, photo_url_source: "og_image" })
            .eq("id", school.id).is("photo_url", null);
          if (resolvedSchoolId) {
            await supabase.from("schools").update({ photo_url: result.photoUrl })
              .eq("id", resolvedSchoolId).is("photo_url", null);
          }
        }

        if ((result.trace as any).out_of_city) {
          await supabase.from("venues").update({ url_status: "out_of_city", status: "out_of_city" }).eq("id", school.id);
          await supabase.from("schools").update({ status: "out_of_city" }).eq("venue_id", school.id);
        }

        // Candidate→active promotion on first successful crawl with programs
        if (eventsFound > 0 && result.status === "complete") {
          const { data: venue } = await supabase.from("venues").select("status").eq("id", school.id).maybeSingle();
          if (venue?.status === "candidate") {
            await supabase.from("venues").update({ status: "active", verified_at: new Date().toISOString() }).eq("id", school.id);
            await supabase.from("schools").update({ status: "active" }).eq("venue_id", school.id);
            console.log(`[class-scrape-batch] Promoted ${school.name} from candidate to active`);
          }
        }

        await supabase.from("venues").update({ class_scraped_at: new Date().toISOString() }).eq("id", school.id);

        const trace = result.trace as any;
        const wallMs = trace.wallMs ?? null;
        const tokenSum = trace.totalInputTokens ?? null;
        await supabase.from("scrape_logs").insert({
          run_id: crypto.randomUUID(),
          venue_id: school.id,
          venue_name: school.name,
          status: status === "persist_failed" ? "persist_failed" : result.status === "complete" ? "success" : result.status,
          events_found: eventsFound,
          events_created: eventsCreated,
          events_updated: 0,
          error_message: errorMessage ?? (result.status === "failed" ? result.trace.stopReason : null),
          ai_input_tokens: tokenSum,
          ai_output_tokens: null,
          duration_ms: wallMs,
          strategy_trace: result.trace,
          cost_usd: trace.budgetUsed ?? 0,
          fetches: trace.totalFetches ?? 0,
          pages_visited: trace.linksFollowed?.length ?? 0,
        });

        if (result.status === "failed" && status !== "persist_failed") {
          status = "failed";
          errorMessage = result.trace.stopReason;
        }
      } else if (result.status === "in_progress") {
        status = "in_progress";
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[class-scrape-batch] strategy crashed for ${school.name}: ${msg}`);
      status = "error";
      errorMessage = msg;
    }

    const remainingAfter = status === "in_progress" ? remaining : remaining - 1;

    if (currentJobId) {
      const { data: currentJob } = await supabase
        .from("scrape_jobs")
        .select("schools_processed, events_found, events_created, events_updated, errors_count, recent_schools, total_cost_usd")
        .eq("id", currentJobId)
        .single();

      const skipCount = status === "in_progress" ? 0 : 1;
      const newProcessed = (currentJob?.schools_processed ?? 0) + skipCount;
      const newEventsFound = (currentJob?.events_found ?? 0) + eventsFound;
      const newEventsCreated = (currentJob?.events_created ?? 0) + eventsCreated;
      const newErrors = (currentJob?.errors_count ?? 0) + (status !== "success" && status !== "in_progress" && status !== "persist_failed" ? 1 : 0);

      const recentSchools = (currentJob?.recent_schools as Array<Record<string, unknown>> ?? []);
      const trace = result?.trace as any;
      const idx = recentSchools.findIndex((r: any) => r.venueId === school.id);
      const entry: Record<string, unknown> = {
        name: school.name, venueId: school.id, status,
        invocations: (idx >= 0 ? (((recentSchools[idx] as any).invocations as number) ?? 1) : 0) + 1,
        eventsFound, eventsCreated,
        programsExtracted: result?.programs?.length ?? 0,
        costUsd: trace?.budgetUsed ?? null,
        pagesVisited: trace?.totalFetches ?? null,
        stopReason: trace?.stopReason ?? null,
        completeness: trace?.completenessAfterFollows ?? null,
        address: result?.schoolAddress ?? null,
        calendarUrl: school.calendar_url,
        timestamp: new Date().toISOString(),
      };
      if (idx >= 0) recentSchools.splice(idx, 1);
      recentSchools.unshift(entry);
      if (recentSchools.length > 25) recentSchools.length = 25;

      const costThisInvocation = trace?.budgetUsed ?? 0;
      await supabase.from("scrape_jobs").update({
        schools_processed: newProcessed,
        events_found: newEventsFound,
        events_created: newEventsCreated,
        errors_count: newErrors,
        current_venue: school.name,
        recent_schools: recentSchools,
        total_cost_usd: ((currentJob as any)?.total_cost_usd ?? 0) + costThisInvocation,
      }).eq("id", currentJobId);

      if (remainingAfter > 0 || status === "in_progress") {
        const selfUrl = `${SUPABASE_URL}/functions/v1/class-scrape-batch`;
        const chainController = new AbortController();
        setTimeout(() => chainController.abort(), 8000);
        try {
          await fetch(selfUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "x-scraper-key": SCRAPER_SECRET },
            body: JSON.stringify({ job_id: currentJobId }),
            signal: chainController.signal,
          });
        } catch {
          // Timeout or abort is expected
        }
      } else {
        await supabase.from("scrape_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", currentJobId);
      }
    }

    return new Response(
      JSON.stringify({
        scraped: status === "in_progress" ? 0 : 1,
        events_found: eventsFound,
        events_created: eventsCreated,
        remaining: Math.max(remainingAfter, 0),
        venue_name: school.name,
        job_id: currentJobId,
        status,
        error: errorMessage,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[class-scrape-batch] Error:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
