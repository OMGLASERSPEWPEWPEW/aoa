import { MessageCircle } from 'lucide-react'

export function MentorChat() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6">
      <MessageCircle size={48} className="text-amber-400 mb-4" />
      <h2 className="text-xl font-semibold text-white mb-2">Your Mentor</h2>
      <p className="text-center text-sm max-w-xs">
        Your knowledgeable theater guide will appear here. Coming in Phase 3.
      </p>
      <p className="text-xs text-slate-600 mt-4">Graph node: mentor-chat-ui</p>
    </div>
  )
}
