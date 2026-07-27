import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { useAssistant } from "@/features/assistant/useAssistant";
import { MessageBubble } from "./MessageBubble";
import { SuggestionChips } from "./SuggestionChips";

/**
 * Main AI chat container with message list, input field, suggestion chips,
 * and loading indicator. Designed as a wider panel on desktop (via parent layout).
 *
 * Validates: Requirements 22.1, 23.1, 29.4
 */
export function ChatInterface() {
  const { messages, isLoading, send, answerQuickReply } = useAssistant();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEmpty = messages.length === 0;

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    send(trimmed);
    setInput("");
  };

  const handleSuggestionSelect = (text: string) => {
    send(text);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isEmpty ? (
          <SuggestionChips onSelect={handleSuggestionSelect} />
        ) : (
          <>
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                isLatest={index === messages.length - 1}
                onQuickReply={answerQuickReply}
              />
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-2 items-center">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <Loader2
                    className="w-4 h-4 text-muted-foreground animate-spin"
                    aria-hidden="true"
                  />
                </div>
                <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-2">
                  <span className="text-sm text-muted-foreground">
                    Thinking...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-border px-4 py-3 flex gap-2 items-center"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about MRT routes, timings, or stations..."
          disabled={isLoading}
          className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          aria-label="Chat message input"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="rounded-full bg-primary p-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
