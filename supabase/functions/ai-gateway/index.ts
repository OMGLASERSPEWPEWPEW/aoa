// supabase/functions/ai-gateway/index.ts
// Multi-provider, multi-modality AI gateway Edge Function.
// Routes text, image, and video requests to the appropriate provider.
// Handles JWT auth and CORS. Add your own billing/analytics hooks.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type {
  Provider,
  Modality,
  GatewayTextRequestBody,
  GatewayTextResponseBody,
  GatewayImageRequestBody,
  GatewayImageResponseBody,
  GatewayVideoRequestBody,
  GatewayVideoResponseBody,
  AnyGatewayResponse,
  ProviderAdapter,
} from "../_shared/providers/types.ts";
import { PROVIDER_KEY_ENV } from "../_shared/providers/types.ts";
import { anthropicAdapter } from "../_shared/providers/anthropicAdapter.ts";
import { openaiAdapter } from "../_shared/providers/openaiCompatAdapter.ts";
import { geminiAdapter } from "../_shared/providers/geminiAdapter.ts";
import { deepseekAdapter } from "../_shared/providers/deepseekAdapter.ts";
import { dalleAdapter } from "../_shared/providers/dalleAdapter.ts";
import { imagenAdapter } from "../_shared/providers/imagenAdapter.ts";
import { soraAdapter } from "../_shared/providers/soraAdapter.ts";
import { logUsage } from "../_shared/logUsage.ts";

// ---------------------------------------------------------------------------
// Provider adapters (each provider has its own dedicated adapter)
// ---------------------------------------------------------------------------

const textAdapters: Record<Provider, ProviderAdapter> = {
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
  gemini: geminiAdapter,
  deepseek: deepseekAdapter,
};

const imageAdapters = {
  openai: dalleAdapter,
  gemini: imagenAdapter,
};

const videoAdapters = {
  openai: soraAdapter,
};

// ---------------------------------------------------------------------------
// Inference cost estimation (text models)
// ---------------------------------------------------------------------------

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // New models — PLACEHOLDER pricing, verify before production use
  "claude-opus-4-7": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.80, output: 4.0 },
  "gpt-5.5": { input: 5.0, output: 20.0 },
  "gemini-3.1-pro-preview": { input: 2.5, output: 10.0 },
  "deepseek-v4-pro": { input: 1.0, output: 4.0 },
  // Existing models
  "claude-sonnet-4-5-20250929": { input: 3.0, output: 15.0 },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash-lite": { input: 0.025, output: 0.1 },
  "gemini-1.5-pro": { input: 1.25, output: 5.0 },
  "deepseek-chat": { input: 0.27, output: 1.1 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
};

function estimateTextCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? { input: 3.0, output: 15.0 };
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const VALID_PROVIDERS: Provider[] = ["anthropic", "openai", "gemini", "deepseek"];
const VALID_MODALITIES: Modality[] = ["text", "image", "video"];

function jsonError(message: string, status: number, cors: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: { message } }),
    { status, headers: { ...cors, "Content-Type": "application/json" } },
  );
}

function statusFromError(msg: string): number {
  if (msg.includes("(429)")) return 429;
  if (msg.includes("(401)") || msg.includes("(403)")) return 401;
  if (msg.includes("(400)")) return 400;
  return 502;
}

// ---------------------------------------------------------------------------
// Modality handlers
// ---------------------------------------------------------------------------

async function handleText(
  body: GatewayTextRequestBody,
  apiKey: string,
): Promise<GatewayTextResponseBody> {
  const { provider, model, messages, system, maxTokens, temperature } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw Object.assign(new Error("messages array is required and must not be empty"), { status: 400 });
  }
  if (!maxTokens || typeof maxTokens !== "number") {
    throw Object.assign(new Error("maxTokens is required and must be a number"), { status: 400 });
  }

  const adapter = textAdapters[provider];
  console.log(`[ai-gateway] text -> ${provider} (model: ${model})`);
  return await adapter.call(apiKey, model, messages, system, maxTokens, temperature);
}

async function handleImage(
  body: GatewayImageRequestBody,
  apiKey: string,
): Promise<GatewayImageResponseBody> {
  const { provider, model, prompt, size = "1024x1024", quality = "standard" } = body;

  if (!prompt) {
    throw Object.assign(new Error("prompt is required for image generation"), { status: 400 });
  }

  const adapter = imageAdapters[provider as keyof typeof imageAdapters];
  if (!adapter) {
    throw Object.assign(
      new Error(`Image generation not supported for provider: ${provider}. Use 'openai' or 'gemini'.`),
      { status: 400 },
    );
  }

  console.log(`[ai-gateway] image -> ${provider} (model: ${model}, size: ${size})`);
  return await adapter.generate(apiKey, model, prompt, size, quality);
}

async function handleVideo(
  body: GatewayVideoRequestBody,
  apiKey: string,
): Promise<GatewayVideoResponseBody> {
  const {
    provider, model, prompt,
    duration = 4, resolution = "720x1280",
    referenceImage, referenceImageType,
  } = body;

  if (!prompt) {
    throw Object.assign(new Error("prompt is required for video generation"), { status: 400 });
  }
  if (prompt.length > 1000) {
    throw Object.assign(new Error("prompt too long (max 1000 characters)"), { status: 400 });
  }

  const adapter = videoAdapters[provider as keyof typeof videoAdapters];
  if (!adapter) {
    throw Object.assign(
      new Error(`Video generation not supported for provider: ${provider}. Use 'openai'.`),
      { status: 400 },
    );
  }

  console.log(`[ai-gateway] video -> ${provider} (model: ${model}, ${duration}s, ${resolution})`);
  return await adapter.generate(apiKey, model, prompt, duration, resolution, referenceImage, referenceImageType);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405, cors);
  }

  // -- JWT authentication ---------------------------------------------------
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonError("Authentication required", 401, cors);

  const token = authHeader.replace("Bearer ", "");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[ai-gateway] Missing Supabase configuration");
    return jsonError("Server configuration error", 500, cors);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    console.error("[ai-gateway] JWT failed:", authError?.message ?? "No user");
    return jsonError("Invalid or expired authentication token", 401, cors);
  }

  console.log(`[ai-gateway] Authenticated: ${user.id}`);

  // -- Parse request --------------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400, cors);
  }

  const modality: Modality = (body.modality as Modality) || "text";
  const provider = body.provider as Provider;
  const model = body.model as string;
  const feature = (body.feature as string) || undefined;

  if (!VALID_MODALITIES.includes(modality)) {
    return jsonError(`Invalid modality. Must be one of: ${VALID_MODALITIES.join(", ")}`, 400, cors);
  }
  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    return jsonError(`Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}`, 400, cors);
  }
  if (!model) {
    return jsonError("model is required", 400, cors);
  }

  // -- API key lookup -------------------------------------------------------
  const envVar = PROVIDER_KEY_ENV[provider];
  const apiKey = Deno.env.get(envVar);

  if (!apiKey) {
    console.error(`[ai-gateway] Missing API key: ${envVar}`);
    return jsonError(`Server configuration error: ${provider} API key not configured`, 500, cors);
  }

  // -- HOOK: Pre-request billing check (add your own logic here) ------------
  // Example: check user credits, subscription status, rate limits, etc.

  // -- Route to modality handler --------------------------------------------
  let result: AnyGatewayResponse;

  try {
    switch (modality) {
      case "text":
        result = await handleText(body as unknown as GatewayTextRequestBody, apiKey);
        break;
      case "image":
        result = await handleImage(body as unknown as GatewayImageRequestBody, apiKey);
        break;
      case "video":
        result = await handleVideo(body as unknown as GatewayVideoRequestBody, apiKey);
        break;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ai-gateway] ${modality} error (${provider}):`, errorMessage);
    const status = (error as { status?: number }).status ?? statusFromError(errorMessage);
    return jsonError(errorMessage, status, cors);
  }

  // -- Post-response: log usage to ai_usage table --------------------------
  try {
    if (modality === "text") {
      const textResult = result as GatewayTextResponseBody;
      await logUsage(supabase, {
        userId: user.id,
        model,
        provider,
        modality: "text",
        feature,
        inputTokens: textResult.usage?.inputTokens ?? 0,
        outputTokens: textResult.usage?.outputTokens ?? 0,
      });
    } else {
      const genResult = result as GatewayImageResponseBody | GatewayVideoResponseBody;
      await logUsage(supabase, {
        userId: user.id,
        model,
        provider,
        modality,
        feature,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: genResult.estimatedCostUsd ?? 0,
      });
    }
  } catch (e) {
    console.error("[ai-gateway] Usage logging failed:", e);
  }

  // -- Return normalized response -------------------------------------------
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
