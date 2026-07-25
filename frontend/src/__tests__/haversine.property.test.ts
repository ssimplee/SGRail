// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { haversineDistance } from "../utils/haversine";
import { findNearestStations } from "../features/geolocation/geolocation.utils";
import { STATIONS } from "../data/stations";
import type { UserLocation } from "../features/geolocation/geolocation.types";

/**
 * Property 4: Nearest Station Computation
 *
 * **Validates: Requirements 6.1, 6.2**
 */

// Singapore bounding box for coordinate generation
const sgLat = fc.double({ min: 1.2, max: 1.5, noNaN: true });
const sgLng = fc.double({ min: 103.6, max: 104.1, noNaN: true });

describe("Property 4: Nearest Station Computation", () => {
  it("haversine distance is non-negative for any two Singapore coordinates", () => {
    fc.assert(
      fc.property(sgLat, sgLng, sgLat, sgLng, (lat1, lon1, lat2, lon2) => {
        const distance = haversineDistance(lat1, lon1, lat2, lon2);
        expect(distance).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 }
    );
  });

  it("haversine distance is symmetric: dist(A,B) === dist(B,A)", () => {
    fc.assert(
      fc.property(sgLat, sgLng, sgLat, sgLng, (lat1, lon1, lat2, lon2) => {
        const distAB = haversineDistance(lat1, lon1, lat2, lon2);
        const distBA = haversineDistance(lat2, lon2, lat1, lon1);
        expect(distAB).toBeCloseTo(distBA, 10);
      }),
      { numRuns: 500 }
    );
  });

  it("haversine distance to itself is 0", () => {
    fc.assert(
      fc.property(sgLat, sgLng, (lat, lon) => {
        const distance = haversineDistance(lat, lon, lat, lon);
        expect(distance).toBe(0);
      }),
      { numRuns: 200 }
    );
  });

  it("findNearestStations returns at least 3 stations for any Singapore coordinate", () => {
    fc.assert(
      fc.property(sgLat, sgLng, (lat, lng) => {
        const location: UserLocation = {
          latitude: lat,
          longitude: lng,
          accuracy: 10,
          heading: null,
          speed: null,
          timestamp: Date.now(),
        };
        const nearest = findNearestStations(location, STATIONS);
        expect(nearest.length).toBeGreaterThanOrEqual(3);
      }),
      { numRuns: 200 }
    );
  });

  it("findNearestStations returns results sorted in ascending order of distance", () => {
    fc.assert(
      fc.property(sgLat, sgLng, (lat, lng) => {
        const location: UserLocation = {
          latitude: lat,
          longitude: lng,
          accuracy: 10,
          heading: null,
          speed: null,
          timestamp: Date.now(),
        };
        const nearest = findNearestStations(location, STATIONS, 5);
        for (let i = 1; i < nearest.length; i++) {
          expect(nearest[i].distanceMetres).toBeGreaterThanOrEqual(
            nearest[i - 1].distanceMetres
          );
        }
      }),
      { numRuns: 200 }
    );
  });
});
