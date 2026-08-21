export const AOA_UA = "AOA-ClassFinder/1.0 (+https://aoa-nine.vercel.app/bot; class-listing crawler)";

const domainTimestamps = new Map<string, number>();

export async function enforceRateLimit(domain: string): Promise<void> {
  const last = domainTimestamps.get(domain) ?? 0;
  const elapsed = Date.now() - last;
  const minDelay = 1200 + Math.random() * 600;
  if (elapsed < minDelay) {
    await new Promise((r) => setTimeout(r, minDelay - elapsed));
  }
  domainTimestamps.set(domain, Date.now());
}

export function parseRobotsTxt(text: string): string[] {
  const disallow: string[] = [];
  let inWildcard = false;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed) continue;

    const uaMatch = trimmed.match(/^User-agent:\s*(.+)/i);
    if (uaMatch) {
      inWildcard = uaMatch[1].trim() === "*";
      continue;
    }

    if (inWildcard) {
      const disallowMatch = trimmed.match(/^Disallow:\s*(.+)/i);
      if (disallowMatch) {
        const path = disallowMatch[1].trim();
        if (path && path !== "/") disallow.push(path);
      }
    }
  }

  return disallow;
}

export function isRobotsDisallowed(path: string, disallowList: string[]): boolean {
  return disallowList.some((prefix) => path.startsWith(prefix));
}

export function classifyFetchError(e: unknown): "blocked" | "timeout" | "dead" | "other" {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (msg.includes("403") || msg.includes("429") || msg.includes("forbidden")) return "blocked";
  if (msg.includes("abort") || msg.includes("timeout") || msg.includes("timed out")) return "timeout";
  if (msg.includes("enotfound") || msg.includes("ssl") || msg.includes("certificate") || msg.includes("dns")) return "dead";
  return "other";
}

export function extractRegistrableDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}
