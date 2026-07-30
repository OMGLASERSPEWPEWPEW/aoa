// _shared/providers/openaiCompatAdapter.ts
// Adapter for OpenAI's chat completions API.
//
// Previously a factory covering OpenAI, DeepSeek, and Gemini. Now each provider
// has its own dedicated adapter. This file handles OpenAI only.
//
// Endpoint: POST https://api.openai.com/v1/chat/completions

import type {
  GatewayMessage,
  GatewayResponseBody,
  MessagePart,
  ProviderAdapter,
} from './types.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface OpenAIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | OpenAIContentPart[];
}

// ---------------------------------------------------------------------------
// Conversion helper
// ---------------------------------------------------------------------------

/** Convert a gateway message to OpenAI chat format. */
function toOpenAIMessage(msg: GatewayMessage): OpenAIChatMessage {
  if (typeof msg.content === 'string') {
    return { role: msg.role, content: msg.content };
  }

  const parts: OpenAIContentPart[] = (msg.content as MessagePart[]).map((part) => {
    if (part.type === 'text') {
      return { type: 'text' as const, text: part.text };
    }
    return {
      type: 'image_url' as const,
      image_url: {
        url: `data:${part.mediaType};base64,${part.data}`,
      },
    };
  });

  return { role: msg.role, content: parts };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export const openaiAdapter: ProviderAdapter = {
  async call(apiKey, model, messages, system, maxTokens, temperature) {
    const openAIMessages: OpenAIChatMessage[] = [];

    if (system) {
      openAIMessages.push({ role: 'system', content: system });
    }

    for (const msg of messages) {
      openAIMessages.push(toOpenAIMessage(msg));
    }

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      messages: openAIMessages,
    };

    if (temperature !== undefined) {
      body.temperature = temperature;
    }

    const response = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg =
        (errorData as Record<string, Record<string, string>>)?.error?.message ??
        response.statusText;
      throw new Error(`OpenAI API error (${response.status}): ${msg}`);
    }

    const data = await response.json();

    const text = data.choices?.[0]?.message?.content ?? '';

    return {
      text,
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens ?? 0,
            outputTokens: data.usage.completion_tokens ?? 0,
          }
        : undefined,
      model,
      provider: 'openai',
    } satisfies GatewayResponseBody;
  },
};
