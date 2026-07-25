import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL || "/api/v1";

/**
 * Saved route as returned from the API.
 */
export interface SavedRoute {
  id: string;
  originStationId: string;
  destinationStationId: string;
  preference: string;
  label: string | null;
  createdAt: string;
}

/**
 * Request body for creating a saved route.
 */
export interface SavedRouteCreateRequest {
  originStationId: string;
  destinationStationId: string;
  preference: string;
  label?: string;
}

/**
 * User profile response.
 */
export interface UserProfile {
  id: string;
  displayName: string;
  reliabilityScore: number;
  badge: string;
  preferences: {
    language: string;
    textScale: number;
    highContrast: boolean;
    colourBlindLabels: boolean;
    reducedMotion: boolean;
  };
  reportCount: number;
  confirmCount: number;
}

/**
 * Fetch the current user's profile.
 *
 * Validates: Requirements 25.1, 25.2
 */
export async function getCurrentUser(): Promise<UserProfile> {
  const { data } = await axios.get<UserProfile>(`${API}/users/me`);
  return data;
}

/**
 * Update user preferences.
 *
 * Validates: Requirements 25.4, 25.5
 */
export async function updateUserPreferences(
  preferences: Partial<UserProfile["preferences"]>
): Promise<void> {
  await axios.patch(`${API}/users/me/preferences`, preferences);
}

/**
 * Get all saved routes for the current user.
 *
 * Validates: Requirements 11.5, 25.3
 */
export async function getSavedRoutes(): Promise<SavedRoute[]> {
  const { data } = await axios.get<SavedRoute[]>(`${API}/users/me/saved-routes`);
  return data;
}

/**
 * Create a new saved route.
 *
 * Validates: Requirements 11.5, 25.3
 */
export async function createSavedRoute(
  route: SavedRouteCreateRequest
): Promise<SavedRoute> {
  const { data } = await axios.post<SavedRoute>(
    `${API}/users/me/saved-routes`,
    route
  );
  return data;
}

/**
 * Delete a saved route by ID.
 *
 * Validates: Requirements 11.5, 25.3
 */
export async function deleteSavedRoute(routeId: string): Promise<void> {
  await axios.delete(`${API}/users/me/saved-routes/${routeId}`);
}
