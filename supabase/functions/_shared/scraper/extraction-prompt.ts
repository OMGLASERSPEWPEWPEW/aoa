export function buildExtractionPrompt(venueName: string): string {
  return `You are an event data extractor for Chicago theater venues. Extract all upcoming shows, classes, workshops, festivals, and readings from the provided webpage text for "${venueName}".

Return valid JSON with this exact structure:
{
  "events": [
    {
      "title": "Show Title",
      "description": "1-2 sentence description of the show/event",
      "event_type": "show|class|workshop|festival|open-call",
      "genre_tags": ["drama", "comedy", "improv", "musical", "new-work", "classic", "experimental"],
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD or null if single-day",
      "price_min": 25,
      "price_max": 65,
      "ticket_url": "https://... direct ticket link if found, or null",
      "hottix_available": false
    }
  ]
}

Rules:
- Only include events with dates in the future (after today's date)
- Use "show" for performances, "class" for multi-week courses, "workshop" for one-day/weekend sessions
- genre_tags should use lowercase kebab-case, pick from: drama, comedy, improv, sketch, musical, new-work, classic, experimental, interactive, physical-theater, adaptation, social-justice, community, diverse-voices, shakespeare, revue, writing, beginner, intermediate, advanced
- If price is "pay what you can" or "free", set price_min to 0
- Set hottix_available to true only if HotTix or half-price is explicitly mentioned
- If no events are found, return {"events": []}
- Do NOT invent events — only extract what is actually on the page`;
}
