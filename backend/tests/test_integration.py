"""Backend integration tests using Flask test client.

Tests the full HTTP request/response cycle for key API endpoints.
Uses the conftest.py fixtures (app, client, db) and seeds data as needed.

Validates: Requirements 38.5
"""

from datetime import datetime, timezone

import pytest

from app.models.station import Station
from app.models.user import User


def _seed_base_data(db):
    """Seed the database with a demo user and station for incident tests."""
    user = User(
        id="demo-user",
        display_name="Test User",
        reliability_score=50,
        badge="regular",
    )
    station = Station(
        id="orchard",
        name="Orchard",
        latitude=1.3043,
        longitude=103.8321,
        is_interchange=True,
        facilities=["lift", "escalator"],
        accessibility_status="full",
    )
    db.session.add_all([user, station])
    db.session.commit()


def _valid_incident_payload():
    """Return a valid incident creation payload."""
    return {
        "stationId": "orchard",
        "lineCode": "NS",
        "category": "train_delay",
        "title": "Train delay at Orchard",
        "description": "Trains delayed by approximately 10 minutes due to signal fault",
        "incidentTime": datetime.now(timezone.utc).isoformat(),
        "isAnonymous": False,
    }


# --- Incident endpoint integration tests ---


class TestIncidentCreationAndListing:
    """POST /incidents with valid data → 201, then GET /incidents shows it."""

    def test_create_and_list_incident(self, client, db):
        _seed_base_data(db)
        payload = _valid_incident_payload()

        # Create incident
        resp = client.post(
            "/api/v1/incidents",
            json=payload,
            headers={"X-User-Id": "demo-user"},
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert "id" in data
        assert data["stationId"] == "orchard"
        assert data["category"] == "train_delay"
        assert data["status"] == "active"

        # Verify it appears in the list
        list_resp = client.get("/api/v1/incidents")
        assert list_resp.status_code == 200
        list_data = list_resp.get_json()
        assert list_data["total"] >= 1
        ids = [inc["id"] for inc in list_data["incidents"]]
        assert data["id"] in ids


class TestIncidentInteractions:
    """POST /incidents/{id}/interactions for like and duplicate detection."""

    def test_like_interaction_success(self, client, db):
        """POST with 'like' action → 200 success."""
        _seed_base_data(db)
        payload = _valid_incident_payload()

        # Create an incident first
        create_resp = client.post(
            "/api/v1/incidents",
            json=payload,
            headers={"X-User-Id": "demo-user"},
        )
        assert create_resp.status_code == 201
        incident_id = create_resp.get_json()["id"]

        # Like it from a different user
        like_resp = client.post(
            f"/api/v1/incidents/{incident_id}/interactions",
            json={"action": "like"},
            headers={"X-User-Id": "other-user"},
        )
        assert like_resp.status_code == 200
        assert like_resp.get_json()["success"] is True

    def test_duplicate_interaction_returns_409(self, client, db):
        """POST same action twice → 409 duplicate_action."""
        _seed_base_data(db)
        payload = _valid_incident_payload()

        create_resp = client.post(
            "/api/v1/incidents",
            json=payload,
            headers={"X-User-Id": "demo-user"},
        )
        assert create_resp.status_code == 201
        incident_id = create_resp.get_json()["id"]

        # First like
        client.post(
            f"/api/v1/incidents/{incident_id}/interactions",
            json={"action": "like"},
            headers={"X-User-Id": "other-user"},
        )

        # Duplicate like → 409
        dup_resp = client.post(
            f"/api/v1/incidents/{incident_id}/interactions",
            json={"action": "like"},
            headers={"X-User-Id": "other-user"},
        )
        assert dup_resp.status_code == 409
        assert dup_resp.get_json()["error"] == "duplicate_action"


class TestIncidentModeration:
    """POST /incidents with profanity → 422 moderation_rejected."""

    def test_profanity_rejected(self, client, db):
        _seed_base_data(db)
        payload = _valid_incident_payload()
        payload["title"] = "This is a fuck situation"
        payload["description"] = "Something really shit is happening at the station right now"

        resp = client.post(
            "/api/v1/incidents",
            json=payload,
            headers={"X-User-Id": "demo-user"},
        )
        assert resp.status_code == 422
        data = resp.get_json()
        assert data["error"] == "moderation_rejected"


# --- AI Assistant integration tests ---


class TestAssistantChat:
    """POST /assistant/chat with various messages."""

    def test_hello_returns_out_of_scope(self, client, db):
        """'hello' message → 200 with OUT_OF_SCOPE intent."""
        resp = client.post(
            "/api/v1/assistant/chat",
            json={"message": "hello"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "reply" in data
        assert data["intent"] == "OUT_OF_SCOPE"

    def test_last_train_query(self, client, db):
        """'last train from orchard' → 200 with LAST_TRAIN intent."""
        resp = client.post(
            "/api/v1/assistant/chat",
            json={"message": "last train from orchard"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "reply" in data
        assert data["intent"] == "LAST_TRAIN"


# --- Route planning integration tests ---


class TestRoutePlanning:
    """POST /routes/plan with valid and invalid params."""

    def test_plan_route_valid(self, client, db):
        """POST with valid origin/dest → 200 with routes array."""
        payload = {
            "originStationId": "orchard",
            "destinationStationId": "dhoby-ghaut",
            "mode": "LEAVE_NOW",
            "preference": "FASTEST",
        }
        resp = client.post("/api/v1/routes/plan", json=payload)
        assert resp.status_code == 200
        data = resp.get_json()
        assert "routes" in data
        assert isinstance(data["routes"], list)
        assert len(data["routes"]) >= 1
        # Check route has expected structure
        route = data["routes"][0]
        assert "totalMinutes" in route
        assert "steps" in route
        assert "transfers" in route

    def test_plan_route_same_origin_dest_returns_422(self, client, db):
        """POST with same origin and destination → 422."""
        payload = {
            "originStationId": "orchard",
            "destinationStationId": "orchard",
            "mode": "LEAVE_NOW",
            "preference": "FASTEST",
        }
        resp = client.post("/api/v1/routes/plan", json=payload)
        assert resp.status_code == 422
        data = resp.get_json()
        assert "error" in data


# --- Station endpoint integration tests ---


class TestStationLookup:
    """GET /stations/{id} for existing and non-existing stations."""

    def test_get_station_orchard(self, client, db):
        """GET /stations/orchard → 200 with station data."""
        _seed_base_data(db)
        resp = client.get("/api/v1/stations/orchard")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == "orchard"
        assert data["name"] == "Orchard"

    def test_get_station_nonexistent_returns_404(self, client, db):
        """GET /stations/nonexistent → 404."""
        resp = client.get("/api/v1/stations/nonexistent")
        assert resp.status_code == 404
        data = resp.get_json()
        assert "error" in data
