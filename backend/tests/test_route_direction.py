"""Regression tests for ride-direction ("towards X") labels.

Platform signs in the MRT name the terminus you are heading towards, so this
label is what tells a rider which side of the platform to stand on. Getting it
backwards sends them the wrong way.

EW, DT, TE and BP each had their two termini stored in the wrong order in
``LINE_TERMINI``, so every journey on those lines was labelled with the
terminus at the far end of the line. NS and NE were correct; CC is a loop and
uses "Clockwise Loop" / "Anticlockwise Loop" instead of code ordering.

**Validates: Requirements 11.1–11.4**
"""

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from app.services.route_engine import ROUTE_GRAPH, find_routes
from app.services.route_formatter import LINE_TERMINI, format_route_steps


# Lines whose direction labels are derived from station code ordering. CC is
# excluded because it is a closed loop with no termini.
CODE_ORDERED_LINES = [code for code in LINE_TERMINI if code != "CC"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _stations() -> list[dict]:
    path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "app", "data", "stations.json"
    )
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _termini_from_data(line_code: str) -> tuple[str, str]:
    """Return (highest-numbered, lowest-numbered) terminus names for a line.

    Derived from stations.json rather than hardcoded, so the invariant below
    keeps holding as stations are added.
    """
    numbered = []
    for station in _stations():
        for code in station.get("codes", []):
            if code.startswith(line_code):
                digits = "".join(filter(str.isdigit, code))
                if digits:
                    numbered.append((int(digits), station["name"]))
    assert numbered, f"no stations found on line {line_code}"
    return max(numbered)[1], min(numbered)[1]


def _directions(origin: str, destination: str) -> list[str]:
    """Plan a route and return the direction label of each ride segment."""
    routes = find_routes(ROUTE_GRAPH, origin, destination, "FASTEST")
    assert routes, f"no route found from {origin} to {destination}"
    steps = format_route_steps(routes[0][0])
    return [s["direction"] for s in steps if s.get("direction")]


# ---------------------------------------------------------------------------
# The table itself
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("line_code", CODE_ORDERED_LINES)
def test_termini_are_ordered_high_code_first(line_code):
    """LINE_TERMINI index 0 must be the higher-numbered terminus.

    ``_infer_direction`` returns index 0 when station numbers increase along
    the ride, so storing the low-numbered terminus there inverts the label.
    """
    expected = _termini_from_data(line_code)
    assert LINE_TERMINI[line_code] == expected, (
        f"{line_code} termini are in the wrong order: "
        f"got {LINE_TERMINI[line_code]}, expected {expected} "
        f"(index 0 must be the higher station code)"
    )


# ---------------------------------------------------------------------------
# End-to-end labels
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "origin,destination,expected",
    [
        # NS and NE were already correct — guard against a regression.
        ("bishan", "marina-south-pier", "Marina South Pier"),
        ("marina-south-pier", "bishan", "Jurong East"),
        # NE runs to Punggol Coast (NE18), not Punggol (NE17) — the label names
        # the end of the line, not the rider's destination.
        ("harbourfront", "punggol", "Punggol Coast"),
        ("punggol", "harbourfront", "HarbourFront"),
        # EW: Jurong East is EW24, Tampines EW2 — heading to the Pasir Ris end.
        ("jurong-east", "tampines", "Pasir Ris"),
        ("tampines", "jurong-east", "Tuas Link"),
        # DT: Bukit Panjang is DT1, Rochor DT13.
        ("bukit-panjang", "rochor", "Expo"),
        ("rochor", "bukit-panjang", "Bukit Panjang"),
        # TE: Woodlands North is TE1, Bayshore TE29.
        ("woodlands-north", "bayshore", "Bayshore"),
        ("bayshore", "woodlands-north", "Woodlands North"),
    ],
)
def test_single_line_journey_names_the_terminus_ahead(origin, destination, expected):
    """A direct journey is labelled with the terminus it is heading towards."""
    assert _directions(origin, destination) == [expected]


@pytest.mark.parametrize(
    "origin,destination",
    [
        ("bishan", "marina-south-pier"),
        ("harbourfront", "punggol"),
        ("jurong-east", "tampines"),
        ("bukit-panjang", "rochor"),
        ("woodlands-north", "bayshore"),
    ],
)
def test_reversing_a_journey_reverses_the_direction(origin, destination):
    """Travelling back the other way names the opposite terminus.

    This is the check that catches an inverted pair without needing to know
    which terminus is correct: a swapped table still yields two different
    labels, but both name the wrong end, so pair them with the assertions
    above.
    """
    there = _directions(origin, destination)
    back = _directions(destination, origin)
    assert there != back, f"{origin}<->{destination} labelled {there} both ways"
