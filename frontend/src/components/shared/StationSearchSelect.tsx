import { useState } from "react";
import { Check, ChevronDownIcon, MapPin } from "lucide-react";

import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STATIONS, type MapStation } from "@/data/stations";
import { ALL_LINE_CODES, LINE_COLORS } from "@/data/lineColors";
import { cn } from "@/lib/utils";

export interface StationSearchSelectProps {
  id?: string;
  placeholder: string;
  value: string;
  onChange: (stationId: string) => void;
  showCurrentLocation?: boolean;
  onUseCurrentLocation?: () => void;
}

/**
 * Station picker styled like a standard Select trigger. Clicking it opens a
 * popover with a search box and line filter chips on top, so users can
 * narrow the list by name, code, or line instead of scrolling through every
 * station.
 */
export function StationSearchSelect({
  id,
  placeholder,
  value,
  onChange,
  showCurrentLocation = false,
  onUseCurrentLocation,
}: StationSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());

  const selected = STATIONS.find((s) => s.id === value) ?? null;

  const handleSelect = (station: MapStation) => {
    onChange(station.id);
    setOpen(false);
  };

  const toggleLine = (line: string) => {
    setSelectedLines((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  };

  const lineFiltered =
    selectedLines.size === 0
      ? STATIONS
      : STATIONS.filter((s) => s.lines.some((l) => selectedLines.has(l)));

  const displayText = selected
    ? `${selected.name} (${selected.codes.join("/")})`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          // A <label for> pointed at this button would otherwise win the
          // accessible-name computation and hide the current selection from
          // assistive tech, so state it explicitly here — same value shown
          // in the visible span below.
          aria-label={displayText}
          className={cn(
            "border-input data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-input-background px-3 py-2 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[3px]",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="truncate">{displayText}</span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
        // The station list can be shorter than the full station set, so it
        // scrolls internally. When this popover is opened from inside a
        // Dialog, the dialog's scroll lock (react-remove-scroll) intercepts
        // wheel events at the document level before they reach this portal
        // (which renders outside the dialog's own DOM subtree), silently
        // blocking mouse-wheel scrolling. Stopping propagation here keeps
        // the event from ever reaching that document listener.
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Search stations…" />
          <div className="flex flex-wrap gap-1.5 border-b px-2 py-1.5">
            {ALL_LINE_CODES.map((line) => {
              const active = selectedLines.has(line);
              const color = LINE_COLORS[line] ?? "#6b7280";
              return (
                <button
                  key={line}
                  type="button"
                  onClick={() => toggleLine(line)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
                    active ? "text-white" : "text-foreground hover:bg-accent",
                  )}
                  style={
                    active
                      ? { backgroundColor: color, borderColor: color }
                      : { borderColor: color }
                  }
                >
                  {line}
                </button>
              );
            })}
            {selectedLines.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedLines(new Set())}
                className="rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          <CommandList>
            <CommandEmpty>No stations found.</CommandEmpty>
            {showCurrentLocation && onUseCurrentLocation && (
              <CommandGroup heading="Quick options">
                <CommandItem
                  value="__current_location__"
                  onSelect={() => {
                    onUseCurrentLocation();
                    setOpen(false);
                  }}
                >
                  <MapPin className="size-4 text-primary" />
                  <span>Use current location</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Stations">
              {lineFiltered.map((station) => (
                <CommandItem
                  key={station.id}
                  value={`${station.name} ${station.codes.join(" ")}`}
                  onSelect={() => handleSelect(station)}
                >
                  <Check
                    className={cn(
                      "size-4",
                      selected?.id === station.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{station.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {station.codes.join(" / ")} — {station.lines.join(", ")} Line
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
