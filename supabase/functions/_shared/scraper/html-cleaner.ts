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
