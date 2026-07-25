import { apiClient } from "./api";
import type { ArrivalEntry } from "@/components/station/ArrivalsSection";
import type { TimingEntry } from "@/components/station/TimingsSection";
import type { CrowdData } from "@/components/station/CrowdSection";

// ─────────────────────────────────────────────────────────────────────────────
// Response types
// ─────────────────────────────────────────────────────────────────────────────

export interface StationListItem {
  id: string;
  name: string;
  codes: string[];
  lines: string[];
  latitude: number;
  longitude: number;
  isInterchange: boolean;
  facilities: string[];
  accessibilityStatus: string;
}

export interface StationListResponse {
  stations: StationListItem[];
}

export interface StationDetailResponse extends StationListItem {
  exits: Array<{ name: string; description: string }>;
  disruptions: string[];
}

export interface ArrivalsResponse {
  arrivals: ArrivalEntry[];
  source: string;
  updatedAt: string;
}

export interface TimingsResponse {
  timings: TimingEntry[];
  source: string;
  updatedAt: string;
}

export interface CrowdResponse extends CrowdData {
  expiresAt: string;
}

export interface NearbyStationItem {
  id: string;
  name: string;
  distanceMetres: number;
  codes: string[];
}

export interface NearbyStationsResponse {
  stations: NearbyStationItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all stations from the backend.
 *
 * Validates: Requirements 34.5, 35.2
 */
export async function getStations(): Promise<StationListResponse> {
  const { data } = await apiClient.get<StationListResponse>("/stations");
  return data;
}

/**
 * Fetch detailed info for a single station.
 *
 * Validates: Requirements 9.1, 9.2
 */
export async function getStation(id: string): Promise<StationDetailResponse> {
  const { data } = await apiClient.get<StationDetailResponse>(
    `/stations/${id}`
  );
  return data;
}

/**
 * Fetch real-time arrivals for a station.
 *
 * Validates: Requirements 9.3, 10.1, 10.2, 10.3
 */
export async function getStationArrivals(
  id: string
): Promise<ArrivalsResponse> {
  const { data } = await apiClient.get<ArrivalsResponse>(
    `/stations/${id}/arrivals`
  );
  return data;
}

/**
 * Fetch first/last train timings for a station.
 *
 * Validates: Requirements 9.4
 */
export async function getStationTimings(id: string): Promise<TimingsResponse> {
  const { data } = await apiClient.get<TimingsResponse>(
    `/stations/${id}/first-last-trains`
  );
  return data;
}

/**
 * Fetch crowd level for a station.
 *
 * Validates: Requirements 9.5, 10.1, 10.2, 10.3
 */
export async function getStationCrowd(id: string): Promise<CrowdResponse> {
  const { data } = await apiClient.get<CrowdResponse>(
    `/stations/${id}/crowd`
  );
  return data;
}

/**
 * Find nearby stations given a latitude/longitude.
 *
 * Validates: Requirements 6.1
 */
export async function getNearbyStations(
  lat: number,
  lng: number,
  limit?: number
): Promise<NearbyStationsResponse> {
  const { data } = await apiClient.get<NearbyStationsResponse>(
    "/stations/nearby",
    {
      params: { lat, lng, limit: limit ?? 3 },
    }
  );
  return data;
}
