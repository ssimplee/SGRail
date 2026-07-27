/**
 * Types for the AI assistant chat interface.
 *
 * Validates: Requirements 22.1, 23.1
 */

import type { TimeMode, RoutePreference, RouteResult } from "./route.types";

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

/** A single tappable option offered under an assistant message. */
export interface ChatQuickReply {
  label: string;
  value: string;
}

/** Which slot-filling question a message's quick replies answer. */
export type RouteWizardStep = "DEPARTURE" | "PREFERENCE";

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
  /** Tappable options for a route-planning follow-up question */
  quickReplies?: ChatQuickReply[];
  /** Which question quickReplies answers, so clicks route to the right handler */
  wizardStep?: RouteWizardStep;
  /** True on a ROUTE-intent message the wizard is taking over from — the
   *  default "View stations on map" action card is redundant once the bot
   *  is about to ask follow-up questions and hand off to the Route Planner. */
  suppressActionCard?: boolean;
  /** Real computed route(s) from the agentic assistant's plan_route tool,
   *  rendered inline via RouteResultList instead of only a text summary. */
  routeResults?: RouteResult[] | null;
}

/** In-progress route request being filled in conversationally, one slot at a time. */
export interface PendingRouteWizard {
  originStationId: string;
  originName: string;
  destinationStationId: string;
  destinationName: string;
  mode?: TimeMode;
}

/** Navigation state RoutePage reads to prefill itself from a finished wizard. */
export interface RoutePrefillState {
  originStationId: string;
  destinationStationId: string;
  mode: TimeMode;
  preference: RoutePreference;
  /** Skip straight to results — only safe when no exact time is needed. */
  autoSubmit: boolean;
}

export interface AssistantChatRequest {
  message: string;
  context?: {
    currentStationId?: string | null;
    selectedRoutePreference?: string | null;
    /** UI language hint ("en" | "zh" | "ms" | "ta") so replies match it */
    language?: string | null;
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
  routeResults?: RouteResult[] | null;
}
