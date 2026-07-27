import { create } from "zustand";
import type {
  RoutePlanResponse,
  RoutePreference,
  TimeMode,
} from "@/types/route.types";

/**
 * Persists the last route plan (request + result) across navigation.
 *
 * RoutePage previously kept all of this in local component state, which
 * React resets on every unmount — including a tab switch away and back in
 * this single-page app's router. That silently dropped both AI-planned and
 * manually-planned routes the moment you left the Route tab. This store
 * survives unmounts (same in-memory-for-the-session pattern as
 * assistantStore/mapStore) so RoutePage can restore its last view on remount.
 *
 * See AIPLAN.md, "Agentic tool-calling" phase 19.
 */
export interface RouteStoreState {
  originStationId: string | null;
  destinationStationId: string | null;
  mode: TimeMode;
  preference: RoutePreference;
  lastResult: RoutePlanResponse | null;
  selectedRouteIndex: number;

  setRequest: (params: {
    originStationId: string;
    destinationStationId: string;
    mode: TimeMode;
    preference: RoutePreference;
  }) => void;
  setPreference: (preference: RoutePreference) => void;
  setResult: (result: RoutePlanResponse | null) => void;
  setSelectedRouteIndex: (index: number) => void;
  clear: () => void;
}

export const useRouteStore = create<RouteStoreState>((set) => ({
  originStationId: null,
  destinationStationId: null,
  mode: "LEAVE_NOW",
  preference: "FASTEST",
  lastResult: null,
  selectedRouteIndex: 0,

  setRequest: (params) =>
    set({
      originStationId: params.originStationId,
      destinationStationId: params.destinationStationId,
      mode: params.mode,
      preference: params.preference,
    }),
  setPreference: (preference) => set({ preference }),
  setResult: (result) => set({ lastResult: result }),
  setSelectedRouteIndex: (index) => set({ selectedRouteIndex: index }),
  clear: () =>
    set({
      originStationId: null,
      destinationStationId: null,
      lastResult: null,
      selectedRouteIndex: 0,
    }),
}));
