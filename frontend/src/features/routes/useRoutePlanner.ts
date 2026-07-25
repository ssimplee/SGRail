import { useMutation } from "@tanstack/react-query";
import { planRoute, recalculateRoute } from "@/services/routes.api";
import type { RoutePlanRequest, RoutePlanResponse } from "@/types/route.types";

/**
 * Hook for route planning using TanStack Query mutations.
 *
 * Uses `useMutation` instead of `useQuery` because each route planning
 * request is unique (different origin, destination, time, preferences)
 * and should be triggered on-demand rather than cached by key.
 *
 * Validates: Requirements 12.1–12.7
 */
export function useRoutePlanner() {
  const planMutation = useMutation<RoutePlanResponse, Error, RoutePlanRequest>({
    mutationFn: planRoute,
  });

  const recalculateMutation = useMutation<
    RoutePlanResponse,
    Error,
    RoutePlanRequest
  >({
    mutationFn: recalculateRoute,
  });

  return {
    /** Trigger a route plan request */
    planRoute: planMutation.mutate,
    /** Trigger a route plan request and return a promise */
    planRouteAsync: planMutation.mutateAsync,
    /** Route plan result data */
    data: planMutation.data ?? null,
    /** Whether a route plan request is in-flight */
    isLoading: planMutation.isPending,
    /** Error from the last route plan request */
    error: planMutation.error,
    /** Reset the plan mutation state */
    reset: planMutation.reset,

    /** Trigger a route recalculation (e.g. after incident) */
    recalculate: recalculateMutation.mutate,
    /** Trigger a route recalculation and return a promise */
    recalculateAsync: recalculateMutation.mutateAsync,
    /** Whether a recalculation is in-flight */
    isRecalculating: recalculateMutation.isPending,
    /** Error from the last recalculation */
    recalculateError: recalculateMutation.error,
  };
}
