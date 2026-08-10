import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface DedupStats {
  newCount: number;
  matchedCount: number;
  pendingCount: number;
}

function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}

function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\broad\b/g, "rd")
    .replace(/\bplace\b/g, "pl")
    .replace(/\bcourt\b/g, "ct")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStreetKey(addr: string): string | null {
  const normalized = normalizeAddress(addr);
  const match = normalized.match(/^(\d+\s+\S+(?:\s+\S+)?)/);
  return match ? match[1] : null;
}

export async function deduplicateQueue(
  supabase: SupabaseClient,
  runId: string,
): Promise<DedupStats> {
  const stats: DedupStats = { newCount: 0, matchedCount: 0, pendingCount: 0 };

  const { data: pending } = await supabase
    .from("venue_discovery_queue")
    .select("id, raw_name, raw_address, raw_website_url")
    .eq("run_id", runId)
    .eq("dedup_status", "pending");

  if (!pending || pending.length === 0) return stats;

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, address, website_url");

  if (!venues) return stats;

  for (const row of pending) {
    let matchedId: string | null = null;

    // Signal 1: Exact website URL match
    if (row.raw_website_url && !matchedId) {
      const normCandidate = normalizeUrl(row.raw_website_url);
      for (const v of venues) {
        if (v.website_url && normalizeUrl(v.website_url) === normCandidate) {
          matchedId = v.id;
          break;
        }
      }
    }

    // Signal 2: Address match
    if (row.raw_address && !matchedId) {
      const candidateKey = extractStreetKey(row.raw_address);
      if (candidateKey) {
        for (const v of venues) {
          if (v.address) {
            const venueKey = extractStreetKey(v.address);
            if (venueKey && venueKey === candidateKey) {
              matchedId = v.id;
              break;
            }
          }
        }
      }
    }

    // Signal 3: Trigram name similarity
    if (!matchedId) {
      const { data: trigramResults } = await supabase.rpc("match_venue_by_name", {
        candidate: row.raw_name,
      });

      if (trigramResults && trigramResults.length > 0) {
        const best = trigramResults[0];
        if (best.similarity > 0.85) {
          matchedId = best.id;
        } else if (best.similarity > 0.70) {
          // Ambiguous — leave as pending for admin review
          stats.pendingCount++;
          continue;
        }
      }
    }

    if (matchedId) {
      await supabase
        .from("venue_discovery_queue")
        .update({ dedup_status: "matched", matched_venue_id: matchedId })
        .eq("id", row.id);
      stats.matchedCount++;
    } else {
      await supabase
        .from("venue_discovery_queue")
        .update({ dedup_status: "new" })
        .eq("id", row.id);
      stats.newCount++;
    }
  }

  return stats;
}
