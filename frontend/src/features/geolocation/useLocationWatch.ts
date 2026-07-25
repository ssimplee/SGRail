import { useCallback, useEffect, useRef, useState } from "react";

import type { UserLocation } from "./geolocation.types";
import { isGeolocationSupported, isWithinSingapore } from "./geolocation.utils";

/**
 * Configuration for location watching.
 */
export interface LocationWatchOptions {
  /** Inactivity timeout in ms before auto-stopping (default: 5 minutes) */
  inactivityTimeout?: number;
  /** Enable high accuracy GPS (default: true) */
  enableHighAccuracy?: boolean;
  /** Maximum age of cached position in ms (default: 10s) */
  maximumAge?: number;
  /** Timeout for individual position requests in ms (default: 15s) */
  timeout?: number;
}

const DEFAULT_OPTIONS: Required<LocationWatchOptions> = {
  inactivityTimeout: 5 * 60 * 1000, // 5 minutes
  enableHighAccuracy: true,
  maximumAge: 10000,
  timeout: 15000,
};

/**
 * Hook that continuously watches the user's position using navigator.geolocation.watchPosition.
 *
 * Features:
 * - Starts/stops on demand
 * - Auto-stops on inactivity timeout (no position updates for a configurable period)
 * - Auto-stops on component unmount (clearWatch)
 * - Does NOT store location history — only exposes the current position
 *
 * Validates: Requirements 7.1, 7.5, 7.6, 7.9, 36.2, 36.3, 36.4
 */
export function useLocationWatch(options?: LocationWatchOptions) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const [location, setLocation] = useState<UserLocation | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdateRef = useRef<number>(0);

  /**
   * Reset the inactivity timer. Called on each successful position update.
   */
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current !== null) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      // Auto-stop tracking after inactivity (Requirement 7.6)
      stopWatch();
    }, opts.inactivityTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.inactivityTimeout]);

  /**
   * Stop watching the user's position.
   * Clears the watchPosition subscription and inactivity timer.
   * Requirement 7.5: clearWatch on stop
   */
  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (inactivityTimerRef.current !== null) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    setIsWatching(false);
  }, []);

  /**
   * Start watching the user's position.
   * Requirement 7.1: watchPosition started on explicit user action
   */
  const startWatch = useCallback(() => {
    if (!isGeolocationSupported()) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setError(null);
    setIsWatching(true);

    const positionOptions: PositionOptions = {
      enableHighAccuracy: opts.enableHighAccuracy,
      maximumAge: opts.maximumAge,
      timeout: opts.timeout,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy, heading, speed } =
          position.coords;
        const timestamp = position.timestamp;

        // Skip positions outside Singapore silently (don't stop tracking)
        if (!isWithinSingapore(latitude, longitude)) {
          return;
        }

        const userLocation: UserLocation = {
          latitude,
          longitude,
          accuracy,
          heading: heading ?? null,
          speed: speed ?? null,
          timestamp,
        };

        // Update current location (no history stored — Requirement 7.9)
        setLocation(userLocation);
        lastUpdateRef.current = Date.now();
        setError(null);

        // Reset inactivity timer on successful update (Requirement 7.6)
        resetInactivityTimer();
      },
      (positionError) => {
        switch (positionError.code) {
          case positionError.PERMISSION_DENIED:
            setError("Location permission denied.");
            stopWatch();
            break;
          case positionError.POSITION_UNAVAILABLE:
            // Don't stop for temporary unavailability (underground)
            setError("Location temporarily unavailable.");
            break;
          case positionError.TIMEOUT:
            setError("Location request timed out.");
            break;
          default:
            setError("An unexpected geolocation error occurred.");
        }
      },
      positionOptions
    );

    // Start the inactivity timer
    resetInactivityTimer();
  }, [opts.enableHighAccuracy, opts.maximumAge, opts.timeout, resetInactivityTimer, stopWatch]);

  /**
   * Cleanup on unmount: stop watching and clear timers.
   * Ensures no GPS watch leaks when component is removed.
   */
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (inactivityTimerRef.current !== null) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, []);

  return {
    location,
    isWatching,
    error,
    startWatch,
    stopWatch,
  };
}
