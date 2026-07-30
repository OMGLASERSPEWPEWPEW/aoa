// _shared/providers/anthropicAdapter.ts
// Adapter for Anthropic's Messages API (unique format, not OpenAI-compatible)

import type {
  GatewayMessage,
  GatewayResponseBody,
  MessagePart,
  ProviderAdapter,
} from './types.ts';

/** Convert gateway messages to Anthropic's content format. */
function toAnthropicContent(
  content: string | MessagePart[],
): string | AnthropicContentBlock[] {
  if (typeof content === 'string') return content;

  return content.map((part) => {
    if (part.type === 'text') {
      return { type: 'text' as const, text: part.text };
    }
    // Image part -> Anthropic image block
    return {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: part.mediaType,
        data: part.data,
      },
    };
  });
}

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export const anthropicAdapter: ProviderAdapter = {
  async call(apiKey, model, messages, system, maxTokens, temperature) {
    // Anthropic treats system as a top-level field, not a message.
    // Filter out any system-role messages and merge them into the system param.
    const systemParts: string[] = system ? [system] : [];
    const anthropicMessages: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        const text = typeof msg.content === 'string'
          ? msg.content
          : msg.content
              .filter((p) => p.type === 'text')
              .map((p) => (p as { text: string }).text)
              .join('\n');
        systemParts.push(text);
      } else {
        anthropicMessages.push({
          role: msg.role,
          content: toAnthropicContent(msg.content),
        });
      }
    }

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      messages: anthropicMessages,
    };

    if (systemParts.length > 0) {
      body.system = systemParts.join('\n\n');
    }

    if (temperature !== undefined) {
      body.temperature = temperature;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = (errorData as Record<string, Record<string, string>>)?.error?.message
        ?? response.statusText;
      throw new Error(`Anthropic API error (${response.status}): ${msg}`);
    }

    const data = await response.json();

    const text = data.content?.[0]?.text ?? '';

    return {
      text,
      usage: data.usage
        ? {
            inputTokens: data.usage.input_tokens ?? 0,
            outputTokens: data.usage.output_tokens ?? 0,
          }
        : undefined,
      model,
      provider: 'anthropic',
    } satisfies GatewayResponseBody;
  },
};
