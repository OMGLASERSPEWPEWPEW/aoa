import type { ClassSessionRow, ClassGroup } from './types'

export function programGroupLabel(raw: string | null): string {
  if (!raw) return 'UNGROUPED'
  return raw.toUpperCase()
}

export function sessionSortKey(s: ClassSessionRow): [number, string, string] {
  return [
    s.sort_order ?? Infinity,
    s.starts_on ?? '￿',
    s.id,
  ]
}

function compareKeys(a: [number, string, string], b: [number, string, string]): number {
  if (a[0] !== b[0]) return a[0] - b[0]
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1
  return a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0
}

export function groupSessions(
  rows: ClassSessionRow[],
  collapsedKeys: Set<string> = new Set(),
): ClassGroup[] {
  const byGroup = new Map<string, ClassSessionRow[]>()

  for (const row of rows) {
    const key = row.program_group ?? row.program_name ?? '__ungrouped'
    const arr = byGroup.get(key)
    if (arr) arr.push(row)
    else byGroup.set(key, [row])
  }

  for (const sessions of byGroup.values()) {
    sessions.sort((a, b) => compareKeys(sessionSortKey(a), sessionSortKey(b)))
  }

  const groups: ClassGroup[] = []
  for (const [key, sessions] of byGroup) {
    groups.push({
      key,
      label: programGroupLabel(key === '__ungrouped' ? null : key),
      sessions,
      collapsed: collapsedKeys.has(key),
    })
  }

  groups.sort((a, b) => {
    if (a.key === '__ungrouped') return 1
    if (b.key === '__ungrouped') return -1

    const aMin = a.sessions[0] ? sessionSortKey(a.sessions[0]) : [Infinity, '￿', '']
    const bMin = b.sessions[0] ? sessionSortKey(b.sessions[0]) : [Infinity, '￿', '']
    return compareKeys(
      aMin as [number, string, string],
      bMin as [number, string, string],
    )
  })

  return groups
}
