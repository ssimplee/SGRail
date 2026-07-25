import { useCallback, useEffect } from "react";
import { MRTMapComponent } from "@/components/map/MRTMapComponent";
import { SearchBar } from "@/components/map/SearchBar";
import { StationPanel } from "@/components/station/StationPanel";
import { useMapStore } from "@/store/mapStore";
import { useJourneyStore } from "@/store/journeyStore";
import { JourneyTrackingOverlay } from "@/components/map/JourneyTrackingOverlay";
import { useJourneyTracker } from "@/features/journey-tracking/useJourneyTracker";
import type { MapStation } from "@/data/stations";

/**
 * Map page — the primary home screen showing the interactive MRT map,
 * a search bar, and a responsive station info panel.
 *
 * Validates: Requirements 1, 2, 3, 9, 28.1, 29.1, 34.5, 35.2, 35.3
 */
export function MapPage() {
  const selectedStation = useMapStore((state) => state.selectedStation);
  const selectStation = useMapStore((state) => state.selectStation);

  const { activeRoute, routeStops, clearRoute } = useJourneyStore();
  const { journeyState, startTracking, stopTracking } = useJourneyTracker(routeStops);

  // Start tracking when activeRoute is set (triggered from RoutePage)
  useEffect(() => {
    if (activeRoute && routeStops.length > 0 && !journeyState.isTracking) {
      startTracking();
    }
  }, [activeRoute, routeStops, journeyState.isTracking, startTracking]);

  const handleSearchSelect = useCallback(
    (station: MapStation) => {
      selectStation(station);
    },
    [selectStation],
  );

  const handlePanelClose = useCallback(() => {
    selectStation(null);
  }, [selectStation]);

  return (
    <div className="relative h-full w-full">
      {/* Search bar overlay */}
      <div className="absolute top-4 left-4 right-4 z-10 md:left-4 md:right-auto">
        <SearchBar onStationSelect={handleSearchSelect} />
      </div>

      {/* MRT Map */}
      <MRTMapComponent />

      {/* Journey tracking overlay — shown when tracking is active */}
      {journeyState.isTracking && (
        <JourneyTrackingOverlay
          journeyState={journeyState}
          onStopTracking={() => {
            stopTracking();
            clearRoute();
          }}
        />
      )}

      {/* Station info panel (bottom sheet on mobile, side panel on desktop) */}
      <StationPanel
        station={selectedStation}
        open={selectedStation !== null}
        onClose={handlePanelClose}
      />
    </div>
  );
}
