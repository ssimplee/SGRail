import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  HelpCircle,
  MapPin,
  Navigation,
  Square,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import type { JourneyPhase, JourneyState } from "@/features/journey-tracking/journeyTracker.types";

/**
 * Props for the JourneyTrackingOverlay component.
 */
export interface JourneyTrackingOverlayProps {
  journeyState: JourneyState;
  onStopTracking: () => void;
  onOpenRoute?: () => void;
  nextTrainEta?: string | null;
  nextTrainStationName?: string | null;
}

/**
 * Visual configuration per journey phase.
 */
interface PhaseConfig {
  label: string;
  colour: string;
  bgColour: string;
  borderColour: string;
  icon: React.ReactNode;
  progressColour: string;
}

function getPhaseConfig(phase: JourneyPhase): PhaseConfig {
  switch (phase) {
    case "approaching-start":
      return {
        label: "Heading to start",
        colour: "text-blue-700",
        bgColour: "bg-blue-50",
        borderColour: "border-blue-200",
        icon: <Navigation className="h-4 w-4 text-blue-600" />,
        progressColour: "[&_[data-slot=progress-indicator]]:bg-blue-500",
      };
    case "at-start":
      return {
        label: "At start station",
        colour: "text-blue-700",
        bgColour: "bg-blue-50",
        borderColour: "border-blue-200",
        icon: <MapPin className="h-4 w-4 text-blue-600" />,
        progressColour: "[&_[data-slot=progress-indicator]]:bg-blue-500",
      };
    case "on-route":
      return {
        label: "On route",
        colour: "text-blue-700",
        bgColour: "bg-blue-50",
        borderColour: "border-blue-200",
        icon: <Activity className="h-4 w-4 text-blue-600" />,
        progressColour: "[&_[data-slot=progress-indicator]]:bg-blue-500",
      };
    case "approaching-transfer":
      return {
        label: "Approaching transfer",
        colour: "text-amber-700",
        bgColour: "bg-amber-50",
        borderColour: "border-amber-200",
        icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
        progressColour: "[&_[data-slot=progress-indicator]]:bg-amber-500",
      };
    case "transfer-required":
      return {
        label: "Transfer required",
        colour: "text-amber-700",
        bgColour: "bg-amber-50",
        borderColour: "border-amber-200",
        icon: <ArrowRightLeft className="h-4 w-4 text-amber-600" />,
        progressColour: "[&_[data-slot=progress-indicator]]:bg-amber-500",
      };
    case "approaching-destination":
      return {
        label: "Approaching destination",
        colour: "text-green-700",
        bgColour: "bg-green-50",
        borderColour: "border-green-200",
        icon: <MapPin className="h-4 w-4 text-green-600" />,
        progressColour: "[&_[data-slot=progress-indicator]]:bg-green-500",
      };
    case "journey-complete":
      return {
        label: "Arrived",
        colour: "text-green-700",
        bgColour: "bg-green-50",
        borderColour: "border-green-200",
        icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
        progressColour: "[&_[data-slot=progress-indicator]]:bg-green-500",
      };
    case "location-uncertain":
      return {
        label: "Location uncertain",
        colour: "text-gray-600",
        bgColour: "bg-gray-50",
        borderColour: "border-gray-200",
        icon: <HelpCircle className="h-4 w-4 text-gray-500" />,
        progressColour: "[&_[data-slot=progress-indicator]]:bg-gray-400",
      };
  }
}

/**
 * Get confidence label from a 0-1 confidence score.
 */
function getConfidenceLabel(confidence: number): {
  label: string;
  colour: string;
} {
  if (confidence >= 0.7) {
    return { label: "High", colour: "text-green-600" };
  }
  if (confidence >= 0.4) {
    return { label: "Medium", colour: "text-amber-600" };
  }
  return { label: "Low", colour: "text-gray-500" };
}

/**
 * JourneyTrackingOverlay — a floating panel displayed above the map controls
 * that shows journey tracking status, progress, and next-action instructions.
 *
 * Shows different visual states based on journey phase:
 * - approaching-transfer / transfer-required → amber warning with transfer instruction
 * - approaching-destination → green with alighting instruction
 * - location-uncertain → grey with uncertainty message
 * - journey-complete → green success with "arrived" message
 *
 * Validates: Requirements 7.3, 7.4
 */
export function JourneyTrackingOverlay({
  journeyState,
  onStopTracking,
  onOpenRoute,
  nextTrainEta,
  nextTrainStationName,
}: JourneyTrackingOverlayProps) {
  const { currentPhase, routeProgress, confidence, nextAction, nearestStation } =
    journeyState;

  const phaseConfig = getPhaseConfig(currentPhase);
  const confidenceInfo = getConfidenceLabel(confidence);
  const showBoardingTrainEta =
    Boolean(nextTrainEta) &&
    (currentPhase === "approaching-start" || currentPhase === "at-start");

  return (
    <div
      onClick={onOpenRoute}
      onKeyDown={(event) => {
        if (!onOpenRoute) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenRoute();
        }
      }}
      className={cn(
        "absolute bottom-20 left-3 right-3 z-30 rounded-xl border p-3 shadow-lg backdrop-blur-sm",
        "sm:left-auto sm:right-20 sm:bottom-24 sm:w-80",
        onOpenRoute && "cursor-pointer transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        phaseConfig.bgColour,
        phaseConfig.borderColour
      )}
      role={onOpenRoute ? "button" : "status"}
      tabIndex={onOpenRoute ? 0 : undefined}
      aria-live="polite"
      aria-label="Journey tracking status"
    >
      {/* Header row: tracking indicator + phase label + stop button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Pulsing tracking dot */}
          <span className="relative flex h-3 w-3" aria-hidden="true">
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                currentPhase === "journey-complete"
                  ? "bg-green-400"
                  : currentPhase === "location-uncertain"
                    ? "bg-gray-400"
                    : currentPhase === "approaching-transfer" ||
                        currentPhase === "transfer-required"
                      ? "bg-amber-400"
                      : "bg-blue-400"
              )}
            />
            <span
              className={cn(
                "relative inline-flex h-3 w-3 rounded-full",
                currentPhase === "journey-complete"
                  ? "bg-green-500"
                  : currentPhase === "location-uncertain"
                    ? "bg-gray-500"
                    : currentPhase === "approaching-transfer" ||
                        currentPhase === "transfer-required"
                      ? "bg-amber-500"
                      : "bg-blue-500"
              )}
            />
          </span>
          <span className={cn("text-sm font-medium", phaseConfig.colour)}>
            {phaseConfig.label}
          </span>
        </div>

        {/* Stop tracking button */}
        {currentPhase !== "journey-complete" && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onStopTracking();
            }}
            className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            aria-label="Stop tracking"
          >
            <Square className="h-3 w-3" />
            Stop
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-2">
        <Progress
          value={routeProgress * 100}
          className={cn("h-2", phaseConfig.progressColour)}
          aria-label={`Route progress: ${Math.round(routeProgress * 100)}%`}
        />
        <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
          <span>{Math.round(routeProgress * 100)}% complete</span>
          <span className={confidenceInfo.colour}>
            Confidence: {confidenceInfo.label}
          </span>
        </div>
      </div>

      {/* Next action / phase-specific content */}
      {nextAction && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-white/70 p-2">
          {phaseConfig.icon}
          <p className={cn("text-sm leading-tight", phaseConfig.colour)}>
            {nextAction}
          </p>
        </div>
      )}

      {showBoardingTrainEta && (
        <div className="mt-2 rounded-md border border-blue-100 bg-white/80 px-2.5 py-2">
          <p className="text-[11px] font-medium uppercase text-blue-600">
            Boarding station train
          </p>
          <p className="mt-0.5 text-xs font-semibold text-blue-950">
            Next from {nextTrainStationName ?? "start station"}: {nextTrainEta}
          </p>
        </div>
      )}

      {/* Nearest station info */}
      {nearestStation && currentPhase !== "journey-complete" && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
          <MapPin className="h-3 w-3" />
          <span>Near: {nearestStation.name}</span>
        </div>
      )}
    </div>
  );
}
