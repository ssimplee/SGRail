import axios from "axios";
import type { RoutePlanRequest, RoutePlanResponse } from "@/types/route.types";

const API = import.meta.env.VITE_API_BASE_URL || "/api/v1";

/**
 * Plan a route between two stations with the given preferences.
 *
 * Validates: Requirements 11.1–11.4, 12.1–12.7
 */
export async function planRoute(
  params: RoutePlanRequest
): Promise<RoutePlanResponse> {
  const { data } = await axios.post<RoutePlanResponse>(
    `${API}/routes/plan`,
    params
  );
  return data;
}

/**
 * Recalculate a route (e.g. after an incident invalidates the current route).
 * Uses the same request shape but hits the recalculate endpoint.
 *
 * Validates: Requirements 14.5
 */
export async function recalculateRoute(
  params: RoutePlanRequest
): Promise<RoutePlanResponse> {
  const { data } = await axios.post<RoutePlanResponse>(
    `${API}/routes/recalculate`,
    params
  );
  return data;
}
