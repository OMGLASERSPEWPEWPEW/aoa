import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { EnrichmentCandidate } from "../_shared/scraper/types.ts";
import { extractOgImage } from "../_shared/scraper/og-image-extractor.ts";
import { geocode } from "./geocoder.ts";
import { findCalendarUrl } from "./calendar-finder.ts";
import { classifyVenueType } from "./venue-type-classifier.ts";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface BatchResult {
  success: number;
  failed: number;
  aiInputTokens: number;
  aiOutputTokens: number;
}

export async function enrichBatch(
  supabase: SupabaseClient,
  candidates: EnrichmentCandidate[],
): Promise<BatchResult> {
  const result: BatchResult = { success: 0, failed: 0, aiInputTokens: 0, aiOutputTokens: 0 };

  for (const candidate of candidates) {
    const stepsFailed: string[] = [];
    const update: Record<string, unknown> = {};
    let websiteHtml: string | null = null;
    let websiteReachable = false;

    // Step 1: Geocode
    if (candidate.raw_address) {
      const geo = await geocode(candidate.raw_address);
      if (geo) {
        update.enriched_latitude = geo.lat;
        update.enriched_longitude = geo.lng;
        update.geocode_source = geo.source;
      } else {
        update.geocode_source = "failed";
        stepsFailed.push("geocoding");
      }
      await delay(200);
    }

    // Fetch website HTML (used by steps 2-4)
    if (candidate.raw_website_url) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const res = await fetch(candidate.raw_website_url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ArtOfArt-EventBot/1.0; +https://aoa-nine.vercel.app)" },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          websiteHtml = await res.text();
          websiteReachable = true;
        }
      } catch {
        // website unreachable
      }
    }
    update.enriched_website_reachable = websiteReachable;

    // Step 2: Calendar URL
    if (websiteHtml && candidate.raw_website_url) {
      const calUrl = findCalendarUrl(websiteHtml, candidate.raw_website_url);
      if (calUrl) {
        update.enriched_calendar_url = calUrl;
      } else {
        stepsFailed.push("calendar_url");
      }
    } else if (candidate.raw_website_url) {
      stepsFailed.push("calendar_url");
    }

    // Step 3: Photo extraction
    if (websiteHtml && candidate.raw_website_url) {
      const photo = extractOgImage(websiteHtml, candidate.raw_website_url);
      if (photo) {
        update.enriched_photo_url = photo;
        update.enriched_photo_url_source = "og_image";
      }
    }

    // Step 4: Venue type classification
    const typeResult = await classifyVenueType(candidate, websiteHtml);
    update.enriched_venue_type = typeResult.venue_type;
    update.enriched_venue_type_confidence = typeResult.confidence;

    // Update queue row
    update.enrichment_steps_failed = stepsFailed;
    update.enrichment_status = websiteReachable || candidate.raw_address ? "complete" : "failed";

    const { error } = await supabase
      .from("venue_discovery_queue")
      .update(update)
      .eq("id", candidate.id);

    if (error) {
      console.error(`[enrichment] Failed to update ${candidate.raw_name}:`, error.message);
      result.failed++;
    } else {
      if (update.enrichment_status === "complete") result.success++;
      else result.failed++;
    }

    await delay(200);
  }

  return result;
}
