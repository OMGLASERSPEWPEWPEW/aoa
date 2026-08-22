import type { ClassGroup, ClassSessionRow } from './types'

export interface ReorderMove {
  id: string
  sort_order: number
  program_group: string
}

export function applyMove(
  groups: ClassGroup[],
  move: { id: string; toGroup: string; toIndex: number },
): ClassGroup[] {
  const result = groups.map(g => ({
    ...g,
    sessions: g.sessions.filter(s => s.id !== move.id),
  }))

  let movedSession: ClassSessionRow | undefined
  for (const g of groups) {
    const found = g.sessions.find(s => s.id === move.id)
    if (found) { movedSession = found; break }
  }
  if (!movedSession) return groups

  const targetGroup = result.find(g => g.key === move.toGroup)
  if (!targetGroup) return groups

  const updated = {
    ...movedSession,
    program_group: move.toGroup === '__ungrouped' ? null : move.toGroup,
  }
  targetGroup.sessions.splice(move.toIndex, 0, updated)

  return result.filter(g => g.sessions.length > 0)
}

export function reindex(group: ClassGroup): ReorderMove[] {
  return group.sessions.map((s, i) => ({
    id: s.id,
    sort_order: i * 10,
    program_group: group.key === '__ungrouped' ? '' : group.key,
  }))
}
