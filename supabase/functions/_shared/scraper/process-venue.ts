import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { generateSlug } from "./slug-generator.ts";
import { executeStrategyTree } from "./strategy-agent.ts";
import type { VenueTarget, ScrapeResult, StrategyProfile, Program } from "./types.ts";
import { resolveCoordinates, isBadCoordinate, isPlausibleStreetAddress, isOutsideMetro } from "../geocoder.ts";
import { logUsage } from "../logUsage.ts";
import { runPlayMatcherBatch } from "./play-matcher.ts";
import { guardedUpdate } from "../curator/overrides.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export interface ProcessVenueOptions {
  profile?: StrategyProfile;
  defaultEventType?: string;
}

const VALID_SKILL_LEVELS = new Set(["beginner", "intermediate", "advanced", "all-levels", "drop-in"]);
const VALID_CLASS_FORMATS = new Set(["ongoing", "workshop", "intensive", "drop-in", "series"]);

export async function processVenue(venue: VenueTarget, runId: string, options?: ProcessVenueOptions): Promise<ScrapeResult> {
  const start = Date.now();
  const result: ScrapeResult = {
    venue_id: venue.id, venue_name: venue.name, status: "success",
    events_found: 0, events_created: 0, events_updated: 0,
    error_message: null, ai_input_tokens: 0, ai_output_tokens: 0, duration_ms: 0,
  };

  let strategyTrace = null;

  try {
    const { mergedEvents, trace, totalInputTokens, totalOutputTokens, recoveredUrl } = await executeStrategyTree(venue, runId, options?.profile);
    strategyTrace = trace;
    result.ai_input_tokens = totalInputTokens;
    result.ai_output_tokens = totalOutputTokens;
    result.events_found = mergedEvents.length;

    // Self-healing: update calendar_url if recovery found a working URL (FR-33)
    if (recoveredUrl && recoveredUrl !== venue.calendar_url) {
      try {
        await guardedUpdate(supabase, "venue", venue.id, { calendar_url: recoveredUrl });
        console.log(`[process-venue] Self-healed calendar_url for ${venue.name}: ${recoveredUrl}`);
      } catch (e) {
        console.warn(`[process-venue] Failed to self-heal URL for ${venue.name}:`, e);
      }
    }
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
    const eventDetails = mergedEvents.slice(0, 10).map(e => ({
      title: e.title,
      start_date: e.start_date,
      end_date: e.end_date,
      price_min: e.price_min,
      price_max: e.price_max,
      has_ticket: !!e.ticket_url,
      has_times: !!e.show_times,
      found_by: e.found_by,
    }));
    result.field_summary = { with_dates: withDates, total: mergedEvents.length, missing: [...missingSet], sources: [...sourceSet], event_details: eventDetails };

    const logPrefix = options?.profile?.logFeaturePrefix ?? "event-scraper";
    for (const step of trace.steps) {
      if (step.aiCalls > 0) {
        const featureSuffix = step.step === "verify" ? "verify"
          : step.step === "link_follow" ? "follow"
          : step.step === "website_fallback" ? "fallback"
          : "extract";
        const feature = `${logPrefix}-${featureSuffix}`;
        try {
          await logUsage(supabase, {
            userId: null, model: "deepseek-v4-flash", provider: "deepseek",
            feature, inputTokens: step.inputTokens, outputTokens: step.outputTokens,
            metadata: { venue_id: venue.id, venue_name: venue.name, run_id: runId, step: step.step, url: step.url },
          });
        } catch { /* usage logging is best-effort */ }
      }
    }

    const upsertedEventIds: string[] = [];

    for (const event of mergedEvents) {
      const slug = generateSlug(event.title, venue.slug);
      const { data: existing } = await supabase.from("events").select("id, source").eq("slug", slug).maybeSingle();
      if (existing?.source === "manual") continue;

      const defaultType = options?.defaultEventType ?? "show";
      const row: Record<string, unknown> = {
        venue_id: venue.id, title: event.title, slug, description: event.description,
        event_type: ["show", "class", "workshop", "festival", "open-call"].includes(event.event_type) ? event.event_type : defaultType,
        genre_tags: event.genre_tags, start_date: event.start_date, end_date: event.end_date,
        price_min: event.price_min, price_max: event.price_max,
        ticket_url: event.ticket_url || venue.calendar_url, hottix_available: false,
        show_times: event.show_times ?? null, photo_url: event.photo_url || null,
        cast_members: event.cast_members ?? null, source: "scraped" as const,
        scraped_at: new Date().toISOString(), source_url: (event as any).source_url ?? venue.calendar_url,
        extraction_confidence: event.confidence,
        extraction_status: event.extraction_status,
        missing_fields: event.missing_fields,
        found_by: event.found_by,
        instructor_name: event.instructor_name ?? null,
        skill_level: VALID_SKILL_LEVELS.has(event.skill_level ?? "") ? event.skill_level : null,
        session_count: typeof event.session_count === "number" ? event.session_count : null,
        class_format: VALID_CLASS_FORMATS.has(event.class_format ?? "") ? event.class_format : null,
      };

      if (existing) {
        await guardedUpdate(supabase, "event", existing.id, row, {
          source_url: (event as any).source_url ?? venue.calendar_url,
        });
        result.events_updated++;
        upsertedEventIds.push(existing.id);
      } else {
        const { data: inserted, error } = await supabase.from("events").insert(row).select("id").single();
        if (error) throw new Error(`Insert failed: ${error.message}`);
        result.events_created++;
        if (inserted) upsertedEventIds.push(inserted.id);
      }
    }

    if (upsertedEventIds.length > 0 && options?.profile?.domain !== "class") {
      try {
        await runPlayMatcherBatch(upsertedEventIds, supabase, runId);
      } catch (e) {
        console.warn("[play-matcher] Hook failed, continuing:", e);
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

  // FR-34: never report "success" with 0 events
  if (result.status === "success" && result.events_found === 0) {
    result.status = (result.strategy_stop_reason === "recovery_exhausted" ? "fetch_error" : "parse_error") as any;
    result.error_message = result.strategy_stop_reason === "recovery_exhausted"
      ? `All URL recovery strategies exhausted — 0 events found: ${venue.calendar_url}`
      : `Extraction returned 0 events from valid page: ${venue.calendar_url}`;
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

interface MergedClassEvent {
  title: string;
  event_type: string;
  start_date: string | null;
  price_min: number | null;
  price_max: number | null;
  ticket_url: string | null;
  skill_level?: string | null;
  session_count?: number | null;
  class_format?: string | null;
  schedule?: string | null;
  no_experience?: boolean | null;
  drop_in_class?: boolean | null;
  audition_required?: boolean | null;
  prerequisite?: string | null;
  instructor_name?: string | null;
}

const SKILL_LEVEL_MAP: Record<string, number> = {
  "beginner": 1,
  "drop-in": 1,
  "all-levels": 2,
  "intermediate": 2,
  "advanced": 3,
};

export async function processClassSessions(
  events: MergedClassEvent[],
  schoolId: string,
  sourceUrl: string,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const event of events) {
    if (event.event_type !== "class" && event.event_type !== "workshop") continue;

    const level = SKILL_LEVEL_MAP[event.skill_level ?? ""] ?? 2;
    const price = event.price_min ?? event.price_max ?? null;

    const row: Record<string, unknown> = {
      school_id: schoolId,
      title: event.title,
      level,
      starts_on: event.start_date,
      schedule: event.schedule ?? null,
      weeks: typeof event.session_count === "number" ? event.session_count : null,
      price,
      drop_in: event.drop_in_class === true || event.skill_level === "drop-in" || event.class_format === "drop-in",
      no_experience: event.no_experience === true || event.skill_level === "beginner" || event.skill_level === "drop-in",
      audition_required: event.audition_required === true,
      prerequisite: event.prerequisite ?? null,
      signup_url: event.ticket_url,
      scraped_at: new Date().toISOString(),
      source_url: sourceUrl,
    };

    const { data: existing } = await supabase
      .from("class_sessions")
      .select("id")
      .eq("school_id", schoolId)
      .eq("title", event.title)
      .maybeSingle();

    if (existing) {
      await guardedUpdate(supabase, "class_session", existing.id, row, {
        source_url: sourceUrl,
      });
      updated++;
    } else {
      const { error } = await supabase.from("class_sessions").insert(row);
      if (error) console.error(`[class-sessions] Insert failed for "${event.title}":`, error.message);
      else created++;
    }
  }

  return { created, updated };
}

function normalizeForUpsert(s: string | null): string {
  return (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export async function processClassPrograms(
  programs: Program[],
  schoolId: string,
  venueId: string,
  sourceUrl: string,
  schoolAddress: string | null,
): Promise<{ created: number; updated: number; skippedYouth: number }> {
  let created = 0;
  let updated = 0;
  let skippedYouth = 0;

  if (schoolAddress && isPlausibleStreetAddress(schoolAddress)) {
    const { data: venue } = await supabase
      .from("venues")
      .select("id, address, latitude, longitude, geocode_source")
      .eq("id", venueId)
      .maybeSingle();

    const SOURCE_RANK: Record<string, number> = {
      llm_extracted: 4, website: 4, places_api: 3, mapbox_poi: 3,
      known_address: 2, perplexity: 2, default: 0,
    };
    const rankOf = (s: string | null) => SOURCE_RANK[(s ?? "").split(":")[0]] ?? 1;
    const existingRank = rankOf(venue?.geocode_source);
    const incomingRank = 4;
    const shouldUpdate = !venue?.geocode_source || existingRank < incomingRank
      || isBadCoordinate(venue.latitude, venue.longitude) || venue.latitude == null;

    if (venue && shouldUpdate) {
      const geo = await resolveCoordinates(schoolAddress);
      if (geo && !isBadCoordinate(geo.lat, geo.lng) && !isOutsideMetro(geo.lat, geo.lng)) {
        const prevSource = venue.geocode_source;
        await guardedUpdate(supabase, "venue", venueId, {
          address: schoolAddress,
          latitude: geo.lat,
          longitude: geo.lng,
          geocode_source: `llm_extracted:${geo.provider}`,
          geocode_status: "ok",
        });

        const { data: school } = await supabase
          .from("schools")
          .select("id")
          .eq("venue_id", venueId)
          .maybeSingle();
        if (school) {
          await guardedUpdate(supabase, "school", school.id, {
            address: schoolAddress,
            latitude: geo.lat,
            longitude: geo.lng,
          });
        }
        console.log(`[address] llm_extracted:${geo.provider} supersedes ${prevSource} for venue ${venueId}`);
      }
    }
  }

  for (const program of programs) {
    if (program.audience === "youth") {
      skippedYouth++;
      continue;
    }

    const level = program.skill_level === "beginner" ? 1
      : program.skill_level === "intermediate" ? 2
      : program.skill_level === "advanced" ? 3
      : 2;

    const sections = program.sections.length > 0 ? program.sections : [null];

    for (const section of sections) {
      const title = program.program_name;
      const normTitle = normalizeForUpsert(title);
      const normSchedule = normalizeForUpsert(section?.schedule ?? "");
      const startsOn = section?.start_date ?? null;

      const row: Record<string, unknown> = {
        school_id: schoolId,
        title,
        program_name: program.program_name,
        level,
        starts_on: startsOn,
        end_date: section?.end_date ?? null,
        schedule: section?.schedule ?? null,
        day_of_week: section?.day_of_week ?? null,
        start_time: section?.start_time ?? null,
        end_time: section?.end_time ?? null,
        weeks: program.duration_weeks ?? null,
        price: program.price_min ?? program.price_max ?? null,
        discipline: program.discipline ?? null,
        audience: program.audience ?? "adult",
        description: program.description ?? null,
        instructor_name: section?.instructor_name ?? null,
        status: section?.status ?? "unknown",
        drop_in: program.skill_level === "drop-in",
        no_experience: program.skill_level === "beginner" || program.prerequisite == null,
        audition_required: false,
        prerequisite: program.prerequisite ?? null,
        signup_url: section?.register_url ?? program.register_url ?? null,
        notes: section?.notes ?? null,
        extraction_status: section ? (startsOn ? "complete" : "no_dates_on_site") : "program_no_sections",
        scraped_at: new Date().toISOString(),
        source_url: sourceUrl,
      };

      const { data: existing } = await supabase
        .from("class_sessions")
        .select("id")
        .eq("school_id", schoolId)
        .ilike("title", normTitle)
        .eq("schedule", section?.schedule ?? "")
        .eq("starts_on", startsOn ?? "")
        .maybeSingle();

      if (existing) {
        await guardedUpdate(supabase, "class_session", existing.id, row, {
          source_url: sourceUrl,
        });
        updated++;
      } else {
        const { error } = await supabase.from("class_sessions").insert(row);
        if (error) console.error(`[class-programs] Insert failed for "${title}":`, error.message);
        else created++;
      }
    }
  }

  return { created, updated, skippedYouth };
}
