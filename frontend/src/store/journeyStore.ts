import { create } from "zustand";
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
  estimatedFare: string;
  crowdEstimate: string;
  steps: RouteStep[];
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
  /** Set the active route and its derived stops */
  setActiveRoute: (route: RouteResult | null, stops: RouteStop[]) => void;
  /** Clear active route and stops */
  clearRoute: () => void;
}

export const useJourneyStore = create<JourneyStore>((set) => ({
  activeRoute: null,
  routeStops: [],
  setActiveRoute: (route, stops) => set({ activeRoute: route, routeStops: stops }),
  clearRoute: () => set({ activeRoute: null, routeStops: [] }),
}));
