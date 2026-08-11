import type { CandidateLink, EventCompleteness } from "./types.ts";

const EXCLUDED_PATHS = [
  "/about", "/contact", "/donate", "/careers", "/privacy", "/terms",
  "/login", "/cart", "/press", "/accessibility", "/faq", "/board",
  "/staff", "/support", "/membership", "/education", "/volunteer",
];

const EXCLUDED_DOMAINS = [
  "facebook.com", "twitter.com", "instagram.com", "youtube.com",
  "tiktok.com", "linkedin.com", "pinterest.com", "x.com",
];

const SHOW_KEYWORDS = [
  "show", "production", "event", "ticket", "performance",
  "season", "play", "musical", "program", "whats-on",
];

const ASSET_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".svg", ".pdf", ".css", ".js", ".ico"];

export function extractCandidateLinks(
  rawHtml: string,
  baseUrl: string,
  eventTitles: string[],
): CandidateLink[] {
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const candidates: CandidateLink[] = [];
  const seen = new Set<string>();

  let baseOrigin: string;
  try {
    baseOrigin = new URL(baseUrl).origin;
  } catch {
    return [];
  }

  const lowerTitles = eventTitles.map(t => t.toLowerCase());

  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(rawHtml)) !== null) {
    const href = match[1];
    const anchorText = match[2].replace(/<[^>]+>/g, "").trim();
    const lowerHref = href.toLowerCase();
    const lowerText = anchorText.toLowerCase();

    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;

    let fullUrl: string;
    try {
      if (href.startsWith("http")) {
        fullUrl = href;
      } else if (href.startsWith("//")) {
        fullUrl = "https:" + href;
      } else if (href.startsWith("/")) {
        fullUrl = baseOrigin + href;
      } else {
        fullUrl = new URL(href, baseUrl).href;
      }
    } catch {
      continue;
    }

    const normalized = fullUrl.split("?")[0].split("#")[0].replace(/\/$/, "");
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    let urlOrigin: string;
    try {
      urlOrigin = new URL(fullUrl).origin;
    } catch {
      continue;
    }

    if (urlOrigin !== baseOrigin) {
      if (EXCLUDED_DOMAINS.some(d => urlOrigin.includes(d))) continue;
      continue;
    }

    if (EXCLUDED_PATHS.some(p => lowerHref.includes(p))) continue;
    if (ASSET_EXTENSIONS.some(ext => lowerHref.endsWith(ext))) continue;
    if (!anchorText || anchorText.length < 2) continue;

    let score = 0;
    const matchedEventTitles: string[] = [];

    for (let i = 0; i < lowerTitles.length; i++) {
      const title = lowerTitles[i];
      if (title.length >= 4 && (lowerText.includes(title) || lowerHref.includes(title.replace(/\s+/g, "-")))) {
        score += 10;
        matchedEventTitles.push(eventTitles[i]);
      }
    }

    for (const keyword of SHOW_KEYWORDS) {
      if (lowerHref.includes(keyword)) { score += 5; break; }
    }

    if (/202[4-9]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(lowerHref)) {
      score += 3;
    }

    score += 3;

    const pathDepth = (new URL(fullUrl).pathname.match(/\//g) || []).length;
    if (pathDepth > 4) score -= (pathDepth - 4);

    if (score > 0) {
      candidates.push({ url: fullUrl, anchorText, score, matchedEventTitles });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

export function prioritizeLinks(
  links: CandidateLink[],
  incompleteEvents: EventCompleteness[],
  visitedUrls: Set<string>,
  maxLinks: number,
): CandidateLink[] {
  const incompleteTitles = new Set(incompleteEvents.map(e => e.title.toLowerCase()));

  const unvisited = links.filter(l => !visitedUrls.has(l.url.split("?")[0].split("#")[0].replace(/\/$/, "")));

  const boosted = unvisited.map(link => {
    let boost = 0;
    for (const mt of link.matchedEventTitles) {
      if (incompleteTitles.has(mt.toLowerCase())) boost += 5;
    }
    return { ...link, score: link.score + boost };
  });

  boosted.sort((a, b) => b.score - a.score);
  return boosted.slice(0, maxLinks);
}
