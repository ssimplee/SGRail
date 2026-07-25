import { create } from "zustand";
import type { ChatMessage } from "@/types/assistant.types";

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

  /** Add a message to the chat history */
  addMessage: (message: ChatMessage) => void;
  /** Set the loading state */
  setLoading: (loading: boolean) => void;
  /** Clear all messages */
  clearMessages: () => void;
}

export const useAssistantStore = create<AssistantStore>((set) => ({
  messages: [],
  isLoading: false,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setLoading: (loading) => set({ isLoading: loading }),

  clearMessages: () => set({ messages: [] }),
}));
