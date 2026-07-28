import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { getStationTimings } from "@/services/stations.api";
import { formatClock } from "@/utils/timeFormat";
import type { MapStation } from "@/data/stations";
import type { TimingEntry } from "@/components/station/TimingsSection";

/** localStorage key remembering that the map intro dialog has been seen */
const MAP_INTRO_KEY = "sgrail.map-intro-seen";

function currentServiceDayType(): TimingEntry["dayType"] {
  const weekday = new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    weekday: "short",
  }).format(new Date());

  if (weekday === "Sat") return "saturday";
  if (weekday === "Sun") return "sunday_ph";
  return "weekday";
}

function normalise(value?: string | null): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

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
  const boardStep = useMemo(
    () => activeRoute?.steps.find((step) => step.type === "board") ?? null,
    [activeRoute],
  );
  const boardingTimingQuery = useQuery({
    queryKey: ["station-timings", boardStep?.stationId],
    queryFn: () => getStationTimings(boardStep?.stationId ?? ""),
    enabled: Boolean(boardStep?.stationId),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
  const boardingTrain = useMemo(() => {
    if (!activeRoute || !boardStep) return null;
    const serviceDay = currentServiceDayType();
    const timing = boardingTimingQuery.data?.timings.find(
      (entry) =>
        entry.dayType === serviceDay &&
        entry.line === boardStep.line &&
        (normalise(entry.destination) === normalise(boardStep.direction) ||
          normalise(entry.direction) === normalise(boardStep.direction)),
    );
    const estimate = estimateTrainHeadway(
      new Date(),
      `${boardStep.line}:${boardStep.direction}`,
      {
        firstTrain: timing?.firstTrain,
        lastTrain: timing?.lastTrain,
      },
    );
    const serviceStartArrival =
      !estimate.operating && estimate.firstTrainAt
        ? new Date(estimate.firstTrainAt.getTime() + activeRoute.totalMinutes * 60_000)
        : null;

    return {
      eta: estimate.nextLabel,
      operating: estimate.operating,
      firstTrainLabel: estimate.firstTrainLabel,
      serviceNotice: estimate.operating
        ? null
        : "Train service is closed now. Walk, take a cab, or cycle if you need to travel before service starts.",
      serviceStartArrivalLabel: serviceStartArrival ? formatClock(serviceStartArrival) : null,
      stationId: boardStep.stationId ?? null,
      stationName: boardStep.station ?? null,
    };
  }, [activeRoute, boardStep, boardingTimingQuery.data]);

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
          nextTrainOperating={boardingTrain?.operating}
          nextTrainStationId={boardingTrain?.stationId}
          nextTrainStationName={boardingTrain?.stationName}
          firstTrainLabel={boardingTrain?.firstTrainLabel}
          serviceNotice={boardingTrain?.serviceNotice}
          serviceStartArrivalLabel={boardingTrain?.serviceStartArrivalLabel}
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
