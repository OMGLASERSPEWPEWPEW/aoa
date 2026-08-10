import type { EnrichmentCandidate, VenueTypeResult } from "../_shared/scraper/types.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;

export async function classifyVenueType(
  candidate: EnrichmentCandidate,
  websiteText: string | null,
): Promise<VenueTypeResult> {
  const name = candidate.raw_name.toLowerCase();
  const category = (candidate.raw_category || "").toLowerCase();
  const tags = candidate.raw_genre_tags.map((t) => t.toLowerCase());

  // Rule 1: School indicators
  if (
    name.includes("school") ||
    name.includes("training") ||
    name.includes("academy") ||
    name.includes("conservatory")
  ) {
    return { venue_type: "school", confidence: 0.9, method: "rule" };
  }

  // Rule 2: Category-based
  if (category.includes("storefront")) {
    return { venue_type: "storefront", confidence: 0.85, method: "rule" };
  }
  if (category.includes("institutional") || category.includes("broadway")) {
    return { venue_type: "institutional", confidence: 0.85, method: "rule" };
  }

  // Rule 3: Experimental indicators
  if (
    (tags.includes("experimental") || tags.includes("devised")) &&
    !name.includes("school") &&
    !name.includes("training")
  ) {
    return { venue_type: "experimental", confidence: 0.75, method: "rule" };
  }

  // Rule 4: Large venue indicators
  if (
    name.includes("center") ||
    name.includes("theatre company") ||
    name.includes("theater company")
  ) {
    return { venue_type: "storefront", confidence: 0.7, method: "rule" };
  }

  // Default: storefront (most Chicago theaters are storefronts)
  return { venue_type: "storefront", confidence: 0.6, method: "rule" };
}
