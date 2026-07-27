import { Hand, MousePointerClick, X } from "lucide-react";
import { useResponsive } from "@/hooks/useResponsive";
import { cn } from "@/lib/utils";

interface MapTapHintProps {
  /** Hide the hint and remember the choice */
  onDismiss: () => void;
  className?: string;
}

/**
 * First-run nudge telling the user the map is interactive.
 *
 * Station dots rest at low opacity so they do not double-draw over the
 * badges printed on the map image, which leaves the map looking like a
 * static picture. On desktop the pointer cursor hints at it; on touch there
 * is no hover, so nothing does. This says it once, then gets out of the way.
 *
 * Sits bottom-left, clear of the search bar and the location cards at the
 * top and the zoom controls at bottom-right.
 */
export function MapTapHint({ onDismiss, className }: MapTapHintProps) {
  const { isMobile } = useResponsive();
  const Icon = isMobile ? Hand : MousePointerClick;

  return (
    <div
      className={cn(
        "absolute bottom-4 left-4 right-16 z-10 flex items-center gap-2",
        "rounded-lg border border-border bg-card/95 py-2 pl-3 pr-2 shadow-lg backdrop-blur",
        "md:right-auto md:max-w-sm",
        className,
      )}
      role="status"
      aria-label="Map hint"
    >
      <Icon className="size-4 shrink-0 text-primary" />
      <p className="flex-1 text-xs text-foreground">
        {isMobile ? "Tap" : "Click"} any station for arrivals, timings and
        crowd.
      </p>
      <button
        onClick={onDismiss}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="Dismiss map hint"
        type="button"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
