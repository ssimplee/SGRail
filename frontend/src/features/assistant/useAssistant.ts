import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { sendChatMessage } from "@/services/assistant.api";
import { useAssistantStore } from "@/store/assistantStore";
import { useMapStore } from "@/store/mapStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { STATIONS } from "@/data/stations";
import type {
  AssistantChatRequest,
  AssistantChatResponse,
  ChatMessage,
  RoutePrefillState,
} from "@/types/assistant.types";
import type { RoutePreference, TimeMode } from "@/types/route.types";

const DEPARTURE_OPTIONS: { label: string; value: TimeMode }[] = [
  { label: "Leave now", value: "LEAVE_NOW" },
  { label: "Leave at a specific time", value: "LEAVE_AT" },
  { label: "Arrive by a specific time", value: "ARRIVE_BY" },
];

const PREFERENCE_OPTIONS: { label: string; value: RoutePreference }[] = [
  { label: "Fastest", value: "FASTEST" },
  { label: "Least Crowded", value: "LEAST_CROWDED" },
  { label: "Fewest Transfers", value: "FEWEST_TRANSFERS" },
  { label: "Least Walking", value: "LEAST_WALKING" },
  { label: "Wheelchair Accessible", value: "WHEELCHAIR" },
  { label: "Last-Train Safe", value: "LAST_TRAIN_SAFE" },
];

/**
 * Hook managing AI assistant chat: messages, loading state, and send logic.
 * Dispatches uiAction responses to the map store for highlighting.
 *
 * Also drives the route-planning follow-up wizard: once a ROUTE-intent
 * response resolves two stations, the bot asks departure time and route
 * preference as ordinary chat turns (quick-reply chips, no backend round
 * trip) before handing off to a prefilled Route Planner — see
 * startRouteWizard/answerDeparture/answerPreference below.
 *
 * Validates: Requirements 22.1, 23.1, 29.4
 */
export function useAssistant() {
  const {
    messages,
    isLoading,
    addMessage,
    setLoading,
    clearMessages,
    pendingRoute,
    setPendingRoute,
  } = useAssistantStore();
  const { setHighlightedStations, setHighlightedRoute, clearHighlights } =
    useMapStore();
  const navigate = useNavigate();

  const startRouteWizard = useCallback(
    (originStationId: string, destinationStationId: string) => {
      const origin = STATIONS.find((s) => s.id === originStationId);
      const destination = STATIONS.find((s) => s.id === destinationStationId);
      if (!origin || !destination) return;

      setPendingRoute({
        originStationId,
        originName: origin.name,
        destinationStationId,
        destinationName: destination.name,
      });
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "When would you like to leave?",
        timestamp: Date.now(),
        wizardStep: "DEPARTURE",
        quickReplies: DEPARTURE_OPTIONS,
      });
    },
    [addMessage, setPendingRoute]
  );

  const answerDeparture = useCallback(
    (value: string, label: string) => {
      if (!pendingRoute) return;
      const mode = value as TimeMode;

      addMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: label,
        timestamp: Date.now(),
      });
      setPendingRoute({ ...pendingRoute, mode });
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "What matters most for this trip?",
        timestamp: Date.now(),
        wizardStep: "PREFERENCE",
        quickReplies: PREFERENCE_OPTIONS,
      });
    },
    [addMessage, pendingRoute, setPendingRoute]
  );

  const answerPreference = useCallback(
    (value: string, label: string) => {
      if (!pendingRoute) return;
      const preference = value as RoutePreference;
      const mode = pendingRoute.mode ?? "LEAVE_NOW";
      // An exact time is still needed for LEAVE_AT/ARRIVE_BY — hand off to
      // the Route Planner with everything filled in but let the user pick
      // that time there rather than trying to parse it out of chat text.
      const autoSubmit = mode === "LEAVE_NOW";

      addMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: label,
        timestamp: Date.now(),
      });
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: autoSubmit
          ? `Got it — planning the ${label.toLowerCase()} route from ${pendingRoute.originName} to ${pendingRoute.destinationName} now.`
          : `All set — opening the Route Planner for ${pendingRoute.originName} to ${pendingRoute.destinationName}. Just pick your ${mode === "LEAVE_AT" ? "departure" : "arrival"} time to see results.`,
        timestamp: Date.now(),
      });

      const prefill: RoutePrefillState = {
        originStationId: pendingRoute.originStationId,
        destinationStationId: pendingRoute.destinationStationId,
        mode,
        preference,
        autoSubmit,
      };
      setPendingRoute(null);
      navigate("/route", { state: prefill });
    },
    [addMessage, pendingRoute, setPendingRoute, navigate]
  );

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
      // A resolved origin+destination pair hands off to the conversational
      // route wizard instead of the generic "highlight on map" action card —
      // but only when the agentic assistant hasn't already answered with a
      // real computed route, since then there's nothing left to ask.
      const takesOverWizard =
        response.intent === "ROUTE" &&
        response.stationIds.length >= 2 &&
        !response.routeResults?.length;

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
        suppressActionCard: takesOverWizard || !!response.routeResults?.length,
        routeResults: response.routeResults,
      };

      addMessage(assistantMessage);
      handleUIAction(response);
      setLoading(false);

      if (takesOverWizard) {
        startRouteWizard(response.stationIds[0], response.stationIds[1]);
      }
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
      // The app's current UI language, so the assistant can match it —
      // callers can still override via their own context.language.
      const language = usePreferencesStore.getState().language;
      mutation.mutate({ message: text, context: { language, ...context } });
    },
    [addMessage, clearHighlights, mutation]
  );

  /** Handle a quick-reply tap, routing to the right wizard step. */
  const answerQuickReply = useCallback(
    (wizardStep: "DEPARTURE" | "PREFERENCE", value: string, label: string) => {
      if (wizardStep === "DEPARTURE") {
        answerDeparture(value, label);
      } else {
        answerPreference(value, label);
      }
    },
    [answerDeparture, answerPreference]
  );

  return {
    messages,
    isLoading,
    send,
    clearMessages,
    answerQuickReply,
    error: mutation.error,
  };
}
