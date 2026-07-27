import { apiClient } from "./api";

// ─────────────────────────────────────────────────────────────────────────────
// Response types
// ─────────────────────────────────────────────────────────────────────────────

/** Severity derived from the LTA Status field: 2 → major, 1 → minor. */
export type AlertSeverity = "major" | "minor";

export interface ServiceAlert {
  /** Raw LTA status: 1 = normal / minor delays, 2 = disrupted / major delays */
  status: number;
  severity: AlertSeverity;
  /** Internal line code, e.g. "NE" */
  lineCode: string;
  /** Line code as published by LTA, e.g. "NEL" */
  ltaLine: string;
  /** "Both" or a terminus name */
  direction: string;
  /** Affected stations, resolved to internal IDs */
  stationIds: string[];
  /** Affected stations as LTA platform codes, e.g. ["NE1", "NE3"] */
  stationCodes: string[];
  /** Stations offering free boarding onto normal public bus services */
  freePublicBusStationIds: string[];
  /** Stations served by free MRT shuttle services */
  freeMrtShuttleStationIds: string[];
  mrtShuttleDirection: string;
  /** LTA travel advisory text */
  message: string;
  createdAt: string;
  source: string;
}

export interface AlertsResponse {
  alerts: ServiceAlert[];
  /** "lta_datamall", "simulated", or "none" */
  source: string;
  retrievedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch current train service alerts.
 *
 * An empty list means normal service, not a failure.
 */
export async function getServiceAlerts(): Promise<AlertsResponse> {
  const { data } = await apiClient.get<AlertsResponse>("/alerts");
  return data;
}
