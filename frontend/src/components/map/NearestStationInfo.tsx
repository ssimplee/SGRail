import { RefreshCw, Info, AlertTriangle, X } from "lucide-react";
import type { NearestStation } from "@/features/geolocation/geolocation.types";
import { formatDistance } from "@/features/geolocation/geolocation.utils";
import { cn } from "@/lib/utils";

/** Accuracy threshold in metres above which we prompt manual confirmation */
const POOR_ACCURACY_THRESHOLD = 100;

interface NearestStationInfoProps {
  /** The nearest station result (station + distance) */
  nearestStation: NearestStation;
  /** GPS accuracy in metres */
  accuracy: number;
  /** Callback to refresh location */
  onRefresh: () => void;
  /** Callback to open the station's detail panel */
  onViewDetails: () => void;
  /** Callback when user wants to manually select a station (poor accuracy) */
  onManualSelect?: () => void;
  /** Callback to close the card and clear the location result */
  onDismiss?: () => void;
  /** Extra classes, mainly to reposition the card away from the search bar */
  className?: string;
}

/**
 * Floating UI card showing nearest station information.
 *
 * Displays:
 * - Station name and approximate distance
 * - GPS accuracy value
 * - Warning when accuracy is poor (>100m)
 * - Refresh button to re-request location
 * - Action button opening the station's detail panel
 *
 * Validates: Requirements 6.3, 6.4, 6.5, 6.6
 */
export function NearestStationInfo({
  nearestStation,
  accuracy,
  onRefresh,
  onViewDetails,
  onManualSelect,
  onDismiss,
  className,
}: NearestStationInfoProps) {
  const isPoorAccuracy = accuracy > POOR_ACCURACY_THRESHOLD;
  const formattedDistance = formatDistance(nearestStation.distanceMetres);
  const formattedAccuracy = formatDistance(accuracy);

  return (
    <div
      className={cn(
        "absolute left-4 top-4 z-10 w-72 rounded-lg border border-border bg-card p-3 shadow-lg",
        className,
      )}
      role="region"
      aria-label="Nearest station information"
    >
      {/* Station name and distance */}
      <div className="flex items-center justify-between gap-1">
        <p className="text-sm font-semibold text-foreground">
          {nearestStation.station.name}{" "}
          <span className="font-normal text-muted-foreground">
            — {formattedDistance} away
          </span>
        </p>
        <div className="flex shrink-0 items-center">
          <button
            onClick={onRefresh}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Refresh location"
            type="button"
          >
            <RefreshCw className="size-4" />
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label="Dismiss nearest station"
              type="button"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* GPS accuracy */}
      <p className="mt-1 text-xs text-muted-foreground">
        ±{formattedAccuracy} accuracy
      </p>

      {/* Poor accuracy warning */}
      {isPoorAccuracy && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 p-2 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-xs text-amber-800 dark:text-amber-200">
            <p className="font-medium">GPS accuracy is low</p>
            <p className="mt-0.5">
              The detected station may not be correct.{" "}
              {onManualSelect && (
                <button
                  onClick={onManualSelect}
                  className="underline hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  type="button"
                >
                  Select station manually
                </button>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Opens the station panel. Deliberately not labelled "walk" — this
          gives no directions, and the card already states the distance. */}
      <button
        onClick={onViewDetails}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        type="button"
      >
        <Info className="size-3.5" />
        Station details
      </button>
    </div>
  );
}
