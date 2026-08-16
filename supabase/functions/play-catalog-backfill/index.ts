import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { runPlayMatcherBatch } from "../_shared/scraper/play-matcher.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.batch_size ?? 100, 100);

    const { data: allEvents, error: fetchError } = await supabase
      .from("events")
      .select("id")
      .is("play_id", null)
      .eq("event_type", "show")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch events: ${fetchError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const allIds = (allEvents ?? []).map((e: { id: string }) => e.id);

    if (allIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No unlinked show events", events_processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const totals = {
      events_processed: 0, exact_matches: 0, fuzzy_matches: 0,
      ai_matches: 0, plays_created: 0, events_skipped: 0,
      events_unmatched: 0, ai_input_tokens: 0, ai_output_tokens: 0, duration_ms: 0,
    };

    const BATCH = 50;
    for (let i = 0; i < allIds.length; i += BATCH) {
      const chunk = allIds.slice(i, i + BATCH);
      const summary = await runPlayMatcherBatch(chunk, supabase, `backfill-${Date.now()}-${i}`);
      totals.events_processed += summary.events_processed;
      totals.exact_matches += summary.exact_matches;
      totals.fuzzy_matches += summary.fuzzy_matches;
      totals.ai_matches += summary.ai_matches;
      totals.plays_created += summary.plays_created;
      totals.events_skipped += summary.events_skipped;
      totals.events_unmatched += summary.events_unmatched;
      totals.ai_input_tokens += summary.ai_input_tokens;
      totals.ai_output_tokens += summary.ai_output_tokens;
      totals.duration_ms += summary.duration_ms;
    }

    return new Response(JSON.stringify(totals), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: `Backfill failed: ${msg}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
