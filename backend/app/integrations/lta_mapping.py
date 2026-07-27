"""Identifier mapping between LTA DataMall and internal models.

LTA publishes line codes with an ``L`` suffix (``NEL``) and refers to
stations by platform code (``NE1``), while the app uses bare line codes
(``NE``) and slug station IDs (``harbourfront``).  This module bridges
the two.

Unknown identifiers are skipped rather than raising: LTA covers the full
network while the seeded dataset is a subset, so alerts routinely
reference lines and stations this app does not model.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


# LTA line code -> internal line code.  STL (Sengkang LRT) and PTL
# (Punggol LRT) have no internal equivalent and are intentionally absent.
LTA_LINE_TO_INTERNAL: dict[str, str] = {
    "EWL": "EW",
    "NSL": "NS",
    "NEL": "NE",
    "CCL": "CC",
    "DTL": "DT",
    "TEL": "TE",
    "BPL": "BP",
}


def map_line_code(lta_line: str) -> str | None:
    """Convert an LTA line code to the internal one.

    Args:
        lta_line: Line code as published by LTA, e.g. ``"NEL"``.

    Returns:
        The internal line code, or None if the line is not modelled.
    """
    if not lta_line:
        return None

    internal = LTA_LINE_TO_INTERNAL.get(lta_line.strip().upper())
    if internal is None:
        logger.debug("Ignoring alert for unmodelled LTA line %r", lta_line)
    return internal


def split_station_codes(raw: str) -> list[str]:
    """Split an LTA station code list into individual codes.

    LTA uses ``,`` between stations and — in the free-shuttle fields —
    ``|`` to denote an interchange and ``;`` to end a shuttle area.  All
    three are treated as separators so every code is surfaced.

    Args:
        raw: Raw field value, e.g. ``"NE1,NE3,NE4"``.

    Returns:
        Upper-cased station codes with blanks removed.
    """
    if not raw:
        return []

    codes: list[str] = []
    for chunk in raw.replace(";", ",").replace("|", ",").split(","):
        code = chunk.strip().upper()
        if code:
            codes.append(code)
    return codes


def station_codes_to_ids(codes: list[str]) -> list[str]:
    """Resolve LTA station codes to internal station IDs.

    Args:
        codes: Station codes such as ``["NE1", "NE3"]``.

    Returns:
        Internal station IDs, de-duplicated and order-preserving.  Codes
        with no seeded station are skipped.
    """
    if not codes:
        return []

    from app.models.station_line import StationLine

    rows = (
        StationLine.query.filter(StationLine.station_code.in_(codes))
        .with_entities(StationLine.station_code, StationLine.station_id)
        .all()
    )
    by_code = {code: station_id for code, station_id in rows}

    station_ids: list[str] = []
    for code in codes:
        station_id = by_code.get(code)
        if station_id is None:
            logger.debug("Ignoring alert for unseeded station code %r", code)
            continue
        if station_id not in station_ids:
            station_ids.append(station_id)
    return station_ids
