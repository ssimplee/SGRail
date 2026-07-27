import { useCallback, useEffect, useRef, useState } from "react";
import { TransformContainer, type MapViewHandle } from "./TransformContainer";
import { SVGOverlay } from "./SVGOverlay";
import { CrowdLegend } from "./CrowdLegend";
import { CalibrationMode } from "./CalibrationMode";
import { NearestStationInfo } from "./NearestStationInfo";
import { LocationErrorCard } from "./LocationErrorCard";
import { useMapStore } from "@/store/mapStore";
import { STATIONS } from "@/data/stations";
import type { MapStation } from "@/data/stations";
import type { StationCrowdData } from "./SVGOverlay";
import { useCurrentLocation } from "@/features/geolocation/useCurrentLocation";
import { findNearestStations } from "@/features/geolocation/geolocation.utils";
import type { NearestStation } from "@/features/geolocation/geolocation.types";

const MAP_VIEWBOX_WIDTH = 1600;
const MAP_VIEWBOX_HEIGHT = 1000;

/**
 * Vertical offset for the floating location cards. The map fills the page and
 * MapPage puts the search bar at top-4, so cards start below it.
 */
const LOCATION_CARD_POSITION = "top-20";

/**
 * Generate demo crowd data for all stations.
 * In production this would come from the backend API.
 */
function generateDemoCrowdData(): StationCrowdData[] {
  const levels: StationCrowdData["level"][] = [
    "low",
    "moderate",
    "crowded",
    "very_crowded",
  ];
  return STATIONS.map((station, idx) => ({
    stationId: station.id,
    level: levels[idx % levels.length],
  }));
}

const demoCrowdData = generateDemoCrowdData();

export function MRTMapComponent() {
  const selectedStation = useMapStore((state) => state.selectedStation);
  const selectStation = useMapStore((state) => state.selectStation);
  const crowdLayerActive = useMapStore((state) => state.crowdLayerActive);
  const toggleCrowdLayer = useMapStore((state) => state.toggleCrowdLayer);
  const showStationLabels = useMapStore((state) => state.showStationLabels);
  const toggleStationLabels = useMapStore((state) => state.toggleStationLabels);

  const {
    location,
    status: locationStatus,
    error: locationError,
    requestLocation,
    clearLocation,
  } = useCurrentLocation();

  const [nearest, setNearest] = useState<NearestStation | null>(null);
  const mapViewRef = useRef<MapViewHandle | null>(null);

  const handleStationSelect = useCallback(
    (station: MapStation) => {
      // Toggle: deselect if already selected, otherwise select
      selectStation(
        selectedStation?.id === station.id ? null : station,
      );
    },
    [selectedStation, selectStation],
  );

  // Resolve each GPS fix to the closest station by real-world distance.
  // The map is schematic, so the raw fix has nowhere honest to be drawn —
  // the nearest station is the only thing we can point at.
  useEffect(() => {
    if (!location) {
      setNearest(null);
      return;
    }
    setNearest(findNearestStations(location, STATIONS, 1)[0] ?? null);
  }, [location]);

  // Centre on the result. Keyed on the object rather than the station id so a
  // refresh that lands on the same station still re-centres the map.
  useEffect(() => {
    if (!nearest) return;
    mapViewRef.current?.focusOnPoint(nearest.station.x, nearest.station.y);
  }, [nearest]);

  const handleViewDetails = useCallback(() => {
    if (nearest) selectStation(nearest.station);
  }, [nearest, selectStation]);

  return (
    <div className="relative h-full w-full min-h-0">
      <TransformContainer
        ref={mapViewRef}
        className="relative h-full w-full overflow-hidden bg-background"
        crowdLayerActive={crowdLayerActive}
        onToggleCrowd={toggleCrowdLayer}
        stationLabelsActive={showStationLabels}
        onToggleStationLabels={toggleStationLabels}
        onLocateMe={requestLocation}
        isLocating={locationStatus === "requesting"}
      >
        <div
          className="relative w-[1600px] h-[1000px]"
        >
          {/* Real Singapore MRT map image as background */}
          <img
            src="/mrt/singapore-mrt-map.png"
            alt="Singapore MRT network map"
            className="absolute inset-0 h-full w-full select-none object-contain"
            draggable={false}
          />
          {/* SVG interaction overlay with station hit targets */}
          <SVGOverlay
            onStationSelect={handleStationSelect}
            selectedStationId={selectedStation?.id ?? null}
            crowdLayerActive={crowdLayerActive}
            crowdData={crowdLayerActive ? demoCrowdData : undefined}
            nearestStationId={nearest?.station.id ?? null}
            showStationLabels={showStationLabels}
          />
        </div>
      </TransformContainer>

      {/* Nearest station card — shown once a fix resolves to a station */}
      {nearest && location && (
        <NearestStationInfo
          className={LOCATION_CARD_POSITION}
          nearestStation={nearest}
          accuracy={location.accuracy}
          onRefresh={requestLocation}
          onViewDetails={handleViewDetails}
          onManualSelect={clearLocation}
          onDismiss={clearLocation}
        />
      )}

      {/* Failure feedback — denied, timed out, unsupported, outside Singapore */}
      {locationError && (
        <LocationErrorCard
          className={LOCATION_CARD_POSITION}
          message={locationError}
          onDismiss={clearLocation}
          onRetry={
            locationStatus === "unsupported" ? undefined : requestLocation
          }
        />
      )}

      {/* Crowd legend — only visible when crowd layer is active */}
      {crowdLayerActive && <CrowdLegend />}

      {/* Dev-only calibration overlay */}
      <CalibrationMode />
    </div>
  );
}
