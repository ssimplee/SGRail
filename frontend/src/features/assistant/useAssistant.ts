import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { sendChatMessage } from "@/services/assistant.api";
import { useAssistantStore } from "@/store/assistantStore";
import { useMapStore } from "@/store/mapStore";
import type {
  AssistantChatRequest,
  AssistantChatResponse,
  ChatMessage,
} from "@/types/assistant.types";

/**
 * Hook managing AI assistant chat: messages, loading state, and send logic.
 * Dispatches uiAction responses to the map store for highlighting.
 *
 * Validates: Requirements 22.1, 23.1, 29.4
 */
export function useAssistant() {
  const { messages, isLoading, addMessage, setLoading, clearMessages } =
    useAssistantStore();
  const { setHighlightedStations, setHighlightedRoute, clearHighlights } =
    useMapStore();

  const mutation = useMutation<
    AssistantChatResponse,
    Error,
    AssistantChatRequest
  >({
    mutationFn: sendChatMessage,
    onMutate: () => {
      setLoading(true);
    },
    onSuccess: (response) => {
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.reply,
        timestamp: Date.now(),
        stationIds: response.stationIds,
        lineCodes: response.lineCodes,
        route: response.route,
        uiAction: response.uiAction,
        intent: response.intent,
        warning: response.warning,
        dataFreshness: response.dataFreshness,
      };

      addMessage(assistantMessage);
      handleUIAction(response);
      setLoading(false);
    },
    onError: () => {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Sorry, I couldn't process your request. Please try again.",
        timestamp: Date.now(),
      };
      addMessage(errorMessage);
      setLoading(false);
    },
  });

  const handleUIAction = useCallback(
    (response: AssistantChatResponse) => {
      if (!response.uiAction) return;

      switch (response.uiAction) {
        case "HIGHLIGHT_STATIONS":
          if (response.stationIds?.length) {
            setHighlightedStations(response.stationIds);
          }
          break;
        case "HIGHLIGHT_ROUTE":
          if (response.route?.length) {
            setHighlightedRoute(response.route);
          }
          break;
        case "OPEN_STATION_PANEL":
          if (response.stationIds?.length) {
            setHighlightedStations(response.stationIds);
          }
          break;
        case "OPEN_ROUTE_RESULT":
          if (response.route?.length) {
            setHighlightedRoute(response.route);
          }
          break;
        case "SHOW_WARNING":
          // Warning is displayed within the message bubble
          break;
      }
    },
    [setHighlightedStations, setHighlightedRoute]
  );

  const send = useCallback(
    (text: string, context?: AssistantChatRequest["context"]) => {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      addMessage(userMessage);
      clearHighlights();
      mutation.mutate({ message: text, context });
    },
    [addMessage, clearHighlights, mutation]
  );

  return {
    messages,
    isLoading,
    send,
    clearMessages,
    error: mutation.error,
  };
}
