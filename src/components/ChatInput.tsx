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
    <form
      onSubmit={handleSubmit}
      className="flex gap-2"
      style={{
        padding: 12,
        borderTop: '1px solid #2b2720',
        backgroundColor: 'var(--bg)',
      }}
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask anything about Chicago theater..."
        disabled={disabled}
        style={{
          flex: 1,
          backgroundColor: '#141109',
          color: 'var(--ink)',
          border: '1px solid #2b2720',
          borderRadius: 20,
          padding: '10px 16px',
          fontFamily: "'Courier Prime', monospace",
          fontSize: 12,
          outline: 'none',
          opacity: disabled ? 0.5 : 1,
        }}
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        style={{
          backgroundColor: 'oklch(0.80 0.14 55)',
          color: '#0c0a05',
          borderRadius: '50%',
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          cursor: 'pointer',
          opacity: disabled || !text.trim() ? 0.3 : 1,
        }}
      >
        <Send size={18} />
      </button>
    </form>
  )
}
