import { STATIONS } from "./stations";

/**
 * Every line code actually present in the station data, in a stable order.
 * Derived rather than hand-maintained so it can't drift out of sync with
 * stations.ts (e.g. missing LRT extensions like BP/CG).
 */
export const ALL_LINE_CODES: string[] = Array.from(
  new Set(STATIONS.flatMap((s) => s.lines)),
).sort();

/**
 * MRT line colour definitions for SVG rendering and UI elements.
 * Colours match official SMRT/SBS Transit line branding.
 */
export const LINE_COLORS: Record<string, string> = {
  NS: "#D42E12", // North-South - Red
  EW: "#009645", // East-West - Green
  NE: "#9900AA", // North-East - Purple
  CC: "#FA9E0D", // Circle - Orange/Yellow
  DT: "#005EC4", // Downtown - Blue
  TE: "#784008", // Thomson-East Coast - Brown
  BP: "#748477", // Bukit Panjang LRT - Grey
  SE: "#748477", // Sengkang LRT - Grey
  PE: "#748477", // Punggol LRT - Grey
  CG: "#009645", // Changi Branch (EW extension) - Green
  CE: "#FA9E0D", // Circle Extension - Orange
};

/**
 * Crowd level colours for heatmap and indicators.
 */
export const CROWD_COLORS: Record<string, string> = {
  low: "#22c55e", // Green
  moderate: "#eab308", // Yellow
  crowded: "#f97316", // Orange
  very_crowded: "#ef4444", // Red
};
