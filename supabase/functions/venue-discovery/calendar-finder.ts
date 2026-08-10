const CALENDAR_KEYWORDS = [
  "calendar", "tickets", "shows", "season", "events",
  "productions", "whats-on", "what-s-on", "schedule",
  "upcoming", "now-playing", "current-season",
];

export function findCalendarUrl(html: string, baseUrl: string): string | null {
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const candidates: Array<{ url: string; score: number }> = [];
  const baseOrigin = new URL(baseUrl).origin;

  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, "").toLowerCase().trim();
    const lowerHref = href.toLowerCase();

    let score = 0;

    for (const keyword of CALENDAR_KEYWORDS) {
      if (lowerHref.includes(keyword)) score += 3;
      if (text.includes(keyword)) score += 2;
    }

    if (score === 0) continue;

    // Prefer internal links
    if (href.startsWith("/") || href.startsWith(baseOrigin)) score += 2;

    // Prefer shorter paths
    const pathDepth = (href.match(/\//g) || []).length;
    score -= pathDepth * 0.5;

    let fullUrl = href;
    if (href.startsWith("/")) {
      fullUrl = baseOrigin + href;
    }

    if (fullUrl.startsWith("http")) {
      candidates.push({ url: fullUrl, score });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url;
}
