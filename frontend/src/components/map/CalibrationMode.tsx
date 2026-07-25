import { useState, useCallback, useRef, type MouseEvent } from "react";
import { STATIONS, type MapStation } from "@/data/stations";

/**
 * Development-only calibration overlay for positioning stations on the MRT map.
 *
 * Production build safety: This component is guarded by `import.meta.env.DEV`
 * at the top of CalibrationMode(). Vite statically replaces this with `false`
 * in production builds, allowing the entire component tree to be tree-shaken.
 * Verified: no console.log statements exist in frontend/src/.
 *
 * Features:
 * - Click anywhere on the SVG to display (x, y) coordinates in viewBox space
 * - Drag station markers to reposition them
 * - Toggle station name labels
 * - Adjust SVG overlay opacity with a slider
 * - Copy current station coordinates as JSON to clipboard
 *
 * Validates: Requirements 37.5, 38.4, 38.5
 */

const MAP_VIEWBOX_WIDTH = 1600;
const MAP_VIEWBOX_HEIGHT = 1000;

interface ClickedPoint {
  x: number;
  y: number;
}

interface DragState {
  stationId: string;
  startX: number;
  startY: number;
}

export function CalibrationMode() {
  // Only render in development mode
  if (!import.meta.env.DEV) return null;

  return <CalibrationPanel />;
}

function CalibrationPanel() {
  const [isActive, setIsActive] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  const [clickedPoint, setClickedPoint] = useState<ClickedPoint | null>(null);
  const [stationPositions, setStationPositions] = useState<
    Record<string, { x: number; y: number }>
  >(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    for (const s of STATIONS) {
      positions[s.id] = { x: s.x, y: s.y };
    }
    return positions;
  });

  const [dragState, setDragState] = useState<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  /** Convert a mouse event to viewBox coordinates */
  const toViewBoxCoords = useCallback(
    (e: MouseEvent<SVGSVGElement>): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const scaleX = MAP_VIEWBOX_WIDTH / rect.width;
      const scaleY = MAP_VIEWBOX_HEIGHT / rect.height;
      const x = Math.round((e.clientX - rect.left) * scaleX);
      const y = Math.round((e.clientY - rect.top) * scaleY);
      return { x, y };
    },
    [],
  );

  const handleSvgClick = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      if (dragState) return; // Don't register click when dragging
      const coords = toViewBoxCoords(e);
      if (coords) setClickedPoint(coords);
    },
    [toViewBoxCoords, dragState],
  );

  const handleMouseDown = useCallback(
    (stationId: string, e: MouseEvent) => {
      e.stopPropagation();
      const coords = toViewBoxCoords(e as unknown as MouseEvent<SVGSVGElement>);
      if (coords) {
        setDragState({ stationId, startX: coords.x, startY: coords.y });
      }
    },
    [toViewBoxCoords],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      if (!dragState) return;
      const coords = toViewBoxCoords(e);
      if (!coords) return;
      setStationPositions((prev) => ({
        ...prev,
        [dragState.stationId]: { x: coords.x, y: coords.y },
      }));
    },
    [dragState, toViewBoxCoords],
  );

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  const handleCopyJson = useCallback(async () => {
    const output = STATIONS.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      x: stationPositions[s.id]?.x ?? s.x,
      y: stationPositions[s.id]?.y ?? s.y,
    }));
    await navigator.clipboard.writeText(JSON.stringify(output, null, 2));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }, [stationPositions]);

  if (!isActive) {
    return (
      <button
        onClick={() => setIsActive(true)}
        className="fixed top-4 right-4 z-[9999] rounded bg-amber-500 px-3 py-1.5 text-xs font-bold text-black shadow-lg hover:bg-amber-400"
      >
        🔧 Calibrate
      </button>
    );
  }

  return (
    <>
      {/* Controls Panel */}
      <div className="fixed top-4 right-4 z-[9999] w-64 rounded-lg border border-amber-500/50 bg-gray-900/95 p-4 text-xs text-white shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-bold text-amber-400">🔧 Calibration Mode</span>
          <button
            onClick={() => setIsActive(false)}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Clicked point display */}
        {clickedPoint && (
          <div className="mb-3 rounded bg-gray-800 p-2 font-mono">
            Clicked: x={clickedPoint.x}, y={clickedPoint.y}
          </div>
        )}

        {/* Show labels toggle */}
        <label className="mb-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            className="accent-amber-500"
          />
          Show Labels
        </label>

        {/* Overlay opacity slider */}
        <div className="mb-3">
          <label className="mb-1 block">
            Overlay Opacity: {overlayOpacity.toFixed(2)}
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>

        {/* Copy JSON button */}
        <button
          onClick={handleCopyJson}
          className="w-full rounded bg-amber-500 px-3 py-1.5 font-bold text-black hover:bg-amber-400"
        >
          {copyFeedback ? "✓ Copied!" : "Copy JSON"}
        </button>

        <p className="mt-3 text-[10px] text-gray-400">
          Click map for coords. Drag stations to reposition. Dev mode only.
        </p>
      </div>

      {/* Calibration SVG overlay */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}`}
        className="absolute inset-0 h-full w-full"
        style={{ opacity: overlayOpacity, cursor: dragState ? "grabbing" : "crosshair" }}
        onClick={handleSvgClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Draggable station markers */}
        {STATIONS.map((station) => {
          const pos = stationPositions[station.id] ?? { x: station.x, y: station.y };
          return (
            <g key={station.id}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={station.interchange ? 10 : 7}
                fill={dragState?.stationId === station.id ? "#f59e0b" : "#ef4444"}
                fillOpacity={0.8}
                stroke="#fff"
                strokeWidth={2}
                style={{ cursor: "grab" }}
                onMouseDown={(e) => handleMouseDown(station.id, e)}
              />
              {showLabels && (
                <text
                  x={pos.x + 12}
                  y={pos.y + 4}
                  fontSize={10}
                  fill="#fff"
                  stroke="#000"
                  strokeWidth={0.3}
                  pointerEvents="none"
                >
                  {station.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </>
  );
}
