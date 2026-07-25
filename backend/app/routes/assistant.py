"""AI Assistant chat endpoint.

Validates: Requirements 22.1, 22.2, 22.3, 23.1, 24.1
"""

from flask import Blueprint, jsonify, request
from marshmallow import ValidationError

from app.extensions import limiter
from app.integrations import get_ai_provider
from app.schemas.assistant_schema import ChatRequestSchema, ChatResponseSchema

assistant_bp = Blueprint("assistant", __name__)

# Schema instances
_request_schema = ChatRequestSchema()
_response_schema = ChatResponseSchema()


@assistant_bp.route("/assistant/chat", methods=["POST"])
@limiter.limit("30/hour")
def chat():
    """Process a user chat message via the AI assistant.

    Rate-limited to 30 requests per hour per client (Req 37.4).

    Request body:
        message (required): The user's chat message.
        context (optional): Dict with currentStationId, selectedRoutePreference.

    Returns:
        JSON response with reply, intent, stationIds, lineCodes, route,
        warning, uiAction, and dataFreshness.
    """
    json_data = request.get_json()
    if json_data is None:
        return jsonify({"error": "Request body is required"}), 400

    # Validate request payload
    try:
        data = _request_schema.load(json_data)
    except ValidationError as err:
        return jsonify({"error": "validation_error", "details": err.messages}), 400

    message = data["message"]
    context = data.get("context") or {}

    # Get the configured AI provider and process the message
    provider = get_ai_provider()
    response = provider.chat(message, context)

    return jsonify(response), 200
