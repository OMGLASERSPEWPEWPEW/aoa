// _shared/providers/deepseekAdapter.ts
// Dedicated adapter for DeepSeek's chat completions API.
//
// Currently OpenAI-compatible in format, but isolated so future DeepSeek API
// changes (e.g. reasoning tokens, FIM completions) don't break the shared adapter.
//
// Endpoint: POST https://api.deepseek.com/chat/completions
// Auth: Authorization: Bearer {key}

import type {
  GatewayMessage,
  GatewayResponseBody,
  MessagePart,
  ProviderAdapter,
} from './types.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
}

// ---------------------------------------------------------------------------
// Conversion helper
// ---------------------------------------------------------------------------

function toChatMessage(msg: GatewayMessage): ChatMessage {
  if (typeof msg.content === 'string') {
    return { role: msg.role, content: msg.content };
  }

  const parts: ContentPart[] = (msg.content as MessagePart[]).map((part) => {
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

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';

export const deepseekAdapter: ProviderAdapter = {
  async call(apiKey, model, messages, system, maxTokens, temperature) {
    const chatMessages: ChatMessage[] = [];

    if (system) {
      chatMessages.push({ role: 'system', content: system });
    }

    for (const msg of messages) {
      chatMessages.push(toChatMessage(msg));
    }

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      messages: chatMessages,
    };

    if (temperature !== undefined) {
      body.temperature = temperature;
    }

    const response = await fetch(DEEPSEEK_ENDPOINT, {
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
      throw new Error(`DeepSeek API error (${response.status}): ${msg}`);
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
      provider: 'deepseek',
    } satisfies GatewayResponseBody;
  },
};
