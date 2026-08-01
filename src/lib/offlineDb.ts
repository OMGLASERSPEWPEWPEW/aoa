import Dexie, { type EntityTable } from 'dexie'

export interface PendingWrite {
  id?: number
  table: string
  payload: Record<string, unknown>
  createdAt: number
}

const db = new Dexie('aoa-offline') as Dexie & {
  pendingWrites: EntityTable<PendingWrite, 'id'>
}

db.version(1).stores({
  pendingWrites: '++id, table, createdAt',
})

export { db }
