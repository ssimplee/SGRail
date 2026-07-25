"""Incident-related API endpoints.

Validates: Requirements 17.1, 18.1–18.5, 19.1–19.3
"""

from flask import Blueprint, jsonify, request
from marshmallow import ValidationError

from app.extensions import limiter
from app.schemas.incident_schema import IncidentCreateSchema, IncidentInteractionSchema
from app.services.incident_service import (
    add_interaction,
    create_incident,
    get_incident,
    list_incidents,
    report_incident,
    resolve_incident,
)

incidents_bp = Blueprint("incidents", __name__)

# Schema instances
_create_schema = IncidentCreateSchema()
_interaction_schema = IncidentInteractionSchema()


@incidents_bp.route("/incidents", methods=["GET"])
def list_incidents_route():
    """Return paginated list of incidents with optional filters.

    Query params:
        station: Filter by station ID.
        line: Filter by line code.
        category: Filter by incident category.
        status: Filter by status (default: active).
        page: Page number (default: 1).
        pageSize: Results per page (default: 20).

    Returns:
        JSON with incidents list, total, page, and pageSize.
    """
    filters = {}
    if request.args.get("station"):
        filters["station"] = request.args.get("station")
    if request.args.get("line"):
        filters["line"] = request.args.get("line")
    if request.args.get("category"):
        filters["category"] = request.args.get("category")
    if request.args.get("status"):
        filters["status"] = request.args.get("status")

    page = request.args.get("page", default=1, type=int)
    page_size = request.args.get("pageSize", default=20, type=int)

    result = list_incidents(filters=filters, page=page, page_size=page_size)
    return jsonify(result)


@incidents_bp.route("/incidents", methods=["POST"])
@limiter.limit("10/hour")
def create_incident_route():
    """Create a new incident report.

    Rate-limited to 10 submissions per hour per client.

    Request body:
        stationId, category, title, description, incidentTime (required)
        lineCode, isAnonymous, locationConsent, latitude, longitude (optional)

    Returns:
        201 with created incident data, or
        422 with moderation rejection details.
    """
    json_data = request.get_json(force=True, silent=True)
    if not json_data:
        return jsonify({"error": "Request body is required"}), 400

    # Validate with schema
    try:
        data = _create_schema.load(json_data)
    except ValidationError as err:
        return jsonify({"error": "validation_error", "details": err.messages}), 400

    # Use a demo user ID for now (auth will be added later)
    user_id = request.headers.get("X-User-Id", "demo-user")

    result = create_incident(user_id=user_id, data=data)

    if result.get("error") == "moderation_rejected":
        return jsonify(result), 422

    return jsonify(result), 201


@incidents_bp.route("/incidents/<incident_id>", methods=["GET"])
def get_incident_route(incident_id: str):
    """Return a single incident by ID.

    Args:
        incident_id: The incident UUID from the URL path.

    Returns:
        JSON with incident data or 404.
    """
    result = get_incident(incident_id)
    if result is None:
        return jsonify({"error": "Incident not found"}), 404
    return jsonify(result)


@incidents_bp.route("/incidents/<incident_id>/interactions", methods=["POST"])
def add_interaction_route(incident_id: str):
    """Add an interaction (like, dislike, confirm) to an incident.

    Enforces unique constraint: one action type per user per incident.

    Args:
        incident_id: The incident UUID from the URL path.

    Request body:
        action: One of like, dislike, confirm, resolve, report_abusive.

    Returns:
        200 with success, 404 if not found, or 409 if duplicate.
    """
    json_data = request.get_json(force=True, silent=True)
    if not json_data:
        return jsonify({"error": "Request body is required"}), 400

    try:
        data = _interaction_schema.load(json_data)
    except ValidationError as err:
        return jsonify({"error": "validation_error", "details": err.messages}), 400

    user_id = request.headers.get("X-User-Id", "demo-user")

    result = add_interaction(
        incident_id=incident_id,
        user_id=user_id,
        action=data["action"],
    )

    if result.get("error") == "incident_not_found":
        return jsonify({"error": "Incident not found"}), 404
    if result.get("error") == "duplicate_action":
        return jsonify({"error": "duplicate_action"}), 409

    return jsonify(result)


@incidents_bp.route("/incidents/<incident_id>/resolve", methods=["POST"])
def resolve_incident_route(incident_id: str):
    """Mark an incident as resolved.

    Args:
        incident_id: The incident UUID from the URL path.

    Returns:
        200 with success or 404 if not found.
    """
    user_id = request.headers.get("X-User-Id", "demo-user")

    result = resolve_incident(incident_id=incident_id, user_id=user_id)

    if result.get("error") == "incident_not_found":
        return jsonify({"error": "Incident not found"}), 404

    return jsonify(result)


@incidents_bp.route("/incidents/<incident_id>/moderation-report", methods=["POST"])
def report_incident_route(incident_id: str):
    """Flag an incident for abuse review.

    Args:
        incident_id: The incident UUID from the URL path.

    Returns:
        200 with success, 404 if not found, or 409 if already reported.
    """
    user_id = request.headers.get("X-User-Id", "demo-user")

    result = report_incident(incident_id=incident_id, user_id=user_id)

    if result.get("error") == "incident_not_found":
        return jsonify({"error": "Incident not found"}), 404
    if result.get("error") == "duplicate_action":
        return jsonify({"error": "Already reported"}), 409

    return jsonify(result)
