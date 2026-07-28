import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { STATIONS } from "../../data/stations";
import type { MapStation } from "../../data/stations";
import { haversineDistance } from "../../utils/haversine";
import type { UserLocation } from "../geolocation/geolocation.types";
import { useLocationWatch } from "../geolocation/useLocationWatch";
import { calculateConfidence } from "./confidenceModel";
import type {
  JourneyPhase,
  JourneyState,
  JourneyTrackerConfig,
  RouteStop,
} from "./journeyTracker.types";
import { DEFAULT_TRACKER_CONFIG } from "./journeyTracker.types";

/**
 * Hook that tracks user progress along a planned MRT route.
 *
 * Accepts route stops and computes the journey state including:
 * - Current phase (approaching start, on route, at transfer, etc.)
 * - Route progress (0.0 to 1.0)
 * - Confidence score combining GPS, time, route order
 * - Nearest station
 * - Next action instruction
 *
 * Does NOT store raw location history — only current + nearest.
 *
 * Validates: Requirements 7.1, 7.2, 7.5, 7.6, 7.7, 7.8, 7.9, 36.2, 36.3, 36.4
 */
export function useJourneyTracker(
  routeStops: RouteStop[],
  config: Partial<JourneyTrackerConfig> = {}
) {
  const trackerConfig: JourneyTrackerConfig = {
    ...DEFAULT_TRACKER_CONFIG,
    ...config,
  };

  const { location, isWatching, error, startWatch, stopWatch } =
    useLocationWatch({
      inactivityTimeout: trackerConfig.inactivityTimeout,
    });

  const [journeyState, setJourneyState] = useState<JourneyState>({
    isTracking: false,
    currentPhase: "approaching-start",
    nearestStation: null,
    routeProgress: 0,
    confidence: 0,
    nextAction: null,
  });

  const [userConfirmedIndex, setUserConfirmedIndex] = useState<number | null>(
    null
  );
  const journeyStartTimeRef = useRef<number>(0);
  const currentSequenceIndexRef = useRef<number>(0);
  const hasReachedStartRef = useRef<boolean>(false);

  /**
   * Start journey tracking.
   * Requirement 7.1: begins watchPosition on explicit user action.
   */
  const startTracking = useCallback(() => {
    startWatch();
    journeyStartTimeRef.current = Date.now();
    currentSequenceIndexRef.current = 0;
    hasReachedStartRef.current = false;
    setUserConfirmedIndex(null);
    setJourneyState({
      isTracking: true,
      currentPhase: "approaching-start",
      nearestStation: routeStops.length > 0 ? routeStops[0].station : null,
      routeProgress: 0,
      confidence: 0.5,
      nextAction:
        routeStops.length > 0
          ? `Head to ${routeStops[0].station.name}`
          : null,
    });
  }, [startWatch, routeStops]);

  /**
   * Stop journey tracking.
   * Requirement 7.5: stops watchPosition via clearWatch.
   */
  const stopTracking = useCallback(() => {
    stopWatch();
    setJourneyState((prev) => ({
      ...prev,
      isTracking: false,
      currentPhase: "journey-complete",
    }));
  }, [stopWatch]);

  /**
   * User confirms their current station (for underground segments).
   * Requirement 7.8: user confirmation augments GPS for underground.
   */
  const confirmStation = useCallback(
    (stationIndex: number) => {
      if (stationIndex >= 0 && stationIndex < routeStops.length) {
        setUserConfirmedIndex(stationIndex);
        currentSequenceIndexRef.current = stationIndex;
        hasReachedStartRef.current = true;
      }
    },
    [routeStops.length]
  );

  /**
   * Find the nearest station from the route to the current GPS location.
   */
  const findNearestRouteStation = useCallback(
    (loc: UserLocation): { station: MapStation; distance: number; index: number } | null => {
      if (routeStops.length === 0) return null;

      let minDist = Infinity;
      let nearest: { station: MapStation; distance: number; index: number } | null = null;

      for (let i = 0; i < routeStops.length; i++) {
        const stop = routeStops[i];
        const dist = haversineDistance(
          loc.latitude,
          loc.longitude,
          stop.station.latitude,
          stop.station.longitude
        );
        if (dist < minDist) {
          minDist = dist;
          nearest = { station: stop.station, distance: dist, index: i };
        }
      }

      return nearest;
    },
    [routeStops]
  );

  /**
   * Determine the journey phase based on proximity and sequence index.
   */
  const determinePhase = useCallback(
    (nearestIndex: number, distance: number, confidence: number): JourneyPhase => {
      if (confidence < 0.2) {
        return "location-uncertain";
      }

      const stop = routeStops[nearestIndex];

      // At the destination
      if (stop.isDestination && distance < trackerConfig.atStationThreshold) {
        return "journey-complete";
      }

      // Approaching destination
      if (stop.isDestination && distance < trackerConfig.approachThreshold) {
        return "approaching-destination";
      }

      // At a transfer station
      if (stop.isTransfer && distance < trackerConfig.atStationThreshold) {
        return "transfer-required";
      }

      // Approaching a transfer
      if (stop.isTransfer && distance < trackerConfig.approachThreshold) {
        return "approaching-transfer";
      }

      // At the start station
      if (nearestIndex === 0 && distance < trackerConfig.atStationThreshold) {
        return "at-start";
      }

      // Approaching start
      if (nearestIndex === 0 && distance < trackerConfig.approachThreshold) {
        return "approaching-start";
      }

      // General on-route
      return "on-route";
    },
    [routeStops, trackerConfig.approachThreshold, trackerConfig.atStationThreshold]
  );

  /**
   * Generate next action instruction based on phase.
   */
  const getNextAction = useCallback(
    (phase: JourneyPhase, nearestIndex: number): string | null => {
      switch (phase) {
        case "approaching-start":
        case "at-start":
          return routeStops.length > 1
            ? `Board train at ${routeStops[0].station.name}`
            : null;
        case "on-route": {
          // Find next transfer or destination
          for (let i = nearestIndex + 1; i < routeStops.length; i++) {
            if (routeStops[i].isTransfer) {
              return `Transfer at ${routeStops[i].station.name}`;
            }
            if (routeStops[i].isDestination) {
              return `Alight at ${routeStops[i].station.name}`;
            }
          }
          return null;
        }
        case "approaching-transfer":
        case "transfer-required": {
          const stop = routeStops[nearestIndex];
          return `Transfer at ${stop.station.name}`;
        }
        case "approaching-destination":
          return `Prepare to alight at ${routeStops[routeStops.length - 1].station.name}`;
        case "journey-complete":
          return "You have arrived at your destination";
        case "location-uncertain":
          return "Location uncertain — please confirm your station";
        default:
          return null;
      }
    },
    [routeStops]
  );

  /**
   * Effect: Update journey state whenever location changes.
   * Combines GPS with route order, elapsed time, and user confirmation.
   * Requirement 7.8: multi-signal fusion for underground tracking.
   */
  useEffect(() => {
    if (!journeyState.isTracking || routeStops.length === 0) return;

    const now = Date.now();
    const elapsedTime = now - journeyStartTimeRef.current;

    // Determine nearest route station
    let nearestIndex = currentSequenceIndexRef.current;
    let distance = Infinity;
    let nearestStation: MapStation | null = null;

    if (location) {
      const nearest = findNearestRouteStation(location);
      if (nearest) {
        nearestStation = nearest.station;
        distance = nearest.distance;

        // Only advance forward after the user has reached the boarding station.
        if (hasReachedStartRef.current && nearest.index >= currentSequenceIndexRef.current) {
          nearestIndex = nearest.index;
          currentSequenceIndexRef.current = nearestIndex;
        }
      }
    }

    const startStop = routeStops[0];
    const distanceToStart = location
      ? haversineDistance(
          location.latitude,
          location.longitude,
          startStop.station.latitude,
          startStop.station.longitude
        )
      : null;

    if (
      !hasReachedStartRef.current &&
      distanceToStart !== null &&
      distanceToStart < trackerConfig.atStationThreshold
    ) {
      hasReachedStartRef.current = true;
    }

    if (!hasReachedStartRef.current) {
      const confidence = calculateConfidence({
        lastGpsDistanceToExpectedStation: distanceToStart,
        timeSinceLastGps: location ? now - location.timestamp : now - journeyStartTimeRef.current,
        expectedTravelTime: 0,
        elapsedTime,
        userConfirmedStation: false,
        routeSequenceIndex: 0,
        totalStops: routeStops.length,
      });

      const isNearStart =
        distanceToStart !== null && distanceToStart < trackerConfig.approachThreshold;

      setJourneyState({
        isTracking: true,
        currentPhase: confidence < 0.2 ? "location-uncertain" : "approaching-start",
        nearestStation: nearestStation ?? startStop.station,
        routeProgress: 0,
        confidence,
        nextAction: isNearStart
          ? `Board train at ${startStop.station.name}`
          : `Go to ${startStop.station.name} to board`,
      });
      return;
    }

    // Use user-confirmed index if available and more recent
    if (userConfirmedIndex !== null && userConfirmedIndex >= nearestIndex) {
      nearestIndex = userConfirmedIndex;
      currentSequenceIndexRef.current = nearestIndex;
      nearestStation = routeStops[nearestIndex].station;
    }

    // Calculate expected travel time for current segment
    const expectedTravelTime =
      routeStops[nearestIndex]?.expectedTravelTimeFromStart ?? 0;

    // Calculate confidence score (Requirement 7.8)
    const confidence = calculateConfidence({
      lastGpsDistanceToExpectedStation: location ? distance : null,
      timeSinceLastGps: location ? now - location.timestamp : now - journeyStartTimeRef.current,
      expectedTravelTime: expectedTravelTime * 60 * 1000, // convert minutes to ms
      elapsedTime,
      userConfirmedStation: userConfirmedIndex === nearestIndex,
      routeSequenceIndex: nearestIndex,
      totalStops: routeStops.length,
    });

    // Calculate route progress (0.0 to 1.0)
    const routeProgress =
      routeStops.length > 1 ? nearestIndex / (routeStops.length - 1) : 0;

    // Determine phase
    const currentPhase = determinePhase(nearestIndex, distance, confidence);

    // Get next action
    const nextAction = getNextAction(currentPhase, nearestIndex);

    // Auto-complete if at destination
    if (currentPhase === "journey-complete") {
      stopWatch();
    }

    setJourneyState({
      isTracking: currentPhase !== "journey-complete",
      currentPhase,
      nearestStation: nearestStation ?? routeStops[nearestIndex]?.station ?? null,
      routeProgress,
      confidence,
      nextAction,
    });
  }, [
    location,
    journeyState.isTracking,
    routeStops,
    findNearestRouteStation,
    determinePhase,
    getNextAction,
    userConfirmedIndex,
    stopWatch,
  ]);

  /**
   * Sync isTracking state with isWatching from location hook.
   * When location watch stops (timeout/error), update journey state.
   */
  useEffect(() => {
    if (!isWatching && journeyState.isTracking) {
      setJourneyState((prev) => ({
        ...prev,
        isTracking: false,
      }));
    }
  }, [isWatching, journeyState.isTracking]);

  return {
    journeyState,
    locationError: error,
    startTracking,
    stopTracking,
    confirmStation,
  };
}
