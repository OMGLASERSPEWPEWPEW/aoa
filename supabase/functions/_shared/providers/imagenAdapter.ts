// _shared/providers/imagenAdapter.ts
// Adapter for Google Imagen 4 image generation via Gemini API
//
// Uses the Gemini REST API for image generation:
// POST https://generativelanguage.googleapis.com/v1beta/models/{model}:predict
// Auth: x-goog-api-key header

import type { GatewayImageResponseBody, ImageProviderAdapter } from './types.ts';

// Model ID mapping: short name -> full Gemini model ID
const MODEL_IDS: Record<string, string> = {
  'imagen-4-fast': 'imagen-4.0-fast-generate-001',
  'imagen-4': 'imagen-4.0-generate-001',
  'imagen-4-ultra': 'imagen-4.0-ultra-generate-001',
};

// Imagen pricing per image (USD)
const IMAGEN_PRICING: Record<string, number> = {
  'imagen-4-fast': 0.02,
  'imagen-4': 0.04,
  'imagen-4-ultra': 0.06,
};

function estimateImageCost(model: string): number {
  return IMAGEN_PRICING[model] ?? 0.04;
}

export const imagenAdapter: ImageProviderAdapter = {
  async generate(apiKey, model, prompt, size, _quality) {
    const aspectRatio = sizeToAspectRatio(size);
    const fullModelId = MODEL_IDS[model] ?? model;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${fullModelId}:predict`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg =
        (errorData as Record<string, Record<string, string>>)?.error?.message ??
        response.statusText;
      throw new Error(`Imagen API error (${response.status}): ${msg}`);
    }

    const data = await response.json();
    const imageData = data.predictions?.[0]?.bytesBase64Encoded;

    if (!imageData) {
      throw new Error('Imagen returned no image data');
    }

    return {
      modality: 'image',
      image: imageData,
      model,
      provider: 'gemini',
      estimatedCostUsd: estimateImageCost(model),
    } satisfies GatewayImageResponseBody;
  },
};

/** Convert a size string like "1024x1024" to an Imagen aspect ratio. */
function sizeToAspectRatio(size: string): string {
  const mapping: Record<string, string> = {
    '1024x1024': '1:1',
    '1792x1024': '16:9',
    '1024x1792': '9:16',
    '1536x1024': '3:2',
    '1024x1536': '2:3',
  };
  return mapping[size] ?? '1:1';
}
