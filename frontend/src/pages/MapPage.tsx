import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MRTMapComponent } from "@/components/map/MRTMapComponent";
import { SearchBar } from "@/components/map/SearchBar";
import { MapIntroDialog } from "@/components/map/MapIntroDialog";
import { StationPanel } from "@/components/station/StationPanel";
import { useFirstRunHint } from "@/hooks/useFirstRunHint";
import { useMapStore } from "@/store/mapStore";
import { useJourneyStore } from "@/store/journeyStore";
import { JourneyTrackingOverlay } from "@/components/map/JourneyTrackingOverlay";
import { useJourneyTracker } from "@/features/journey-tracking/useJourneyTracker";
import { estimateTrainHeadway } from "@/utils/trainHeadway";
import type { MapStation } from "@/data/stations";

/** localStorage key remembering that the map intro dialog has been seen */
const MAP_INTRO_KEY = "sgrail.map-intro-seen";

/**
 * Map page — the primary home screen showing the interactive MRT map,
 * a search bar, and a responsive station info panel.
 *
 * Validates: Requirements 1, 2, 3, 9, 28.1, 29.1, 34.5, 35.2, 35.3
 */
export function MapPage() {
  const navigate = useNavigate();
  const selectedStation = useMapStore((state) => state.selectedStation);
  const selectStation = useMapStore((state) => state.selectStation);

  const { activeRoute, routeStops, clearRoute } = useJourneyStore();
  const { journeyState, startTracking, stopTracking } = useJourneyTracker(routeStops);
  const boardingTrain = useMemo(() => {
    const boardStep = activeRoute?.steps.find((step) => step.type === "board");
    if (!boardStep) return null;
    return {
      eta: estimateTrainHeadway(new Date(), `${boardStep.line}:${boardStep.direction}`).nextLabel,
      stationId: boardStep.stationId ?? null,
      stationName: boardStep.station ?? null,
    };
  }, [activeRoute]);

  const { visible: introVisible, dismiss: dismissIntro } =
    useFirstRunHint(MAP_INTRO_KEY);

  // Opening a station proves the point the intro was making, so retire it —
  // this also covers arriving via search, or deep-linking into a station.
  useEffect(() => {
    if (selectedStation) dismissIntro();
  }, [selectedStation, dismissIntro]);

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

      {/* First-run intro. Suppressed mid-journey, where a modal over the map
          would be actively unhelpful. */}
      <MapIntroDialog
        open={introVisible && !journeyState.isTracking}
        onDismiss={dismissIntro}
      />

      {/* Journey tracking overlay — shown when tracking is active */}
      {journeyState.isTracking && (
        <JourneyTrackingOverlay
          journeyState={journeyState}
          nextTrainEta={boardingTrain?.eta}
          nextTrainStationId={boardingTrain?.stationId}
          nextTrainStationName={boardingTrain?.stationName}
          onOpenRoute={() => navigate("/route")}
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
