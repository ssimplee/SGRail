import { useState } from "react";
import { Filter, X } from "lucide-react";
import { useResponsive } from "@/hooks/useResponsive";
import { STATIONS } from "@/data/stations";
import {
  INCIDENT_CATEGORIES,
  MRT_LINES,
  type IncidentCategory,
} from "@/types/incident.types";

export interface IncidentFilterValues {
  station?: string;
  line?: string;
  category?: IncidentCategory;
}

interface IncidentFiltersProps {
  values: IncidentFilterValues;
  onChange: (values: IncidentFilterValues) => void;
}

/** Unique station options sorted alphabetically */
const STATION_OPTIONS = STATIONS.map((s) => ({
  value: s.id,
  label: `${s.name} (${s.code})`,
})).sort((a, b) => a.label.localeCompare(b.label));

/**
 * Filter controls for the incident feed.
 * On mobile: collapsed behind a "Filters" button.
 * On desktop: always visible in a sidebar layout.
 *
 * Validates: Requirements 28.3, 29.3
 */
export function IncidentFilters({ values, onChange }: IncidentFiltersProps) {
  const { isMobile } = useResponsive();
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters = !!(values.station || values.line || values.category);

  const clearFilters = () => {
    onChange({ station: undefined, line: undefined, category: undefined });
  };

  const filterContent = (
    <div className="flex flex-col gap-3">
      {/* Station filter */}
      <div>
        <label
          htmlFor="filter-station"
          className="block text-xs font-medium text-foreground mb-1"
        >
          Station
        </label>
        <select
          id="filter-station"
          value={values.station || ""}
          onChange={(e) =>
            onChange({ ...values, station: e.target.value || undefined })
          }
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">All stations</option>
          {STATION_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Line filter */}
      <div>
        <label
          htmlFor="filter-line"
          className="block text-xs font-medium text-foreground mb-1"
        >
          Line
        </label>
        <select
          id="filter-line"
          value={values.line || ""}
          onChange={(e) =>
            onChange({ ...values, line: e.target.value || undefined })
          }
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">All lines</option>
          {MRT_LINES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category filter */}
      <div>
        <label
          htmlFor="filter-category"
          className="block text-xs font-medium text-foreground mb-1"
        >
          Category
        </label>
        <select
          id="filter-category"
          value={values.category || ""}
          onChange={(e) =>
            onChange({
              ...values,
              category: (e.target.value || undefined) as
                | IncidentCategory
                | undefined,
            })
          }
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {INCIDENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center justify-center gap-1 rounded-md border px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="h-3 w-3" />
          Clear filters
        </button>
      )}
    </div>
  );

  // Desktop: always visible sidebar
  if (!isMobile) {
    return (
      <aside className="w-64 shrink-0 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Filters</h2>
        {filterContent}
      </aside>
    );
  }

  // Mobile: collapsible behind a button
  return (
    <div className="mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors"
        aria-expanded={isOpen}
        aria-controls="mobile-filters"
      >
        <Filter className="h-4 w-4" />
        Filters
        {hasActiveFilters && (
          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
            Active
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id="mobile-filters"
          className="mt-2 rounded-lg border bg-card p-4"
        >
          {filterContent}
        </div>
      )}
    </div>
  );
}
