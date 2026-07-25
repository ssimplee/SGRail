"""User-related Marshmallow schemas."""

from marshmallow import Schema, fields, validate


class UserPreferencesSchema(Schema):
    """Nested schema for user preferences."""

    language = fields.String(load_default="en")
    textScale = fields.Float(load_default=1.0)
    highContrast = fields.Boolean(load_default=False)
    colourBlindLabels = fields.Boolean(load_default=False)
    reducedMotion = fields.Boolean(load_default=False)


class UserProfileSchema(Schema):
    """Schema for user profile response."""

    id = fields.String(required=True)
    displayName = fields.String(required=True)
    reliabilityScore = fields.Integer(required=True)
    badge = fields.String(required=True)
    preferences = fields.Nested(UserPreferencesSchema, required=True)
    reportCount = fields.Integer(load_default=0)
    confirmCount = fields.Integer(load_default=0)


class UserPreferencesUpdateSchema(Schema):
    """Schema for updating user preferences (all fields optional)."""

    language = fields.String(
        validate=validate.OneOf(["en", "zh", "ms", "ta"]),
        load_default=None,
    )
    textScale = fields.Float(
        validate=validate.Range(min=0.5, max=2.0),
        load_default=None,
    )
    highContrast = fields.Boolean(load_default=None)
    colourBlindLabels = fields.Boolean(load_default=None)
    reducedMotion = fields.Boolean(load_default=None)


class SavedRouteSchema(Schema):
    """Schema for a saved route response."""

    id = fields.String(required=True)
    originStationId = fields.String(required=True)
    destinationStationId = fields.String(required=True)
    preference = fields.String(required=True)
    label = fields.String(allow_none=True, load_default=None)
    createdAt = fields.DateTime(required=True)


class SavedRouteCreateSchema(Schema):
    """Schema for creating a saved route."""

    originStationId = fields.String(required=True)
    destinationStationId = fields.String(required=True)
    preference = fields.String(
        required=True,
        validate=validate.OneOf([
            "FASTEST",
            "LEAST_CROWDED",
            "FEWEST_TRANSFERS",
            "LEAST_WALKING",
            "WHEELCHAIR",
            "LAST_TRAIN_SAFE",
        ]),
    )
    label = fields.String(allow_none=True, load_default=None)
