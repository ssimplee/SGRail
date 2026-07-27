import { create } from "zustand";
import type { ChatMessage, PendingRouteWizard } from "@/types/assistant.types";

/**
 * Zustand store for AI assistant chat state.
 *
 * Validates: Requirements 22.1, 23.1
 */
export interface AssistantStore {
  /** Chat message history */
  messages: ChatMessage[];
  /** Whether a request is currently in-flight */
  isLoading: boolean;
  /** Route request being filled in conversationally (departure, then preference) */
  pendingRoute: PendingRouteWizard | null;

  /** Add a message to the chat history */
  addMessage: (message: ChatMessage) => void;
  /** Set the loading state */
  setLoading: (loading: boolean) => void;
  /** Clear all messages */
  clearMessages: () => void;
  /** Set or clear the in-progress route wizard */
  setPendingRoute: (pending: PendingRouteWizard | null) => void;
}

export const useAssistantStore = create<AssistantStore>((set) => ({
  messages: [],
  isLoading: false,
  pendingRoute: null,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setLoading: (loading) => set({ isLoading: loading }),

  clearMessages: () => set({ messages: [], pendingRoute: null }),

  setPendingRoute: (pending) => set({ pendingRoute: pending }),
}));
