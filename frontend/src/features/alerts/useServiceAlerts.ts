import { useQuery } from "@tanstack/react-query";
import { getServiceAlerts } from "@/services/alerts.api";

/**
 * Query key factory for service alert queries.
 */
export const alertKeys = {
  all: ["alerts"] as const,
  list: () => [...alertKeys.all, "list"] as const,
};

/**
 * Hook for fetching network-wide train service alerts.
 *
 * LTA publishes alerts ad hoc and the backend caches them for 60s, so
 * polling on the same interval keeps the banner current without adding
 * upstream load.
 */
export function useServiceAlerts() {
  return useQuery({
    queryKey: alertKeys.list(),
    queryFn: getServiceAlerts,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
