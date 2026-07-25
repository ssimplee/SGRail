import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { STATIONS, MapStation } from "./stations";

/**
 * Property-Based Tests: Station Coordinate Dataset Integrity
 *
 * Validates: Requirements 2.2, 2.3, 2.4, 2.5
 *
 * These tests verify that the Station Coordinate Dataset satisfies
 * invariants required for correct SVG overlay rendering, touch targets,
 * and geographic bounds.
 */

// ViewBox dimensions
const VIEWBOX_WIDTH = 1600;
const VIEWBOX_HEIGHT = 1000;

// Singapore geographic bounds
const SG_LAT_MIN = 1.2;
const SG_LAT_MAX = 1.5;
const SG_LNG_MIN = 103.6;
const SG_LNG_MAX = 104.1;

// Touch target accessibility requirement (WCAG 2.5.5)
const MIN_EFFECTIVE_TARGET_PX = 44;

// Default viewport and scale factor
// ViewBox is 1600x1000, typical viewport ~1200px wide
const TYPICAL_VIEWPORT_WIDTH = 1200;
const SCALE_FACTOR = TYPICAL_VIEWPORT_WIDTH / VIEWBOX_WIDTH; // 0.75

// Arbitrary generator that picks a random station from the dataset
const stationArb = fc.integer({ min: 0, max: STATIONS.length - 1 }).map(
  (i) => STATIONS[i]
);

describe("Property 1: Station Coordinate Dataset Integrity", () => {
  /**
   * **Validates: Requirements 2.4**
   * All station SVG coordinates must be within the viewBox bounds.
   */
  it("all station x coordinates are in [0, 1600] and y coordinates are in [0, 1000]", () => {
    fc.assert(
      fc.property(stationArb, (station: MapStation) => {
        expect(station.x).toBeGreaterThanOrEqual(0);
        expect(station.x).toBeLessThanOrEqual(VIEWBOX_WIDTH);
        expect(station.y).toBeGreaterThanOrEqual(0);
        expect(station.y).toBeLessThanOrEqual(VIEWBOX_HEIGHT);
      }),
      { numRuns: STATIONS.length * 3 }
    );
  });

  /**
   * **Validates: Requirements 2.4**
   * All station lat/lng must be within Singapore geographic bounds.
   */
  it("all station latitudes are in [1.2, 1.5] and longitudes are in [103.6, 104.1]", () => {
    fc.assert(
      fc.property(stationArb, (station: MapStation) => {
        expect(station.latitude).toBeGreaterThanOrEqual(SG_LAT_MIN);
        expect(station.latitude).toBeLessThanOrEqual(SG_LAT_MAX);
        expect(station.longitude).toBeGreaterThanOrEqual(SG_LNG_MIN);
        expect(station.longitude).toBeLessThanOrEqual(SG_LNG_MAX);
      }),
      { numRuns: STATIONS.length * 3 }
    );
  });

  /**
   * **Validates: Requirements 2.3**
   * Interchange stations must have matching codes and lines array lengths.
   * This ensures SVG overlay renders hit areas for all connected lines.
   */
  it("interchange stations have codes.length === lines.length", () => {
    const interchangeArb = fc
      .integer({ min: 0, max: STATIONS.length - 1 })
      .map((i) => STATIONS[i])
      .filter((s) => s.interchange);

    fc.assert(
      fc.property(interchangeArb, (station: MapStation) => {
        expect(station.codes.length).toBe(station.lines.length);
        expect(station.codes.length).toBeGreaterThan(1);
        expect(station.lines.length).toBeGreaterThan(1);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 2.2**
   * hitRadius must produce >= 44px effective touch target at default zoom.
   * Effective diameter = hitRadius * 2 * scaleFactor >= 44px
   * With scaleFactor = 1200/1600 = 0.75:
   *   hitRadius >= 44 / (2 * 0.75) = 29.33
   */
  it("hitRadius produces >= 44px effective target at default zoom", () => {
    fc.assert(
      fc.property(stationArb, (station: MapStation) => {
        const effectiveDiameter = station.hitRadius * 2 * SCALE_FACTOR;
        expect(effectiveDiameter).toBeGreaterThanOrEqual(MIN_EFFECTIVE_TARGET_PX);
      }),
      { numRuns: STATIONS.length * 3 }
    );
  });
});
