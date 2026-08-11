export interface VenueTarget {
  id: string;
  name: string;
  slug: string;
  calendar_url: string;
  website_url?: string | null;
  photo_url?: string | null;
  photo_url_source?: string | null;
}

export interface ScrapedEvent {
  title: string;
  description: string;
  event_type: "show" | "class" | "workshop" | "festival" | "open-call";
  genre_tags: string[];
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  price_min: number | null;
  price_max: number | null;
  ticket_url: string | null;
  hottix_available: boolean;
  photo_url: string | null;
  show_times: Record<string, string[]> | null;
  cast_members: Array<{ name: string; role: string | null }> | null;
}

export interface ScrapeResult {
  venue_id: string;
  venue_name: string;
  status: "success" | "fetch_error" | "parse_error" | "ai_error" | "skipped";
  events_found: number;
  events_created: number;
  events_updated: number;
  error_message: string | null;
  ai_input_tokens: number;
  ai_output_tokens: number;
  duration_ms: number;
}

export interface EnrichmentResult {
  venue_id: string;
  venue_name: string;
  photo_extracted: boolean;
  photo_url: string | null;
  website_url_valid: boolean | null;
  error_message: string | null;
  duration_ms: number;
}

export interface DeepSeekResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    prompt_cache_hit_tokens: number;
    prompt_cache_miss_tokens: number;
  };
}

// --- Multi-Pass Extraction types ---

export interface Pass1Event {
  title: string;
  event_type: string;
  start_date: string | null;
  end_date: string | null;
  price_min: number | null;
  price_max: number | null;
  ticket_url: string | null;
  show_times: Record<string, string[]> | null;
}

export interface Pass2Verification {
  title: string;
  status: "verified" | "corrected" | "rejected";
  rejection_reason: string | null;
  confidence: number;
  description: string | null;
  genre_tags: string[];
  cast_members: Array<{ name: string; role: string | null }> | null;
  photo_url: string | null;
  corrections: {
    price_min?: number | null;
    price_max?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    event_type?: string | null;
  };
}

export interface ExtractionResult {
  events: Pass1Event[];
  inputTokens: number;
  outputTokens: number;
}

export interface VerificationResult {
  events: Pass2Verification[];
  inputTokens: number;
  outputTokens: number;
}

// --- Venue Discovery Pipeline types ---

export interface DiscoveredVenue {
  raw_name: string;
  raw_address: string | null;
  raw_website_url: string | null;
  raw_genre_tags: string[];
  raw_neighborhood: string | null;
  raw_category: string | null;
  raw_description: string | null;
  raw_phone: string | null;
  raw_photo_url: string | null;
  detail_page_url: string | null;
}

export interface EnrichmentCandidate {
  id: string;
  raw_name: string;
  raw_address: string | null;
  raw_website_url: string | null;
  raw_genre_tags: string[];
  raw_category: string | null;
}

export interface VenueTypeResult {
  venue_type: "storefront" | "institutional" | "experimental" | "school";
  confidence: number;
  method: "rule" | "ai";
}

export interface DiscoveryRunSummary {
  run_id: string;
  source_id: string;
  venues_found: number;
  venues_new: number;
  venues_matched: number;
  enrichment_success: number;
  enrichment_failed: number;
  ai_input_tokens: number;
  ai_output_tokens: number;
  fetch_status: "success" | "fetch_error" | "parse_error" | "parse_warning";
  alert_admin: boolean;
  error_message: string | null;
}

export interface VenueCoverageMetrics {
  total_aoa_venues: number;
  total_known_chicago: number;
  coverage_pct: number;
  venues_with_calendar_url: number;
  venues_with_photo: number;
  venues_zero_events: number;
  pending_in_queue: number;
  last_discovery_run: string | null;
  last_run_alert: boolean;
}
