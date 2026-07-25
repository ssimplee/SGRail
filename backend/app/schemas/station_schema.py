"""Station-related Marshmallow schemas."""

from marshmallow import Schema, fields


class StationSchema(Schema):
    """Schema for basic station information."""

    id = fields.String(required=True)
    name = fields.String(required=True)
    codes = fields.List(fields.String(), required=True)
    lines = fields.List(fields.String(), required=True)
    latitude = fields.Float(required=True)
    longitude = fields.Float(required=True)
    isInterchange = fields.Boolean(required=True)
    facilities = fields.List(fields.String(), load_default=[])
    accessibilityStatus = fields.String(load_default="unknown")


class StationDetailSchema(StationSchema):
    """Extended station schema with exits and disruptions."""

    exits = fields.List(fields.Dict(), load_default=[])
    disruptions = fields.List(fields.Dict(), load_default=[])


class StationArrivalSchema(Schema):
    """Schema for a single station arrival entry."""

    line = fields.String(required=True)
    direction = fields.String(required=True)
    nextTrain = fields.String(required=True)
    subsequentTrain = fields.String(allow_none=True, load_default=None)


class StationArrivalsResponseSchema(Schema):
    """Schema for station arrivals response."""

    arrivals = fields.List(fields.Nested(StationArrivalSchema), required=True)
    source = fields.String(required=True)
    updatedAt = fields.DateTime(required=True)


class StationTimingSchema(Schema):
    """Schema for first/last train timing."""

    line = fields.String(required=True)
    direction = fields.String(required=True)
    dayType = fields.String(required=True)
    firstTrain = fields.String(required=True)
    lastTrain = fields.String(required=True)
    destination = fields.String(required=True)


class NearbyStationSchema(Schema):
    """Schema for a nearby station result."""

    id = fields.String(required=True)
    name = fields.String(required=True)
    distanceMetres = fields.Float(required=True)
    codes = fields.List(fields.String(), required=True)


class CrowdReadingSchema(Schema):
    """Schema for crowd level reading at a station."""

    level = fields.String(required=True)
    confidence = fields.Float(required=True)
    source = fields.String(required=True)
    observedAt = fields.DateTime(required=True)
    expiresAt = fields.DateTime(required=True)
