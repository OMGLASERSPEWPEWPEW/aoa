import { useParams, useNavigate } from 'react-router-dom'
import { useEntityDetail } from '../hooks/useEntityDetail'
import { useCuratorSuggestions } from '../hooks/useCuratorSuggestions'
import { useClassSessions } from '../hooks/useClassSessions'
import { useSessionMutations } from '../hooks/useSessionMutations'
import { useSessionReorder } from '../hooks/useSessionReorder'
import { useProfile } from '../hooks/useProfile'
import { ADMINS } from '../lib/constants'
import { AdminField } from '../components/admin/AdminField'
import { SuggestionCard } from '../components/admin/SuggestionCard'
import { SchoolFactsBand } from '../components/admin/SchoolFactsBand'
import { ClassListHeader } from '../components/admin/ClassListHeader'
import { ClassGroupHeader } from '../components/admin/ClassGroupHeader'
import { ClassRow } from '../components/admin/ClassRow'
import { ClassRowExpanded } from '../components/admin/ClassRowExpanded'
import { RemovedUndoStrip } from '../components/admin/RemovedUndoStrip'
import { DropWell } from '../components/admin/DropWell'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateAfterOverride } from '../lib/adminInvalidation'
import { useEffect, useState, useCallback } from 'react'
import type { School } from '../lib/types'

export function AdminSchoolDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useProfile()
  const qc = useQueryClient()
  const isAdmin = ADMINS.includes(profile?.username?.toLowerCase() ?? '')
  const [showNotes, setShowNotes] = useState(false)
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [removedSession, setRemovedSession] = useState<{ id: string; title: string } | null>(null)

  const {
    entity, fields,
    loading, edits, setEdit, discard, save, dirtyCount,
  } = useEntityDetail('school', id!)
  const { suggestions, accept, dismiss, dismissAll } = useCuratorSuggestions('school', id!)
  const {
    groups, totalCount, lastCuratedAt, completeness,
    loading: sessionsLoading, toggleGroup,
  } = useClassSessions(id!)
  const { editField, remove, restore } = useSessionMutations(id!)
  const { state: reorderState, handleProps, ariaProps } = useSessionReorder(id!, groups)

  useEffect(() => {
    if (dirtyCount > 0) {
      const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
      window.addEventListener('beforeunload', handler)
      return () => window.removeEventListener('beforeunload', handler)
    }
  }, [dirtyCount])

  const handleRelease = async (field: string) => {
    await supabase.rpc('release_field_override', {
      p_entity_type: 'school',
      p_entity_id: id!,
      p_field: field,
    })
    invalidateAfterOverride(qc, 'school', id!)
  }

  const handleRemove = useCallback(async (sessionId: string) => {
    const session = groups.flatMap(g => g.sessions).find(s => s.id === sessionId)
    setRemovedSession({ id: sessionId, title: session?.instructor_name ?? session?.title ?? '' })
    setExpandedSessionId(null)
    await remove(sessionId)
  }, [groups, remove])

  const handleUndo = useCallback(async () => {
    if (removedSession) {
      await restore(removedSession.id)
      setRemovedSession(null)
    }
  }, [removedSession, restore])

  const handleRecurate = useCallback(() => {
    // TODO: Wire to class-scrape-batch Edge Function
  }, [])

  const handleAddByHand = useCallback(() => {
    // TODO: Wire to add_class_session_by_hand RPC
  }, [])

  if (!isAdmin) return null
  if (loading) return <div className="p-4" style={{ color: 'var(--ink-faint)' }}>Loading...</div>
  if (!entity) return <div className="p-4" style={{ color: 'var(--danger)' }}>Not found</div>

  const school = entity as unknown as School

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Back bar */}
      <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid var(--rule)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="text-lg min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: 'var(--ink)' }}>&larr;</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="text-lg italic truncate block" style={{ color: 'var(--ink)', fontFamily: 'Newsreader, serif' }}>
              {school.name}
            </span>
            <div className="text-[9px] font-mono tracking-wider mt-0.5" style={{ color: 'var(--ink-faint)' }}>
              COVERAGE &middot; SCHOOLS
            </div>
          </div>
          <span style={{ fontSize: '15px', color: 'var(--ink-dim)', cursor: 'pointer' }}>⋯</span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* School facts band */}
        <SchoolFactsBand
          school={school}
          shortNameDraft={edits.short_name as string | null ?? null}
          priceBandDraft={edits.price_band as string | null ?? null}
          addressDraft={edits.address as string | null ?? null}
          onEditShortName={(v) => setEdit('short_name', v)}
          onEditPriceBand={(v) => setEdit('price_band', v)}
          onEditAddress={(v) => setEdit('address', v)}
        />

        {/* Suggestions */}
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

        {/* Hidden school fields (not shown in 7b per spec — the facts band replaces them) */}
        {/* Affordability toggles below the class list */}

        {/* Class list */}
        <ClassListHeader
          totalCount={totalCount}
          lastCuratedAt={lastCuratedAt}
          completeness={completeness}
          onRecurate={handleRecurate}
          onAddByHand={handleAddByHand}
        />

        {!sessionsLoading && (
          <div style={{ padding: '0 20px', position: 'relative' }}>
            {/* Aria-live region for reorder announcements */}
            <div {...ariaProps} />

            {groups.map(group => (
              <div key={group.key}>
                <ClassGroupHeader
                  label={group.label}
                  count={group.sessions.length}
                  collapsed={group.collapsed}
                  onToggle={() => toggleGroup(group.key)}
                />

                {!group.collapsed && group.sessions.map((session, idx) => (
                  <div key={session.id}>
                    {/* Drop well above this row when reordering */}
                    <DropWell
                      visible={
                        reorderState.draggingId != null &&
                        reorderState.overGroup === group.key &&
                        reorderState.overIndex === idx &&
                        reorderState.draggingId !== session.id
                      }
                      onDrop={() => {}}
                    />

                    {removedSession?.id === session.id ? (
                      <RemovedUndoStrip
                        sessionTitle={removedSession.title}
                        onUndo={handleUndo}
                      />
                    ) : expandedSessionId === session.id ? (
                      <ClassRowExpanded
                        session={session}
                        onCollapse={() => setExpandedSessionId(null)}
                        onEditField={editField}
                        onRemove={handleRemove}
                      />
                    ) : (
                      <>
                        <ClassRow
                          session={session}
                          expanded={false}
                          onToggle={() => setExpandedSessionId(
                            expandedSessionId === session.id ? null : session.id,
                          )}
                          handleProps={handleProps(session.id, group.key)}
                          isDragging={reorderState.draggingId === session.id}
                        />
                        {reorderState.draggingId === session.id && (
                          <p style={{
                            margin: '7px 0 0',
                            fontFamily: "'Courier Prime', monospace",
                            fontSize: '8.5px',
                            letterSpacing: '0.04em',
                            color: 'var(--ink-faint)',
                            textAlign: 'center',
                          }}>
                            HOLDING — ORDER IS WHAT STUDENTS SEE
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ))}

                {/* Drop well at the end of group when reordering */}
                {!group.collapsed && (
                  <DropWell
                    visible={
                      reorderState.draggingId != null &&
                      reorderState.overGroup === group.key &&
                      reorderState.overIndex === group.sessions.length
                    }
                    onDrop={() => {}}
                  />
                )}
              </div>
            ))}

            {totalCount === 0 && !sessionsLoading && (
              <div className="py-8 text-center" style={{ color: 'var(--ink-faint)' }}>
                <p style={{ fontFamily: 'Newsreader, serif', fontSize: '15px', fontStyle: 'italic' }}>
                  No classes curated yet.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Affordability section */}
        {fields.filter(f => ['payment_plan', 'financial_aid', 'sliding_scale'].includes(f.name)).length > 0 && (
          <div style={{ padding: '14px 20px 0', borderTop: '1px solid var(--rule)', marginTop: '12px' }}>
            <div style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: '9px',
              letterSpacing: '0.18em',
              color: 'var(--ink-faint)',
              marginBottom: '8px',
            }}>
              HOW PEOPLE AFFORD IT
            </div>
            <div className="flex flex-col gap-px" style={{ background: 'var(--rule)' }}>
              {fields
                .filter(f => ['payment_plan', 'financial_aid', 'sliding_scale'].includes(f.name))
                .map(f => (
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
        )}

        {/* Notes link if any */}
        {suggestions.length > 0 && !showNotes && (
          <div className="px-5 py-3">
            <button
              onClick={() => setShowNotes(true)}
              className="w-full min-h-[44px] rounded font-mono text-xs"
              style={{ background: 'var(--accent-bg)', color: 'var(--accent-text)', border: '1px solid var(--accent-border)' }}
            >
              THE CURATOR HAS {suggestions.length} NOTE{suggestions.length !== 1 ? 'S' : ''}
            </button>
          </div>
        )}
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
