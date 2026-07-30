// _shared/providers/types.ts
// Shared types for the multi-provider AI gateway (text, image, video)

export type Provider = 'anthropic' | 'openai' | 'gemini' | 'deepseek';

export type Modality = 'text' | 'image' | 'video';

// ---------------------------------------------------------------------------
// Text modality types
// ---------------------------------------------------------------------------

/** Provider-agnostic message format used by the gateway. */
export interface GatewayMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | MessagePart[];
}

/** Multimodal content part (text or image). */
export type MessagePart = TextPart | ImagePart;

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ImagePart {
  type: 'image';
  mediaType: string; // e.g. 'image/jpeg'
  data: string;      // base64-encoded
}

/** Normalized text request sent from the frontend to the ai-gateway. */
export interface GatewayTextRequestBody {
  modality?: 'text';    // default
  provider: Provider;
  model: string;
  messages: GatewayMessage[];
  system?: string;
  maxTokens: number;
  temperature?: number;
  feature?: string;
}

/** Normalized text response returned by the ai-gateway. */
export interface GatewayTextResponseBody {
  modality: 'text';
  text: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  provider: Provider;
}

// Backward-compatible aliases
export type GatewayRequestBody = GatewayTextRequestBody;
export type GatewayResponseBody = GatewayTextResponseBody;

/** Internal adapter interface -- each text provider adapter implements this. */
export interface ProviderAdapter {
  call(
    apiKey: string,
    model: string,
    messages: GatewayMessage[],
    system: string | undefined,
    maxTokens: number,
    temperature?: number,
  ): Promise<GatewayTextResponseBody>;
}

// ---------------------------------------------------------------------------
// Image modality types
// ---------------------------------------------------------------------------

/** Image generation request. */
export interface GatewayImageRequestBody {
  modality: 'image';
  provider: Provider;
  model: string;
  prompt: string;
  size?: string;          // e.g. '1024x1024'
  quality?: 'standard' | 'hd';
  feature?: string;
}

/** Image generation response. */
export interface GatewayImageResponseBody {
  modality: 'image';
  image: string;          // base64-encoded image
  revised_prompt?: string;
  model: string;
  provider: Provider;
  estimatedCostUsd?: number;
}

/** Internal adapter interface for image generation providers. */
export interface ImageProviderAdapter {
  generate(
    apiKey: string,
    model: string,
    prompt: string,
    size: string,
    quality: string,
  ): Promise<GatewayImageResponseBody>;
}

// ---------------------------------------------------------------------------
// Video modality types
// ---------------------------------------------------------------------------

/** Video generation request. */
export interface GatewayVideoRequestBody {
  modality: 'video';
  provider: Provider;
  model: string;
  prompt: string;
  duration?: number;      // seconds (default 4)
  resolution?: string;    // e.g. '720x1280'
  referenceImage?: string;      // base64 for image-to-video
  referenceImageType?: string;  // MIME type
  feature?: string;
}

/** Video generation response. */
export interface GatewayVideoResponseBody {
  modality: 'video';
  video: string;          // base64-encoded video
  revised_prompt?: string;
  model: string;
  provider: Provider;
  estimatedCostUsd?: number;
}

/** Internal adapter interface for video generation providers. */
export interface VideoProviderAdapter {
  generate(
    apiKey: string,
    model: string,
    prompt: string,
    duration: number,
    resolution: string,
    referenceImage?: string,
    referenceImageType?: string,
  ): Promise<GatewayVideoResponseBody>;
}

// ---------------------------------------------------------------------------
// Union types for the gateway router
// ---------------------------------------------------------------------------

export type AnyGatewayRequest =
  | GatewayTextRequestBody
  | GatewayImageRequestBody
  | GatewayVideoRequestBody;

export type AnyGatewayResponse =
  | GatewayTextResponseBody
  | GatewayImageResponseBody
  | GatewayVideoResponseBody;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Provider endpoint configuration.
 *  Anthropic and OpenAI endpoints are here for reference; Gemini and DeepSeek
 *  endpoints live in their dedicated adapters (geminiAdapter.ts, deepseekAdapter.ts). */
export const PROVIDER_ENDPOINTS: Partial<Record<Provider, string>> = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
};

/** Map of environment variable names for each provider's API key. */
export const PROVIDER_KEY_ENV: Record<Provider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
};
