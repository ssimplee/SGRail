import { useState, useCallback, useMemo, useEffect } from "react";
import { Navigation, Bookmark, Loader2, AlertCircle, Clock, History, Square } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RouteInputForm } from "@/components/route/RouteInputForm";
import { PreferenceSelector } from "@/components/route/PreferenceSelector";
import { RouteResultList } from "@/components/route/RouteResultCard";
import { useRoutePlanner } from "@/features/routes/useRoutePlanner";
import { useMapStore } from "@/store/mapStore";
import { useJourneyStore } from "@/store/journeyStore";
import { createSavedRoute } from "@/services/user.api";
import { STATIONS } from "@/data/stations";
import { formatClock } from "@/utils/timeFormat";
import type { RoutePreference, RouteResult } from "@/types/route.types";
import type { RouteStop } from "@/features/journey-tracking/journeyTracker.types";

/**
 * Extract an ordered list of station IDs from a route result's steps.
 * Used to highlight the route path on the map.
 */
function extractStationIds(route: RouteResult): string[] {
  const ids: string[] = [];
  for (const step of route.steps) {
    if (step.stationId && !ids.includes(step.stationId)) {
      ids.push(step.stationId);
    }
    // Ride steps contain station codes — try to resolve them to station IDs
    if (step.type === "ride" && step.stations) {
      for (const code of step.stations) {
        const station = STATIONS.find(
          (s) => s.code === code || s.codes.includes(code)
        );
        if (station && !ids.includes(station.id)) {
          ids.push(station.id);
        }
      }
    }
  }
  return ids;
}

/**
 * Convert a RouteResult into RouteStop[] for journey tracking.
 */
function deriveRouteStops(route: RouteResult): RouteStop[] {
  const stops: RouteStop[] = [];
  let cumulativeMinutes = 0;

  for (const step of route.steps) {
    if (step.type === "board" && step.stationId) {
      const station = STATIONS.find((s) => s.id === step.stationId);
      if (station) {
        stops.push({
          stationId: step.stationId,
          station,
          isTransfer: false,
          isDestination: false,
          expectedTravelTimeFromStart: cumulativeMinutes,
        });
      }
    } else if (step.type === "ride" && step.stations) {
      const rideMinutes = step.minutes ?? 0;
      const perStop =
        step.stations.length > 0 ? rideMinutes / step.stations.length : 0;
      for (let i = 0; i < step.stations.length; i++) {
        cumulativeMinutes += perStop;
        const code = step.stations[i];
        const station = STATIONS.find(
          (s) => s.code === code || s.codes.includes(code)
        );
        if (station) {
          stops.push({
            stationId: station.id,
            station,
            isTransfer: false,
            isDestination: false,
            expectedTravelTimeFromStart: cumulativeMinutes,
          });
        }
      }
    } else if (step.type === "transfer" && step.stationId) {
      cumulativeMinutes += step.walkMinutes ?? 0;
      const station = STATIONS.find((s) => s.id === step.stationId);
      if (station) {
        stops.push({
          stationId: step.stationId,
          station,
          isTransfer: true,
          isDestination: false,
          expectedTravelTimeFromStart: cumulativeMinutes,
        });
      }
    } else if (step.type === "alight" && step.stationId) {
      const station = STATIONS.find((s) => s.id === step.stationId);
      if (station) {
        stops.push({
          stationId: step.stationId,
          station,
          isTransfer: false,
          isDestination: true,
          expectedTravelTimeFromStart: cumulativeMinutes,
        });
      }
    }
  }
  return stops;
}

/**
 * Full route planning page.
 *
 * Flow:
 * 1. User fills RouteInputForm (from/to/time mode)
 * 2. User picks a PreferenceSelector preference
 * 3. Clicks "Plan Route" → calls backend POST /routes/plan
 * 4. Results display as RouteResultList (expandable cards)
 * 5. User can click "Start Tracking" → store in journeyStore
 * 6. User can click "Save Route" → saves to backend
 *
 * Validates: Requirements 11.1–11.4, 13.1–13.6
 */
export function RoutePage() {
  const [preference, setPreference] = useState<RoutePreference>("FASTEST");
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [lastRequest, setLastRequest] = useState<{
    originStationId: string;
    destinationStationId: string;
  } | null>(null);
  const [pendingRouteIndex, setPendingRouteIndex] = useState<number | null>(null);

  const { planRoute, data, isLoading, error, reset } = useRoutePlanner();
  const setHighlightedRoute = useMapStore((s) => s.setHighlightedRoute);
  const clearHighlights = useMapStore((s) => s.clearHighlights);
  const activeRoute = useJourneyStore((s) => s.activeRoute);
  const activeRouteMeta = useJourneyStore((s) => s.activeRouteMeta);
  const routeHistory = useJourneyStore((s) => s.routeHistory);
  const setActiveRoute = useJourneyStore((s) => s.setActiveRoute);
  const clearRoute = useJourneyStore((s) => s.clearRoute);
  const navigate = useNavigate();

  // Save route mutation
  const saveRouteMutation = useMutation({
    mutationFn: createSavedRoute,
  });

  // Extract route station IDs when routes change for map highlighting
  const routes = data?.routes ?? [];

  // Highlight selected route on map whenever selection changes
  const highlightedIds = useMemo(() => {
    if (routes.length === 0) return null;
    const selected = routes[selectedRouteIndex];
    if (!selected) return null;
    return extractStationIds(selected);
  }, [routes, selectedRouteIndex]);

  // Apply highlight to map store
  useEffect(() => {
    if (highlightedIds) {
      setHighlightedRoute(highlightedIds);
    } else {
      clearHighlights();
    }
    return () => {
      clearHighlights();
    };
  }, [highlightedIds, setHighlightedRoute, clearHighlights]);

  const handlePlanRoute = useCallback(
    (params: {
      originStationId: string;
      destinationStationId: string;
      mode: "LEAVE_NOW" | "LEAVE_AT" | "ARRIVE_BY";
      departureTime?: string;
    }) => {
      setSelectedRouteIndex(0);
      setLastRequest({
        originStationId: params.originStationId,
        destinationStationId: params.destinationStationId,
      });
      planRoute({
        ...params,
        preference,
      });
    },
    [preference, planRoute]
  );

  const startRouteTracking = useCallback(
    (routeIndex: number) => {
      const route = routes[routeIndex];
      if (!route) return;
      const routeStops = deriveRouteStops(route);
      const origin = STATIONS.find((s) => s.id === lastRequest?.originStationId);
      const destination = STATIONS.find((s) => s.id === lastRequest?.destinationStationId);
      setActiveRoute(
        route,
        routeStops,
        {
          title: `${origin?.name ?? "Origin"} to ${destination?.name ?? "Destination"}`,
          originStationId: lastRequest?.originStationId ?? "",
          destinationStationId: lastRequest?.destinationStationId ?? "",
          originStationName: origin?.name ?? "Origin",
          destinationStationName: destination?.name ?? "Destination",
          totalMinutes: route.totalMinutes,
          stops: route.stops,
          transfers: route.transfers,
        }
      );
      toast.success("Journey tracking started", {
        description: "You'll receive transfer and alighting reminders.",
      });
      navigate("/");
    },
    [lastRequest, routes, setActiveRoute, navigate]
  );

  const handleStartTracking = useCallback(
    (routeIndex: number) => {
      if (activeRoute) {
        setPendingRouteIndex(routeIndex);
        return;
      }
      startRouteTracking(routeIndex);
    },
    [activeRoute, startRouteTracking]
  );

  const handleConfirmOverwriteRoute = useCallback(() => {
    if (pendingRouteIndex === null) return;
    startRouteTracking(pendingRouteIndex);
    setPendingRouteIndex(null);
  }, [pendingRouteIndex, startRouteTracking]);

  const pendingRoute = pendingRouteIndex !== null ? routes[pendingRouteIndex] : null;
  const pendingRouteTitle = lastRequest
    ? `${STATIONS.find((s) => s.id === lastRequest.originStationId)?.name ?? "Origin"} to ${
        STATIONS.find((s) => s.id === lastRequest.destinationStationId)?.name ?? "Destination"
      }`
    : "new route";

  const handleSaveRoute = useCallback(() => {
    if (!lastRequest) return;
    saveRouteMutation.mutate({
      originStationId: lastRequest.originStationId,
      destinationStationId: lastRequest.destinationStationId,
      preference,
    });
  }, [lastRequest, preference, saveRouteMutation]);

  const handleStopCurrentRoute = useCallback(() => {
    clearRoute();
    toast.success("Journey tracking stopped", {
      description: "The route was moved to your chosen route history.",
    });
  }, [clearRoute]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
          <Navigation className="h-5 w-5 text-red-600" />
        </div>
        <h1 className="text-lg font-bold text-foreground">Route Planning</h1>
      </div>

      {/* Route Input Form */}
      <RouteInputForm onSubmit={handlePlanRoute} isLoading={isLoading} />

      {/* Current tracked route */}
      {activeRoute && activeRouteMeta && (
        <div className="border-t bg-blue-50/60 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-blue-900">Current route</p>
              <p className="text-xs text-blue-700">{activeRouteMeta.title}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                <Clock className="size-3" />
                Tracking
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleStopCurrentRoute}
                className="h-8 border-blue-200 bg-white text-blue-800 hover:bg-blue-50"
              >
                <Square className="size-3" />
                Stop
              </Button>
            </div>
          </div>
          <RouteResultList routes={[activeRoute as RouteResult]} />
        </div>
      )}

      {/* Preference Selector */}
      <div className="border-t px-4 py-3">
        <PreferenceSelector value={preference} onChange={setPreference} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Route planning failed</p>
            <p className="text-xs opacity-80">
              {error.message || "Unable to plan route. Please try again."}
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Planning your route…</span>
        </div>
      )}

      {/* Route Results */}
      {!isLoading && routes.length > 0 && (
        <div className="flex flex-col gap-3 border-t px-4 py-4">
          {/* Result header with save button */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Results</p>
            <SaveRouteButton
              onSave={handleSaveRoute}
              isLoading={saveRouteMutation.isPending}
              isSuccess={saveRouteMutation.isSuccess}
            />
          </div>

          {/* Source & computation time */}
          {data && (
            <p className="text-[10px] text-muted-foreground">
              Source: {data.source} · Computed at{" "}
              {formatClock(data.computedAt)}
            </p>
          )}

          {/* Route list */}
          <RouteResultList
            routes={routes}
            onStartTracking={handleStartTracking}
          />
        </div>
      )}

      {/* Empty state when no results and not loading */}
      {!isLoading && !error && routes.length === 0 && !data && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
          <Navigation className="size-8 opacity-50" />
          <p className="text-sm">
            Select your stations and preferences, then tap "Plan Route" to find
            the best journey.
          </p>
        </div>
      )}

      {/* Chosen route history */}
      {routeHistory.length > 0 && (
        <div className="border-t px-4 py-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <History className="size-4" />
            Chosen route history
          </div>
          <ul className="space-y-2">
            {routeHistory.map((item) => (
              <li
                key={item.id}
                className="rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground"
              >
                <div className="font-medium text-foreground">{item.title}</div>
                <div>
                  {item.totalMinutes} min · {item.stops} stops · {item.transfers} transfer
                  {item.transfers === 1 ? "" : "s"}
                </div>
                <time dateTime={item.startedAt}>
                  Started {formatClock(item.startedAt)}
                </time>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AlertDialog
        open={pendingRouteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRouteIndex(null);
        }}
      >
        <AlertDialogContent className="max-w-md p-0">
          <div className="border-b bg-blue-50 px-5 py-4">
            <AlertDialogHeader className="gap-1 text-left">
              <AlertDialogTitle className="flex items-center gap-2 text-blue-950">
                <Navigation className="size-5 text-blue-600" />
                Start a new route?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-blue-800">
                Your current route will stop tracking and move into history.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>

          <div className="space-y-3 px-5 py-4">
            {activeRouteMeta && (
              <div className="rounded-md border border-blue-100 bg-blue-50/70 p-3">
                <p className="text-xs font-medium uppercase text-blue-700">Current route</p>
                <p className="mt-1 text-sm font-semibold text-blue-950">
                  {activeRouteMeta.title}
                </p>
                <p className="text-xs text-blue-700">
                  {activeRouteMeta.totalMinutes} min · {activeRouteMeta.stops} stops
                </p>
              </div>
            )}

            {pendingRoute && (
              <div className="rounded-md border border-amber-100 bg-amber-50 p-3">
                <p className="text-xs font-medium uppercase text-amber-700">New route</p>
                <p className="mt-1 text-sm font-semibold text-amber-950">
                  {pendingRouteTitle}
                </p>
                <p className="text-xs text-amber-700">
                  {pendingRoute.totalMinutes} min · {pendingRoute.stops} stops ·{" "}
                  {pendingRoute.transfers} transfer{pendingRoute.transfers === 1 ? "" : "s"}
                </p>
              </div>
            )}
          </div>

          <AlertDialogFooter className="border-t px-5 py-4">
            <AlertDialogCancel className="mt-0">Keep current route</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmOverwriteRoute}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Start new route
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── SaveRouteButton ─────────────────────────────────────────────────────────

interface SaveRouteButtonProps {
  onSave: () => void;
  isLoading: boolean;
  isSuccess: boolean;
}

/**
 * Button to save/bookmark the current route to the user's profile.
 *
 * Validates: Requirements 11.5
 */
function SaveRouteButton({ onSave, isLoading, isSuccess }: SaveRouteButtonProps) {
  if (isSuccess) {
    return (
      <Button variant="ghost" size="sm" disabled className="text-green-600">
        <Bookmark className="size-4 fill-current" />
        Saved
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onSave}
      disabled={isLoading}
      aria-label="Save this route"
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Bookmark className="size-4" />
      )}
      Save Route
    </Button>
  );
}
