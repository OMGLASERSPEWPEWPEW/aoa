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
    const batchSize = Math.min(body.batch_size ?? 100, 200);

    const { data: events, error: fetchError } = await supabase
      .from("events")
      .select("id")
      .is("play_id", null)
      .eq("event_type", "show")
      .order("created_at", { ascending: false })
      .limit(batchSize);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch events: ${fetchError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const eventIds = (events ?? []).map((e: { id: string }) => e.id);

    if (eventIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No unlinked show events", events_processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const summary = await runPlayMatcherBatch(eventIds, supabase, `backfill-${Date.now()}`);

    return new Response(JSON.stringify(summary), {
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
