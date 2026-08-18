export interface JsonLdEvent {
  name: string | null;
  startDate: string | null;
  endDate: string | null;
  price: number | null;
  url: string | null;
  image: string | null;
}

export function extractJsonLd(raw: string): JsonLdEvent[] {
  const results: JsonLdEvent[] = [];
  const pattern = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const item of items) {
        const type = item["@type"];
        if (!type || !["Event", "Course", "EducationEvent", "TheaterEvent", "MusicEvent"].includes(type)) continue;

        const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        results.push({
          name: item.name ?? null,
          startDate: item.startDate ? item.startDate.slice(0, 10) : null,
          endDate: item.endDate ? item.endDate.slice(0, 10) : null,
          price: offers?.price ? Number(offers.price) : null,
          url: offers?.url ?? item.url ?? null,
          image: typeof item.image === "string" ? item.image : item.image?.url ?? null,
        });
      }
    } catch { /* malformed JSON-LD — skip */ }
  }
  return results;
}

export function cleanHtml(raw: string, maxChars = 30_000): string {
  let html = raw;

  // Remove script, style, nav, footer, header, aside tags and their content
  html = html.replace(/<(script|style|nav|footer|header|aside|noscript|iframe|svg)[\s\S]*?<\/\1>/gi, "");

  // Remove HTML comments
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Preserve link URLs inline before stripping tags
  html = html.replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, url, text) => `${text.replace(/<[^>]+>/g, '')} [${url}]`);

  // Preserve image URLs before stripping tags
  html = html.replace(/<img\s[^>]*src=["'](https?:\/\/[^"']+)["'][^>]*\/?>/gi,
    (_, src) => `[img: ${src}]`);

  // Remove all remaining HTML tags, keep text content
  html = html.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  html = html.replace(/&amp;/g, "&");
  html = html.replace(/&lt;/g, "<");
  html = html.replace(/&gt;/g, ">");
  html = html.replace(/&quot;/g, '"');
  html = html.replace(/&#39;/g, "'");
  html = html.replace(/&nbsp;/g, " ");
  html = html.replace(/&#\d+;/g, "");

  // Collapse whitespace
  html = html.replace(/\s+/g, " ").trim();

  // Truncate to limit
  if (html.length > maxChars) {
    html = html.substring(0, maxChars);
  }

  return html;
}
