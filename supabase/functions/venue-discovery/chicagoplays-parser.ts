import type { DiscoveredVenue } from "../_shared/scraper/types.ts";

export function parseChicagoPlays(html: string): DiscoveredVenue[] {
  const results: DiscoveredVenue[] = [];
  const pattern = /<div class="one-theatre">[\s\S]*?<a href="([^"]+)"[\s\S]*?<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[\s\S]*?<div class="theatre-title">([^<]+)<\/div>/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const detailUrl = match[1];
    const photoUrl = match[2] || null;
    const name = match[4].trim();

    if (name) {
      results.push({
        raw_name: name,
        raw_address: null,
        raw_website_url: null,
        raw_genre_tags: [],
        raw_neighborhood: null,
        raw_category: "Member Theater",
        raw_description: null,
        raw_phone: null,
        raw_photo_url: photoUrl,
        detail_page_url: detailUrl,
      });
    }
  }

  return results;
}
