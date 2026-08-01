export function buildExtractionPrompt(venueName: string): string {
  return `You are an event data extractor for Chicago theater venues. Extract all upcoming shows, classes, workshops, festivals, and readings from the provided webpage text for "${venueName}".

URLs appear in the text as [https://...] after link text. These are CRITICAL — extract them as ticket_url values.
Image URLs appear in the text as [img: https://...]. These are promotional images — extract the best one per event as photo_url.

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
      "ticket_url": "https://... the specific URL for THIS show's page or ticket page",
      "hottix_available": false,
      "photo_url": "https://... the promotional image/poster for THIS show, or null",
      "cast_members": [{"name": "Actor Name", "role": "Character Name or null"}],
      "show_times": {
        "thu": ["19:30"],
        "fri": ["19:30", "22:00"],
        "sat": ["14:00", "19:30"],
        "sun": ["14:00"]
      }
    }
  ]
}

Rules:
- Only include events with dates in the future (after today's date)
- ticket_url: Look for URLs in [brackets] near each event title. Use the most specific URL for that show — the individual show page or ticket purchase link, NOT the general season page
- Use "show" for performances, "class" for multi-week courses, "workshop" for one-day/weekend sessions
- genre_tags should use lowercase kebab-case, pick from: drama, comedy, improv, sketch, musical, new-work, classic, experimental, interactive, physical-theater, adaptation, social-justice, community, diverse-voices, shakespeare, revue, writing, beginner, intermediate, advanced
- If price is "pay what you can" or "free", set price_min to 0
- Set hottix_available to true only if HotTix or half-price is explicitly mentioned
- show_times: extract the weekly performance schedule using 3-letter lowercase day keys (mon, tue, wed, thu, fri, sat, sun) with times in 24h "HH:MM" format. Only include days that have performances. If the schedule is not listed, set show_times to null
- If no events are found, return {"events": []}
- photo_url: extract the promotional image URL for each show — look for [img: ...] markers near each event. Prefer show posters or production photos over generic venue images. Return null if no image is found for that event
- cast_members: extract performer names and their roles/characters if listed. Return as array of {name, role} objects. If only names are listed without roles, set role to null. Return null if no cast is listed
- Do NOT invent events — only extract what is actually on the page`;
}
