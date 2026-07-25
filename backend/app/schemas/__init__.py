"""Marshmallow schemas for request/response validation."""

from app.schemas.station_schema import (
    StationSchema,
    StationDetailSchema,
    StationArrivalSchema,
    StationArrivalsResponseSchema,
    StationTimingSchema,
    NearbyStationSchema,
    CrowdReadingSchema,
)
from app.schemas.route_schema import (
    RoutePlanRequestSchema,
    RouteStepSchema,
    RouteResultSchema,
    RoutePlanResponseSchema,
)
from app.schemas.incident_schema import (
    IncidentCreateSchema,
    IncidentInteractionSchema,
    IncidentResponseSchema,
    IncidentListResponseSchema,
)
from app.schemas.user_schema import (
    UserProfileSchema,
    UserPreferencesUpdateSchema,
    SavedRouteSchema,
    SavedRouteCreateSchema,
)
from app.schemas.assistant_schema import (
    ChatRequestSchema,
    ChatResponseSchema,
)

__all__ = [
    # Station schemas
    "StationSchema",
    "StationDetailSchema",
    "StationArrivalSchema",
    "StationArrivalsResponseSchema",
    "StationTimingSchema",
    "NearbyStationSchema",
    "CrowdReadingSchema",
    # Route schemas
    "RoutePlanRequestSchema",
    "RouteStepSchema",
    "RouteResultSchema",
    "RoutePlanResponseSchema",
    # Incident schemas
    "IncidentCreateSchema",
    "IncidentInteractionSchema",
    "IncidentResponseSchema",
    "IncidentListResponseSchema",
    # User schemas
    "UserProfileSchema",
    "UserPreferencesUpdateSchema",
    "SavedRouteSchema",
    "SavedRouteCreateSchema",
    # Assistant schemas
    "ChatRequestSchema",
    "ChatResponseSchema",
]
