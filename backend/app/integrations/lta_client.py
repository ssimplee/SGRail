"""LTA DataMall API adapter.

Wraps the LTA DataMall OData endpoints for service alerts, passenger
volume, and station reference data.  Falls back to MockRailDataProvider
when the API is unreachable or LTA_ACCOUNT_KEY is not configured.

The account key is read from the environment and NEVER forwarded to
any frontend response.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

import requests

logger = logging.getLogger(__name__)

_SGT = timezone(timedelta(hours=8))
_TIMEOUT_SECONDS = 10


class LTADataMallClient:
    """RailDataProvider implementation backed by LTA DataMall APIs."""

    def __init__(self) -> None:
        self._account_key: str = os.getenv("LTA_ACCOUNT_KEY", "")
        self._base_url: str = "http://datamall2.mytransport.sg/ltaodataservice"

    # ------------------------------------------------------------------
    # RailDataProvider protocol methods
    # ------------------------------------------------------------------

    def get_service_alerts(self) -> list[dict]:
        """Fetch current MRT/LRT service alerts from LTA DataMall.

        Returns a normalised list of alert dicts.  Falls back to the
        mock adapter on connection failure or timeout.
        """
        try:
            data = self._get("/TrainServiceAlerts")
            raw_alerts = data.get("value", {}).get("AffectedSegments", [])
            return [self._normalise_alert(a) for a in raw_alerts]
        except (requests.ConnectionError, requests.Timeout, requests.RequestException) as exc:
            logger.warning("LTA service alerts unavailable, falling back to mock: %s", exc)
            return self._fallback().get_service_alerts()

    def get_passenger_volume(self, station_id: str) -> dict | None:
        """Fetch passenger volume data for a station.

        Requires a date parameter (today in SGT).  Falls back to mock
        on failure.
        """
        try:
            today = datetime.now(tz=_SGT).strftime("%Y-%m-%d")
            data = self._get("/PV/Train", params={"Date": today})
            records = data.get("value", [])
            # Filter for the requested station and normalise
            matched = [
                r for r in records
                if self._matches_station(r, station_id)
            ]
            if not matched:
                return None
            return self._normalise_passenger_volume(station_id, matched)
        except (requests.ConnectionError, requests.Timeout, requests.RequestException) as exc:
            logger.warning("LTA passenger volume unavailable, falling back to mock: %s", exc)
            return self._fallback().get_passenger_volume(station_id)

    def get_station_reference(self) -> list[dict]:
        """Return station reference data.

        LTA DataMall does not expose a dedicated station list endpoint,
        so we rely on the mock adapter's curated station reference for
        now.  This keeps the interface consistent and avoids making
        unnecessary API calls.
        """
        return self._fallback().get_station_reference()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get(self, endpoint: str, params: dict | None = None) -> dict:
        """Execute authenticated GET request against LTA DataMall."""
        url = f"{self._base_url}{endpoint}"
        headers = {
            "AccountKey": self._account_key,
            "accept": "application/json",
        }
        response = requests.get(
            url,
            headers=headers,
            params=params,
            timeout=_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()

    def _fallback(self):
        """Return a MockRailDataProvider instance for fallback."""
        from app.integrations.mock_adapter import MockRailDataProvider

        return MockRailDataProvider()

    # ------------------------------------------------------------------
    # Normalisation helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _normalise_alert(raw: dict) -> dict:
        """Convert LTA alert segment to internal ServiceAlert model."""
        return {
            "line": raw.get("Line", ""),
            "direction": raw.get("Direction", ""),
            "stations": raw.get("Stations", ""),
            "freeText": raw.get("FreeText", ""),
            "createdDate": raw.get("CreatedDate", ""),
        }

    @staticmethod
    def _matches_station(record: dict, station_id: str) -> bool:
        """Check if a PV record corresponds to the given station_id.

        LTA uses station codes (e.g. 'NS22') in their data while our
        internal model uses slug IDs (e.g. 'orchard').  We do a
        case-insensitive check against the station name field.
        """
        station_name = record.get("PT_CODE", "") or record.get("STATION", "")
        # Normalise: our station_id uses hyphens; LTA uses spaces/mixed case
        normalised_id = station_id.replace("-", " ").lower()
        return station_name.lower() == normalised_id

    @staticmethod
    def _normalise_passenger_volume(station_id: str, records: list[dict]) -> dict:
        """Aggregate passenger volume records into internal model."""
        total_tap_in = sum(int(r.get("TOTAL_TAP_IN_VOLUME", 0)) for r in records)
        total_tap_out = sum(int(r.get("TOTAL_TAP_OUT_VOLUME", 0)) for r in records)
        daily_volume = total_tap_in + total_tap_out

        return {
            "stationId": station_id,
            "dailyVolume": daily_volume,
            "peakHourVolume": round(daily_volume * 0.15),
            "source": "lta_datamall",
            "date": datetime.now(tz=_SGT).strftime("%Y-%m-%d"),
        }
