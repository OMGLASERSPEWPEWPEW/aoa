import { getModelForFeature, MODELS, MODEL_REGISTRY } from './models'

describe('getModelForFeature', () => {
  it('returns the configured model for a known feature', () => {
    const result = getModelForFeature('mentor-chat')
    expect(result).toBe(MODELS['claude-sonnet-4'])
    expect(result.provider).toBe('anthropic')
    expect(result.model).toBe('claude-sonnet-4-20250514')
  })

  it('falls back to claude-sonnet-4 for unknown features', () => {
    const result = getModelForFeature('nonexistent-feature')
    expect(result).toBe(MODELS['claude-sonnet-4'])
  })

  it('returns an object with provider, model, and displayName', () => {
    const result = getModelForFeature('mentor-chat')
    expect(result).toHaveProperty('provider')
    expect(result).toHaveProperty('model')
    expect(result).toHaveProperty('displayName')
  })

  it('MODEL_REGISTRY maps mentor-chat to claude-sonnet-4', () => {
    expect(MODEL_REGISTRY['mentor-chat'].primary).toBe('claude-sonnet-4')
  })
})
