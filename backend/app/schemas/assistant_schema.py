"""AI Assistant Marshmallow schemas."""

from marshmallow import Schema, fields, validate


class ChatContextSchema(Schema):
    """Nested schema for chat request context."""

    currentStationId = fields.String(allow_none=True, load_default=None)
    selectedRoutePreference = fields.String(allow_none=True, load_default=None)
    # UI language hint (e.g. "en", "zh", "ms", "ta") so the assistant can
    # reply in the same language as the app, per _SYSTEM_PROMPT's
    # instruction in ai_client.py.
    language = fields.String(allow_none=True, load_default=None)


class ChatRequestSchema(Schema):
    """Schema for AI assistant chat request."""

    message = fields.String(required=True, validate=validate.Length(max=500))
    context = fields.Nested(ChatContextSchema, load_default={})


class ChatResponseSchema(Schema):
    """Schema for AI assistant chat response."""

    reply = fields.String(required=True)
    intent = fields.String(allow_none=True, load_default=None)
    stationIds = fields.List(fields.String(), load_default=[])
    lineCodes = fields.List(fields.String(), load_default=[])
    route = fields.Dict(allow_none=True, load_default=None)
    warning = fields.String(allow_none=True, load_default=None)
    uiAction = fields.String(allow_none=True, load_default=None)
    dataFreshness = fields.DateTime(allow_none=True, load_default=None)
    # Real computed route(s) from the plan_route tool, attached
    # programmatically (never trusted from the LLM's own transcription) so
    # the UI can render exact numbers instead of a text-only summary.
    routeResults = fields.List(fields.Dict(), allow_none=True, load_default=None)
