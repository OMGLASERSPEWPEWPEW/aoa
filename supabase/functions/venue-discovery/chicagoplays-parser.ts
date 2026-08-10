import type { DiscoveredVenue } from "../_shared/scraper/types.ts";

interface DirectoryEntry {
  name: string;
  detailUrl: string;
  photoUrl: string | null;
}

function parseDirectoryPage(html: string): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];
  const pattern = /<div class="one-theatre">[\s\S]*?<a href="([^"]+)"[\s\S]*?<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[\s\S]*?<div class="theatre-title">([^<]+)<\/div>/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const detailUrl = match[1];
    const photoUrl = match[2] || null;
    const name = match[4].trim();

    if (name) {
      entries.push({ name, detailUrl, photoUrl });
    }
  }

  return entries;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchDetailPage(url: string): Promise<{
  address: string | null;
  website: string | null;
  description: string | null;
  phone: string | null;
  neighborhood: string | null;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ArtOfArt-EventBot/1.0; +https://aoa-nine.vercel.app)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return { address: null, website: null, description: null, phone: null, neighborhood: null };

    const html = await res.text();

    const addressMatch = html.match(/<div class="vtm-address">([\s\S]*?)<\/div>/);
    const address = addressMatch
      ? addressMatch[1].replace(/<br\s*\/?>/g, ", ").replace(/<[^>]+>/g, "").trim()
      : null;

    const websiteMatch = html.match(/<div class="vtm-website"><a href="([^"]+)"/);
    const website = websiteMatch ? websiteMatch[1] : null;

    const descMatch = html.match(/<div class="vtm-description">([\s\S]*?)<\/div>/);
    const description = descMatch
      ? descMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 500)
      : null;

    const phoneMatch = html.match(/<div class="vtm-phone">([\s\S]*?)<\/div>/);
    const phone = phoneMatch ? phoneMatch[1].replace(/<[^>]+>/g, "").trim() : null;

    const hoodMatch = html.match(/class="[^"]*neighbourhood?-([a-z0-9-]+)/);
    const neighborhood = hoodMatch
      ? hoodMatch[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : null;

    return { address, website, description, phone, neighborhood };
  } catch {
    return { address: null, website: null, description: null, phone: null, neighborhood: null };
  }
}

export async function parseChicagoPlays(html: string): Promise<DiscoveredVenue[]> {
  const entries = parseDirectoryPage(html);
  const results: DiscoveredVenue[] = [];

  const BATCH = 5;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const details = await Promise.all(
      batch.map((e) => fetchDetailPage(e.detailUrl)),
    );

    for (let j = 0; j < batch.length; j++) {
      const entry = batch[j];
      const detail = details[j];

      results.push({
        raw_name: entry.name,
        raw_address: detail.address,
        raw_website_url: detail.website,
        raw_genre_tags: [],
        raw_neighborhood: detail.neighborhood,
        raw_category: "Member Theater",
        raw_description: detail.description,
        raw_phone: detail.phone,
        raw_photo_url: entry.photoUrl,
        detail_page_url: entry.detailUrl,
      });
    }

    if (i + BATCH < entries.length) {
      await delay(1000);
    }
  }

  return results;
}
