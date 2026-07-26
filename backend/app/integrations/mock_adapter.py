"""Mock adapter implementations for all provider interfaces.

Returns realistic demo data matching live response schemas so the app
can run fully without external API keys.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SGT = timezone(timedelta(hours=8))

_CROWD_LEVELS = ["low", "moderate", "crowded", "very_crowded"]


def _deterministic_crowd_level(station_id: str) -> str:
    """Pick a crowd level deterministically based on station_id hash."""
    idx = int(hashlib.md5(station_id.encode()).hexdigest(), 16) % len(_CROWD_LEVELS)
    return _CROWD_LEVELS[idx]


def _now_sgt() -> datetime:
    return datetime.now(tz=_SGT)


# ---------------------------------------------------------------------------
# Mock station reference data (subset used by multiple providers)
# ---------------------------------------------------------------------------

_MOCK_STATIONS = [
    {"id": "orchard", "name": "Orchard", "codes": ["NS22", "TE14"], "lines": ["NS", "TE"]},
    {"id": "city-hall", "name": "City Hall", "codes": ["NS25", "EW13"], "lines": ["NS", "EW"]},
    {"id": "raffles-place", "name": "Raffles Place", "codes": ["NS26", "EW14"], "lines": ["NS", "EW"]},
    {"id": "jurong-east", "name": "Jurong East", "codes": ["NS1", "EW24"], "lines": ["NS", "EW"]},
    {"id": "bishan", "name": "Bishan", "codes": ["NS17", "CC15"], "lines": ["NS", "CC"]},
    {"id": "dhoby-ghaut", "name": "Dhoby Ghaut", "codes": ["NS24", "NE6", "CC1"], "lines": ["NS", "NE", "CC"]},
    {"id": "marina-bay", "name": "Marina Bay", "codes": ["NS27", "CE2", "TE20"], "lines": ["NS", "CE", "TE"]},
    {"id": "bugis", "name": "Bugis", "codes": ["EW12", "DT14"], "lines": ["EW", "DT"]},
    {"id": "tampines", "name": "Tampines", "codes": ["EW2", "DT32"], "lines": ["EW", "DT"]},
    {"id": "serangoon", "name": "Serangoon", "codes": ["NE12", "CC13"], "lines": ["NE", "CC"]},
    {"id": "ang-mo-kio", "name": "Ang Mo Kio", "codes": ["NS16"], "lines": ["NS"]},
    {"id": "woodlands", "name": "Woodlands", "codes": ["NS9", "TE2"], "lines": ["NS", "TE"]},
    {"id": "harbourfront", "name": "HarbourFront", "codes": ["NE1", "CC29"], "lines": ["NE", "CC"]},
    {"id": "buona-vista", "name": "Buona Vista", "codes": ["EW21", "CC22"], "lines": ["EW", "CC"]},
    {"id": "paya-lebar", "name": "Paya Lebar", "codes": ["EW8", "CC9"], "lines": ["EW", "CC"]},
]

# Realistic Singapore locations for address search
_MOCK_LOCATIONS = [
    {
        "address": "1 Orchard Road, Singapore 238824",
        "latitude": 1.3043,
        "longitude": 103.8318,
        "postalCode": "238824",
        "buildingName": "ION Orchard",
    },
    {
        "address": "80 Marine Parade Road, Singapore 449269",
        "latitude": 1.3026,
        "longitude": 103.9056,
        "postalCode": "449269",
        "buildingName": "Parkway Parade",
    },
    {
        "address": "2 Jurong East Street 21, Singapore 609601",
        "latitude": 1.3329,
        "longitude": 103.7422,
        "postalCode": "609601",
        "buildingName": "IMM Building",
    },
    {
        "address": "23 Serangoon Central, Singapore 556083",
        "latitude": 1.3497,
        "longitude": 103.8735,
        "postalCode": "556083",
        "buildingName": "NEX",
    },
    {
        "address": "1 Harbourfront Walk, Singapore 098585",
        "latitude": 1.2654,
        "longitude": 103.8209,
        "postalCode": "098585",
        "buildingName": "VivoCity",
    },
]


# ---------------------------------------------------------------------------
# MockCrowdProvider
# ---------------------------------------------------------------------------


class MockCrowdProvider:
    """Returns deterministic crowd levels cycling through all states."""

    def get_station_crowd(self, station_id: str) -> dict:
        """Return crowd reading for a single station."""
        now = _now_sgt()
        return {
            "level": _deterministic_crowd_level(station_id),
            "confidence": 0.7,
            "source": "simulated",
            "observedAt": now.isoformat(),
            "expiresAt": (now + timedelta(minutes=15)).isoformat(),
        }

    def get_all_crowd(self) -> list[dict]:
        """Return crowd readings for all mock stations."""
        return [
            {
                "stationId": s["id"],
                **self.get_station_crowd(s["id"]),
            }
            for s in _MOCK_STATIONS
        ]


# ---------------------------------------------------------------------------
# MockLocationProvider
# ---------------------------------------------------------------------------


class MockLocationProvider:
    """Returns hardcoded Singapore locations and walking routes."""

    def search_address(self, query: str) -> list[dict]:
        """Filter mock locations by query (case-insensitive substring)."""
        q = query.lower()
        results = [
            loc for loc in _MOCK_LOCATIONS
            if q in loc["address"].lower() or q in loc["buildingName"].lower()
        ]
        # If nothing matches, return first 3 as fallback demo data
        if not results:
            results = _MOCK_LOCATIONS[:3]
        return results

    def reverse_geocode(self, lat: float, lng: float) -> dict | None:
        """Return the nearest mock location or a generic address."""
        # Simple: return a generic address for any coordinate
        return {
            "address": f"Near ({lat:.4f}, {lng:.4f}), Singapore",
            "latitude": lat,
            "longitude": lng,
            "postalCode": "000000",
            "buildingName": None,
        }

    def get_walking_route(self, origin: tuple, dest: tuple) -> dict:
        """Return a mock walking route with realistic duration."""
        # Approximate: 80m per minute walking speed
        from app.utils.haversine import haversine_distance

        distance_m = haversine_distance(origin[0], origin[1], dest[0], dest[1])
        walk_minutes = max(1, round(distance_m / 80))

        return {
            "distanceMetres": round(distance_m),
            "durationMinutes": walk_minutes,
            "instructions": [
                f"Walk {round(distance_m)}m to destination (approx. {walk_minutes} min)"
            ],
        }

    def get_nearby_transport(self, lat: float, lng: float) -> list[dict]:
        """Return nearest mock stations sorted by approximate distance."""
        from app.utils.haversine import haversine_distance

        # Use a fixed set of station coordinates
        station_coords = {
            "orchard": (1.3043, 103.8318),
            "city-hall": (1.2931, 103.8520),
            "raffles-place": (1.2830, 103.8513),
            "dhoby-ghaut": (1.2994, 103.8457),
            "bugis": (1.3009, 103.8558),
            "marina-bay": (1.2764, 103.8546),
            "bishan": (1.3513, 103.8491),
            "ang-mo-kio": (1.3700, 103.8495),
            "jurong-east": (1.3329, 103.7422),
            "tampines": (1.3545, 103.9453),
        }

        results = []
        for sid, (slat, slng) in station_coords.items():
            dist = haversine_distance(lat, lng, slat, slng)
            results.append({
                "id": sid,
                "name": sid.replace("-", " ").title(),
                "distanceMetres": round(dist),
                "type": "MRT",
            })

        results.sort(key=lambda x: x["distanceMetres"])
        return results[:5]


# ---------------------------------------------------------------------------
# MockRailDataProvider
# ---------------------------------------------------------------------------


class MockRailDataProvider:
    """Returns demo service alerts and basic station reference data."""

    def get_service_alerts(self) -> list[dict]:
        """Return demo service alerts matching the LTA alert schema.

        Mirrors the shape LTADataMallClient produces so downstream code
        cannot tell the two apart.  Station codes are drawn from the
        seeded network so they resolve to real station IDs.
        """
        created_at = _now_sgt().strftime("%Y-%m-%d %H:%M:%S")

        return [
            {
                "status": 2,
                "ltaLine": "NEL",
                "direction": "HarbourFront",
                "stationCodes": ["NE6", "NE4", "NE3", "NE1"],
                "freePublicBusCodes": ["NE6", "NE4", "NE3", "NE1"],
                "freeMrtShuttleCodes": ["NE6", "NE1"],
                "mrtShuttleDirection": "HarbourFront",
                "message": (
                    "No train service between Dhoby Ghaut and HarbourFront "
                    "stations towards HarbourFront due to a signalling fault. "
                    "Free bus rides are available at designated bus stops."
                ),
                "createdAt": created_at,
                "source": "simulated",
            },
            {
                "status": 1,
                "ltaLine": "EWL",
                "direction": "Both",
                "stationCodes": ["EW13", "EW14"],
                "freePublicBusCodes": [],
                "freeMrtShuttleCodes": [],
                "mrtShuttleDirection": "",
                "message": (
                    "Trains are moving slower than usual between City Hall "
                    "and Raffles Place. Please add 10 minutes to your journey."
                ),
                "createdAt": created_at,
                "source": "simulated",
            },
        ]

    def get_passenger_volume(self, station_id: str) -> dict | None:
        """Return basic passenger volume data."""
        # Return a simple volume estimate based on station
        volumes = {
            "orchard": 85000,
            "city-hall": 72000,
            "raffles-place": 95000,
            "jurong-east": 68000,
            "dhoby-ghaut": 55000,
            "bishan": 48000,
            "tampines": 62000,
            "ang-mo-kio": 45000,
            "woodlands": 38000,
            "harbourfront": 42000,
        }

        daily_volume = volumes.get(station_id, 30000)
        return {
            "stationId": station_id,
            "dailyVolume": daily_volume,
            "peakHourVolume": round(daily_volume * 0.15),
            "source": "simulated",
            "date": _now_sgt().strftime("%Y-%m-%d"),
        }

    def get_station_reference(self) -> list[dict]:
        """Return official-style station reference list."""
        return [
            {
                "stationId": s["id"],
                "stationName": s["name"],
                "stationCodes": s["codes"],
                "lineCodes": s["lines"],
            }
            for s in _MOCK_STATIONS
        ]


# ---------------------------------------------------------------------------
# MockAIProvider
# ---------------------------------------------------------------------------

_KEYWORD_RESPONSES = {
    "crowd": {
        "intent": "CROWD_INFO",
        "reply": (
            "Based on current data, most stations are experiencing moderate "
            "crowd levels. Peak hours are typically 7:30–9:30 AM and 5:30–7:30 PM."
        ),
        "uiAction": "SHOW_CROWD_LAYER",
    },
    "last train": {
        "intent": "LAST_TRAIN",
        "reply": (
            "The last train on most MRT lines departs between 11:30 PM and "
            "midnight. Check the station details for exact timings for your route."
        ),
        "uiAction": "HIGHLIGHT_STATIONS",
    },
    "delay": {
        "intent": "SERVICE_ALERT",
        "reply": (
            "There are currently no reported service disruptions. All MRT lines "
            "are running normally."
        ),
        "uiAction": None,
    },
    "route": {
        "intent": "ROUTE_QUERY",
        "reply": (
            "I can help you plan a route! Please select your origin and "
            "destination stations using the Route Planner, or tell me where "
            "you'd like to go."
        ),
        "uiAction": None,
    },
    "nearest": {
        "intent": "NEAREST_STATION",
        "reply": (
            "To find the nearest station, please enable location services. "
            "I'll then show you the closest MRT station with walking directions."
        ),
        "uiAction": None,
    },
    "transfer": {
        "intent": "TRANSFER_INFO",
        "reply": (
            "Interchange stations allow transfers between lines. Popular "
            "interchanges include Dhoby Ghaut (NS/NE/CC), City Hall (NS/EW), "
            "and Raffles Place (NS/EW)."
        ),
        "uiAction": "HIGHLIGHT_STATIONS",
    },
}

_DEFAULT_RESPONSE = {
    "intent": "GENERAL",
    "reply": (
        "I'm your MRT assistant! I can help with route planning, crowd levels, "
        "first/last train timings, service alerts, and station information. "
        "What would you like to know?"
    ),
    "uiAction": None,
}


class MockAIProvider:
    """Simple keyword-matching AI provider for demo purposes."""

    def chat(self, message: str, context: dict) -> dict:
        """Process message using keyword matching and return response."""
        msg_lower = message.lower()
        now = _now_sgt()

        # Find matching keyword response
        matched = _DEFAULT_RESPONSE
        for keyword, response in _KEYWORD_RESPONSES.items():
            if keyword in msg_lower:
                matched = response
                break

        # Extract station mentions from context
        station_ids = []
        line_codes = []
        if context and context.get("currentStationId"):
            station_ids.append(context["currentStationId"])

        return {
            "reply": matched["reply"],
            "intent": matched["intent"],
            "stationIds": station_ids,
            "lineCodes": line_codes,
            "route": None,
            "warning": None,
            "uiAction": matched["uiAction"],
            "dataFreshness": now.isoformat(),
        }
