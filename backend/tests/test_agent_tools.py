"""Tests for the agentic assistant's tool functions.

Validates: AIPLAN.md, "Agentic tool-calling" (phase 10).
"""

from app.models.station import Station
from app.models.station_line import StationLine
from app.services import agent_tools


def _seed_bishan(db):
    """Seed a minimal Bishan row for DB-backed tools (crowd/facilities)."""
    db.session.add(
        Station(
            id="bishan",
            name="Bishan",
            latitude=1.3510,
            longitude=103.8486,
            is_interchange=True,
            facilities=["lift", "escalator", "toilet"],
            accessibility_status="full",
            exits=["A", "B", "C"],
        )
    )
    db.session.add_all(
        [
            StationLine(
                station_id="bishan", line_code="NS", station_code="NS17", sequence=17
            ),
            StationLine(
                station_id="bishan", line_code="CC", station_code="CC15", sequence=15
            ),
        ]
    )
    db.session.commit()


# ---------------------------------------------------------------------------
# resolve_station_id
# ---------------------------------------------------------------------------


class TestResolveStationId:
    def test_exact_name_match(self, app):
        with app.app_context():
            assert agent_tools.resolve_station_id("Bishan") == "bishan"

    def test_case_insensitive_and_fuzzy_match(self, app):
        with app.app_context():
            assert agent_tools.resolve_station_id("jurong east") == "jurong-east"

    def test_station_code_match(self, app):
        with app.app_context():
            assert agent_tools.resolve_station_id("NS17") == "bishan"

    def test_unknown_query_returns_none(self, app):
        with app.app_context():
            assert agent_tools.resolve_station_id("Not A Real Station") is None

    def test_empty_query_returns_none(self, app):
        with app.app_context():
            assert agent_tools.resolve_station_id("") is None
            assert agent_tools.resolve_station_id(None) is None


# ---------------------------------------------------------------------------
# plan_route
# ---------------------------------------------------------------------------


class TestPlanRoute:
    def test_returns_real_computed_route(self, app):
        with app.app_context():
            result = agent_tools.plan_route("Bishan", "Jurong East")

            assert result["error"] is None
            assert len(result["routes"]) > 0
            route = result["routes"][0]
            assert route["totalMinutes"] > 0
            assert len(route["steps"]) > 0
            assert route["steps"][0]["type"] == "board"

    def test_unknown_origin_returns_error(self, app):
        with app.app_context():
            result = agent_tools.plan_route("Not A Real Station", "Jurong East")

            assert result["routes"] == []
            assert "origin" in result["error"].lower() or "Not A Real Station" in result["error"]

    def test_same_origin_and_destination_returns_error(self, app):
        with app.app_context():
            result = agent_tools.plan_route("Bishan", "Bishan")

            assert result["routes"] == []
            assert result["error"] is not None

    def test_invalid_preference_falls_back_to_fastest(self, app):
        with app.app_context():
            result = agent_tools.plan_route(
                "Bishan", "Jurong East", preference="NOT_A_REAL_PREFERENCE"
            )

            assert result["error"] is None
            assert len(result["routes"]) > 0

    def test_wheelchair_preference_includes_accessibility_warnings_field(self, app):
        with app.app_context():
            result = agent_tools.plan_route(
                "Bishan", "Jurong East", preference="WHEELCHAIR"
            )

            assert result["error"] is None
            assert "accessibilityWarnings" in result["routes"][0]


# ---------------------------------------------------------------------------
# get_crowd_level
# ---------------------------------------------------------------------------


class TestGetCrowdLevel:
    def test_returns_valid_level_for_known_station(self, app, db):
        with app.app_context():
            result = agent_tools.get_crowd_level("Bishan")

            assert "error" not in result
            assert result["level"] in ("low", "moderate", "crowded", "very_crowded")
            assert "source" in result

    def test_unknown_station_returns_error(self, app):
        with app.app_context():
            result = agent_tools.get_crowd_level("Not A Real Station")

            assert "error" in result


# ---------------------------------------------------------------------------
# get_last_train
# ---------------------------------------------------------------------------


class TestGetLastTrain:
    def test_returns_timings_for_known_station(self, app):
        with app.app_context():
            result = agent_tools.get_last_train("Jurong East")

            assert result["error"] is None
            assert len(result["timings"]) > 0
            entry = result["timings"][0]
            assert entry["dayType"] == "weekday"
            assert entry["lastTrain"] is not None

    def test_respects_day_type(self, app):
        with app.app_context():
            weekday = agent_tools.get_last_train("Jurong East", day_type="weekday")
            saturday = agent_tools.get_last_train("Jurong East", day_type="saturday")

            assert all(t["dayType"] == "weekday" for t in weekday["timings"])
            assert all(t["dayType"] == "saturday" for t in saturday["timings"])

    def test_invalid_day_type_falls_back_to_weekday(self, app):
        with app.app_context():
            result = agent_tools.get_last_train("Jurong East", day_type="not_a_day")

            assert all(t["dayType"] == "weekday" for t in result["timings"])

    def test_unknown_station_returns_error(self, app):
        with app.app_context():
            result = agent_tools.get_last_train("Not A Real Station")

            assert result["error"] is not None
            assert result["timings"] == []


# ---------------------------------------------------------------------------
# get_incidents
# ---------------------------------------------------------------------------


class TestGetIncidents:
    def test_reports_source_provenance(self, app, db):
        with app.app_context():
            result = agent_tools.get_incidents()

            assert "officialAlertsSource" in result
            assert isinstance(result["officialAlerts"], list)
            assert isinstance(result["communityIncidents"], list)

    def test_filters_by_station(self, app, db):
        with app.app_context():
            result = agent_tools.get_incidents(station="Bishan")

            assert isinstance(result["officialAlerts"], list)
            assert isinstance(result["communityIncidentsTotal"], int)

    def test_filters_by_line(self, app, db):
        with app.app_context():
            result = agent_tools.get_incidents(line="NS")

            assert isinstance(result["officialAlerts"], list)


# ---------------------------------------------------------------------------
# get_station_facilities
# ---------------------------------------------------------------------------


class TestGetStationFacilities:
    def test_returns_facilities_for_seeded_station(self, app, db):
        _seed_bishan(db)
        with app.app_context():
            result = agent_tools.get_station_facilities("Bishan")

            assert result["id"] == "bishan"
            assert "lift" in result["facilities"]
            assert result["isInterchange"] is True

    def test_unresolvable_station_returns_error(self, app, db):
        with app.app_context():
            result = agent_tools.get_station_facilities("Not A Real Station")

            assert "error" in result

    def test_resolvable_but_unseeded_station_returns_not_found_error(self, app, db):
        # "Jurong East" resolves via the JSON station data, but the test DB
        # has no matching row — get_station_facilities is DB-backed, so this
        # should degrade to a clear error rather than crashing.
        with app.app_context():
            result = agent_tools.get_station_facilities("Jurong East")

            assert "error" in result
