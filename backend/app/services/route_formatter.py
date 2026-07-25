"""Route formatter: converts a path of GraphNodes into structured route steps.

Transforms the raw (station_id, line_code) path from the route engine into
user-facing steps (board, ride, transfer, alight) with station names, line
colours, directions, and timing information.

Validates: Requirements 11.1–11.4, 13.1–13.6
"""

from __future__ import annotations

import json
import os
from datetime import datetime

from .route_engine import (
    ROUTE_GRAPH,
    GraphEdge,
    GraphNode,
    EdgeType,
)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LINE_COLORS: dict[str, str] = {
    "NS": "#D42E12",
    "EW": "#009645",
    "NE": "#9900AA",
    "CC": "#FA9E0D",
    "DT": "#005EC4",
    "TE": "#784008",
    "BP": "#748477",
}

LINE_NAMES: dict[str, str] = {
    "NS": "North-South Line",
    "EW": "East-West Line",
    "NE": "North-East Line",
    "CC": "Circle Line",
    "DT": "Downtown Line",
    "TE": "Thomson-East Coast Line",
    "BP": "Bukit Panjang LRT",
}


# ---------------------------------------------------------------------------
# Station Data Loader
# ---------------------------------------------------------------------------

_STATIONS_DATA: list[dict] | None = None


def _load_stations_data() -> list[dict]:
    """Load stations data from stations.json."""
    data_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "data", "stations.json"
    )
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _get_stations_data() -> list[dict]:
    """Get cached stations data."""
    global _STATIONS_DATA
    if _STATIONS_DATA is None:
        _STATIONS_DATA = _load_stations_data()
    return _STATIONS_DATA


def _get_station_name(station_id: str) -> str:
    """Look up station name by ID.

    Args:
        station_id: The station identifier (e.g., "jurong-east").

    Returns:
        The display name (e.g., "Jurong East"), or a title-cased fallback.
    """
    for station in _get_stations_data():
        if station["id"] == station_id:
            return station["name"]
    # Fallback: convert slug to title case
    return station_id.replace("-", " ").title()


def _get_station_code(station_id: str, line_code: str) -> str:
    """Look up the specific station code for a given station and line.

    Args:
        station_id: The station identifier.
        line_code: The line code (e.g., "NS").

    Returns:
        The station code (e.g., "NS1"), or line_code + "?" as fallback.
    """
    for station in _get_stations_data():
        if station["id"] == station_id:
            for code in station.get("codes", []):
                if code.startswith(line_code):
                    return code
    return f"{line_code}?"


def _get_edge_between(from_node: GraphNode, to_node: GraphNode) -> GraphEdge | None:
    """Find the edge between two adjacent nodes in the graph.

    Args:
        from_node: Source node.
        to_node: Target node.

    Returns:
        The GraphEdge if found, else None.
    """
    for edge in ROUTE_GRAPH.edges_from(from_node):
        if edge.to_node == to_node:
            return edge
    return None


# ---------------------------------------------------------------------------
# Direction Inference
# ---------------------------------------------------------------------------

# Maps (line_code, direction_index) to terminus station name.
# direction_index: 0 = "up" (towards higher station codes), 1 = "down" (towards lower)
# For simplicity we use terminus names as directions.
LINE_TERMINI: dict[str, tuple[str, str]] = {
    "NS": ("Marina South Pier", "Jurong East"),
    "EW": ("Pasir Ris", "Tuas Link"),
    "NE": ("Punggol", "HarbourFront"),
    "CC": ("Dhoby Ghaut", "HarbourFront"),
    "DT": ("Bukit Panjang", "Expo"),
    "TE": ("Woodlands North", "Bayshore"),
    "BP": ("Choa Chu Kang", "Bukit Panjang"),
}


def _infer_direction(path_segment: list[GraphNode]) -> str:
    """Infer the direction of travel for a ride segment.

    Looks at the first and last station in the segment and determines
    which terminus the train is heading towards based on station code
    sequence numbers.

    Args:
        path_segment: List of nodes all on the same line forming a ride.

    Returns:
        A direction string (terminus name) or "Unknown".
    """
    if len(path_segment) < 2:
        return "Unknown"

    line_code = path_segment[0][1]
    first_station_id = path_segment[0][0]
    last_station_id = path_segment[-1][0]

    first_code = _get_station_code(first_station_id, line_code)
    last_code = _get_station_code(last_station_id, line_code)

    # Extract numeric part from station codes
    try:
        first_num = int("".join(filter(str.isdigit, first_code)))
        last_num = int("".join(filter(str.isdigit, last_code)))
    except ValueError:
        return LINE_TERMINI.get(line_code, ("Unknown", "Unknown"))[0]

    termini = LINE_TERMINI.get(line_code, ("Unknown", "Unknown"))

    # If station numbers are increasing, heading towards terminus[0]
    # If decreasing, heading towards terminus[1]
    if last_num > first_num:
        return termini[0]
    else:
        return termini[1]


# ---------------------------------------------------------------------------
# Path to Steps Conversion
# ---------------------------------------------------------------------------


def format_route_steps(path: list[GraphNode]) -> list[dict]:
    """Convert a raw path of GraphNodes into structured route steps.

    Groups consecutive same-line nodes into ride segments, detects line
    changes as transfer steps, and bookends with board/alight steps.

    Args:
        path: Ordered list of (station_id, line_code) nodes from pathfinding.

    Returns:
        List of step dicts matching the RouteStepSchema format.
    """
    if not path or len(path) < 2:
        return []

    steps: list[dict] = []

    # Group path into segments by line
    segments: list[list[GraphNode]] = []
    current_segment: list[GraphNode] = [path[0]]

    for i in range(1, len(path)):
        prev_node = path[i - 1]
        curr_node = path[i]

        if prev_node[1] == curr_node[1]:
            # Same line — continue ride segment
            current_segment.append(curr_node)
        else:
            # Line change — end current segment, start transfer
            segments.append(current_segment)
            current_segment = [curr_node]

    # Don't forget the last segment
    segments.append(current_segment)

    # Convert segments to steps
    for seg_idx, segment in enumerate(segments):
        line_code = segment[0][1]
        direction = _infer_direction(segment)

        # Board step at the start of each segment
        board_station_id = segment[0][0]
        board_station_name = _get_station_name(board_station_id)
        line_colour = LINE_COLORS.get(line_code, "#888888")

        steps.append({
            "type": "board",
            "station": board_station_name,
            "stationId": board_station_id,
            "line": line_code,
            "lineColour": line_colour,
            "direction": direction,
            "instruction": f"Board {line_code} Line towards {direction}",
        })

        # Ride step: intermediate stations
        if len(segment) > 1:
            ride_station_codes = [
                _get_station_code(node[0], node[1]) for node in segment[1:]
            ]
            # Calculate ride time from edges
            ride_minutes = 0.0
            for i in range(len(segment) - 1):
                edge = _get_edge_between(segment[i], segment[i + 1])
                if edge:
                    ride_minutes += edge.travel_minutes

            steps.append({
                "type": "ride",
                "stations": ride_station_codes,
                "stops": len(segment) - 1,
                "minutes": round(ride_minutes),
            })

        # Alight step at the end of this segment
        alight_station_id = segment[-1][0]
        alight_station_name = _get_station_name(alight_station_id)

        # If this is the last segment, add a final alight step
        if seg_idx == len(segments) - 1:
            steps.append({
                "type": "alight",
                "station": alight_station_name,
                "stationId": alight_station_id,
                "instruction": f"Alight at {alight_station_name}",
            })
        else:
            # Transfer step between this segment and the next
            next_segment = segments[seg_idx + 1]
            to_line = next_segment[0][1]
            to_line_colour = LINE_COLORS.get(to_line, "#888888")

            # Find walk time from the transfer edge
            transfer_from_node = segment[-1]
            transfer_to_node = next_segment[0]
            walk_minutes = 3  # default transfer time
            edge = _get_edge_between(transfer_from_node, transfer_to_node)
            if edge:
                walk_minutes = round(edge.walk_minutes) if edge.walk_minutes > 0 else 3

            line_name = LINE_NAMES.get(to_line, f"{to_line} Line")
            steps.append({
                "type": "transfer",
                "station": alight_station_name,
                "stationId": alight_station_id,
                "fromLine": line_code,
                "toLine": to_line,
                "walkMinutes": walk_minutes,
                "instruction": f"Transfer to {to_line} Line ({to_line_colour})",
            })

    return steps


# ---------------------------------------------------------------------------
# Route Summary Calculation
# ---------------------------------------------------------------------------


def compute_route_summary(
    path: list[GraphNode],
    steps: list[dict],
) -> dict:
    """Compute aggregate route metrics from path and formatted steps.

    Args:
        path: The raw path of GraphNodes.
        steps: The formatted step list from format_route_steps().

    Returns:
        Dict with totalMinutes, walkingMinutes, stops, transfers, estimatedFare,
        crowdEstimate.
    """
    total_minutes = 0.0
    walking_minutes = 0.0
    total_stops = 0
    total_transfers = 0
    crowd_levels: list[float] = []

    # Calculate from edges in path
    for i in range(len(path) - 1):
        edge = _get_edge_between(path[i], path[i + 1])
        if edge:
            total_minutes += edge.travel_minutes + edge.walk_minutes
            walking_minutes += edge.walk_minutes
            if edge.edge_type == EdgeType.TRANSFER:
                total_transfers += 1
            elif edge.edge_type == EdgeType.RIDE:
                total_stops += 1
            if edge.crowd_level > 0:
                crowd_levels.append(edge.crowd_level)

    # Estimate fare based on stops (simplified Singapore MRT fare model)
    fare = _estimate_fare(total_stops)

    # Average crowd estimate
    avg_crowd = sum(crowd_levels) / len(crowd_levels) if crowd_levels else 0.3
    crowd_label = _crowd_level_label(avg_crowd)

    return {
        "totalMinutes": round(total_minutes),
        "walkingMinutes": round(walking_minutes),
        "stops": total_stops,
        "transfers": total_transfers,
        "estimatedFare": fare,
        "crowdEstimate": crowd_label,
    }


def _estimate_fare(stops: int) -> str:
    """Estimate MRT fare based on number of stops (simplified model).

    Based on Singapore adult card fare structure (approximate):
    - 1-3 stops: $0.92 - $1.09
    - 4-6 stops: $1.09 - $1.29
    - 7-10 stops: $1.29 - $1.59
    - 11+ stops: $1.59 - $2.09

    Args:
        stops: Number of stops in the journey.

    Returns:
        Fare string like "$1.60".
    """
    if stops <= 3:
        fare = 0.92 + stops * 0.06
    elif stops <= 6:
        fare = 1.09 + (stops - 3) * 0.07
    elif stops <= 10:
        fare = 1.29 + (stops - 6) * 0.08
    else:
        fare = 1.59 + (stops - 10) * 0.05

    return f"${fare:.2f}"


def _crowd_level_label(level: float) -> str:
    """Convert a numeric crowd level to a label.

    Args:
        level: Float between 0.0 and 1.0.

    Returns:
        One of "low", "moderate", "crowded", "very_crowded".
    """
    if level < 0.3:
        return "low"
    elif level < 0.6:
        return "moderate"
    elif level < 0.8:
        return "crowded"
    else:
        return "very_crowded"
