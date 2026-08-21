/**
 * Curator blocklist helpers for Edge Functions.
 *
 * These run with a service-role Supabase client (RLS bypassed)
 * so they can read blocked_sources directly.
 *
 * normalizeDomain() mirrors the SQL normalize_domain() byte-for-byte.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

/**
 * Normalize a URL to its bare domain, matching the SQL normalize_domain() exactly.
 * Returns null for empty/invalid input.
 */
export function normalizeDomain(url: string | null | undefined): string | null {
  if (url == null) return null;

  let s = url.trim();
  if (s === "") return null;

  // Strip scheme
  s = s.replace(/^https?:\/\//i, "");

  if (s === "" || s === "/") return null;

  // Strip path, query, fragment
  const slashIdx = s.indexOf("/");
  if (slashIdx > 0) s = s.substring(0, slashIdx);

  // Strip port
  const colonIdx = s.indexOf(":");
  if (colonIdx > 0) s = s.substring(0, colonIdx);

  // Lowercase
  s = s.toLowerCase();

  // Strip leading www.
  if (s.startsWith("www.")) s = s.substring(4);

  if (s === "") return null;
  return s;
}

/**
 * Check whether a URL's domain is blocked (scope='domain') in blocked_sources.
 * Returns true if the domain is on the admin blocklist.
 */
export async function isBlockedDomain(
  sb: SupabaseClient,
  url: string | null | undefined,
): Promise<boolean> {
  const domain = normalizeDomain(url);
  if (!domain) return false;

  const { data } = await sb
    .from("blocked_sources")
    .select("id")
    .eq("scope", "domain")
    .eq("domain", domain)
    .limit(1)
    .maybeSingle();

  return data !== null;
}

/**
 * Get the set of entity IDs blocked with scope='entry' for a given entity type.
 * Useful for excluding specific venues/schools from curation target queries.
 */
export async function blockedEntityIds(
  sb: SupabaseClient,
  entityType: "venue" | "school",
): Promise<Set<string>> {
  const { data } = await sb
    .from("blocked_sources")
    .select("entity_id")
    .eq("scope", "entry")
    .eq("entity_type", entityType)
    .not("entity_id", "is", null);

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.entity_id) ids.add(row.entity_id);
  }
  return ids;
}

/**
 * Combined check: is a specific entity blocked by either entry-scope or domain-scope?
 * Use this when you have both an entity ID and a URL.
 */
export async function isEntityBlocked(
  sb: SupabaseClient,
  entityType: "venue" | "school",
  entityId: string,
  url: string | null | undefined,
): Promise<boolean> {
  // Entry-scope check
  const { data: entryBlock } = await sb
    .from("blocked_sources")
    .select("id")
    .eq("scope", "entry")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .limit(1)
    .maybeSingle();

  if (entryBlock) return true;

  // Domain-scope check
  return await isBlockedDomain(sb, url);
}
