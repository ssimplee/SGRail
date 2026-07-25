import { useCallback } from "react";
import { TransformContainer } from "./TransformContainer";
import { SVGOverlay } from "./SVGOverlay";
import { CrowdLegend } from "./CrowdLegend";
import { CalibrationMode } from "./CalibrationMode";
import { useMapStore } from "@/store/mapStore";
import { STATIONS } from "@/data/stations";
import type { MapStation } from "@/data/stations";
import type { StationCrowdData } from "./SVGOverlay";

const MAP_VIEWBOX_WIDTH = 1600;
const MAP_VIEWBOX_HEIGHT = 1000;

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

  const handleStationSelect = useCallback(
    (station: MapStation) => {
      // Toggle: deselect if already selected, otherwise select
      selectStation(
        selectedStation?.id === station.id ? null : station,
      );
    },
    [selectedStation, selectStation],
  );

  return (
    <div className="relative h-full w-full min-h-0">
      <TransformContainer
        className="relative h-full w-full overflow-hidden bg-background"
        crowdLayerActive={crowdLayerActive}
        onToggleCrowd={toggleCrowdLayer}
        stationLabelsActive={showStationLabels}
        onToggleStationLabels={toggleStationLabels}
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
            showStationLabels={showStationLabels}
          />
        </div>
      </TransformContainer>

      {/* Crowd legend — only visible when crowd layer is active */}
      {crowdLayerActive && <CrowdLegend />}

      {/* Dev-only calibration overlay */}
      <CalibrationMode />
    </div>
  );
}
