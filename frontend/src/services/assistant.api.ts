import axios from "axios";
import type {
  AssistantChatRequest,
  AssistantChatResponse,
} from "@/types/assistant.types";

const API = import.meta.env.VITE_API_BASE_URL || "/api/v1";

/**
 * Send a chat message to the AI assistant backend.
 *
 * Validates: Requirements 22.1, 23.1, 32.1
 */
export async function sendChatMessage(
  params: AssistantChatRequest
): Promise<AssistantChatResponse> {
  const { data } = await axios.post<AssistantChatResponse>(
    `${API}/assistant/chat`,
    params
  );
  return data;
}
