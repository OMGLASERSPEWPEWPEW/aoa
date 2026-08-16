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
  instructor_name: string | null;
  skill_level: string | null;
  session_count: number | null;
  class_format: string | null;
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
  strategy_links_followed?: number;
  strategy_fields_filled?: string[];
  strategy_stop_reason?: string;
  field_summary?: {
    with_dates: number;
    total: number;
    missing: string[];
    sources: string[];
    event_details: Array<{
      title: string;
      start_date: string | null;
      end_date: string | null;
      price_min: number | null;
      price_max: number | null;
      has_ticket: boolean;
      has_times: boolean;
      found_by: string[];
    }>;
  };
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
  instructor_name?: string | null;
  skill_level?: string | null;
  session_count?: number | null;
  class_format?: string | null;
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
  instructor_name?: string | null;
  skill_level?: string | null;
  session_count?: number | null;
  class_format?: string | null;
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

// --- Intelligent Event Scraper v2 types ---

export interface EventCompleteness {
  eventIndex: number;
  title: string;
  score: number;
  missingFields: string[];
  needsFollow: boolean;
}

export interface CandidateLink {
  url: string;
  anchorText: string;
  score: number;
  matchedEventTitles: string[];
}

export interface StrategyStep {
  step: "initial_extract" | "link_follow" | "website_fallback" | "verify" | "aggregator_crossref" | "aggregator_detail";
  url: string;
  aiCalls: number;
  inputTokens: number;
  outputTokens: number;
  eventsAffected: number;
  fieldsFilledIn: string[];
  durationMs: number;
}

export interface StrategyTrace {
  steps: StrategyStep[];
  totalAiCalls: number;
  totalFetches: number;
  budgetUsed: number;
  budgetLimit: number;
  linksFollowed: string[];
  completenessBeforeFollows: number;
  completenessAfterFollows: number;
  stopReason: string;
}

export interface StrategyProfile {
  domain: "theater" | "class";
  fieldWeights: Record<string, number>;
  logFeaturePrefix: string;
}

export interface TargetedEnrichment {
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  ticket_url?: string | null;
  show_times?: Record<string, string[]> | null;
  instructor_name?: string | null;
  skill_level?: string | null;
  session_count?: number | null;
  class_format?: string | null;
}

// --- TheatreInChicago.com types ---

export interface TicShow {
  title: string;
  venueName: string;
  detailUrl: string;
  startDate: string | null;
  endDate: string | null;
  photoUrl: string | null;
}

export interface TicDetailData {
  title: string;
  startDate: string | null;
  endDate: string | null;
  showTimes: Record<string, string[]> | null;
  ticketUrl: string | null;
  cast: Array<{ name: string; role: string | null }> | null;
  genre: string | null;
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

// --- Play Catalog types ---

export interface PlayRecord {
  id: string;
  title: string;
  slug: string;
  playwright: string;
  year_written: number | null;
  source: "curated" | "ai";
}

export interface AiPlayIdentification {
  is_canonical_work: boolean;
  is_devised_or_original: boolean;
  canonical_title: string | null;
  playwright: string | null;
  year_written: number | null;
  confidence: number;
}

export interface PlayMatchSummary {
  events_processed: number;
  exact_matches: number;
  fuzzy_matches: number;
  ai_matches: number;
  plays_created: number;
  events_skipped: number;
  events_unmatched: number;
  ai_input_tokens: number;
  ai_output_tokens: number;
  duration_ms: number;
}
