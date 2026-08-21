import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { invalidateAfterBlock } from '../lib/adminInvalidation'
import type { BlockRequest } from '../lib/types'

export function useBlockSource() {
  const qc = useQueryClient()

  const blockMutation = useMutation({
    mutationFn: async (req: BlockRequest) => {
      const { data, error } = await supabase.rpc('block_source', {
        p_entity_type: req.entity_type,
        p_entity_id: req.entity_id,
        p_name: req.name,
        p_url: req.url,
        p_scope: req.scope,
        p_reason: req.reason,
        p_note: req.note ?? null,
      })
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => invalidateAfterBlock(qc),
  })

  const unblockMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('unblock_source', { p_id: id })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => invalidateAfterBlock(qc),
  })

  return {
    block: blockMutation.mutateAsync,
    unblock: unblockMutation.mutateAsync,
    blocking: blockMutation.isPending || unblockMutation.isPending,
  }
}
