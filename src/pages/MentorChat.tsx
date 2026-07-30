import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MessageBubble } from '../components/MessageBubble'
import { SuggestedPrompts } from '../components/SuggestedPrompts'
import { ChatInput } from '../components/ChatInput'
import { MentorAvatar } from '../components/MentorAvatar'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function MentorChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    const userMessage: Message = { role: 'user', content: text }
    const updated = [...messages, userMessage]
    setMessages(updated)
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mentor-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: updated }),
        },
      )

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()
      setMessages([...updated, { role: 'assistant', content: data.text }])
    } catch {
      setMessages([
        ...updated,
        { role: 'assistant', content: "Sorry, I'm having trouble connecting right now. Try again in a moment." },
      ])
    } finally {
      setLoading(false)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full px-6 pb-4">
            <MentorAvatar size={64} />
            <h2 className="text-lg font-semibold text-white mt-4 mb-1">Your Theater Mentor</h2>
            <p className="text-sm text-slate-400 text-center max-w-xs mb-6">
              I know Chicago theater inside and out. Ask me anything — where to start, what to see, or how the scene works.
            </p>
            <SuggestedPrompts onSelect={sendMessage} />
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {messages.map((msg, i) => (
              <MessageBubble key={i} role={msg.role} content={msg.content} />
            ))}
            {loading && (
              <div className="flex gap-2.5 items-start">
                <MentorAvatar size={32} />
                <div className="bg-slate-800 rounded-2xl rounded-tl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <ChatInput onSend={sendMessage} disabled={loading} />
    </div>
  )
}
