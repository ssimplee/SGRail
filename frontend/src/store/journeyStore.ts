import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RouteStop } from "@/features/journey-tracking/journeyTracker.types";

/**
 * Route result from the backend route planner.
 * Minimal interface for journey tracking purposes.
 */
export interface RouteResult {
  totalMinutes: number;
  walkingMinutes: number;
  stops: number;
  transfers: number;
  estimatedFare: string | null;
  crowdEstimate: string | null;
  dataFreshness?: string | null;
  lastTrainWarnings?: Array<Record<string, string>>;
  accessibilityWarnings?: Array<Record<string, string>>;
  serviceAlerts?: Array<{
    status: number;
    severity: "major" | "minor";
    lineCode: string;
    ltaLine: string;
    message: string;
    createdAt: string;
    source: string;
  }>;
  steps: RouteStep[];
}

export interface RouteHistoryItem {
  id: string;
  title: string;
  originStationId: string;
  destinationStationId: string;
  originStationName: string;
  destinationStationName: string;
  startedAt: string;
  totalMinutes: number;
  stops: number;
  transfers: number;
}

export interface RouteStep {
  type: "board" | "ride" | "transfer" | "alight";
  station?: string;
  stationId?: string;
  line?: string;
  lineColour?: string;
  direction?: string;
  instruction?: string;
  fromLine?: string;
  toLine?: string;
  walkMinutes?: number;
  stations?: string[];
  stops?: number;
  minutes?: number;
}

/**
 * Journey store — manages the active route and route stops for tracking.
 *
 * Validates: Requirements 7.3, 7.4
 */
export interface JourneyStore {
  /** The active route result from the route planner */
  activeRoute: RouteResult | null;
  /** The route stops derived from the active route for tracking */
  routeStops: RouteStop[];
  /** Summary for the active route, shown when returning to Route page */
  activeRouteMeta: RouteHistoryItem | null;
  /** Recent routes the user started tracking */
  routeHistory: RouteHistoryItem[];
  /** Set the active route and its derived stops */
  setActiveRoute: (
    route: RouteResult | null,
    stops: RouteStop[],
    meta?: Omit<RouteHistoryItem, "id" | "startedAt">,
  ) => void;
  /** Clear active route and stops */
  clearRoute: () => void;
}

export const useJourneyStore = create<JourneyStore>()(
  persist(
    (set) => ({
      activeRoute: null,
      routeStops: [],
      activeRouteMeta: null,
      routeHistory: [],
      setActiveRoute: (route, stops, meta) =>
        set((state) => {
          const history = state.activeRouteMeta
            ? [
                state.activeRouteMeta,
                ...state.routeHistory.filter((item) => item.id !== state.activeRouteMeta?.id),
              ].slice(0, 10)
            : state.routeHistory;

          if (!route || !meta) {
            return {
              activeRoute: route,
              routeStops: stops,
              activeRouteMeta: null,
              routeHistory: history,
            };
          }

          return {
            activeRoute: route,
            routeStops: stops,
            activeRouteMeta: {
              ...meta,
              id: `${Date.now()}-${meta.originStationId}-${meta.destinationStationId}`,
              startedAt: new Date().toISOString(),
            },
            routeHistory: history,
          };
        }),
      clearRoute: () =>
        set((state) => ({
          activeRoute: null,
          routeStops: [],
          activeRouteMeta: null,
          routeHistory: state.activeRouteMeta
            ? [
                state.activeRouteMeta,
                ...state.routeHistory.filter((item) => item.id !== state.activeRouteMeta?.id),
              ].slice(0, 10)
            : state.routeHistory,
        })),
    }),
    {
      name: "sgrail-journey",
    },
  ),
);
