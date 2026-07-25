import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listIncidents,
  createIncident,
  interactWithIncident,
} from "@/services/incidents.api";
import type {
  IncidentListParams,
  IncidentCreateRequest,
  IncidentInteractionRequest,
  Incident,
} from "@/types/incident.types";

/**
 * Query key factory for incidents queries.
 */
const incidentKeys = {
  all: ["incidents"] as const,
  lists: () => [...incidentKeys.all, "list"] as const,
  list: (params: IncidentListParams) =>
    [...incidentKeys.lists(), params] as const,
};

/**
 * Hook for listing incidents with filtering and pagination.
 * Uses TanStack Query's useQuery for auto-caching and refetching.
 *
 * Validates: Requirements 17.1, 19.1, 28.3, 29.3
 */
export function useIncidentList(params: IncidentListParams = {}) {
  return useQuery({
    queryKey: incidentKeys.list(params),
    queryFn: () => listIncidents(params),
    staleTime: 30_000, // 30 seconds before data is considered stale
  });
}

/**
 * Hook for creating a new incident report.
 * Invalidates the incidents list cache on success.
 *
 * Validates: Requirements 18.1–18.5
 */
export function useCreateIncident() {
  const queryClient = useQueryClient();

  return useMutation<Incident, Error, IncidentCreateRequest>({
    mutationFn: createIncident,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: incidentKeys.lists() });
    },
  });
}

/**
 * Hook for interacting with an incident (like, dislike, confirm, etc.).
 * Invalidates the incidents list cache on success.
 *
 * Validates: Requirements 19.1, 19.2
 */
export function useIncidentInteraction() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean },
    Error,
    { incidentId: string; request: IncidentInteractionRequest }
  >({
    mutationFn: ({ incidentId, request }) =>
      interactWithIncident(incidentId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: incidentKeys.lists() });
    },
  });
}
