"""Service alert layer — train service disruptions from the rail provider.

Fetches alerts via the configured RailDataProvider (LTA DataMall when
live, the mock adapter otherwise), resolves LTA identifiers to internal
ones, and caches the result briefly.

LTA publishes alerts ad hoc, so every request hitting the upstream API
would be wasteful; a short TTL keeps the feed fresh without hammering it.
"""

from __future__ import annotations

import logging
import threading
import time

logger = logging.getLogger(__name__)

# Cached alert list plus the monotonic timestamp it was fetched at.
_cache: list[dict] | None = None
_cache_fetched_at: float = 0.0
_cache_lock = threading.Lock()


def _cache_ttl() -> int:
    """Return the configured cache TTL in seconds."""
    from app.config import BaseConfig

    return BaseConfig.ALERTS_CACHE_TTL_SECONDS


def clear_cache() -> None:
    """Drop the cached alerts. Used by tests and after config changes."""
    global _cache, _cache_fetched_at

    with _cache_lock:
        _cache = None
        _cache_fetched_at = 0.0


def get_active_alerts(force_refresh: bool = False) -> list[dict]:
    """Return current train service alerts, resolved to internal IDs.

    Args:
        force_refresh: Bypass the cache and fetch from the provider.

    Returns:
        A list of alert dicts.  Empty when service is running normally
        or the provider is unreachable — an alert feed that fails should
        degrade to "nothing to report", never to an error page.
    """
    global _cache, _cache_fetched_at

    with _cache_lock:
        fresh = _cache is not None and (time.monotonic() - _cache_fetched_at) < _cache_ttl()
        if fresh and not force_refresh:
            return list(_cache or [])

    alerts = _fetch_and_resolve()

    with _cache_lock:
        _cache = alerts
        _cache_fetched_at = time.monotonic()

    return list(alerts)


def get_alerts_for_station(station_id: str) -> list[dict]:
    """Return alerts affecting a single station.

    Args:
        station_id: Internal station ID, e.g. ``"dhoby-ghaut"``.

    Returns:
        Alerts whose affected stations include this one.
    """
    if not station_id:
        return []

    return [a for a in get_active_alerts() if station_id in a.get("stationIds", [])]


def get_station_disruption_messages(station_id: str) -> list[str]:
    """Return plain-text disruption messages for a station.

    The station detail payload carries disruptions as strings, so this
    flattens alerts down to their advisory text.

    Args:
        station_id: Internal station ID.

    Returns:
        Non-empty advisory messages, de-duplicated.
    """
    messages: list[str] = []
    for alert in get_alerts_for_station(station_id):
        message = (alert.get("message") or "").strip()
        if message and message not in messages:
            messages.append(message)
    return messages


def alerts_source() -> str:
    """Return the provenance label for the current alert feed.

    Returns:
        ``"lta_datamall"`` for live data, ``"simulated"`` for demo data,
        or ``"none"`` when there is nothing to attribute.
    """
    alerts = get_active_alerts()
    if not alerts:
        return "none"
    return alerts[0].get("source", "simulated")


def _fetch_and_resolve() -> list[dict]:
    """Fetch alerts from the provider and map LTA identifiers to internal ones."""
    from app.integrations import get_rail_data_provider

    try:
        raw_alerts = get_rail_data_provider().get_service_alerts()
    except Exception as exc:  # noqa: BLE001 - provider failure must not break callers
        logger.warning("Service alerts unavailable: %s", exc)
        return []

    resolved: list[dict] = []
    for raw in raw_alerts:
        alert = _resolve_alert(raw)
        if alert is not None:
            resolved.append(alert)
    return resolved


def _resolve_alert(raw: dict) -> dict | None:
    """Map one provider alert onto internal line and station IDs.

    Args:
        raw: Alert as returned by a RailDataProvider.

    Returns:
        The enriched alert, or None when the affected line is not part of
        the modelled network.
    """
    from app.integrations.lta_mapping import map_line_code, station_codes_to_ids

    lta_line = raw.get("ltaLine", "")
    line_code = map_line_code(lta_line)
    if line_code is None:
        return None

    station_codes = raw.get("stationCodes", [])

    return {
        "status": raw.get("status", 2),
        "severity": "major" if raw.get("status", 2) == 2 else "minor",
        "lineCode": line_code,
        "ltaLine": lta_line,
        "direction": raw.get("direction", ""),
        "stationIds": station_codes_to_ids(station_codes),
        "stationCodes": station_codes,
        "freePublicBusStationIds": station_codes_to_ids(raw.get("freePublicBusCodes", [])),
        "freeMrtShuttleStationIds": station_codes_to_ids(raw.get("freeMrtShuttleCodes", [])),
        "mrtShuttleDirection": raw.get("mrtShuttleDirection", ""),
        "message": raw.get("message", ""),
        "createdAt": raw.get("createdAt", ""),
        "source": raw.get("source", "simulated"),
    }
