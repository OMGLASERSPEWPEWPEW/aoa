import { useParams, useNavigate } from 'react-router-dom'
import { useEntityDetail } from '../hooks/useEntityDetail'
import { useCuratorSuggestions } from '../hooks/useCuratorSuggestions'
import { useProfile } from '../hooks/useProfile'
import { ADMINS } from '../lib/constants'
import { ProvenanceStrip } from '../components/admin/ProvenanceStrip'
import { AdminField } from '../components/admin/AdminField'
import { SuggestionCard } from '../components/admin/SuggestionCard'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateAfterOverride } from '../lib/adminInvalidation'
import { useEffect, useState } from 'react'

export function AdminSchoolDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useProfile()
  const qc = useQueryClient()
  const isAdmin = ADMINS.includes(profile?.username?.toLowerCase() ?? '')
  const [showNotes, setShowNotes] = useState(false)

  const {
    entity, fields, counts, lastCuratedAt,
    loading, edits, setEdit, discard, save, dirtyCount,
  } = useEntityDetail('school', id!)
  const { suggestions, accept, dismiss, dismissAll } = useCuratorSuggestions('school', id!)

  useEffect(() => {
    if (dirtyCount > 0) {
      const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
      window.addEventListener('beforeunload', handler)
      return () => window.removeEventListener('beforeunload', handler)
    }
  }, [dirtyCount])

  if (!isAdmin) return null
  if (loading) return <div className="p-4" style={{ color: 'var(--ink-faint)' }}>Loading...</div>
  if (!entity) return <div className="p-4" style={{ color: 'var(--danger)' }}>Not found</div>

  const handleRelease = async (field: string) => {
    await supabase.rpc('release_field_override', {
      p_entity_type: 'school',
      p_entity_id: id!,
      p_field: field,
    })
    invalidateAfterOverride(qc, 'school', id!)
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Back bar */}
      <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid var(--rule)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="text-lg min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: 'var(--ink)' }}>&larr;</button>
          <span className="text-lg italic truncate" style={{ color: 'var(--ink)', fontFamily: 'Newsreader, serif' }}>
            {(entity as Record<string, unknown>).name as string}
          </span>
        </div>
        <div className="text-[9px] font-mono tracking-wider mt-0.5" style={{ color: 'var(--ink-faint)' }}>
          COVERAGE &middot; SCHOOLS
        </div>
      </div>

      {/* Provenance strip */}
      <ProvenanceStrip
        total={counts.total}
        held={counts.held}
        empty={counts.empty}
        notes={suggestions.length}
        lastCuratedAt={lastCuratedAt}
        onOpenNotes={() => setShowNotes(v => !v)}
      />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Suggestions section */}
        {showNotes && suggestions.length > 0 && (
          <div className="px-4 py-3 space-y-3">
            <div className="p-3 rounded" style={{ background: 'var(--accent-bg)' }}>
              <div className="font-mono text-xs font-bold" style={{ color: 'var(--accent-text)' }}>
                THE CURATOR HAS {suggestions.length} NOTE{suggestions.length !== 1 ? 'S' : ''}
              </div>
              <div className="text-sm mt-1" style={{ color: 'var(--ink)' }}>
                It found different values for fields you hold. Nothing was changed — your versions are still live.
              </div>
            </div>
            {suggestions.map(s => {
              const field = fields.find(f => f.name === s.field_name)
              return (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  currentValue={field?.value}
                  label={field?.label ?? s.field_name.toUpperCase()}
                  onAccept={() => accept(s.id)}
                  onDismiss={() => dismiss(s.id)}
                />
              )
            })}
            <button
              onClick={dismissAll}
              className="w-full min-h-[44px] rounded font-mono text-xs"
              style={{ background: 'var(--bg-card)', color: 'var(--ink)', border: '1px solid var(--rule)' }}
            >
              Keep everything I wrote
            </button>
          </div>
        )}

        {/* Fields */}
        <div className="flex flex-col gap-px" style={{ background: 'var(--rule)' }}>
          {fields.map(f => (
            <AdminField
              key={f.name}
              model={f}
              draft={edits[f.name]}
              onChange={v => setEdit(f.name, v)}
              onRelease={() => handleRelease(f.name)}
            />
          ))}
        </div>
      </div>

      {/* Save bar */}
      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{ borderTop: '1px solid var(--rule)', background: 'var(--bg-card)' }}
      >
        <button
          onClick={discard}
          disabled={dirtyCount === 0}
          className="min-h-[44px] w-[96px] rounded font-mono text-xs"
          style={{
            background: 'transparent',
            color: 'var(--ink)',
            border: '1px solid var(--rule)',
            opacity: dirtyCount === 0 ? 0.5 : 1,
          }}
        >
          DISCARD
        </button>
        <button
          onClick={save}
          disabled={dirtyCount === 0}
          className="min-h-[44px] flex-1 rounded text-base italic"
          style={{
            background: 'var(--accent)',
            color: 'var(--bg)',
            fontFamily: 'Newsreader, serif',
            opacity: dirtyCount === 0 ? 0.5 : 1,
          }}
        >
          Save {dirtyCount} change{dirtyCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}
