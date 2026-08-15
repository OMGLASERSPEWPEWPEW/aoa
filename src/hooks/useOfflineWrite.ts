import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { db } from '../lib/offlineDb'

export function useOfflineWrite() {
  const write = useCallback(async (
    table: string,
    payload: Record<string, unknown>,
  ): Promise<{ offline: boolean; error: string | null }> => {
    if (navigator.onLine) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic offline queue payload cannot be typed to a specific table
      const { error } = await supabase.from(table).upsert(payload as any)
      return { offline: false, error: error?.message ?? null }
    }

    await db.pendingWrites.add({
      table,
      payload,
      createdAt: Date.now(),
    })
    return { offline: true, error: null }
  }, [])

  return { write }
}
