import { useCallback, type KeyboardEvent } from "react";
import type { MapStation } from "@/data/stations";
import { LINE_COLORS } from "@/data/lineColors";

interface StationHitTargetProps {
  station: MapStation;
  isSelected: boolean;
  onSelect: (station: MapStation) => void;
}

/**
 * Renders a visible station dot + transparent hit target circle.
 * The visible dot shows the station's primary line colour.
 * The larger transparent circle ensures minimum 44px touch targets.
 */
export function StationHitTarget({
  station,
  isSelected,
  onSelect,
}: StationHitTargetProps) {
  const handleClick = useCallback(() => {
    onSelect(station);
  }, [onSelect, station]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<SVGGElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(station);
      }
    },
    [onSelect, station],
  );

  const effectiveRadius = station.interchange
    ? station.hitRadius * 1.15
    : station.hitRadius;

  // Primary line colour for the visible dot
  const lineColour = LINE_COLORS[station.lines[0]] || "#666";
  const dotRadius = station.interchange ? 6 : 4;

  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={`${station.name} MRT station`}
      aria-pressed={isSelected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="cursor-pointer outline-none focus-visible:[&>circle:first-child]:stroke-blue-500 focus-visible:[&>circle:first-child]:stroke-[3]"
      data-station-id={station.id}
    >
      {/* Transparent hit area (large touch target) */}
      <circle
        cx={station.x}
        cy={station.y}
        r={effectiveRadius}
        fill="transparent"
        stroke="transparent"
        pointerEvents="all"
      />
      {/* Visible station dot — very subtle until selected */}
      <circle
        cx={station.x}
        cy={station.y}
        r={dotRadius}
        fill={isSelected ? "#2563eb" : lineColour}
        stroke={station.interchange ? lineColour : "white"}
        strokeWidth={station.interchange ? 2.5 : 1.5}
        opacity={isSelected ? 1 : 0.15}
        pointerEvents="none"
      />
    </g>
  );
}
