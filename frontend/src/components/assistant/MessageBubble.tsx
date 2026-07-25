import { Bot, User } from "lucide-react";
import type { ChatMessage } from "@/types/assistant.types";
import { cn } from "@/lib/utils";
import { ActionCard } from "./ActionCard";

interface MessageBubbleProps {
  message: ChatMessage;
}

/**
 * Chat bubble component with distinct user (right, blue) and assistant (left, grey) styling.
 *
 * Validates: Requirements 22.1, 29.4
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-2 w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {/* Assistant avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <Bot className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        </div>
      )}

      <div className={cn("flex flex-col max-w-[75%] gap-1", isUser && "items-end")}>
        {/* Message bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted text-foreground rounded-bl-md"
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.warning && (
            <p className="mt-1 text-xs font-medium opacity-80">
              ⚠️ {message.warning}
            </p>
          )}
        </div>

        {/* Action card for structured responses */}
        {!isUser && (message.stationIds?.length || message.uiAction) && (
          <ActionCard message={message} />
        )}

        {/* Data freshness indicator */}
        {!isUser && message.dataFreshness && (
          <span className="text-xs text-muted-foreground px-1">
            Data as of{" "}
            {new Date(message.dataFreshness).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <User className="w-4 h-4 text-primary-foreground" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
