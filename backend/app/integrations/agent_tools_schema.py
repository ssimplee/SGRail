"""Vendor-neutral tool definitions for the agentic AI assistant.

One list of tool schemas (name, description, JSON-schema parameters) is the
source of truth; `to_openai_tools()` translates it to the wire format shared
by OpenAI and Groq (Groq's endpoint is OpenAI-compatible). Gemini/Anthropic
translators would live here too if added later — see AIPLAN.md, "Agentic
tool-calling", for why they aren't implemented yet.

TOOL_DISPATCH maps a tool name to the backend/app/services/agent_tools.py
function that actually executes it.
"""

from __future__ import annotations

from typing import Any, Callable

from app.services import agent_tools

# ---------------------------------------------------------------------------
# Vendor-neutral tool definitions
# ---------------------------------------------------------------------------

TOOLS: list[dict[str, Any]] = [
    {
        "name": "plan_route",
        "description": (
            "Plan up to 3 route options between two MRT/LRT stations, with "
            "real computed travel time, transfers, fare estimate, step-by-step "
            "directions, and any last-train or accessibility warnings. Use this "
            "whenever the user asks how to get from one station to another."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "origin": {
                    "type": "string",
                    "description": "Origin station name or code, e.g. 'Bishan' or 'NS17'.",
                },
                "destination": {
                    "type": "string",
                    "description": "Destination station name or code.",
                },
                "preference": {
                    "type": "string",
                    "enum": [
                        "FASTEST",
                        "LEAST_CROWDED",
                        "FEWEST_TRANSFERS",
                        "LEAST_WALKING",
                        "WHEELCHAIR",
                        "LAST_TRAIN_SAFE",
                    ],
                    "description": "Route optimisation preference. Defaults to FASTEST.",
                },
                "avoid_stations": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Station names/codes to avoid, if the user asked to avoid any.",
                },
                "avoid_lines": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Line codes to avoid, if the user asked to avoid any (e.g. ['CC']).",
                },
                "departure_time": {
                    "type": "string",
                    "description": "ISO 8601 datetime to depart at. Omit for 'now'.",
                },
            },
            "required": ["origin", "destination"],
        },
    },
    {
        "name": "get_crowd_level",
        "description": "Get the current crowd level at an MRT/LRT station.",
        "parameters": {
            "type": "object",
            "properties": {
                "station": {
                    "type": "string",
                    "description": "Station name or code.",
                },
            },
            "required": ["station"],
        },
    },
    {
        "name": "get_last_train",
        "description": (
            "Get first/last train times for every line and direction serving "
            "a station, for a given day type."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "station": {
                    "type": "string",
                    "description": "Station name or code.",
                },
                "day_type": {
                    "type": "string",
                    "enum": ["weekday", "saturday", "sunday_ph"],
                    "description": "Which day's schedule to check. Defaults to weekday.",
                },
            },
            "required": ["station"],
        },
    },
    {
        "name": "get_incidents",
        "description": (
            "Get current official service alerts and community-reported "
            "incidents, optionally filtered by station and/or line. Use this "
            "for questions about delays, disruptions, breakdowns, or problems."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "station": {
                    "type": "string",
                    "description": "Station name or code to filter by. Omit for network-wide.",
                },
                "line": {
                    "type": "string",
                    "description": "Line code to filter by, e.g. 'NS'. Omit for all lines.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_station_facilities",
        "description": (
            "Get facilities, exits, wheelchair accessibility status, and any "
            "live disruptions for a specific station."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "station": {
                    "type": "string",
                    "description": "Station name or code.",
                },
            },
            "required": ["station"],
        },
    },
]


TOOL_DISPATCH: dict[str, Callable[..., dict]] = {
    "plan_route": agent_tools.plan_route,
    "get_crowd_level": agent_tools.get_crowd_level,
    "get_last_train": agent_tools.get_last_train,
    "get_incidents": agent_tools.get_incidents,
    "get_station_facilities": agent_tools.get_station_facilities,
}


def to_openai_tools(tools: list[dict[str, Any]] = TOOLS) -> list[dict[str, Any]]:
    """Translate the neutral tool list into OpenAI/Groq's `tools` wire format.

    Both vendors expect: [{"type": "function", "function": {name, description,
    parameters}}, ...] — identical shape, since Groq's endpoint is
    OpenAI-compatible.
    """
    return [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["parameters"],
            },
        }
        for tool in tools
    ]
