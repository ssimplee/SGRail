import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useResponsive } from "@/hooks/useResponsive";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { TapStationDemo, LocateMeDemo } from "./MapIntroDemos";

interface MapIntroDialogProps {
  open: boolean;
  /** Close the dialog and remember that it has been seen */
  onDismiss: () => void;
}

/**
 * First-run dialog introducing the two things on the map that are not
 * self-evident.
 *
 * Station dots rest at low opacity so they do not double-draw over the badges
 * printed on the map image, which leaves the map reading as a static picture:
 * on desktop the only clue is the pointer cursor, and on touch there is none
 * at all. The locate button is a bare crosshair with no label. Both are shown
 * here with a short looping animation rather than described in prose.
 *
 * Honours prefers-reduced-motion by rendering the illustrations as stills.
 */
export function MapIntroDialog({ open, onDismiss }: MapIntroDialogProps) {
  const { isMobile } = useResponsive();
  const prefersReducedMotion = usePrefersReducedMotion();
  const animated = !prefersReducedMotion;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDismiss()}>
      <DialogContent className="sm:max-w-md" aria-label="Welcome to the map">
        <DialogHeader>
          <DialogTitle>Getting around the map</DialogTitle>
          <DialogDescription>
            Two things worth knowing before you start.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-4">
          <li className="flex items-center gap-3">
            <TapStationDemo animated={animated} />
            <div>
              <p className="text-sm font-medium text-foreground">
                {isMobile ? "Tap" : "Click"} any station
              </p>
              <p className="text-xs text-muted-foreground">
                Opens arrivals, first and last train timings, how crowded it is,
                and the station's facilities and exits.
              </p>
            </div>
          </li>

          <li className="flex items-center gap-3">
            <LocateMeDemo animated={animated} />
            <div>
              <p className="text-sm font-medium text-foreground">
                Find your nearest station
              </p>
              <p className="text-xs text-muted-foreground">
                The crosshair button on the right uses your location to pick the
                closest station and centre the map on it.
              </p>
            </div>
          </li>
        </ul>

        <DialogFooter>
          <Button onClick={onDismiss} className="w-full sm:w-auto">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
