import { supabase } from './supabase'

type Provider = 'anthropic' | 'openai' | 'gemini' | 'deepseek'

interface CallModelOptions {
  provider?: Provider
  model?: string
  systemPrompt?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
  temperature?: number
  feature?: string
}

interface CallModelResult {
  text: string
  usage?: { inputTokens: number; outputTokens: number }
}

export async function callModel(options: CallModelOptions): Promise<CallModelResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const provider = options.provider ?? 'anthropic'
  const model = options.model ?? 'claude-sonnet-4-20250514'

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-gateway`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        provider,
        model,
        system: options.systemPrompt,
        messages: options.messages,
        maxTokens: options.maxTokens ?? 1024,
        temperature: options.temperature,
        feature: options.feature,
      }),
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AI Gateway error: ${error}`)
  }

  const result = await response.json()
  return { text: result.text ?? '', usage: result.usage }
}
