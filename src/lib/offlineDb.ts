import Dexie, { type EntityTable } from 'dexie'

export interface PendingWrite {
  id?: number
  table: string
  payload: Record<string, unknown>
  createdAt: number
}

export interface Setting {
  key: string
  value: string
}

const db = new Dexie('aoa-offline') as Dexie & {
  pendingWrites: EntityTable<PendingWrite, 'id'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  pendingWrites: '++id, table, createdAt',
})

db.version(2).stores({
  pendingWrites: '++id, table, createdAt',
  settings: 'key',
})

export { db }
