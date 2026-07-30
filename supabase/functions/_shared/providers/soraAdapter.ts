// _shared/providers/soraAdapter.ts
// Adapter for OpenAI Sora video generation
// Uses async workflow: create -> poll -> download
//
// API: POST https://api.openai.com/v1/videos
// Supported sizes: 720x1280, 1280x720, 1024x1792, 1792x1024
// Supported durations: 4, 8, 12 (as string)

import type { GatewayVideoResponseBody, VideoProviderAdapter } from './types.ts';

const SORA_API_BASE = 'https://api.openai.com/v1/videos';

// Sora pricing per second (USD)
const SORA_PRICING: Record<string, number> = {
  'sora-2': 0.10,       // per second @ 720p
  'sora-2-pro': 0.30,   // per second @ 720p
};

function estimateVideoCost(model: string, duration: number): number {
  const perSecond = SORA_PRICING[model] ?? 0.10;
  return perSecond * duration;
}

/** Poll a Sora job until it reaches a terminal state. */
async function pollJob(
  apiKey: string,
  jobId: string,
): Promise<{ status: string; revised_prompt?: string; generations?: Array<{ id: string; revised_prompt?: string }>; failure_reason?: string }> {
  const maxAttempts = 60; // 5 minutes at 5s intervals
  const pollInterval = 5000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const res = await fetch(`${SORA_API_BASE}/${jobId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Sora poll failed (${res.status}): ${JSON.stringify(err)}`);
    }

    const data = await res.json();
    console.log(`[soraAdapter] Poll #${i + 1}: status=${data.status}`);

    if (data.status === 'completed' || data.status === 'succeeded' || data.status === 'failed' || data.status === 'cancelled') {
      return data;
    }
  }

  throw new Error('Sora generation timed out after 5 minutes');
}

/** Download generated video as base64. */
async function downloadVideo(apiKey: string, videoId: string): Promise<string> {
  const res = await fetch(`${SORA_API_BASE}/${videoId}/content`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`Sora video download failed (${res.status})`);
  }

  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const soraAdapter: VideoProviderAdapter = {
  async generate(apiKey, model, prompt, duration, resolution, referenceImage, referenceImageType) {
    const hasReference = referenceImage && referenceImageType;

    console.log(`[soraAdapter] Creating job: model=${model}, duration=${duration}s, resolution=${resolution}, reference=${hasReference ? 'yes' : 'no'}`);

    // Build request -- multipart for image-to-video, JSON for text-to-video
    let response: Response;

    if (hasReference) {
      const imageBytes = Uint8Array.from(atob(referenceImage!), (c) => c.charCodeAt(0));
      const ext = referenceImageType!.split('/')[1] || 'png';
      const imageBlob = new Blob([imageBytes], { type: referenceImageType });

      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('model', model);
      formData.append('size', resolution);
      formData.append('seconds', String(duration));
      formData.append('input_reference', imageBlob, `reference.${ext}`);

      response = await fetch(`${SORA_API_BASE}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData,
      });
    } else {
      response = await fetch(`${SORA_API_BASE}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          seconds: String(duration),
          size: resolution,
        }),
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg =
        (errorData as Record<string, Record<string, string>>)?.error?.message ??
        response.statusText;
      throw new Error(`Sora API error (${response.status}): ${msg}`);
    }

    const createData = await response.json();
    const jobId = createData.id;

    if (!jobId) {
      throw new Error('Sora returned no job ID');
    }

    console.log(`[soraAdapter] Job created: ${jobId}, polling...`);

    // Poll until complete
    const result = await pollJob(apiKey, jobId);

    if (result.status !== 'completed' && result.status !== 'succeeded') {
      throw new Error(`Sora generation ${result.status}: ${result.failure_reason ?? 'unknown error'}`);
    }

    // Video ID is the job ID itself
    const videoId = jobId;

    console.log(`[soraAdapter] Downloading video: ${videoId}`);
    const videoBase64 = await downloadVideo(apiKey, videoId);
    console.log(`[soraAdapter] Video downloaded (${videoBase64.length} chars base64)`);

    return {
      modality: 'video',
      video: videoBase64,
      revised_prompt: result.revised_prompt ?? result.generations?.[0]?.revised_prompt,
      model,
      provider: 'openai',
      estimatedCostUsd: estimateVideoCost(model, duration),
    } satisfies GatewayVideoResponseBody;
  },
};
