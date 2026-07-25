import {
  ArrowRightLeft,
  CircleDot,
  MapPin,
  Train,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { RouteStep } from "@/types/route.types";

/**
 * Colour map for MRT lines.
 */
const LINE_COLOURS: Record<string, string> = {
  NS: "bg-red-500",
  EW: "bg-green-500",
  NE: "bg-purple-500",
  CC: "bg-amber-500",
  DT: "bg-blue-600",
  TE: "bg-amber-900",
  // Fallback handled below
};

function getLineColour(line?: string): string {
  if (!line) return "bg-gray-400";
  // Support both "NS" and "North-South" style
  const code = line.toUpperCase().slice(0, 2);
  return LINE_COLOURS[code] || "bg-gray-400";
}

/**
 * Props for RouteStepList.
 */
export interface RouteStepListProps {
  steps: RouteStep[];
}

/**
 * Renders a step-by-step route instruction list with line-colour indicators.
 *
 * Each step type is visually distinct:
 * - board: train icon + station name + line colour
 * - ride: vertical coloured bar showing stations passed
 * - transfer: arrow icon with "from line → to line"
 * - alight: pin icon + destination station
 *
 * Validates: Requirements 13.1–13.5
 */
export function RouteStepList({ steps }: RouteStepListProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div
      className="flex flex-col"
      role="list"
      aria-label="Route steps"
    >
      {steps.map((step, index) => (
        <RouteStepItem key={index} step={step} isLast={index === steps.length - 1} />
      ))}
    </div>
  );
}

function RouteStepItem({ step, isLast }: { step: RouteStep; isLast: boolean }) {
  switch (step.type) {
    case "board":
      return <BoardStep step={step} />;
    case "ride":
      return <RideStep step={step} />;
    case "transfer":
      return <TransferStep step={step} />;
    case "alight":
      return <AlightStep step={step} />;
    default:
      return null;
  }
}

function BoardStep({ step }: { step: RouteStep }) {
  const lineColour = step.lineColour ? `bg-[${step.lineColour}]` : getLineColour(step.line);

  return (
    <div className="flex items-start gap-3 py-2" role="listitem">
      {/* Timeline indicator */}
      <div className="flex flex-col items-center">
        <div className={cn("h-3 w-3 rounded-full border-2 border-white shadow", lineColour)} />
        <div className={cn("w-0.5 flex-1 min-h-4", lineColour, "opacity-40")} />
      </div>
      {/* Content */}
      <div className="flex items-center gap-2 pb-1">
        <Train className="size-4 text-muted-foreground" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            Board at {step.station}
          </span>
          {step.direction && (
            <span className="text-xs text-muted-foreground">
              {step.line} Line → {step.direction}
            </span>
          )}
          {step.instruction && (
            <span className="text-xs text-muted-foreground">{step.instruction}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function RideStep({ step }: { step: RouteStep }) {
  const lineColour = step.lineColour ? `bg-[${step.lineColour}]` : getLineColour(step.line);

  return (
    <div className="flex items-stretch gap-3 py-0.5" role="listitem">
      {/* Timeline bar */}
      <div className="flex flex-col items-center">
        <div className={cn("w-0.5 flex-1 min-h-6", lineColour, "opacity-40")} />
      </div>
      {/* Content */}
      <div className="flex flex-col gap-0.5 py-1">
        <span className="text-xs text-muted-foreground">
          {step.stops !== undefined && step.stops > 0
            ? `Ride ${step.stops} stop${step.stops > 1 ? "s" : ""}`
            : "Ride"}
          {step.minutes !== undefined && step.minutes > 0
            ? ` (${step.minutes} min)`
            : ""}
        </span>
        {step.stations && step.stations.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {step.stations.map((s, i) => (
              <span
                key={i}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TransferStep({ step }: { step: RouteStep }) {
  return (
    <div className="flex items-start gap-3 py-2" role="listitem">
      {/* Timeline indicator */}
      <div className="flex flex-col items-center">
        <div className="h-3 w-3 rounded-full border-2 border-amber-300 bg-amber-100 shadow" />
        <div className="w-0.5 flex-1 min-h-4 bg-gray-200" />
      </div>
      {/* Content */}
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="size-4 text-amber-600" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            Transfer{step.station ? ` at ${step.station}` : ""}
          </span>
          {(step.fromLine || step.toLine) && (
            <span className="text-xs text-muted-foreground">
              {step.fromLine} → {step.toLine}
            </span>
          )}
          {step.walkMinutes !== undefined && step.walkMinutes > 0 && (
            <span className="text-xs text-muted-foreground">
              ~{step.walkMinutes} min walk
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AlightStep({ step }: { step: RouteStep }) {
  return (
    <div className="flex items-start gap-3 py-2" role="listitem">
      {/* Timeline indicator */}
      <div className="flex flex-col items-center">
        <div className="h-3 w-3 rounded-full border-2 border-white bg-green-500 shadow" />
      </div>
      {/* Content */}
      <div className="flex items-center gap-2">
        <MapPin className="size-4 text-green-600" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            Alight at {step.station}
          </span>
          {step.instruction && (
            <span className="text-xs text-muted-foreground">{step.instruction}</span>
          )}
        </div>
      </div>
    </div>
  );
}
