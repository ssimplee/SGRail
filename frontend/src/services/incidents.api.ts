import { apiClient } from "./api";
import type {
  IncidentListParams,
  IncidentListResponse,
  IncidentCreateRequest,
  IncidentInteractionRequest,
  IncidentInteractionResponse,
  Incident,
} from "@/types/incident.types";

/**
 * Fetch a paginated list of incidents with optional filters.
 *
 * Validates: Requirements 17.1, 19.1, 28.3, 29.3
 */
export async function listIncidents(
  params: IncidentListParams = {}
): Promise<IncidentListResponse> {
  const { data } = await apiClient.get<IncidentListResponse>("/incidents", {
    params: {
      station: params.station,
      line: params.line,
      category: params.category,
      status: params.status || "active",
      page: params.page || 1,
      pageSize: params.pageSize || 20,
    },
  });
  return data;
}

/**
 * Create a new incident report.
 *
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5
 */
export async function createIncident(
  request: IncidentCreateRequest
): Promise<Incident> {
  const { data } = await apiClient.post<Incident>("/incidents", request);
  return data;
}

/**
 * Submit an interaction (like, dislike, confirm, resolve, report_abusive)
 * on an existing incident.
 *
 * Validates: Requirements 19.1, 19.2
 */
export async function interactWithIncident(
  incidentId: string,
  request: IncidentInteractionRequest
): Promise<IncidentInteractionResponse> {
  const { data } = await apiClient.post<IncidentInteractionResponse>(
    `/incidents/${incidentId}/interactions`,
    request
  );
  return data;
}
