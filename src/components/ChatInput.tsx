import { useState } from 'react'
import { Send } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-slate-800 bg-slate-950">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask your mentor anything..."
        disabled={disabled}
        className="flex-1 bg-slate-800 text-white rounded-full px-4 py-2.5 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-full p-2.5 transition-colors disabled:opacity-30"
      >
        <Send size={18} />
      </button>
    </form>
  )
}
