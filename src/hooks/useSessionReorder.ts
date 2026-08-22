import { useState, useCallback, useRef, useMemo, type HTMLAttributes } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { applyMove, reindex } from '../lib/reorder'
import type { ClassGroup } from '../lib/types'

export interface ReorderState {
  draggingId: string | null
  fromGroup: string | null
  overGroup: string | null
  overIndex: number | null
  mode: 'pointer' | 'keyboard' | null
}

const INITIAL_STATE: ReorderState = {
  draggingId: null,
  fromGroup: null,
  overGroup: null,
  overIndex: null,
  mode: null,
}

export function useSessionReorder(schoolId: string, groups: ClassGroup[]) {
  const qc = useQueryClient()
  const [state, setState] = useState<ReorderState>(INITIAL_STATE)
  const [committing, setCommitting] = useState(false)
  const preGroupsRef = useRef<ClassGroup[]>(groups)
  const announceRef = useRef<HTMLDivElement | null>(null)

  const announce = useCallback((msg: string) => {
    if (announceRef.current) announceRef.current.textContent = msg
  }, [])

  const commit = useCallback(async (newGroups: ClassGroup[]) => {
    setCommitting(true)
    try {
      const moves = newGroups.flatMap(g => reindex(g))
      const { error } = await supabase.rpc('reorder_class_sessions', {
        p_school_id: schoolId,
        p_moves: moves,
      })
      if (error) throw error
      qc.invalidateQueries({ queryKey: queryKeys.classSessions.forSchool(schoolId) })
    } catch {
      // Rollback handled by TanStack Query refetch
    } finally {
      setCommitting(false)
      setState(INITIAL_STATE)
    }
  }, [schoolId, qc])

  const lift = useCallback((sessionId: string, groupKey: string, mode: 'pointer' | 'keyboard') => {
    preGroupsRef.current = groups
    const group = groups.find(g => g.key === groupKey)
    const idx = group?.sessions.findIndex(s => s.id === sessionId) ?? -1
    setState({
      draggingId: sessionId,
      fromGroup: groupKey,
      overGroup: groupKey,
      overIndex: idx,
      mode,
    })
    const session = group?.sessions[idx]
    announce(`Picked up ${session?.instructor_name ?? session?.title}. Position ${idx + 1} of ${group?.sessions.length}.`)
  }, [groups, announce])

  const moveToIndex = useCallback((groupKey: string, index: number) => {
    setState(prev => ({ ...prev, overGroup: groupKey, overIndex: index }))
    const group = groups.find(g => g.key === groupKey)
    announce(`Position ${index + 1} of ${group?.sessions.length ?? 0}. In ${group?.label ?? groupKey}.`)
  }, [groups, announce])

  const drop = useCallback(() => {
    if (!state.draggingId || state.overGroup == null || state.overIndex == null) {
      setState(INITIAL_STATE)
      return
    }
    const newGroups = applyMove(groups, {
      id: state.draggingId,
      toGroup: state.overGroup,
      toIndex: state.overIndex,
    })
    const session = groups.flatMap(g => g.sessions).find(s => s.id === state.draggingId)
    announce(`Dropped ${session?.instructor_name ?? session?.title} at position ${state.overIndex + 1}.`)
    commit(newGroups)
  }, [state, groups, commit, announce])

  const cancel = useCallback(() => {
    announce('Reorder cancelled.')
    setState(INITIAL_STATE)
  }, [announce])

  const handleProps = useCallback((sessionId: string, groupKey: string): HTMLAttributes<HTMLElement> => ({
    role: 'button',
    tabIndex: 0,
    'aria-roledescription': 'sortable',
    'aria-label': 'Reorder',
    onPointerDown: (e) => {
      e.preventDefault()
      e.stopPropagation()
      lift(sessionId, groupKey, 'pointer')
    },
    onPointerUp: () => {
      if (state.draggingId === sessionId) drop()
    },
    onKeyDown: (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        if (state.draggingId === sessionId) {
          drop()
        } else {
          lift(sessionId, groupKey, 'keyboard')
        }
      }
      if (state.draggingId === sessionId) {
        if (e.key === 'Escape') {
          e.preventDefault()
          cancel()
        }
        if (e.key === 'ArrowDown' && state.overIndex != null) {
          e.preventDefault()
          const group = groups.find(g => g.key === state.overGroup)
          if (group && state.overIndex < group.sessions.length - 1) {
            moveToIndex(state.overGroup!, state.overIndex + 1)
          }
        }
        if (e.key === 'ArrowUp' && state.overIndex != null && state.overIndex > 0) {
          e.preventDefault()
          moveToIndex(state.overGroup!, state.overIndex - 1)
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          const groupIdx = groups.findIndex(g => g.key === state.overGroup)
          if (groupIdx < groups.length - 1) {
            moveToIndex(groups[groupIdx + 1].key, 0)
          }
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          const groupIdx = groups.findIndex(g => g.key === state.overGroup)
          if (groupIdx > 0) {
            moveToIndex(groups[groupIdx - 1].key, 0)
          }
        }
      }
    },
  }), [state, groups, lift, drop, cancel, moveToIndex])

  const ariaProps = useMemo(() => ({
    ref: announceRef,
    role: 'status' as const,
    'aria-live': 'polite' as const,
    style: {
      position: 'absolute' as const,
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clip: 'rect(0,0,0,0)',
    },
  }), [])

  return { state, handleProps, committing, ariaProps }
}
