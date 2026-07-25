import { ChatInterface } from "@/components/assistant/ChatInterface";

/**
 * AI Assistant page — full-height chat interface.
 * The ChatInterface component handles all API wiring via useAssistant hook.
 *
 * Validates: Requirements 22.1, 23.1
 */
export function AssistantPage() {
  return (
    <div className="flex h-full flex-col">
      <ChatInterface />
    </div>
  );
}
