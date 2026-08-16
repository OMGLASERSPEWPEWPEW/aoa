export function buildExtractionPrompt(venueName: string): string {
  return `You are an event data extractor for Chicago theater venues. Extract all upcoming shows, classes, workshops, festivals, and readings from the provided webpage text.

CRITICAL CONTEXT: You are extracting events for "${venueName}". Only extract events that are PERFORMED AT this venue. If an event mentions a different venue name, location, or address, DO NOT include it.

URLs appear in the text as [https://...] after link text. These are CRITICAL — extract them as ticket_url values.

Return valid JSON with this exact structure:
{
  "events": [
    {
      "title": "Show Title",
      "event_type": "show|class|workshop|festival|open-call",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD or null if single-day",
      "price_min": 25,
      "price_max": 65,
      "ticket_url": "https://...",
      "show_times": {
        "thu": ["19:30"],
        "fri": ["19:30", "22:00"],
        "sat": ["14:00", "19:30"],
        "sun": ["14:00"]
      }
    }
  ]
}

PRICE RULES (READ CAREFULLY):
- price_min and price_max must be numbers or null
- If the page does NOT show a specific ticket price for an event, set BOTH to null — NOT 0
- Set price_min to 0 ONLY when the page explicitly says "free", "no cost", "complimentary", or "$0"
- "Pay what you can" = price_min: 0 with a non-zero price_max if listed
- If you see a single price like "$45", set both price_min and price_max to 45
- NEVER guess or hallucinate prices. When in doubt, use null

VENUE ATTRIBUTION RULES:
- Only include events PERFORMED AT "${venueName}"
- If an event says "at [Other Venue]" or lists a different address, EXCLUDE it
- Touring shows, guest productions, and co-productions that happen AT this venue ARE included
- Events listed under "Elsewhere" or "Other Venues" sections must be EXCLUDED

DATE RULES:
- Only include events with dates in the future (after today's date)
- start_date and end_date should reflect the actual production run
- If a program runs year-round (e.g., "2025-2026 season"), use the dates of the NEXT specific performance, not the entire season span
- Single performances: set end_date to null
- If no specific dates are listed, set start_date to null

OTHER RULES:
- ticket_url: Use the most specific URL for that show — the individual show page or ticket purchase link, NOT the general season page
- Use "show" for performances, "class" for multi-week courses, "workshop" for one-day/weekend sessions
- show_times: use 3-letter lowercase day keys (mon, tue, wed, thu, fri, sat, sun) with 24h "HH:MM" format. Set to null if not listed
- If no events are found, return {"events": []}
- Do NOT invent events — only extract what is actually on the page

CLASS-SPECIFIC FIELDS (for event_type "class" or "workshop" ONLY — null for shows):
- instructor_name: The name of the instructor or lead facilitator. String or null.
- skill_level: One of "beginner", "intermediate", "advanced", "all-levels", "drop-in". Null if not stated.
- session_count: Integer number of sessions in the course (e.g., 8 for an 8-week class). Null for single sessions.
- class_format: One of "ongoing" (rolling enrollment, no fixed end), "workshop" (one or two days), "intensive" (3-5 day immersive), "drop-in" (no commitment), "series" (fixed number of sessions with defined start/end). Null if unclear.

For show events, omit these keys entirely (do not include them as null).`;
}
