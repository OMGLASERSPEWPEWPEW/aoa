// _shared/providers/geminiAdapter.ts
// Native adapter for Google's Generative Language API (not the OpenAI-compat shim).
//
// Endpoint: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
// Auth: x-goog-api-key header
// Docs: https://ai.google.dev/api/generate-content

import type {
  GatewayMessage,
  GatewayResponseBody,
  MessagePart,
  ProviderAdapter,
} from './types.ts';

// ---------------------------------------------------------------------------
// Gemini-specific types
// ---------------------------------------------------------------------------

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

/** Convert a gateway message to Gemini's content format. */
function toGeminiContent(msg: GatewayMessage): GeminiContent {
  const role = msg.role === 'assistant' ? 'model' : 'user';

  if (typeof msg.content === 'string') {
    return { role, parts: [{ text: msg.content }] };
  }

  const parts: GeminiPart[] = (msg.content as MessagePart[]).map((part) => {
    if (part.type === 'text') {
      return { text: part.text };
    }
    return {
      inline_data: {
        mime_type: part.mediaType,
        data: part.data,
      },
    };
  });

  return { role, parts };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const geminiAdapter: ProviderAdapter = {
  async call(apiKey, model, messages, system, maxTokens, temperature) {
    // Build the contents array — filter out system messages (handled separately)
    const systemParts: string[] = system ? [system] : [];
    const contents: GeminiContent[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        const text = typeof msg.content === 'string'
          ? msg.content
          : (msg.content as MessagePart[])
              .filter((p) => p.type === 'text')
              .map((p) => (p as { text: string }).text)
              .join('\n');
        systemParts.push(text);
      } else {
        contents.push(toGeminiContent(msg));
      }
    }

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        ...(temperature !== undefined && { temperature }),
      },
    };

    if (systemParts.length > 0) {
      body.systemInstruction = {
        parts: [{ text: systemParts.join('\n\n') }],
      };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg =
        (errorData as Record<string, Record<string, string>>)?.error?.message ??
        response.statusText;
      throw new Error(`Gemini API error (${response.status}): ${msg}`);
    }

    const data = await response.json();

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return {
      text,
      usage: data.usageMetadata
        ? {
            inputTokens: data.usageMetadata.promptTokenCount ?? 0,
            outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
          }
        : undefined,
      model,
      provider: 'gemini',
    } satisfies GatewayResponseBody;
  },
};
