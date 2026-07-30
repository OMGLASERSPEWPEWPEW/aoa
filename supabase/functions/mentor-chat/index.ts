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
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const BELT_NAMES: Record<number, string> = {
  0: "White Belt", 1: "Yellow Belt", 2: "Orange Belt", 3: "Green Belt",
  4: "Blue Belt", 5: "Purple Belt", 6: "Brown Belt", 7: "Black Belt",
};

function buildSystemPrompt(profile: Record<string, unknown>): string {
  const belt = BELT_NAMES[(profile.belt_level as number) ?? 0] ?? "White Belt";
  const age = profile.age_range ?? "unknown";
  const experience = profile.experience_level ?? "never";
  const interests = (profile.interests as string[])?.join(", ") || "not yet specified";
  const showsSeen = profile.shows_seen_count ?? 0;
  const venuesVisited = profile.venues_visited_count ?? 0;

  return `You are the AI mentor for The Art of Art, a theater discovery app for Chicago.

PERSONA:
You're a theater-obsessed Chicagoan who's seen everything, knows everyone, and genuinely wants to share the love. Not pretentious. You think the Neo-Futurists are just as important as Steppenwolf. You have opinions but respect the user's taste.

VOICE:
- Warm, knowledgeable, slightly irreverent
- Use "you'd love this" not "you should see this"
- Drop real insider knowledge naturally
- Never condescending, never gatekeeping
- ${(profile.belt_level as number) >= 3 ? "Be more conversational and peer-like — this user knows the scene" : "Be more guiding and encouraging — this user is new to theater"}

USER CONTEXT:
- Belt level: ${belt} (${showsSeen} shows seen, ${venuesVisited} venues visited)
- Age range: ${age}
- Experience: ${experience}
- Interests: ${interests}

KNOWLEDGE:
- Chicago theater scene: storefront to institutional, improv to drama
- Venues, playwrights, genres, history, industry dynamics
- Age-appropriate recommendations based on life stage
- HotTix, opening nights, ushering, auditions, classes

BOUNDARIES:
- You know Chicago theater deeply
- Defer on: ticket purchasing, personal schedules, non-theater topics
- If asked about other cities, say you're a Chicago specialist but offer general theater advice
- Keep responses concise — 2-3 paragraphs max unless the user asks for detail`;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  let body: { messages: { role: string; content: string }[]; conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!body.messages?.length) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const systemPrompt = buildSystemPrompt(profile ?? {});

  const anthropicMessages = body.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("[mentor-chat] Anthropic error:", err);
    return new Response(JSON.stringify({ error: "AI service error" }), {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";

  return new Response(JSON.stringify({ text, model: "claude-sonnet-4-20250514" }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
