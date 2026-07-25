import { CROWD_COLORS } from "@/data/lineColors";

const CROWD_LEVELS = [
  { key: "low", label: "Low" },
  { key: "moderate", label: "Moderate" },
  { key: "crowded", label: "Crowded" },
  { key: "very_crowded", label: "Very Crowded" },
] as const;

/**
 * Floating legend panel showing crowd level colour coding.
 * Only rendered when the crowd heatmap layer is active.
 *
 * Positioned at the bottom-left of the map container.
 *
 * Validates: Requirements 15.1, 15.2
 */
export function CrowdLegend() {
  return (
    <div
      className="absolute bottom-4 left-4 z-10 rounded-lg bg-card/90 p-3 shadow-md border border-border backdrop-blur-sm"
      role="region"
      aria-label="Crowd density legend"
    >
      <p className="mb-2 text-xs font-semibold text-foreground">Crowd Density</p>
      <ul className="flex flex-col gap-1.5">
        {CROWD_LEVELS.map(({ key, label }) => (
          <li key={key} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: CROWD_COLORS[key] }}
              aria-hidden="true"
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
