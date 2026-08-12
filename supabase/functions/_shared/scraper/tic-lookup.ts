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

async function getComingSoon(): Promise<TicShow[]> {
  if (cachedComingSoon && Date.now() - cacheTime < CACHE_TTL) return cachedComingSoon;
  const html = await fetchTicPage(`${TIC_BASE}/comingsoonrs.php?viewall=1`);
  cachedComingSoon = parseTicListingPage(html);
  cacheTime = Date.now();
  return cachedComingSoon;
}

async function getNowPlaying(): Promise<TicShow[]> {
  if (cachedNowPlaying && Date.now() - cacheTime < CACHE_TTL) return cachedNowPlaying;
  const html = await fetchTicPage(`${TIC_BASE}/nowplayingrs.php?viewall=1`);
  cachedNowPlaying = parseTicListingPage(html);
  return cachedNowPlaying;
}

export async function lookupVenueOnTic(
  venueName: string,
): Promise<{ shows: TicShow[]; source: "coming_soon" | "now_playing" | null }> {
  const comingSoon = await getComingSoon();
  const matches = comingSoon.filter(s => matchVenueName(venueName, s.venueName) >= 0.6);
  if (matches.length > 0) return { shows: matches, source: "coming_soon" };

  const nowPlaying = await getNowPlaying();
  const npMatches = nowPlaying.filter(s => matchVenueName(venueName, s.venueName) >= 0.6);
  if (npMatches.length > 0) return { shows: npMatches, source: "now_playing" };

  return { shows: [], source: null };
}

export function ticShowsToEnrichments(shows: TicShow[]): TargetedEnrichment[] {
  return shows
    .filter(s => s.startDate || s.endDate)
    .map(s => ({
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
