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

export async function enrichBatch(
  supabase: SupabaseClient,
  candidates: Array<EnrichmentCandidate & { detail_page_url?: string | null }>,
): Promise<BatchResult> {
  const result: BatchResult = { success: 0, failed: 0, aiInputTokens: 0, aiOutputTokens: 0 };

  for (const candidate of candidates) {
    const stepsFailed: string[] = [];
    const update: Record<string, unknown> = {};
    let websiteHtml: string | null = null;
    let websiteReachable = false;
    let address = candidate.raw_address;
    let websiteUrl = candidate.raw_website_url;

    // Step 0: Fetch ChicagoPlays detail page for address/website/description
    if (candidate.detail_page_url) {
      const detail = await fetchDetailPage(candidate.detail_page_url);
      if (detail.address) {
        address = detail.address;
        update.raw_address = detail.address;
      }
      if (detail.website) {
        websiteUrl = detail.website;
        update.raw_website_url = detail.website;
      }
      if (detail.description) update.raw_description = detail.description;
      if (detail.phone) update.raw_phone = detail.phone;
      if (detail.neighborhood) update.raw_neighborhood = detail.neighborhood;
      await delay(200);
    }

    // Step 1: Geocode
    if (address) {
      const geo = await geocode(address);
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

    // Fetch venue website HTML (used by steps 2-4)
    if (websiteUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const res = await fetch(websiteUrl, {
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

    // Step 2: Calendar URL from venue website
    if (websiteHtml && websiteUrl) {
      const calUrl = findCalendarUrl(websiteHtml, websiteUrl);
      if (calUrl) {
        update.enriched_calendar_url = calUrl;
      } else {
        stepsFailed.push("calendar_url");
      }
    } else if (websiteUrl) {
      stepsFailed.push("calendar_url");
    }

    // Step 3: Photo from venue website og:image
    if (websiteHtml && websiteUrl) {
      const photo = extractOgImage(websiteHtml, websiteUrl);
      if (photo) {
        update.enriched_photo_url = photo;
        update.enriched_photo_url_source = "og_image";
      }
    }

    // Step 4: Venue type classification
    const enrichedCandidate = { ...candidate, raw_address: address, raw_website_url: websiteUrl };
    const typeResult = await classifyVenueType(enrichedCandidate, websiteHtml);
    update.enriched_venue_type = typeResult.venue_type;
    update.enriched_venue_type_confidence = typeResult.confidence;

    update.enrichment_steps_failed = stepsFailed;
    update.enrichment_status = websiteReachable || address ? "complete" : "failed";

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
