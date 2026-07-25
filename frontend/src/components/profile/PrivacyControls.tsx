import { MapPin } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePreferencesStore } from "@/store/preferencesStore";

/**
 * PrivacyControls — provides a toggle for location tracking preferences.
 *
 * - Toggle for "Allow location tracking" (controls whether journey tracking can use GPS)
 * - Explanatory note about what location data is/isn't stored
 *
 * Validates: Requirements 25.5, 29.5
 */
export function PrivacyControls() {
  const locationTracking = usePreferencesStore((s) => s.locationTracking);
  const toggleLocationTracking = usePreferencesStore(
    (s) => s.toggleLocationTracking
  );

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-muted-foreground">Privacy</h3>

      {/* Location tracking toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" />
          <Label htmlFor="location-tracking" className="text-sm font-medium">
            Allow location tracking
          </Label>
        </div>
        <Switch
          id="location-tracking"
          checked={locationTracking}
          onCheckedChange={toggleLocationTracking}
          aria-label="Toggle location tracking for journey navigation"
        />
      </div>

      {/* Explanatory note */}
      <p className="text-xs leading-relaxed text-muted-foreground">
        When enabled, the app can use GPS to detect your nearest station and
        track journey progress. Your raw location history is never stored — only
        the nearest station is determined in real time and discarded after use.
      </p>
    </div>
  );
}
