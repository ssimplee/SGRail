/**
 * Property-Based Tests: Station Search Correctness
 *
 * Validates: Requirements 3.7
 *
 * Verifies that the searchStations function correctly returns stations
 * when searched by their full name or any of their station codes.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { STATIONS } from "../data/stations";
import { searchStations } from "../features/map/useStationSearch";

describe("Property 3: Station Search Correctness", () => {
  // Arbitrary that picks a random station index
  const stationIndexArb = fc.integer({ min: 0, max: STATIONS.length - 1 });

  /**
   * Validates: Requirements 3.7
   * For any station, searching by its full name should return that station in the results.
   */
  it("searching by full station name returns that station in results", () => {
    fc.assert(
      fc.property(stationIndexArb, (index) => {
        const station = STATIONS[index];
        const results = searchStations(station.name);

        // The station should appear in the results
        const found = results.some((r) => r.id === station.id);
        expect(found).toBe(true);
      }),
      { numRuns: STATIONS.length * 3 }
    );
  });

  /**
   * Validates: Requirements 3.7
   * For any station, searching by its full name should return that station
   * as the top result (rank 2 = name starts with query, which is the full name).
   */
  it("searching by full station name returns that station as top result", () => {
    fc.assert(
      fc.property(stationIndexArb, (index) => {
        const station = STATIONS[index];
        const results = searchStations(station.name);

        expect(results.length).toBeGreaterThan(0);
        // The station should be the first result since searching by full name
        // gives rank 2 (starts with), and exact full name should be top
        expect(results[0].id).toBe(station.id);
      }),
      { numRuns: STATIONS.length * 3 }
    );
  });

  /**
   * Validates: Requirements 3.7
   * For any station code, searching by that exact code should return the
   * station as the #1 result (rank 3 = exact code match, highest priority).
   */
  it("searching by any station code returns that station as the first result", () => {
    // Generate a random station and then pick a random code from it
    const stationWithCodeArb = stationIndexArb.chain((index) => {
      const station = STATIONS[index];
      return fc
        .integer({ min: 0, max: station.codes.length - 1 })
        .map((codeIndex) => ({
          station,
          code: station.codes[codeIndex],
        }));
    });

    fc.assert(
      fc.property(stationWithCodeArb, ({ station, code }) => {
        const results = searchStations(code);

        expect(results.length).toBeGreaterThan(0);
        // Exact code match gets rank 3 (highest), so station should be first
        expect(results[0].id).toBe(station.id);
      }),
      { numRuns: STATIONS.length * 3 }
    );
  });
});
