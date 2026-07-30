import { GraduationCap } from 'lucide-react'

export function Learn() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6">
      <GraduationCap size={48} className="text-amber-400 mb-4" />
      <h2 className="text-xl font-semibold text-white mb-2">Learn</h2>
      <p className="text-center text-sm max-w-xs">
        Bite-sized lessons about venues, playwrights, genres, and the scene. Coming in Phase 4.
      </p>
      <p className="text-xs text-slate-600 mt-4">Graph node: learning-browser</p>
    </div>
  )
}
