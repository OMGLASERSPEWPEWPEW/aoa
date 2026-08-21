import type { ClassifierResult, DeepSeekResponse } from "./types.ts";
import { CostBudget } from "./cost-budget.ts";

function getAiKey(): { key: string; url: string; model: string } | null {
  const openai = Deno.env.get("OPENAI_API_KEY");
  if (openai) return { key: openai, url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" };
  const deepseek = Deno.env.get("DEEPSEEK_API_KEY");
  if (deepseek) return { key: deepseek, url: "https://api.deepseek.com/chat/completions", model: "deepseek-chat" };
  return null;
}

export const CLASSIFIER_ROUTING: Record<string, { runExtraction: boolean; harvestLinks: boolean }> = {
  catalog_index: { runExtraction: true, harvestLinks: true },
  program_detail: { runExtraction: true, harvestLinks: true },
  schedule_calendar: { runExtraction: true, harvestLinks: true },
  registration_portal: { runExtraction: false, harvestLinks: false },
  faculty: { runExtraction: false, harvestLinks: false },
  youth_only: { runExtraction: false, harvestLinks: false },
  blog_or_news: { runExtraction: false, harvestLinks: false },
  production_or_festival: { runExtraction: false, harvestLinks: false },
  policy_or_admin: { runExtraction: false, harvestLinks: false },
  other: { runExtraction: false, harvestLinks: true },
};

export async function classifyPage(
  url: string,
  title: string,
  headings: string[],
  snippet: string,
  schoolName: string,
  budget: CostBudget,
  apiKey?: string,
): Promise<ClassifierResult> {
  const ai = apiKey ? { key: apiKey, url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" } : getAiKey();
  if (!ai || !budget.canAffordAiCall()) {
    return { page_kind: "other", has_dates: false, has_prices: false };
  }

  const prompt = `School: "${schoolName}". URL: ${url}
Title: ${title}
Headings: ${headings.slice(0, 10).join(" | ")}
First 1200 chars of page text:
---
${snippet.slice(0, 1200)}
---
Classify as exactly one page_kind:
"catalog_index"       - lists many classes/programs, possibly with dates
"program_detail"      - one program/class with description and/or sections
"schedule_calendar"   - a schedule or calendar of class sessions
"registration_portal" - signup/login/cart/account page
"faculty"             - instructor bios
"youth_only"          - exclusively kids/teens/camps content
"blog_or_news"        - articles, tips, alumni news, testimonials
"production_or_festival" - a theatrical production, play, festival, showcase, or show page: cast lists, 'directed by', performance dates, ticket links
"policy_or_admin"     - policies, FAQs, rentals, donations, contact, about
"other"

Respond with only:
{"page_kind":"...", "has_dates":true|false, "has_prices":true|false}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(ai.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: "You classify web pages for a class-listing crawler. Output only JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        max_tokens: 200,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { page_kind: "other", has_dates: false, has_prices: false };

    const data: DeepSeekResponse = await res.json();
    budget.recordAiCall(data.usage.prompt_tokens, data.usage.completion_tokens);
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw.replace(/```json\s*/g, "").replace(/```/g, "").trim());
    return {
      page_kind: parsed.page_kind ?? "other",
      has_dates: parsed.has_dates ?? false,
      has_prices: parsed.has_prices ?? false,
    };
  } catch {
    return { page_kind: "other", has_dates: false, has_prices: false };
  }
}

export function extractHeadings(markdown: string): string[] {
  const headings: string[] = [];
  for (const line of markdown.split("\n")) {
    const m = line.match(/^#{1,6}\s+(.+)/);
    if (m) headings.push(m[1].trim());
  }
  return headings;
}

export function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : "";
}

export function needsRender(page: {
  cleanedLength: number;
  pageKind: string;
  programsExtracted: number;
  sameDomainLinkCount: number;
  boilerplateDroppedRatio: number;
}): boolean {
  if (page.cleanedLength < 300) return true;
  const contentKind = ["catalog_index", "program_detail", "schedule_calendar"]
    .includes(page.pageKind);
  if (contentKind && page.programsExtracted === 0
      && page.sameDomainLinkCount >= 8) return true;
  if (page.boilerplateDroppedRatio > 0.9) return true;
  return false;
}
