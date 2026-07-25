"""Route planning API endpoints.

Provides POST /routes/plan and POST /routes/recalculate for multi-preference
MRT route planning with step formatting, last-train warnings, accessibility
warnings, and crowd estimates.

Validates: Requirements 11.1–11.4, 13.1–13.6, 14.5
"""

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from marshmallow import ValidationError

from app.schemas.route_schema import RoutePlanRequestSchema, RoutePlanResponseSchema
from app.services.route_engine import (
    ROUTE_GRAPH,
    find_routes,
    validate_last_train,
)
from app.services.route_formatter import (
    compute_route_summary,
    format_route_steps,
)

routes_bp = Blueprint("routes", __name__)

_request_schema = RoutePlanRequestSchema()
_response_schema = RoutePlanResponseSchema()


@routes_bp.route("/routes/plan", methods=["POST"])
def plan_route():
    """Plan route(s) between two MRT stations.

    Accepts a JSON body matching RoutePlanRequestSchema and returns up to 3
    alternative routes with steps, timing, fare, crowd, and last-train info.

    Returns:
        JSON response matching RoutePlanResponseSchema, or 400/422 on error.
    """
    json_data = request.get_json(silent=True)
    if json_data is None:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    # Validate request
    try:
        data = _request_schema.load(json_data)
    except ValidationError as err:
        return jsonify({"error": "Validation error", "details": err.messages}), 422

    origin_id = data["originStationId"]
    dest_id = data["destinationStationId"]
    preference = data["preference"]
    avoid_stations = data.get("avoidStations", [])
    avoid_lines = data.get("avoidLines", [])
    departure_time = data.get("departureTime")
    mode = data["mode"]

    # Determine departure time
    if mode == "LEAVE_NOW" or departure_time is None:
        departure_time = datetime.now(timezone.utc)

    # Validate origin and destination exist in the graph
    origin_nodes = [n for n in ROUTE_GRAPH.get_all_nodes() if n[0] == origin_id]
    dest_nodes = [n for n in ROUTE_GRAPH.get_all_nodes() if n[0] == dest_id]

    if not origin_nodes:
        return jsonify({"error": f"Origin station '{origin_id}' not found in network"}), 404
    if not dest_nodes:
        return jsonify({"error": f"Destination station '{dest_id}' not found in network"}), 404

    if origin_id == dest_id:
        return jsonify({"error": "Origin and destination must be different stations"}), 422

    # Find routes using the route engine
    raw_routes = find_routes(
        graph=ROUTE_GRAPH,
        origin_station_id=origin_id,
        dest_station_id=dest_id,
        preference=preference,
        avoid_stations=avoid_stations,
        avoid_lines=avoid_lines,
        max_routes=3,
    )

    if not raw_routes:
        return jsonify({"error": "No route found between the specified stations"}), 404

    # Format each route into steps and compute summaries
    now = datetime.now(timezone.utc)
    formatted_routes = []

    for path, _cost in raw_routes:
        # Format path into steps
        steps = format_route_steps(path)

        # Compute summary metrics
        summary = compute_route_summary(path, steps)

        # Validate against last-train timings
        last_train_warnings = validate_last_train(path, departure_time)

        # Check accessibility warnings (wheelchair preference)
        accessibility_warnings = []
        if preference == "WHEELCHAIR":
            accessibility_warnings = _check_accessibility(path)

        route_result = {
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
        formatted_routes.append(route_result)

    response = {
        "routes": formatted_routes,
        "source": "computed",
        "computedAt": now.isoformat(),
    }

    return jsonify(response), 200


@routes_bp.route("/routes/recalculate", methods=["POST"])
def recalculate_route():
    """Recalculate a route, typically after a disruption or preference change.

    Accepts the same request body as /routes/plan. This endpoint exists to
    semantically distinguish an initial plan from a recalculation (which may
    include updated crowd data or disruption avoidance in the future).

    Returns:
        JSON response matching RoutePlanResponseSchema, or 400/422 on error.
    """
    # Recalculate uses the same logic as plan, reusing the handler
    return plan_route()


def _check_accessibility(path: list) -> list[dict]:
    """Check a path for accessibility issues.

    Examines each edge in the path to find inaccessible segments and
    returns warnings for wheelchair users.

    Args:
        path: The route path as a list of GraphNode tuples.

    Returns:
        List of accessibility warning dicts.
    """
    warnings = []
    for i in range(len(path) - 1):
        from_node = path[i]
        to_node = path[i + 1]
        for edge in ROUTE_GRAPH.edges_from(from_node):
            if edge.to_node == to_node:
                if not edge.accessible:
                    from app.services.route_formatter import _get_station_name
                    warnings.append({
                        "type": "INACCESSIBLE_SEGMENT",
                        "station": from_node[0],
                        "stationName": _get_station_name(from_node[0]),
                        "line": from_node[1],
                        "message": f"Segment near {_get_station_name(from_node[0])} may not be wheelchair accessible",
                    })
                break
    return warnings
