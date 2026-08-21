import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { resolveCoordinates, geocodeBusinessByName, isBadCoordinate, isPlausibleStreetAddress, isOutsideMetro } from "../_shared/geocoder.ts";
import { repairJson } from "../_shared/scraper/json-repair.ts";
import { discoveryMatch } from "../_shared/scraper/venue-name-matcher.ts";

const SCRAPER_SECRET = Deno.env.get("SCRAPER_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY") ?? null;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ALLOWED_ORIGINS = [
  "http://localhost:5204",
  "https://aoa-nine.vercel.app",
];

const AGGREGATOR_DOMAINS = new Set([
  "yelp.com", "classpass.com", "coursehorse.com", "facebook.com",
  "eventbrite.com", "goldstar.com", "groupon.com", "timeout.com",
  "choosechicago.com", "dochub.com", "meetup.com", "thumbtack.com",
  "bark.com", "lessons.com", "takelessons.com",
  "loopchicago.com", "backstage.com", "chicagoreader.com",
  "tripadvisor.com", "wikipedia.org", "instagram.com", "linkedin.com",
  "tiktok.com", "youtube.com", "x.com", "twitter.com", "patch.com",
  "nextdoor.com", "google.com", "maps.google.com", "reddit.com",
]);

const JSON_INSTRUCTION = `\n\nReturn your answer as a JSON array. Each element must have exactly these fields:\n{"name": "School Name", "address": "Full Street Address, City, State", "url": "https://..."}\n\nDo not include any text outside the JSON array. No markdown, no explanations.`;

const NORTH_SLICE = " Focus on the North Side: Andersonville, Uptown, Lakeview, Lincoln Square, Rogers Park, Edgewater.";
const SOUTH_WEST_SLICE = " Focus on the West and South Sides: Logan Square, Wicker Park, Pilsen, Hyde Park, Bridgeport.";

const BASE_PROMPTS = [
  "List every improv and comedy training center in Chicago that offers adult classes. Include smaller studios, not just Second City and iO.",
  "List every acting studio in Chicago that offers adult classes in Meisner, scene study, on-camera, voiceover, or audition technique. Include independent studios and conservatories, not just university programs.",
  "List every musical theater performance training program, physical theater, sketch comedy, and comedy writing program in Chicago that offers adult classes or workshops. Exclude music conservatories, instrumental music schools, classical music programs, dance-only studios, and orchestral training.",
];

const DISCOVERY_PROMPTS = [
  ...BASE_PROMPTS.map(p => p + JSON_INSTRUCTION),
  ...BASE_PROMPTS.map(p => p + NORTH_SLICE + JSON_INSTRUCTION),
  ...BASE_PROMPTS.map(p => p + SOUTH_WEST_SLICE + JSON_INSTRUCTION),
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-scraper-key",
    "Vary": "Origin",
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

function isAggregatorDomain(domain: string): boolean {
  return [...AGGREGATOR_DOMAINS].some(agg => domain === agg || domain.endsWith(`.${agg}`));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildAddressRegex(city = "Chicago"): RegExp {
  const cityAnchor = escapeRegExp(city);
  return new RegExp(
    String.raw`(\d{1,5}\s+[NSEW]?\.?\s*[A-Za-z][\w.'\-]*(?:\s+[\w.'\-]+){0,3}` +
    String.raw`(?:\s+(?:Ave(?:nue)?|St(?:reet)?|Blvd|Boulevard|Rd|Road|Dr(?:ive)?|Way|` +
    String.raw`Ln|Lane|Pl(?:ace)?|Ct|Court|Pkwy|Parkway|Ter(?:race)?|Cir(?:cle)?|` +
    String.raw`Hwy|Highway))?\.?` +
    String.raw`(?:\s*,?\s*(?:Suite|Ste\.?|Unit|#|Fl(?:oor)?)\s*[\w\-]+)?)` +
    String.raw`\s*,?\s*` + cityAnchor,
    "i",
  );
}

function extractSchoolNameFallback(text: string, urlIndex: number, domain: string): string {
  const window = text.substring(Math.max(0, urlIndex - 250), urlIndex);
  const bold = window.match(/\*\*([^*]{3,60})\*\*[^*]*$/);
  if (bold) return bold[1].trim();
  const numbered = window.match(/\d+\.\s+\*?\*?([A-Z][A-Za-z0-9\s&'''.,\-/]+?)\*?\*?\s*[-–—:(]\s*[^]*$/);
  if (numbered) return numbered[1].trim();
  const base = domain.replace(/\.(com|org|net|edu|co|io)$/i, "");
  return base.split(/[-.]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function extractAddressNearUrlFallback(text: string, urlIndex: number, city = "Chicago"): string | null {
  const window = text.substring(Math.max(0, urlIndex - 400), Math.min(text.length, urlIndex + 200));
  const m = window.match(buildAddressRegex(city));
  return m ? `${m[1].trim()}, ${city}, IL` : null;
}

interface PerplexitySchool {
  name: string;
  address: string;
  url: string;
}

interface DiscoveryResult {
  query: string; link: string; title: string; snippet: string; domain: string; address: string | null;
}

async function logDiscoveryResult(entry: {
  run_id: string; query: string; raw_url: string; raw_title: string;
  domain: string; disposition: string; reason?: string;
}): Promise<void> {
  try { await supabase.from("discovery_logs").insert(entry); }
  catch { console.warn("[school-discovery] Failed to write discovery_log entry for", entry.raw_url); }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      headers: { "User-Agent": "AOA-ClassFinder/1.0" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function extractAddressFromSite(
  websiteUrl: string,
  city: string,
): Promise<string | null> {
  const addrRegex = buildAddressRegex(city);
  const candidates = [websiteUrl];
  try {
    const origin = new URL(websiteUrl).origin;
    candidates.push(`${origin}/contact`, `${origin}/contact-us`);
  } catch {
    /* keep just websiteUrl */
  }

  for (const url of candidates) {
    const html = await fetchPage(url);
    if (!html) continue;
    const m = htmlToText(html).match(addrRegex);
    if (m) return `${m[1].trim()}, ${city}, IL`;
  }
  return null;
}

async function perplexityFindAddress(
  name: string,
  city: string,
): Promise<string | null> {
  if (!PERPLEXITY_API_KEY) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "user",
            content:
              `What is the current street address of "${name}", an arts/acting school in ${city}, Illinois? ` +
              `Respond with ONLY a JSON object, no prose: ` +
              `{"street_address": "<number street, unit if any>", "confidence": "high"|"medium"|"low"} ` +
              `If you cannot find it, respond {"street_address": null, "confidence": "low"}.`,
          },
        ],
        max_tokens: 200,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = repairJson(
      data.choices?.[0]?.message?.content ?? "",
    ) as { street_address?: unknown } | null;
    const addr = parsed?.street_address;
    if (typeof addr !== "string" || addr.length < 6) return null;

    if (!/^\d{1,6}\s+\S/.test(addr.trim())) return null;
    const withCity = new RegExp(`\\b${city}\\b`, "i").test(addr)
      ? addr.trim()
      : `${addr.trim()}, ${city}, IL`;
    return withCity;
  } catch {
    return null;
  } finally {
    await delay(1100);
  }
}

async function geocodeSchool(
  name: string,
  websiteUrl: string,
  knownAddress?: string | null,
  city = "Chicago",
): Promise<{ lat: number; lng: number; address: string | null; source: string }> {
  // 1) Address we already hold (crawl-extracted or discovery-provided)
  if (knownAddress && isPlausibleStreetAddress(knownAddress)) {
    const geo = await resolveCoordinates(knownAddress, city);
    if (geo)
      return {
        lat: geo.lat,
        lng: geo.lng,
        address: knownAddress,
        source: `known_address:${geo.provider}`,
      };
  }

  // 2) The school's own website (tag-stripped footer/contact regex)
  const siteAddr = websiteUrl
    ? await extractAddressFromSite(websiteUrl, city)
    : null;
  if (siteAddr) {
    const geo = await resolveCoordinates(siteAddr, city);
    if (geo)
      return {
        lat: geo.lat,
        lng: geo.lng,
        address: siteAddr,
        source: `website:${geo.provider}`,
      };
  }

  // 3) Perplexity web-search for the address (validated by geocoding + guard)
  const pplxAddr = await perplexityFindAddress(name, city);
  if (pplxAddr) {
    const geo = await resolveCoordinates(pplxAddr, city);
    if (geo)
      return {
        lat: geo.lat,
        lng: geo.lng,
        address: pplxAddr,
        source: `perplexity:${geo.provider}`,
      };
  }

  // 4) Business-name search: Google Places if keyed, else Mapbox POI. NEVER Nominatim-by-name.
  const biz = await geocodeBusinessByName(name, city);
  if (biz)
    return {
      lat: biz.lat,
      lng: biz.lng,
      address: biz.address,
      source: biz.provider,
    };

  // 5) Honest failure — MapView's filter hides default-coordinate schools by design.
  return { lat: 41.8781, lng: -87.6298, address: null, source: "default" };
}

function parseStructuredResponse(text: string, query: string, seenDomains: Set<string>): DiscoveryResult[] {
  const parsed = repairJson(text);
  if (!Array.isArray(parsed)) return [];

  const results: DiscoveryResult[] = [];
  for (const item of parsed as PerplexitySchool[]) {
    if (!item.url || !item.name) continue;
    const link = item.url.replace(/[.,;:!?)]+$/, "");
    const domain = extractDomain(link);
    if (!domain || seenDomains.has(domain)) continue;
    seenDomains.add(domain);
    results.push({
      query: query.slice(0, 60),
      link,
      title: item.name.trim(),
      snippet: `${item.name} — ${item.address ?? ""}`.trim(),
      domain,
      address: item.address?.includes("Chicago") ? item.address : item.address ? `${item.address}, Chicago, IL` : null,
    });
  }
  return results;
}

function parseRegexFallback(text: string, query: string, seenDomains: Set<string>): DiscoveryResult[] {
  const results: DiscoveryResult[] = [];
  const urlMatches = text.matchAll(/https?:\/\/[^\s"'<>)\[\]]+/g);
  for (const m of urlMatches) {
    const link = m[0].replace(/[.,;:!?)]+$/, "").replace(/\[\d*$/, "");
    const domain = extractDomain(link);
    if (!domain || seenDomains.has(domain)) continue;
    seenDomains.add(domain);
    results.push({
      query: query.slice(0, 60),
      link,
      title: extractSchoolNameFallback(text, m.index!, domain),
      snippet: text.substring(Math.max(0, m.index! - 50), Math.min(text.length, m.index! + link.length + 80)).trim(),
      domain,
      address: extractAddressNearUrlFallback(text, m.index!),
    });
  }
  return results;
}

async function searchForSchools(): Promise<{ results: DiscoveryResult[]; queriesRun: number }> {
  if (!PERPLEXITY_API_KEY) return { results: [], queriesRun: 0 };
  const allResults: DiscoveryResult[] = [];
  const seenDomains = new Set<string>();
  let queriesRun = 0;

  for (const prompt of DISCOVERY_PROMPTS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      let res: Response;
      try {
        res = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: prompt }], max_tokens: 4000 }),
          signal: controller.signal,
        });
      } finally { clearTimeout(timeout); }

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`[school-discovery] Perplexity ${res.status}: ${errBody.slice(0, 200)}`);
        await logDiscoveryResult({ run_id: "api-error", query: prompt.slice(0, 60), raw_url: "https://api.perplexity.ai", raw_title: `Perplexity API error ${res.status}`, domain: "perplexity.ai", disposition: "insert_error", reason: `HTTP ${res.status}: ${errBody.slice(0, 200)}` });
        continue;
      }
      queriesRun++;
      const data = await res.json();
      const text: string = data.choices?.[0]?.message?.content ?? "";

      const structured = parseStructuredResponse(text, prompt, seenDomains);
      if (structured.length > 0) {
        console.log(`[school-discovery] Parsed ${structured.length} schools from structured JSON`);
        allResults.push(...structured);
      } else {
        console.warn(`[school-discovery] Structured JSON parse failed, falling back to regex`);
        await logDiscoveryResult({ run_id: "json-fallback", query: prompt.slice(0, 60), raw_url: "perplexity-response", raw_title: "JSON parse failed — using regex fallback", domain: "perplexity.ai", disposition: "json_parse_failed", reason: text.slice(0, 500) });
        const fallback = parseRegexFallback(text, prompt, seenDomains);
        allResults.push(...fallback);
      }

      await delay(500);
    } catch (err) { console.warn(`[school-discovery] Perplexity search failed:`, err); }
  }
  return { results: allResults, queriesRun };
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

async function resolveUniqueSlug(baseSlug: string): Promise<string> {
  const { data } = await supabase.from("venues").select("slug").eq("slug", baseSlug).maybeSingle();
  if (!data) return baseSlug;
  for (let i = 2; i <= 10; i++) {
    const candidate = `${baseSlug}-${i}`;
    const { data: dup } = await supabase.from("venues").select("slug").eq("slug", candidate).maybeSingle();
    if (!dup) return candidate;
  }
  return `${baseSlug}-${Date.now()}`;
}

interface ReconciliationReport {
  inserted: Array<{ name: string; url: string }>;
  alias_matched: Array<{ name: string; matched_to: string }>;
  rejected: Array<{ name: string; reason: string }>;
  already_known: number;
  previously_rejected: number;
  blocked: number;
}

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? null;

async function identityCheck(
  name: string, url: string, pageText: string, city: string,
): Promise<{ identity: "match" | "mismatch" | "uncertain"; confidence: number; reason: string }> {
  const apiKey = DEEPSEEK_API_KEY;
  if (!apiKey) return { identity: "uncertain", confidence: 0.5, reason: "no API key" };

  const prompt = `Is this page the official website of "${name}", an organization offering in-person adult classes in ${city}? Answer mismatch if: the page is an article, directory, or city guide ABOUT such organizations; the organization is based in a different city; or "${name}" appears to be a person rather than an organization.\n\nPage text (first 2000 chars):\n${pageText.slice(0, 2000)}\n\nRespond only: {"identity":"match"|"mismatch"|"uncertain","confidence":0-1,"reason":"<10 words"}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { identity: "uncertain", confidence: 0.5, reason: `API ${res.status}` };
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = repairJson(raw) as { identity?: string; confidence?: number; reason?: string } | null;
    return {
      identity: (parsed?.identity === "match" || parsed?.identity === "mismatch") ? parsed.identity : "uncertain",
      confidence: typeof parsed?.confidence === "number" ? parsed.confidence : 0.5,
      reason: typeof parsed?.reason === "string" ? parsed.reason : "parse error",
    };
  } catch {
    return { identity: "uncertain", confidence: 0.5, reason: "fetch failed" };
  }
}

async function reconcileAndInsert(results: DiscoveryResult[], runId: string): Promise<ReconciliationReport> {
  const report: ReconciliationReport = {
    inserted: [], alias_matched: [], rejected: [], already_known: 0, previously_rejected: 0, blocked: 0,
  };

  // Load registry state
  const { data: rejections } = await supabase.from("discovery_rejections").select("domain, url");
  const rejectedDomains = new Set((rejections ?? []).filter(r => r.domain).map(r => r.domain!));
  const rejectedUrls = new Set((rejections ?? []).filter(r => r.url).map(r => r.url!));

  const { data: existingVenues } = await supabase.from("venues").select("id, name, website_url, calendar_url, aliases, status");
  const existingDomains = new Set<string>();
  for (const v of existingVenues ?? []) {
    if (v.website_url) existingDomains.add(extractDomain(v.website_url));
    if (v.calendar_url) existingDomains.add(extractDomain(v.calendar_url));
  }
  const venueRegistry = (existingVenues ?? []).map(v => ({
    id: v.id as string,
    name: v.name as string,
    aliases: (Array.isArray(v.aliases) ? v.aliases : []) as string[],
    status: v.status as string,
  }));

  for (const result of results) {
    // Step 1: REJECTION MEMORY
    if (rejectedDomains.has(result.domain) || rejectedUrls.has(result.link)) {
      report.previously_rejected++;
      await logDiscoveryResult({ run_id: runId, query: result.query, raw_url: result.link, raw_title: result.title, domain: result.domain, disposition: "previously_rejected", reason: "Domain/URL in rejection memory" });
      continue;
    }

    // Step 2: AGGREGATOR LIST
    if (isAggregatorDomain(result.domain)) {
      report.blocked++;
      await supabase.from("discovery_rejections").insert({ domain: result.domain, school_name: result.title, reason: "aggregator" });
      rejectedDomains.add(result.domain);
      await logDiscoveryResult({ run_id: runId, query: result.query, raw_url: result.link, raw_title: result.title, domain: result.domain, disposition: "blocked_aggregator", reason: "Domain matched aggregator blocklist" });
      continue;
    }

    // Step 3: DOMAIN MATCH
    if (existingDomains.has(result.domain)) {
      report.already_known++;
      await logDiscoveryResult({ run_id: runId, query: result.query, raw_url: result.link, raw_title: result.title, domain: result.domain, disposition: "already_known_venue", reason: "Domain matches existing venue" });
      continue;
    }

    // Step 4: NAME MATCH
    const nameMatch = discoveryMatch(result.title, venueRegistry);
    if (nameMatch.matched && nameMatch.venueId) {
      const matchedVenue = venueRegistry.find(v => v.id === nameMatch.venueId)!;

      // Append alias if new
      const currentAliases = matchedVenue.aliases;
      if (!currentAliases.includes(result.title) && matchedVenue.name !== result.title) {
        const updatedAliases = [...currentAliases, result.title];
        await supabase.from("venues").update({ aliases: updatedAliases }).eq("id", matchedVenue.id);
        matchedVenue.aliases = updatedAliases;
      }

      if (matchedVenue.status === "active") {
        report.alias_matched.push({ name: result.title, matched_to: matchedVenue.name });
        await logDiscoveryResult({ run_id: runId, query: result.query, raw_url: result.link, raw_title: result.title, domain: result.domain, disposition: "alias_matched", reason: `Matched to ${matchedVenue.name}` });
        continue;
      }

      // Rejected/dead venue — candidate URL is a replacement; run gate on it
      // (falls through to step 5 below, but on pass updates existing row instead of inserting)
    }

    // Step 5: VALIDATION GATE
    const pageHtml = await fetchPage(result.link);
    if (!pageHtml) {
      await supabase.from("discovery_rejections").insert({ domain: result.domain, url: result.link, school_name: result.title, reason: "dead_url" });
      rejectedDomains.add(result.domain);
      report.rejected.push({ name: result.title, reason: "dead_url" });
      await logDiscoveryResult({ run_id: runId, query: result.query, raw_url: result.link, raw_title: result.title, domain: result.domain, disposition: "rejected", reason: "URL returned no content (dead/403)" });
      continue;
    }

    const pageText = htmlToText(pageHtml);
    const check = await identityCheck(result.title, result.link, pageText, "Chicago");

    if (check.identity === "mismatch" && check.confidence >= 0.7) {
      const reason = check.reason.includes("person") ? "not_an_organization"
        : check.reason.includes("city") || check.reason.includes("different") ? "out_of_city"
        : "identity_mismatch";
      await supabase.from("discovery_rejections").insert({ domain: result.domain, url: result.link, school_name: result.title, reason });
      rejectedDomains.add(result.domain);
      report.rejected.push({ name: result.title, reason });
      await logDiscoveryResult({ run_id: runId, query: result.query, raw_url: result.link, raw_title: result.title, domain: result.domain, disposition: "rejected", reason: `${reason}: ${check.reason}` });
      continue;
    }

    const insertStatus = check.identity === "uncertain" ? "candidate" : "active";

    // If this was a name-match replacement for a dead/rejected venue, update instead of insert
    if (nameMatch.matched && nameMatch.venueId) {
      await supabase.from("venues").update({
        website_url: result.link, calendar_url: result.link, status: insertStatus,
      }).eq("id", nameMatch.venueId);
      await supabase.from("schools").update({ url: result.link, status: insertStatus }).eq("venue_id", nameMatch.venueId);
      report.inserted.push({ name: result.title, url: result.link });
      existingDomains.add(result.domain);
      await logDiscoveryResult({ run_id: runId, query: result.query, raw_url: result.link, raw_title: result.title, domain: result.domain, disposition: "replaced_url", reason: `Updated URL on existing venue ${nameMatch.matchedName}` });
      continue;
    }

    // Step 6: GEOCODE + INSERT
    const slug = await resolveUniqueSlug(generateSlug(result.title));
    const geoResult = await geocodeSchool(result.title, result.link, result.address);
    await delay(1100);

    const geocodeSource = geoResult.source;
    const geocodeStatus = geoResult.source === "default" ? "default" : "ok";

    const { data: newVenue, error: venueError } = await supabase.from("venues").insert({
      name: result.title, slug, venue_type: "school", website_url: result.link,
      calendar_url: result.link, city: "chicago", source: "discovery", status: insertStatus,
      latitude: geoResult.lat, longitude: geoResult.lng,
      address: geoResult.address, geocode_source: geocodeSource, geocode_status: geocodeStatus,
    }).select("id").single();

    if (venueError) {
      await logDiscoveryResult({ run_id: runId, query: result.query, raw_url: result.link, raw_title: result.title, domain: result.domain, disposition: "insert_error", reason: `Venue insert: ${venueError.message}` });
      continue;
    }

    await supabase.from("schools").insert({
      name: result.title, short_name: result.title.slice(0, 14).toUpperCase(), slug,
      latitude: geoResult.lat, longitude: geoResult.lng, neighborhood: "Chicago", discipline: "acting",
      venue_id: newVenue.id, url: result.link, address: geoResult.address, status: insertStatus,
    });

    existingDomains.add(result.domain);
    venueRegistry.push({ id: newVenue.id, name: result.title, aliases: [], status: insertStatus });
    report.inserted.push({ name: result.title, url: result.link });
    await logDiscoveryResult({ run_id: runId, query: result.query, raw_url: result.link, raw_title: result.title, domain: result.domain, disposition: insertStatus === "candidate" ? "inserted_candidate" : "inserted", reason: check.identity === "uncertain" ? "Identity uncertain — inserted as candidate" : undefined });
  }
  return report;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const scraperKey = req.headers.get("x-scraper-key") ?? "";
  const bearer = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  let authed = false;
  if (scraperKey.length > 0 && scraperKey === SCRAPER_SECRET) authed = true;
  if (!authed && bearer.length > 0) {
    try {
      const payload = JSON.parse(atob(bearer.split(".")[1]));
      if (payload.role === "service_role" && payload.ref === "rytjrterecygirttvtdn") authed = true;
    } catch { /* not a valid JWT */ }
  }
  if (!authed && bearer.length > 0) {
    const { data: { user } } = await supabase.auth.getUser(bearer);
    if (user) authed = true;
  }
  if (!authed) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body is fine */ }
  const action = body.action as string | undefined;
  const limit = typeof body.limit === "number" ? body.limit : 50;

  if (action === "geocode-backfill") {
    const names = Array.isArray(body.names) ? body.names as string[] : null;

    let query = supabase
      .from("venues")
      .select("id, name, website_url, calendar_url, address, latitude, longitude, geocode_status")
      .eq("venue_type", "school")
      .or(
        [
          "latitude.is.null",
          "and(latitude.eq.41.8781,longitude.eq.-87.6298)",
          "and(latitude.eq.41.8755616,longitude.eq.-87.6244212)",
        ].join(","),
      )
      .limit(limit);

    if (names) {
      query = query.in("name", names);
    }

    const { data: stuckVenues } = await query;

    let processed = 0;
    let fixed = 0;
    const stillDefault: string[] = [];
    const sources: Record<string, string> = {};

    for (const venue of stuckVenues ?? []) {
      processed++;
      const url = venue.calendar_url ?? venue.website_url ?? "";

      const geoResult = await geocodeSchool(venue.name, url, venue.address);

      if (
        geoResult.source !== "default" &&
        !isBadCoordinate(geoResult.lat, geoResult.lng)
      ) {
        await supabase
          .from("venues")
          .update({
            latitude: geoResult.lat,
            longitude: geoResult.lng,
            address: geoResult.address ?? venue.address,
            geocode_source: geoResult.source,
            geocode_status: "ok",
          })
          .eq("id", venue.id);

        const { data: school } = await supabase
          .from("schools")
          .select("id")
          .eq("venue_id", venue.id)
          .maybeSingle();
        if (school) {
          await supabase
            .from("schools")
            .update({
              latitude: geoResult.lat,
              longitude: geoResult.lng,
              address: geoResult.address ?? venue.address,
            })
            .eq("id", school.id);
        }

        fixed++;
        sources[venue.name] = geoResult.source;
        console.log(
          `[school-discovery] Backfill fixed ${venue.name} → ${geoResult.lat},${geoResult.lng} (${geoResult.source})`,
        );
      } else {
        await supabase
          .from("venues")
          .update({
            geocode_source: "default",
            geocode_status: "default",
          })
          .eq("id", venue.id);
        stillDefault.push(venue.name);
      }

      await delay(1100);
    }

    return new Response(
      JSON.stringify({
        action: "geocode-backfill",
        processed,
        fixed,
        still_default: stillDefault,
        sources,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const runId = crypto.randomUUID();

  if (!PERPLEXITY_API_KEY) {
    return new Response(
      JSON.stringify({ action: "discover", run_id: runId, inserted: 0, known: 0, blocked: 0, queries_run: 0, warning: "PERPLEXITY_API_KEY not set" }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const { results: serpResults, queriesRun } = await searchForSchools();
  const report = await reconcileAndInsert(serpResults, runId);

  console.log(`[school-discovery] Run ${runId}: ${queriesRun} queries, ${serpResults.length} raw results, ${report.blocked} blocked, ${report.already_known} known, ${report.inserted.length} inserted, ${report.alias_matched.length} aliases, ${report.rejected.length} rejected, ${report.previously_rejected} remembered`);

  return new Response(
    JSON.stringify({
      action: "discover", run_id: runId, queries_run: queriesRun,
      ...report,
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
