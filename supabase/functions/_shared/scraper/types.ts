export interface VenueTarget {
  id: string;
  name: string;
  slug: string;
  calendar_url: string;
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
