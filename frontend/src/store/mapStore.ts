import { create } from "zustand";
import type { MapStation } from "@/data/stations";

export interface MapTransform {
  scale: number;
  x: number;
  y: number;
}

export interface MapStore {
  /** Currently selected station (null when nothing is selected) */
  selectedStation: MapStation | null;
  /** Select a station or deselect (pass null) */
  selectStation: (station: MapStation | null) => void;

  /** Whether the crowd heatmap overlay is active */
  crowdLayerActive: boolean;
  /** Toggle crowd layer on/off */
  toggleCrowdLayer: () => void;

  /** Whether station name labels are visible on the map */
  showStationLabels: boolean;
  /** Toggle station labels on/off */
  toggleStationLabels: () => void;

  /** Current map zoom/pan transform state */
  transform: MapTransform;
  /** Update the transform */
  setTransform: (t: MapTransform) => void;

  /** Station IDs highlighted by AI assistant or search */
  highlightedStations: string[];
  /** Route path highlighted on map (station IDs in order) */
  highlightedRoute: string[] | null;

  /** Set highlighted stations (e.g. from AI response) */
  setHighlightedStations: (ids: string[]) => void;
  /** Set highlighted route path */
  setHighlightedRoute: (route: string[] | null) => void;
  /** Clear all highlights */
  clearHighlights: () => void;
}

export const useMapStore = create<MapStore>((set) => ({
  selectedStation: null,
  selectStation: (station) => set({ selectedStation: station }),

  crowdLayerActive: false,
  toggleCrowdLayer: () =>
    set((state) => ({ crowdLayerActive: !state.crowdLayerActive })),

  showStationLabels: false,
  toggleStationLabels: () =>
    set((state) => ({ showStationLabels: !state.showStationLabels })),

  transform: { scale: 1, x: 0, y: 0 },
  setTransform: (t) => set({ transform: t }),

  highlightedStations: [],
  highlightedRoute: null,

  setHighlightedStations: (ids) => set({ highlightedStations: ids }),
  setHighlightedRoute: (route) => set({ highlightedRoute: route }),
  clearHighlights: () =>
    set({ highlightedStations: [], highlightedRoute: null }),
}));
