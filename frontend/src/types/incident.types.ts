/**
 * Incident types for the SGRail community features.
 *
 * Validates: Requirements 17.1, 19.1
 */

export type IncidentCategory =
  | "overcrowding"
  | "lift_breakdown"
  | "escalator_breakdown"
  | "train_delay"
  | "closed_exit"
  | "platform_congestion"
  | "suspicious_activity"
  | "lost_item"
  | "other";

export type IncidentStatus = "active" | "resolved" | "expired" | "removed";

export type ModerationStatus = "pending" | "approved" | "rejected" | "flagged";
export type IncidentTrustState = "unverified" | "verified" | "disputed" | "removed";

export type InteractionAction =
  | "like"
  | "dislike"
  | "confirm"
  | "remove_like"
  | "remove_dislike"
  | "remove_confirm"
  | "remove_report_abusive"
  | "resolve"
  | "report_abusive";

export type ReporterBadgeLevel =
  | "regular"
  | "trusted_commuter"
  | "super_reporter";

export interface IncidentReporter {
  id: string;
  displayName: string;
  badge: ReporterBadgeLevel;
  reliabilityScore: number;
}

export interface Incident {
  id: string;
  userId: string;
  stationId: string;
  lineCode: string | null;
  category: IncidentCategory;
  title: string;
  description: string;
  photoUrl: string | null;
  incidentTime: string;
  createdAt: string;
  status: IncidentStatus;
  moderationStatus: ModerationStatus;
  likeCount: number;
  dislikeCount: number;
  confirmCount: number;
  trustState?: IncidentTrustState;
  isAnonymous: boolean;
  reporter?: IncidentReporter;
}

export interface IncidentListResponse {
  incidents: Incident[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IncidentListParams {
  station?: string;
  line?: string;
  category?: IncidentCategory;
  status?: IncidentStatus;
  page?: number;
  pageSize?: number;
}

export interface IncidentCreateRequest {
  stationId: string;
  lineCode?: string;
  category: IncidentCategory;
  title: string;
  description: string;
  incidentTime: string;
  isAnonymous: boolean;
  locationConsent: boolean;
  latitude?: number | null;
  longitude?: number | null;
  photo?: File | null;
}

export interface IncidentInteractionRequest {
  action: InteractionAction;
}

export interface IncidentInteractionResponse {
  success: boolean;
  status?: IncidentStatus;
  moderationStatus?: ModerationStatus;
  removed?: boolean;
}

/** All valid incident categories for use in filters and forms */
export const INCIDENT_CATEGORIES: { value: IncidentCategory; label: string }[] = [
  { value: "overcrowding", label: "Overcrowding" },
  { value: "lift_breakdown", label: "Lift Breakdown" },
  { value: "escalator_breakdown", label: "Escalator Breakdown" },
  { value: "train_delay", label: "Train Delay" },
  { value: "closed_exit", label: "Closed Exit" },
  { value: "platform_congestion", label: "Platform Congestion" },
  { value: "suspicious_activity", label: "Suspicious Activity" },
  { value: "lost_item", label: "Lost Item" },
  { value: "other", label: "Other MRT-related" },
];
