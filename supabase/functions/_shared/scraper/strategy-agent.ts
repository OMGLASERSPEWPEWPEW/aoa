import { cleanHtml, extractJsonLd, type JsonLdEvent } from "./html-cleaner.ts";
import { buildExtractionPrompt } from "./extraction-prompt.ts";
import { buildVerificationPrompt } from "./verification-prompt.ts";
import { buildTargetedExtractionPrompt } from "./targeted-prompt.ts";
import { extractCandidateLinks, prioritizeLinks } from "./link-extractor.ts";
import { DEFAULT_FIELD_WEIGHTS, shouldFollowLinks, mergeTargetedExtraction, averageCompleteness, evaluateCompleteness } from "./completeness-evaluator.ts";
import { CostBudget } from "./cost-budget.ts";
import { lookupVenueOnTic, ticShowsToEnrichments, enrichFromTicDetail } from "./tic-lookup.ts";
import { resolveVenueUrl } from "./url-resolver.ts";
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
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const AI_TIMEOUT = 55_000;
const FETCH_TIMEOUT = 45_000;

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
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

interface AiResult {
  content: string | null;
  inputTokens: number;
  outputTokens: number;
}

async function callDeepSeek(systemPrompt: string, userContent: string, maxTokens = 8192): Promise<AiResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
        response_format: { type: "json_object" },
        max_tokens: maxTokens,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`DeepSeek API error (${response.status})`);
    const data: DeepSeekResponse = await response.json();
    return { content: data.choices[0]?.message?.content ?? null, inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 };
  } finally { clearTimeout(timeout); }
}

async function callGemini(systemPrompt: string, userContent: string, maxTokens = 8192): Promise<AiResult> {
  if (!GEMINI_API_KEY) return { content: null, inputTokens: 0, outputTokens: 0 };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: { maxOutputTokens: maxTokens, responseMimeType: "application/json" },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Gemini API error (${response.status})`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? null;
    const usage = data.usageMetadata ?? {};
    return { content: text, inputTokens: usage.promptTokenCount ?? 0, outputTokens: usage.candidatesTokenCount ?? 0 };
  } finally { clearTimeout(timeout); }
}

async function callOpenAI(systemPrompt: string, userContent: string, maxTokens = 8192): Promise<AiResult> {
  if (!OPENAI_API_KEY) return { content: null, inputTokens: 0, outputTokens: 0 };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
        response_format: { type: "json_object" },
        max_completion_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OpenAI API error (${response.status})`);
    const data = await response.json();
    return { content: data.choices?.[0]?.message?.content ?? null, inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 };
  } finally { clearTimeout(timeout); }
}

async function callHaiku(systemPrompt: string, userContent: string, maxTokens = 8192): Promise<AiResult> {
  if (!ANTHROPIC_API_KEY) return { content: null, inputTokens: 0, outputTokens: 0 };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Haiku API error (${response.status})`);
    const data = await response.json();
    const text = (data.content ?? []).filter((c: { type?: string }) => c.type === "text").map((c: { text?: string }) => c.text ?? "").join("");
    return { content: text || null, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
  } finally { clearTimeout(timeout); }
}

interface ModelExtractionResult {
  model: string;
  events: Pass1Event[];
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  status: "ok" | "error" | "timeout" | "empty";
  error?: string;
}

async function extractWithAllModels(
  systemPrompt: string,
  content: string,
): Promise<{ best: ModelExtractionResult; all: ModelExtractionResult[] }> {
  const models: Array<{ name: string; fn: typeof callDeepSeek }> = [
    { name: "deepseek-v4-flash", fn: callDeepSeek },
    { name: "gemini-3.5-flash", fn: callGemini },
    { name: "gpt-5.6-luna", fn: callOpenAI },
    { name: "claude-haiku-4-5", fn: callHaiku },
  ];

  const start = Date.now();
  const settled = await Promise.allSettled(
    models.map(async (m) => {
      const mStart = Date.now();
      try {
        const result = await m.fn(systemPrompt, content);
        let events: Pass1Event[] = [];
        if (result.content) {
          try {
            const parsed = JSON.parse(result.content);
            events = parsed.events ?? [];
          } catch { /* parse error */ }
        }
        return {
          model: m.name,
          events,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          durationMs: Date.now() - mStart,
          status: events.length > 0 ? "ok" : "empty",
        } as ModelExtractionResult;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          model: m.name,
          events: [],
          inputTokens: 0,
          outputTokens: 0,
          durationMs: Date.now() - mStart,
          status: msg.includes("aborted") ? "timeout" : "error",
          error: msg,
        } as ModelExtractionResult;
      }
    }),
  );

  const all = settled.map((s) =>
    s.status === "fulfilled"
      ? s.value
      : { model: "unknown", events: [], inputTokens: 0, outputTokens: 0, durationMs: Date.now() - start, status: "error" as const, error: String((s as PromiseRejectedResult).reason) },
  );

  const sorted = [...all].sort((a, b) => b.events.length - a.events.length);
  return { best: sorted[0], all };
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
): Promise<{ mergedEvents: MergedEvent[]; trace: StrategyTrace; totalInputTokens: number; totalOutputTokens: number; recoveredUrl?: string }> {
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

  // STEP 1: Non-fatal seed fetch with URL recovery (FR-28, FR-29)
  const step1Start = Date.now();
  let seedUrl = venue.calendar_url;
  let recoveredUrl: string | undefined;

  const ticPromise = isClassDomain
    ? Promise.resolve({ shows: [] as import("./types.ts").TicShow[], source: null as string | null })
    : lookupVenueOnTic(venue.name).catch(() => ({ shows: [] as import("./types.ts").TicShow[], source: null as string | null }));

  // Try seed URL — non-fatal
  let seedFailed = false;
  try {
    rawHtml = await fetchHtml(venue.calendar_url);
    visitedUrls.add(venue.calendar_url);
    budget.recordFetch();
  } catch (seedErr) {
    console.warn(`[scraper-v3.1] Dead calendar_url for ${venue.name}: ${venue.calendar_url}`, seedErr instanceof Error ? seedErr.message : seedErr);
    seedFailed = true;
  }

  // URL recovery: if seed failed OR content is too thin
  if (seedFailed || cleanHtml(rawHtml).length < 300) {
    console.log(`[scraper-v3.1] ${venue.name}: entering URL recovery (seedFailed=${seedFailed}, contentLen=${cleanHtml(rawHtml).length})`);

    const recovery = await resolveVenueUrl(venue, (html) => {
      return cleanHtml(html).length;
    });

    if (recovery.status === "resolved") {
      seedUrl = recovery.url;
      rawHtml = recovery.html;
      recoveredUrl = recovery.url;
      visitedUrls.add(recovery.url);
      console.log(`[scraper-v3.1] ${venue.name}: recovered URL via ${recovery.strategy}: ${recovery.url}`);
      steps.push({
        step: "jina_fallback" as any, url: recovery.url, aiCalls: 0, inputTokens: 0, outputTokens: 0,
        eventsAffected: 0, fieldsFilledIn: [`url_recovery:${recovery.strategy}`], durationMs: Date.now() - step1Start,
      });
    } else {
      console.warn(`[scraper-v3.1] ${venue.name}: all recovery strategies exhausted (${recovery.attempts.length} attempts)`);
      budget.setStopReason("recovery_exhausted");

      const ticResult = await ticPromise;
      return {
        mergedEvents: [],
        trace: buildTrace(steps, budget, [...visitedUrls], 0, 0),
        totalInputTokens, totalOutputTokens,
        recoveredUrl: undefined,
      };
    }
  }

  const ticResult = await ticPromise;
  budget.recordFetch();

  // Extract JSON-LD structured data before cleaning
  const ldJsonEvents = extractJsonLd(rawHtml);
  if (ldJsonEvents.length > 0) {
    console.log(`[scraper-v3] ${venue.name}: found ${ldJsonEvents.length} JSON-LD events`);
    steps.push({ step: "json_ld", url: venue.calendar_url, aiCalls: 0, inputTokens: 0, outputTokens: 0, eventsAffected: ldJsonEvents.length, fieldsFilledIn: [], durationMs: 0 });
  }

  // Extract events from venue calendar
  let cleaned = cleanHtml(rawHtml);

  // Jina Reader fallback for JS-rendered sites (higher threshold for class domain)
  const jinaThreshold = isClassDomain ? 2000 : 300;
  if (cleaned.length < jinaThreshold && budget.canAffordFetch()) {
    console.log(`[scraper-v3] ${venue.name}: thin HTML (${cleaned.length} chars < ${jinaThreshold}), trying Jina Reader`);
    try {
      const jinaRes = await fetchHtml(`https://r.jina.ai/${venue.calendar_url}`);
      budget.recordFetch();
      if (jinaRes.length > cleaned.length) {
        cleaned = jinaRes;
        steps.push({ step: "jina_fallback", url: venue.calendar_url, aiCalls: 0, inputTokens: 0, outputTokens: 0, eventsAffected: 0, fieldsFilledIn: [], durationMs: 0 });
      }
    } catch (e) {
      console.warn(`[scraper-v3] Jina fallback failed for ${venue.name}:`, e);
    }
  }

  if (cleaned.length >= 100) {
    const prompt = buildExtractionPrompt(venue.name);
    const { best, all: modelResults } = await extractWithAllModels(prompt, cleaned);

    events = best.events;
    budget.recordAiCall(best.inputTokens, best.outputTokens);
    totalInputTokens += best.inputTokens;
    totalOutputTokens += best.outputTokens;

    console.log(`[scraper-v3] ${venue.name}: 4-model extraction → winner: ${best.model} (${best.events.length} events). Results: ${modelResults.map(r => `${r.model}=${r.events.length}/${r.status}`).join(", ")}`);

    // Set source_url for seed page events
    for (const e of events) {
      e.source_url = venue.calendar_url;
      foundByMap.set(e.title.toLowerCase(), new Set(["venue_website"]));
    }

    // Merge JSON-LD data (JSON-LD wins for dates, prices, URLs)
    for (const ld of ldJsonEvents) {
      if (!ld.name) continue;
      const match = events.find(e => e.title.toLowerCase() === ld.name!.toLowerCase());
      if (match) {
        if (ld.startDate && !match.start_date) match.start_date = ld.startDate;
        if (ld.endDate && !match.end_date) match.end_date = ld.endDate;
        if (ld.price != null && match.price_min == null) { match.price_min = ld.price; match.price_max = ld.price; }
        if (ld.url && !match.ticket_url) match.ticket_url = ld.url;
        if (ld.image && !match.photo_url) match.photo_url = ld.image;
      }
    }

    steps.push({
      step: "initial_extract", url: venue.calendar_url, aiCalls: modelResults.filter(r => r.status !== "empty" || r.durationMs > 0).length,
      inputTokens: best.inputTokens, outputTokens: best.outputTokens,
      eventsAffected: events.length, fieldsFilledIn: [],
      durationMs: Date.now() - step1Start,
      modelResults: modelResults.map(r => ({ model: r.model, events_found: r.events.length, duration_ms: r.durationMs, status: r.status })),
    } as StrategyStep & { modelResults: unknown });
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

  if (events.length === 0 && !isClassDomain) {
    budget.setStopReason("no_events");
    return {
      mergedEvents: [],
      trace: buildTrace(steps, budget, [], 0, 0),
      totalInputTokens, totalOutputTokens, recoveredUrl,
    };
  }

  // STEP 2: BFS Frontier — crawl until no relevant links remain or ceiling hit
  const completenessBeforeFollows = averageCompleteness(events, weights);
  const domain = effectiveProfile.domain;

  // Initialize BFS frontier from seed page links
  const frontier: import("./types.ts").CandidateLink[] = [];
  const seedLinks = extractCandidateLinks(rawHtml, venue.calendar_url, events.map(e => e.title), domain);
  for (const link of seedLinks) {
    const norm = link.url.split("?")[0].split("#")[0].replace(/\/$/, "");
    if (!visitedUrls.has(norm)) frontier.push(link);
  }
  frontier.sort((a, b) => b.score - a.score);

  // BFS crawl loop — no arbitrary link cap
  while (frontier.length > 0) {
    if (budget.isExhausted()) break;
    if (!budget.canAffordFetch() || !budget.canAffordAiCall()) break;

    const link = frontier.shift()!;
    const norm = link.url.split("?")[0].split("#")[0].replace(/\/$/, "");
    if (visitedUrls.has(norm)) continue;

    const lfStart = Date.now();
    try {
      let linkHtml = await fetchHtml(link.url);
      visitedUrls.add(norm);
      budget.recordFetch();

      // JSON-LD from subpage
      const subpageLd = extractJsonLd(linkHtml);

      let linkCleaned = cleanHtml(linkHtml);

      // Jina fallback for thin subpages
      if (linkCleaned.length < 300 && budget.canAffordFetch()) {
        try {
          const jinaRes = await fetchHtml(`https://r.jina.ai/${link.url}`);
          budget.recordFetch();
          if (jinaRes.length > linkCleaned.length) linkCleaned = jinaRes;
        } catch { /* Jina failed, use raw */ }
      }

      if (linkCleaned.length < 100) continue;

      // BFS subpages: single model (DeepSeek) — 4-model race only on initial extraction
      const linkResult = await callDeepSeek(buildExtractionPrompt(venue.name), linkCleaned);
      budget.recordAiCall(linkResult.inputTokens, linkResult.outputTokens);
      totalInputTokens += linkResult.inputTokens;
      totalOutputTokens += linkResult.outputTokens;

      let newEventsFound = 0;
      let fieldsFilledIn: string[] = [];

      if (linkResult.content) {
        try {
          const parsed = JSON.parse(linkResult.content);
          const pageEvents: Pass1Event[] = parsed.events ?? [];

          for (const pe of pageEvents) {
            pe.source_url = link.url;
            const key = pe.title.toLowerCase();
            const existingIdx = events.findIndex(e => e.title.toLowerCase() === key);

            if (existingIdx >= 0) {
              // Enrich existing event with any new fields
              const existing = events[existingIdx];
              if (!existing.start_date && pe.start_date) { existing.start_date = pe.start_date; fieldsFilledIn.push("start_date"); }
              if (!existing.end_date && pe.end_date) { existing.end_date = pe.end_date; fieldsFilledIn.push("end_date"); }
              if (existing.price_min == null && pe.price_min != null) { existing.price_min = pe.price_min; fieldsFilledIn.push("price_min"); }
              if (existing.price_max == null && pe.price_max != null) { existing.price_max = pe.price_max; fieldsFilledIn.push("price_max"); }
              if (!existing.ticket_url && pe.ticket_url) { existing.ticket_url = pe.ticket_url; fieldsFilledIn.push("ticket_url"); }
              if (!existing.show_times && pe.show_times) { existing.show_times = pe.show_times; fieldsFilledIn.push("show_times"); }
              if (!existing.photo_url && pe.photo_url) { existing.photo_url = pe.photo_url; fieldsFilledIn.push("photo_url"); }
              if (!existing.instructor_name && pe.instructor_name) { existing.instructor_name = pe.instructor_name; fieldsFilledIn.push("instructor_name"); }
              if (!existing.skill_level && pe.skill_level) { existing.skill_level = pe.skill_level; fieldsFilledIn.push("skill_level"); }
              if (existing.session_count == null && pe.session_count != null) { existing.session_count = pe.session_count; fieldsFilledIn.push("session_count"); }
              if (!existing.class_format && pe.class_format) { existing.class_format = pe.class_format; fieldsFilledIn.push("class_format"); }
              if (!existing.schedule && pe.schedule) { existing.schedule = pe.schedule; fieldsFilledIn.push("schedule"); }
              const sources = foundByMap.get(key);
              if (sources) sources.add(`subpage:${link.url}`);
            } else {
              // New event discovered on subpage
              events.push(pe);
              foundByMap.set(key, new Set([`subpage:${link.url}`]));
              newEventsFound++;
            }
          }

          // Merge JSON-LD from subpage
          for (const ld of subpageLd) {
            if (!ld.name) continue;
            const match = events.find(e => e.title.toLowerCase() === ld.name!.toLowerCase());
            if (match) {
              if (ld.startDate && !match.start_date) match.start_date = ld.startDate;
              if (ld.endDate && !match.end_date) match.end_date = ld.endDate;
              if (ld.price != null && match.price_min == null) { match.price_min = ld.price; match.price_max = ld.price; }
              if (ld.url && !match.ticket_url) match.ticket_url = ld.url;
              if (ld.image && !match.photo_url) match.photo_url = ld.image;
            }
          }
        } catch { /* parse error */ }
      }

      // Extract links from THIS subpage and add to frontier (BFS)
      const subpageLinks = extractCandidateLinks(linkHtml, link.url, events.map(e => e.title), domain);
      for (const sl of subpageLinks) {
        const slNorm = sl.url.split("?")[0].split("#")[0].replace(/\/$/, "");
        if (!visitedUrls.has(slNorm) && !frontier.some(f => f.url.split("?")[0].split("#")[0].replace(/\/$/, "") === slNorm)) {
          frontier.push(sl);
        }
      }
      frontier.sort((a, b) => b.score - a.score);

      steps.push({
        step: "link_follow", url: link.url, aiCalls: 1,
        inputTokens: linkResult.inputTokens, outputTokens: linkResult.outputTokens,
        eventsAffected: newEventsFound + fieldsFilledIn.length, fieldsFilledIn, durationMs: Date.now() - lfStart,
      });

      console.log(`[scraper-v3] ${venue.name}: ${link.url} → ${newEventsFound} new, ${fieldsFilledIn.length} enriched (frontier: ${frontier.length})`);

    } catch (e) {
      console.warn(`[scraper-v3] Link follow failed for ${link.url}:`, e);
      continue;
    }
  }

  if (frontier.length === 0 && !budget.stopReason) budget.setStopReason("frontier_exhausted");
  const completenessAfterFollows = averageCompleteness(events, weights);

  // STEP 4: Conditional verification
  let mergedEvents: MergedEvent[];

  // STEP 3: Verify ALL events (no dateless filter — FR-08)
  if (events.length > 0 && budget.canAffordAiCall()) {
    const vStart = Date.now();
    try {
      const pass2Result = await callDeepSeek(
        buildVerificationPrompt(venue.name, events),
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

      mergedEvents = mergeExtractionResults(events, pass2Events, weights);

      steps.push({
        step: "verify", url: "", aiCalls: 1,
        inputTokens: pass2Result.inputTokens, outputTokens: pass2Result.outputTokens,
        eventsAffected: mergedEvents.length, fieldsFilledIn: ["description", "genre_tags"], durationMs: Date.now() - vStart,
      });
    } catch (pass2Error) {
      console.error(`[scraper-v3] Verify failed for ${venue.name}:`, pass2Error);
      mergedEvents = events.map((p1, i) => {
        const comp = evaluateCompleteness(p1, i, weights);
        return {
          ...p1, start_date: p1.start_date ?? null, end_date: p1.end_date ?? null,
          description: null, genre_tags: [] as string[], cast_members: null, photo_url: p1.photo_url ?? null,
          confidence: 0.5, extraction_status: comp.needsFollow ? "partial" : "complete", missing_fields: comp.missingFields, found_by: [],
          source_url: p1.source_url ?? venue.calendar_url,
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
        description: null, genre_tags: [] as string[], cast_members: null, photo_url: p1.photo_url ?? null,
        confidence: 0.4,
        extraction_status: comp.needsFollow ? "budget_exhausted" : "complete",
        missing_fields: comp.missingFields, found_by: [],
        source_url: p1.source_url ?? venue.calendar_url,
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
    recoveredUrl,
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
    budgetLimit: 0.10,
    linksFollowed: linksFollowed.slice(1),
    completenessBeforeFollows: before,
    completenessAfterFollows: after,
    stopReason: budget.stopReason ?? "complete",
  };
}
