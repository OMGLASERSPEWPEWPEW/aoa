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

function resolveUrl(url: string, baseUrl: string): string {
  if (!url || url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return "https:" + url;
  try { return new URL(url, baseUrl).href; } catch { return url; }
}

const NOISE_TAGS = ["script", "style", "nav", "footer", "header", "aside", "noscript", "iframe", "svg"];

const NOISE_CLASSES = [
  "header", "top", "navbar", "footer", "bottom", "sidebar", "side", "aside",
  "modal", "popup", "overlay", "ad", "ads", "advert", "lang-selector", "language",
  "social", "social-media", "social-links", "menu", "navigation",
  "breadcrumbs", "share", "widget", "cookie",
];

const NOISE_IDS = [
  "header", "footer", "sidebar", "modal", "ad", "language-selector",
  "social", "nav", "breadcrumbs", "share", "widget", "cookie",
];

export function htmlToMarkdown(raw: string, baseUrl: string, maxChars = 30_000): string {
  try {
    let html = raw;

    for (const tag of NOISE_TAGS) {
      html = html.replace(new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, "gi"), "");
    }

    for (const cls of NOISE_CLASSES) {
      html = html.replace(new RegExp(`<([a-z][a-z0-9]*)\\s[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>[\\s\\S]*?<\\/\\1>`, "gi"), "");
    }
    for (const id of NOISE_IDS) {
      html = html.replace(new RegExp(`<([a-z][a-z0-9]*)\\s[^>]*id="${id}"[^>]*>[\\s\\S]*?<\\/\\1>`, "gi"), "");
    }

    html = html.replace(/<!--[\s\S]*?-->/g, "");

    html = html.replace(/<img\s([^>]*)\/?>/gi, (_match, attrs: string) => {
      const dataSrcset = attrs.match(/data-srcset=["']([^"']+)["']/i);
      const dataSrc = attrs.match(/data-src=["']([^"']+)["']/i);
      const src = attrs.match(/src=["']([^"']+)["']/i);
      const alt = attrs.match(/alt=["']([^"']*?)["']/i);

      let imgUrl = dataSrcset?.[1]?.split(",")[0]?.trim()?.split(/\s/)[0]
        || dataSrc?.[1]
        || src?.[1];

      if (!imgUrl || imgUrl.startsWith("data:")) return "";
      imgUrl = resolveUrl(imgUrl, baseUrl);
      return `![${alt?.[1] ?? ""}](${imgUrl})`;
    });

    for (let i = 6; i >= 1; i--) {
      const hashes = "#".repeat(i);
      html = html.replace(new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, "gi"),
        (_, content: string) => `\n\n${hashes} ${content.replace(/<[^>]+>/g, "").trim()}\n\n`);
    }

    html = html.replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_, url: string, text: string) => {
        const cleanText = text.replace(/<[^>]+>/g, "").trim();
        if (!cleanText) return "";
        return `[${cleanText}](${resolveUrl(url, baseUrl)})`;
      });

    html = html.replace(/<(strong|b)\s*[^>]*>([\s\S]*?)<\/\1>/gi, (_, __: string, text: string) => `**${text.replace(/<[^>]+>/g, "")}**`);
    html = html.replace(/<(em|i)\s*[^>]*>([\s\S]*?)<\/\1>/gi, (_, __: string, text: string) => `*${text.replace(/<[^>]+>/g, "")}*`);

    html = html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent: string) => {
      const rows: string[] = [];
      const rowMatches = tableContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
      for (const rowMatch of rowMatches) {
        const cells: string[] = [];
        const cellMatches = rowMatch[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi);
        for (const cellMatch of cellMatches) {
          cells.push(cellMatch[2].replace(/<[^>]+>/g, "").trim());
        }
        if (cells.length > 0) rows.push(`| ${cells.join(" | ")} |`);
      }
      if (rows.length === 0) return "";
      const sep = `| ${rows[0].split("|").slice(1, -1).map(() => "---").join(" | ")} |`;
      return `\n\n${rows[0]}\n${sep}\n${rows.slice(1).join("\n")}\n\n`;
    });

    html = html.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, listContent: string) => {
      let idx = 0;
      return "\n" + listContent.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, item: string) => {
        idx++;
        return `${idx}. ${item.replace(/<[^>]+>/g, "").trim()}\n`;
      }) + "\n";
    });

    html = html.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, listContent: string) => {
      return "\n" + listContent.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, item: string) => {
        return `- ${item.replace(/<[^>]+>/g, "").trim()}\n`;
      }) + "\n";
    });

    html = html.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content: string) => `\n\n${content}\n\n`);
    html = html.replace(/<br\s*\/?>/gi, "\n");

    html = html.replace(/<[^>]+>/g, "");

    html = html.replace(/&amp;/g, "&");
    html = html.replace(/&lt;/g, "<");
    html = html.replace(/&gt;/g, ">");
    html = html.replace(/&quot;/g, '"');
    html = html.replace(/&#39;/g, "'");
    html = html.replace(/&nbsp;/g, " ");
    html = html.replace(/&#\d+;/g, "");

    html = html.replace(/[ \t]+/g, " ");
    html = html.replace(/\n{3,}/g, "\n\n");
    html = html.trim();

    if (html.length > maxChars) {
      const truncAt = html.lastIndexOf("\n\n", maxChars);
      html = truncAt > maxChars * 0.7 ? html.substring(0, truncAt) : html.substring(0, maxChars);
    }

    return html;
  } catch {
    return cleanHtml(raw, maxChars);
  }
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
