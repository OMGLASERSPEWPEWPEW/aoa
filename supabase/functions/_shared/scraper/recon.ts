import type { DeepSeekResponse } from "./types.ts";
import { CostBudget } from "./cost-budget.ts";
import { AOA_UA, parseRobotsTxt, enforceRateLimit, extractRegistrableDomain } from "./politeness.ts";

function getAiConfig(): { key: string; url: string; model: string } | null {
  const openai = Deno.env.get("OPENAI_API_KEY");
  if (openai) return { key: openai, url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" };
  const deepseek = Deno.env.get("DEEPSEEK_API_KEY");
  if (deepseek) return { key: deepseek, url: "https://api.deepseek.com/chat/completions", model: "deepseek-chat" };
  return null;
}

export interface ReconResult {
  identity: "match" | "mismatch" | "uncertain";
  identityConfidence: number;
  platform: string | null;
  platformConfidence: number;
  renderNeededPrior: boolean;
  catalogUrls: string[];
  sitemapUrls: string[];
  allowedExternalHosts: string[];
  robotsDisallow: string[];
  fetchesUsed: number;
}

const PLATFORM_SIGNATURES: Array<{
  platform: string;
  signals: RegExp[];
  renderNeeded: boolean;
}> = [
  { platform: "wordpress", signals: [/\/wp-content\//i, /wp-json/i, /generator.*wordpress/i], renderNeeded: false },
  { platform: "squarespace", signals: [/static1\.squarespace\.com/i, /generator.*squarespace/i], renderNeeded: false },
  { platform: "wix", signals: [/wixstatic\.com/i, /wix\.com/i], renderNeeded: true },
  { platform: "mindbody", signals: [/mindbodyonline\.com/i, /mindbody/i], renderNeeded: true },
  { platform: "sawyer", signals: [/hisawyer\.com/i], renderNeeded: false },
  { platform: "coursestorm", signals: [/coursestorm\.com/i], renderNeeded: false },
  { platform: "eventbrite", signals: [/eventbrite\.com\/[oe]\//i], renderNeeded: false },
];

const CATALOG_PATH_RE = /\/(class-catalog|all-classes|classes\/?$|schedule|calendar|catalog|course-catalog|adult-acting-classes|programs)/i;
const REGISTER_ANCHOR_RE = /(register|enroll|sign\s*up|book now|class catalog)/i;

function fingerprint(rawHtml: string): { platform: string | null; confidence: number; renderNeeded: boolean } {
  for (const sig of PLATFORM_SIGNATURES) {
    const hits = sig.signals.filter((re) => re.test(rawHtml)).length;
    if (hits > 0) {
      return { platform: sig.platform, confidence: Math.min(hits / sig.signals.length, 1), renderNeeded: sig.renderNeeded };
    }
  }
  return { platform: "custom", confidence: 0, renderNeeded: false };
}

function discoverCatalogs(cleaned: string, seedUrl: string): string[] {
  const origin = new URL(seedUrl).origin;
  const urls: string[] = [];
  const linkRe = /\[([^\]]*)\]\(([^)]+)\)/g;
  let m;
  while ((m = linkRe.exec(cleaned)) !== null) {
    const href = m[2];
    try {
      const full = new URL(href, origin).href;
      if (CATALOG_PATH_RE.test(new URL(full).pathname)) {
        urls.push(full);
      }
    } catch { /* invalid URL */ }
  }
  return [...new Set(urls)];
}

function discoverExternalHosts(cleaned: string, rawHtml: string, seedDomain: string): string[] {
  const hosts = new Set<string>();
  const linkRe = /\[([^\]]*)\]\(([^)]+)\)/g;
  let m;
  while ((m = linkRe.exec(cleaned)) !== null) {
    const anchor = m[1];
    const href = m[2];
    if (!REGISTER_ANCHOR_RE.test(anchor)) continue;
    try {
      const host = new URL(href).hostname.replace(/^www\./, "").toLowerCase();
      if (host !== seedDomain) {
        for (const sig of PLATFORM_SIGNATURES) {
          if (sig.signals.some((re) => re.test(host))) {
            hosts.add(host);
          }
        }
      }
    } catch { /* invalid */ }
  }
  return [...hosts];
}

export async function runRecon(
  venue: { name: string; city: string },
  seedUrl: string,
  seedRawHtml: string,
  seedCleaned: string,
  budget: CostBudget,
): Promise<ReconResult> {
  let fetchesUsed = 0;
  const seedDomain = extractRegistrableDomain(seedUrl);
  const result: ReconResult = {
    identity: "uncertain", identityConfidence: 0,
    platform: null, platformConfidence: 0, renderNeededPrior: false,
    catalogUrls: [], sitemapUrls: [], allowedExternalHosts: [],
    robotsDisallow: [], fetchesUsed: 0,
  };

  const fp = fingerprint(seedRawHtml);
  result.platform = fp.platform;
  result.platformConfidence = fp.confidence;
  result.renderNeededPrior = fp.renderNeeded;

  result.catalogUrls = discoverCatalogs(seedCleaned, seedUrl);
  result.allowedExternalHosts = discoverExternalHosts(seedCleaned, seedRawHtml, seedDomain);

  const ai = getAiConfig();
  if (ai && budget.canAffordAiCall()) {
    const title = (seedRawHtml.match(/<title[^>]*>([^<]+)<\/title>/i) ?? [])[1] ?? "";
    const snippet = seedCleaned.slice(0, 1200);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch(ai.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ai.model,
          messages: [
            { role: "system", content: "You verify whether a web page belongs to a specific organization. Answer only in JSON." },
            {
              role: "user",
              content: `Organization: "${venue.name}" — a class-offering arts school in ${venue.city}.
URL fetched: ${seedUrl}
Page title and first 1200 characters of page text:
---
${title}
${snippet}
---
Is this page the official website of that organization (or a page on it)?
A city guide, neighborhood directory, review site, or news article ABOUT the organization is a MISMATCH.
Respond with only: {"identity":"match"|"mismatch"|"uncertain","confidence":0.0-1.0,"reason":"<10 words"}`,
            },
          ],
          temperature: 0,
          max_tokens: 200,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data: DeepSeekResponse = await res.json();
        budget.recordAiCall(data.usage.prompt_tokens, data.usage.completion_tokens, ai.model);
        const raw = data.choices?.[0]?.message?.content ?? "";
        const parsed = JSON.parse(raw.replace(/```json\s*/g, "").replace(/```/g, "").trim());
        result.identity = parsed.identity ?? "uncertain";
        result.identityConfidence = parsed.confidence ?? 0;
      }
    } catch { /* identity check failed — proceed as uncertain */ }
  }

  const origin = new URL(seedUrl).origin;
  try {
    await enforceRateLimit(seedDomain);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const robotsRes = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": AOA_UA },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    fetchesUsed++;
    budget.recordFetch();
    if (robotsRes.ok) {
      const text = await robotsRes.text();
      result.robotsDisallow = parseRobotsTxt(text);
    }
  } catch { /* no robots.txt */ }

  try {
    await enforceRateLimit(seedDomain);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const sitemapRes = await fetch(`${origin}/sitemap.xml`, {
      headers: { "User-Agent": AOA_UA },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    fetchesUsed++;
    budget.recordFetch();
    if (sitemapRes.ok) {
      const xml = await sitemapRes.text();
      const locRe = /<loc>([^<]+)<\/loc>/g;
      let locMatch;
      const classRe = /(class|catalog|schedule|calendar|course|workshop|program|training|education)/i;
      while ((locMatch = locRe.exec(xml)) !== null && result.sitemapUrls.length < 40) {
        if (classRe.test(locMatch[1])) result.sitemapUrls.push(locMatch[1]);
      }
    }
  } catch { /* no sitemap */ }

  result.fetchesUsed = fetchesUsed;
  return result;
}
