import { searchStations } from "../features/map/useStationSearch";
import { haversineDistance } from "../utils/haversine";
import { useMapStore } from "../store/mapStore";
import { useJourneyStore } from "../store/journeyStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { STATIONS } from "../data/stations";
import type { MapStation } from "../data/stations";
import type { RouteStop } from "../features/journey-tracking/journeyTracker.types";

// ── Station Search Tests ──────────────────────────────────────────────────────

describe("searchStations", () => {
  it("returns Orchard as first result when searching by name", () => {
    const results = searchStations("orchard");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("Orchard");
  });

  it("returns Orchard when searching by station code NS22", () => {
    const results = searchStations("NS22");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("Orchard");
  });
});

// ── Haversine Distance Tests ──────────────────────────────────────────────────

describe("haversineDistance", () => {
  const orchard = STATIONS.find((s) => s.id === "orchard")!;
  const cityHall = STATIONS.find((s) => s.id === "city-hall")!;

  it("returns 0 when computing distance from a point to itself", () => {
    const d = haversineDistance(
      orchard.latitude,
      orchard.longitude,
      orchard.latitude,
      orchard.longitude,
    );
    expect(d).toBe(0);
  });

  it("returns positive distance < 5000m between Orchard and City Hall", () => {
    const d = haversineDistance(
      orchard.latitude,
      orchard.longitude,
      cityHall.latitude,
      cityHall.longitude,
    );
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(5000);
  });
});

// ── Map Store Tests ───────────────────────────────────────────────────────────

describe("useMapStore", () => {
  beforeEach(() => {
    useMapStore.setState({
      selectedStation: null,
      crowdLayerActive: false,
    });
  });

  it("selectStation sets selectedStation", () => {
    const station: MapStation = STATIONS[0];
    useMapStore.getState().selectStation(station);
    expect(useMapStore.getState().selectedStation).toBe(station);
  });

  it("toggleCrowdLayer flips crowdLayerActive", () => {
    expect(useMapStore.getState().crowdLayerActive).toBe(false);
    useMapStore.getState().toggleCrowdLayer();
    expect(useMapStore.getState().crowdLayerActive).toBe(true);
    useMapStore.getState().toggleCrowdLayer();
    expect(useMapStore.getState().crowdLayerActive).toBe(false);
  });
});

// ── Journey Store Tests ───────────────────────────────────────────────────────

describe("useJourneyStore", () => {
  beforeEach(() => {
    useJourneyStore.setState({
      activeRoute: null,
      routeStops: [],
    });
  });

  it("setActiveRoute sets activeRoute and routeStops", () => {
    const route = {
      totalMinutes: 20,
      walkingMinutes: 3,
      stops: 5,
      transfers: 1,
      estimatedFare: "$1.50",
      crowdEstimate: "moderate",
      steps: [],
    };
    const stops: RouteStop[] = [
      {
        stationId: "orchard",
        station: STATIONS.find((s) => s.id === "orchard")!,
        isTransfer: false,
        isDestination: false,
        expectedTravelTimeFromStart: 0,
      },
      {
        stationId: "city-hall",
        station: STATIONS.find((s) => s.id === "city-hall")!,
        isTransfer: false,
        isDestination: true,
        expectedTravelTimeFromStart: 10,
      },
    ];

    useJourneyStore.getState().setActiveRoute(route, stops);

    const state = useJourneyStore.getState();
    expect(state.activeRoute).toEqual(route);
    expect(state.routeStops).toHaveLength(2);
    expect(state.routeStops[0].stationId).toBe("orchard");
    expect(state.routeStops[1].stationId).toBe("city-hall");
  });
});

// ── Preferences Store Tests ───────────────────────────────────────────────────

describe("usePreferencesStore", () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      language: "en",
      highContrast: false,
    });
  });

  it("setLanguage updates language to zh", () => {
    usePreferencesStore.getState().setLanguage("zh");
    expect(usePreferencesStore.getState().language).toBe("zh");
  });

  it("toggleHighContrast flips highContrast", () => {
    expect(usePreferencesStore.getState().highContrast).toBe(false);
    usePreferencesStore.getState().toggleHighContrast();
    expect(usePreferencesStore.getState().highContrast).toBe(true);
    usePreferencesStore.getState().toggleHighContrast();
    expect(usePreferencesStore.getState().highContrast).toBe(false);
  });
});
