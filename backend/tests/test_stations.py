"""Unit tests for health and station API endpoints.

Validates: Requirements 38.5
"""

from datetime import datetime

import pytest

from app.models.station import Station
from app.models.station_line import StationLine


def _seed_stations(db):
    """Seed the database with test stations for endpoint testing."""
    # Station near Orchard area (lat 1.3043, lng 103.8318)
    orchard = Station(
        id="orchard",
        name="Orchard",
        latitude=1.3043,
        longitude=103.8321,
        is_interchange=False,
        facilities=["lift", "escalator"],
        accessibility_status="full",
        exits=[{"name": "A", "landmark": "ION Orchard"}],
    )
    # Station a bit further away
    somerset = Station(
        id="somerset",
        name="Somerset",
        latitude=1.3005,
        longitude=103.8388,
        is_interchange=False,
        facilities=["lift"],
        accessibility_status="full",
    )
    # Station further away
    dhoby_ghaut = Station(
        id="dhoby-ghaut",
        name="Dhoby Ghaut",
        latitude=1.2993,
        longitude=103.8458,
        is_interchange=True,
        facilities=["lift", "escalator", "wheelchair-ramp"],
        accessibility_status="full",
    )

    db.session.add_all([orchard, somerset, dhoby_ghaut])

    # Add station lines
    sl_orchard = StationLine(
        station_id="orchard",
        line_code="NS",
        station_code="NS22",
        sequence=22,
        direction_a="Jurong East",
        direction_b="Marina South Pier",
    )
    sl_somerset = StationLine(
        station_id="somerset",
        line_code="NS",
        station_code="NS23",
        sequence=23,
        direction_a="Jurong East",
        direction_b="Marina South Pier",
    )
    sl_dhoby_ns = StationLine(
        station_id="dhoby-ghaut",
        line_code="NS",
        station_code="NS24",
        sequence=24,
        direction_a="Jurong East",
        direction_b="Marina South Pier",
    )

    db.session.add_all([sl_orchard, sl_somerset, sl_dhoby_ns])
    db.session.commit()


# --- Health endpoint tests ---


class TestHealthEndpoint:
    """Tests for GET /api/v1/health."""

    def test_health_returns_200(self, client):
        """GET /api/v1/health returns 200 with correct structure."""
        response = client.get("/api/v1/health")

        assert response.status_code == 200
        data = response.get_json()
        assert "status" in data
        assert data["status"] == "ok"
        assert "timestamp" in data

    def test_health_has_valid_timestamp(self, client):
        """Health response timestamp is a valid ISO 8601 string."""
        response = client.get("/api/v1/health")
        data = response.get_json()

        timestamp = data["timestamp"]
        # Should parse without raising an exception
        parsed = datetime.fromisoformat(timestamp)
        assert parsed is not None


# --- Stations endpoint tests ---


class TestListStations:
    """Tests for GET /api/v1/stations."""

    def test_list_stations_returns_array(self, client, db):
        """GET /api/v1/stations returns 200 with a 'stations' key containing a list."""
        _seed_stations(db)

        response = client.get("/api/v1/stations")

        assert response.status_code == 200
        data = response.get_json()
        assert "stations" in data
        assert isinstance(data["stations"], list)
        assert len(data["stations"]) == 3


class TestGetStation:
    """Tests for GET /api/v1/stations/<station_id>."""

    def test_get_station_by_id(self, client, db):
        """GET /api/v1/stations/orchard returns 200 with station data."""
        _seed_stations(db)

        response = client.get("/api/v1/stations/orchard")

        assert response.status_code == 200
        data = response.get_json()
        assert data["id"] == "orchard"
        assert data["name"] == "Orchard"
        assert data["latitude"] == 1.3043
        assert data["longitude"] == 103.8321
        assert "codes" in data
        assert "NS22" in data["codes"]

    def test_get_station_unknown_returns_404(self, client, db):
        """GET /api/v1/stations/nonexistent returns 404."""
        _seed_stations(db)

        response = client.get("/api/v1/stations/nonexistent")

        assert response.status_code == 404
        data = response.get_json()
        assert "error" in data


class TestNearbyStations:
    """Tests for GET /api/v1/stations/nearby."""

    def test_nearby_stations_requires_params(self, client, db):
        """GET /api/v1/stations/nearby without lat/lng returns 400."""
        _seed_stations(db)

        response = client.get("/api/v1/stations/nearby")

        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data

    def test_nearby_stations_sorted_by_distance(self, client, db):
        """GET /api/v1/stations/nearby?lat=1.3043&lng=103.8318 returns results sorted by distance."""
        _seed_stations(db)

        response = client.get("/api/v1/stations/nearby?lat=1.3043&lng=103.8318")

        assert response.status_code == 200
        data = response.get_json()
        assert "stations" in data
        stations = data["stations"]
        assert len(stations) == 3

        # Verify sorted by distance (ascending)
        distances = [s["distanceMetres"] for s in stations]
        assert distances == sorted(distances)

        # The nearest station to (1.3043, 103.8318) should be Orchard
        assert stations[0]["id"] == "orchard"
