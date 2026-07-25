import type { MapStation } from "@/data/stations";

interface NearestStationMarkerProps {
  station: MapStation;
}

/**
 * SVG marker rendered on the overlay at the nearest station position.
 * Displays a pulsing circle to indicate the user's nearest detected station.
 *
 * Validates: Requirements 2.7, 6.1, 6.2
 */
export function NearestStationMarker({ station }: NearestStationMarkerProps) {
  return (
    <g aria-label={`Nearest station: ${station.name}`}>
      {/* Outer pulsing ring */}
      <circle
        cx={station.x}
        cy={station.y}
        r={station.hitRadius + 12}
        fill="none"
        stroke="#16a34a"
        strokeWidth={2}
        opacity={0.6}
        pointerEvents="none"
      >
        <animate
          attributeName="r"
          from={station.hitRadius + 8}
          to={station.hitRadius + 18}
          dur="1.5s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          from="0.7"
          to="0"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Solid inner marker */}
      <circle
        cx={station.x}
        cy={station.y}
        r={station.hitRadius + 4}
        fill="rgba(22, 163, 74, 0.2)"
        stroke="#16a34a"
        strokeWidth={2.5}
        pointerEvents="none"
      />

      {/* Centre dot */}
      <circle
        cx={station.x}
        cy={station.y}
        r={4}
        fill="#16a34a"
        pointerEvents="none"
      />
    </g>
  );
}
