import React from "react";

export interface DataSourceLabelProps {
  /** The data source type: "demo", "estimated", "community", "live", "simulated", "historical", "official", "lta_datamall" */
  source: string;
  /** ISO 8601 timestamp of when the data was last updated */
  updatedAt?: string;
}

const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  demo: {
    label: "Demo",
    className: "bg-gray-200 text-gray-700",
  },
  simulated: {
    label: "Demo",
    className: "bg-gray-200 text-gray-700",
  },
  estimated: {
    label: "Estimated",
    className: "bg-yellow-100 text-yellow-800",
  },
  historical: {
    label: "Estimated",
    className: "bg-yellow-100 text-yellow-800",
  },
  community: {
    label: "Community",
    className: "bg-blue-100 text-blue-800",
  },
  official: {
    label: "Live",
    className: "bg-green-100 text-green-800",
  },
  live: {
    label: "Live",
    className: "bg-green-100 text-green-800",
  },
  lta_datamall: {
    label: "Live",
    className: "bg-green-100 text-green-800",
  },
};

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  } catch {
    return "";
  }
}

/**
 * Small badge showing the data source type and an optional last-updated timestamp.
 * Colour-coded by source: grey for Demo, yellow for Estimated, blue for Community, green for Live.
 */
export function DataSourceLabel({ source, updatedAt }: DataSourceLabelProps) {
  const normalised = source.toLowerCase();
  const config = SOURCE_CONFIG[normalised] ?? {
    label: source,
    className: "bg-gray-200 text-gray-700",
  };

  const timestamp = updatedAt ? formatTimestamp(updatedAt) : "";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
      aria-label={`Data source: ${config.label}${timestamp ? `, updated ${timestamp}` : ""}`}
    >
      <span>{config.label}</span>
      {timestamp && (
        <span className="text-[10px] opacity-70">· {timestamp}</span>
      )}
    </span>
  );
}
