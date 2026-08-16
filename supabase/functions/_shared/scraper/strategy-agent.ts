import { cleanHtml } from "./html-cleaner.ts";
import { buildExtractionPrompt } from "./extraction-prompt.ts";
import { buildVerificationPrompt } from "./verification-prompt.ts";
import { buildTargetedExtractionPrompt } from "./targeted-prompt.ts";
import { extractCandidateLinks, prioritizeLinks } from "./link-extractor.ts";
import { DEFAULT_FIELD_WEIGHTS, shouldFollowLinks, mergeTargetedExtraction, averageCompleteness, evaluateCompleteness } from "./completeness-evaluator.ts";
import { CostBudget } from "./cost-budget.ts";
import { lookupVenueOnTic, ticShowsToEnrichments, enrichFromTicDetail } from "./tic-lookup.ts";
import type {
  VenueTarget,
  Pass1Event,
  Pass2Verification,
  DeepSeekResponse,
  StrategyTrace,
  StrategyStep,
  TargetedEnrichment,
  StrategyProfile,
} from "./types.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;

async function fetchHtml(url: string): Promise<string> {
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

export interface MergedEvent {
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
  extraction_status: string;
  missing_fields: string[];
  found_by: string[];
  instructor_name?: string | null;
  skill_level?: string | null;
  session_count?: number | null;
  class_format?: string | null;
}

function mergeExtractionResults(
  pass1Events: Pass1Event[],
  pass2Events: Pass2Verification[],
  weights?: Record<string, number>,
): MergedEvent[] {
  const merged: MergedEvent[] = [];
  for (let i = 0; i < pass1Events.length; i++) {
    const p1 = pass1Events[i];
    const p2 = pass2Events[i] ?? pass2Events.find((e) => e.title === p1.title);

    if (!p2) {
      const comp = evaluateCompleteness(p1, i, weights);
      merged.push({
        ...p1, start_date: p1.start_date ?? null, end_date: p1.end_date ?? null,
        description: null, genre_tags: [], cast_members: null, photo_url: null,
        confidence: 0.5, extraction_status: comp.needsFollow ? "partial" : "complete",
        missing_fields: comp.missingFields, found_by: [],
        instructor_name: p1.instructor_name ?? null,
        skill_level: p1.skill_level ?? null,
        session_count: p1.session_count ?? null,
        class_format: p1.class_format ?? null,
      });
      continue;
    }
    if (p2.status === "rejected") continue;

    const c = p2.corrections ?? {};
    const finalEvent: Pass1Event = {
      title: p1.title,
      event_type: c.event_type ?? p1.event_type,
      start_date: c.start_date !== undefined ? c.start_date : (p1.start_date ?? null),
      end_date: c.end_date !== undefined ? c.end_date : (p1.end_date ?? null),
      price_min: c.price_min !== undefined ? c.price_min : p1.price_min,
      price_max: c.price_max !== undefined ? c.price_max : p1.price_max,
      ticket_url: p1.ticket_url,
      show_times: p1.show_times,
      instructor_name: p2.instructor_name ?? p1.instructor_name ?? null,
      skill_level: p2.skill_level ?? p1.skill_level ?? null,
      session_count: p2.session_count ?? p1.session_count ?? null,
      class_format: p2.class_format ?? p1.class_format ?? null,
    };
    const comp = evaluateCompleteness(finalEvent, i, weights);

    merged.push({
      ...finalEvent,
      description: p2.description,
      genre_tags: p2.genre_tags ?? [],
      cast_members: p2.cast_members,
      photo_url: p2.photo_url ?? null,
      confidence: p2.confidence,
      extraction_status: comp.needsFollow ? "partial" : "complete",
      missing_fields: comp.missingFields,
      found_by: [],
    });
  }
  return merged;
}

export async function executeStrategyTree(
  venue: VenueTarget,
  runId: string,
  profile?: StrategyProfile,
): Promise<{ mergedEvents: MergedEvent[]; trace: StrategyTrace; totalInputTokens: number; totalOutputTokens: number }> {
  const effectiveProfile: StrategyProfile = profile ?? {
    domain: "theater",
    fieldWeights: DEFAULT_FIELD_WEIGHTS,
    logFeaturePrefix: "event-scraper",
  };
  const weights = effectiveProfile.fieldWeights;
  const isClassDomain = effectiveProfile.domain === "class";

  const budget = new CostBudget();
  const visitedUrls = new Set<string>();
  const steps: StrategyStep[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  let events: Pass1Event[] = [];
  let rawHtml = "";
  const foundByMap = new Map<string, Set<string>>();

  // STEP 1: Parallel fetch — venue calendar + TIC lookup (TIC skipped for classes)
  const step1Start = Date.now();
  const ticPromise = isClassDomain
    ? Promise.resolve({ shows: [] as import("./types.ts").TicShow[], source: null as string | null })
    : lookupVenueOnTic(venue.name).catch(() => ({ shows: [] as import("./types.ts").TicShow[], source: null as string | null }));
  const [venueHtml, ticResult] = await Promise.all([
    fetchHtml(venue.calendar_url),
    ticPromise,
  ]);
  rawHtml = venueHtml;
  visitedUrls.add(venue.calendar_url);
  budget.recordFetch();
  budget.recordFetch();

  // Extract events from venue calendar
  const cleaned = cleanHtml(rawHtml);
  if (cleaned.length >= 100 && budget.canAffordAiCall()) {
    const result = await callDeepSeek(buildExtractionPrompt(venue.name), cleaned);
    budget.recordAiCall(result.inputTokens, result.outputTokens);
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;

    if (result.content) {
      try {
        const parsed = JSON.parse(result.content);
        events = parsed.events ?? [];
      } catch { /* parse error */ }
    }

    for (const e of events) foundByMap.set(e.title.toLowerCase(), new Set(["venue_website"]));

    steps.push({
      step: "initial_extract", url: venue.calendar_url, aiCalls: 1,
      inputTokens: result.inputTokens, outputTokens: result.outputTokens,
      eventsAffected: events.length, fieldsFilledIn: [], durationMs: Date.now() - step1Start,
    });
  }

  // Merge TIC results (ran in parallel, now available)
  const ticShows = ticResult.shows;
  if (ticShows.length > 0) {
    const ticStart = Date.now();
    const enrichments = ticShowsToEnrichments(ticShows);
    const { events: updated, fieldsFilledIn } = mergeTargetedExtraction(events, enrichments);

    for (const enrichment of enrichments) {
      const key = enrichment.title.toLowerCase();
      const existing = foundByMap.get(key);
      if (existing) existing.add("tic");
    }

    const matchedTitles = new Set(events.map(e => e.title.toLowerCase()));
    const ticOnlyShows = ticShows.filter(s =>
      !matchedTitles.has(s.title.toLowerCase()) &&
      !events.some(e => e.title.toLowerCase().includes(s.title.toLowerCase()) || s.title.toLowerCase().includes(e.title.toLowerCase())),
    );

    for (const ticOnly of ticOnlyShows) {
      let startDate = ticOnly.startDate;
      let endDate = ticOnly.endDate;
      let showTimes: Record<string, string[]> | null = null;
      let ticketUrl: string | null = ticOnly.detailUrl;

      if (!startDate && !endDate && ticOnly.detailUrl && budget.canAffordFetch()) {
        try {
          const detail = await enrichFromTicDetail(ticOnly.detailUrl);
          budget.recordFetch();
          if (detail) {
            startDate = detail.startDate;
            endDate = detail.endDate;
            showTimes = detail.showTimes;
            if (detail.ticketUrl) ticketUrl = detail.ticketUrl;
          }
        } catch { /* detail fetch failed, skip */ }
      }

      if (startDate || endDate) {
        updated.push({
          title: ticOnly.title,
          event_type: "show",
          start_date: startDate,
          end_date: endDate,
          price_min: null,
          price_max: null,
          ticket_url: ticketUrl,
          show_times: showTimes,
        });
        foundByMap.set(ticOnly.title.toLowerCase(), new Set(["tic"]));
      }
    }

    // Also fetch details for existing events that TIC matched but had no dates
    let detailFieldsFilled: string[] = [];
    for (const show of ticShows) {
      if (show.startDate || show.endDate) continue;
      if (!show.detailUrl || !budget.canAffordFetch()) continue;

      const matchIdx = updated.findIndex(e =>
        e.title.toLowerCase() === show.title.toLowerCase() ||
        e.title.toLowerCase().includes(show.title.toLowerCase()) ||
        show.title.toLowerCase().includes(e.title.toLowerCase()),
      );
      if (matchIdx === -1) continue;
      if (updated[matchIdx].start_date) continue;

      try {
        const detail = await enrichFromTicDetail(show.detailUrl);
        budget.recordFetch();
        if (detail && (detail.startDate || detail.endDate)) {
          if (!updated[matchIdx].start_date && detail.startDate) { updated[matchIdx].start_date = detail.startDate; detailFieldsFilled.push("start_date"); }
          if (!updated[matchIdx].end_date && detail.endDate) { updated[matchIdx].end_date = detail.endDate; detailFieldsFilled.push("end_date"); }
          if (!updated[matchIdx].show_times && detail.showTimes) { updated[matchIdx].show_times = detail.showTimes; detailFieldsFilled.push("show_times"); }
          if (!updated[matchIdx].ticket_url && detail.ticketUrl) { updated[matchIdx].ticket_url = detail.ticketUrl; detailFieldsFilled.push("ticket_url"); }
          const key = updated[matchIdx].title.toLowerCase();
          const existing = foundByMap.get(key);
          if (existing) existing.add("tic");
          else foundByMap.set(key, new Set(["tic"]));
        }
      } catch { /* detail fetch failed */ }
    }

    events = updated;

    const allFieldsFilled = [...fieldsFilledIn, ...detailFieldsFilled];
    steps.push({
      step: "aggregator_crossref", url: "theatreinchicago.com",
      aiCalls: 0, inputTokens: 0, outputTokens: 0,
      eventsAffected: allFieldsFilled.length + ticOnlyShows.filter(s => foundByMap.has(s.title.toLowerCase())).length,
      fieldsFilledIn: allFieldsFilled,
      durationMs: Date.now() - ticStart,
    });

    if (detailFieldsFilled.length > 0) {
      steps.push({
        step: "aggregator_detail", url: "theatreinchicago.com/detail",
        aiCalls: 0, inputTokens: 0, outputTokens: 0,
        eventsAffected: detailFieldsFilled.filter(f => f === "start_date").length,
        fieldsFilledIn: detailFieldsFilled,
        durationMs: 0,
      });
    }
  }

  // Website fallback if 0 events from both sources
  if (events.length === 0 && venue.website_url && venue.website_url !== venue.calendar_url && budget.canAffordFetch() && budget.canAffordAiCall()) {
    const fbStart = Date.now();
    try {
      const fbHtml = await fetchHtml(venue.website_url);
      visitedUrls.add(venue.website_url);
      budget.recordFetch();

      const fbCleaned = cleanHtml(fbHtml);
      if (fbCleaned.length >= 100) {
        const fbResult = await callDeepSeek(buildExtractionPrompt(venue.name), fbCleaned);
        budget.recordAiCall(fbResult.inputTokens, fbResult.outputTokens);
        totalInputTokens += fbResult.inputTokens;
        totalOutputTokens += fbResult.outputTokens;

        if (fbResult.content) {
          try {
            const parsed = JSON.parse(fbResult.content);
            events = parsed.events ?? [];
            rawHtml = fbHtml;
            for (const e of events) foundByMap.set(e.title.toLowerCase(), new Set(["venue_website"]));
          } catch { /* parse error */ }
        }

        steps.push({
          step: "website_fallback", url: venue.website_url, aiCalls: 1,
          inputTokens: fbResult.inputTokens, outputTokens: fbResult.outputTokens,
          eventsAffected: events.length, fieldsFilledIn: [], durationMs: Date.now() - fbStart,
        });
      }
    } catch (e) {
      console.warn(`[scraper-v2] Website fallback failed for ${venue.name}:`, e);
    }
  }

  if (events.length === 0) {
    budget.setStopReason("no_events");
    return {
      mergedEvents: [],
      trace: buildTrace(steps, budget, [], 0, 0),
      totalInputTokens, totalOutputTokens,
    };
  }

  // STEP 2: Completeness check
  const completenessBeforeFollows = averageCompleteness(events, weights);
  const candidateLinks = extractCandidateLinks(rawHtml, venue.calendar_url, events.map(e => e.title));
  const { shouldFollow, incompleteEvents } = shouldFollowLinks(events, candidateLinks, weights);

  // STEP 3: Link following
  if (shouldFollow) {
    const linksToFollow = prioritizeLinks(candidateLinks, incompleteEvents, visitedUrls, 3);
    let noProgressCount = 0;

    for (const link of linksToFollow) {
      if (budget.isExhausted()) break;
      if (!budget.canAffordFetch() || !budget.canAffordAiCall()) break;
      if (noProgressCount >= 2) { budget.setStopReason("no_progress"); break; }

      const lfStart = Date.now();
      try {
        const linkHtml = await fetchHtml(link.url);
        visitedUrls.add(link.url);
        budget.recordFetch();

        const linkCleaned = cleanHtml(linkHtml);
        if (linkCleaned.length < 100) continue;

        const incomplete = events
          .map((e, i) => evaluateCompleteness(e, i, weights))
          .filter(c => c.needsFollow)
          .map(c => ({ title: c.title, missingFields: c.missingFields }));

        if (incomplete.length === 0) break;

        const targetedResult = await callDeepSeek(
          buildTargetedExtractionPrompt(venue.name, incomplete, isClassDomain),
          linkCleaned,
          4096,
        );
        budget.recordAiCall(targetedResult.inputTokens, targetedResult.outputTokens);
        totalInputTokens += targetedResult.inputTokens;
        totalOutputTokens += targetedResult.outputTokens;

        let fieldsFilledIn: string[] = [];
        if (targetedResult.content) {
          try {
            const parsed = JSON.parse(targetedResult.content);
            const enrichments: TargetedEnrichment[] = parsed.enrichments ?? [];
            const merged = mergeTargetedExtraction(events, enrichments);
            events = merged.events;
            fieldsFilledIn = merged.fieldsFilledIn;
          } catch { /* parse error */ }
        }

        steps.push({
          step: "link_follow", url: link.url, aiCalls: 1,
          inputTokens: targetedResult.inputTokens, outputTokens: targetedResult.outputTokens,
          eventsAffected: fieldsFilledIn.length, fieldsFilledIn, durationMs: Date.now() - lfStart,
        });

        if (fieldsFilledIn.length === 0) noProgressCount++;
        else noProgressCount = 0;

      } catch (e) {
        console.warn(`[scraper-v2] Link follow failed for ${link.url}:`, e);
        continue;
      }
    }
  }

  const completenessAfterFollows = averageCompleteness(events, weights);

  // STEP 4: Conditional verification
  let mergedEvents: MergedEvent[];

  if (budget.canAffordAiCall()) {
    const vStart = Date.now();
    try {
      const eventsForVerify = events.filter(e => e.start_date != null);
      const eventsSkipVerify = events.filter(e => e.start_date == null);

      if (eventsForVerify.length > 0) {
        const pass2Result = await callDeepSeek(
          buildVerificationPrompt(venue.name, eventsForVerify),
          "Verify and enrich these events.",
        );
        budget.recordAiCall(pass2Result.inputTokens, pass2Result.outputTokens);
        totalInputTokens += pass2Result.inputTokens;
        totalOutputTokens += pass2Result.outputTokens;

        let pass2Events: Pass2Verification[] = [];
        if (pass2Result.content) {
          try {
            const parsed = JSON.parse(pass2Result.content);
            pass2Events = parsed.events ?? [];
          } catch { /* parse error */ }
        }

        const verifiedMerged = mergeExtractionResults(eventsForVerify, pass2Events, weights);
        const unverifiedMerged = eventsSkipVerify.map((p1, i) => {
          const comp = evaluateCompleteness(p1, i, weights);
          return {
            ...p1, start_date: p1.start_date ?? null, end_date: p1.end_date ?? null,
            description: null, genre_tags: [] as string[], cast_members: null, photo_url: null,
            confidence: 0.4, extraction_status: "no_dates_on_site", missing_fields: comp.missingFields, found_by: [],
            instructor_name: p1.instructor_name ?? null, skill_level: p1.skill_level ?? null,
            session_count: p1.session_count ?? null, class_format: p1.class_format ?? null,
          } as MergedEvent;
        });
        mergedEvents = [...verifiedMerged, ...unverifiedMerged];

        steps.push({
          step: "verify", url: "", aiCalls: 1,
          inputTokens: pass2Result.inputTokens, outputTokens: pass2Result.outputTokens,
          eventsAffected: verifiedMerged.length, fieldsFilledIn: ["description", "genre_tags"], durationMs: Date.now() - vStart,
        });
      } else {
        mergedEvents = events.map((p1, i) => {
          const comp = evaluateCompleteness(p1, i, weights);
          return {
            ...p1, start_date: p1.start_date ?? null, end_date: p1.end_date ?? null,
            description: null, genre_tags: [] as string[], cast_members: null, photo_url: null,
            confidence: 0.4, extraction_status: "no_dates_on_site", missing_fields: comp.missingFields, found_by: [],
            instructor_name: p1.instructor_name ?? null, skill_level: p1.skill_level ?? null,
            session_count: p1.session_count ?? null, class_format: p1.class_format ?? null,
          } as MergedEvent;
        });
      }
    } catch (pass2Error) {
      console.error(`[scraper-v2] Verify failed for ${venue.name}:`, pass2Error);
      mergedEvents = events.map((p1, i) => {
        const comp = evaluateCompleteness(p1, i, weights);
        return {
          ...p1, start_date: p1.start_date ?? null, end_date: p1.end_date ?? null,
          description: null, genre_tags: [] as string[], cast_members: null, photo_url: null,
          confidence: 0.5, extraction_status: comp.needsFollow ? "partial" : "complete", missing_fields: comp.missingFields, found_by: [],
          instructor_name: p1.instructor_name ?? null, skill_level: p1.skill_level ?? null,
          session_count: p1.session_count ?? null, class_format: p1.class_format ?? null,
        } as MergedEvent;
      });
    }
  } else {
    mergedEvents = events.map((p1, i) => {
      const comp = evaluateCompleteness(p1, i, weights);
      return {
        ...p1, start_date: p1.start_date ?? null, end_date: p1.end_date ?? null,
        description: null, genre_tags: [] as string[], cast_members: null, photo_url: null,
        confidence: 0.4,
        extraction_status: comp.needsFollow ? "budget_exhausted" : "complete",
        missing_fields: comp.missingFields, found_by: [],
        instructor_name: p1.instructor_name ?? null, skill_level: p1.skill_level ?? null,
        session_count: p1.session_count ?? null, class_format: p1.class_format ?? null,
      } as MergedEvent;
    });
  }

  // Apply found_by from the map
  for (const event of mergedEvents) {
    const sources = foundByMap.get(event.title.toLowerCase());
    event.found_by = sources ? [...sources] : ["venue_website"];
  }

  if (!budget.stopReason) budget.setStopReason("complete");

  return {
    mergedEvents,
    trace: buildTrace(steps, budget, [...visitedUrls], completenessBeforeFollows, completenessAfterFollows),
    totalInputTokens,
    totalOutputTokens,
  };
}

function buildTrace(
  steps: StrategyStep[],
  budget: CostBudget,
  linksFollowed: string[],
  before: number,
  after: number,
): StrategyTrace {
  return {
    steps,
    totalAiCalls: budget.aiCallsMade,
    totalFetches: budget.fetchesMade,
    budgetUsed: budget.spent,
    budgetLimit: 0.012,
    linksFollowed: linksFollowed.slice(1),
    completenessBeforeFollows: before,
    completenessAfterFollows: after,
    stopReason: budget.stopReason ?? "complete",
  };
}
