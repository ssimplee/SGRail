import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bookmark,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { STATIONS } from "@/data/stations";
import {
  createSavedRoute,
  deleteSavedRoute,
  getSavedRoutes,
  type SavedRoute,
  type SavedRouteCreateRequest,
} from "@/services/user.api";

/**
 * Resolve a station ID to its display name.
 */
function getStationName(stationId: string): string {
  const station = STATIONS.find((s) => s.id === stationId);
  return station?.name ?? stationId;
}

/**
 * Format a preference code to a human-friendly label.
 */
function formatPreference(preference: string): string {
  const labels: Record<string, string> = {
    FASTEST: "Fastest",
    LEAST_CROWDED: "Least crowded",
    FEWEST_TRANSFERS: "Fewest transfers",
    LEAST_WALKING: "Least walking",
    WHEELCHAIR: "Wheelchair accessible",
    LAST_TRAIN_SAFE: "Last train safe",
  };
  return labels[preference] ?? preference;
}

/**
 * Props for the SavedRoutes component.
 */
export interface SavedRoutesProps {
  /** Callback when the user wants to plan a saved route */
  onPlanRoute?: (originId: string, destinationId: string, preference: string) => void;
}

/**
 * SavedRoutes — displays and manages the user's saved/frequent routes.
 *
 * Features:
 * - Lists all saved routes with origin, destination, and preference
 * - Delete individual saved routes
 * - Click to re-plan a saved route
 * - Empty state with guidance
 *
 * Validates: Requirements 11.5, 25.3
 */
export function SavedRoutes({ onPlanRoute }: SavedRoutesProps) {
  const queryClient = useQueryClient();

  const {
    data: routes = [],
    isLoading,
    error,
  } = useQuery<SavedRoute[]>({
    queryKey: ["saved-routes"],
    queryFn: getSavedRoutes,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSavedRoute,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
    },
  });

  const handleDelete = (routeId: string) => {
    deleteMutation.mutate(routeId);
  };

  const handlePlan = (route: SavedRoute) => {
    if (onPlanRoute) {
      onPlanRoute(route.originStationId, route.destinationStationId, route.preference);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
        Failed to load saved routes. Please try again later.
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Bookmark className="size-8 text-muted-foreground opacity-50" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">No saved routes</p>
          <p className="text-xs text-muted-foreground">
            Save your frequent routes for quick access. After planning a route,
            tap the bookmark icon to save it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        Saved Routes ({routes.length})
      </h3>
      {routes.map((route) => (
        <Card key={route.id} className="p-3">
          <div className="flex items-center gap-3">
            {/* Route info — clickable to plan */}
            <button
              className="flex flex-1 flex-col gap-1 text-left hover:opacity-80 transition-opacity"
              onClick={() => handlePlan(route)}
              aria-label={`Plan route from ${getStationName(route.originStationId)} to ${getStationName(route.destinationStationId)}`}
            >
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span>{getStationName(route.originStationId)}</span>
                <ArrowRight className="size-3 text-muted-foreground" />
                <span>{getStationName(route.destinationStationId)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatPreference(route.preference)}</span>
                {route.label && (
                  <>
                    <span>•</span>
                    <span>{route.label}</span>
                  </>
                )}
              </div>
            </button>

            {/* Delete button */}
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(route.id)}
              disabled={deleteMutation.isPending}
              aria-label={`Delete saved route to ${getStationName(route.destinationStationId)}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

/**
 * Props for the SaveRouteButton component.
 */
export interface SaveRouteButtonProps {
  originStationId: string;
  destinationStationId: string;
  preference: string;
  label?: string;
}

/**
 * A button to save the current route to the user's saved routes.
 * Shows a bookmark icon that fills in when the route is saved.
 *
 * Validates: Requirements 11.5
 */
export function SaveRouteButton({
  originStationId,
  destinationStationId,
  preference,
  label,
}: SaveRouteButtonProps) {
  const queryClient = useQueryClient();
  const [isSaved, setIsSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (req: SavedRouteCreateRequest) => createSavedRoute(req),
    onSuccess: () => {
      setIsSaved(true);
      queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
    },
  });

  const handleSave = () => {
    if (isSaved) return;
    saveMutation.mutate({
      originStationId,
      destinationStationId,
      preference,
      label,
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSave}
      disabled={saveMutation.isPending || isSaved}
      aria-label={isSaved ? "Route saved" : "Save this route"}
    >
      {saveMutation.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Bookmark className={isSaved ? "size-4 fill-primary" : "size-4"} />
      )}
      {isSaved ? "Saved" : "Save Route"}
    </Button>
  );
}
