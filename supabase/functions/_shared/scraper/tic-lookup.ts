import { parseTicListingPage, parseTicDetailPage } from "./tic-parser.ts";
import { matchVenueName } from "./venue-name-matcher.ts";
import type { TicShow, TicDetailData, TargetedEnrichment } from "./types.ts";

const TIC_BASE = "https://www.theatreinchicago.com";
const USER_AGENT = "Mozilla/5.0 (compatible; ArtOfArt-EventBot/1.0; +https://aoa-nine.vercel.app)";

let cachedComingSoon: TicShow[] | null = null;
let cachedNowPlaying: TicShow[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000;

async function fetchTicPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: controller.signal });
    if (!res.ok) throw new Error(`TIC HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAllPages(
  basePath: string,
  pageParam: string,
  totalParam: string,
): Promise<TicShow[]> {
  const page0Html = await fetchTicPage(`${TIC_BASE}${basePath}`);
  let allShows = parseTicListingPage(page0Html);

  const totalMatch = page0Html.match(new RegExp(`${totalParam}=(\\d+)`));
  const total = totalMatch ? parseInt(totalMatch[1]) : 0;
  if (total <= 0) return allShows;

  const pageCount = Math.ceil(total / 16);

  for (let i = 1; i < pageCount; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const pageHtml = await fetchTicPage(`${TIC_BASE}${basePath}?${pageParam}=${i}&${totalParam}=${total}`);
      allShows.push(...parseTicListingPage(pageHtml));
    } catch (e) {
      console.warn(`[tic-lookup] Page ${i} fetch failed:`, e);
    }
  }

  return allShows;
}

async function getComingSoon(): Promise<TicShow[]> {
  if (cachedComingSoon && Date.now() - cacheTime < CACHE_TTL) return cachedComingSoon;
  cachedComingSoon = await fetchAllPages(
    "/comingsoonrs.php",
    "pageNum_rsComingSoon",
    "totalRows_rsComingSoon",
  );
  cacheTime = Date.now();
  return cachedComingSoon;
}

async function getNowPlaying(): Promise<TicShow[]> {
  if (cachedNowPlaying && Date.now() - cacheTime < CACHE_TTL) return cachedNowPlaying;
  cachedNowPlaying = await fetchAllPages(
    "/nowplayingrs.php",
    "pageNum_rsNowPlaying",
    "totalRows_rsNowPlaying",
  );
  return cachedNowPlaying;
}

export async function getAllTicShows(): Promise<TicShow[]> {
  const [comingSoon, nowPlaying] = await Promise.all([getComingSoon(), getNowPlaying()]);
  return [...comingSoon, ...nowPlaying];
}

export async function lookupVenueOnTic(
  venueName: string,
): Promise<{ shows: TicShow[]; source: "coming_soon" | "now_playing" | "both" | null }> {
  const [comingSoon, nowPlaying] = await Promise.all([getComingSoon(), getNowPlaying()]);
  const csMatches = comingSoon.filter(s => matchVenueName(venueName, s.venueName) >= 0.6);
  const npMatches = nowPlaying.filter(s => matchVenueName(venueName, s.venueName) >= 0.6);

  const allMatches = [...csMatches, ...npMatches];
  if (allMatches.length === 0) return { shows: [], source: null };

  const source = csMatches.length > 0 && npMatches.length > 0 ? "both"
    : csMatches.length > 0 ? "coming_soon" : "now_playing";
  return { shows: allMatches, source };
}

export function ticShowsToEnrichments(shows: TicShow[]): TargetedEnrichment[] {
  return shows.map(s => ({
    title: s.title,
    start_date: s.startDate,
    end_date: s.endDate,
  }));
}

export async function enrichFromTicDetail(detailUrl: string): Promise<TicDetailData | null> {
  try {
    const html = await fetchTicPage(detailUrl);
    return parseTicDetailPage(html);
  } catch {
    return null;
  }
}

