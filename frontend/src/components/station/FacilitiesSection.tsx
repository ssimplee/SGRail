import React from "react";

export interface FacilitiesData {
  facilities: string[];
  accessibilityStatus: "full" | "partial" | "none";
  disruptions: string[];
  exits: ExitInfo[];
}

export interface ExitInfo {
  name: string;
  description?: string;
  isClosed?: boolean;
}

export interface FacilitiesSectionProps {
  data: FacilitiesData | null;
}

const FACILITY_ICONS: Record<string, string> = {
  lift: "🛗",
  escalator: "⬆️",
  toilet: "🚻",
  retail: "🛒",
  taxi: "🚕",
  bus: "🚌",
  bicycle_parking: "🚲",
};

const ACCESSIBILITY_LABELS: Record<string, { label: string; color: string }> = {
  full: { label: "Fully Accessible", color: "text-green-600" },
  partial: { label: "Partially Accessible", color: "text-amber-600" },
  none: { label: "Not Wheelchair Accessible", color: "text-red-600" },
};

/**
 * Displays station facilities, wheelchair accessibility, disruptions, and exits.
 *
 * Validates: Requirements 9.6, 9.7
 */
export function FacilitiesSection({ data }: FacilitiesSectionProps) {
  if (!data) {
    return (
      <section aria-labelledby="facilities-heading" className="space-y-2">
        <h3 id="facilities-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Facilities &amp; Exits
        </h3>
        <p className="text-sm text-muted-foreground">No facilities data available.</p>
      </section>
    );
  }

  const accessibility = ACCESSIBILITY_LABELS[data.accessibilityStatus] ?? {
    label: data.accessibilityStatus,
    color: "text-muted-foreground",
  };

  return (
    <section aria-labelledby="facilities-heading" className="space-y-4">
      <h3 id="facilities-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Facilities &amp; Exits
      </h3>

      {/* Accessibility Status */}
      <div className="flex items-center gap-2">
        <span aria-hidden="true">♿</span>
        <span className={`text-sm font-medium ${accessibility.color}`}>
          {accessibility.label}
        </span>
      </div>

      {/* Facilities List */}
      {data.facilities.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground">Available Facilities</h4>
          <div className="flex flex-wrap gap-2">
            {data.facilities.map((facility) => (
              <span
                key={facility}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
              >
                <span aria-hidden="true">{FACILITY_ICONS[facility] ?? "•"}</span>
                <span className="capitalize">{facility.replace(/_/g, " ")}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Disruptions */}
      {data.disruptions.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-amber-600">⚠️ Disruptions</h4>
          <ul className="list-disc list-inside text-xs text-amber-700">
            {data.disruptions.map((d, idx) => (
              <li key={idx}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Exits */}
      {data.exits.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground">Station Exits</h4>
          <ul className="space-y-1" role="list">
            {data.exits.map((exit) => (
              <li
                key={exit.name}
                className={`flex items-center justify-between rounded-md border px-2 py-1 text-xs ${
                  exit.isClosed ? "bg-red-50 border-red-200" : ""
                }`}
              >
                <span>
                  <span className="font-semibold">Exit {exit.name}</span>
                  {exit.description && (
                    <span className="text-muted-foreground"> — {exit.description}</span>
                  )}
                </span>
                {exit.isClosed && (
                  <span className="text-red-600 font-medium text-[10px] uppercase">Closed</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
