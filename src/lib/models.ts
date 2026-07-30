type Provider = 'anthropic' | 'openai' | 'gemini' | 'deepseek'

export interface ModelDef {
  provider: Provider
  model: string
  displayName: string
}

export const MODELS: Record<string, ModelDef> = {
  'claude-sonnet-4': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
  },
  'claude-haiku-4-5': {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
  },
}

interface FeatureModelConfig {
  primary: string
  fallback?: string
}

export const MODEL_REGISTRY: Record<string, FeatureModelConfig> = {
  'mentor-chat': { primary: 'claude-sonnet-4' },
}

export function getModelForFeature(feature: string): ModelDef {
  const config = MODEL_REGISTRY[feature]
  const modelKey = config?.primary ?? 'claude-sonnet-4'
  return MODELS[modelKey] ?? MODELS['claude-sonnet-4']
}
