export function extractOgImage(html: string, baseUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const raw = match[1].replace(/&amp;/g, "&");
      return resolveUrl(raw, baseUrl);
    }
  }
  return null;
}

function resolveUrl(url: string, base: string): string | null {
  if (!url || url.startsWith("data:") || url.trim().length === 0) {
    return null;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}
