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

  return wordOverlap(wordSet(normA), wordSet(normB));
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
