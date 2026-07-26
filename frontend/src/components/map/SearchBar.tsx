import { useState, useCallback } from "react";
import { Search } from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useStationSearch } from "@/features/map/useStationSearch";
import type { MapStation } from "@/data/stations";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  /** Called when the user selects a station from search results */
  onStationSelect: (station: MapStation) => void;
  className?: string;
}

/**
 * Station search bar component using cmdk (Command) for the search interface.
 * Shows matching stations as the user types and calls the onStationSelect callback
 * when a station is selected. The parent (MapPage) handles centring the map.
 *
 * Validates: Requirements 3.7, 34.4
 */
export function SearchBar({ onStationSelect, className }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { results } = useStationSearch(query);

  const handleSelect = useCallback(
    (stationId: string) => {
      const station = results.find((s) => s.id === stationId);
      if (station) {
        onStationSelect(station);
        setQuery("");
        setOpen(false);
      }
    },
    [results, onStationSelect],
  );

  const handleInputChange = useCallback((value: string) => {
    setQuery(value);
    setOpen(value.trim().length > 0);
  }, []);

  return (
    <div className={cn("relative z-20 w-full max-w-lg", className)}>
      <Command
        shouldFilter={false}
        className="rounded-lg border shadow-md bg-card"
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 opacity-50" aria-hidden="true" />
          <input
            className="placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Search station name or code…"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (query.trim().length > 0) setOpen(true);
            }}
            onBlur={() => {
              // Delay closing so click on item can register
              setTimeout(() => setOpen(false), 200);
            }}
            role="combobox"
            aria-expanded={open}
            aria-label="Search MRT stations"
            aria-controls="station-search-results"
          />
        </div>
        {open && (
          <CommandList id="station-search-results" role="listbox">
            {results.length === 0 && query.trim().length > 0 && (
              <CommandEmpty>No stations found.</CommandEmpty>
            )}
            {results.length > 0 && (
              <CommandGroup heading="Stations">
                {results.slice(0, 8).map((station) => (
                  <CommandItem
                    key={station.id}
                    value={station.id}
                    onSelect={handleSelect}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{station.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {station.codes.join(" / ")} —{" "}
                        {station.lines.join(", ")} Line
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
}
