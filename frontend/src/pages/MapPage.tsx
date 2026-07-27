import { useCallback, useEffect } from "react";
import { MRTMapComponent } from "@/components/map/MRTMapComponent";
import { SearchBar } from "@/components/map/SearchBar";
import { MapTapHint } from "@/components/map/MapTapHint";
import { StationPanel } from "@/components/station/StationPanel";
import { useFirstRunHint } from "@/hooks/useFirstRunHint";
import { useMapStore } from "@/store/mapStore";
import { useJourneyStore } from "@/store/journeyStore";
import { JourneyTrackingOverlay } from "@/components/map/JourneyTrackingOverlay";
import { useJourneyTracker } from "@/features/journey-tracking/useJourneyTracker";
import type { MapStation } from "@/data/stations";

/** localStorage key remembering that the "map is clickable" hint was seen */
const MAP_TAP_HINT_KEY = "sgrail.map-tap-hint-dismissed";

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

  const { visible: hintVisible, dismiss: dismissHint } =
    useFirstRunHint(MAP_TAP_HINT_KEY);

  // Opening any station proves the point the hint was making, so retire it.
  useEffect(() => {
    if (selectedStation) dismissHint();
  }, [selectedStation, dismissHint]);

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
      {/* Full width on mobile; a fixed, roomier width on desktop so the
          wrapper does not shrink to fit and squash the input. */}
      <div className="absolute top-4 left-4 right-4 z-10 md:left-4 md:right-auto md:w-[30rem]">
        <SearchBar onStationSelect={handleSearchSelect} />
      </div>

      {/* MRT Map */}
      <MRTMapComponent />

      {/* First-run nudge that the map is interactive. Suppressed mid-journey,
          where an onboarding tip is just noise. */}
      {hintVisible && !journeyState.isTracking && (
        <MapTapHint onDismiss={dismissHint} />
      )}

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
