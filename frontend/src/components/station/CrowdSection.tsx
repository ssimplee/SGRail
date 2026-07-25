import React from "react";
import { CROWD_COLORS } from "@/data/lineColors";

export type CrowdLevel = "low" | "moderate" | "crowded" | "very_crowded";

export interface CrowdData {
  level: CrowdLevel;
  confidence: number;
  source: string;
  observedAt: string;
}

export interface CrowdSectionProps {
  crowd: CrowdData | null;
}

const CROWD_LABELS: Record<CrowdLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  crowded: "Crowded",
  very_crowded: "Very Crowded",
};

/**
 * Displays the current crowd level with color-coded indicator, source, and confidence.
 *
 * Validates: Requirements 9.5, 10.1, 10.2, 10.3
 */
export function CrowdSection({ crowd }: CrowdSectionProps) {
  if (!crowd) {
    return (
      <section aria-labelledby="crowd-heading" className="space-y-2">
        <h3 id="crowd-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Crowd Level
        </h3>
        <p className="text-sm text-muted-foreground">No crowd data available.</p>
      </section>
    );
  }

  const color = CROWD_COLORS[crowd.level] ?? "#6b7280";
  const label = CROWD_LABELS[crowd.level] ?? crowd.level;
  const confidencePercent = Math.round(crowd.confidence * 100);

  return (
    <section aria-labelledby="crowd-heading" className="space-y-2">
      <h3 id="crowd-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Crowd Level
      </h3>

      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}20`, border: `2px solid ${color}` }}
          aria-hidden="true"
        >
          <span
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color }}>
            {label}
          </p>
          <p className="text-xs text-muted-foreground">
            Confidence: {confidencePercent}%
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
          Source: {crowd.source}
        </span>
        <time dateTime={crowd.observedAt}>
          Observed: {new Date(crowd.observedAt).toLocaleTimeString()}
        </time>
      </div>
    </section>
  );
}
