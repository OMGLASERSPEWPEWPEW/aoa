import type { CandidateLink, EventCompleteness, DeepSeekResponse } from "./types.ts";
import { CostBudget } from "./cost-budget.ts";
import { isRobotsDisallowed } from "./politeness.ts";

function getAiConfig(apiKey?: string): { key: string; url: string; model: string } | null {
  if (apiKey) {
    const isOpenAI = apiKey.startsWith("sk-proj-") || apiKey.startsWith("sk-org-");
    return isOpenAI
      ? { key: apiKey, url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" }
      : { key: apiKey, url: "https://api.deepseek.com/chat/completions", model: "deepseek-chat" };
  }
  const openai = Deno.env.get("OPENAI_API_KEY");
  if (openai) return { key: openai, url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" };
  const deepseek = Deno.env.get("DEEPSEEK_API_KEY");
  if (deepseek) return { key: deepseek, url: "https://api.deepseek.com/chat/completions", model: "deepseek-chat" };
  return null;
}

const EXCLUDED_PATHS = [
  "/about", "/contact", "/donate", "/careers", "/privacy", "/terms",
  "/login", "/cart", "/press", "/accessibility", "/faq", "/board",
  "/staff", "/support", "/membership", "/volunteer",
];

const EXCLUDED_DOMAINS = [
  "facebook.com", "twitter.com", "instagram.com", "youtube.com",
  "tiktok.com", "linkedin.com", "pinterest.com", "x.com",
];

const THEATER_KEYWORDS = [
  "show", "production", "event", "ticket", "performance",
  "season", "play", "musical", "program", "whats-on",
];

const CLASS_KEYWORDS = [
  "class", "classes", "course", "courses", "workshop",
  "level", "beginner", "intermediate", "advanced",
  "enroll", "register", "training", "curriculum", "adult",
  "instructor", "schedule", "program",
];

const ASSET_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".svg", ".ico", ".webp", ".tiff",
  ".css", ".js", ".woff", ".woff2", ".ttf", ".eot", ".inc",
  ".pdf", ".zip", ".exe", ".dmg", ".mp4", ".mp3", ".wav", ".avi", ".flv",
  ".pptx", ".xlsx",
];

const NON_WEB_PROTOCOLS = ["mailto:", "tel:", "telnet:", "ftp:", "ftps:", "ssh:", "file:", "javascript:"];

interface CrawlScope {
  prefix: string;
  exact: string | null;
}

function getCrawlScope(initialUrl: string): CrawlScope {
  let pathname: string;
  try { pathname = new URL(initialUrl).pathname; } catch { return { prefix: "/", exact: null }; }
  if (!pathname.startsWith("/")) pathname = "/" + pathname;
  if (pathname.endsWith("/")) return { prefix: pathname, exact: null };
  const lastSlash = pathname.lastIndexOf("/");
  if (/\.[A-Za-z0-9]{2,}$/.test(pathname.slice(lastSlash + 1))) {
    return { prefix: pathname.slice(0, lastSlash + 1), exact: null };
  }
  return { prefix: pathname + "/", exact: pathname };
}

function isWithinCrawlScope(path: string, scope: CrawlScope): boolean {
  return path === scope.exact || path.startsWith(scope.prefix);
}

function normalizeForDedup(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").split("?")[0].split("#")[0];
}

export function extractCandidateLinks(
  rawHtml: string,
  baseUrl: string,
  eventTitles: string[],
  domain: "theater" | "class" = "theater",
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

  const crawlScope = getCrawlScope(baseUrl);

  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(rawHtml)) !== null) {
    const href = match[1];
    const anchorText = match[2].replace(/<[^>]+>/g, "").trim();
    const lowerHref = href.toLowerCase();
    const lowerText = anchorText.toLowerCase();

    if (!href || href === "#") continue;
    if (NON_WEB_PROTOCOLS.some(p => lowerHref.startsWith(p))) continue;
    if (href.startsWith("#")) continue;

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

    const urlWithoutQuery = fullUrl.split("?")[0].toLowerCase();
    if (ASSET_EXTENSIONS.some(ext => urlWithoutQuery.endsWith(ext))) continue;

    const normalized = normalizeForDedup(fullUrl);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(fullUrl);
    } catch {
      continue;
    }

    if (parsedUrl.origin !== baseOrigin) {
      if (EXCLUDED_DOMAINS.some(d => parsedUrl.origin.includes(d))) continue;
      continue;
    }

    if (EXCLUDED_PATHS.some(p => lowerHref.includes(p))) continue;
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

    const keywords = domain === "class" ? CLASS_KEYWORDS : THEATER_KEYWORDS;
    for (const keyword of keywords) {
      if (lowerHref.includes(keyword) || lowerText.includes(keyword)) { score += 5; }
    }

    if (/202[4-9]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(lowerHref)) {
      score += 3;
    }

    score += 3;

    if (isWithinCrawlScope(parsedUrl.pathname, crawlScope)) score += 3;

    const pathDepth = (parsedUrl.pathname.match(/\//g) || []).length;
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

  const visitedNormalized = new Set([...visitedUrls].map(normalizeForDedup));
  const unvisited = links.filter(l => !visitedNormalized.has(normalizeForDedup(l.url)));

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

export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hostname = u.hostname.replace(/^www\./, "").toLowerCase();
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref)/.test(key)) u.searchParams.delete(key);
    }
    let path = u.pathname.replace(/\/+$/, "") || "/";
    u.pathname = path;
    return u.href;
  } catch {
    return url;
  }
}

export function hardFilterLinks(
  links: Array<{ url: string; anchor: string }>,
  visited: Set<string>,
  scoreCache: Map<string, number>,
  seedOrigin: string,
  allowedExternalHosts: string[],
  robotsDisallow: string[],
  deadEndPatterns: string[],
): Array<{ url: string; anchor: string }> {
  const allowedHosts = new Set(allowedExternalHosts.map((h) => h.toLowerCase()));
  const seedHost = new URL(seedOrigin).hostname.replace(/^www\./, "").toLowerCase();

  return links.filter(({ url }) => {
    const canonical = canonicalizeUrl(url);
    if (visited.has(canonical) || scoreCache.has(canonical)) return false;

    let parsed: URL;
    try { parsed = new URL(url); } catch { return false; }

    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== seedHost && !allowedHosts.has(host)) return false;

    const lower = parsed.pathname.toLowerCase();
    if (ASSET_EXTENSIONS.some((ext) => lower.endsWith(ext))) return false;
    if (isRobotsDisallowed(parsed.pathname, robotsDisallow)) return false;
    if (deadEndPatterns.some((p) => lower.includes(p.toLowerCase()))) return false;

    return true;
  });
}

export async function scoreLinksLLM(
  links: Array<{ url: string; anchor: string }>,
  schoolName: string,
  city: string,
  budget: CostBudget,
  apiKey?: string,
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();

  const ai = getAiConfig(apiKey);
  if (!ai || !budget.canAffordAiCall() || links.length === 0) {
    return scores;
  }

  const batch = links.slice(0, 60).map((l, i) => ({
    i,
    url: l.url,
    anchor: l.anchor.slice(0, 80),
  }));

  const prompt = `We are collecting ADULT class offerings (acting, improv, voice-over, on-camera,
movement, audition, comedy) for the school "${schoolName}" in ${city}.
Score each link 0-100 for how likely it leads to a page with ENROLLABLE ADULT CLASS
DETAILS (dates, times, prices, instructors) or an index of such pages.

100 = class catalog / full schedule index
80-95 = specific adult program or class-detail page, registration page with dates
40-60 = adult class category/landing page (links onward to details)
0-10 = kids/teens/youth/camps, blog, news, faculty bios, testimonials, about,
       policies, donations, rentals, gift certificates, login/account, contact,
       productions, shows, festival pages, season announcements, playbills

Links (JSON): ${JSON.stringify(batch)}

Respond with only a JSON array: [{"i":0,"score":95}, ...]. Every input i exactly once.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(ai.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: "You rank crawler links. Output only JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        max_tokens: 1500,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return scores;

    const data: DeepSeekResponse = await res.json();
    budget.recordAiCall(data.usage.prompt_tokens, data.usage.completion_tokens, ai.model);
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw.replace(/```json\s*/g, "").replace(/```/g, "").trim());

    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        const link = batch[entry.i];
        if (link) scores.set(canonicalizeUrl(link.url), entry.score ?? 0);
      }
    }
  } catch {
    console.warn("[link-extractor] LLM scoring failed, using keyword fallback");
  }

  return scores;
}
