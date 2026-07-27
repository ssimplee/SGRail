import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowDownUp,
  MapPin,
  MapPinOff,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Command,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { STATIONS, type MapStation } from "@/data/stations";
import { cn } from "@/lib/utils";
import { useCurrentLocation } from "@/features/geolocation/useCurrentLocation";
import {
  findNearestStations,
  formatDistance,
} from "@/features/geolocation/geolocation.utils";
import type { NearestStation } from "@/features/geolocation/geolocation.types";

/**
 * Props for the RouteInputForm component.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 */
export interface RouteInputFormProps {
  onSubmit: (params: {
    originStationId: string;
    destinationStationId: string;
    mode: "LEAVE_NOW" | "LEAVE_AT" | "ARRIVE_BY";
    departureTime?: string;
  }) => void;
  isLoading?: boolean;
}

type TimeMode = "LEAVE_NOW" | "LEAVE_AT" | "ARRIVE_BY";

/**
 * Route planning input form with station selectors, swap button,
 * time mode picker, and submit action.
 *
 * Features:
 * - "From" station selector with searchable dropdown and "Use current location" option
 * - "To" station selector with searchable dropdown
 * - Swap (↕) button to swap start and destination
 * - Time mode selector: "Leave now" / "Leave at" / "Arrive by"
 * - Time input field when "Leave at" or "Arrive by" is selected
 * - "Plan Route" submit button
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 */
export function RouteInputForm({ onSubmit, isLoading = false }: RouteInputFormProps) {
  const [origin, setOrigin] = useState<MapStation | null>(null);
  const [destination, setDestination] = useState<MapStation | null>(null);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [timeMode, setTimeMode] = useState<TimeMode>("LEAVE_NOW");
  const [departureTime, setDepartureTime] = useState("");

  const {
    location,
    status: locationStatus,
    error: locationError,
    requestLocation,
    clearLocation,
  } = useCurrentLocation();
  const [gpsStation, setGpsStation] = useState<NearestStation | null>(null);

  // A GPS fix is not a station, and the backend only routes between stations.
  // Resolve the fix to the nearest one and use that as the real origin, so the
  // request carries a station id rather than a placeholder.
  useEffect(() => {
    if (!location) {
      setGpsStation(null);
      return;
    }
    const nearest = findNearestStations(location, STATIONS, 1)[0] ?? null;
    setGpsStation(nearest);
    if (nearest) setOrigin(nearest.station);
  }, [location]);

  const handleUseCurrentLocation = useCallback(() => {
    setUsingCurrentLocation(true);
    setOrigin(null);
    requestLocation();
  }, [requestLocation]);

  const handleClearCurrentLocation = useCallback(() => {
    setUsingCurrentLocation(false);
    setGpsStation(null);
    setOrigin(null);
    clearLocation();
  }, [clearLocation]);

  const handleSwap = useCallback(() => {
    // Once a fix has resolved, origin holds a real station, so a swap is an
    // ordinary swap — it just stops being tied to the user's location.
    setUsingCurrentLocation(false);
    setGpsStation(null);
    clearLocation();
    setOrigin(destination);
    setDestination(origin);
  }, [origin, destination, clearLocation]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const originId = origin?.id;
      const destinationId = destination?.id;

      if (!originId || !destinationId) return;

      onSubmit({
        originStationId: originId,
        destinationStationId: destinationId,
        mode: timeMode,
        departureTime: timeMode !== "LEAVE_NOW" ? departureTime : undefined,
      });
    },
    [origin, destination, timeMode, departureTime, onSubmit],
  );

  const canSubmit =
    origin !== null &&
    destination !== null &&
    (timeMode === "LEAVE_NOW" || departureTime.length > 0);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      {/* Station selectors with swap */}
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-3">
          {/* From station */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="origin-station">From</Label>
            {usingCurrentLocation ? (
              <div className="flex flex-col gap-1">
                <div className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm bg-muted">
                  {locationStatus === "requesting" ? (
                    <>
                      <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                      <span>Finding your location…</span>
                    </>
                  ) : locationError ? (
                    <>
                      <MapPinOff className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">Location unavailable</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="size-4 shrink-0 text-primary" />
                      {/* Name the station we resolved to — never substitute
                          one silently, the walk could be a long one. */}
                      <span className="truncate">
                        {gpsStation
                          ? `${gpsStation.station.name} · ${formatDistance(
                              gpsStation.distanceMetres,
                            )} away`
                          : "Current location"}
                      </span>
                    </>
                  )}
                  <button
                    type="button"
                    className="ml-auto shrink-0 text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleClearCurrentLocation}
                  >
                    Change
                  </button>
                </div>
                {locationError && (
                  <p className="text-xs text-muted-foreground" role="alert">
                    {locationError}
                  </p>
                )}
              </div>
            ) : (
              <StationCombobox
                id="origin-station"
                placeholder="Select origin station…"
                selected={origin}
                onSelect={setOrigin}
                showCurrentLocation
                onUseCurrentLocation={handleUseCurrentLocation}
              />
            )}
          </div>

          {/* To station */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="destination-station">To</Label>
            <StationCombobox
              id="destination-station"
              placeholder="Select destination station…"
              selected={destination}
              onSelect={setDestination}
            />
          </div>
        </div>

        {/* Swap button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="mb-3 shrink-0"
          onClick={handleSwap}
          aria-label="Swap start and destination"
        >
          <ArrowDownUp className="size-4" />
        </Button>
      </div>

      {/* Time mode selector */}
      <div className="flex flex-col gap-2">
        <Label>Departure</Label>
        <RadioGroup
          value={timeMode}
          onValueChange={(val) => setTimeMode(val as TimeMode)}
          className="flex flex-wrap gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="LEAVE_NOW" id="time-leave-now" />
            <Label htmlFor="time-leave-now" className="font-normal cursor-pointer">
              Leave now
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="LEAVE_AT" id="time-leave-at" />
            <Label htmlFor="time-leave-at" className="font-normal cursor-pointer">
              Leave at
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="ARRIVE_BY" id="time-arrive-by" />
            <Label htmlFor="time-arrive-by" className="font-normal cursor-pointer">
              Arrive by
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Time input — shown when "Leave at" or "Arrive by" is selected */}
      {timeMode !== "LEAVE_NOW" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="departure-time">
            <Clock className="size-3.5 inline mr-1" />
            {timeMode === "LEAVE_AT" ? "Departure time" : "Arrival time"}
          </Label>
          <Input
            id="departure-time"
            type="datetime-local"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            aria-label={
              timeMode === "LEAVE_AT"
                ? "Select departure time"
                : "Select arrival time"
            }
          />
        </div>
      )}

      {/* Submit button */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!canSubmit || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Planning…
          </>
        ) : (
          "Plan Route"
        )}
      </Button>
    </form>
  );
}

// ─── Station Combobox (inline helper) ────────────────────────────────────────

interface StationComboboxProps {
  id: string;
  placeholder: string;
  selected: MapStation | null;
  onSelect: (station: MapStation) => void;
  showCurrentLocation?: boolean;
  onUseCurrentLocation?: () => void;
}

/**
 * Searchable station selector using cmdk Command component.
 * Filters stations by name or code as the user types.
 */
function StationCombobox({
  id,
  placeholder,
  selected,
  onSelect,
  showCurrentLocation = false,
  onUseCurrentLocation,
}: StationComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim().length > 0
    ? STATIONS.filter((s) => {
        const q = query.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.codes.some((c) => c.toLowerCase().includes(q))
        );
      }).slice(0, 8)
    : STATIONS.slice(0, 8);

  const handleSelect = useCallback(
    (stationId: string) => {
      const station = STATIONS.find((s) => s.id === stationId);
      if (station) {
        onSelect(station);
        setQuery("");
        setOpen(false);
      }
    },
    [onSelect],
  );

  const displayValue = selected ? `${selected.name} (${selected.codes.join("/")})` : "";

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        placeholder={placeholder}
        value={open ? query : displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onBlur={() => {
          // Delay to allow click on dropdown items
          setTimeout(() => setOpen(false), 200);
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={placeholder}
        autoComplete="off"
      />
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <Command shouldFilter={false}>
            <CommandList id={`${id}-list`} role="listbox">
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
              {filtered.length === 0 && query.trim().length > 0 && (
                <CommandEmpty>No stations found.</CommandEmpty>
              )}
              {filtered.length > 0 && (
                <CommandGroup heading="Stations">
                  {filtered.map((station) => (
                    <CommandItem
                      key={station.id}
                      value={station.id}
                      onSelect={handleSelect}
                      className={cn(
                        selected?.id === station.id && "bg-accent",
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{station.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {station.codes.join(" / ")} — {station.lines.join(", ")} Line
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
