import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\btheatre\b/g, "theater")
    .replace(/\bcompany\b/g, "")
    .replace(/\bchicago\b/g, "")
    .replace(/\bthe\b/g, "")
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(text: string): Set<string> {
  return new Set(text.split(" ").filter(w => w.length > 1));
}

function wordOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) {
    if (b.has(w)) shared++;
  }
  return shared / Math.max(a.size, b.size);
}

export function matchVenueName(ourName: string, ticName: string): number {
  const normA = normalize(ourName);
  const normB = normalize(ticName);

  if (normA === normB) return 1.0;
  if (normA.includes(normB) || normB.includes(normA)) return 0.9;

  let score = wordOverlap(wordSet(normA), wordSet(normB));

  if (score < 0.6) {
    const atIdx = ticName.toLowerCase().indexOf(" at ");
    if (atIdx > 0) {
      const venuePart = ticName.slice(atIdx + 4);
      const venueScore = wordOverlap(wordSet(normalize(ourName)), wordSet(normalize(venuePart)));
      const subMatch = normalize(ourName).includes(normalize(venuePart)) || normalize(venuePart).includes(normalize(ourName));
      if (subMatch) return 0.9;
      if (venueScore > score) score = venueScore;
    }
  }

  return score;
}

export function findBestMatch(
  ourName: string,
  ticVenueNames: string[],
  threshold = 0.6,
): { name: string; score: number } | null {
  let best: { name: string; score: number } | null = null;

  for (const ticName of ticVenueNames) {
    const score = matchVenueName(ourName, ticName);
    if (score >= threshold && (!best || score > best.score)) {
      best = { name: ticName, score };
    }
  }

  return best;
}

export async function lookupKnownPair(
  ourName: string,
  externalName: string,
  source: string,
  supabase: SupabaseClient,
): Promise<{ matched: boolean } | null> {
  try {
    const { data } = await supabase
      .from("match_decisions")
      .select("final_decision")
      .eq("our_venue_name", ourName)
      .eq("external_venue_name", externalName)
      .eq("source", source)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return { matched: data.final_decision === "matched" || data.final_decision === "ai_matched" };
  } catch {
    return null;
  }
}

export async function logMatchDecision(
  supabase: SupabaseClient,
  decision: {
    ourName: string;
    ourId?: string;
    externalName: string;
    source: string;
    heuristicScore: number;
    aiVerdict?: boolean;
    aiConfidence?: number;
    finalDecision: "matched" | "rejected" | "ai_matched" | "ai_rejected";
  },
): Promise<void> {
  try {
    await supabase.from("match_decisions").insert({
      our_venue_name: decision.ourName,
      our_venue_id: decision.ourId ?? null,
      external_venue_name: decision.externalName,
      source: decision.source,
      heuristic_score: decision.heuristicScore,
      ai_verdict: decision.aiVerdict ?? null,
      ai_confidence: decision.aiConfidence ?? null,
      final_decision: decision.finalDecision,
    });
  } catch (e) {
    console.warn("[match-decisions] Log failed:", e);
  }
}

interface AmbiguousPair {
  ourName: string;
  ourId: string;
  ticName: string;
  heuristicScore: number;
}

interface DeepSeekResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export async function aiMatchVenues(
  pairs: AmbiguousPair[],
  supabase: SupabaseClient,
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  if (pairs.length === 0) return results;

  const pairList = pairs
    .map((p, i) => `${i + 1}. Our DB: "${p.ourName}" vs TIC: "${p.ticName}"`)
    .join("\n");

  const prompt = `You are matching Chicago theater venue names. For each pair, determine if they refer to the same physical venue. Consider that venues may have different names for the same location (e.g., "Drury Lane Theatre" and "Drury Lane- Oakbrook" are the same, "Broadway Playhouse" and "Broadway Playhouse at Water Tower Place" are the same).

Pairs:
${pairList}

Return valid JSON: { "verdicts": [{ "pair": 1, "same": true, "confidence": 0.95 }] }`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-v4-flash",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 1024,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
      const data: DeepSeekResponse = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) throw new Error("Empty AI response");

      const parsed = JSON.parse(content);
      const verdicts: Array<{ pair: number; same: boolean; confidence: number }> = parsed.verdicts ?? [];

      for (const v of verdicts) {
        const pair = pairs[v.pair - 1];
        if (!pair) continue;
        const key = `${pair.ourName}|||${pair.ticName}`;
        const matched = v.same && v.confidence > 0.7;
        results.set(key, matched);

        await logMatchDecision(supabase, {
          ourName: pair.ourName,
          ourId: pair.ourId,
          externalName: pair.ticName,
          source: "tic",
          heuristicScore: pair.heuristicScore,
          aiVerdict: v.same,
          aiConfidence: v.confidence,
          finalDecision: matched ? "ai_matched" : "ai_rejected",
        });
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    console.warn("[ai-match] AI venue matching failed, using heuristic only:", e);
  }

  return results;
}

// --- Discovery-specific matching ---

const STRIP_TOKENS = new Set([
  "theater", "theatre", "studio", "school", "center", "centre",
  "chicago", "improv", "comedy", "acting", "the", "a", "an",
]);

export function normalizeForDiscovery(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 0 && !STRIP_TOKENS.has(w))
    .join(" ")
    .trim();
}

function discoveryTokens(name: string): Set<string> {
  const n = normalizeForDiscovery(name);
  return new Set(n.split(" ").filter(w => w.length > 1));
}

export function tokenJaccard(a: string, b: string): number {
  const setA = discoveryTokens(a);
  const setB = discoveryTokens(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function levenshteinRatio(a: string, b: string): number {
  const na = normalizeForDiscovery(a);
  const nb = normalizeForDiscovery(b);
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  const matrix: number[][] = [];
  for (let i = 0; i <= na.length; i++) {
    matrix[i] = [i];
    for (let j = 1; j <= nb.length; j++) {
      if (i === 0) { matrix[0][j] = j; continue; }
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (na[i - 1] === nb[j - 1] ? 0 : 1),
      );
    }
  }
  return 1 - matrix[na.length][nb.length] / maxLen;
}

export interface DiscoveryMatchResult {
  matched: boolean;
  venueId?: string;
  matchedName?: string;
}

export function discoveryMatch(
  candidateName: string,
  existingVenues: Array<{ id: string; name: string; aliases: string[] }>,
): DiscoveryMatchResult {
  for (const venue of existingVenues) {
    const namesToCheck = [venue.name, ...venue.aliases];
    for (const existing of namesToCheck) {
      if (tokenJaccard(candidateName, existing) >= 0.6 ||
          levenshteinRatio(candidateName, existing) >= 0.85) {
        return { matched: true, venueId: venue.id, matchedName: existing };
      }
    }
  }
  return { matched: false };
}
