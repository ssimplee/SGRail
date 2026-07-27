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
  if (!request.photo) {
    const { photo, ...jsonRequest } = request;
    const { data } = await apiClient.post<Incident>("/incidents", jsonRequest);
    return data;
  }

  const formData = new FormData();
  formData.append("stationId", request.stationId);
  if (request.lineCode) formData.append("lineCode", request.lineCode);
  formData.append("category", request.category);
  formData.append("title", request.title);
  formData.append("description", request.description);
  formData.append("incidentTime", request.incidentTime);
  formData.append("isAnonymous", String(request.isAnonymous));
  formData.append("locationConsent", String(request.locationConsent));
  if (request.latitude !== undefined && request.latitude !== null) {
    formData.append("latitude", String(request.latitude));
  }
  if (request.longitude !== undefined && request.longitude !== null) {
    formData.append("longitude", String(request.longitude));
  }
  formData.append("photo", request.photo);

  const { data } = await apiClient.post<Incident>("/incidents", formData);
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
