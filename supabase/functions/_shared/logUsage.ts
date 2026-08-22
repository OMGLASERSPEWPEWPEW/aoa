import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Per-1M-token pricing (USD). Keep in sync with ai-gateway MODEL_PRICING.
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-7": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.80, output: 4.0 },
  "gpt-5.5": { input: 5.0, output: 20.0 },
  "gemini-3.1-pro-preview": { input: 2.5, output: 10.0 },
  "deepseek-v4-pro": { input: 1.0, output: 4.0 },
  "claude-sonnet-4-5-20250929": { input: 3.0, output: 15.0 },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash-lite": { input: 0.025, output: 0.1 },
  "gemini-1.5-pro": { input: 1.25, output: 5.0 },
  "deepseek-chat": { input: 0.27, output: 1.1 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
  "deepseek-v4-flash": { input: 0.10, output: 0.40 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? { input: 3.0, output: 15.0 };
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

export interface UsageEntry {
  userId?: string | null;
  model: string;
  provider: string;
  modality?: string;
  feature?: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd?: number;
  metadata?: Record<string, unknown>;
}

export async function logUsage(
  supabase: SupabaseClient,
  entry: UsageEntry,
): Promise<void> {
  const cost = entry.estimatedCostUsd
    ?? estimateCost(entry.model, entry.inputTokens, entry.outputTokens);

  const { error } = await supabase.from("ai_usage").insert({
    user_id: entry.userId ?? null,
    model: entry.model,
    provider: entry.provider,
    modality: entry.modality ?? "text",
    feature: entry.feature ?? null,
    input_tokens: entry.inputTokens,
    output_tokens: entry.outputTokens,
    estimated_cost_usd: cost,
    metadata: entry.metadata ?? {},
  });

  if (error) {
    console.error("[logUsage] Failed to log AI usage:", error.message);
  }
}
