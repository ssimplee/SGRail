"""User routes — profile, preferences, and saved routes."""

from flask import Blueprint, jsonify, request

from app.schemas.user_schema import (
    SavedRouteCreateSchema,
    SavedRouteSchema,
    UserPreferencesUpdateSchema,
    UserProfileSchema,
)
from app.services import user_service

users_bp = Blueprint("users", __name__, url_prefix="/api/v1/users")


def _serialize_user(user) -> dict:
    """Serialize a User model to the profile response shape."""
    schema = UserProfileSchema()
    return schema.dump(
        {
            "id": user.id,
            "displayName": user.display_name,
            "reliabilityScore": user.reliability_score,
            "badge": user.badge,
            "preferences": {
                "language": user.preferred_language,
                "textScale": user.text_scale,
                "highContrast": user.high_contrast,
                "colourBlindLabels": user.colour_blind_labels,
                "reducedMotion": user.reduced_motion,
            },
            "reportCount": user.incidents.count() if user.incidents else 0,
            "confirmCount": 0,  # Simplified for demo
        }
    )


def _serialize_saved_route(route) -> dict:
    """Serialize a SavedRoute model to the response shape."""
    schema = SavedRouteSchema()
    return schema.dump(
        {
            "id": route.id,
            "originStationId": route.origin_station_id,
            "destinationStationId": route.destination_station_id,
            "preference": route.preference,
            "label": route.label,
            "createdAt": route.created_at,
        }
    )


@users_bp.route("/me", methods=["GET"])
def get_current_user():
    """GET /users/me — return the demo user's profile."""
    user = user_service.get_or_create_demo_user()
    return jsonify(_serialize_user(user)), 200


@users_bp.route("/me/preferences", methods=["PATCH"])
def update_preferences():
    """PATCH /users/me/preferences — update user preferences."""
    schema = UserPreferencesUpdateSchema()
    data = request.get_json(silent=True) or {}
    errors = schema.validate(data)
    if errors:
        return jsonify({"error": "validation_failed", "details": errors}), 422

    parsed = schema.load(data)
    user = user_service.get_or_create_demo_user()
    user_service.update_preferences(user.id, parsed)
    return jsonify({"success": True}), 200


@users_bp.route("/me/saved-routes", methods=["GET"])
def get_saved_routes():
    """GET /users/me/saved-routes — list all saved routes."""
    user = user_service.get_or_create_demo_user()
    routes = user_service.get_saved_routes(user.id)
    return jsonify([_serialize_saved_route(r) for r in routes]), 200


@users_bp.route("/me/saved-routes", methods=["POST"])
def create_saved_route():
    """POST /users/me/saved-routes — create a new saved route."""
    schema = SavedRouteCreateSchema()
    data = request.get_json(silent=True) or {}
    errors = schema.validate(data)
    if errors:
        return jsonify({"error": "validation_failed", "details": errors}), 422

    parsed = schema.load(data)
    user = user_service.get_or_create_demo_user()
    route = user_service.create_saved_route(user.id, parsed)
    return jsonify(_serialize_saved_route(route)), 201


@users_bp.route("/me/saved-routes/<route_id>", methods=["DELETE"])
def delete_saved_route(route_id: str):
    """DELETE /users/me/saved-routes/{route_id} — delete a saved route."""
    user = user_service.get_or_create_demo_user()
    deleted = user_service.delete_saved_route(user.id, route_id)
    if not deleted:
        return jsonify({"error": "not_found", "message": "Saved route not found"}), 404
    return jsonify({"success": True}), 200
