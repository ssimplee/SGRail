import { useMemo } from "react";
import { STATIONS, type MapStation } from "@/data/stations";
import { useDebounce } from "@/hooks/useDebounce";

/**
 * Custom hook that searches stations by name or code with debounced input.
 *
 * Filters the STATIONS array by:
 * - Name: case-insensitive partial match
 * - Code: exact or prefix match (case-insensitive)
 *
 * Results are sorted by relevance:
 * 1. Exact code match (highest priority)
 * 2. Name starts with the query
 * 3. Name contains the query
 *
 * Validates: Requirements 3.7, 34.4
 */
export function useStationSearch(query: string) {
  const debouncedQuery = useDebounce(query.trim(), 200);

  const results = useMemo(() => {
    if (!debouncedQuery) {
      return [];
    }

    return searchStations(debouncedQuery);
  }, [debouncedQuery]);

  return {
    results,
    isSearching: query.trim() !== debouncedQuery,
  };
}

/**
 * Pure search function for station matching and ranking.
 * Exported separately for unit testing.
 */
export function searchStations(query: string): MapStation[] {
  if (!query) return [];

  const lowerQuery = query.toLowerCase();

  const matches: Array<{ station: MapStation; rank: number }> = [];

  for (const station of STATIONS) {
    const rank = getMatchRank(station, lowerQuery);
    if (rank > 0) {
      matches.push({ station, rank });
    }
  }

  // Sort by rank descending (higher = better match), then alphabetically by name
  matches.sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank;
    return a.station.name.localeCompare(b.station.name);
  });

  return matches.map((m) => m.station);
}

/**
 * Returns a relevance rank for a station matching a query.
 * 0 = no match
 * 3 = exact code match (highest)
 * 2 = name starts with query
 * 1 = name contains query or code prefix match
 */
function getMatchRank(station: MapStation, lowerQuery: string): number {
  // Check exact code match (any of the station's codes)
  for (const code of station.codes) {
    if (code.toLowerCase() === lowerQuery) {
      return 3;
    }
  }

  // Check name starts with query
  const lowerName = station.name.toLowerCase();
  if (lowerName.startsWith(lowerQuery)) {
    return 2;
  }

  // Check code prefix match
  for (const code of station.codes) {
    if (code.toLowerCase().startsWith(lowerQuery)) {
      return 1;
    }
  }

  // Check name contains query
  if (lowerName.includes(lowerQuery)) {
    return 1;
  }

  return 0;
}
