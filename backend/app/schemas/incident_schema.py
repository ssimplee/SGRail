"""Incident-related Marshmallow schemas."""

from marshmallow import Schema, fields, validate


INCIDENT_CATEGORIES = [
    "overcrowding",
    "lift_breakdown",
    "escalator_breakdown",
    "train_delay",
    "closed_exit",
    "platform_congestion",
    "suspicious_activity",
    "lost_item",
    "other",
]

INTERACTION_ACTIONS = [
    "like",
    "dislike",
    "confirm",
    "remove_like",
    "remove_dislike",
    "remove_confirm",
    "remove_report_abusive",
    "resolve",
    "report_abusive",
]


class IncidentCreateSchema(Schema):
    """Schema for creating a new incident report."""

    stationId = fields.String(required=True)
    lineCode = fields.String(allow_none=True, load_default=None)
    category = fields.String(
        required=True,
        validate=validate.OneOf(INCIDENT_CATEGORIES),
    )
    title = fields.String(required=True)
    description = fields.String(
        required=True,
        validate=validate.Length(min=10),
    )
    incidentTime = fields.String(required=True)
    isAnonymous = fields.Boolean(load_default=False)
    locationConsent = fields.Boolean(load_default=False)
    latitude = fields.Float(allow_none=True, load_default=None)
    longitude = fields.Float(allow_none=True, load_default=None)


class IncidentInteractionSchema(Schema):
    """Schema for interacting with an incident (like, confirm, etc.)."""

    action = fields.String(
        required=True,
        validate=validate.OneOf(INTERACTION_ACTIONS),
    )


class IncidentResponseSchema(Schema):
    """Schema for incident response data."""

    id = fields.String(required=True)
    userId = fields.String(allow_none=True, load_default=None)
    stationId = fields.String(required=True)
    lineCode = fields.String(allow_none=True, load_default=None)
    category = fields.String(required=True)
    title = fields.String(required=True)
    description = fields.String(required=True)
    photoUrl = fields.String(allow_none=True, load_default=None)
    incidentTime = fields.DateTime(required=True)
    createdAt = fields.DateTime(required=True)
    status = fields.String(required=True)
    moderationStatus = fields.String(required=True)
    trustState = fields.String(required=True)
    isAnonymous = fields.Boolean(required=True)
    likeCount = fields.Integer(load_default=0)
    dislikeCount = fields.Integer(load_default=0)
    confirmCount = fields.Integer(load_default=0)


class IncidentListResponseSchema(Schema):
    """Schema for paginated incident list response."""

    incidents = fields.List(fields.Nested(IncidentResponseSchema), required=True)
    total = fields.Integer(required=True)
    page = fields.Integer(required=True)
    pageSize = fields.Integer(required=True)
