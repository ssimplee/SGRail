"""Route planning Marshmallow schemas."""

from marshmallow import Schema, fields, validate


class RoutePlanRequestSchema(Schema):
    """Schema for route planning request."""

    originStationId = fields.String(required=True)
    destinationStationId = fields.String(required=True)
    departureTime = fields.DateTime(allow_none=True, load_default=None)
    mode = fields.String(
        required=True,
        validate=validate.OneOf(["LEAVE_NOW", "LEAVE_AT", "ARRIVE_BY"]),
    )
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
    avoidStations = fields.List(fields.String(), load_default=[])
    avoidLines = fields.List(fields.String(), load_default=[])


class RouteStepSchema(Schema):
    """Schema for a single step in a route."""

    type = fields.String(
        required=True,
        validate=validate.OneOf(["board", "ride", "transfer", "alight"]),
    )
    station = fields.String(allow_none=True, load_default=None)
    stationId = fields.String(allow_none=True, load_default=None)
    line = fields.String(allow_none=True, load_default=None)
    lineColour = fields.String(allow_none=True, load_default=None)
    direction = fields.String(allow_none=True, load_default=None)
    instruction = fields.String(allow_none=True, load_default=None)
    stops = fields.Integer(allow_none=True, load_default=None)
    minutes = fields.Integer(allow_none=True, load_default=None)
    fromLine = fields.String(allow_none=True, load_default=None)
    toLine = fields.String(allow_none=True, load_default=None)
    walkMinutes = fields.Integer(allow_none=True, load_default=None)
    stations = fields.List(fields.String(), load_default=[])


class RouteResultSchema(Schema):
    """Schema for a single route result."""

    totalMinutes = fields.Integer(required=True)
    walkingMinutes = fields.Integer(required=True)
    stops = fields.Integer(required=True)
    transfers = fields.Integer(required=True)
    estimatedFare = fields.String(allow_none=True, load_default=None)
    crowdEstimate = fields.String(allow_none=True, load_default=None)
    dataFreshness = fields.DateTime(allow_none=True, load_default=None)
    lastTrainWarnings = fields.List(fields.Dict(), load_default=[])
    accessibilityWarnings = fields.List(fields.Dict(), load_default=[])
    serviceAlerts = fields.List(fields.Dict(), load_default=[])
    steps = fields.List(fields.Nested(RouteStepSchema), required=True)


class RoutePlanResponseSchema(Schema):
    """Schema for route planning response."""

    routes = fields.List(fields.Nested(RouteResultSchema), required=True)
    source = fields.String(required=True)
    computedAt = fields.DateTime(required=True)
