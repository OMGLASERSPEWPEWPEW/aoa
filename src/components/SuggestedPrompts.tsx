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
    <div className="flex flex-wrap gap-2" style={{ padding: '12px 16px' }}>
      {PROMPTS.map((prompt) => (
        <button
          key={prompt}
          onClick={() => onSelect(prompt)}
          style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 10,
            letterSpacing: '0.04em',
            color: 'oklch(0.80 0.14 55)',
            backgroundColor: '#141109',
            border: '1px solid #2b2720',
            borderRadius: 20,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          {prompt}
        </button>
      ))}
    </div>
  )
}
