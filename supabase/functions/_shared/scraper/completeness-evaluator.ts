import type { Pass1Event, EventCompleteness, CandidateLink, TargetedEnrichment, Program, Section } from "./types.ts";

export const DEFAULT_FIELD_WEIGHTS: Record<string, number> = {
  start_date: 40,
  end_date: 10,
  price: 15,
  ticket_url: 10,
  show_times: 10,
};

export const CLASS_FIELD_WEIGHTS: Record<string, number> = {
  start_date: 30,
  end_date: 10,
  price: 15,
  ticket_url: 10,
  show_times: 5,
  instructor_name: 15,
  skill_level: 10,
};

const NEEDS_FOLLOW_THRESHOLD = 50;

export function evaluateCompleteness(
  event: Pass1Event,
  index: number,
  weights?: Record<string, number>,
): EventCompleteness {
  const w = weights ?? DEFAULT_FIELD_WEIGHTS;
  let score = 0;
  const missingFields: string[] = [];
  let maxScore = 0;

  for (const [field, weight] of Object.entries(w)) {
    maxScore += weight;
    const value = field === "price"
      ? (event.price_min != null || event.price_max != null)
      : !!(event as Record<string, unknown>)[field];

    if (value) score += weight;
    else missingFields.push(field === "price" ? "price_min" : field);
  }

  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 100;

  return {
    eventIndex: index,
    title: event.title,
    score,
    missingFields,
    needsFollow: pct < NEEDS_FOLLOW_THRESHOLD,
  };
}

export function shouldFollowLinks(
  events: Pass1Event[],
  candidateLinks: CandidateLink[],
  weights?: Record<string, number>,
): { shouldFollow: boolean; reason: string; incompleteEvents: EventCompleteness[] } {
  const completeness = events.map((e, i) => evaluateCompleteness(e, i, weights));
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
    if (!event.instructor_name && enrichment.instructor_name) {
      event.instructor_name = enrichment.instructor_name;
      fieldsFilledIn.push("instructor_name");
    }
    if (!event.skill_level && enrichment.skill_level) {
      event.skill_level = enrichment.skill_level;
      fieldsFilledIn.push("skill_level");
    }
    if (event.session_count == null && enrichment.session_count != null) {
      event.session_count = enrichment.session_count;
      fieldsFilledIn.push("session_count");
    }
    if (!event.class_format && enrichment.class_format) {
      event.class_format = enrichment.class_format;
      fieldsFilledIn.push("class_format");
    }
  }

  return { events: updated, fieldsFilledIn };
}

export function averageCompleteness(events: Pass1Event[], weights?: Record<string, number>): number {
  if (events.length === 0) return 0;
  const total = events.reduce((sum, e, i) => sum + evaluateCompleteness(e, i, weights).score, 0);
  return Math.round(total / events.length);
}

export const CLASS_SECTION_WEIGHTS: Record<string, number> = {
  start_date: 25,
  schedule: 20,
  price: 15,
  instructor_name: 15,
  register_url: 5,
  status: 5,
};

export function evaluateSectionCompleteness(section: Section, program: Program): number {
  let score = 0;
  const max = 85;
  if (section.start_date) score += 25;
  if (section.schedule || (section.day_of_week && section.start_time)) score += 20;
  if (program.price_min != null || program.price_max != null) score += 15;
  if (section.instructor_name) score += 15;
  if (section.register_url || program.register_url) score += 5;
  if (section.status && section.status !== "unknown") score += 5;
  return Math.round((score / max) * 100);
}

export function averageProgramCompleteness(programs: Program[]): number {
  if (programs.length === 0) return 0;
  let totalScore = 0;
  let totalSections = 0;

  for (const p of programs) {
    if (p.sections.length === 0) {
      totalScore += 15;
      totalSections++;
    } else {
      for (const s of p.sections) {
        totalScore += evaluateSectionCompleteness(s, p);
        totalSections++;
      }
    }
  }

  return totalSections > 0 ? Math.round(totalScore / totalSections) : 0;
}
