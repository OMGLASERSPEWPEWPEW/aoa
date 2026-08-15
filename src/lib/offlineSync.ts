import { db } from './offlineDb'
import { supabase } from './supabase'

let processing = false

async function processQueue(): Promise<void> {
  if (processing || !navigator.onLine) return
  processing = true

  try {
    const items = await db.pendingWrites.orderBy('createdAt').toArray()

    for (const item of items) {
      let attempts = 0
      let success = false

      while (attempts < 3 && !success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic offline queue payload cannot be typed to a specific table
        const { error } = await supabase.from(item.table).upsert(item.payload as any)
        if (!error) {
          await db.pendingWrites.delete(item.id!)
          success = true
        } else {
          attempts++
          if (attempts < 3) {
            await new Promise(r => setTimeout(r, 1000 * 2 ** (attempts - 1)))
          }
        }
      }

      if (!success) break
    }
  } finally {
    processing = false
  }
}

export function startOfflineSync(): () => void {
  const handler = () => processQueue()
  window.addEventListener('online', handler)
  processQueue()
  return () => window.removeEventListener('online', handler)
}

export { processQueue }
