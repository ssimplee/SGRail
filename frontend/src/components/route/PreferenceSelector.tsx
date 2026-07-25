import {
  Zap,
  Users,
  ArrowLeftRight,
  Footprints,
  Accessibility,
  Clock,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { RoutePreference } from "@/types/route.types";

/**
 * Preference options with labels and icons.
 */
const PREFERENCES: Array<{
  value: RoutePreference;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "FASTEST", label: "Fastest", icon: <Zap className="h-4 w-4" /> },
  {
    value: "LEAST_CROWDED",
    label: "Least Crowded",
    icon: <Users className="h-4 w-4" />,
  },
  {
    value: "FEWEST_TRANSFERS",
    label: "Fewest Transfers",
    icon: <ArrowLeftRight className="h-4 w-4" />,
  },
  {
    value: "LEAST_WALKING",
    label: "Least Walking",
    icon: <Footprints className="h-4 w-4" />,
  },
  {
    value: "WHEELCHAIR",
    label: "Wheelchair Accessible",
    icon: <Accessibility className="h-4 w-4" />,
  },
  {
    value: "LAST_TRAIN_SAFE",
    label: "Last-Train Safe",
    icon: <Clock className="h-4 w-4" />,
  },
];

interface PreferenceSelectorProps {
  value: RoutePreference;
  onChange: (preference: RoutePreference) => void;
}

/**
 * Route preference selector using shadcn/ui ToggleGroup.
 * Allows the user to select one of 6 route planning preferences.
 *
 * Validates: Requirements 12.1–12.7
 */
export function PreferenceSelector({
  value,
  onChange,
}: PreferenceSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        Route Preference
      </label>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(val) => {
          // Prevent deselecting — always keep one preference active
          if (val) {
            onChange(val as RoutePreference);
          }
        }}
        variant="outline"
        className="flex flex-wrap gap-1"
      >
        {PREFERENCES.map(({ value: prefValue, label, icon }) => (
          <ToggleGroupItem
            key={prefValue}
            value={prefValue}
            aria-label={label}
            className="flex items-center gap-1.5 px-3 py-2 text-xs"
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
