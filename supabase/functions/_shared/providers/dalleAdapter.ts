// _shared/providers/dalleAdapter.ts
// Adapter for OpenAI DALL-E 3 image generation

import type { GatewayImageResponseBody, ImageProviderAdapter } from './types.ts';

// DALL-E 3 pricing per image (USD)
const DALLE_PRICING: Record<string, Record<string, number>> = {
  'dall-e-3': {
    'standard:1024x1024': 0.04,
    'standard:1024x1792': 0.08,
    'standard:1792x1024': 0.08,
    'hd:1024x1024': 0.08,
    'hd:1024x1792': 0.12,
    'hd:1792x1024': 0.12,
  },
};

function estimateImageCost(model: string, size: string, quality: string): number {
  const modelPricing = DALLE_PRICING[model];
  if (!modelPricing) return 0.04;
  return modelPricing[`${quality}:${size}`] ?? 0.04;
}

export const dalleAdapter: ImageProviderAdapter = {
  async generate(apiKey, model, prompt, size, quality) {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size,
        quality,
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg =
        (errorData as Record<string, Record<string, string>>)?.error?.message ??
        response.statusText;
      throw new Error(`DALL-E API error (${response.status}): ${msg}`);
    }

    const data = await response.json();
    const imageData = data.data?.[0]?.b64_json;

    if (!imageData) {
      throw new Error('DALL-E returned no image data');
    }

    return {
      modality: 'image',
      image: imageData,
      revised_prompt: data.data?.[0]?.revised_prompt,
      model,
      provider: 'openai',
      estimatedCostUsd: estimateImageCost(model, size, quality),
    } satisfies GatewayImageResponseBody;
  },
};
