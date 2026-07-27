import axios from "axios";

/**
 * Shared Axios instance for all backend API calls.
 * Base URL comes from Vite env or defaults to /api/v1 for same-origin deploys.
 *
 * Validates: Requirements 34.5, 35.2, 35.3
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10_000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }
  return config;
});
