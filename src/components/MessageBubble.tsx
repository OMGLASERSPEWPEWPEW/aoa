import { MentorAvatar } from './MentorAvatar'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-amber-400/20 text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%]">
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2.5 items-start">
      <MentorAvatar size={32} />
      <div className="bg-slate-800 text-slate-200 rounded-2xl rounded-tl-md px-4 py-2.5 max-w-[80%]">
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  )
}
