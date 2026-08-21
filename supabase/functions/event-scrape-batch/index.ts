import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { processVenue } from "../_shared/scraper/process-venue.ts";
import type { VenueTarget } from "../_shared/scraper/types.ts";
import { isEntityBlocked } from "../_shared/curator/blocklist.ts";

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

const SCRAPER_SECRET = Deno.env.get("SCRAPER_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH_SIZE = 1;

async function getNextVenue(supabase: ReturnType<typeof createClient>): Promise<{ venues: VenueTarget[]; remaining: number }> {
  const { data: gapVenueRows } = await supabase
    .from("events")
    .select("venue_id")
    .is("start_date", null)
    .eq("source", "scraped");
  const gapVenueIds = [...new Set((gapVenueRows ?? []).map((r: { venue_id: string }) => r.venue_id))];

  let venues: VenueTarget[] | null = null;

  if (gapVenueIds.length > 0) {
    const { data } = await supabase
      .from("venues")
      .select("id, name, slug, calendar_url, website_url, photo_url, photo_url_source")
      .not("calendar_url", "is", null)
      .in("id", gapVenueIds)
      .or("scraped_at.is.null,scraped_at.lt." + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("scraped_at", { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE * 3);  // fetch extra to account for blocked venues
    venues = (data as VenueTarget[]) ?? null;
  }

  if (!venues || venues.length === 0) {
    const { data } = await supabase
      .from("venues")
      .select("id, name, slug, calendar_url, website_url, photo_url, photo_url_source")
      .not("calendar_url", "is", null)
      .or("scraped_at.is.null,scraped_at.lt." + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("scraped_at", { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE * 3);  // fetch extra to account for blocked venues
    venues = (data as VenueTarget[]) ?? null;
  }

  // Filter out blocked venues
  if (venues && venues.length > 0) {
    const filtered: VenueTarget[] = [];
    for (const v of venues) {
      if (filtered.length >= BATCH_SIZE) break;
      const blocked = await isEntityBlocked(supabase, "venue", v.id, v.website_url ?? v.calendar_url);
      if (!blocked) {
        filtered.push(v);
      } else {
        console.log(`[event-scrape-batch] Skipping blocked venue: ${v.name}`);
      }
    }
    venues = filtered;
  }

  const { data: remainingGaps } = await supabase
    .from("events")
    .select("venue_id")
    .is("start_date", null)
    .eq("source", "scraped");
  const remainingGapIds = [...new Set((remainingGaps ?? []).map((r: { venue_id: string }) => r.venue_id))];

  const { count: staleCount } = await supabase
    .from("venues")
    .select("id", { count: "exact", head: true })
    .not("calendar_url", "is", null)
    .or("scraped_at.is.null,scraped_at.lt." + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const remaining = Math.max(remainingGapIds.length, staleCount ?? 0);

  return { venues: venues ?? [], remaining };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const scraperKey =
    req.headers.get("x-scraper-key") ??
    req.headers.get("Authorization")?.replace("Bearer ", "");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    // If starting a new job
    if (action === "start" || (!jobId && !action)) {
      const { data: existingJob } = await supabase
        .from("scrape_jobs")
        .select("id")
        .eq("status", "running")
        .maybeSingle();

      if (existingJob) {
        return new Response(
          JSON.stringify({ error: "A scrape job is already running", job_id: existingJob.id }),
          { status: 409, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
    }

    let currentJobId = jobId;

    // Create job if starting fresh
    if (action === "start") {
      const { venues: firstCheck } = await getNextVenue(supabase);
      const { data: remainingGaps } = await supabase.from("events").select("venue_id").is("start_date", null).eq("source", "scraped");
      const gapCount = [...new Set((remainingGaps ?? []).map((r: { venue_id: string }) => r.venue_id))].length;
      const { count: staleCount } = await supabase.from("venues").select("id", { count: "exact", head: true }).not("calendar_url", "is", null).or("scraped_at.is.null,scraped_at.lt." + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      const totalVenues = Math.max(gapCount, staleCount ?? 0);

      if (firstCheck.length === 0) {
        return new Response(
          JSON.stringify({ scraped: 0, events_found: 0, remaining: 0, job_id: null }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      const { data: newJob } = await supabase
        .from("scrape_jobs")
        .insert({ status: "running", total_venues: totalVenues })
        .select("id")
        .single();
      currentJobId = newJob?.id;
    }

    // If we have a job_id, verify it's still running
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

    const runId = crypto.randomUUID();
    const { venues, remaining } = await getNextVenue(supabase);

    if (venues.length === 0) {
      if (currentJobId) {
        await supabase.from("scrape_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", currentJobId);
      }
      return new Response(
        JSON.stringify({ scraped: 0, events_found: 0, events_created: 0, remaining: 0, job_id: currentJobId }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    let totalFound = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let lastVenueName = "";
    let lastStrategyStr = "";
    let lastResult: Awaited<ReturnType<typeof processVenue>> | null = null;

    for (const venue of venues) {
      const result = await processVenue(venue, runId);
      lastResult = result;
      totalFound += result.events_found;
      totalCreated += result.events_created;
      totalUpdated += result.events_updated;
      lastVenueName = venue.name;

      const links = result.strategy_links_followed ?? 0;
      const filled = result.strategy_fields_filled ?? [];
      const dates = filled.filter(f => f === "start_date").length;
      if (links > 0 && dates > 0) lastStrategyStr = `followed ${links} link${links > 1 ? "s" : ""}, found ${dates} date${dates > 1 ? "s" : ""}`;
      else if (links > 0) lastStrategyStr = `followed ${links} link${links > 1 ? "s" : ""}, ${filled.length} fields`;
      else if (result.strategy_stop_reason === "complete") lastStrategyStr = "complete";
      else lastStrategyStr = result.strategy_stop_reason ?? "";

      await supabase
        .from("venues")
        .update({ scraped_at: new Date().toISOString() })
        .eq("id", venue.id);
    }

    const remainingAfter = remaining - venues.length;

    // Update job progress
    if (currentJobId) {
      const { data: currentJob } = await supabase
        .from("scrape_jobs")
        .select("venues_processed, events_found, recent_venues")
        .eq("id", currentJobId)
        .single();

      const newProcessed = (currentJob?.venues_processed ?? 0) + venues.length;
      const newEventsFound = (currentJob?.events_found ?? 0) + totalFound;

      const recentVenues = (currentJob?.recent_venues as Array<Record<string, unknown>> ?? []);
      recentVenues.unshift({
        name: lastVenueName,
        events_found: totalFound,
        strategy: lastStrategyStr,
        timestamp: new Date().toISOString(),
        fields_complete: lastResult?.field_summary?.with_dates ?? 0,
        events_total: lastResult?.field_summary?.total ?? totalFound,
        missing: lastResult?.field_summary?.missing ?? [],
        sources: lastResult?.field_summary?.sources ?? [],
        event_details: lastResult?.field_summary?.event_details ?? [],
      });
      if (recentVenues.length > 15) recentVenues.length = 15;

      await supabase.from("scrape_jobs").update({
        venues_processed: newProcessed,
        events_found: newEventsFound,
        current_venue: lastVenueName,
        last_strategy: lastStrategyStr,
        recent_venues: recentVenues,
      }).eq("id", currentJobId);

      // Self-chain: if more venues remain, trigger next batch
      if (remainingAfter > 0) {
        const selfUrl = `${SUPABASE_URL}/functions/v1/event-scrape-batch`;
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
            body: JSON.stringify({ job_id: currentJobId }),
            signal: chainController.signal,
          });
        } catch {
          // Timeout or abort is expected — the next invocation runs independently
        }
      } else {
        await supabase.from("scrape_jobs").update({
          status: "completed",
          completed_at: new Date().toISOString(),
        }).eq("id", currentJobId);
      }
    }

    return new Response(
      JSON.stringify({
        scraped: venues.length,
        events_found: totalFound,
        events_created: totalCreated + totalUpdated,
        remaining: Math.max(remainingAfter, 0),
        venue_name: lastVenueName,
        strategy: {
          links_followed: venues[0] ? (venues[0] as any).strategy_links_followed ?? 0 : 0,
          fields_filled: [],
          stop_reason: lastStrategyStr,
        },
        job_id: currentJobId,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[event-scrape-batch] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
