// supabase/functions/_shared/scraper/play-matcher.ts
// Post-processing step: runs after event upserts in process-venue.ts.
// Matches theater event titles to canonical play records via:
//   1. Exact title match (after normalization)
//   2. Fuzzy word-overlap match (threshold 0.8, single-word titles bypass)
//   3. AI identification via DeepSeek V4 Flash (batch of up to 10)
// Non-show event types (class, workshop, festival, open-call) are skipped.
// All errors are caught and logged — this function NEVER throws.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { PlayRecord, AiPlayIdentification, PlayMatchSummary } from "./types.ts";
import { logUsage } from "../logUsage.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;

// ============================================================
// NORMALIZATION
// ============================================================

/**
 * Normalize a play title for comparison. Applied to BOTH the event title and
 * each catalog title before any comparison — never compare raw strings.
 *
 * Rules (in order):
 *   1. Lowercase
 *   2. Strip leading "the ", "a ", "an " (article prefix only — not mid-title)
 *   3. Remove possessive apostrophes and curly quotes (', ', `, ')
 *   4. Strip all punctuation except hyphens within words
 *   5. Collapse multiple spaces to single space
 *   6. Trim
 *
 * Examples:
 *   "The Children's Hour"    → "childrens hour"
 *   "AUGUST: OSAGE COUNTY"  → "august osage county"
 *   "August: Osage County"  → "august osage county"
 *   "Who's Afraid of Virginia Woolf?" → "whos afraid of virginia woolf"
 *   "God of Carnage"         → "god of carnage"
 *   "'night, Mother"         → "night mother"
 */
export function normalizePlayTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[''`‘’]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// WORD SET / OVERLAP (from venue-name-matcher.ts pattern)
// ============================================================

/**
 * Convert a normalized string to a Set of words, filtering out
 * single-character words (articles, prepositions) that add noise.
 * Identical to the pattern in venue-name-matcher.ts lines 18–19.
 */
function wordSet(text: string): Set<string> {
  return new Set(text.split(" ").filter((w) => w.length > 1));
}

/**
 * Word overlap score: shared words / max(a.size, b.size).
 * Returns 0 if either set is empty.
 * Identical to the pattern in venue-name-matcher.ts lines 21–28.
 */
function wordOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) {
    if (b.has(w)) shared++;
  }
  return shared / Math.max(a.size, b.size);
}

// ============================================================
// CATALOG LOADING
// ============================================================

/**
 * Load all plays from the database into memory.
 * Called ONCE per runPlayMatcherBatch invocation — not once per event.
 * The catalog is ~300 rows (~50KB) — safe to hold in Edge Function memory.
 * Returns an empty array on error (caller degrades gracefully).
 */
export async function loadPlayCatalog(
  supabase: SupabaseClient,
): Promise<PlayRecord[]> {
  const { data, error } = await supabase
    .from("plays")
    .select("id, title, slug, playwright, year_written, source");

  if (error) {
    console.warn("[play-matcher] Failed to load play catalog:", error.message);
    return [];
  }

  return (data ?? []) as PlayRecord[];
}

// ============================================================
// EXACT MATCH
// ============================================================

/**
 * Attempt an exact match between the event title (normalized) and every
 * play title in the catalog (normalized). Returns the first match or null.
 *
 * "Exact" means: after normalizePlayTitle(), the two strings are identical.
 * This catches:
 *   - Same title, different case: "hamlet" → "Hamlet" ✓
 *   - Article prefix difference: "The Wolves" → "wolves" === "wolves" ✓
 *   - Apostrophe variants: "The Children's Hour" → "childrens hour" ✓
 *   - Colon stripping: "AUGUST: OSAGE COUNTY" → "august osage county" ✓
 */
export function exactMatch(
  eventTitle: string,
  catalog: PlayRecord[],
): PlayRecord | null {
  const normalized = normalizePlayTitle(eventTitle);
  for (const play of catalog) {
    if (normalizePlayTitle(play.title) === normalized) {
      return play;
    }
  }
  return null;
}

// ============================================================
// FUZZY MATCH
// ============================================================

/**
 * Attempt a fuzzy word-overlap match between the event title and every
 * play in the catalog. Returns the best match above the threshold, or null.
 *
 * SINGLE-WORD BYPASS: If the event title normalizes to a single word
 * (e.g., "Hamlet", "Topdog", "Pipeline"), skip fuzzy and return null.
 * Single-word fuzzy matches are too prone to false positives — they
 * must go through AI identification instead. (PRD FR4)
 *
 * Threshold default is 0.8 — intentionally conservative.
 * A score of 0.8 means 4 of 5 words match, or 8 of 10 words.
 * This prevents "Ham" from matching "Hamlet", "A Raisin" from matching
 * "A Raisin in the Sun", etc.
 */
export function fuzzyMatch(
  eventTitle: string,
  catalog: PlayRecord[],
  threshold = 0.8,
): { play: PlayRecord; score: number } | null {
  const normalizedEvent = normalizePlayTitle(eventTitle);
  const eventWords = wordSet(normalizedEvent);

  // Single-word bypass: go to AI, not fuzzy
  if (eventWords.size <= 1) {
    return null;
  }

  let best: { play: PlayRecord; score: number } | null = null;

  for (const play of catalog) {
    const normalizedPlay = normalizePlayTitle(play.title);
    const playWords = wordSet(normalizedPlay);
    const score = wordOverlap(eventWords, playWords);

    if (score >= threshold) {
      if (!best || score > best.score) {
        best = { play, score };
      }
    }
  }

  return best;
}

// ============================================================
// AI IDENTIFICATION PROMPT
// ============================================================

/**
 * Build the DeepSeek play identification prompt for a batch of up to 10 events.
 * The full prompt text is specified verbatim in PRD §6.
 *
 * Key rules embedded in the prompt (not to be modified without PRD update):
 *   - Skip rules: World Premiere, New Work, devised companies, improv, confidence < 0.85
 *   - Canonical title normalization: use published script title, not marketing title
 *   - Examples provided: "A Streetcar Named Desire" not "Streetcar"
 */
function buildPlayIdentificationPrompt(
  events: Array<{ index: number; title: string; description: string | null }>,
): string {
  const eventList = events
    .map(
      (e) =>
        `${e.index}. Title: "${e.title}"${
          e.description
            ? `\n   Description: "${e.description.slice(0, 200)}"`
            : ""
        }`,
    )
    .join("\n\n");

  return `You are identifying whether theater event titles represent productions of known canonical plays, or original/devised works.

For each event, determine:
1. Is this a production of a known, published play by a specific playwright?
2. Or is it an original work, devised ensemble piece, improv format, or work of unknown canonicity?

SKIP RULES — if any apply, set is_devised_or_original: true:
- Title contains "World Premiere", "New Work", "New Play"
- Event appears to be a revue, cabaret, or "An Evening of..."
- Known devised companies' signature shows (e.g., "The Infinite Wrench")
- Improv, sketch comedy, or clown formats
- Any title where you are not confident of the playwright (confidence < 0.85)

For canonical works, provide the NORMALIZED canonical title exactly as it appears in published scripts:
- "A Streetcar Named Desire" not "Streetcar"
- "August: Osage County" not "August Osage County"
- "Who's Afraid of Virginia Woolf?" with the question mark

Events:
${eventList}

Return valid JSON:
{
  "identifications": [
    {
      "index": 1,
      "is_canonical_work": true,
      "is_devised_or_original": false,
      "canonical_title": "The Children's Hour",
      "playwright": "Lillian Hellman",
      "year_written": 1934,
      "confidence": 0.95
    }
  ]
}`;
}

// ============================================================
// AI IDENTIFICATION BATCH
// ============================================================

/**
 * Send a batch of events (max 10) to DeepSeek V4 Flash for play identification.
 * Returns a Map<eventId, AiPlayIdentification>.
 *
 * API call pattern mirrors venue-name-matcher.ts exactly:
 *   - URL: https://api.deepseek.com/chat/completions
 *   - Model: deepseek-v4-flash
 *   - response_format: json_object
 *   - temperature: 0.1
 *   - max_tokens: 1024
 *   - AbortController timeout: 15 seconds
 *
 * On any error (network, timeout, parse): logs warning, returns empty Map.
 * The caller treats an empty Map result as "no matches found via AI" — safe.
 */
export async function aiIdentifyBatch(
  events: Array<{ id: string; title: string; description: string | null }>,
  catalog: PlayRecord[],
  supabase: SupabaseClient,
): Promise<Map<string, AiPlayIdentification>> {
  const results = new Map<string, AiPlayIdentification>();
  if (events.length === 0) return results;

  // Build indexed event list for the prompt
  const indexedEvents = events.map((e, i) => ({
    index: i + 1,
    title: e.title,
    description: e.description,
  }));

  const prompt = buildPlayIdentificationPrompt(indexedEvents);

  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-v4-flash",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 1024,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`DeepSeek ${response.status}: ${await response.text()}`);
      }

      const data: {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      } = await response.json();

      inputTokens = data.usage?.prompt_tokens ?? 0;
      outputTokens = data.usage?.completion_tokens ?? 0;

      const content = data.choices[0]?.message?.content;
      if (!content) throw new Error("Empty AI response");

      const parsed = JSON.parse(content);
      const identifications: Array<{
        index: number;
        is_canonical_work: boolean;
        is_devised_or_original: boolean;
        canonical_title: string | null;
        playwright: string | null;
        year_written: number | null;
        confidence: number;
      }> = parsed.identifications ?? [];

      for (const id of identifications) {
        const event = events[id.index - 1];
        if (!event) continue;
        results.set(event.id, {
          is_canonical_work: id.is_canonical_work ?? false,
          is_devised_or_original: id.is_devised_or_original ?? false,
          canonical_title: id.canonical_title ?? null,
          playwright: id.playwright ?? null,
          year_written: id.year_written ?? null,
          confidence: id.confidence ?? 0,
        });
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    console.warn("[play-matcher] AI identification failed, skipping batch:", e);
    // Return empty map — caller handles gracefully
    return results;
  }

  // Log AI usage regardless of match results
  if (inputTokens > 0) {
    try {
      await logUsage(supabase, {
        userId: null,
        model: "deepseek-v4-flash",
        provider: "deepseek",
        feature: "play-matcher",
        inputTokens,
        outputTokens,
        metadata: {
          batch_size: events.length,
          catalog_size: catalog.length,
        },
      });
    } catch (e) {
      console.warn("[play-matcher] Usage logging failed:", e);
    }
  }

  return results;
}

// ============================================================
// FIND OR CREATE PLAY
// ============================================================

/**
 * Given an AI identification, find the canonical play in the catalog
 * (using exact + fuzzy match on the AI-returned canonical_title), or
 * create a new play record with source='ai'.
 *
 * Returns the play ID if found or created, or null on failure.
 *
 * Slug generation for new AI plays: mirrors slug-generator.ts pattern.
 * Format: normalized-title lowercased, non-alphanumeric → hyphens, max 80 chars.
 * If a slug collision occurs (UNIQUE constraint), catch the error and return null.
 * The event stays unmatched — better to skip than to assign the wrong play.
 *
 * Called only when:
 *   - identification.is_canonical_work === true
 *   - identification.confidence >= 0.85
 *   - identification.canonical_title is not null
 */
async function findOrCreatePlay(
  identification: AiPlayIdentification,
  catalog: PlayRecord[],
  supabase: SupabaseClient,
  runId: string | undefined,
): Promise<{ playId: string; created: boolean } | null> {
  if (!identification.canonical_title) return null;

  // Step 1: Try exact match against catalog using AI-returned canonical title
  const exactHit = exactMatch(identification.canonical_title, catalog);
  if (exactHit) {
    return { playId: exactHit.id, created: false };
  }

  // Step 2: Try fuzzy match against catalog
  const fuzzyHit = fuzzyMatch(identification.canonical_title, catalog);
  if (fuzzyHit) {
    return { playId: fuzzyHit.play.id, created: false };
  }

  // Step 3: Not in catalog — create a new play record with source='ai'
  // Slug: lowercase title, non-alphanumeric → hyphen, max 80 chars
  const slug = identification.canonical_title
    .toLowerCase()
    .replace(/[''`‘’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);

  try {
    const { data, error } = await supabase
      .from("plays")
      .insert({
        title: identification.canonical_title,
        slug,
        playwright: identification.playwright ?? "Unknown",
        year_written: identification.year_written ?? null,
        awards: [],
        synopsis: null,        // AI-created plays have no synopsis — editorial enrichment needed
        source: "ai",
        scraper_run_id: runId ?? null,
      })
      .select("id")
      .single();

    if (error) {
      // Duplicate slug from concurrent run or existing play — safe to skip
      console.warn(
        `[play-matcher] Failed to create play "${identification.canonical_title}" (slug: ${slug}):`,
        error.message,
      );
      return null;
    }

    return { playId: data.id, created: true };
  } catch (e) {
    console.warn("[play-matcher] findOrCreatePlay unexpected error:", e);
    return null;
  }
}

// ============================================================
// PRIMARY ENTRY POINT
// ============================================================

/**
 * Process a batch of event IDs through the three-stage matching pipeline.
 * Called by process-venue.ts after the event upsert loop completes.
 *
 * Stage 1: Load catalog once for the entire batch.
 * Stage 2: For each event with event_type='show' and play_id IS NULL:
 *           a. Exact title match
 *           b. Fuzzy word-overlap match (single-word titles skip to AI)
 *           c. AI identification batch (up to 10 per call)
 * Stage 3: For AI-identified canonical works: find-or-create play, set play_id.
 *
 * Returns PlayMatchSummary — never throws.
 * All errors are caught and logged as warnings.
 * A partial summary (with some fields at 0) is always returned.
 *
 * @param eventIds  Array of event UUIDs to process (from the most recent upsert loop)
 * @param supabase  Service role Supabase client (same instance as the caller uses)
 * @param runId     The scraper run_id for observability + AI play attribution
 */
export async function runPlayMatcherBatch(
  eventIds: string[],
  supabase: SupabaseClient,
  runId?: string,
): Promise<PlayMatchSummary> {
  const startTime = Date.now();
  const summary: PlayMatchSummary = {
    events_processed: 0,
    exact_matches: 0,
    fuzzy_matches: 0,
    ai_matches: 0,
    plays_created: 0,
    events_skipped: 0,
    events_unmatched: 0,
    ai_input_tokens: 0,
    ai_output_tokens: 0,
    duration_ms: 0,
  };

  if (eventIds.length === 0) {
    summary.duration_ms = Date.now() - startTime;
    return summary;
  }

  try {
    // --- Stage 1: Load catalog into memory (one query for the whole batch) ---
    const catalog = await loadPlayCatalog(supabase);
    if (catalog.length === 0) {
      console.warn("[play-matcher] Catalog is empty — skipping batch");
      summary.duration_ms = Date.now() - startTime;
      return summary;
    }

    // --- Fetch events to process: only show type, only without play_id ---
    const { data: events, error: eventError } = await supabase
      .from("events")
      .select("id, title, description, event_type, play_id")
      .in("id", eventIds)
      .eq("event_type", "show")
      .is("play_id", null);

    if (eventError) {
      console.warn("[play-matcher] Failed to fetch events:", eventError.message);
      summary.duration_ms = Date.now() - startTime;
      return summary;
    }

    // Count skipped events (non-show types in the input batch)
    // We can only count these if we also fetch the skipped types
    const { count: skippedCount } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .in("id", eventIds)
      .neq("event_type", "show");
    summary.events_skipped = skippedCount ?? 0;

    const showEvents = events ?? [];
    summary.events_processed = showEvents.length;

    if (showEvents.length === 0) {
      summary.duration_ms = Date.now() - startTime;
      return summary;
    }

    // --- Stage 2: Exact + fuzzy matching (synchronous, no AI) ---
    const aiCandidates: Array<{
      id: string;
      title: string;
      description: string | null;
    }> = [];

    for (const event of showEvents) {
      // Try exact match
      const exactHit = exactMatch(event.title, catalog);
      if (exactHit) {
        await supabase
          .from("events")
          .update({ play_id: exactHit.id })
          .eq("id", event.id);
        summary.exact_matches++;
        continue;
      }

      // Try fuzzy match (single-word titles bypass to AI)
      const fuzzyHit = fuzzyMatch(event.title, catalog);
      if (fuzzyHit) {
        await supabase
          .from("events")
          .update({ play_id: fuzzyHit.play.id })
          .eq("id", event.id);
        summary.fuzzy_matches++;
        continue;
      }

      // Neither matched — queue for AI
      aiCandidates.push({
        id: event.id,
        title: event.title,
        description: event.description ?? null,
      });
    }

    // --- Stage 3: AI identification in batches of 10 ---
    const AI_BATCH_SIZE = 10;

    for (let i = 0; i < aiCandidates.length; i += AI_BATCH_SIZE) {
      const batch = aiCandidates.slice(i, i + AI_BATCH_SIZE);
      const identifications = await aiIdentifyBatch(batch, catalog, supabase);

      for (const candidate of batch) {
        const id = identifications.get(candidate.id);

        if (!id) {
          // AI returned no identification for this event (batch error or missing index)
          summary.events_unmatched++;
          continue;
        }

        // Devised/original: leave play_id null
        if (id.is_devised_or_original || !id.is_canonical_work) {
          summary.events_unmatched++;
          continue;
        }

        // Confidence gate: below 0.85 → leave play_id null
        if (id.confidence < 0.85) {
          summary.events_unmatched++;
          continue;
        }

        // Find or create the play
        const result = await findOrCreatePlay(id, catalog, supabase, runId);

        if (!result) {
          summary.events_unmatched++;
          continue;
        }

        // Set play_id on the event
        await supabase
          .from("events")
          .update({ play_id: result.playId })
          .eq("id", candidate.id);

        summary.ai_matches++;
        if (result.created) {
          summary.plays_created++;
          // Add the new play to the in-memory catalog so subsequent events
          // in this batch can match against it via exact/fuzzy
          // (only matters for batches where the same new play appears twice)
          const { data: newPlay } = await supabase
            .from("plays")
            .select("id, title, slug, playwright, year_written, source")
            .eq("id", result.playId)
            .single();
          if (newPlay) catalog.push(newPlay as PlayRecord);
        }
      }
    }

    // Count remaining unmatched (those that went through AI but got no result)
    // Already counted above via events_unmatched increments.
    // Remaining: events not processed above due to batch issues
    const totalAccounted =
      summary.exact_matches +
      summary.fuzzy_matches +
      summary.ai_matches +
      summary.events_unmatched;
    if (totalAccounted < summary.events_processed) {
      summary.events_unmatched += summary.events_processed - totalAccounted;
    }
  } catch (e) {
    console.warn("[play-matcher] runPlayMatcherBatch failed:", e);
    // Return partial summary — never throw
  }

  summary.duration_ms = Date.now() - startTime;
  return summary;
}
