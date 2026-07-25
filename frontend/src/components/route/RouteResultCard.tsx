import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Footprints,
  Navigation,
  Train,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { RouteResult } from "@/types/route.types";

import { LastTrainWarning } from "./LastTrainWarning";
import { RouteStepList } from "./RouteStepList";

/**
 * Props for the RouteResultCard component.
 */
export interface RouteResultCardProps {
  route: RouteResult;
  index: number;
  isSelected?: boolean;
  onSelect?: () => void;
  onStartTracking?: () => void;
}

/**
 * A single route result card showing summary metrics and expandable step details.
 *
 * Features:
 * - Summary row: total time, stops, transfers, walking
 * - Crowd estimate badge
 * - Expandable step-by-step instructions
 * - Last train warnings (if any)
 * - "Start tracking" button to initiate journey tracking
 *
 * On mobile, cards are collapsible to save vertical space.
 *
 * Validates: Requirements 13.1–13.6, 14.2, 14.3, 14.4, 28.5
 */
export function RouteResultCard({
  route,
  index,
  isSelected = false,
  onSelect,
  onStartTracking,
}: RouteResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(index === 0);

  const hasWarnings = route.lastTrainWarnings && route.lastTrainWarnings.length > 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card
        className={cn(
          "overflow-hidden transition-shadow",
          isSelected && "ring-2 ring-primary",
          hasWarnings && "border-amber-200",
        )}
        role="article"
        aria-label={`Route option ${index + 1}: ${route.totalMinutes} minutes, ${route.transfers} transfer${route.transfers !== 1 ? "s" : ""}`}
      >
        {/* Summary header — always visible */}
        <CollapsibleTrigger asChild>
          <button
            className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-accent/50 transition-colors"
            onClick={onSelect}
            aria-expanded={isExpanded}
          >
            <div className="flex flex-1 flex-col gap-2">
              {/* Route label */}
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Route {index + 1}
                </span>
                {hasWarnings && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    ⚠ Timing warning
                  </span>
                )}
              </div>

              {/* Summary metrics */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-1 font-semibold">
                  <Clock className="size-3.5" />
                  {route.totalMinutes} min
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Train className="size-3.5" />
                  {route.stops} stops
                </span>
                {route.transfers > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    ↔ {route.transfers} transfer{route.transfers !== 1 ? "s" : ""}
                  </span>
                )}
                {route.walkingMinutes > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Footprints className="size-3.5" />
                    {route.walkingMinutes} min walk
                  </span>
                )}
              </div>

              {/* Crowd and fare info */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {route.crowdEstimate && (
                  <span className="flex items-center gap-1">
                    <Users className="size-3" />
                    {route.crowdEstimate}
                  </span>
                )}
                {route.estimatedFare && (
                  <span>~{route.estimatedFare}</span>
                )}
              </div>
            </div>

            {/* Expand/collapse indicator */}
            <div className="shrink-0 text-muted-foreground">
              {isExpanded ? (
                <ChevronUp className="size-5" />
              ) : (
                <ChevronDown className="size-5" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expandable detail content */}
        <CollapsibleContent>
          <div className="border-t px-4 pb-4 pt-3">
            {/* Last train warnings */}
            {hasWarnings && (
              <div className="mb-3">
                <LastTrainWarning warnings={route.lastTrainWarnings} />
              </div>
            )}

            {/* Accessibility warnings */}
            {route.accessibilityWarnings && route.accessibilityWarnings.length > 0 && (
              <div className="mb-3 flex flex-col gap-1">
                {route.accessibilityWarnings.map((warning, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800"
                  >
                    <span>♿</span>
                    <span>{warning.message} ({warning.station})</span>
                  </div>
                ))}
              </div>
            )}

            {/* Step-by-step route instructions */}
            <RouteStepList steps={route.steps} />

            {/* Data freshness */}
            {route.dataFreshness && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Data as of {new Date(route.dataFreshness).toLocaleTimeString()}
              </p>
            )}

            {/* Start tracking button */}
            {onStartTracking && (
              <Button
                onClick={onStartTracking}
                size="sm"
                className="mt-3 w-full"
                variant="default"
              >
                <Navigation className="size-4" />
                Start Tracking
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/**
 * Props for the RouteResultList component.
 */
export interface RouteResultListProps {
  routes: RouteResult[];
  onStartTracking?: (routeIndex: number) => void;
}

/**
 * Renders a list of route results, showing the primary route expanded
 * and alternative routes collapsed.
 *
 * Validates: Requirements 13.6 (alternative routes)
 */
export function RouteResultList({ routes, onStartTracking }: RouteResultListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!routes || routes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
        <Train className="size-8 opacity-50" />
        <p className="text-sm">No routes found. Try different stations or preferences.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="list" aria-label="Route options">
      {routes.length > 1 && (
        <p className="text-xs text-muted-foreground">
          {routes.length} route{routes.length > 1 ? "s" : ""} found
        </p>
      )}
      {routes.map((route, index) => (
        <RouteResultCard
          key={index}
          route={route}
          index={index}
          isSelected={index === selectedIndex}
          onSelect={() => setSelectedIndex(index)}
          onStartTracking={
            onStartTracking ? () => onStartTracking(index) : undefined
          }
        />
      ))}
    </div>
  );
}
