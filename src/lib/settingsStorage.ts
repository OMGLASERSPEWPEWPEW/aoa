import { db } from './offlineDb'

export async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await db.settings.get(key)
    return row?.value ?? null
  } catch {
    return null
  }
}

export async function putSetting(key: string, value: string): Promise<void> {
  try {
    await db.settings.put({ key, value })
  } catch {
    // localStorage is the fallback
  }
}
