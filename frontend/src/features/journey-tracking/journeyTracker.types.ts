import type { MapStation } from "../../data/stations";

/**
 * Journey tracking types for monitoring user progress along a planned route.
 *
 * Validates: Requirements 7.1, 7.2, 7.5, 7.6, 7.7, 7.8, 7.9
 */

/**
 * Represents the current phase of the user's journey.
 * Transitions happen based on proximity to route stations and confidence model.
 */
export type JourneyPhase =
  | "approaching-start"
  | "at-start"
  | "on-route"
  | "approaching-transfer"
  | "transfer-required"
  | "approaching-destination"
  | "journey-complete"
  | "location-uncertain";

/**
 * The complete state of an active journey tracking session.
 * No raw location history is stored — only the current computed state.
 */
export interface JourneyState {
  isTracking: boolean;
  currentPhase: JourneyPhase;
  nearestStation: MapStation | null;
  routeProgress: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  nextAction: string | null; // e.g., "Transfer to EW line at Jurong East"
}

/**
 * A single step/station in the planned route used for tracking progress.
 */
export interface RouteStop {
  stationId: string;
  station: MapStation;
  isTransfer: boolean;
  isDestination: boolean;
  expectedTravelTimeFromStart: number; // minutes from journey start
}

/**
 * Configuration for the journey tracker.
 */
export interface JourneyTrackerConfig {
  /** Inactivity timeout in milliseconds before auto-stop (default: 5 min) */
  inactivityTimeout: number;
  /** Distance threshold in metres to consider "approaching" a station */
  approachThreshold: number;
  /** Distance threshold in metres to consider "at" a station */
  atStationThreshold: number;
}

export const DEFAULT_TRACKER_CONFIG: JourneyTrackerConfig = {
  inactivityTimeout: 5 * 60 * 1000, // 5 minutes
  approachThreshold: 500, // 500 metres
  atStationThreshold: 150, // 150 metres
};
