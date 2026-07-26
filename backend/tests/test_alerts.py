"""Tests for LTA train service alerts.

Covers the DataMall response contract (API User Guide v6.8, section
2.11), identifier mapping, caching, and the /alerts endpoint.
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.integrations.lta_client import LTADataMallClient
from app.integrations.lta_mapping import (
    LTA_LINE_TO_INTERNAL,
    map_line_code,
    split_station_codes,
    station_codes_to_ids,
)
from app.integrations.mock_adapter import MockRailDataProvider
from app.models.station import Station
from app.models.station_line import StationLine
from app.services import alert_service


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _seed_ne_line(db):
    """Seed the North East Line stations referenced by the alert fixtures."""
    stations = [
        ("dhoby-ghaut", "NE6"),
        ("chinatown", "NE4"),
        ("outram-park", "NE3"),
        ("harbourfront", "NE1"),
    ]
    for index, (station_id, code) in enumerate(stations):
        db.session.add(
            Station(
                id=station_id,
                name=station_id.replace("-", " ").title(),
                latitude=1.3,
                longitude=103.8,
            )
        )
        db.session.add(
            StationLine(
                station_id=station_id,
                line_code="NE",
                station_code=code,
                sequence=index,
            )
        )
    db.session.commit()


@pytest.fixture(autouse=True)
def _clear_alert_cache():
    """Alerts are cached process-wide; reset between tests."""
    alert_service.clear_cache()
    yield
    alert_service.clear_cache()


# A documented TrainServiceAlerts payload (section 2.11 field spec).
DISRUPTED_PAYLOAD = {
    "value": {
        "Status": 2,
        "AffectedSegments": [
            {
                "Line": "NEL",
                "Direction": "HarbourFront",
                "Stations": "NE6,NE4,NE3,NE1",
                "FreePublicBus": "NE6,NE4,NE3,NE1",
                "FreeMRTShuttle": "NE6,NE1",
                "MRTShuttleDirection": "HarbourFront",
            }
        ],
        "Message": [
            {
                "Content": "1710hrs: NEL - No train service between ...",
                "CreatedDate": "2017-12-01 17:54:21",
            }
        ],
    }
}

NORMAL_PAYLOAD = {"value": {"Status": 1, "AffectedSegments": [], "Message": []}}


# ---------------------------------------------------------------------------
# Response contract
# ---------------------------------------------------------------------------


class TestAlertPayloadNormalisation:
    """LTADataMallClient parses the documented TrainServiceAlerts shape."""

    def test_disrupted_payload_yields_one_alert_per_segment(self):
        alerts = LTADataMallClient._normalise_alert_payload(DISRUPTED_PAYLOAD)

        assert len(alerts) == 1
        alert = alerts[0]
        assert alert["status"] == 2
        assert alert["ltaLine"] == "NEL"
        assert alert["direction"] == "HarbourFront"
        assert alert["stationCodes"] == ["NE6", "NE4", "NE3", "NE1"]
        assert alert["source"] == "lta_datamall"

    def test_message_content_and_date_come_from_message_field(self):
        """Content and CreatedDate live under Message, not AffectedSegments."""
        alert = LTADataMallClient._normalise_alert_payload(DISRUPTED_PAYLOAD)[0]

        assert alert["message"].startswith("1710hrs: NEL")
        assert alert["createdAt"] == "2017-12-01 17:54:21"

    def test_free_transport_fields_are_preserved(self):
        alert = LTADataMallClient._normalise_alert_payload(DISRUPTED_PAYLOAD)[0]

        assert alert["freePublicBusCodes"] == ["NE6", "NE4", "NE3", "NE1"]
        assert alert["freeMrtShuttleCodes"] == ["NE6", "NE1"]
        assert alert["mrtShuttleDirection"] == "HarbourFront"

    def test_normal_service_yields_no_alerts(self):
        assert LTADataMallClient._normalise_alert_payload(NORMAL_PAYLOAD) == []

    def test_payload_without_value_wrapper_is_accepted(self):
        """The envelope is unverified against a live call, so both shapes parse."""
        unwrapped = DISRUPTED_PAYLOAD["value"]

        assert len(LTADataMallClient._normalise_alert_payload(unwrapped)) == 1

    def test_latest_message_wins_when_several_are_published(self):
        payload = {
            "value": {
                "Status": 2,
                "AffectedSegments": [{"Line": "NEL", "Stations": "NE1"}],
                "Message": [
                    {"Content": "older", "CreatedDate": "2026-01-01 10:00:00"},
                    {"Content": "newer", "CreatedDate": "2026-01-01 11:00:00"},
                ],
            }
        }

        assert LTADataMallClient._normalise_alert_payload(payload)[0]["message"] == "newer"

    @pytest.mark.parametrize("garbage", [None, [], "unexpected", 42])
    def test_malformed_payloads_do_not_raise(self, garbage):
        assert LTADataMallClient._normalise_alert_payload({"value": garbage}) == []

    @given(status=st.integers(min_value=-100, max_value=100))
    @settings(max_examples=25)
    def test_status_is_always_1_or_2(self, status):
        """Any published segment is at minimum a minor delay."""
        payload = {
            "value": {
                "Status": status,
                "AffectedSegments": [{"Line": "NEL", "Stations": "NE1"}],
                "Message": [],
            }
        }

        assert LTADataMallClient._normalise_alert_payload(payload)[0]["status"] in (1, 2)


# ---------------------------------------------------------------------------
# Identifier mapping
# ---------------------------------------------------------------------------


class TestLineMapping:
    """LTA line codes map onto internal ones, unknown lines are dropped."""

    @pytest.mark.parametrize("lta,internal", sorted(LTA_LINE_TO_INTERNAL.items()))
    def test_documented_lines_map(self, lta, internal):
        assert map_line_code(lta) == internal

    @pytest.mark.parametrize("lta", ["STL", "PTL", "XYZ", ""])
    def test_unmodelled_lines_return_none(self, lta):
        assert map_line_code(lta) is None

    def test_mapping_is_case_insensitive(self):
        assert map_line_code("nel") == "NE"


class TestStationCodeSplitting:
    """LTA delimits station codes with ',', '|' and ';'."""

    def test_comma_separated_codes(self):
        assert split_station_codes("NE1,NE3,NE4") == ["NE1", "NE3", "NE4"]

    def test_shuttle_delimiters_are_also_split(self):
        assert split_station_codes("EW21|CC22,EW23;NS1") == [
            "EW21",
            "CC22",
            "EW23",
            "NS1",
        ]

    @pytest.mark.parametrize("raw", ["", None, " , , "])
    def test_blank_input_yields_no_codes(self, raw):
        assert split_station_codes(raw) == []


class TestStationCodeResolution:
    """Station codes resolve to internal IDs; unseeded codes are skipped."""

    def test_known_codes_resolve(self, db):
        _seed_ne_line(db)

        assert station_codes_to_ids(["NE6", "NE1"]) == ["dhoby-ghaut", "harbourfront"]

    def test_unseeded_codes_are_skipped_not_fatal(self, db):
        """LTA covers the whole network; this app seeds a subset."""
        _seed_ne_line(db)

        assert station_codes_to_ids(["NE6", "DT35", "TE20"]) == ["dhoby-ghaut"]

    def test_duplicate_codes_collapse(self, db):
        _seed_ne_line(db)

        assert station_codes_to_ids(["NE6", "NE6"]) == ["dhoby-ghaut"]


# ---------------------------------------------------------------------------
# Mock provider
# ---------------------------------------------------------------------------


class TestMockRailDataProvider:
    """Demo alerts match the shape the live client produces."""

    def test_mock_alerts_have_the_live_alert_keys(self):
        live_keys = set(LTADataMallClient._normalise_alert_payload(DISRUPTED_PAYLOAD)[0])

        for alert in MockRailDataProvider().get_service_alerts():
            assert set(alert) == live_keys

    def test_mock_alerts_are_labelled_as_demo_data(self):
        for alert in MockRailDataProvider().get_service_alerts():
            assert alert["source"] == "simulated"


# ---------------------------------------------------------------------------
# Service layer
# ---------------------------------------------------------------------------


class TestAlertService:
    """Alerts are resolved, filtered and cached."""

    def test_alerts_are_resolved_to_internal_identifiers(self, db):
        _seed_ne_line(db)

        alerts = alert_service.get_active_alerts()
        nel = next(a for a in alerts if a["ltaLine"] == "NEL")

        assert nel["lineCode"] == "NE"
        assert nel["severity"] == "major"
        assert "harbourfront" in nel["stationIds"]

    def test_station_filter_only_returns_affected_stations(self, db):
        _seed_ne_line(db)

        assert alert_service.get_alerts_for_station("harbourfront")
        assert alert_service.get_alerts_for_station("bishan") == []

    def test_station_messages_are_plain_strings(self, db):
        """Station detail carries disruptions as strings, not objects."""
        _seed_ne_line(db)

        messages = alert_service.get_station_disruption_messages("harbourfront")

        assert messages
        assert all(isinstance(m, str) for m in messages)

    def test_results_are_cached_between_calls(self, db, monkeypatch):
        _seed_ne_line(db)
        alert_service.get_active_alerts()

        calls = []

        def _explode():
            calls.append(1)
            raise AssertionError("provider should not be called while cached")

        monkeypatch.setattr(alert_service, "_fetch_and_resolve", _explode)
        alert_service.get_active_alerts()

        assert calls == []

    def test_provider_failure_degrades_to_no_alerts(self, db, monkeypatch):
        """A broken alert feed must not break the pages that read it."""
        def _boom():
            raise RuntimeError("upstream down")

        monkeypatch.setattr(
            "app.integrations.get_rail_data_provider",
            lambda: type("P", (), {"get_service_alerts": staticmethod(_boom)})(),
        )

        assert alert_service.get_active_alerts(force_refresh=True) == []


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


class TestAlertsEndpoint:
    """GET /api/v1/alerts."""

    def test_returns_alerts_with_provenance(self, client, db):
        _seed_ne_line(db)

        response = client.get("/api/v1/alerts")

        assert response.status_code == 200
        body = response.get_json()
        assert body["source"] == "simulated"
        assert body["alerts"]
        assert "retrievedAt" in body

    def test_account_key_is_never_exposed(self, client, db):
        _seed_ne_line(db)

        assert "accountkey" not in client.get("/api/v1/alerts").get_data(as_text=True).lower()

    def test_station_detail_includes_disruptions(self, client, db):
        _seed_ne_line(db)

        body = client.get("/api/v1/stations/harbourfront").get_json()

        assert body["disruptions"]
        assert all(isinstance(d, str) for d in body["disruptions"])
