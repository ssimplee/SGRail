/**
 * Types for the AI assistant chat interface.
 *
 * Validates: Requirements 22.1, 23.1
 */

export type UIAction =
  | "HIGHLIGHT_STATIONS"
  | "HIGHLIGHT_ROUTE"
  | "OPEN_STATION_PANEL"
  | "OPEN_ROUTE_RESULT"
  | "SHOW_WARNING";

export type AssistantIntent =
  | "ROUTE"
  | "LAST_TRAIN"
  | "CROWD"
  | "TRANSFER"
  | "ACCESSIBILITY"
  | "FACILITY"
  | "INCIDENT"
  | "OUT_OF_SCOPE";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  /** Structured data from assistant responses */
  stationIds?: string[];
  lineCodes?: string[];
  route?: string[] | null;
  uiAction?: UIAction | null;
  intent?: AssistantIntent;
  warning?: string | null;
  dataFreshness?: string | null;
}

export interface AssistantChatRequest {
  message: string;
  context?: {
    currentStationId?: string | null;
    selectedRoutePreference?: string | null;
  };
}

export interface AssistantChatResponse {
  reply: string;
  intent: AssistantIntent;
  stationIds: string[];
  lineCodes: string[];
  route: string[] | null;
  warning: string | null;
  uiAction: UIAction | null;
  dataFreshness: string | null;
}
