export function buildTargetedExtractionPrompt(
  venueName: string,
  incompleteEvents: Array<{ title: string; missingFields: string[] }>,
): string {
  const eventList = incompleteEvents
    .map(e => `- "${e.title}" — MISSING: ${e.missingFields.join(", ")}`)
    .join("\n");

  return `You are extracting SPECIFIC missing data for known events at "${venueName}".

We already identified these events but are missing data for them:
${eventList}

From the webpage text below, find ONLY the missing data for these specific events.
Do NOT discover new events. Only fill in what's missing.

Return valid JSON:
{
  "enrichments": [
    {
      "title": "exact title from above",
      "start_date": "YYYY-MM-DD or null if not found on this page",
      "end_date": "YYYY-MM-DD or null",
      "price_min": number or null,
      "price_max": number or null,
      "ticket_url": "https://... or null",
      "show_times": { "thu": ["19:30"], "fri": ["19:30", "22:00"] } or null
    }
  ]
}

RULES:
- Only return data you actually find on the page — never guess or hallucinate
- If a field is not on this page, set it to null
- If an event from the list above is not mentioned on this page, omit it entirely from enrichments
- Prices: null if not listed, 0 only if explicitly "free" or "$0"
- Dates: YYYY-MM-DD format, future dates only (after today)
- show_times: 3-letter lowercase day keys (mon-sun), 24h "HH:MM" format
- If no relevant data is found for any event, return {"enrichments": []}`;
}
