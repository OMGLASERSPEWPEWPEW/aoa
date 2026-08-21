import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

type OverridableEntity = "venue" | "school" | "class_session" | "event";

interface SuggestionEvidence {
  events_found?: number;
  events_found_current?: number;
  confidence?: number;
  source_url?: string;
}

export async function heldFields(
  sb: SupabaseClient,
  entityType: OverridableEntity,
  entityId: string,
): Promise<Set<string>> {
  const { data } = await sb
    .from("field_overrides")
    .select("field_name")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  const fields = new Set<string>();
  for (const row of data ?? []) {
    fields.add(row.field_name);
  }
  return fields;
}

export function filterWritable<T extends Record<string, unknown>>(
  extracted: T,
  held: Set<string>,
): { writable: Partial<T>; blocked: Partial<T> } {
  const writable: Partial<T> = {};
  const blocked: Partial<T> = {};
  for (const [field, value] of Object.entries(extracted)) {
    if (held.has(field)) {
      (blocked as Record<string, unknown>)[field] = value;
    } else {
      (writable as Record<string, unknown>)[field] = value;
    }
  }
  return { writable, blocked };
}

export async function fileSuggestion(
  sb: SupabaseClient,
  s: {
    entityType: OverridableEntity;
    entityId: string;
    field: string;
    value: unknown;
    evidence?: SuggestionEvidence;
  },
): Promise<void> {
  const { data: existing } = await sb
    .from("curator_suggestions")
    .select("id, times_suggested")
    .eq("entity_type", s.entityType)
    .eq("entity_id", s.entityId)
    .eq("field_name", s.field)
    .maybeSingle();

  if (existing) {
    await sb
      .from("curator_suggestions")
      .update({
        suggested_value: JSON.stringify(s.value),
        evidence: s.evidence ? JSON.stringify(s.evidence) : null,
        times_suggested: existing.times_suggested + 1,
        last_seen_at: new Date().toISOString(),
        status: "open",
      })
      .eq("id", existing.id);
  } else {
    await sb.from("curator_suggestions").insert({
      entity_type: s.entityType,
      entity_id: s.entityId,
      field_name: s.field,
      suggested_value: JSON.stringify(s.value),
      evidence: s.evidence ? JSON.stringify(s.evidence) : null,
    });
  }
}

export async function guardedUpdate(
  sb: SupabaseClient,
  entityType: OverridableEntity,
  entityId: string,
  extracted: Record<string, unknown>,
  evidence?: SuggestionEvidence,
): Promise<{ written: string[]; parked: string[] }> {
  const held = await heldFields(sb, entityType, entityId);
  const { writable, blocked } = filterWritable(extracted, held);

  const tableName = entityType === "class_session"
    ? "class_sessions"
    : entityType === "event"
    ? "events"
    : entityType === "school"
    ? "schools"
    : "venues";

  if (Object.keys(writable).length > 0) {
    await sb.from(tableName).update(writable).eq("id", entityId);
  }

  const parked: string[] = [];
  for (const [field, value] of Object.entries(blocked)) {
    await fileSuggestion(sb, {
      entityType,
      entityId,
      field,
      value,
      evidence,
    });
    parked.push(field);
  }

  return {
    written: Object.keys(writable),
    parked,
  };
}
