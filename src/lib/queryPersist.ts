import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import { db } from './offlineDb'

const CACHE_KEY = 'rq-cache'

export const dexiePersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    await db.queryCache.put({ key: CACHE_KEY, value: JSON.stringify(client) })
  },
  restoreClient: async () => {
    const row = await db.queryCache.get(CACHE_KEY)
    if (!row) return undefined
    return JSON.parse(row.value) as PersistedClient
  },
  removeClient: async () => {
    await db.queryCache.delete(CACHE_KEY)
  },
}

export async function clearPersistedCache() {
  await db.queryCache.clear()
}
