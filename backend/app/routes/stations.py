"""Station-related API endpoints."""

from flask import Blueprint, jsonify, request

from app.services.station_service import (
    get_all_stations,
    get_nearby_stations,
    get_station_arrivals,
    get_station_crowd,
    get_station_detail,
    get_station_first_last_trains,
)

stations_bp = Blueprint("stations", __name__)


@stations_bp.route("/stations", methods=["GET"])
def list_stations():
    """Return all stations.

    Returns:
        JSON with a list of all stations.
    """
    stations = get_all_stations()
    return jsonify({"stations": stations})


@stations_bp.route("/stations/nearby", methods=["GET"])
def nearby_stations():
    """Return stations sorted by distance from given coordinates.

    Query params:
        lat: User latitude (required).
        lng: User longitude (required).
        limit: Maximum results (optional, default 3).

    Returns:
        JSON with sorted list of nearby stations.
    """
    lat = request.args.get("lat", type=float)
    lng = request.args.get("lng", type=float)
    limit = request.args.get("limit", default=3, type=int)

    if lat is None or lng is None:
        return jsonify({"error": "lat and lng query parameters are required"}), 400

    stations = get_nearby_stations(lat, lng, limit)
    return jsonify({"stations": stations})


@stations_bp.route("/stations/<station_id>", methods=["GET"])
def get_station(station_id: str):
    """Return full detail for a specific station.

    Args:
        station_id: The station identifier from the URL path.

    Returns:
        JSON with station detail or 404 error.
    """
    detail = get_station_detail(station_id)
    if detail is None:
        return jsonify({"error": "Station not found"}), 404
    return jsonify(detail)


@stations_bp.route("/stations/<station_id>/arrivals", methods=["GET"])
def station_arrivals(station_id: str):
    """Return arrival estimates for a station.

    Currently returns mock/demo data.

    Args:
        station_id: The station identifier from the URL path.

    Returns:
        JSON with arrivals, source label, and timestamp.
    """
    result = get_station_arrivals(station_id)
    if result is None:
        return jsonify({"error": "Station not found"}), 404
    return jsonify(result)


@stations_bp.route("/stations/<station_id>/first-last-trains", methods=["GET"])
def station_first_last_trains(station_id: str):
    """Return first and last train timings for a station.

    Args:
        station_id: The station identifier from the URL path.

    Returns:
        JSON with timings, source, and timestamp.
    """
    result = get_station_first_last_trains(station_id)
    if result is None:
        return jsonify({"error": "Station not found"}), 404
    return jsonify(result)


@stations_bp.route("/stations/<station_id>/crowd", methods=["GET"])
def station_crowd(station_id: str):
    """Return crowd level data for a station.

    Currently returns simulated/historical data.

    Args:
        station_id: The station identifier from the URL path.

    Returns:
        JSON with crowd level, confidence, source, and timestamps.
    """
    result = get_station_crowd(station_id)
    if result is None:
        return jsonify({"error": "Station not found"}), 404
    return jsonify(result)
