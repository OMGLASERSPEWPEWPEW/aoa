import type { FieldOverride, FieldState } from './types'

export function fieldState(value: unknown, override: FieldOverride | null): FieldState {
  if (override) return 'held'
  if (value === null || value === undefined) return 'empty'
  if (value === '') return 'empty'
  if (Array.isArray(value) && value.length === 0) return 'empty'
  return 'curated'
}
