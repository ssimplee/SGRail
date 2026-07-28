"""Backend integration tests using Flask test client.

Tests the full HTTP request/response cycle for key API endpoints.
Uses the conftest.py fixtures (app, client, db) and seeds data as needed.

Validates: Requirements 38.5
"""

import io
from datetime import datetime, timezone

import pytest
from PIL import Image

from app.models.incident import Incident
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


def _test_image_bytes() -> io.BytesIO:
    """Return a small valid JPEG upload body."""
    image = Image.new("RGB", (32, 32), "red")
    data = io.BytesIO()
    image.save(data, format="JPEG")
    data.seek(0)
    return data


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

    def test_create_incident_with_photo_persists_photo_url(self, client, db, app, tmp_path):
        """Multipart incident creation stores a processed image URL."""
        app.config["UPLOAD_FOLDER"] = str(tmp_path)
        _seed_base_data(db)
        payload = _valid_incident_payload()

        resp = client.post(
            "/api/v1/incidents",
            data={
                **payload,
                "isAnonymous": "false",
                "locationConsent": "false",
                "photo": (_test_image_bytes(), "incident.jpg"),
            },
            headers={"X-User-Id": "demo-user"},
            content_type="multipart/form-data",
        )

        assert resp.status_code == 201
        data = resp.get_json()
        assert data["photoUrl"].startswith("/uploads/")
        assert data["photoUrl"].endswith(".webp")
        assert (tmp_path / data["photoUrl"].removeprefix("/uploads/")).exists()


class TestIncidentInteractions:
    """POST /incidents/{id}/interactions for prototype community counters."""

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

    def test_repeated_like_simulates_multiple_commuters(self, client, db):
        """POST same count action twice increments twice for prototype demos."""
        _seed_base_data(db)
        payload = _valid_incident_payload()

        create_resp = client.post(
            "/api/v1/incidents",
            json=payload,
            headers={"X-User-Id": "demo-user"},
        )
        assert create_resp.status_code == 201
        incident_id = create_resp.get_json()["id"]

        first = client.post(
            f"/api/v1/incidents/{incident_id}/interactions",
            json={"action": "like"},
            headers={"X-User-Id": "other-user"},
        )
        assert first.status_code == 200

        second = client.post(
            f"/api/v1/incidents/{incident_id}/interactions",
            json={"action": "like"},
            headers={"X-User-Id": "other-user"},
        )
        assert second.status_code == 200

        incident = db.session.get(Incident, incident_id)
        assert incident.like_count == 2

    def test_remove_like_decrements_counter(self, client, db):
        """remove_like removes one prototype count."""
        _seed_base_data(db)
        create_resp = client.post(
            "/api/v1/incidents",
            json=_valid_incident_payload(),
            headers={"X-User-Id": "demo-user"},
        )
        incident_id = create_resp.get_json()["id"]

        for _ in range(2):
            client.post(
                f"/api/v1/incidents/{incident_id}/interactions",
                json={"action": "like"},
                headers={"X-User-Id": "other-user"},
            )

        resp = client.post(
            f"/api/v1/incidents/{incident_id}/interactions",
            json={"action": "remove_like"},
            headers={"X-User-Id": "other-user"},
        )
        assert resp.status_code == 200
        incident = db.session.get(Incident, incident_id)
        assert incident.like_count == 1

    def test_report_abuse_threshold_removes_from_public_feed(self, client, db):
        """Three unique abuse reports hide an incident without deleting it."""
        _seed_base_data(db)
        payload = _valid_incident_payload()
        create_resp = client.post(
            "/api/v1/incidents",
            json=payload,
            headers={"X-User-Id": "demo-user"},
        )
        incident_id = create_resp.get_json()["id"]

        for idx in range(3):
            resp = client.post(
                f"/api/v1/incidents/{incident_id}/interactions",
                json={"action": "report_abusive"},
                headers={"X-User-Id": f"reporter-{idx}"},
            )
            assert resp.status_code == 200

        incident = db.session.get(Incident, incident_id)
        assert incident is not None
        assert incident.status == "removed"
        assert incident.moderation_status == "flagged"

        list_resp = client.get("/api/v1/incidents?status=active")
        ids = [inc["id"] for inc in list_resp.get_json()["incidents"]]
        assert incident_id not in ids

    def test_dislike_threshold_removes_unconfirmed_report(self, client, db):
        """Five unique dislikes remove an unconfirmed likely-false report."""
        _seed_base_data(db)
        create_resp = client.post(
            "/api/v1/incidents",
            json=_valid_incident_payload(),
            headers={"X-User-Id": "demo-user"},
        )
        incident_id = create_resp.get_json()["id"]

        for idx in range(5):
            resp = client.post(
                f"/api/v1/incidents/{incident_id}/interactions",
                json={"action": "dislike"},
                headers={"X-User-Id": f"disliker-{idx}"},
            )
            assert resp.status_code == 200

        incident = db.session.get(Incident, incident_id)
        assert incident is not None
        assert incident.status == "removed"


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
        assert data["reason"] == "profanity_detected"


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

    def test_plan_route_includes_matching_service_alerts(self, client, db, monkeypatch):
        """Routes using a line with an active LTA notice surface that notice."""
        monkeypatch.setattr(
            "app.routes.routes._get_active_service_alerts",
            lambda: [
                {
                    "status": 1,
                    "severity": "minor",
                    "lineCode": "DT",
                    "ltaLine": "DTL",
                    "message": "23:30-DTL-Planned Service Adjustments.",
                    "createdAt": "2026-07-09 20:00:20",
                    "source": "lta_datamall",
                }
            ],
        )

        payload = {
            "originStationId": "bukit-panjang",
            "destinationStationId": "bugis",
            "mode": "LEAVE_NOW",
            "preference": "FASTEST",
        }
        resp = client.post("/api/v1/routes/plan", json=payload)

        assert resp.status_code == 200
        route = resp.get_json()["routes"][0]
        assert route["serviceAlerts"]
        assert route["serviceAlerts"][0]["source"] == "lta_datamall"
        assert route["serviceAlerts"][0]["lineCode"] == "DT"

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
