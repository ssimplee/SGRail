"""Tool functions for the agentic AI assistant.

Each function wraps existing service logic and returns a plain,
JSON-serializable dict — no LLM-provider wire-format concerns here (that
translation lives in agent_tools_schema.py). Station arguments accept a
free-text name or code; every tool resolves it internally via
resolve_station_id() so the calling LLM never needs a separate lookup
round trip.

See AIPLAN.md, "Agentic tool-calling", for the design rationale.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.services import alert_service, incident_service, route_engine, route_formatter, station_service
from app.services.ai_orchestrator import _find_station
from app.services.crowd_service import CrowdService


def resolve_station_id(query: str | None) -> str | None:
    """Resolve a free-text station name or code to its internal station id.

    Reuses ai_orchestrator's case-insensitive name/id/code/substring
    matcher so tool argument resolution stays consistent with the
    rule-based fallback's own station recognition, rather than
    duplicating that logic here.
    """
    if not query:
        return None
    station = _find_station(query)
    return station["id"] if station else None


def _check_accessibility(path: list) -> list[dict]:
    """Accessibility warnings for a computed path (WHEELCHAIR preference).

    Mirrors backend/app/routes/routes.py's private helper of the same
    name — duplicated rather than imported to avoid a route-module ->
    service-module dependency running the wrong direction.
    """
    warnings: list[dict] = []
    for i in range(len(path) - 1):
        from_node = path[i]
        to_node = path[i + 1]
        for edge in route_engine.ROUTE_GRAPH.edges_from(from_node):
            if edge.to_node == to_node:
                if not edge.accessible:
                    station_name = route_formatter._get_station_name(from_node[0])
                    warnings.append(
                        {
                            "type": "INACCESSIBLE_SEGMENT",
                            "station": from_node[0],
                            "stationName": station_name,
                            "line": from_node[1],
                            "message": f"Segment near {station_name} may not be wheelchair accessible",
                        }
                    )
                break
    return warnings


def plan_route(
    origin: str,
    destination: str,
    preference: str = "FASTEST",
    avoid_stations: list[str] | None = None,
    avoid_lines: list[str] | None = None,
    departure_time: str | None = None,
) -> dict:
    """Plan up to 3 routes between two stations.

    Runs the exact same logic as POST /routes/plan (route_engine.find_routes
    -> route_formatter.format_route_steps/compute_route_summary ->
    validate_last_train, plus accessibility checks for WHEELCHAIR) rather
    than reimplementing route planning.

    Args:
        origin: Origin station name or code (e.g. "Bishan", "NS17").
        destination: Destination station name or code.
        preference: FASTEST | LEAST_CROWDED | FEWEST_TRANSFERS |
            LEAST_WALKING | WHEELCHAIR | LAST_TRAIN_SAFE.
        avoid_stations: Station names/codes to avoid, if any.
        avoid_lines: Line codes to avoid, if any (e.g. ["CC"]).
        departure_time: ISO 8601 datetime string, or None for "now".

    Returns:
        {"routes": [...], "error": str | None} — routes is empty and error
        is set when a station can't be resolved or no route exists.
    """
    origin_id = resolve_station_id(origin)
    destination_id = resolve_station_id(destination)

    if origin_id is None:
        return {"routes": [], "error": f"Could not find a station matching '{origin}'."}
    if destination_id is None:
        return {"routes": [], "error": f"Could not find a station matching '{destination}'."}
    if origin_id == destination_id:
        return {"routes": [], "error": "Origin and destination must be different stations."}

    if preference not in route_engine.PREFERENCE_WEIGHTS:
        preference = "FASTEST"

    resolved_avoid_stations = []
    for name in avoid_stations or []:
        avoid_id = resolve_station_id(name)
        if avoid_id:
            resolved_avoid_stations.append(avoid_id)

    if departure_time:
        try:
            parsed_departure = datetime.fromisoformat(departure_time.replace("Z", "+00:00"))
        except ValueError:
            parsed_departure = datetime.now(timezone.utc)
    else:
        parsed_departure = datetime.now(timezone.utc)

    raw_routes = route_engine.find_routes(
        graph=route_engine.ROUTE_GRAPH,
        origin_station_id=origin_id,
        dest_station_id=destination_id,
        preference=preference,
        avoid_stations=resolved_avoid_stations,
        avoid_lines=avoid_lines or [],
        max_routes=3,
    )

    if not raw_routes:
        return {"routes": [], "error": "No route found between the specified stations."}

    now = datetime.now(timezone.utc)
    formatted_routes = []
    for path, _cost in raw_routes:
        steps = route_formatter.format_route_steps(path)
        summary = route_formatter.compute_route_summary(path, steps)
        last_train_warnings = route_engine.validate_last_train(path, parsed_departure)
        accessibility_warnings = (
            _check_accessibility(path) if preference == "WHEELCHAIR" else []
        )
        formatted_routes.append(
            {
                "totalMinutes": summary["totalMinutes"],
                "walkingMinutes": summary["walkingMinutes"],
                "stops": summary["stops"],
                "transfers": summary["transfers"],
                "estimatedFare": summary["estimatedFare"],
                "crowdEstimate": summary["crowdEstimate"],
                "dataFreshness": now.isoformat(),
                "lastTrainWarnings": last_train_warnings,
                "accessibilityWarnings": accessibility_warnings,
                "steps": steps,
            }
        )

    return {
        "routes": formatted_routes,
        "error": None,
        # Resolved ids, not the model's own transcription — see AIPLAN.md
        # phase 18. The tool-calling loop attaches these to the final
        # response's stationIds instead of trusting what the model writes.
        "originStationId": origin_id,
        "destinationStationId": destination_id,
    }


def get_crowd_level(station: str) -> dict:
    """Current crowd level for a station (community reports, else a provider/simulated fallback)."""
    station_id = resolve_station_id(station)
    if station_id is None:
        return {"error": f"Could not find a station matching '{station}'."}
    result = CrowdService().get_station_crowd(station_id)
    result["stationId"] = station_id
    return result


def get_last_train(station: str, day_type: str = "weekday") -> dict:
    """First/last train times for every line and direction serving a station.

    Args:
        station: Station name or code.
        day_type: "weekday" | "saturday" | "sunday_ph".
    """
    station_id = resolve_station_id(station)
    if station_id is None:
        return {"error": f"Could not find a station matching '{station}'.", "timings": []}

    if day_type not in ("weekday", "saturday", "sunday_ph"):
        day_type = "weekday"

    timings_data = route_engine._get_timings_data()
    timings = [
        {
            "line": entry["line_code"],
            "direction": entry["direction"],
            "directionName": entry.get("direction_name"),
            "dayType": entry["service_day_type"],
            "firstTrain": entry["first_train"],
            "lastTrain": entry["last_train"],
        }
        for entry in timings_data
        if entry["station_id"] == station_id and entry["service_day_type"] == day_type
    ]
    return {"timings": timings, "error": None, "stationId": station_id}


def get_incidents(station: str | None = None, line: str | None = None) -> dict:
    """Official service alerts plus community-reported incidents, optionally filtered.

    Reports each source's honest provenance (alertsSource: "lta_datamall"
    for real live data vs "simulated"/"none" for demo mode) so the caller
    can be transparent about it rather than implying real-time government
    data when the app is running against the mock feed.

    Args:
        station: Station name or code to filter by, or None for network-wide.
        line: Line code to filter by (e.g. "NS"), or None.
    """
    station_id = resolve_station_id(station) if station else None

    alerts = (
        alert_service.get_alerts_for_station(station_id)
        if station_id
        else alert_service.get_active_alerts()
    )
    if line:
        alerts = [a for a in alerts if a.get("lineCode") == line]

    community_filters: dict = {"status": "active"}
    if station_id:
        community_filters["station"] = station_id
    if line:
        community_filters["line"] = line

    community = incident_service.list_incidents(filters=community_filters, page=1, page_size=20)

    return {
        "officialAlerts": alerts,
        "officialAlertsSource": alert_service.alerts_source(),
        "communityIncidents": community["incidents"],
        "communityIncidentsTotal": community["total"],
        "stationId": station_id,
    }


def get_station_facilities(station: str) -> dict:
    """Facilities, exits, accessibility status, and live disruptions for a station."""
    station_id = resolve_station_id(station)
    if station_id is None:
        return {"error": f"Could not find a station matching '{station}'."}
    detail = station_service.get_station_detail(station_id)
    if detail is None:
        return {"error": f"Station '{station}' not found."}
    detail["stationId"] = station_id
    return detail
