// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  calculateConfidence,
  ConfidenceParams,
} from "../features/journey-tracking/confidenceModel";

/**
 * Property 5: Journey Confidence Model Bounded Output
 *
 * **Validates: Requirements 7.8**
 */

// Generate arbitrary valid ConfidenceParams
const paramsArb = fc.record({
  lastGpsDistanceToExpectedStation: fc.option(
    fc.double({ min: 0, max: 5000, noNaN: true }),
    { nil: null }
  ),
  timeSinceLastGps: fc.integer({ min: 0, max: 600000 }),
  expectedTravelTime: fc.integer({ min: 0, max: 3600000 }),
  elapsedTime: fc.integer({ min: 0, max: 3600000 }),
  userConfirmedStation: fc.boolean(),
  routeSequenceIndex: fc.integer({ min: 0, max: 50 }),
  totalStops: fc.integer({ min: 1, max: 50 }),
});

describe("Property 5: Journey Confidence Model Bounded Output", () => {
  it("calculateConfidence always returns a value in [0.0, 1.0] for any valid input combination", () => {
    fc.assert(
      fc.property(paramsArb, (params: ConfidenceParams) => {
        const result = calculateConfidence(params);
        expect(result).toBeGreaterThanOrEqual(0.0);
        expect(result).toBeLessThanOrEqual(1.0);
      }),
      { numRuns: 1000 }
    );
  });

  it("calculateConfidence returns bounded value when GPS distance is null", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 600000 }),
        fc.integer({ min: 0, max: 3600000 }),
        fc.integer({ min: 0, max: 3600000 }),
        fc.boolean(),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        (
          timeSinceLastGps,
          expectedTravelTime,
          elapsedTime,
          userConfirmedStation,
          routeSequenceIndex,
          totalStops
        ) => {
          const result = calculateConfidence({
            lastGpsDistanceToExpectedStation: null,
            timeSinceLastGps,
            expectedTravelTime,
            elapsedTime,
            userConfirmedStation,
            routeSequenceIndex,
            totalStops,
          });
          expect(result).toBeGreaterThanOrEqual(0.0);
          expect(result).toBeLessThanOrEqual(1.0);
        }
      ),
      { numRuns: 500 }
    );
  });

  it("calculateConfidence returns bounded value for very large time values", () => {
    fc.assert(
      fc.property(
        fc.option(fc.double({ min: 0, max: 5000, noNaN: true }), {
          nil: null,
        }),
        fc.integer({ min: 500000, max: 600000 }),
        fc.integer({ min: 3000000, max: 3600000 }),
        fc.integer({ min: 3000000, max: 3600000 }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        (
          lastGpsDistanceToExpectedStation,
          timeSinceLastGps,
          expectedTravelTime,
          elapsedTime,
          routeSequenceIndex,
          totalStops
        ) => {
          const result = calculateConfidence({
            lastGpsDistanceToExpectedStation,
            timeSinceLastGps,
            expectedTravelTime,
            elapsedTime,
            userConfirmedStation: false,
            routeSequenceIndex,
            totalStops,
          });
          expect(result).toBeGreaterThanOrEqual(0.0);
          expect(result).toBeLessThanOrEqual(1.0);
        }
      ),
      { numRuns: 500 }
    );
  });

  it("calculateConfidence returns bounded value when expectedTravelTime is zero", () => {
    fc.assert(
      fc.property(
        fc.option(fc.double({ min: 0, max: 5000, noNaN: true }), {
          nil: null,
        }),
        fc.integer({ min: 0, max: 600000 }),
        fc.integer({ min: 0, max: 3600000 }),
        fc.boolean(),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        (
          lastGpsDistanceToExpectedStation,
          timeSinceLastGps,
          elapsedTime,
          userConfirmedStation,
          routeSequenceIndex,
          totalStops
        ) => {
          const result = calculateConfidence({
            lastGpsDistanceToExpectedStation,
            timeSinceLastGps,
            expectedTravelTime: 0,
            elapsedTime,
            userConfirmedStation,
            routeSequenceIndex,
            totalStops,
          });
          expect(result).toBeGreaterThanOrEqual(0.0);
          expect(result).toBeLessThanOrEqual(1.0);
        }
      ),
      { numRuns: 500 }
    );
  });

  it("user confirmed station always produces confidence >= 0.9", () => {
    fc.assert(
      fc.property(
        fc.option(fc.double({ min: 0, max: 5000, noNaN: true }), {
          nil: null,
        }),
        fc.integer({ min: 0, max: 600000 }),
        fc.integer({ min: 0, max: 3600000 }),
        fc.integer({ min: 0, max: 3600000 }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        (
          lastGpsDistanceToExpectedStation,
          timeSinceLastGps,
          expectedTravelTime,
          elapsedTime,
          routeSequenceIndex,
          totalStops
        ) => {
          const result = calculateConfidence({
            lastGpsDistanceToExpectedStation,
            timeSinceLastGps,
            expectedTravelTime,
            elapsedTime,
            userConfirmedStation: true,
            routeSequenceIndex,
            totalStops,
          });
          expect(result).toBeGreaterThanOrEqual(0.9);
          expect(result).toBeLessThanOrEqual(1.0);
        }
      ),
      { numRuns: 500 }
    );
  });
});
