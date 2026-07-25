import type { MapStation } from "@/data/stations";
import { STATIONS } from "@/data/stations";
import { StationHitTarget } from "./StationHitTarget";
import { CrowdMarker } from "./CrowdMarker";
import { NearestStationMarker } from "./NearestStationMarker";

/**
 * Crowd data for a single station, provided by the crowd layer.
 */
export interface StationCrowdData {
  stationId: string;
  level: "low" | "moderate" | "crowded" | "very_crowded";
}

interface SVGOverlayProps {
  onStationSelect: (station: MapStation) => void;
  selectedStationId: string | null;
  crowdLayerActive?: boolean;
  crowdData?: StationCrowdData[];
  nearestStationId?: string | null;
  showStationLabels?: boolean;
}

const MAP_VIEWBOX_WIDTH = 1600;
const MAP_VIEWBOX_HEIGHT = 1000;

/** Stroke colour for the selection ring */
const SELECTION_RING_COLOUR = "#2563eb"; // blue-600

/**
 * Transparent SVG interaction overlay positioned above the MRT map image.
 *
 * Renders:
 * - Accessible station hit targets for every station
 * - A selection ring around the currently selected station
 * - Placeholder groups for: CrowdMarkers, RouteHighlights, NearestStationMarker
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 26.5, 26.6, 26.8
 */
export function SVGOverlay({
  onStationSelect,
  selectedStationId,
  crowdLayerActive,
  crowdData,
  nearestStationId,
  showStationLabels,
}: SVGOverlayProps) {
  const selectedStation = selectedStationId
    ? STATIONS.find((s) => s.id === selectedStationId) ?? null
    : null;

  const nearestStation = nearestStationId
    ? STATIONS.find((s) => s.id === nearestStationId) ?? null
    : null;

  return (
    <svg
      viewBox={`0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}`}
      className="absolute inset-0 h-full w-full"
      role="application"
      aria-label="Interactive Singapore MRT map"
    >
      {/* Crowd markers layer — rendered when crowd layer is active */}
      <g id="crowd-markers-layer" aria-hidden={!crowdLayerActive}>
        {crowdLayerActive &&
          crowdData?.map((crowd) => {
            const station = STATIONS.find((s) => s.id === crowd.stationId);
            if (!station) return null;
            return (
              <CrowdMarker
                key={`crowd-${station.id}`}
                cx={station.x}
                cy={station.y}
                level={crowd.level}
                stationName={station.name}
              />
            );
          })}
      </g>

      {/* Placeholder: Route highlight paths layer */}
      <g id="route-highlights-layer" aria-hidden="true">
        {/* RouteHighlightPaths will be rendered here when a route is selected */}
      </g>

      {/* Nearest station marker — rendered when user location is known */}
      <g id="nearest-station-layer" aria-hidden={!nearestStation}>
        {nearestStation && <NearestStationMarker station={nearestStation} />}
      </g>

      {/* Selection ring for currently selected station */}
      {selectedStation && (
        <circle
          cx={selectedStation.x}
          cy={selectedStation.y}
          r={selectedStation.hitRadius + 6}
          fill="none"
          stroke={SELECTION_RING_COLOUR}
          strokeWidth={3}
          strokeDasharray="6 3"
          pointerEvents="none"
          aria-hidden="true"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="18"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Station hit targets — main interactive layer */}
      <g id="station-hit-targets-layer">
        {STATIONS.map((station) => (
          <StationHitTarget
            key={station.id}
            station={station}
            isSelected={station.id === selectedStationId}
            onSelect={onStationSelect}
          />
        ))}
      </g>

      {/* Station name labels — visible when toggled on */}
      {showStationLabels && (
        <g id="station-labels-layer" aria-hidden="true" pointerEvents="none">
          {STATIONS.map((station) => (
            <text
              key={`label-${station.id}`}
              x={station.x}
              y={station.y + station.hitRadius + 10}
              fontSize={8}
              textAnchor="middle"
              fill="currentColor"
              opacity={0.7}
              className="select-none"
            >
              {station.name}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}
