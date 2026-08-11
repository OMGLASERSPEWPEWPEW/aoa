import type { Pass1Event } from "./types.ts";

export function buildVerificationPrompt(venueName: string, events: Pass1Event[]): string {
  return `You are a theater event data verifier and enrichment engine for "${venueName}" in Chicago.

You received ${events.length} event(s) extracted from this venue's calendar page. Your job:
1. VERIFY each event is plausible and correctly attributed
2. ENRICH with description, genre tags, and cast
3. SCORE your confidence in the extraction quality

Input events:
${JSON.stringify(events, null, 2)}

Return valid JSON with this structure:
{
  "events": [
    {
      "title": "Show Title",
      "status": "verified",
      "rejection_reason": null,
      "confidence": 0.95,
      "description": "1-2 sentence description of the show/event",
      "genre_tags": ["drama", "comedy"],
      "cast_members": [{"name": "Actor Name", "role": "Character Name or null"}],
      "photo_url": null,
      "corrections": {
        "price_min": null,
        "price_max": null,
        "start_date": null,
        "end_date": null,
        "event_type": null
      }
    }
  ]
}

STATUS VALUES:
- "verified": event looks correct, no changes needed. Set corrections fields to null.
- "corrected": event is real but a field was wrong. Put corrected values in corrections (null = no correction for that field).
- "rejected": event should be excluded. Set rejection_reason.

REJECTION CRITERIA:
- Event is clearly at a different venue (not "${venueName}")
- Event is a duplicate of another event in the list (same show, different formatting)
- Event title is nonsensical or a parsing artifact (navigation text, footer text, button labels)
- Event has a start_date in the past

CONFIDENCE SCORING (0.0 to 1.0):
- 0.9-1.0: Title, dates, and prices all look correct and consistent
- 0.7-0.89: Most fields look right but one is uncertain
- 0.5-0.69: Multiple uncertain fields
- Below 0.5: Likely bad extraction — set status to "rejected"

PRICE VERIFICATION:
- If price_min is 0 but "${venueName}" is known for paid shows, correct price_min to null
- If price seems unreasonably high (>$500) or negative, correct to null
- Do NOT invent prices — if you cannot verify, correct to null

DATE VERIFICATION:
- If end_date minus start_date is more than 180 days, this is likely a season listing — correct end_date to null
- If start_date is null, leave it (the event exists but dates are TBD)

ENRICHMENT:
- description: Write a brief 1-2 sentence description. If you know the show, describe it accurately. If unsure, write a generic but truthful description based on the title and venue type.
- genre_tags: lowercase kebab-case from: drama, comedy, improv, sketch, musical, new-work, classic, experimental, interactive, physical-theater, adaptation, social-justice, community, diverse-voices, shakespeare, revue, writing, beginner, intermediate, advanced
- cast_members: Only include if you genuinely know the cast from your training data. Do NOT hallucinate names. Set to null if unsure.
- photo_url: Always set to null (photos come from HTML extraction, not enrichment)

Return events in the SAME ORDER as the input. If no events survive verification, return {"events": []}`;
}
