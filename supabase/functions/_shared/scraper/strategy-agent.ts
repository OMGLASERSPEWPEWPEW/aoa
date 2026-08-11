import { cleanHtml } from "./html-cleaner.ts";
import { buildExtractionPrompt } from "./extraction-prompt.ts";
import { buildVerificationPrompt } from "./verification-prompt.ts";
import { buildTargetedExtractionPrompt } from "./targeted-prompt.ts";
import { extractCandidateLinks, prioritizeLinks } from "./link-extractor.ts";
import { shouldFollowLinks, mergeTargetedExtraction, averageCompleteness, evaluateCompleteness } from "./completeness-evaluator.ts";
import { CostBudget } from "./cost-budget.ts";
import type {
  VenueTarget,
  Pass1Event,
  Pass2Verification,
  DeepSeekResponse,
  StrategyTrace,
  StrategyStep,
  TargetedEnrichment,
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
  extraction_status: string;
  missing_fields: string[];
}

function mergeExtractionResults(pass1Events: Pass1Event[], pass2Events: Pass2Verification[]): MergedEvent[] {
  const merged: MergedEvent[] = [];
  for (let i = 0; i < pass1Events.length; i++) {
    const p1 = pass1Events[i];
    const p2 = pass2Events[i] ?? pass2Events.find((e) => e.title === p1.title);

    if (!p2) {
      const comp = evaluateCompleteness(p1, i);
      merged.push({ ...p1, start_date: p1.start_date ?? null, end_date: p1.end_date ?? null, description: null, genre_tags: [], cast_members: null, photo_url: null, confidence: 0.5, extraction_status: comp.needsFollow ? "partial" : "complete", missing_fields: comp.missingFields });
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
    };
    const comp = evaluateCompleteness(finalEvent, i);

    merged.push({
      ...finalEvent,
      description: p2.description,
      genre_tags: p2.genre_tags ?? [],
      cast_members: p2.cast_members,
      photo_url: p2.photo_url ?? null,
      confidence: p2.confidence,
      extraction_status: comp.needsFollow ? "partial" : "complete",
      missing_fields: comp.missingFields,
    });
  }
  return merged;
}

export async function executeStrategyTree(
  venue: VenueTarget,
  runId: string,
): Promise<{ mergedEvents: MergedEvent[]; trace: StrategyTrace; totalInputTokens: number; totalOutputTokens: number }> {
  const budget = new CostBudget();
  const visitedUrls = new Set<string>();
  const steps: StrategyStep[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  let events: Pass1Event[] = [];
  let rawHtml = "";

  // STEP 1: Initial extraction from calendar_url
  const step1Start = Date.now();
  rawHtml = await fetchHtml(venue.calendar_url);
  visitedUrls.add(venue.calendar_url);
  budget.recordFetch();

  const candidateLinksInitial = extractCandidateLinks(rawHtml, venue.calendar_url, []);

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
      } catch { /* parse error — events stays empty */ }
    }

    steps.push({
      step: "initial_extract", url: venue.calendar_url, aiCalls: 1,
      inputTokens: result.inputTokens, outputTokens: result.outputTokens,
      eventsAffected: events.length, fieldsFilledIn: [], durationMs: Date.now() - step1Start,
    });
  }

  // STEP 5 (early): Website fallback if 0 events
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
      trace: buildTrace(steps, budget, [], averageCompleteness(events), averageCompleteness(events)),
      totalInputTokens, totalOutputTokens,
    };
  }

  // STEP 2: Completeness check
  const completenessBeforeFollows = averageCompleteness(events);
  const candidateLinks = extractCandidateLinks(rawHtml, venue.calendar_url, events.map(e => e.title));
  const { shouldFollow, incompleteEvents } = shouldFollowLinks(events, candidateLinks);

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
          .map((e, i) => evaluateCompleteness(e, i))
          .filter(c => c.needsFollow)
          .map(c => ({ title: c.title, missingFields: c.missingFields }));

        if (incomplete.length === 0) break;

        const targetedResult = await callDeepSeek(
          buildTargetedExtractionPrompt(venue.name, incomplete),
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

  const completenessAfterFollows = averageCompleteness(events);

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

        const verifiedMerged = mergeExtractionResults(eventsForVerify, pass2Events);
        const unverifiedMerged = eventsSkipVerify.map((p1, i) => {
          const comp = evaluateCompleteness(p1, i);
          return {
            ...p1, start_date: p1.start_date ?? null, end_date: p1.end_date ?? null,
            description: null, genre_tags: [] as string[], cast_members: null, photo_url: null,
            confidence: 0.4, extraction_status: "no_dates_on_site", missing_fields: comp.missingFields,
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
          const comp = evaluateCompleteness(p1, i);
          return {
            ...p1, start_date: p1.start_date ?? null, end_date: p1.end_date ?? null,
            description: null, genre_tags: [] as string[], cast_members: null, photo_url: null,
            confidence: 0.4, extraction_status: "no_dates_on_site", missing_fields: comp.missingFields,
          } as MergedEvent;
        });
      }
    } catch (pass2Error) {
      console.error(`[scraper-v2] Verify failed for ${venue.name}:`, pass2Error);
      mergedEvents = events.map((p1, i) => {
        const comp = evaluateCompleteness(p1, i);
        return {
          ...p1, start_date: p1.start_date ?? null, end_date: p1.end_date ?? null,
          description: null, genre_tags: [] as string[], cast_members: null, photo_url: null,
          confidence: 0.5, extraction_status: comp.needsFollow ? "partial" : "complete", missing_fields: comp.missingFields,
        } as MergedEvent;
      });
    }
  } else {
    mergedEvents = events.map((p1, i) => {
      const comp = evaluateCompleteness(p1, i);
      return {
        ...p1, start_date: p1.start_date ?? null, end_date: p1.end_date ?? null,
        description: null, genre_tags: [] as string[], cast_members: null, photo_url: null,
        confidence: 0.4,
        extraction_status: comp.needsFollow ? "budget_exhausted" : "complete",
        missing_fields: comp.missingFields,
      } as MergedEvent;
    });
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
