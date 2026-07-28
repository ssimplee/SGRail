import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Footprints,
  AlertTriangle,
  Navigation,
  Train,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataSourceLabel } from "@/components/common/DataSourceLabel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { getStationTimings } from "@/services/stations.api";
import { estimateTrainHeadway } from "@/utils/trainHeadway";
import { formatClock } from "@/utils/timeFormat";
import type { RouteResult, TimeMode } from "@/types/route.types";
import type { TimingEntry } from "@/components/station/TimingsSection";

import { LastTrainWarning } from "./LastTrainWarning";
import { RouteStepList } from "./RouteStepList";

export interface RoutePlanContext {
  mode: TimeMode;
  departureTime?: string;
}

function currentServiceDayType(date: Date): TimingEntry["dayType"] {
  const weekday = new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    weekday: "short",
  }).format(date);

  if (weekday === "Sat") return "saturday";
  if (weekday === "Sun") return "sunday_ph";
  return "weekday";
}

function normalise(value?: string | null): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getPlannedBoardingTime(
  planContext: RoutePlanContext | undefined,
  route: RouteResult,
): Date | null {
  if (!planContext) return null;
  if (planContext.mode === "LEAVE_NOW") return new Date();
  if (!planContext.departureTime) return null;

  const selectedTime = new Date(planContext.departureTime);
  if (Number.isNaN(selectedTime.getTime())) return null;

  if (planContext.mode === "ARRIVE_BY") {
    return new Date(selectedTime.getTime() - route.totalMinutes * 60_000);
  }

  return selectedTime;
}

export interface RouteResultCardProps {
  route: RouteResult;
  index: number;
  isSelected?: boolean;
  planContext?: RoutePlanContext;
  onSelect?: () => void;
  onStartTracking?: () => void;
}

export function RouteResultCard({
  route,
  index,
  isSelected = false,
  planContext,
  onSelect,
  onStartTracking,
}: RouteResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(index === 0);

  const hasWarnings = route.lastTrainWarnings && route.lastTrainWarnings.length > 0;
  const serviceAlerts = route.serviceAlerts ?? [];
  const hasServiceAlerts = serviceAlerts.length > 0;
  const boardStep = useMemo(
    () => route.steps.find((step) => step.type === "board") ?? null,
    [route.steps],
  );
  const timingsQuery = useQuery({
    queryKey: ["station-timings", boardStep?.stationId],
    queryFn: () => getStationTimings(boardStep?.stationId ?? ""),
    enabled: Boolean(boardStep?.stationId && planContext),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
  const plannedServiceNotice = useMemo(() => {
    if (!planContext || !boardStep) return null;

    const plannedBoardingTime = getPlannedBoardingTime(planContext, route);
    if (!plannedBoardingTime) return null;

    const serviceDay = currentServiceDayType(plannedBoardingTime);
    const timing = timingsQuery.data?.timings.find(
      (entry) =>
        entry.dayType === serviceDay &&
        entry.line === boardStep.line &&
        (normalise(entry.destination) === normalise(boardStep.direction) ||
          normalise(entry.direction) === normalise(boardStep.direction)),
    );

    const estimate = estimateTrainHeadway(
      plannedBoardingTime,
      `${boardStep.line}:${boardStep.direction}`,
      {
        firstTrain: timing?.firstTrain,
        lastTrain: timing?.lastTrain,
      },
    );

    if (estimate.operating || !estimate.firstTrainAt) return null;

    const adjustedArrival = new Date(
      estimate.firstTrainAt.getTime() + route.totalMinutes * 60_000,
    );

    return {
      boardingStation: boardStep.station ?? "boarding station",
      plannedBoardingLabel: formatClock(plannedBoardingTime),
      firstTrainLabel: estimate.firstTrainLabel ?? formatClock(estimate.firstTrainAt),
      estimatedArrivalLabel: formatClock(adjustedArrival),
      mode: planContext.mode,
    };
  }, [boardStep, planContext, route, timingsQuery.data]);
  const hasPlannedServiceNotice = Boolean(plannedServiceNotice);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card
        className={cn(
          "overflow-hidden transition-shadow",
          isSelected && "ring-2 ring-primary",
          (hasWarnings || hasServiceAlerts || hasPlannedServiceNotice) && "border-amber-200",
        )}
        role="article"
        aria-label={`Route option ${index + 1}: ${route.totalMinutes} minutes, ${route.transfers} transfer${route.transfers !== 1 ? "s" : ""}`}
      >
        <CollapsibleTrigger asChild>
          <button
            className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-accent/50"
            onClick={onSelect}
            aria-expanded={isExpanded}
          >
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Route {index + 1}
                </span>
                {hasServiceAlerts && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    <AlertTriangle className="size-3" />
                    Live LTA notice
                  </span>
                )}
                {hasWarnings && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Timing warning
                  </span>
                )}
                {hasPlannedServiceNotice && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Service starts later
                  </span>
                )}
              </div>

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
                    {route.transfers} transfer{route.transfers !== 1 ? "s" : ""}
                  </span>
                )}
                {route.walkingMinutes > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Footprints className="size-3.5" />
                    {route.walkingMinutes} min walk
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {route.crowdEstimate && (
                  <span className="flex items-center gap-1">
                    <Users className="size-3" />
                    {route.crowdEstimate}
                  </span>
                )}
                {route.estimatedFare && <span>~{route.estimatedFare}</span>}
              </div>
            </div>

            <div className="shrink-0 text-muted-foreground">
              {isExpanded ? (
                <ChevronUp className="size-5" />
              ) : (
                <ChevronDown className="size-5" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-4 pb-4 pt-3">
            {hasWarnings && (
              <div className="mb-3">
                <LastTrainWarning warnings={route.lastTrainWarnings} />
              </div>
            )}

            {plannedServiceNotice && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="size-4 text-amber-600" />
                  Train service not operating at the selected time
                </div>
                <p className="mt-1 leading-relaxed">
                  {plannedServiceNotice.mode === "ARRIVE_BY"
                    ? `To arrive by your selected time, you would need to board around ${plannedServiceNotice.plannedBoardingLabel}, before service starts.`
                    : `Your selected departure time is ${plannedServiceNotice.plannedBoardingLabel}, before service starts.`}
                </p>
                <p className="mt-1 font-medium">
                  First from {plannedServiceNotice.boardingStation}:{" "}
                  {plannedServiceNotice.firstTrainLabel}
                </p>
                <p className="mt-0.5">
                  Estimated arrival if you take the first train:{" "}
                  {plannedServiceNotice.estimatedArrivalLabel}
                </p>
              </div>
            )}

            {route.accessibilityWarnings && route.accessibilityWarnings.length > 0 && (
              <div className="mb-3 flex flex-col gap-1">
                {route.accessibilityWarnings.map((warning, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800"
                  >
                    <span>{warning.message} ({warning.station})</span>
                  </div>
                ))}
              </div>
            )}

            {hasServiceAlerts && (
              <div className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <span className="font-semibold">Service notice on this route</span>
                  <DataSourceLabel
                    source={serviceAlerts[0].source}
                    updatedAt={serviceAlerts[0].createdAt}
                  />
                </div>
                {serviceAlerts.map((alert) => (
                  <p key={`${alert.lineCode}-${alert.createdAt}`} className="leading-relaxed">
                    <span className="font-semibold">{alert.lineCode}</span>
                    <span> - {alert.message}</span>
                  </p>
                ))}
              </div>
            )}

            <RouteStepList steps={route.steps} />

            {route.dataFreshness && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Data as of {formatClock(route.dataFreshness)}
              </p>
            )}

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

export interface RouteResultListProps {
  routes: RouteResult[];
  planContext?: RoutePlanContext;
  onStartTracking?: (routeIndex: number) => void;
}

export function RouteResultList({
  routes,
  planContext,
  onStartTracking,
}: RouteResultListProps) {
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
          planContext={planContext}
          onSelect={() => setSelectedIndex(index)}
          onStartTracking={
            onStartTracking ? () => onStartTracking(index) : undefined
          }
        />
      ))}
    </div>
  );
}
