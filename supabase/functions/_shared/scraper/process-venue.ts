import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { generateSlug } from "./slug-generator.ts";
import { executeStrategyTree } from "./strategy-agent.ts";
import type { VenueTarget, ScrapeResult } from "./types.ts";
import { logUsage } from "../logUsage.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function processVenue(venue: VenueTarget, runId: string): Promise<ScrapeResult> {
  const start = Date.now();
  const result: ScrapeResult = {
    venue_id: venue.id, venue_name: venue.name, status: "success",
    events_found: 0, events_created: 0, events_updated: 0,
    error_message: null, ai_input_tokens: 0, ai_output_tokens: 0, duration_ms: 0,
  };

  let strategyTrace = null;

  try {
    const { mergedEvents, trace, totalInputTokens, totalOutputTokens } = await executeStrategyTree(venue, runId);
    strategyTrace = trace;
    result.ai_input_tokens = totalInputTokens;
    result.ai_output_tokens = totalOutputTokens;
    result.events_found = mergedEvents.length;
    result.strategy_links_followed = trace.linksFollowed.length;
    result.strategy_fields_filled = trace.steps.flatMap(s => s.fieldsFilledIn);
    result.strategy_stop_reason = trace.stopReason;

    const withDates = mergedEvents.filter(e => e.start_date).length;
    const missingSet = new Set<string>();
    const sourceSet = new Set<string>();
    for (const e of mergedEvents) {
      if (!e.start_date) missingSet.add("dates");
      if (e.price_min == null && e.price_max == null) missingSet.add("price");
      if (!e.show_times) missingSet.add("times");
      if (!e.ticket_url) missingSet.add("ticket");
      if (!e.cast_members?.length) missingSet.add("cast");
      for (const s of e.found_by) sourceSet.add(s);
    }
    result.field_summary = { with_dates: withDates, total: mergedEvents.length, missing: [...missingSet], sources: [...sourceSet] };

    for (const step of trace.steps) {
      if (step.aiCalls > 0) {
        const feature = step.step === "verify" ? "event-scraper-verify"
          : step.step === "link_follow" ? "event-scraper-follow"
          : step.step === "website_fallback" ? "event-scraper-fallback"
          : "event-scraper-extract";
        try {
          await logUsage(supabase, {
            userId: null, model: "deepseek-v4-flash", provider: "deepseek",
            feature, inputTokens: step.inputTokens, outputTokens: step.outputTokens,
            metadata: { venue_id: venue.id, venue_name: venue.name, run_id: runId, step: step.step, url: step.url },
          });
        } catch { /* usage logging is best-effort */ }
      }
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
        extraction_status: event.extraction_status,
        missing_fields: event.missing_fields,
        found_by: event.found_by,
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
  await supabase.from("scrape_logs").insert({
    run_id: runId, venue_id: venue.id, venue_name: venue.name,
    status: result.status, events_found: result.events_found,
    events_created: result.events_created, events_updated: result.events_updated,
    error_message: result.error_message, ai_input_tokens: result.ai_input_tokens,
    ai_output_tokens: result.ai_output_tokens, duration_ms: result.duration_ms,
    strategy_trace: strategyTrace,
  });

  return result;
}
