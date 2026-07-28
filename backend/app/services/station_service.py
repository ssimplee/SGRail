"""Station service — station lookup, nearby calculation, and data retrieval."""

from datetime import datetime, time, timedelta, timezone

from app.extensions import db
from app.models.station import Station
from app.models.station_line import StationLine
from app.models.train_timing import TrainTiming
from app.services import alert_service
from app.utils.haversine import haversine_distance

SGT = timezone(timedelta(hours=8))


def _service_day_type(now_sgt: datetime) -> str:
    """Return the service-day bucket used by train timing records."""
    if now_sgt.weekday() == 5:
        return "saturday"
    if now_sgt.weekday() == 6:
        return "sunday_ph"
    return "weekday"


def _headway_for_clock(now_sgt: datetime, line: str, direction: str) -> tuple[int, int, str]:
    """Estimate next/subsequent train waits from Singapore operating patterns.

    Public APIs do not expose MRT platform countdowns, so arrivals are inferred
    from time-of-day headways. Weekday commuter peaks use shorter waits; late
    night uses longer waits. The small deterministic offset avoids every line
    displaying the exact same first train minute.
    """
    current = now_sgt.time()
    is_weekday = now_sgt.weekday() < 5
    is_peak = is_weekday and (
        time(7, 0) <= current < time(9, 30)
        or time(17, 0) <= current < time(20, 0)
    )
    is_late_night = current >= time(22, 30) or current < time(5, 30)

    if is_peak:
        first, second, band = 2, 3, "Peak hours"
    elif is_late_night:
        first, second, band = 7, 10, "Late night"
    else:
        first, second, band = 5, 7, "Off-peak"

    offset = (sum(ord(ch) for ch in f"{line}:{direction}") % 2)
    return first + offset, second + offset, band


def _parse_hhmm(value: str | None) -> time | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%H:%M").time()
    except ValueError:
        return None


def _service_window(
    now_sgt: datetime,
    first_train: time | None,
    last_train: time | None,
) -> tuple[bool, datetime | None, datetime | None, datetime | None]:
    """Return operating status, current first/last window, and next first train."""
    if first_train is None or last_train is None:
        return True, None, None, None

    current_minutes = now_sgt.hour * 60 + now_sgt.minute
    first_minutes = first_train.hour * 60 + first_train.minute
    last_minutes = last_train.hour * 60 + last_train.minute
    crosses_midnight = last_minutes < first_minutes

    first_at = datetime.combine(now_sgt.date(), first_train, tzinfo=SGT)
    last_at = datetime.combine(now_sgt.date(), last_train, tzinfo=SGT)

    if crosses_midnight:
        operating = current_minutes >= first_minutes or current_minutes <= last_minutes
        if current_minutes >= first_minutes:
            last_at += timedelta(days=1)
        else:
            first_at -= timedelta(days=1)
    else:
        operating = first_minutes <= current_minutes <= last_minutes

    next_first_at = first_at if operating or now_sgt < first_at else first_at + timedelta(days=1)
    return operating, first_at, last_at, next_first_at


def _format_eta(minutes: int, when_sgt: datetime) -> str:
    clock = when_sgt.strftime("%I:%M %p").lstrip("0")
    return f"{minutes} min ({clock})"


def _format_clock(when_sgt: datetime) -> str:
    return when_sgt.strftime("%I:%M %p").lstrip("0")


def get_all_stations() -> list[dict]:
    """Return all stations with their line codes and station codes.

    Returns:
        List of station dictionaries with basic info.
    """
    stations = Station.query.all()
    result = []
    for station in stations:
        lines_data = StationLine.query.filter_by(station_id=station.id).all()
        codes = [sl.station_code for sl in lines_data]
        line_codes = list({sl.line_code for sl in lines_data})

        result.append(
            {
                "id": station.id,
                "name": station.name,
                "codes": codes,
                "lines": line_codes,
                "latitude": station.latitude,
                "longitude": station.longitude,
                "isInterchange": station.is_interchange or False,
                "facilities": station.facilities or [],
                "accessibilityStatus": station.accessibility_status or "unknown",
            }
        )
    return result


def get_station_detail(station_id: str) -> dict | None:
    """Return full station detail including exits and disruptions.

    Args:
        station_id: The station identifier.

    Returns:
        Station detail dictionary or None if not found.
    """
    station = Station.query.get(station_id)
    if station is None:
        return None

    lines_data = StationLine.query.filter_by(station_id=station.id).all()
    codes = [sl.station_code for sl in lines_data]
    line_codes = list({sl.line_code for sl in lines_data})

    return {
        "id": station.id,
        "name": station.name,
        "codes": codes,
        "lines": line_codes,
        "latitude": station.latitude,
        "longitude": station.longitude,
        "isInterchange": station.is_interchange or False,
        "facilities": station.facilities or [],
        "accessibilityStatus": station.accessibility_status or "unknown",
        "exits": station.exits or [],
        "disruptions": alert_service.get_station_disruption_messages(station.id),
    }


def get_station_arrivals(station_id: str) -> dict | None:
    """Return estimated arrival data for a station.

    Singapore does not expose public live MRT arrival countdowns. Estimates use
    the live Singapore clock, first/last train constraints, and time-of-day
    headway bands: peak 2-3 min, off-peak 5-7 min, late night 7-10 min.

    Args:
        station_id: The station identifier.

    Returns:
        Arrivals response dictionary or None if station not found.
    """
    station = Station.query.get(station_id)
    if station is None:
        return None

    lines_data = StationLine.query.filter_by(station_id=station.id).all()
    now_sgt = datetime.now(SGT)
    service_day = _service_day_type(now_sgt)

    arrivals = []
    for sl in lines_data:
        for direction_code, direction_name in (("A", sl.direction_a), ("B", sl.direction_b)):
            if not direction_name:
                continue

            timing = TrainTiming.query.filter_by(
                station_line_id=sl.id,
                direction=direction_code,
                service_day_type=service_day,
            ).first()
            if timing is None and service_day != "weekday":
                timing = TrainTiming.query.filter_by(
                    station_line_id=sl.id,
                    direction=direction_code,
                    service_day_type="weekday",
                ).first()

            next_wait, subsequent_wait, headway_band = _headway_for_clock(
                now_sgt, sl.line_code, direction_name
            )
            first_train = _parse_hhmm(
                timing.first_train.strftime("%H:%M")
                if timing and timing.first_train
                else None
            )
            last_train = _parse_hhmm(
                timing.last_train.strftime("%H:%M")
                if timing and timing.last_train
                else None
            )
            operating, first_train_at, last_train_at, next_first_train_at = _service_window(
                now_sgt,
                first_train,
                last_train,
            )

            next_train_at = now_sgt + timedelta(minutes=next_wait)
            subsequent_train_at = now_sgt + timedelta(minutes=subsequent_wait)

            if last_train_at and next_train_at > last_train_at:
                operating = False

            if not operating and next_first_train_at:
                next_train_at = next_first_train_at
                subsequent_train_at = None
                next_wait = max(
                    0,
                    round((next_first_train_at - now_sgt).total_seconds() / 60),
                )
                subsequent_wait = None

            arrivals.append(
                {
                    "line": sl.line_code,
                    "direction": direction_name,
                    "nextTrain": (
                        _format_eta(next_wait, next_train_at)
                        if operating
                        else f"First train {_format_clock(next_train_at)}"
                    ),
                    "subsequentTrain": (
                        _format_eta(subsequent_wait, subsequent_train_at)
                        if operating and subsequent_wait is not None and subsequent_train_at
                        else ""
                    ),
                    "nextTrainMinutes": next_wait,
                    "subsequentTrainMinutes": subsequent_wait if operating else None,
                    "nextTrainAt": next_train_at.isoformat(),
                    "subsequentTrainAt": (
                        subsequent_train_at.isoformat()
                        if operating and subsequent_train_at
                        else None
                    ),
                    "firstTrain": first_train.strftime("%H:%M") if first_train else None,
                    "firstTrainAt": (
                        next_first_train_at.isoformat()
                        if not operating and next_first_train_at
                        else first_train_at.isoformat()
                        if first_train_at
                        else None
                    ),
                    "firstTrainLabel": (
                        _format_clock(next_first_train_at)
                        if not operating and next_first_train_at
                        else _format_clock(first_train_at)
                        if first_train_at
                        else None
                    ),
                    "serviceNotice": (
                        f"No train service now. First train at {_format_clock(next_train_at)}."
                        if not operating
                        else None
                    ),
                    "headwayBand": headway_band,
                    "operating": operating,
                }
            )

    return {
        "arrivals": arrivals,
        "source": "estimated",
        "timezone": "Asia/Singapore",
        "updatedAt": now_sgt.isoformat(),
    }


def get_station_first_last_trains(station_id: str) -> dict | None:
    """Return first/last train timings for a station.

    Reads from the TrainTiming table joined through StationLine.

    Args:
        station_id: The station identifier.

    Returns:
        Timings response dictionary or None if station not found.
    """
    station = Station.query.get(station_id)
    if station is None:
        return None

    lines_data = StationLine.query.filter_by(station_id=station.id).all()

    timings = []
    for sl in lines_data:
        train_timings = TrainTiming.query.filter_by(station_line_id=sl.id).all()
        for tt in train_timings:
            # Determine direction name from the station line
            direction_name = sl.direction_a if tt.direction == "A" else sl.direction_b
            timings.append(
                {
                    "line": sl.line_code,
                    "direction": direction_name or tt.destination or "Unknown",
                    "dayType": tt.service_day_type,
                    "firstTrain": tt.first_train.strftime("%H:%M") if tt.first_train else None,
                    "lastTrain": tt.last_train.strftime("%H:%M") if tt.last_train else None,
                    "destination": tt.destination or direction_name or "Unknown",
                }
            )

    return {
        "timings": timings,
        "source": "official",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }


def get_station_crowd(station_id: str) -> dict | None:
    """Return crowd level data for a station.

    Attempts to use the configured crowd provider. On failure, falls back
    to mock data with source="simulated" and confidence=0.3.

    Args:
        station_id: The station identifier.

    Returns:
        Crowd reading dictionary or None if station not found.
    """
    station = Station.query.get(station_id)
    if station is None:
        return None

    from app.integrations import get_crowd_provider

    try:
        provider = get_crowd_provider()
        data = provider.get_station_crowd(station_id)
        # Ensure source and updatedAt are always present
        now = datetime.now(timezone.utc)
        data.setdefault("source", "historical")
        data.setdefault("updatedAt", now.isoformat())
        return data
    except Exception:
        # Fallback to simulated data on any provider failure
        from app.integrations.mock_adapter import MockCrowdProvider

        now = datetime.now(timezone.utc)
        fallback = MockCrowdProvider().get_station_crowd(station_id)
        fallback["source"] = "simulated"
        fallback["confidence"] = 0.3
        fallback["updatedAt"] = now.isoformat()
        return fallback


def get_nearby_stations(lat: float, lng: float, limit: int = 3) -> list[dict]:
    """Return the nearest stations sorted by Haversine distance.

    Args:
        lat: User latitude.
        lng: User longitude.
        limit: Maximum number of stations to return (default 3).

    Returns:
        List of nearby station dictionaries sorted by distance.
    """
    stations = Station.query.all()
    results = []

    for station in stations:
        if station.latitude is None or station.longitude is None:
            continue

        distance = haversine_distance(lat, lng, station.latitude, station.longitude)
        lines_data = StationLine.query.filter_by(station_id=station.id).all()
        codes = [sl.station_code for sl in lines_data]

        results.append(
            {
                "id": station.id,
                "name": station.name,
                "distanceMetres": round(distance, 1),
                "codes": codes,
            }
        )

    results.sort(key=lambda x: x["distanceMetres"])
    return results[:limit]
