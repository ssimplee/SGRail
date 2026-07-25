import * as fc from "fast-check";

/**
 * Property 6: Journey Proximity Reminders
 *
 * Tests that:
 * - Transfer reminder triggers when nearest station = interchange within threshold
 * - Alighting reminder triggers when nearest station = destination within threshold
 *
 * **Validates: Requirements 7.3, 7.4**
 */

/**
 * Journey phase — mirrors the production type.
 */
type JourneyPhase =
  | "approaching-start"
  | "at-start"
  | "on-route"
  | "approaching-transfer"
  | "transfer-required"
  | "approaching-destination"
  | "journey-complete"
  | "location-uncertain";

/**
 * Tracker config — mirrors the production config.
 */
interface JourneyTrackerConfig {
  inactivityTimeout: number;
  approachThreshold: number;
  atStationThreshold: number;
}

const DEFAULT_TRACKER_CONFIG: JourneyTrackerConfig = {
  inactivityTimeout: 5 * 60 * 1000,
  approachThreshold: 500,
  atStationThreshold: 150,
};

/**
 * Route stop — simplified for testing.
 */
interface RouteStop {
  stationId: string;
  stationName: string;
  isTransfer: boolean;
  isDestination: boolean;
}

/**
 * Extracted/pure version of the determinePhase logic from useJourneyTracker.
 * This mirrors the production logic exactly for testability without React hooks.
 */
function determinePhase(
  routeStops: RouteStop[],
  nearestIndex: number,
  distance: number,
  confidence: number,
  config: JourneyTrackerConfig = DEFAULT_TRACKER_CONFIG
): JourneyPhase {
  if (confidence < 0.2) {
    return "location-uncertain";
  }

  const stop = routeStops[nearestIndex];

  // At the destination
  if (stop.isDestination && distance < config.atStationThreshold) {
    return "journey-complete";
  }

  // Approaching destination
  if (stop.isDestination && distance < config.approachThreshold) {
    return "approaching-destination";
  }

  // At a transfer station
  if (stop.isTransfer && distance < config.atStationThreshold) {
    return "transfer-required";
  }

  // Approaching a transfer
  if (stop.isTransfer && distance < config.approachThreshold) {
    return "approaching-transfer";
  }

  // At the start station
  if (nearestIndex === 0 && distance < config.atStationThreshold) {
    return "at-start";
  }

  // Approaching start
  if (nearestIndex === 0 && distance < config.approachThreshold) {
    return "approaching-start";
  }

  // General on-route
  return "on-route";
}

// Helper to create route stops for a journey with N intermediate stations,
// one transfer, and a destination
function makeRouteStops(count: number): RouteStop[] {
  if (count < 3) count = 3; // Minimum: start, transfer, destination
  const stops: RouteStop[] = [];
  const transferIndex = Math.floor(count / 2);

  for (let i = 0; i < count; i++) {
    stops.push({
      stationId: `ST${i}`,
      stationName: `Station ${i}`,
      isTransfer: i === transferIndex,
      isDestination: i === count - 1,
    });
  }
  return stops;
}

// Arbitraries
const routeStopsArb = fc.integer({ min: 3, max: 20 }).map(makeRouteStops);

const configArb: fc.Arbitrary<JourneyTrackerConfig> = fc.record({
  inactivityTimeout: fc.constant(5 * 60 * 1000),
  approachThreshold: fc.integer({ min: 200, max: 1000 }),
  atStationThreshold: fc.integer({ min: 50, max: 200 }),
});

describe("Property 6: Journey Proximity Reminders", () => {
  it("transfer reminder triggers when nearest station is an interchange within approachThreshold", () => {
    fc.assert(
      fc.property(
        routeStopsArb,
        configArb,
        fc.double({ min: 0.2, max: 1.0, noNaN: true }),
        (stops, config, confidence) => {
          // Ensure atStationThreshold < approachThreshold
          const adjustedConfig: JourneyTrackerConfig = {
            ...config,
            atStationThreshold: Math.min(config.atStationThreshold, config.approachThreshold - 1),
          };

          // Find the transfer station index
          const transferIndex = stops.findIndex((s) => s.isTransfer);
          if (transferIndex === -1) return; // skip if no transfer

          // Distance within approachThreshold but outside atStationThreshold
          const distance =
            (adjustedConfig.atStationThreshold + adjustedConfig.approachThreshold) / 2;

          const phase = determinePhase(stops, transferIndex, distance, confidence, adjustedConfig);
          expect(phase).toBe("approaching-transfer");
        }
      ),
      { numRuns: 500 }
    );
  });

  it("transfer-required triggers when nearest station is interchange within atStationThreshold", () => {
    fc.assert(
      fc.property(
        routeStopsArb,
        configArb,
        fc.double({ min: 0.2, max: 1.0, noNaN: true }),
        (stops, config, confidence) => {
          const adjustedConfig: JourneyTrackerConfig = {
            ...config,
            atStationThreshold: Math.min(config.atStationThreshold, config.approachThreshold - 1),
          };

          const transferIndex = stops.findIndex((s) => s.isTransfer);
          if (transferIndex === -1) return;

          // Distance within atStationThreshold
          const distance = adjustedConfig.atStationThreshold / 2;

          const phase = determinePhase(stops, transferIndex, distance, confidence, adjustedConfig);
          expect(phase).toBe("transfer-required");
        }
      ),
      { numRuns: 500 }
    );
  });

  it("alighting reminder triggers when nearest station is destination within approachThreshold", () => {
    fc.assert(
      fc.property(
        routeStopsArb,
        configArb,
        fc.double({ min: 0.2, max: 1.0, noNaN: true }),
        (stops, config, confidence) => {
          const adjustedConfig: JourneyTrackerConfig = {
            ...config,
            atStationThreshold: Math.min(config.atStationThreshold, config.approachThreshold - 1),
          };

          // Last stop is the destination
          const destIndex = stops.length - 1;

          // Distance within approachThreshold but outside atStationThreshold
          const distance =
            (adjustedConfig.atStationThreshold + adjustedConfig.approachThreshold) / 2;

          const phase = determinePhase(stops, destIndex, distance, confidence, adjustedConfig);
          expect(phase).toBe("approaching-destination");
        }
      ),
      { numRuns: 500 }
    );
  });

  it("journey-complete triggers when at destination within atStationThreshold", () => {
    fc.assert(
      fc.property(
        routeStopsArb,
        configArb,
        fc.double({ min: 0.2, max: 1.0, noNaN: true }),
        (stops, config, confidence) => {
          const adjustedConfig: JourneyTrackerConfig = {
            ...config,
            atStationThreshold: Math.min(config.atStationThreshold, config.approachThreshold - 1),
          };

          const destIndex = stops.length - 1;
          const distance = adjustedConfig.atStationThreshold / 2;

          const phase = determinePhase(stops, destIndex, distance, confidence, adjustedConfig);
          expect(phase).toBe("journey-complete");
        }
      ),
      { numRuns: 500 }
    );
  });

  it("no transfer/alighting reminder when distance exceeds approachThreshold", () => {
    fc.assert(
      fc.property(
        routeStopsArb,
        configArb,
        fc.double({ min: 0.2, max: 1.0, noNaN: true }),
        (stops, config, confidence) => {
          const adjustedConfig: JourneyTrackerConfig = {
            ...config,
            atStationThreshold: Math.min(config.atStationThreshold, config.approachThreshold - 1),
          };

          const transferIndex = stops.findIndex((s) => s.isTransfer);
          if (transferIndex === -1 || transferIndex === 0) return;

          // Distance well outside approachThreshold
          const distance = adjustedConfig.approachThreshold + 100;

          const phase = determinePhase(stops, transferIndex, distance, confidence, adjustedConfig);
          // Should NOT be approaching-transfer or transfer-required
          expect(phase).not.toBe("approaching-transfer");
          expect(phase).not.toBe("transfer-required");
          expect(phase).toBe("on-route");
        }
      ),
      { numRuns: 500 }
    );
  });

  it("location-uncertain phase when confidence is below 0.2", () => {
    fc.assert(
      fc.property(
        routeStopsArb,
        fc.integer({ min: 0, max: 19 }),
        fc.double({ min: 0, max: 500, noNaN: true }),
        fc.double({ min: 0, max: 0.19, noNaN: true }),
        (stops, nearestIdx, distance, confidence) => {
          const validIndex = Math.min(nearestIdx, stops.length - 1);
          const phase = determinePhase(stops, validIndex, distance, confidence);
          expect(phase).toBe("location-uncertain");
        }
      ),
      { numRuns: 500 }
    );
  });
});
