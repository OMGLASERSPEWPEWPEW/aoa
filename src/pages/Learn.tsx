import { useEffect, useState } from 'react'
import { BookOpen, GraduationCap, Lock, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import { useBeltCheck } from '../hooks/useBeltCheck'
import { BeltUpgradeModal } from '../components/BeltUpgradeModal'
import type { LearningContent } from '../lib/types'
import { BELT_NAMES, BELT_COLORS } from '../lib/types'

const CATEGORIES = ['all', 'guide', 'venue', 'playwright', 'genre', 'history'] as const

export function Learn() {
  const { profile, progress, refetch } = useProfile()
  const { result: beltResult, checkBelt, dismiss: dismissBelt } = useBeltCheck()
  const [content, setContent] = useState<LearningContent[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>('all')
  const [selectedArticle, setSelectedArticle] = useState<LearningContent | null>(null)

  const beltLevel = profile?.belt_level ?? 0
  const completedSlugs = progress?.learning_modules_completed ?? []

  useEffect(() => {
    supabase
      .from('learning_content')
      .select('*')
      .order('belt_requirement', { ascending: true })
      .order('title', { ascending: true })
      .then(({ data }) => {
        setContent((data as LearningContent[]) ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = content.filter(c =>
    category === 'all' || c.category === category,
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Loading content...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Category filter */}
      <div className="p-3 border-b border-slate-800">
        <div className="flex gap-2 overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                category === cat
                  ? 'bg-amber-400 text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content grid */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.map(article => {
          const locked = article.belt_requirement > beltLevel
          const completed = completedSlugs.includes(article.slug)

          return (
            <button
              key={article.id}
              onClick={() => !locked && setSelectedArticle(article)}
              disabled={locked}
              className={`w-full text-left bg-slate-900 border rounded-xl p-3.5 transition-colors ${
                locked
                  ? 'border-slate-800 opacity-50'
                  : completed
                    ? 'border-green-900 hover:border-green-800'
                    : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${completed ? 'bg-green-400/10' : 'bg-slate-800'}`}>
                  {locked ? (
                    <Lock size={16} className="text-slate-600" />
                  ) : completed ? (
                    <Check size={16} className="text-green-400" />
                  ) : (
                    <BookOpen size={16} className="text-amber-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-white text-sm font-medium truncate">{article.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {article.category && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                        {article.category}
                      </span>
                    )}
                    {article.belt_requirement > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${BELT_COLORS[article.belt_requirement]}`}>
                        {BELT_NAMES[article.belt_requirement]}+
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Article modal */}
      {selectedArticle && (
        <ArticleModal
          article={selectedArticle}
          completed={completedSlugs.includes(selectedArticle.slug)}
          onMarkComplete={async () => {
            if (!progress) return
            const updated = [...completedSlugs, selectedArticle.slug]
            await supabase
              .from('user_progress')
              .update({ learning_modules_completed: updated, updated_at: new Date().toISOString() })
              .eq('user_id', progress.user_id)
            setSelectedArticle(null)
            await refetch()
            await checkBelt()
          }}
          onClose={() => setSelectedArticle(null)}
        />
      )}

      {beltResult && (
        <BeltUpgradeModal beltLevel={beltResult.newBeltLevel!} onClose={dismissBelt} />
      )}
    </div>
  )
}

function ArticleModal({ article, completed, onMarkComplete, onClose }: {
  article: LearningContent
  completed: boolean
  onMarkComplete: () => Promise<void>
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-slate-900 w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-white text-lg font-bold">{article.title}</h2>
              {article.category && (
                <span className="text-xs text-amber-400 capitalize">{article.category}</span>
              )}
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-1">✕</button>
          </div>

          <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
            {article.body}
          </div>

          {!completed && (
            <button
              onClick={async () => {
                setSaving(true)
                await onMarkComplete()
              }}
              disabled={saving}
              className="w-full mt-6 py-2.5 rounded-lg bg-amber-400 text-slate-900 text-sm font-medium hover:bg-amber-300 disabled:opacity-30 transition-colors flex items-center justify-center gap-2"
            >
              <GraduationCap size={16} />
              {saving ? 'Saving...' : 'Mark as Complete'}
            </button>
          )}

          {completed && (
            <div className="mt-6 py-2.5 rounded-lg bg-green-400/10 text-green-400 text-sm font-medium text-center flex items-center justify-center gap-2">
              <Check size={16} />
              Completed
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
