import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MapStation } from "@/data/stations";
import { LINE_COLORS } from "@/data/lineColors";
import { ResponsivePanel } from "@/components/common/ResponsivePanel";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrivalsSection, type ArrivalEntry } from "./ArrivalsSection";
import { TimingsSection, type TimingEntry } from "./TimingsSection";
import { CrowdSection, type CrowdData } from "./CrowdSection";
import {
  FacilitiesSection,
  type ExitInfo,
  type FacilitiesData,
} from "./FacilitiesSection";
import {
  getStation,
  getStationArrivals,
  getStationTimings,
  getStationCrowd,
  type StationExit,
} from "@/services/stations.api";
import { estimateTrainHeadway } from "@/utils/trainHeadway";

export interface StationPanelProps {
  station: MapStation | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Exits are seeded either as bare labels ("A") or as objects; the
 * facilities section always wants the object form.
 */
function normaliseExit(exit: StationExit): ExitInfo {
  return typeof exit === "string" ? { name: exit } : exit;
}

/**
 * Main station information panel that displays all station details in tabs.
 * Fetches arrivals/timings/crowd from the backend API via TanStack Query,
 * falling back to local mock data if the backend is unavailable.
 *
 * Validates: Requirements 9.1–9.8, 10.1, 10.2, 10.3, 34.5, 35.2, 35.3
 */
export function StationPanel({ station, open, onClose }: StationPanelProps) {
  const stationId = station?.id ?? "";

  // Fetch station detail — carries facilities, exits and active disruptions
  // (60s stale time, matching how often service alerts are refreshed)
  const detailQuery = useQuery({
    queryKey: ["station-detail", stationId],
    queryFn: () => getStation(stationId),
    enabled: open && !!stationId,
    staleTime: 60_000,
    retry: 1,
  });

  // Fetch arrivals (30s stale time — real-time transit data)
  const arrivalsQuery = useQuery({
    queryKey: ["station-arrivals", stationId],
    queryFn: () => getStationArrivals(stationId),
    enabled: open && !!stationId,
    staleTime: 30_000,
    retry: 1,
  });

  // Fetch timings (24h stale time — changes rarely)
  const timingsQuery = useQuery({
    queryKey: ["station-timings", stationId],
    queryFn: () => getStationTimings(stationId),
    enabled: open && !!stationId,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  // Fetch crowd (60s stale time — semi real-time data)
  const crowdQuery = useQuery({
    queryKey: ["station-crowd", stationId],
    queryFn: () => getStationCrowd(stationId),
    enabled: open && !!stationId,
    staleTime: 60_000,
    retry: 1,
  });

  // Produce resolved data: prefer API response, fallback to local mock
  const mockData = useMemo(() => {
    if (!station) return null;
    return generateMockData(station);
  }, [station]);

  const arrivals: ArrivalEntry[] =
    arrivalsQuery.data?.arrivals ?? mockData?.arrivals ?? [];
  const arrivalsSource =
    arrivalsQuery.data?.source ?? mockData?.arrivalsSource ?? "Offline";
  const arrivalsUpdatedAt =
    arrivalsQuery.data?.updatedAt ?? mockData?.arrivalsUpdatedAt ?? new Date().toISOString();

  const timings: TimingEntry[] =
    timingsQuery.data?.timings ?? mockData?.timings ?? [];

  const crowd: CrowdData | null =
    crowdQuery.data
      ? {
          level: crowdQuery.data.level,
          confidence: crowdQuery.data.confidence,
          source: crowdQuery.data.source,
          observedAt: crowdQuery.data.observedAt,
        }
      : mockData?.crowd ?? null;

  const fallbackFacilities: FacilitiesData = mockData?.facilities ?? {
    facilities: [],
    accessibilityStatus: "none",
    disruptions: [],
    exits: [],
  };

  // Prefer the API's facilities and disruptions; the local mock has no
  // knowledge of live service alerts.
  const facilities: FacilitiesData = detailQuery.data
    ? {
        facilities: detailQuery.data.facilities,
        accessibilityStatus:
          detailQuery.data.accessibilityStatus as FacilitiesData["accessibilityStatus"],
        disruptions: detailQuery.data.disruptions,
        exits: detailQuery.data.exits.map(normaliseExit),
      }
    : fallbackFacilities;

  if (!station) return null;

  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      title={station.name}
      description={`Station information for ${station.name}`}
    >
      <div className="space-y-4">
        {/* Station Header */}
        <StationHeader station={station} />

        <Separator />

        {/* Tabbed Sections */}
        <Tabs defaultValue="arrivals" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="arrivals">Arrivals</TabsTrigger>
            <TabsTrigger value="timings">Timings</TabsTrigger>
            <TabsTrigger value="crowd">Crowd</TabsTrigger>
            <TabsTrigger value="facilities">Facilities</TabsTrigger>
          </TabsList>

          <TabsContent value="arrivals" className="mt-3">
            <ArrivalsSection
              arrivals={arrivals}
              source={arrivalsSource}
              updatedAt={arrivalsUpdatedAt}
            />
          </TabsContent>

          <TabsContent value="timings" className="mt-3">
            <TimingsSection timings={timings} />
          </TabsContent>

          <TabsContent value="crowd" className="mt-3">
            <CrowdSection crowd={crowd} />
          </TabsContent>

          <TabsContent value="facilities" className="mt-3">
            <FacilitiesSection data={facilities} />
          </TabsContent>
        </Tabs>

        {/* Last Updated */}
        <Separator />
        <p className="text-[10px] text-muted-foreground text-center">
          Last updated: {new Date(arrivalsUpdatedAt).toLocaleString()}
        </p>
      </div>
    </ResponsivePanel>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StationHeader sub-component
// ─────────────────────────────────────────────────────────────────────────────

function StationHeader({ station }: { station: MapStation }) {
  return (
    <div className="space-y-2">
      {/* Station codes as badges */}
      <div className="flex flex-wrap gap-1.5">
        {station.codes.map((code) => {
          const linePrefix = code.replace(/\d+/g, "");
          const color = LINE_COLORS[linePrefix] ?? "#6b7280";
          return (
            <span
              key={code}
              className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {code}
            </span>
          );
        })}
      </div>

      {/* Connected lines as colored pills */}
      <div className="flex flex-wrap items-center gap-2">
        {station.lines.map((line) => (
          <span
            key={line}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
            style={{
              borderColor: LINE_COLORS[line] ?? "#6b7280",
              color: LINE_COLORS[line] ?? "#6b7280",
            }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: LINE_COLORS[line] ?? "#6b7280" }}
              aria-hidden="true"
            />
            {line} Line
          </span>
        ))}
      </div>

      {/* Interchange indicator */}
      {station.interchange && (
        <p className="text-xs text-muted-foreground">
          🔄 Interchange station
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data Generation (fallback when backend is unavailable)
// ─────────────────────────────────────────────────────────────────────────────

interface MockStationData {
  arrivals: ArrivalEntry[];
  arrivalsSource: string;
  arrivalsUpdatedAt: string;
  timings: TimingEntry[];
  crowd: CrowdData;
  facilities: FacilitiesData;
  lastUpdated: string;
}

/** Line termini for generating mock direction data */
const LINE_TERMINI: Record<string, [string, string]> = {
  NS: ["Jurong East", "Marina South Pier"],
  EW: ["Tuas Link", "Pasir Ris"],
  NE: ["HarbourFront", "Punggol Coast"],
  CC: ["Clockwise Loop", "Anticlockwise Loop"],
  DT: ["Bukit Panjang", "Expo"],
  TE: ["Woodlands North", "Bayshore"],
  CG: ["Tanah Merah", "Changi Airport"],
  BP: ["Choa Chu Kang", "Bukit Panjang"],
};

function generateMockData(station: MapStation): MockStationData {
  const now = new Date().toISOString();

  // Arrivals - generate for each line at the station
  const arrivals: ArrivalEntry[] = station.lines.flatMap((line) => {
    const termini = LINE_TERMINI[line] ?? ["Terminus A", "Terminus B"];
    return termini.map((direction) => {
      const estimate = estimateTrainHeadway(new Date(), `${line}:${direction}`);
      return {
        line,
        direction,
        nextTrain: estimate.nextLabel,
        subsequentTrain: estimate.subsequentLabel,
        nextTrainMinutes: estimate.nextMinutes,
        subsequentTrainMinutes: estimate.subsequentMinutes,
        nextTrainAt: estimate.nextAt.toISOString(),
        subsequentTrainAt: estimate.subsequentAt.toISOString(),
        headwayBand: estimate.band,
        operating: true,
      };
    });
  });

  // Timings - weekday only for simplicity
  const timings: TimingEntry[] = station.lines.flatMap((line) => {
    const termini = LINE_TERMINI[line] ?? ["Terminus A", "Terminus B"];
    return termini.map((direction) => ({
      line,
      direction: direction === termini[0] ? "A" : "B",
      dayType: "weekday" as const,
      firstTrain: "05:30",
      lastTrain: "23:48",
      destination: direction,
    }));
  });

  // Crowd - random demo level
  const crowdLevels: Array<"low" | "moderate" | "crowded" | "very_crowded"> = [
    "low",
    "moderate",
    "crowded",
    "very_crowded",
  ];
  const crowd: CrowdData = {
    level: crowdLevels[Math.floor(Math.random() * crowdLevels.length)],
    confidence: 0.7,
    source: "Demo data (offline)",
    observedAt: now,
  };

  // Facilities
  const facilities: FacilitiesData = {
    facilities: ["lift", "escalator", "toilet"],
    accessibilityStatus: "full",
    disruptions: [],
    exits: [
      { name: "A", description: "Near bus interchange" },
      { name: "B", description: "Street level" },
      { name: "C", description: "Connected to shopping mall" },
    ],
  };

  return {
    arrivals,
    arrivalsSource: "estimated",
    arrivalsUpdatedAt: now,
    timings,
    crowd,
    facilities,
    lastUpdated: now,
  };
}
