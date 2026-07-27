"""Station service — station lookup, nearby calculation, and data retrieval."""

from datetime import datetime, timezone

from app.extensions import db
from app.models.station import Station
from app.models.station_line import StationLine
from app.models.train_timing import TrainTiming
from app.services import alert_service
from app.utils.haversine import haversine_distance


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
    """Return mock arrival data for a station.

    Since there's no live data source yet, returns demo arrivals.

    Args:
        station_id: The station identifier.

    Returns:
        Arrivals response dictionary or None if station not found.
    """
    station = Station.query.get(station_id)
    if station is None:
        return None

    lines_data = StationLine.query.filter_by(station_id=station.id).all()

    arrivals = []
    for sl in lines_data:
        # Generate mock arrivals for each line direction
        if sl.direction_a:
            arrivals.append(
                {
                    "line": sl.line_code,
                    "direction": sl.direction_a,
                    "nextTrain": "3 min",
                    "subsequentTrain": "6 min",
                }
            )
        if sl.direction_b:
            arrivals.append(
                {
                    "line": sl.line_code,
                    "direction": sl.direction_b,
                    "nextTrain": "4 min",
                    "subsequentTrain": "8 min",
                }
            )

    return {
        "arrivals": arrivals,
        "source": "demo",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
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
