import type { Pass1Event, EventCompleteness, CandidateLink, TargetedEnrichment } from "./types.ts";

const FIELD_WEIGHTS: Record<string, number> = {
  start_date: 40,
  end_date: 10,
  price: 15,
  ticket_url: 10,
  show_times: 10,
};

export function evaluateCompleteness(event: Pass1Event, index: number): EventCompleteness {
  let score = 0;
  const missingFields: string[] = [];

  if (event.start_date) score += FIELD_WEIGHTS.start_date;
  else missingFields.push("start_date");

  if (event.end_date) score += FIELD_WEIGHTS.end_date;
  else missingFields.push("end_date");

  if (event.price_min != null || event.price_max != null) score += FIELD_WEIGHTS.price;
  else missingFields.push("price_min");

  if (event.ticket_url) score += FIELD_WEIGHTS.ticket_url;
  else missingFields.push("ticket_url");

  if (event.show_times) score += FIELD_WEIGHTS.show_times;
  else missingFields.push("show_times");

  return {
    eventIndex: index,
    title: event.title,
    score,
    missingFields,
    needsFollow: !event.start_date,
  };
}

export function shouldFollowLinks(
  events: Pass1Event[],
  candidateLinks: CandidateLink[],
): { shouldFollow: boolean; reason: string; incompleteEvents: EventCompleteness[] } {
  const completeness = events.map((e, i) => evaluateCompleteness(e, i));
  const needFollow = completeness.filter(c => c.needsFollow);

  if (needFollow.length === 0) {
    return { shouldFollow: false, reason: "all events have start_date", incompleteEvents: [] };
  }

  if (candidateLinks.length === 0) {
    return { shouldFollow: false, reason: "no candidate links to follow", incompleteEvents: needFollow };
  }

  return {
    shouldFollow: true,
    reason: `${needFollow.length}/${events.length} events missing start_date`,
    incompleteEvents: needFollow,
  };
}

export function mergeTargetedExtraction(
  existingEvents: Pass1Event[],
  enrichments: TargetedEnrichment[],
): { events: Pass1Event[]; fieldsFilledIn: string[] } {
  const fieldsFilledIn: string[] = [];
  const updated = [...existingEvents];

  for (const enrichment of enrichments) {
    const lowerTitle = enrichment.title.toLowerCase();
    const idx = updated.findIndex(e =>
      e.title.toLowerCase() === lowerTitle ||
      e.title.toLowerCase().includes(lowerTitle) ||
      lowerTitle.includes(e.title.toLowerCase()),
    );
    if (idx === -1) continue;

    const event = updated[idx];

    if (!event.start_date && enrichment.start_date) {
      event.start_date = enrichment.start_date;
      fieldsFilledIn.push("start_date");
    }
    if (!event.end_date && enrichment.end_date) {
      event.end_date = enrichment.end_date;
      fieldsFilledIn.push("end_date");
    }
    if (event.price_min == null && enrichment.price_min != null) {
      event.price_min = enrichment.price_min;
      fieldsFilledIn.push("price_min");
    }
    if (event.price_max == null && enrichment.price_max != null) {
      event.price_max = enrichment.price_max;
      fieldsFilledIn.push("price_max");
    }
    if (!event.ticket_url && enrichment.ticket_url) {
      event.ticket_url = enrichment.ticket_url;
      fieldsFilledIn.push("ticket_url");
    }
    if (!event.show_times && enrichment.show_times) {
      event.show_times = enrichment.show_times;
      fieldsFilledIn.push("show_times");
    }
  }

  return { events: updated, fieldsFilledIn };
}

export function averageCompleteness(events: Pass1Event[]): number {
  if (events.length === 0) return 0;
  const total = events.reduce((sum, e, i) => sum + evaluateCompleteness(e, i).score, 0);
  return Math.round(total / events.length);
}
