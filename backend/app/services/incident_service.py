"""Incident service — create, list, get, interact, resolve, and report incidents.

Validates: Requirements 17.1, 18.1–18.5, 19.1–19.3
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.exc import IntegrityError
from flask import current_app
from werkzeug.datastructures import FileStorage

from app.extensions import db
from app.models.incident import Incident
from app.models.incident_interaction import IncidentInteraction
from app.models.user import User
from app.moderation.pipeline import ModerationPipeline, ModerationResult
from app.services.image_service import ImageService


ABUSE_REPORT_REMOVAL_THRESHOLD = 3
DISLIKE_REMOVAL_THRESHOLD = 5


def _ensure_incident_user(user_id: str) -> None:
    """Create a lightweight user row for anonymous community interactions."""
    if db.session.get(User, user_id) is not None:
        return

    user = User(
        id=user_id,
        display_name="Community Commuter",
        reliability_score=50,
        badge="regular",
    )
    db.session.add(user)
    db.session.flush()


def _parse_incident_time(value: Any) -> datetime:
    """Parse an incidentTime string (ISO 8601) into a datetime object.

    Handles trailing 'Z' which Python's fromisoformat doesn't support < 3.11.
    """
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        # Replace trailing Z with +00:00 for fromisoformat compatibility
        cleaned = value.replace("Z", "+00:00")
        return datetime.fromisoformat(cleaned)
    raise ValueError(f"Cannot parse incidentTime: {value!r}")


class _IncidentQueryProvider:
    """Query provider for the DuplicateChecker that queries the Incident table."""

    def find_recent_by_station_and_category(
        self,
        station_id: str,
        category: str,
        since: datetime,
    ) -> list[dict]:
        """Find incidents matching station+category since a given timestamp."""
        incidents = (
            Incident.query.filter(
                Incident.station_id == station_id,
                Incident.category == category,
                Incident.created_at >= since,
                Incident.moderation_status == "approved",
                Incident.status == "active",
            )
            .order_by(Incident.created_at.desc())
            .all()
        )
        return [
            {"id": inc.id, "title": inc.title, "created_at": inc.created_at}
            for inc in incidents
        ]


def create_incident(
    user_id: str, data: dict[str, Any], photo: FileStorage | None = None
) -> dict[str, Any]:
    """Create a new incident after running through the moderation pipeline.

    Args:
        user_id: ID of the submitting user.
        data: Validated incident data from the schema.
        photo: Optional uploaded incident photo.

    Returns:
        Dict with the created incident or moderation rejection info.

    Raises:
        ValueError: If moderation rejects the submission.
    """
    from app.moderation.duplicate_checker import DuplicateChecker

    # Prepare data for the moderation pipeline
    moderation_data = {
        "station_id": data["stationId"],
        "category": data["category"],
        "title": data["title"],
        "description": data["description"],
    }

    # Set up duplicate checker with real DB query provider
    query_provider = _IncidentQueryProvider()
    duplicate_checker = DuplicateChecker(query_provider=query_provider)

    pipeline = ModerationPipeline(duplicate_checker=duplicate_checker)
    outcome = pipeline.process(moderation_data)

    if outcome.result == ModerationResult.REJECTED:
        return {
            "error": "moderation_rejected",
            "reason": outcome.reason,
            "details": outcome.details,
        }

    _ensure_incident_user(user_id)

    photo_url = None
    if photo and photo.filename:
        try:
            image_service = ImageService(
                upload_folder=current_app.config["UPLOAD_FOLDER"],
                max_mb=current_app.config["UPLOAD_MAX_MB"],
            )
            filename = image_service.process_upload(
                photo.stream,
                photo.mimetype or "",
            )
            photo_url = f"/uploads/{filename}"
        except ValueError as exc:
            return {
                "error": "image_rejected",
                "reason": str(exc),
            }

    # Determine location — only include if locationConsent is True
    location_lat = None
    location_lng = None
    if data.get("locationConsent"):
        location_lat = data.get("latitude")
        location_lng = data.get("longitude")

    # Create the incident record
    incident_id = str(uuid.uuid4())
    moderation_status = (
        "approved"
        if outcome.result in (ModerationResult.APPROVED, ModerationResult.FLAGGED)
        else "pending"
    )

    incident = Incident(
        id=incident_id,
        user_id=user_id,
        station_id=data["stationId"],
        line_code=data.get("lineCode"),
        category=data["category"],
        title=outcome.sanitised_data.get("title", data["title"]),
        description=outcome.sanitised_data.get("description", data["description"]),
        photo_url=photo_url,
        incident_time=_parse_incident_time(data["incidentTime"]),
        status="active",
        moderation_status=moderation_status,
        is_anonymous=data.get("isAnonymous", False),
        location_lat=location_lat,
        location_lng=location_lng,
    )

    db.session.add(incident)
    db.session.commit()

    result = _incident_to_dict(incident)

    # Include duplicate warning if flagged
    if outcome.result == ModerationResult.FLAGGED:
        result["warning"] = outcome.reason
        result["warningDetails"] = outcome.details

    return result


def list_incidents(
    filters: Optional[dict[str, Any]] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    """List incidents with optional filters and pagination.

    Args:
        filters: Dict with optional keys: station, line, category, status.
        page: Page number (1-indexed).
        page_size: Number of results per page.

    Returns:
        Dict with incidents list, total count, page, and pageSize.
    """
    filters = filters or {}

    query = Incident.query.filter(Incident.moderation_status == "approved")

    if filters.get("station"):
        query = query.filter(Incident.station_id == filters["station"])
    if filters.get("line"):
        query = query.filter(Incident.line_code == filters["line"])
    if filters.get("category"):
        query = query.filter(Incident.category == filters["category"])
    if filters.get("status"):
        query = query.filter(Incident.status == filters["status"])

    query = query.order_by(Incident.created_at.desc())

    total = query.count()
    incidents = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "incidents": [_incident_to_dict(inc) for inc in incidents],
        "total": total,
        "page": page,
        "pageSize": page_size,
    }


def get_incident(incident_id: str) -> Optional[dict[str, Any]]:
    """Get a single incident by ID.

    Args:
        incident_id: The incident UUID.

    Returns:
        Incident dict or None if not found.
    """
    incident = Incident.query.get(incident_id)
    if incident is None:
        return None
    return _incident_to_dict(incident)


def add_interaction(
    incident_id: str, user_id: str, action: str
) -> dict[str, Any]:
    """Add or remove an interaction counter for an incident.

    Prototype count actions are intentionally repeatable so a tester can
    simulate multiple commuters from one browser. The rows are still kept as
    logs, while public visibility changes by status rather than deletion.

    Args:
        incident_id: The incident UUID.
        user_id: The user performing the action.
        action: One of: like, dislike, confirm, remove_*, resolve, report_abusive.

    Returns:
        Dict with success status or error info.
    """
    incident = Incident.query.get(incident_id)
    if incident is None:
        return {"error": "incident_not_found"}

    if action.startswith("remove_"):
        return _remove_interaction_count(incident, action)

    interaction_user_id = (
        f"{user_id}-{uuid.uuid4()}"
        if action in {"like", "dislike", "confirm", "report_abusive"}
        else user_id
    )
    _ensure_incident_user(interaction_user_id)

    interaction = IncidentInteraction(
        incident_id=incident_id,
        user_id=interaction_user_id,
        action=action,
    )

    try:
        db.session.add(interaction)
        db.session.flush()
    except IntegrityError:
        db.session.rollback()
        return {"error": "duplicate_action"}

    removed = False

    # Update incident counts based on action
    if action == "like":
        incident.like_count = (incident.like_count or 0) + 1
    elif action == "dislike":
        incident.dislike_count = (incident.dislike_count or 0) + 1
    elif action == "confirm":
        incident.confirm_count = (incident.confirm_count or 0) + 1
    elif action == "report_abusive":
        abuse_reports = IncidentInteraction.query.filter_by(
            incident_id=incident_id,
            action="report_abusive",
        ).count()
        if abuse_reports >= ABUSE_REPORT_REMOVAL_THRESHOLD:
            incident.status = "removed"
            incident.moderation_status = "flagged"
            removed = True

    if action == "dislike" and _should_be_removed(incident):
        incident.status = "removed"
        incident.moderation_status = "flagged"
        removed = True

    db.session.commit()
    return {
        "success": True,
        "status": incident.status,
        "moderationStatus": incident.moderation_status,
        "removed": removed,
    }


def _remove_interaction_count(incident: Incident, action: str) -> dict[str, Any]:
    """Remove one prototype counter row and decrement the cached count."""
    source_action = action.removeprefix("remove_")
    if source_action not in {"like", "dislike", "confirm", "report_abusive"}:
        return {"error": "invalid_action"}

    interaction = (
        IncidentInteraction.query.filter_by(
            incident_id=incident.id,
            action=source_action,
        )
        .order_by(IncidentInteraction.created_at.desc())
        .first()
    )
    if interaction is None:
        return {
            "success": True,
            "status": incident.status,
            "moderationStatus": incident.moderation_status,
            "removed": False,
        }

    db.session.delete(interaction)
    if source_action == "like":
        incident.like_count = max((incident.like_count or 0) - 1, 0)
    elif source_action == "dislike":
        incident.dislike_count = max((incident.dislike_count or 0) - 1, 0)
    elif source_action == "confirm":
        incident.confirm_count = max((incident.confirm_count or 0) - 1, 0)

    if incident.status == "removed" and not _should_be_removed(incident):
        incident.status = "active"
        incident.moderation_status = "approved"

    db.session.commit()
    return {
        "success": True,
        "status": incident.status,
        "moderationStatus": incident.moderation_status,
        "removed": incident.status == "removed",
    }


def resolve_incident(incident_id: str, user_id: str) -> dict[str, Any]:
    """Mark an incident as resolved.

    Args:
        incident_id: The incident UUID.
        user_id: The user resolving the incident.

    Returns:
        Dict with success status or error info.
    """
    incident = Incident.query.get(incident_id)
    if incident is None:
        return {"error": "incident_not_found"}
    _ensure_incident_user(user_id)

    incident.status = "resolved"

    # Also record the resolve interaction
    interaction = IncidentInteraction(
        incident_id=incident_id,
        user_id=user_id,
        action="resolve",
    )

    try:
        db.session.add(interaction)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        # Still mark as resolved even if user already resolved
        db.session.commit()

    return {"success": True, "status": "resolved"}


def report_incident(incident_id: str, user_id: str) -> dict[str, Any]:
    """Flag an incident for abuse review.

    Args:
        incident_id: The incident UUID.
        user_id: The user reporting the incident.

    Returns:
        Dict with success status or error info.
    """
    incident = Incident.query.get(incident_id)
    if incident is None:
        return {"error": "incident_not_found"}
    _ensure_incident_user(user_id)

    interaction = IncidentInteraction(
        incident_id=incident_id,
        user_id=user_id,
        action="report_abusive",
    )

    try:
        db.session.add(interaction)
        db.session.flush()
    except IntegrityError:
        db.session.rollback()
        return {"error": "duplicate_action"}

    abuse_reports = IncidentInteraction.query.filter_by(
        incident_id=incident_id,
        action="report_abusive",
    ).count()
    if abuse_reports >= ABUSE_REPORT_REMOVAL_THRESHOLD:
        incident.status = "removed"
        incident.moderation_status = "flagged"

    db.session.commit()
    return {"success": True, "status": incident.status}


def _incident_to_dict(incident: Incident) -> dict[str, Any]:
    """Convert an Incident model instance to a response dictionary.

    Respects the is_anonymous flag by hiding the user_id.
    """
    return {
        "id": incident.id,
        "userId": None if incident.is_anonymous else incident.user_id,
        "stationId": incident.station_id,
        "lineCode": incident.line_code,
        "category": incident.category,
        "title": incident.title,
        "description": incident.description,
        "photoUrl": incident.photo_url,
        "incidentTime": (
            incident.incident_time.isoformat() if incident.incident_time else None
        ),
        "createdAt": (
            incident.created_at.isoformat() if incident.created_at else None
        ),
        "status": incident.status,
        "moderationStatus": incident.moderation_status,
        "isAnonymous": incident.is_anonymous,
        "likeCount": incident.like_count or 0,
        "dislikeCount": incident.dislike_count or 0,
        "confirmCount": incident.confirm_count or 0,
        "trustState": _incident_trust_state(incident),
    }


def _incident_trust_state(incident: Incident) -> str:
    """Return lightweight feed status derived from community signals."""
    if incident.status == "removed":
        return "removed"
    if (incident.confirm_count or 0) >= 2:
        return "verified"
    if (incident.dislike_count or 0) >= 3 and (incident.confirm_count or 0) == 0:
        return "disputed"
    return "unverified"


def _should_be_removed(incident: Incident) -> bool:
    abuse_reports = IncidentInteraction.query.filter_by(
        incident_id=incident.id,
        action="report_abusive",
    ).count()
    return abuse_reports >= ABUSE_REPORT_REMOVAL_THRESHOLD or (
        (incident.dislike_count or 0) >= DISLIKE_REMOVAL_THRESHOLD
        and (incident.confirm_count or 0) == 0
    )
