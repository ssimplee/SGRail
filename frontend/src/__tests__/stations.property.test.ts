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

/**
 * Default zoom scaling factor:
 * The SVG viewBox is 1600 units wide and renders into ~1200px viewport width.
 * scaleFactor = viewportWidth / viewBoxWidth = 1200 / 1600 = 0.75
 */
const DEFAULT_SCALE_FACTOR = 1200 / 1600;

/**
 * Minimum effective touch target in CSS pixels per WCAG 2.5.5 / Requirement 2.2
 */
const MIN_TOUCH_TARGET_PX = 44;

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
   * Validates: Requirements 2.2
   * Hit radius must produce >= 44px effective touch target at default zoom.
   * Effective diameter = hitRadius * 2 * scaleFactor >= 44px
   */
  it("hitRadius produces >= 44px effective target at default zoom", () => {
    fc.assert(
      fc.property(stationArb, (station: MapStation) => {
        const effectiveDiameterPx = station.hitRadius * 2 * DEFAULT_SCALE_FACTOR;
        expect(effectiveDiameterPx).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
      }),
      { numRuns: STATIONS.length * 5 }
    );
  });
});
