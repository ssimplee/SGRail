"""AI Assistant Marshmallow schemas."""

from marshmallow import Schema, fields


class ChatContextSchema(Schema):
    """Nested schema for chat request context."""

    currentStationId = fields.String(allow_none=True, load_default=None)
    selectedRoutePreference = fields.String(allow_none=True, load_default=None)


class ChatRequestSchema(Schema):
    """Schema for AI assistant chat request."""

    message = fields.String(required=True)
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
