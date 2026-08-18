import type { VenueTarget } from "./types.ts";

export type UrlRecoveryResult =
  | { status: "resolved"; url: string; html: string; strategy: string }
  | { status: "recovery_exhausted" };

interface RecoveryAttempt {
  url: string;
  strategy: string;
  httpStatus: number | null;
  contentLength: number;
  eventsFound: number;
}

const COMMON_PATHS = [
  "/classes", "/schedule", "/training", "/events", "/shows",
  "/workshops", "/adult-classes", "/courses", "/programs",
  "/calendar", "/whats-on", "/education",
];

const FETCH_TIMEOUT = 10_000;

async function probeFetch(url: string): Promise<{ ok: boolean; status: number; html: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ArtOfArt-EventBot/1.0; +https://aoa-nine.vercel.app)" },
      signal: controller.signal,
      redirect: "follow",
    });
    const html = await res.text();
    return { ok: res.ok, status: res.status, html };
  } catch {
    return { ok: false, status: 0, html: "" };
  } finally {
    clearTimeout(timeout);
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function searchPerplexity(venueName: string, domain: string): Promise<string[]> {
  const key = Deno.env.get("PERPLEXITY_API_KEY");
  if (!key) return [];

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "user",
            content: `Find the classes or schedule page URL for "${venueName}". Only return URLs from the domain ${domain}. Return only the URL, nothing else.`,
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.warn(`[url-resolver] Perplexity returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const urls: string[] = [];
    const matches = text.matchAll(/https?:\/\/[^\s"'<>)]+/g);
    for (const m of matches) {
      const candidateDomain = extractDomain(m[0]);
      if (candidateDomain && domain.includes(candidateDomain) || candidateDomain.includes(domain.replace(/^www\./, ""))) {
        urls.push(m[0]);
      }
    }
    return urls;
  } catch (err) {
    console.warn("[url-resolver] Perplexity search failed:", err);
    return [];
  }
}

async function searchSerpApi(venueName: string, domain: string): Promise<string[]> {
  const key = Deno.env.get("SERPAPI_KEY");
  if (!key) return [];

  try {
    const params = new URLSearchParams({
      q: `site:${domain} classes schedule events register enroll`,
      location: "Chicago, Illinois, United States",
      hl: "en",
      gl: "us",
      num: "5",
      api_key: key,
      engine: "google",
    });

    const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!res.ok) return [];

    const data = await res.json();
    const results = data.organic_results ?? [];
    return results
      .map((r: { link?: string }) => r.link)
      .filter((link: string | undefined): link is string => {
        if (!link) return false;
        const linkDomain = extractDomain(link);
        return linkDomain.includes(domain.replace(/^www\./, ""));
      });
  } catch (err) {
    console.warn("[url-resolver] SerpAPI search failed:", err);
    return [];
  }
}

export async function resolveVenueUrl(
  venue: Pick<VenueTarget, "calendar_url" | "website_url" | "name">,
  cleanAndCheck: (html: string) => number,
): Promise<UrlRecoveryResult & { attempts: RecoveryAttempt[] }> {
  const attempts: RecoveryAttempt[] = [];
  const tried = new Set<string>();
  const domain = extractDomain(venue.calendar_url || venue.website_url || "");

  async function tryCandidate(url: string, strategy: string): Promise<UrlRecoveryResult | null> {
    const normalized = url.replace(/\/$/, "");
    if (tried.has(normalized)) return null;
    tried.add(normalized);

    const probe = await probeFetch(url);
    const contentLen = probe.html.length;
    const cleanedLen = probe.ok ? cleanAndCheck(probe.html) : 0;

    attempts.push({ url, strategy, httpStatus: probe.ok ? probe.status : null, contentLength: contentLen, eventsFound: cleanedLen >= 300 ? -1 : 0 });

    if (probe.ok && cleanedLen >= 300) {
      return { status: "resolved", url, html: probe.html, strategy };
    }
    return null;
  }

  // Strategy 1: website_url
  if (venue.website_url && venue.website_url !== venue.calendar_url) {
    console.log(`[url-resolver] ${venue.name}: trying website_url ${venue.website_url}`);
    const result = await tryCandidate(venue.website_url, "website_url");
    if (result) return { ...result, attempts };
  }

  // Strategy 2: common paths
  if (domain) {
    const base = `https://${domain.startsWith("www.") ? domain : `www.${domain}`}`;
    for (const path of COMMON_PATHS) {
      const candidateUrl = `${base}${path}`;
      console.log(`[url-resolver] ${venue.name}: trying common path ${candidateUrl}`);
      const result = await tryCandidate(candidateUrl, "common_path");
      if (result) return { ...result, attempts };
    }
  }

  // Strategy 3: Perplexity
  console.log(`[url-resolver] ${venue.name}: trying Perplexity search`);
  const perplexityUrls = await searchPerplexity(venue.name, domain);
  for (const pUrl of perplexityUrls) {
    console.log(`[url-resolver] ${venue.name}: Perplexity returned ${pUrl}`);
    const result = await tryCandidate(pUrl, "perplexity");
    if (result) return { ...result, attempts };
  }

  // Strategy 4: SerpAPI
  console.log(`[url-resolver] ${venue.name}: trying SerpAPI search`);
  const serpUrls = await searchSerpApi(venue.name, domain);
  for (const sUrl of serpUrls) {
    console.log(`[url-resolver] ${venue.name}: SerpAPI returned ${sUrl}`);
    const result = await tryCandidate(sUrl, "serpapi");
    if (result) return { ...result, attempts };
  }

  console.warn(`[url-resolver] ${venue.name}: all recovery strategies exhausted`);
  return { status: "recovery_exhausted", attempts };
}
