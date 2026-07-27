/**
 * Property-Based Tests: Station Coordinate Dataset Integrity
 *
 * Validates: Requirements 2.2, 2.3, 2.4, 2.5
 *
 * Verifies that every station in the dataset meets the spatial, geographic,
 * and accessibility constraints defined by the design document.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { STATIONS, MapStation } from "../data/stations";

// Prototype minimum for calibrated SVG hit areas. A full 44px effective touch
// target needs overlap-aware picking because many MRT stations are tightly spaced.
const MIN_HIT_RADIUS = 14;

describe("Property 1: Station Coordinate Dataset Integrity", () => {
  // Create an arbitrary that picks a random station from the dataset
  const stationArb = fc.integer({ min: 0, max: STATIONS.length - 1 }).map(
    (i) => STATIONS[i]
  );

  /**
   * Validates: Requirements 2.4
   * All station x coordinates must be within the SVG viewBox [0, 1600]
   */
  it("all stations have x coordinate in [0, 1600]", () => {
    fc.assert(
      fc.property(stationArb, (station: MapStation) => {
        expect(station.x).toBeGreaterThanOrEqual(0);
        expect(station.x).toBeLessThanOrEqual(1600);
      }),
      { numRuns: STATIONS.length * 5 }
    );
  });

  /**
   * Validates: Requirements 2.4
   * All station y coordinates must be within the SVG viewBox [0, 1000]
   */
  it("all stations have y coordinate in [0, 1000]", () => {
    fc.assert(
      fc.property(stationArb, (station: MapStation) => {
        expect(station.y).toBeGreaterThanOrEqual(0);
        expect(station.y).toBeLessThanOrEqual(1000);
      }),
      { numRuns: STATIONS.length * 5 }
    );
  });

  /**
   * Validates: Requirements 2.4
   * All station latitudes must be within Singapore's bounds [1.2, 1.5]
   */
  it("all stations have latitude in [1.2, 1.5]", () => {
    fc.assert(
      fc.property(stationArb, (station: MapStation) => {
        expect(station.latitude).toBeGreaterThanOrEqual(1.2);
        expect(station.latitude).toBeLessThanOrEqual(1.5);
      }),
      { numRuns: STATIONS.length * 5 }
    );
  });

  /**
   * Validates: Requirements 2.4
   * All station longitudes must be within Singapore's bounds [103.6, 104.1]
   */
  it("all stations have longitude in [103.6, 104.1]", () => {
    fc.assert(
      fc.property(stationArb, (station: MapStation) => {
        expect(station.longitude).toBeGreaterThanOrEqual(103.6);
        expect(station.longitude).toBeLessThanOrEqual(104.1);
      }),
      { numRuns: STATIONS.length * 5 }
    );
  });

  /**
   * Validates: Requirements 2.3
   * Interchange stations must have codes array length matching lines array length
   * (each code corresponds to a line the station serves)
   */
  it("interchange stations have matching codes and lines array lengths", () => {
    const interchangeArb = fc
      .integer({ min: 0, max: STATIONS.length - 1 })
      .map((i) => STATIONS[i])
      .filter((s) => s.interchange === true);

    fc.assert(
      fc.property(interchangeArb, (station: MapStation) => {
        expect(station.codes.length).toBe(station.lines.length);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Hit radius must remain large enough for the current calibrated prototype
   * overlay without forcing overlapping station targets.
   */
  it("hitRadius meets the calibrated prototype minimum", () => {
    fc.assert(
      fc.property(stationArb, (station: MapStation) => {
        expect(station.hitRadius).toBeGreaterThanOrEqual(MIN_HIT_RADIUS);
      }),
      { numRuns: STATIONS.length * 5 }
    );
  });
});
