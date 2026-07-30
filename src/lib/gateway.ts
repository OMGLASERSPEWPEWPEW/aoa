import { supabase } from './supabase'

interface CallModelOptions {
  model?: string
  systemPrompt?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
}

export async function callModel(options: CallModelOptions): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-gateway`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        model: options.model ?? 'claude-sonnet-4-20250514',
        system: options.systemPrompt,
        messages: options.messages,
        max_tokens: options.maxTokens ?? 1024,
      }),
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AI Gateway error: ${error}`)
  }

  const result = await response.json()
  return result.content?.[0]?.text ?? result.text ?? ''
}
