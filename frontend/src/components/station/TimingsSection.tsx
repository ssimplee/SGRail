import React from "react";
import { LINE_COLORS } from "@/data/lineColors";

export interface TimingEntry {
  line: string;
  direction: string;
  dayType: "weekday" | "saturday" | "sunday_ph";
  firstTrain: string;
  lastTrain: string;
  destination: string;
}

export interface TimingsSectionProps {
  timings: TimingEntry[];
}

const DAY_LABELS: Record<string, string> = {
  weekday: "Mon–Fri",
  saturday: "Sat",
  sunday_ph: "Sun/PH",
};

/**
 * Displays first and last train times per line, direction, and day type.
 *
 * Validates: Requirements 9.4
 */
export function TimingsSection({ timings }: TimingsSectionProps) {
  // Group timings by line
  const byLine = timings.reduce<Record<string, TimingEntry[]>>((acc, t) => {
    if (!acc[t.line]) acc[t.line] = [];
    acc[t.line].push(t);
    return acc;
  }, {});

  return (
    <section aria-labelledby="timings-heading" className="space-y-3">
      <h3 id="timings-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        First &amp; Last Trains
      </h3>

      {Object.entries(byLine).map(([line, entries]) => (
        <div key={line} className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: LINE_COLORS[line] ?? "#6b7280" }}
              aria-hidden="true"
            />
            <span className="text-sm font-medium">{line} Line</span>
          </div>

          <div className="ml-5 space-y-1">
            {entries.map((entry, idx) => (
              <div
                key={`${entry.direction}-${entry.dayType}-${idx}`}
                className="flex items-center justify-between text-xs border-b last:border-b-0 py-1"
              >
                <span className="text-muted-foreground">
                  → {entry.destination}{" "}
                  <span className="text-[10px]">({DAY_LABELS[entry.dayType] ?? entry.dayType})</span>
                </span>
                <span className="font-mono">
                  <span className="text-green-600">{entry.firstTrain}</span>
                  {" / "}
                  <span className="text-red-600">{entry.lastTrain}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {timings.length === 0 && (
        <p className="text-sm text-muted-foreground">No timing data available.</p>
      )}
    </section>
  );
}
