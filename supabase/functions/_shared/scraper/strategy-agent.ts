import { cleanHtml, htmlToMarkdown, extractJsonLd, type JsonLdEvent } from "./html-cleaner.ts";
import { repairJson } from "./json-repair.ts";
import { buildExtractionPrompt, buildClassExtractionPrompt } from "./extraction-prompt.ts";
import { buildVerificationPrompt } from "./verification-prompt.ts";
import { buildTargetedExtractionPrompt } from "./targeted-prompt.ts";
import { extractCandidateLinks, prioritizeLinks, canonicalizeUrl, hardFilterLinks, scoreLinksLLM } from "./link-extractor.ts";
import { DEFAULT_FIELD_WEIGHTS, shouldFollowLinks, mergeTargetedExtraction, averageCompleteness, evaluateCompleteness, averageProgramCompleteness } from "./completeness-evaluator.ts";
import { CostBudget, CLASS_CRAWL_TOTALS } from "./cost-budget.ts";
import { lookupVenueOnTic, ticShowsToEnrichments, enrichFromTicDetail } from "./tic-lookup.ts";
import { resolveVenueUrl } from "./url-resolver.ts";
import { runRecon, type ReconResult } from "./recon.ts";
import { extractOgImage } from "./og-image-extractor.ts";
import { AOA_UA, enforceRateLimit, extractRegistrableDomain, classifyFetchError } from "./politeness.ts";
import { classifyPage, extractHeadings, extractTitle, CLASSIFIER_ROUTING, needsRender } from "./page-classifier.ts";
import { stripBoilerplate } from "./boilerplate.ts";
import type {
  VenueTarget,
  Pass1Event,
  Pass2Verification,
  DeepSeekResponse,
  StrategyTrace,
  StrategyStep,
  TargetedEnrichment,
  StrategyProfile,
  Program,
  ClassExtractionResult,
  SiteProfileRow,
} from "./types.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY") ?? "";

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

async function callPerplexity(systemPrompt: string, userContent: string, maxTokens = 8192): Promise<AiResult> {
  if (!PERPLEXITY_API_KEY) return { content: null, inputTokens: 0, outputTokens: 0 };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
        max_tokens: maxTokens,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Perplexity API error (${response.status})`);
    const data: DeepSeekResponse = await response.json();
    return { content: data.choices[0]?.message?.content ?? null, inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 };
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
    { name: "gemini-3.5-flash", fn: callGemini },
    { name: "gpt-5.6-luna", fn: callOpenAI },
    { name: "sonar", fn: callPerplexity },
  ];

  const start = Date.now();
  const settled = await Promise.allSettled(
    models.map(async (m) => {
      const mStart = Date.now();
      try {
        const result = await m.fn(systemPrompt, content);
        let events: Pass1Event[] = [];
        if (result.content) {
          const parsed = repairJson(result.content) as { events?: Pass1Event[] } | null;
          if (parsed) events = parsed.events ?? [];
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

  const budget = new CostBudget(
    isClassDomain
      ? { maxAiCalls: 40, maxFetches: 30, maxUsd: 1.00, wallClockMs: 120_000 }
      : undefined,
  );
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
  let cleaned = htmlToMarkdown(rawHtml, seedUrl);

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

    console.log(`[scraper-v3] ${venue.name}: 3-model extraction → winner: ${best.model} (${best.events.length} events). Results: ${modelResults.map(r => `${r.model}=${r.events.length}/${r.status}`).join(", ")}`);

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

      const fbCleaned = htmlToMarkdown(fbHtml, venue.website_url!);
      if (fbCleaned.length >= 100) {
        const fbResult = await callDeepSeek(buildExtractionPrompt(venue.name), fbCleaned);
        budget.recordAiCall(fbResult.inputTokens, fbResult.outputTokens);
        totalInputTokens += fbResult.inputTokens;
        totalOutputTokens += fbResult.outputTokens;

        if (fbResult.content) {
          const parsed = repairJson(fbResult.content) as { events?: Pass1Event[] } | null;
          if (parsed) {
            events = parsed.events ?? [];
            rawHtml = fbHtml;
            for (const e of events) foundByMap.set(e.title.toLowerCase(), new Set(["venue_website"]));
          }
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

      let linkCleaned = htmlToMarkdown(linkHtml, link.url);

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
        const parsed = repairJson(linkResult.content) as { events?: Pass1Event[] } | null;
        if (parsed) {
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
        }
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
        const parsed = repairJson(pass2Result.content) as { events?: Pass2Verification[] } | null;
        if (parsed) pass2Events = parsed.events ?? [];
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

// --- Scraper v4: Class-domain strategy with resumable BFS ---

const SUPABASE_URL_FOR_STATE = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_FOR_STATE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CrawlStateRow {
  id: string;
  venue_id: string;
  domain: string;
  tier: number;
  status: string;
  frontier: Array<{ url: string; anchor: string; score: number }>;
  visited: string[];
  programs_partial: Program[];
  school_address: string | null;
  block_hashes: Record<string, number>;
  link_score_cache: Record<string, number>;
  budget_used: { fetches: number; aiCalls: number; usd: number };
  invocation_count: number;
  stop_reason: string | null;
}

export interface ClassStrategyResult {
  status: "in_progress" | "complete" | "failed" | "escalated";
  programs: Program[];
  schoolAddress: string | null;
  trace: StrategyTrace;
  invocations: number;
  photoUrl: string | null;
}

async function fetchWithUA(url: string, timeoutMs = FETCH_TIMEOUT): Promise<{ raw: string; ok: boolean }> {
  const domain = extractRegistrableDomain(url);
  await enforceRateLimit(domain);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": AOA_UA },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return { raw: "", ok: false };
    return { raw: await res.text(), ok: true };
  } catch {
    clearTimeout(timeout);
    return { raw: "", ok: false };
  }
}

async function fetchViaJina(url: string, budget: CostBudget): Promise<string | null> {
  if (!budget.canAffordFetch()) return null;
  const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
  const { raw, ok } = await fetchWithUA(jinaUrl, 30_000);
  budget.recordFetch();
  return ok && raw.length > 0 ? raw : null;
}

function isFreshProfile(p: SiteProfileRow): boolean {
  if (!p.last_success_at) return false;
  const age = Date.now() - new Date(p.last_success_at).getTime();
  return age < 14 * 86400_000 && p.consecutive_failures === 0;
}

function computeDeadEndPatterns(steps: StrategyStep[]): string[] {
  const deadKinds = ["youth_only", "blog_or_news", "policy_or_admin", "faculty"];
  const deadPaths = steps
    .filter(s => deadKinds.includes(s.fieldsFilledIn?.[0] ?? ""))
    .map(s => { try { return new URL(s.url).pathname; } catch { return null; } })
    .filter((p): p is string => p !== null);

  const prefixCounts: Record<string, number> = {};
  for (const path of deadPaths) {
    const segments = path.split("/").filter(Boolean);
    if (segments.length > 0) {
      const prefix = "/" + segments[0] + "/";
      prefixCounts[prefix] = (prefixCounts[prefix] ?? 0) + 1;
    }
  }
  return Object.entries(prefixCounts)
    .filter(([, count]) => count >= 2)
    .map(([prefix]) => prefix);
}

function generalizeUrlPatterns(urls: string[]): string[] {
  return [...new Set(urls.map(url => {
    try {
      const path = new URL(url).pathname;
      const segments = path.split("/").filter(Boolean);
      if (segments.length >= 2) {
        return "/" + segments.slice(0, -1).join("/") + "/*";
      }
      return path;
    } catch { return "/"; }
  }))];
}

function getClassAiConfig(): { key: string; url: string; model: string } | null {
  const openai = OPENAI_API_KEY || Deno.env.get("OPENAI_API_KEY");
  if (openai) return { key: openai, url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" };
  if (DEEPSEEK_API_KEY) return { key: DEEPSEEK_API_KEY, url: "https://api.deepseek.com/chat/completions", model: "deepseek-chat" };
  return null;
}

async function extractClassPrograms(
  content: string,
  url: string,
  schoolName: string,
  city: string,
  budget: CostBudget,
): Promise<ClassExtractionResult | null> {
  const ai = getClassAiConfig();
  if (!ai || !budget.canAffordAiCall()) return null;

  const runDate = new Date().toISOString().slice(0, 10);
  const systemPrompt = buildClassExtractionPrompt(schoolName, city, runDate);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);
    const res = await fetch(ai.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Page URL: ${url}\nPage content (markdown):\n---\n${content.slice(0, 28_000)}\n---` },
        ],
        temperature: 0,
        max_tokens: 4000,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const data: DeepSeekResponse = await res.json();
    budget.recordAiCall(data.usage.prompt_tokens, data.usage.completion_tokens);
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = repairJson(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      school_address: (parsed as any).school_address ?? null,
      programs: Array.isArray((parsed as any).programs) ? (parsed as any).programs : [],
    };
  } catch {
    return null;
  }
}

export async function executeClassStrategy(
  venue: VenueTarget,
  schoolName: string,
  city: string,
  siteProfile?: SiteProfileRow | null,
): Promise<ClassStrategyResult> {
  const sb = createClient(SUPABASE_URL_FOR_STATE, SERVICE_ROLE_FOR_STATE);
  const seedUrl = venue.calendar_url;
  const domain = extractRegistrableDomain(seedUrl);

  const { data: existingState } = await sb
    .from("crawl_state")
    .select("*")
    .eq("venue_id", venue.id)
    .eq("status", "running")
    .maybeSingle();

  let state: CrawlStateRow;
  let isResume = false;

  if (existingState) {
    const raw = existingState;
    state = {
      ...raw,
      frontier: typeof raw.frontier === "string" ? JSON.parse(raw.frontier) : (raw.frontier ?? []),
      visited: typeof raw.visited === "string" ? JSON.parse(raw.visited) : (raw.visited ?? []),
      programs_partial: typeof raw.programs_partial === "string" ? JSON.parse(raw.programs_partial) : (raw.programs_partial ?? []),
      block_hashes: typeof raw.block_hashes === "string" ? JSON.parse(raw.block_hashes) : (raw.block_hashes ?? {}),
      link_score_cache: typeof raw.link_score_cache === "string" ? JSON.parse(raw.link_score_cache) : (raw.link_score_cache ?? {}),
      budget_used: typeof raw.budget_used === "string" ? JSON.parse(raw.budget_used) : (raw.budget_used ?? { fetches: 0, aiCalls: 0, usd: 0 }),
    } as CrawlStateRow;
    isResume = true;
  } else {
    state = {
      id: crypto.randomUUID(),
      venue_id: venue.id,
      domain,
      tier: 1,
      status: "running",
      frontier: [],
      visited: [],
      programs_partial: [],
      school_address: null,
      block_hashes: {},
      link_score_cache: {},
      budget_used: { fetches: 0, aiCalls: 0, usd: 0 },
      invocation_count: 0,
      stop_reason: null,
    };
  }

  const budget = CostBudget.fromResumable(CLASS_CRAWL_TOTALS, state.budget_used);
  const steps: StrategyStep[] = [];
  const visited = new Set(state.visited);
  const scoreCache = new Map(Object.entries(state.link_score_cache));
  let blockHashes = { ...state.block_hashes };
  let programs = [...state.programs_partial];
  let schoolAddress = state.school_address;
  let noProgressCount = 0;
  const classifierCounts: Record<string, number> = {};
  let boilerplateDroppedTotal = 0;
  const fetchErrors = { blocked: 0, timeout: 0, dead: 0, other: 0 };
  let ogImage: string | null = null;
  let jinaFetchCount = 0;
  let jinaEmptyCount = 0;
  let jinaUpgraded = false;
  const warmStart = !!(siteProfile && isFreshProfile(siteProfile));
  const preferJina = warmStart && siteProfile!.render_needed;
  let recon: ReconResult | null = null;
  const warmDeadEnds: string[] = warmStart ? (siteProfile!.dead_end_patterns ?? []) : [];

  if (!isResume) {
    const seedStep = Date.now();
    const { raw: seedRaw, ok: seedOk } = await fetchWithUA(seedUrl);
    budget.recordFetch();

    if (!seedOk) {
      state.status = "failed";
      state.stop_reason = "seed_fetch_failed";
      await sb.from("crawl_state").insert(state);
      return {
        status: "failed", programs: [], schoolAddress: null,
        trace: buildTrace(steps, budget, [], 0, 0), invocations: 1, photoUrl: null,
      };
    }

    visited.add(canonicalizeUrl(seedUrl));
    let seedCleaned = htmlToMarkdown(seedRaw, seedUrl);

    const rawOg = extractOgImage(seedRaw, seedUrl);
    if (rawOg && rawOg.startsWith("https://") && !rawOg.endsWith(".svg") && rawOg.length <= 500) {
      ogImage = rawOg;
    }

    let reconPlatform = siteProfile?.platform ?? null;

    if (warmStart) {
      // Warm start: skip full recon, seed frontier from profile entry_points
      console.log(`[sv4] Warm start for ${domain} (profile v${siteProfile!.profile_version})`);
      const entrySeeds = (siteProfile!.entry_points ?? [])
        .map((ep) => ({ url: ep.url, anchor: ep.page_kind, score: 100 }));

      const rawLinks = extractCandidateLinks(seedRaw, seedUrl, [], "class");
      const mdLinks = rawLinks.map((l) => ({ url: l.url, anchor: l.anchorText }));
      const filtered = hardFilterLinks(
        mdLinks, visited, scoreCache, new URL(seedUrl).origin,
        [], siteProfile!.robots ?? [], warmDeadEnds,
      );

      const llmScores = await scoreLinksLLM(filtered, schoolName, city, budget, OPENAI_API_KEY || DEEPSEEK_API_KEY);
      for (const [url, score] of llmScores) scoreCache.set(url, score);

      const scoredLinks = filtered
        .map((l) => ({ ...l, score: llmScores.get(canonicalizeUrl(l.url)) ?? 20 }))
        .filter((l) => l.score >= 25);

      state.frontier = [...entrySeeds, ...scoredLinks]
        .sort((a, b) => b.score - a.score);
    } else {
      // Cold start: full recon
      recon = await runRecon({ name: schoolName, city }, seedUrl, seedRaw, seedCleaned, budget);
      reconPlatform = recon.platform;

      if (recon.identity === "mismatch" && recon.identityConfidence >= 0.7) {
        state.status = "failed";
        state.stop_reason = "identity_mismatch";
        await sb.from("crawl_state").insert(state);
        return {
          status: "failed", programs: [], schoolAddress: null,
          trace: buildTrace(steps, budget, [], 0, 0), invocations: 1, photoUrl: ogImage,
        };
      }

      const catalogSeeds = recon.catalogUrls.map((url) => ({ url, anchor: "catalog", score: 100 }));
      const sitemapSeeds = recon.sitemapUrls.slice(0, 20).map((url) => ({ url, anchor: "sitemap", score: 80 }));

      const rawLinks = extractCandidateLinks(seedRaw, seedUrl, [], "class");
      const mdLinks = rawLinks.map((l) => ({ url: l.url, anchor: l.anchorText }));
      const filtered = hardFilterLinks(
        mdLinks, visited, scoreCache, new URL(seedUrl).origin,
        recon.allowedExternalHosts, recon.robotsDisallow, [],
      );

      const llmScores = await scoreLinksLLM(filtered, schoolName, city, budget, OPENAI_API_KEY || DEEPSEEK_API_KEY);
      for (const [url, score] of llmScores) scoreCache.set(url, score);

      const scoredLinks = filtered
        .map((l) => ({ ...l, score: llmScores.get(canonicalizeUrl(l.url)) ?? 20 }))
        .filter((l) => l.score >= 25);

      state.frontier = [...catalogSeeds, ...sitemapSeeds, ...scoredLinks]
        .sort((a, b) => b.score - a.score);
    }

    const { stripped, updatedHashes, droppedCount } = stripBoilerplate(seedCleaned, blockHashes);
    blockHashes = updatedHashes;
    boilerplateDroppedTotal += droppedCount;

    const title = extractTitle(seedRaw);
    const headings = extractHeadings(stripped);
    const classResult = await classifyPage(seedUrl, title, headings, stripped.slice(0, 1200), schoolName, budget, OPENAI_API_KEY || DEEPSEEK_API_KEY);
    classifierCounts[classResult.page_kind] = (classifierCounts[classResult.page_kind] ?? 0) + 1;

    const routing = CLASSIFIER_ROUTING[classResult.page_kind] ?? { runExtraction: false, harvestLinks: true };
    let seedProgramsFound = 0;
    if (routing.runExtraction) {
      const extraction = await extractClassPrograms(stripped, seedUrl, schoolName, city, budget);
      if (extraction) {
        if (extraction.school_address && !schoolAddress) schoolAddress = extraction.school_address;
        seedProgramsFound = extraction.programs.length;
        if (seedProgramsFound > 0) programs.push(...extraction.programs);
      }
    }

    // Jina fallback on seed: evidence-based trigger
    const seedRawLinks = extractCandidateLinks(seedRaw, seedUrl, [], "class");
    const seedSameDomainLinks = seedRawLinks.filter(l => {
      try { return extractRegistrableDomain(l.url) === domain; } catch { return false; }
    }).length;
    const seedTotalBlocks = Math.max(1, seedCleaned.split(/\n{2,}/).filter(b => b.trim()).length);
    const seedBoilerplateRatio = droppedCount / seedTotalBlocks;

    if (seedProgramsFound === 0 && needsRender({
      cleanedLength: stripped.length,
      pageKind: classResult.page_kind,
      programsExtracted: seedProgramsFound,
      sameDomainLinkCount: seedSameDomainLinks,
      boilerplateDroppedRatio: seedBoilerplateRatio,
    }) && budget.canAffordFetch()) {
      const jinaContent = await fetchViaJina(seedUrl, budget);
      jinaFetchCount++;
      if (jinaContent && jinaContent.length > stripped.length) {
        // Jina returns markdown — skip htmlToMarkdown, go straight to boilerplate strip
        const jinaStripped = stripBoilerplate(jinaContent, blockHashes);
        blockHashes = jinaStripped.updatedHashes;
        const jinaClass = await classifyPage(seedUrl, title, extractHeadings(jinaStripped.stripped), jinaStripped.stripped.slice(0, 1200), schoolName, budget, OPENAI_API_KEY || DEEPSEEK_API_KEY);
        const jinaRouting = CLASSIFIER_ROUTING[jinaClass.page_kind] ?? { runExtraction: false, harvestLinks: true };
        if (jinaRouting.runExtraction) {
          const jinaExtraction = await extractClassPrograms(jinaStripped.stripped, seedUrl, schoolName, city, budget);
          if (jinaExtraction) {
            if (jinaExtraction.school_address && !schoolAddress) schoolAddress = jinaExtraction.school_address;
            if (jinaExtraction.programs.length > 0) {
              programs.push(...jinaExtraction.programs);
              seedProgramsFound += jinaExtraction.programs.length;
              jinaUpgraded = true;
            }
          }
        }
        if (!jinaUpgraded) jinaEmptyCount++;
      } else {
        jinaEmptyCount++;
      }
    }

    steps.push({
      step: "initial_extract", url: seedUrl, aiCalls: budget.aiCallsMade,
      inputTokens: 0, outputTokens: 0, eventsAffected: seedProgramsFound,
      fieldsFilledIn: warmStart ? ["warm_start", `platform:${reconPlatform}`] : ["recon", `platform:${reconPlatform}`],
      durationMs: Date.now() - seedStep,
    });
  }

  let frontier = [...state.frontier];
  frontier.sort((a, b) => b.score - a.score);

  while (frontier.length > 0 && !budget.isExhausted()) {
    const next = frontier.shift()!;
    const canonical = canonicalizeUrl(next.url);
    if (visited.has(canonical)) continue;
    visited.add(canonical);

    const pageStart = Date.now();
    let raw: string;
    let usedJinaForFetch = false;

    if (preferJina) {
      // Warm start with render_needed: go straight through Jina
      const jinaResult = await fetchViaJina(next.url, budget);
      jinaFetchCount++;
      if (!jinaResult) continue;
      raw = jinaResult;
      usedJinaForFetch = true;
    } else {
      try {
        const result = await fetchWithUA(next.url);
        budget.recordFetch();
        if (!result.ok) {
          const errType = classifyFetchError(new Error(`HTTP error for ${next.url}`));
          fetchErrors[errType]++;
          continue;
        }
        raw = result.raw;
      } catch (e) {
        budget.recordFetch();
        const errType = classifyFetchError(e);
        fetchErrors[errType]++;
        continue;
      }
    }

    // Jina returns markdown — skip htmlToMarkdown; plain fetch returns HTML
    const cleaned = usedJinaForFetch ? raw : htmlToMarkdown(raw, next.url);
    const { stripped, updatedHashes, droppedCount } = stripBoilerplate(cleaned, blockHashes);
    blockHashes = updatedHashes;
    boilerplateDroppedTotal += droppedCount;

    const title = usedJinaForFetch ? "" : extractTitle(raw);
    const headings = extractHeadings(stripped);
    const classification = await classifyPage(next.url, title, headings, stripped.slice(0, 1200), schoolName, budget, OPENAI_API_KEY || DEEPSEEK_API_KEY);
    classifierCounts[classification.page_kind] = (classifierCounts[classification.page_kind] ?? 0) + 1;

    const routing = CLASSIFIER_ROUTING[classification.page_kind] ?? { runExtraction: false, harvestLinks: true };
    let programsFromPage = 0;

    if (routing.runExtraction) {
      const extraction = await extractClassPrograms(stripped, next.url, schoolName, city, budget);
      if (extraction) {
        if (extraction.school_address && !schoolAddress) schoolAddress = extraction.school_address;
        programsFromPage = extraction.programs.length;
        if (programsFromPage > 0) programs.push(...extraction.programs);
      }
    }

    // Jina fallback: evidence-based trigger for pages fetched via plain HTTP
    if (!usedJinaForFetch && programsFromPage === 0 && budget.canAffordFetch()) {
      const pageSameDomainLinks = usedJinaForFetch ? 0 : extractCandidateLinks(raw, next.url, [], "class")
        .filter(l => { try { return extractRegistrableDomain(l.url) === domain; } catch { return false; } }).length;
      const pageTotalBlocks = Math.max(1, cleaned.split(/\n{2,}/).filter(b => b.trim()).length);
      if (needsRender({
        cleanedLength: stripped.length,
        pageKind: classification.page_kind,
        programsExtracted: programsFromPage,
        sameDomainLinkCount: pageSameDomainLinks,
        boilerplateDroppedRatio: droppedCount / pageTotalBlocks,
      })) {
        const jinaContent = await fetchViaJina(next.url, budget);
        jinaFetchCount++;
        if (jinaContent && jinaContent.length > stripped.length) {
          const jinaStrip = stripBoilerplate(jinaContent, blockHashes);
          blockHashes = jinaStrip.updatedHashes;
          const jinaExtraction = await extractClassPrograms(jinaStrip.stripped, next.url, schoolName, city, budget);
          if (jinaExtraction) {
            if (jinaExtraction.school_address && !schoolAddress) schoolAddress = jinaExtraction.school_address;
            if (jinaExtraction.programs.length > 0) {
              programs.push(...jinaExtraction.programs);
              programsFromPage += jinaExtraction.programs.length;
              jinaUpgraded = true;
            }
          }
          if (programsFromPage === 0) jinaEmptyCount++;
        } else {
          jinaEmptyCount++;
        }
      }
    }

    if (routing.harvestLinks && !usedJinaForFetch) {
      const pageLinks = extractCandidateLinks(raw, next.url, [], "class");
      const mdLinks = pageLinks.map((l) => ({ url: l.url, anchor: l.anchorText }));
      const filtered = hardFilterLinks(
        mdLinks, visited, scoreCache, new URL(seedUrl).origin, [], [], warmDeadEnds,
      );
      if (filtered.length > 0 && budget.canAffordAiCall()) {
        const newScores = await scoreLinksLLM(filtered, schoolName, city, budget, OPENAI_API_KEY || DEEPSEEK_API_KEY);
        for (const [url, score] of newScores) scoreCache.set(url, score);
        const newLinks = filtered
          .map((l) => ({ ...l, score: newScores.get(canonicalizeUrl(l.url)) ?? 15 }))
          .filter((l) => l.score >= 25);
        frontier.push(...newLinks);
        frontier.sort((a, b) => b.score - a.score);
      }
    }

    if (programsFromPage === 0) noProgressCount++;
    else noProgressCount = 0;
    if (noProgressCount >= 3) break;

    steps.push({
      step: "link_follow", url: next.url, aiCalls: 0,
      inputTokens: 0, outputTokens: 0, eventsAffected: programsFromPage,
      fieldsFilledIn: [classification.page_kind], durationMs: Date.now() - pageStart,
    });
  }

  const completeness = averageProgramCompleteness(programs);
  const budgetJson = budget.toJSON();
  const totalUsed = {
    fetches: state.budget_used.fetches + budgetJson.fetches,
    aiCalls: state.budget_used.aiCalls + budgetJson.aiCalls,
    usd: state.budget_used.usd + budgetJson.usd,
  };
  const invCount = state.invocation_count + 1;

  const totalsRemain = totalUsed.fetches < CLASS_CRAWL_TOTALS.maxFetches
    && totalUsed.aiCalls < CLASS_CRAWL_TOTALS.maxAiCalls
    && totalUsed.usd < CLASS_CRAWL_TOTALS.maxUsd;

  let finalStatus: "in_progress" | "complete" | "failed" | "escalated";
  let stopReason: string;

  const hasHighScoreFrontier = frontier.some(f => f.score >= 80);

  if (frontier.length > 0 && totalsRemain && invCount < 4) {
    finalStatus = "in_progress";
    stopReason = programs.length === 0 && hasHighScoreFrontier
      ? "zero_programs_frontier_remaining" : "invocation_cap";
  } else if (programs.length === 0 && hasHighScoreFrontier && !totalsRemain) {
    finalStatus = "failed";
    stopReason = "zero_programs_budget_exhausted";
  } else if (programs.length === 0 && frontier.length === 0) {
    finalStatus = "complete";
    stopReason = "frontier_exhausted_zero_programs";
  } else {
    finalStatus = "complete";
    stopReason = frontier.length === 0 ? "frontier_exhausted" : (budget.stopReason ?? "complete");
  }

  const resolvedOgImage = ogImage ?? (state as any).photo_url ?? null;

  let outOfCity = false;
  if (schoolAddress) {
    const stateMatch = schoolAddress.match(/,\s*([A-Z]{2})\s*\d{5}/);
    const trailingMatch = schoolAddress.match(/,\s*([A-Z]{2})\s*$/);
    const detectedState = stateMatch?.[1] ?? trailingMatch?.[1];
    if (detectedState && detectedState !== "IL") {
      outOfCity = true;
      console.log(`[sv4] Out-of-city detected: ${schoolAddress} (${detectedState} ≠ IL)`);
    }
  }

  const stateUpdate: Record<string, unknown> = {
    venue_id: venue.id,
    domain,
    tier: state.tier,
    status: finalStatus === "in_progress" ? "running" : finalStatus,
    frontier,
    visited: [...visited],
    programs_partial: programs,
    school_address: schoolAddress,
    block_hashes: blockHashes,
    link_score_cache: Object.fromEntries(scoreCache),
    budget_used: totalUsed,
    invocation_count: invCount,
    stop_reason: finalStatus !== "in_progress" ? stopReason : null,
    photo_url: resolvedOgImage,
    updated_at: new Date().toISOString(),
  };

  if (isResume) {
    await sb.from("crawl_state").update(stateUpdate).eq("id", state.id);
  } else {
    await sb.from("crawl_state").insert({ id: state.id, ...stateUpdate, created_at: new Date().toISOString() });
  }

  // Write/update site_profiles on terminal statuses
  if (finalStatus !== "in_progress") {
    const entryPoints = steps
      .filter(s => s.eventsAffected > 0)
      .map(s => ({
        url: s.url,
        page_kind: s.fieldsFilledIn?.[0] ?? "unknown",
        programs_yielded: s.eventsAffected,
      }))
      .slice(0, 10);

    const deadEndPatterns = computeDeadEndPatterns(steps);
    const urlPatterns = generalizeUrlPatterns(entryPoints.map(e => e.url));

    try {
      await sb.from("site_profiles").upsert({
        domain,
        venue_id: venue.id,
        platform: recon?.platform ?? siteProfile?.platform ?? null,
        tier_required: 1,
        render_needed: jinaUpgraded || (siteProfile?.render_needed ?? false),
        entry_points: entryPoints,
        url_patterns: urlPatterns,
        dead_end_patterns: deadEndPatterns,
        robots: recon?.robotsDisallow ?? siteProfile?.robots ?? null,
        address: schoolAddress,
        last_success_at: programs.length > 0 ? new Date().toISOString() : (siteProfile?.last_success_at ?? null),
        last_completeness: completeness,
        consecutive_failures: programs.length > 0 ? 0 : ((siteProfile?.consecutive_failures ?? 0) + 1),
        profile_version: ((siteProfile?.profile_version ?? 0) + 1),
        updated_at: new Date().toISOString(),
      }, { onConflict: "domain" });
    } catch (e) {
      console.warn(`[sv4] site_profiles upsert failed for ${domain}:`, e);
    }
  }

  const trace = buildTrace(
    steps, budget, [...visited], 0, completeness,
  );
  trace.classifierCounts = classifierCounts;
  trace.boilerplateDroppedBlocks = boilerplateDroppedTotal;
  trace.fetchErrors = fetchErrors;
  trace.invocations = invCount;
  trace.programsFound = programs.length;
  trace.addressFound = schoolAddress;
  trace.jinaFetches = jinaFetchCount;
  trace.jinaContentPagesEmpty = jinaEmptyCount;
  trace.tier = 1;
  trace.profileUsed = warmStart;
  trace.profileVersion = siteProfile?.profile_version;
  if (outOfCity) trace.out_of_city = true;

  console.log(`[sv4] ${venue.name} tier=${state.tier} inv=${invCount} fetches=${totalUsed.fetches} programs=${programs.length} completeness=${completeness} stop=${stopReason}${warmStart ? " (warm)" : ""}${jinaFetchCount > 0 ? ` jina=${jinaFetchCount}` : ""}`);

  return { status: finalStatus, programs, schoolAddress, trace, invocations: invCount, photoUrl: resolvedOgImage };
}
