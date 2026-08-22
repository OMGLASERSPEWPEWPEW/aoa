import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useSessionMutations(schoolId: string) {
  const qc = useQueryClient()
  const [pending, setPending] = useState<string | null>(null)

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.classSessions.forSchool(schoolId) })
    qc.invalidateQueries({ queryKey: ['class-session-overrides', schoolId] })
    qc.invalidateQueries({ queryKey: queryKeys.schools.coverage })
    qc.invalidateQueries({ queryKey: queryKeys.schools.audit })
  }, [qc, schoolId])

  const editField = useCallback(async (sessionId: string, field: string, value: unknown) => {
    setPending(sessionId)
    try {
      const { error } = await supabase.rpc('apply_field_override', {
        p_entity_type: 'class_session',
        p_entity_id: sessionId,
        p_field: field,
        p_value: JSON.stringify(value),
      })
      if (error) throw error
      invalidate()
      qc.invalidateQueries({
        queryKey: queryKeys.overrides.forEntity('class_session', sessionId),
      })
    } finally {
      setPending(null)
    }
  }, [qc, invalidate])

  const remove = useCallback(async (sessionId: string) => {
    setPending(sessionId)
    try {
      const { error } = await supabase.rpc('soft_delete_class_session', { p_id: sessionId })
      if (error) throw error
      invalidate()
    } finally {
      setPending(null)
    }
  }, [invalidate])

  const restore = useCallback(async (sessionId: string) => {
    setPending(sessionId)
    try {
      const { error } = await supabase.rpc('restore_class_session', { p_id: sessionId })
      if (error) throw error
      invalidate()
    } finally {
      setPending(null)
    }
  }, [invalidate])

  const addByHand = useCallback(async (payload: Record<string, unknown>): Promise<string> => {
    setPending('new')
    try {
      const { data, error } = await supabase.rpc('add_class_session_by_hand', {
        p_school_id: schoolId,
        p_payload: payload,
      })
      if (error) throw error
      invalidate()
      return data as string
    } finally {
      setPending(null)
    }
  }, [schoolId, invalidate])

  return { editField, remove, restore, addByHand, pending }
}
