import { useCallback, useRef, useState } from "react";

import {
  isGeolocationSupported,
  isWithinSingapore,
} from "./geolocation.utils";
import type { LocationStatus, UserLocation } from "./geolocation.types";

/**
 * Options for getCurrentPosition.
 * - enableHighAccuracy: request the best available position
 * - timeout: fail after 10 seconds
 * - maximumAge: accept a cached position up to 30 seconds old
 *
 * Validates: Requirements 5.1
 */
const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 30000,
};

/**
 * Hook providing one-shot current location detection with full error handling.
 *
 * State transitions:
 *   idle → requesting (user calls requestLocation)
 *   requesting → granted (success + within Singapore)
 *   requesting → denied | unavailable | timeout | unsupported | outside-singapore (failure)
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 8.1, 8.2, 8.3, 8.4, 8.5
 */
export function useCurrentLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Track whether a request is in-flight to avoid duplicate calls
  const requestingRef = useRef(false);

  /**
   * Trigger location detection.
   * Displays an explanation of why location is needed before prompting.
   * Requirement 4.1: only triggered by explicit user action (caller responsibility).
   * Requirement 4.2: explanation displayed before browser prompt.
   */
  const requestLocation = useCallback(() => {
    // Prevent duplicate concurrent requests
    if (requestingRef.current) return;

    // Reset previous state
    setError(null);
    setLocation(null);

    // Check browser support first (Requirement 8.5)
    if (!isGeolocationSupported()) {
      setStatus("unsupported");
      setError(
        "Your browser does not support geolocation. Please select a station manually."
      );
      return;
    }

    // Transition to requesting state
    setStatus("requesting");
    requestingRef.current = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        requestingRef.current = false;
        const { latitude, longitude, accuracy, heading, speed } =
          position.coords;
        const timestamp = position.timestamp;

        // Check Singapore bounds (Requirement 8.7)
        if (!isWithinSingapore(latitude, longitude)) {
          setStatus("outside-singapore");
          setError(
            "Your location appears to be outside Singapore. Please select a station manually."
          );
          return;
        }

        // Success (Requirement 5.2)
        const userLocation: UserLocation = {
          latitude,
          longitude,
          accuracy,
          heading: heading ?? null,
          speed: speed ?? null,
          timestamp,
        };

        setLocation(userLocation);
        setStatus("granted");
      },
      (positionError) => {
        requestingRef.current = false;

        switch (positionError.code) {
          case positionError.PERMISSION_DENIED:
            // Requirement 8.1
            setStatus("denied");
            setError(
              "Location permission was denied. You can select a station manually or enable location in your browser settings."
            );
            break;
          case positionError.POSITION_UNAVAILABLE:
            // Requirement 8.2
            setStatus("unavailable");
            setError(
              "Your location could not be determined. Please try again or select a station manually."
            );
            break;
          case positionError.TIMEOUT:
            // Requirement 8.3
            setStatus("timeout");
            setError(
              "Location request timed out. Please try again or select a station manually."
            );
            break;
          default:
            setStatus("unavailable");
            setError(
              "An unexpected error occurred while detecting your location. Please select a station manually."
            );
        }
      },
      POSITION_OPTIONS
    );
  }, []);

  /**
   * Clear location state and return to idle.
   * Useful when the user wants to reset or switch to manual selection.
   * Requirement 4.3: app operates without location when not granted.
   */
  const clearLocation = useCallback(() => {
    setLocation(null);
    setStatus("idle");
    setError(null);
    requestingRef.current = false;
  }, []);

  return {
    location,
    status,
    error,
    requestLocation,
    clearLocation,
  };
}
