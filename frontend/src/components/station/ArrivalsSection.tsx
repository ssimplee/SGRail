import React from "react";
import { LINE_COLORS } from "@/data/lineColors";

export interface ArrivalEntry {
  line: string;
  direction: string;
  nextTrain: string;
  subsequentTrain: string;
}

export interface ArrivalsSectionProps {
  arrivals: ArrivalEntry[];
  source: string;
  updatedAt: string;
}

/**
 * Displays estimated next train arrivals per line and direction.
 * Shows data source label and last-updated timestamp.
 *
 * Validates: Requirements 9.3, 10.1, 10.2, 10.3
 */
export function ArrivalsSection({
  arrivals,
  source,
  updatedAt,
}: ArrivalsSectionProps) {
  return (
    <section aria-labelledby="arrivals-heading" className="space-y-3">
      <h3 id="arrivals-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Next Arrivals
      </h3>

      {arrivals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No arrival data available.</p>
      ) : (
        <ul className="space-y-2" role="list">
          {arrivals.map((arrival, idx) => (
            <li
              key={`${arrival.line}-${arrival.direction}-${idx}`}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: LINE_COLORS[arrival.line] ?? "#6b7280" }}
                  aria-hidden="true"
                />
                <span className="font-medium">
                  {arrival.line} Line
                </span>
                <span className="text-muted-foreground">→ {arrival.direction}</span>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="font-semibold">{arrival.nextTrain}</span>
                {arrival.subsequentTrain && (
                  <span className="text-muted-foreground"> / {arrival.subsequentTrain}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
          Source: {source}
        </span>
        <time dateTime={updatedAt}>
          Updated: {new Date(updatedAt).toLocaleTimeString()}
        </time>
      </div>
    </section>
  );
}
