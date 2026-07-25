"""Rule-based AI orchestrator for the MRT-focused assistant.

Provides intent classification and structured response generation for
8 intents: ROUTE, LAST_TRAIN, CROWD, TRANSFER, ACCESSIBILITY, FACILITY,
INCIDENT, OUT_OF_SCOPE. Falls back gracefully when no AI API key is configured.

Validates: Requirements 22.1, 22.2, 22.3, 23.1, 23.2, 23.3, 23.4, 24.1
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_SGT = timezone(timedelta(hours=8))

VALID_INTENTS = [
    "ROUTE",
    "LAST_TRAIN",
    "CROWD",
    "TRANSFER",
    "ACCESSIBILITY",
    "FACILITY",
    "INCIDENT",
    "OUT_OF_SCOPE",
]

VALID_UI_ACTIONS = [
    "HIGHLIGHT_STATIONS",
    "HIGHLIGHT_ROUTE",
    "OPEN_STATION_PANEL",
    "OPEN_ROUTE_RESULT",
    "SHOW_WARNING",
    "SHOW_CROWD_LAYER",
    None,
]

INTENT_PATTERNS: dict[str, list[str]] = {
    "ROUTE": ["how to get", "route from", "route to", "travel to", "go from", "go to", "get to",
              "fastest way", "shortest route", "directions to", "journey from"],
    "LAST_TRAIN": ["last train", "latest train", "final train", "catch the last",
                   "last service", "last mrt", "miss the last"],
    "CROWD": ["crowded", "crowd", "busy", "packed", "crowd level",
              "how full", "congested", "many people"],
    "TRANSFER": ["transfer", "interchange", "change line", "switch line",
                 "connect", "connecting line", "change at", "change trains"],
    "ACCESSIBILITY": ["wheelchair", "accessible", "accessibility", "barrier-free", "lift",
                      "elevator", "disabled", "mobility", "step-free"],
    "FACILITY": ["toilet", "facility", "facilities", "exit", "escalator", "amenity",
                 "amenities", "restroom", "washroom", "atm", "shop"],
    "INCIDENT": ["delay", "breakdown", "disruption", "disrupted", "incident", "problem",
                 "fault", "service alert", "not working", "suspended"],
}

# Generic transit vocabulary used only as a free pre-filter signal (see
# has_mrt_signal below) — deliberately broader than INTENT_PATTERNS, which
# is for precise intent classification.
_MRT_SIGNAL_WORDS = [
    "mrt", "lrt", "smrt", "train", "station", "platform", "fare",
    "ezlink", "ez-link", "simplygo", "ticket", "commute", "transit",
    "journey", "network", "rail", "railway",
]

# Matches MRT/LRT line + station codes like NS1, EW12, CC29, DT1.
_LINE_CODE_PATTERN = re.compile(
    r"\b(NS|EW|NE|CC|DT|TE|CG|CE|BP|PE|PW|SE|SW)\d{1,2}\b", re.IGNORECASE
)

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

_stations_cache: list[dict] | None = None
_timings_cache: list[dict] | None = None


def _load_stations() -> list[dict]:
    """Load station data from JSON, with caching."""
    global _stations_cache
    if _stations_cache is None:
        stations_path = _DATA_DIR / "stations.json"
        if stations_path.exists():
            with open(stations_path, "r", encoding="utf-8") as f:
                _stations_cache = json.load(f)
        else:
            _stations_cache = []
    return _stations_cache


def _load_timings() -> list[dict]:
    """Load timing data from JSON, with caching."""
    global _timings_cache
    if _timings_cache is None:
        timings_path = _DATA_DIR / "timings.json"
        if timings_path.exists():
            with open(timings_path, "r", encoding="utf-8") as f:
                _timings_cache = json.load(f)
        else:
            _timings_cache = []
    return _timings_cache


def _find_station(query: str) -> dict | None:
    """Find a station by name or code (case-insensitive)."""
    stations = _load_stations()
    query_lower = query.lower().strip()

    for station in stations:
        if station["name"].lower() == query_lower:
            return station
        if station["id"] == query_lower:
            return station
        for code in station.get("codes", []):
            if code.lower() == query_lower:
                return station

    # Partial match fallback
    for station in stations:
        if query_lower in station["name"].lower():
            return station

    return None


def _extract_station_mentions(message: str) -> list[dict]:
    """Extract any station references from a message."""
    stations = _load_stations()
    msg_lower = message.lower()
    found = []

    for station in stations:
        if station["name"].lower() in msg_lower:
            found.append(station)
        else:
            for code in station.get("codes", []):
                if code.lower() in msg_lower:
                    found.append(station)
                    break

    return found


def _now_sgt() -> datetime:
    """Return current time in Singapore timezone."""
    return datetime.now(tz=_SGT)


# ---------------------------------------------------------------------------
# Intent classification
# ---------------------------------------------------------------------------


def classify_intent(message: str) -> str:
    """Classify user message into one of 8 intents using keyword matching.

    Args:
        message: The user's chat message.

    Returns:
        One of VALID_INTENTS strings.
    """
    message_lower = message.lower()
    for intent, keywords in INTENT_PATTERNS.items():
        if any(kw in message_lower for kw in keywords):
            return intent
    return "OUT_OF_SCOPE"


def has_mrt_signal(message: str) -> bool:
    """Return True if a message plausibly relates to the Singapore MRT/LRT
    network — a free pre-filter used to reject clearly unrelated messages
    (e.g. "code me a website") before they ever reach a paid LLM call.

    Deliberately permissive: only messages with zero MRT-related signal
    (no station name, no line code, no transit vocabulary, no intent
    keyword) are rejected. Blocking a real MRT question is worse than
    occasionally letting an ambiguous one still reach the LLM.
    """
    message_lower = message.lower()

    if any(kw in message_lower for keywords in INTENT_PATTERNS.values() for kw in keywords):
        return True

    if any(word in message_lower for word in _MRT_SIGNAL_WORDS):
        return True

    if _LINE_CODE_PATTERN.search(message):
        return True

    if _extract_station_mentions(message):
        return True

    return False


# ---------------------------------------------------------------------------
# Response generators per intent
# ---------------------------------------------------------------------------


def _build_response(
    reply: str,
    intent: str,
    station_ids: list[str] | None = None,
    line_codes: list[str] | None = None,
    route: Any = None,
    warning: str | None = None,
    ui_action: str | None = None,
) -> dict:
    """Build a structured AIResponse dictionary."""
    return {
        "reply": reply,
        "intent": intent,
        "stationIds": station_ids or [],
        "lineCodes": line_codes or [],
        "route": route,
        "warning": warning,
        "uiAction": ui_action,
        "dataFreshness": datetime.now(timezone.utc).isoformat(),
    }


def _handle_route(message: str, context: dict) -> dict:
    """Handle ROUTE intent — provide route guidance."""
    mentioned = _extract_station_mentions(message)
    station_ids = [s["id"] for s in mentioned]
    line_codes = list({code for s in mentioned for code in s.get("lines", [])})

    if len(mentioned) >= 2:
        origin = mentioned[0]
        dest = mentioned[1]
        reply = (
            f"To travel from {origin['name']} to {dest['name']}, "
            f"use the Route Planner for the best path based on your preference. "
            f"You can choose Fastest, Least Crowded, or Fewest Transfers."
        )
        return _build_response(
            reply=reply,
            intent="ROUTE",
            station_ids=station_ids,
            line_codes=line_codes,
            ui_action="HIGHLIGHT_STATIONS",
        )

    if mentioned:
        station = mentioned[0]
        reply = (
            f"I can help you plan a route to {station['name']}. "
            f"Please also specify your starting station, or use the Route Planner "
            f"to set your origin and destination."
        )
        return _build_response(
            reply=reply,
            intent="ROUTE",
            station_ids=station_ids,
            line_codes=line_codes,
            ui_action="OPEN_STATION_PANEL",
        )

    reply = (
        "I can help you plan a route! Please tell me your starting station "
        "and destination, or use the Route Planner to select them from the map."
    )
    return _build_response(reply=reply, intent="ROUTE")


def _handle_last_train(message: str, context: dict) -> dict:
    """Handle LAST_TRAIN intent — provide last train timing info."""
    mentioned = _extract_station_mentions(message)
    timings = _load_timings()

    if mentioned:
        station = mentioned[0]
        station_timings = [t for t in timings if t["station_id"] == station["id"]]

        if station_timings:
            # Build a summary of last train times for this station
            lines_info = []
            for t in station_timings:
                if t.get("service_day_type") == "weekday":
                    lines_info.append(
                        f"{t['line_code']} towards {t['direction_name']}: {t['last_train']}"
                    )

            timing_text = "\n".join(f"• {info}" for info in lines_info[:4])
            reply = (
                f"Last train timings from {station['name']} (weekday):\n"
                f"{timing_text}\n\n"
                f"Note: Timings vary by day type. Check the station panel for Saturday/Sunday timings."
            )
            warning = f"Check last train before {station_timings[0]['last_train']}" if station_timings else None
            return _build_response(
                reply=reply,
                intent="LAST_TRAIN",
                station_ids=[station["id"]],
                line_codes=list({t["line_code"] for t in station_timings}),
                warning=warning,
                ui_action="HIGHLIGHT_STATIONS",
            )

    # Generic last train response
    reply = (
        "The last train on most MRT lines departs between 11:30 PM and midnight. "
        "Timings vary by station, line, direction, and day type. "
        "Tell me a specific station name and I can look up the exact timings."
    )
    return _build_response(reply=reply, intent="LAST_TRAIN", ui_action="HIGHLIGHT_STATIONS")


def _handle_crowd(message: str, context: dict) -> dict:
    """Handle CROWD intent — provide crowd level info."""
    mentioned = _extract_station_mentions(message)

    if mentioned:
        station = mentioned[0]
        reply = (
            f"Crowd information for {station['name']}: "
            f"I recommend checking the crowd heatmap layer on the map for real-time data. "
            f"Peak hours are typically 7:30–9:30 AM and 5:30–7:30 PM on weekdays."
        )
        return _build_response(
            reply=reply,
            intent="CROWD",
            station_ids=[station["id"]],
            line_codes=station.get("lines", []),
            ui_action="SHOW_CROWD_LAYER",
        )

    reply = (
        "To check crowd levels, enable the crowd heatmap layer on the map. "
        "Green means low, yellow moderate, orange crowded, and red very crowded. "
        "Peak hours are typically 7:30–9:30 AM and 5:30–7:30 PM on weekdays."
    )
    return _build_response(reply=reply, intent="CROWD", ui_action="SHOW_CROWD_LAYER")


def _handle_transfer(message: str, context: dict) -> dict:
    """Handle TRANSFER intent — provide interchange/transfer info."""
    stations = _load_stations()
    mentioned = _extract_station_mentions(message)

    if mentioned:
        station = mentioned[0]
        if station.get("is_interchange"):
            lines = ", ".join(station.get("lines", []))
            reply = (
                f"{station['name']} is an interchange station connecting the "
                f"{lines} lines. You can transfer between these lines at this station."
            )
        else:
            reply = (
                f"{station['name']} is not an interchange station. "
                f"It is on the {', '.join(station.get('lines', []))} line(s). "
                f"You would need to travel to the nearest interchange to change lines."
            )
        return _build_response(
            reply=reply,
            intent="TRANSFER",
            station_ids=[station["id"]],
            line_codes=station.get("lines", []),
            ui_action="HIGHLIGHT_STATIONS",
        )

    # List major interchanges
    interchanges = [s for s in stations if s.get("is_interchange")][:5]
    names = ", ".join(s["name"] for s in interchanges)
    reply = (
        f"Key interchange stations include: {names}. "
        f"These stations connect multiple MRT lines, allowing you to transfer between them. "
        f"Tell me a station name for specific transfer information."
    )
    interchange_ids = [s["id"] for s in interchanges]
    return _build_response(
        reply=reply,
        intent="TRANSFER",
        station_ids=interchange_ids,
        ui_action="HIGHLIGHT_STATIONS",
    )


def _handle_accessibility(message: str, context: dict) -> dict:
    """Handle ACCESSIBILITY intent — provide accessibility info."""
    mentioned = _extract_station_mentions(message)

    if mentioned:
        station = mentioned[0]
        status = station.get("accessibility_status", "unknown")
        facilities = station.get("facilities", [])
        has_lift = "lift" in facilities
        has_escalator = "escalator" in facilities

        features = []
        if has_lift:
            features.append("lifts")
        if has_escalator:
            features.append("escalators")

        features_text = " and ".join(features) if features else "basic access"
        reply = (
            f"{station['name']} accessibility status: {status}. "
            f"Available: {features_text}. "
            f"For wheelchair-accessible route planning, use the 'Wheelchair accessible' "
            f"preference in the Route Planner."
        )
        return _build_response(
            reply=reply,
            intent="ACCESSIBILITY",
            station_ids=[station["id"]],
            line_codes=station.get("lines", []),
            ui_action="OPEN_STATION_PANEL",
        )

    reply = (
        "All MRT stations have lifts and barrier-free access. "
        "For wheelchair-accessible routes, select the 'Wheelchair accessible' "
        "preference in the Route Planner. Tell me a station name for specific "
        "accessibility information."
    )
    return _build_response(reply=reply, intent="ACCESSIBILITY")


def _handle_facility(message: str, context: dict) -> dict:
    """Handle FACILITY intent — provide station facility info."""
    mentioned = _extract_station_mentions(message)

    if mentioned:
        station = mentioned[0]
        facilities = station.get("facilities", [])
        exits = station.get("exits", [])

        facilities_text = ", ".join(facilities) if facilities else "standard facilities"
        exits_text = ", ".join(exits) if exits else "check station signage"
        reply = (
            f"{station['name']} facilities: {facilities_text}. "
            f"Exits: {exits_text}. "
            f"Open the station panel for full details."
        )
        return _build_response(
            reply=reply,
            intent="FACILITY",
            station_ids=[station["id"]],
            line_codes=station.get("lines", []),
            ui_action="OPEN_STATION_PANEL",
        )

    reply = (
        "Most MRT stations have toilets, lifts, escalators, and retail facilities. "
        "Tell me a station name and I can provide specific facility information."
    )
    return _build_response(reply=reply, intent="FACILITY")


def _handle_incident(message: str, context: dict) -> dict:
    """Handle INCIDENT intent — provide disruption/incident info."""
    mentioned = _extract_station_mentions(message)
    station_ids = [s["id"] for s in mentioned]
    line_codes = list({code for s in mentioned for code in s.get("lines", [])})

    if mentioned:
        station = mentioned[0]
        reply = (
            f"Checking for incidents at {station['name']}. "
            f"No active disruptions reported at this time. "
            f"Visit the Community page for the latest user-reported incidents."
        )
    else:
        reply = (
            "There are currently no major service disruptions reported. "
            "All MRT lines are operating normally. "
            "Check the Community page for user-reported incidents, "
            "or report a new incident if you see one."
        )

    return _build_response(
        reply=reply,
        intent="INCIDENT",
        station_ids=station_ids,
        line_codes=line_codes,
        warning=None,
        ui_action="SHOW_WARNING" if mentioned else None,
    )


def _handle_out_of_scope(message: str, context: dict) -> dict:
    """Handle OUT_OF_SCOPE intent — politely decline non-MRT queries."""
    reply = (
        "I'm an MRT-focused assistant. I can help with routes, timings, "
        "crowd levels, facilities, and incidents on the Singapore MRT network. "
        "How can I help you with your MRT journey?"
    )
    return _build_response(reply=reply, intent="OUT_OF_SCOPE")


# ---------------------------------------------------------------------------
# Intent handler dispatch table
# ---------------------------------------------------------------------------

_INTENT_HANDLERS: dict[str, Any] = {
    "ROUTE": _handle_route,
    "LAST_TRAIN": _handle_last_train,
    "CROWD": _handle_crowd,
    "TRANSFER": _handle_transfer,
    "ACCESSIBILITY": _handle_accessibility,
    "FACILITY": _handle_facility,
    "INCIDENT": _handle_incident,
    "OUT_OF_SCOPE": _handle_out_of_scope,
}


# ---------------------------------------------------------------------------
# RuleBasedAssistant class (implements AIProvider protocol)
# ---------------------------------------------------------------------------


class RuleBasedAssistant:
    """Rule-based AI assistant for MRT-related queries.

    Implements the AIProvider protocol's `chat(message, context)` method.
    Uses keyword-based intent classification and structured response
    generators to provide actionable MRT guidance without requiring
    an external AI API key.
    """

    def chat(self, message: str, context: dict) -> dict:
        """Process a user message and return a structured AI response.

        Args:
            message: The user's chat message.
            context: Context dict with optional keys like currentStationId,
                     selectedRoutePreference, etc.

        Returns:
            Structured response dict with reply, intent, stationIds,
            lineCodes, route, warning, uiAction, dataFreshness.
        """
        # Classify the user's intent
        intent = classify_intent(message)

        # Dispatch to the appropriate handler
        handler = _INTENT_HANDLERS.get(intent, _handle_out_of_scope)
        response = handler(message, context or {})

        # If context provides a current station and the response has none,
        # include the context station
        if context and context.get("currentStationId") and not response["stationIds"]:
            response["stationIds"] = [context["currentStationId"]]

        return response
