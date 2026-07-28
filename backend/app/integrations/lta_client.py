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
import re
from datetime import datetime, timedelta, timezone

import requests

logger = logging.getLogger(__name__)

_SGT = timezone(timedelta(hours=8))
_TIMEOUT_SECONDS = 10


class LTADataMallClient:
    """RailDataProvider implementation backed by LTA DataMall APIs."""

    def __init__(self) -> None:
        self._account_key: str = os.getenv("LTA_ACCOUNT_KEY", "")
        self._base_url: str = "https://datamall2.mytransport.sg/ltaodataservice"

    # ------------------------------------------------------------------
    # RailDataProvider protocol methods
    # ------------------------------------------------------------------

    def get_service_alerts(self) -> list[dict]:
        """Fetch current MRT/LRT service alerts from LTA DataMall.

        Each affected line is published as a separate cluster within a
        single response (API User Guide v6.8, section 2.11), so one
        normalised alert is returned per affected segment.

        Returns a normalised list of alert dicts.  Falls back to the
        mock adapter on connection failure or timeout.
        """
        try:
            data = self._get("/TrainServiceAlerts")
            return self._normalise_alert_payload(data)
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

    @classmethod
    def _normalise_alert_payload(cls, data: dict) -> list[dict]:
        """Convert a raw TrainServiceAlerts response into internal alerts.

        This is the ONLY place that knows the response envelope, so a
        correction there is confined to this method.  The documented
        shape (API User Guide v6.8, section 2.11) is::

            {"value": {"Status": 2,
                       "AffectedSegments": [ ... ],
                       "Message": [{"Content": ..., "CreatedDate": ...}]}}

        The field specification is documented, but Annex C's sample
        responses are images rather than text, so the exact nesting has
        not been verified against a live call.  A top-level payload
        (without the ``value`` wrapper) is therefore accepted too.

        Args:
            data: Decoded JSON body from the TrainServiceAlerts endpoint.

        Returns:
            One normalised alert per affected segment.  Empty when train
            service is normal, since LTA publishes no segments then.
        """
        body = data.get("value", data)
        if not isinstance(body, dict):
            logger.warning("Unexpected TrainServiceAlerts payload shape: %s", type(body))
            return []

        status = cls._coerce_status(body.get("Status"))
        message, created_at = cls._extract_message(body.get("Message"))
        segments = body.get("AffectedSegments") or []
        if not segments:
            return cls._normalise_message_only_alerts(status, body.get("Message"))

        return [
            cls._normalise_segment(segment, status, message, created_at)
            for segment in segments
            if isinstance(segment, dict)
        ]

    @staticmethod
    def _coerce_status(raw) -> int:
        """Normalise the Status field to 1 (normal) or 2 (disrupted).

        LTA documents Status as 1 for normal service or minor delays and
        2 for disrupted service or major delays.  Anything unparseable is
        treated as disrupted, because a segment was published at all.
        """
        try:
            status = int(raw)
        except (TypeError, ValueError):
            return 2
        return status if status in (1, 2) else 2

    @staticmethod
    def _extract_message(raw) -> tuple[str, str]:
        """Pull the advisory text and timestamp out of the Message field.

        Message carries ``Content`` and ``CreatedDate``.  LTA publishes
        it as a list (a new entry per advisory), so the most recent entry
        wins; a bare object is accepted as well.

        Returns:
            A ``(content, created_date)`` pair, blank when absent.
        """
        entries = LTADataMallClient._message_entries(raw)
        if not entries:
            return "", ""

        latest = max(entries, key=lambda m: str(m.get("CreatedDate", "")))
        return str(latest.get("Content", "")), str(latest.get("CreatedDate", ""))

    @staticmethod
    def _message_entries(raw) -> list[dict]:
        """Normalise the Message field to a list of message objects."""
        if isinstance(raw, dict):
            return [raw]
        if isinstance(raw, list):
            return [m for m in raw if isinstance(m, dict)]
        return []

    @classmethod
    def _normalise_message_only_alerts(cls, status: int, raw_messages) -> list[dict]:
        """Preserve official advisories that have no affected station segment.

        LTA can publish planned service adjustments in the Message field while
        leaving AffectedSegments empty.  Those are still useful network notices,
        so emit a minor line-level alert when a line code can be inferred from
        the advisory text.
        """
        alerts: list[dict] = []
        for entry in cls._message_entries(raw_messages):
            content = str(entry.get("Content", "")).strip()
            lta_line = cls._extract_line_from_message(content)
            if not content or not lta_line:
                continue
            alerts.append(
                {
                    "status": status,
                    "ltaLine": lta_line,
                    "direction": "",
                    "stationCodes": [],
                    "freePublicBusCodes": [],
                    "freeMrtShuttleCodes": [],
                    "mrtShuttleDirection": "",
                    "message": content,
                    "createdAt": str(entry.get("CreatedDate", "")),
                    "source": "lta_datamall",
                }
            )
        return alerts

    @staticmethod
    def _extract_line_from_message(content: str) -> str:
        """Infer an LTA line code from advisory text."""
        if not content:
            return ""

        known_lines = ("EWL", "NSL", "NEL", "CCL", "DTL", "TEL")
        match = re.match(r"^\s*\d{1,2}:?\d{2}(?:hrs)?\s*[-:]\s*([A-Z]{2,5})\b", content)
        if match and match.group(1).upper() in known_lines:
            return match.group(1).upper()

        for line in known_lines:
            if re.search(rf"\b{line}\b", content, flags=re.IGNORECASE):
                return line
        return ""

    @staticmethod
    def _normalise_segment(
        segment: dict, status: int, message: str, created_at: str
    ) -> dict:
        """Convert one AffectedSegments entry to the internal alert shape.

        Station codes are left unresolved here; mapping them to internal
        station IDs needs database access and happens in the alert
        service, keeping this adapter pure.
        """
        from app.integrations.lta_mapping import split_station_codes

        return {
            "status": status,
            "ltaLine": str(segment.get("Line", "")),
            "direction": str(segment.get("Direction", "")),
            "stationCodes": split_station_codes(segment.get("Stations", "")),
            "freePublicBusCodes": split_station_codes(segment.get("FreePublicBus", "")),
            "freeMrtShuttleCodes": split_station_codes(segment.get("FreeMRTShuttle", "")),
            "mrtShuttleDirection": str(segment.get("MRTShuttleDirection", "")),
            "message": message,
            "createdAt": created_at,
            "source": "lta_datamall",
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
