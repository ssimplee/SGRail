import { Sparkles } from "lucide-react";

interface SuggestionChipsProps {
  onSelect: (text: string) => void;
}

const SUGGESTIONS = [
  "How to get to Orchard?",
  "Is it crowded at Raffles Place?",
  "Last train from Jurong East?",
  "Wheelchair accessible route to Changi?",
  "Any incidents on the East-West line?",
  "Facilities at Bishan station?",
];

/**
 * Quick-start suggestion chips displayed when the chat is empty.
 * Helps users discover what the assistant can do.
 *
 * Validates: Requirements 22.1, 29.4
 */
export function SuggestionChips({ onSelect }: SuggestionChipsProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 px-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Sparkles className="w-5 h-5" aria-hidden="true" />
        <p className="text-sm font-medium">Ask me about Singapore MRT</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 max-w-md">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onSelect(text)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
