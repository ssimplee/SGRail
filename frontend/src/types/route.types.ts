/**
 * Route planning types for the SGRail frontend.
 *
 * Validates: Requirements 12.1–12.7
 */

export type RoutePreference =
  | "FASTEST"
  | "LEAST_CROWDED"
  | "FEWEST_TRANSFERS"
  | "LEAST_WALKING"
  | "WHEELCHAIR"
  | "LAST_TRAIN_SAFE";

export type TimeMode = "LEAVE_NOW" | "LEAVE_AT" | "ARRIVE_BY";

export interface RouteStep {
  type: "board" | "ride" | "transfer" | "alight";
  station?: string;
  stationId?: string;
  line?: string;
  lineColour?: string;
  direction?: string;
  instruction?: string;
  stops?: number;
  minutes?: number;
  fromLine?: string;
  toLine?: string;
  walkMinutes?: number;
  stations?: string[];
}

export interface RouteResult {
  totalMinutes: number;
  walkingMinutes: number;
  stops: number;
  transfers: number;
  estimatedFare: string | null;
  crowdEstimate: string | null;
  dataFreshness: string | null;
  lastTrainWarnings: Array<{
    type: string;
    station: string;
    line: string;
    [key: string]: string;
  }>;
  accessibilityWarnings: Array<{
    type: string;
    station: string;
    message: string;
  }>;
  steps: RouteStep[];
}

export interface RoutePlanRequest {
  originStationId: string;
  destinationStationId: string;
  departureTime?: string;
  mode: TimeMode;
  preference: RoutePreference;
  avoidStations?: string[];
  avoidLines?: string[];
}

export interface RoutePlanResponse {
  routes: RouteResult[];
  source: string;
  computedAt: string;
}
