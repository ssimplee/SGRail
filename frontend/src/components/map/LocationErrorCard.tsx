import { MapPinOff, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationErrorCardProps {
  /** Human-readable failure message from useCurrentLocation */
  message: string;
  /** Close the card and return to idle */
  onDismiss: () => void;
  /** Try again — omitted when retrying cannot help (e.g. unsupported browser) */
  onRetry?: () => void;
  /** Extra classes, mainly to reposition the card away from the search bar */
  className?: string;
}

/**
 * Floating card explaining why location detection failed.
 *
 * Without this the locate button looks broken: permission denials, timeouts
 * and out-of-Singapore fixes all leave the map unchanged with no feedback.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.5, 8.7
 */
export function LocationErrorCard({
  message,
  onDismiss,
  onRetry,
  className,
}: LocationErrorCardProps) {
  return (
    <div
      className={cn(
        "absolute left-4 top-4 z-10 w-72 rounded-lg border border-border bg-card p-3 shadow-lg",
        className,
      )}
      role="alert"
      aria-label="Location error"
    >
      <div className="flex items-start gap-2">
        <MapPinOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="flex-1 text-xs text-foreground">{message}</p>
        <button
          onClick={onDismiss}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Dismiss location error"
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          type="button"
        >
          Try again
        </button>
      )}
    </div>
  );
}
