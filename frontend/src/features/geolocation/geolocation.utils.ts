import type { MapStation } from "../../data/stations";
import { haversineDistance } from "../../utils/haversine";
import type { NearestStation, UserLocation } from "./geolocation.types";

/**
 * Singapore geographic bounding box.
 * Coordinates outside these bounds indicate the user is not in Singapore.
 *
 * Validates: Requirements 8.7
 */
const SG_BOUNDS = {
  latMin: 1.15,
  latMax: 1.48,
  lngMin: 103.6,
  lngMax: 104.1,
};

/**
 * Check whether given coordinates fall within Singapore's geographic bounds.
 */
export function isWithinSingapore(lat: number, lng: number): boolean {
  return (
    lat >= SG_BOUNDS.latMin &&
    lat <= SG_BOUNDS.latMax &&
    lng >= SG_BOUNDS.lngMin &&
    lng <= SG_BOUNDS.lngMax
  );
}

/**
 * Check whether the browser supports the Geolocation API.
 */
export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

/**
 * Find the nearest stations to a user's location, sorted by distance.
 *
 * @param location - The user's current location
 * @param stations - The full list of MRT stations to search
 * @param count - Number of nearest stations to return (default 3)
 * @returns Array of NearestStation sorted by distance ascending
 *
 * Validates: Requirements 6.1, 6.2
 */
export function findNearestStations(
  location: UserLocation,
  stations: MapStation[],
  count: number = 3
): NearestStation[] {
  const withDistances: NearestStation[] = stations.map((station) => ({
    station,
    distanceMetres: haversineDistance(
      location.latitude,
      location.longitude,
      station.latitude,
      station.longitude
    ),
  }));

  withDistances.sort((a, b) => a.distanceMetres - b.distanceMetres);

  return withDistances.slice(0, count);
}
