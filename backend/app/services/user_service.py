"""User service — handles demo user, preferences, and saved routes."""

import uuid
from datetime import datetime

from app.extensions import db
from app.models.saved_route import SavedRoute
from app.models.user import User


def get_or_create_demo_user() -> User:
    """Get the demo user, creating one if it doesn't exist."""
    user = db.session.get(User, "demo-user")
    if user is None:
        user = User(
            id="demo-user",
            display_name="Demo Commuter",
            reliability_score=50,
            badge="regular",
            preferred_language="en",
            text_scale=1.0,
            high_contrast=False,
            colour_blind_labels=False,
            reduced_motion=False,
            created_at=datetime.utcnow(),
        )
        db.session.add(user)
        db.session.commit()
    return user


def update_preferences(user_id: str, preferences: dict) -> User:
    """Update user preferences. Only non-None values are applied."""
    user = db.session.get(User, user_id)
    if user is None:
        raise ValueError(f"User {user_id} not found")

    field_map = {
        "language": "preferred_language",
        "textScale": "text_scale",
        "highContrast": "high_contrast",
        "colourBlindLabels": "colour_blind_labels",
        "reducedMotion": "reduced_motion",
    }

    for key, column in field_map.items():
        value = preferences.get(key)
        if value is not None:
            setattr(user, column, value)

    db.session.commit()
    return user


def get_saved_routes(user_id: str) -> list[SavedRoute]:
    """Get all saved routes for a user, ordered by creation date descending."""
    return (
        SavedRoute.query.filter_by(user_id=user_id)
        .order_by(SavedRoute.created_at.desc())
        .all()
    )


def create_saved_route(user_id: str, data: dict) -> SavedRoute:
    """Create a new saved route for a user."""
    route = SavedRoute(
        id=str(uuid.uuid4()),
        user_id=user_id,
        origin_station_id=data["originStationId"],
        destination_station_id=data["destinationStationId"],
        preference=data["preference"],
        label=data.get("label"),
        created_at=datetime.utcnow(),
    )
    db.session.add(route)
    db.session.commit()
    return route


def delete_saved_route(user_id: str, route_id: str) -> bool:
    """Delete a saved route. Returns True if deleted, False if not found."""
    route = SavedRoute.query.filter_by(id=route_id, user_id=user_id).first()
    if route is None:
        return False
    db.session.delete(route)
    db.session.commit()
    return True
