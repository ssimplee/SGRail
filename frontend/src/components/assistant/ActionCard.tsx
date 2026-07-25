import { MapPin, Route, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ChatMessage } from "@/types/assistant.types";
import { useMapStore } from "@/store/mapStore";

interface ActionCardProps {
  message: ChatMessage;
}

/**
 * Clickable card rendered when the assistant response contains stationIds
 * or a uiAction. Dispatches highlights to the map store on click.
 *
 * Validates: Requirements 23.1, 23.2
 */
export function ActionCard({ message }: ActionCardProps) {
  const { setHighlightedStations, setHighlightedRoute } = useMapStore();
  const navigate = useNavigate();

  const hasStations = message.stationIds && message.stationIds.length > 0;
  const hasRoute = message.route && message.route.length > 0;

  const handleClick = () => {
    if (hasRoute) {
      setHighlightedRoute(message.route!);
    }
    if (hasStations) {
      setHighlightedStations(message.stationIds!);
    }
    navigate("/"); // Go to map page
  };

  const getIcon = () => {
    switch (message.uiAction) {
      case "HIGHLIGHT_ROUTE":
      case "OPEN_ROUTE_RESULT":
        return <Route className="w-4 h-4" aria-hidden="true" />;
      case "SHOW_WARNING":
        return <AlertTriangle className="w-4 h-4" aria-hidden="true" />;
      default:
        return <MapPin className="w-4 h-4" aria-hidden="true" />;
    }
  };

  const getLabel = () => {
    if (hasRoute) {
      return `View route (${message.route!.length} stations)`;
    }
    if (hasStations) {
      const count = message.stationIds!.length;
      return count === 1
        ? "View station on map"
        : `View ${count} stations on map`;
    }
    return "View on map";
  };

  if (!hasStations && !hasRoute) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-fit"
      aria-label={getLabel()}
    >
      {getIcon()}
      <span>{getLabel()}</span>
    </button>
  );
}
