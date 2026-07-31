import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const ALLOWED_ORIGINS = [
  "http://localhost:5204",
  "https://aoa-nine.vercel.app",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Vary": "Origin",
  };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const BELT_NAMES: Record<number, string> = {
  0: "White", 1: "Yellow", 2: "Orange", 3: "Green",
  4: "Blue", 5: "Purple", 6: "Brown", 7: "Black",
};

interface BeltCriteria {
  showsSeen: number;
  venuesVisited: number;
  reviewsWritten: number;
  learningModules: number;
  genresExplored: number;
  openingNights: number;
  friendsInvited: number;
  usheringCount: number;
  hasReflection: boolean;
}

function meetsRequirement(level: number, c: BeltCriteria): boolean {
  switch (level) {
    case 1: return c.showsSeen >= 1 && (c.reviewsWritten >= 1 || c.hasReflection);
    case 2: return c.showsSeen >= 3 && c.venuesVisited >= 2 && c.learningModules >= 3;
    case 3: return c.showsSeen >= 6 && c.venuesVisited >= 3 && c.reviewsWritten >= 3;
    case 4: return c.showsSeen >= 12 && c.genresExplored >= 2 && c.openingNights >= 1;
    case 5: return c.friendsInvited >= 2 && c.reviewsWritten >= 5 && c.usheringCount >= 1;
    case 6: return c.showsSeen >= 25 && c.venuesVisited >= 3 && c.learningModules >= 5;
    case 7: return c.showsSeen >= 50;
    default: return false;
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const [profileRes, progressRes, watchlistRes] = await Promise.all([
    adminClient.from("profiles").select("*").eq("id", user.id).single(),
    adminClient.from("user_progress").select("*").eq("user_id", user.id).single(),
    adminClient.from("watchlist").select("event_id, status, reflection, events(venue_id)").eq("user_id", user.id),
  ]);

  const profile = profileRes.data;
  const progress = progressRes.data;

  if (!profile || !progress) {
    return new Response(JSON.stringify({ advanced: false }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const currentBelt = profile.belt_level ?? 0;
  if (currentBelt >= 7) {
    return new Response(JSON.stringify({ advanced: false }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const seenItems = (watchlistRes.data ?? []).filter((w: Record<string, unknown>) => w.status === "seen");
  const uniqueVenues = new Set(seenItems.map((w: Record<string, unknown>) => (w.events as Record<string, unknown>)?.venue_id).filter(Boolean));
  const hasReflection = seenItems.some((w: Record<string, unknown>) => w.reflection && (w.reflection as string).trim().length > 0);

  const criteria: BeltCriteria = {
    showsSeen: profile.shows_seen_count ?? 0,
    venuesVisited: uniqueVenues.size,
    reviewsWritten: profile.reviews_written_count ?? 0,
    learningModules: (progress.learning_modules_completed ?? []).length,
    genresExplored: (progress.genres_explored ?? []).length,
    openingNights: progress.opening_nights_attended ?? 0,
    friendsInvited: progress.friends_invited ?? 0,
    usheringCount: progress.ushering_count ?? 0,
    hasReflection,
  };

  const nextBelt = currentBelt + 1;
  if (!meetsRequirement(nextBelt, criteria)) {
    return new Response(JSON.stringify({ advanced: false }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const beltHistory = progress.belt_history ?? [];
  beltHistory.push({ belt: nextBelt, earned_at: new Date().toISOString() });

  await Promise.all([
    adminClient.from("profiles").update({ belt_level: nextBelt }).eq("id", user.id),
    adminClient.from("user_progress").update({
      belt_history: beltHistory,
      venues_visited: [...uniqueVenues],
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id),
  ]);

  return new Response(JSON.stringify({
    advanced: true,
    newBeltLevel: nextBelt,
    beltName: BELT_NAMES[nextBelt],
  }), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
});
