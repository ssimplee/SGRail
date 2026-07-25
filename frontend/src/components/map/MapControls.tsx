import { Plus, Minus, Maximize2, Users, LocateFixed, Type } from "lucide-react";
import { cn } from "@/lib/utils";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  crowdLayerActive?: boolean;
  onToggleCrowd?: () => void;
  onLocateMe?: () => void;
  stationLabelsActive?: boolean;
  onToggleStationLabels?: () => void;
  className?: string;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onReset,
  crowdLayerActive,
  onToggleCrowd,
  onLocateMe,
  stationLabelsActive,
  onToggleStationLabels,
  className,
}: MapControlsProps) {
  return (
    <div
      className={cn(
        "absolute bottom-4 right-4 z-10 flex flex-col gap-1",
        className
      )}
      role="toolbar"
      aria-label="Map controls"
    >
      <button
        onClick={onZoomIn}
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-card text-foreground shadow-md border border-border transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="Zoom in"
        type="button"
      >
        <Plus className="size-5" />
      </button>
      <button
        onClick={onZoomOut}
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-card text-foreground shadow-md border border-border transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="Zoom out"
        type="button"
      >
        <Minus className="size-5" />
      </button>
      <button
        onClick={onReset}
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-card text-foreground shadow-md border border-border transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="Reset zoom"
        type="button"
      >
        <Maximize2 className="size-4" />
      </button>
      {onLocateMe && (
        <button
          onClick={onLocateMe}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-card text-foreground shadow-md border border-border transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Locate me — centre on nearest station"
          type="button"
        >
          <LocateFixed className="size-4" />
        </button>
      )}
      {onToggleStationLabels && (
        <button
          onClick={onToggleStationLabels}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg shadow-md border border-border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            stationLabelsActive
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-card text-foreground hover:bg-accent"
          )}
          aria-label={stationLabelsActive ? "Hide station labels" : "Show station labels"}
          aria-pressed={stationLabelsActive}
          type="button"
        >
          <Type className="size-4" />
        </button>
      )}
      {onToggleCrowd && (
        <button
          onClick={onToggleCrowd}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg shadow-md border border-border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            crowdLayerActive
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-card text-foreground hover:bg-accent"
          )}
          aria-label={crowdLayerActive ? "Hide crowd density layer" : "Show crowd density layer"}
          aria-pressed={crowdLayerActive}
          type="button"
        >
          <Users className="size-4" />
        </button>
      )}
    </div>
  );
}
