"""Crowd submission API endpoints.

Provides POST endpoint for community crowd level submissions.
Validates: Requirements 15.1, 16.1, 16.2, 16.3
"""

from flask import Blueprint, jsonify, request

from app.services.crowd_service import CrowdService

crowd_bp = Blueprint("crowd", __name__)

# Shared service instance
_crowd_service = CrowdService()


@crowd_bp.route("/stations/<station_id>/crowd", methods=["POST"])
def submit_crowd_level(station_id: str):
    """Submit a community crowd level observation for a station.

    Body JSON:
        level: One of "low", "moderate", "crowded", "very_crowded" (required).

    Headers:
        X-User-Id: The user's identifier (required for anti-spam).

    Returns:
        201: Successful submission with confirmation.
        400: Missing or invalid level.
        401: Missing user identification.
        429: Duplicate submission within anti-spam window.
    """
    # Get user identity from header (simplified auth)
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({
            "error": "unauthorized",
            "message": "X-User-Id header is required.",
        }), 401

    # Parse request body
    data = request.get_json(silent=True)
    if not data or "level" not in data:
        return jsonify({
            "error": "bad_request",
            "message": "Request body must include 'level' field.",
        }), 400

    level = data["level"]

    # Submit via service
    result = _crowd_service.submit_crowd_level(
        user_id=user_id,
        station_id=station_id,
        level=level,
    )

    if not result["success"]:
        error = result["error"]
        if error == "duplicate_submission":
            return jsonify({
                "error": error,
                "message": result["message"],
            }), 429
        elif error == "invalid_level":
            return jsonify({
                "error": error,
                "message": result["message"],
            }), 400
        else:
            return jsonify({
                "error": error,
                "message": result["message"],
            }), 400

    return jsonify(result["data"]), 201
