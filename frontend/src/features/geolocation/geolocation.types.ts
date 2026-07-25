import type { MapStation } from "../../data/stations";

/**
 * Geolocation types for GPS-based nearest station detection and journey tracking.
 *
 * Validates: Requirements 5.2, 8.7
 */

export type LocationStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported"
  | "outside-singapore";

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface NearestStation {
  station: MapStation;
  distanceMetres: number;
}
