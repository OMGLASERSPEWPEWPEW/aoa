const PROMPTS = [
  "What show should I see first?",
  "What's storefront theater?",
  "Tell me about improv in Chicago",
  "What are HotTix?",
]

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void
}

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-3">
      {PROMPTS.map((prompt) => (
        <button
          key={prompt}
          onClick={() => onSelect(prompt)}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-full px-3 py-1.5 transition-colors"
        >
          {prompt}
        </button>
      ))}
    </div>
  )
}
