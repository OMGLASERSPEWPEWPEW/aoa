import { describe, it, expect } from 'vitest'

describe('offlineDb', () => {
  it('exports PendingWrite interface shape', async () => {
    const { db } = await import('./offlineDb')
    expect(db.name).toBe('aoa-offline')
    expect(db.tables.map(t => t.name)).toContain('pendingWrites')
  })
})
