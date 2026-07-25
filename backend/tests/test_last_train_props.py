"""Property-based tests for last-train validation correctness.

**Validates: Requirements 14.1, 14.2, 14.3, 14.6**

Property 9: Last-Train Validation Correctness
- departure after last train → LAST_TRAIN_DEPARTED warning
- departure before first train → SERVICE_NOT_STARTED warning
- timings vary by station/direction/line/day — no single value
- normal operating hours → no warnings
"""

import sys
import os

# Add backend to path so route_engine can be imported directly
sys.path.insert(
    0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
)

from datetime import datetime, time

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from app.services.route_engine import (
    validate_last_train,
    get_day_type,
    _get_timings_data,
    _find_timing,
    GraphNode,
)


# ---------------------------------------------------------------------------
# Fixtures and helpers
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def timings_data():
    """Load timings data once for all tests in this module."""
    return _get_timings_data()


def _simple_ns_route() -> list[GraphNode]:
    """A simple 2-station route on the NS line (Jurong East → Bukit Batok direction A)."""
    return [("jurong-east", "NS"), ("bukit-batok", "NS")]


# ---------------------------------------------------------------------------
# Test 1: Departure after last train → LAST_TRAIN_DEPARTED warning
# **Validates: Requirements 14.3**
# ---------------------------------------------------------------------------

def test_departure_after_last_train_produces_warning():
    """Departing at 23:55 on a weekday from Jurong East NS direction A
    (last train 23:48) should produce a LAST_TRAIN_DEPARTED warning."""
    route_path = _simple_ns_route()
    # Weekday: Monday = 0
    departure = datetime(2026, 7, 13, 23, 55)  # Monday 23:55

    warnings = validate_last_train(route_path, departure)

    last_train_warnings = [w for w in warnings if w["type"] == "LAST_TRAIN_DEPARTED"]
    assert len(last_train_warnings) >= 1, (
        f"Expected LAST_TRAIN_DEPARTED warning at 23:55, got: {warnings}"
    )
    assert last_train_warnings[0]["station"] == "jurong-east"
    assert last_train_warnings[0]["line"] == "NS"


# ---------------------------------------------------------------------------
# Test 2: Departure before first train → SERVICE_NOT_STARTED warning
# **Validates: Requirements 14.2**
# ---------------------------------------------------------------------------

def test_departure_before_first_train_produces_warning():
    """Departing at 04:00 on a weekday from Jurong East NS direction A
    (first train 05:30) should produce a SERVICE_NOT_STARTED warning."""
    route_path = _simple_ns_route()
    departure = datetime(2026, 7, 13, 4, 0)  # Monday 04:00

    warnings = validate_last_train(route_path, departure)

    service_warnings = [w for w in warnings if w["type"] == "SERVICE_NOT_STARTED"]
    assert len(service_warnings) >= 1, (
        f"Expected SERVICE_NOT_STARTED warning at 04:00, got: {warnings}"
    )
    assert service_warnings[0]["station"] == "jurong-east"
    assert service_warnings[0]["line"] == "NS"


# ---------------------------------------------------------------------------
# Test 3: Normal operating hours → no warnings
# **Validates: Requirements 14.1**
# ---------------------------------------------------------------------------

def test_normal_hours_no_warnings():
    """Departing at 10:00 on a weekday (well within service hours)
    should produce no warnings."""
    route_path = _simple_ns_route()
    departure = datetime(2026, 7, 13, 10, 0)  # Monday 10:00

    warnings = validate_last_train(route_path, departure)

    assert warnings == [], (
        f"Expected no warnings at 10:00, got: {warnings}"
    )


# ---------------------------------------------------------------------------
# Test 4: Timings vary by station/direction/line/day — no single value
# **Validates: Requirements 14.6**
# ---------------------------------------------------------------------------

def test_timings_vary_by_station():
    """Jurong East NS direction A weekday last_train (23:48) differs from
    City Hall NS direction A weekday last_train (23:55)."""
    timings = _get_timings_data()

    je_timing = _find_timing(timings, "jurong-east", "NS", "A", "weekday")
    ch_timing = _find_timing(timings, "city-hall", "NS", "A", "weekday")

    assert je_timing is not None, "Jurong East NS A weekday timing not found"
    assert ch_timing is not None, "City Hall NS A weekday timing not found"
    assert je_timing["last_train"] != ch_timing["last_train"], (
        f"Last train times should differ: JE={je_timing['last_train']}, "
        f"CH={ch_timing['last_train']}"
    )


def test_timings_vary_by_day_type():
    """Jurong East NS direction A weekday first_train (05:30) differs from
    sunday_ph first_train (05:40)."""
    timings = _get_timings_data()

    weekday_timing = _find_timing(timings, "jurong-east", "NS", "A", "weekday")
    sunday_timing = _find_timing(timings, "jurong-east", "NS", "A", "sunday_ph")

    assert weekday_timing is not None
    assert sunday_timing is not None
    assert weekday_timing["first_train"] != sunday_timing["first_train"], (
        f"First train times should differ by day type: "
        f"weekday={weekday_timing['first_train']}, "
        f"sunday_ph={sunday_timing['first_train']}"
    )


def test_timings_vary_by_direction():
    """Jurong East NS direction A weekday last_train (23:48) differs from
    direction B weekday last_train (23:20)."""
    timings = _get_timings_data()

    dir_a = _find_timing(timings, "jurong-east", "NS", "A", "weekday")
    dir_b = _find_timing(timings, "jurong-east", "NS", "B", "weekday")

    assert dir_a is not None
    assert dir_b is not None
    assert dir_a["last_train"] != dir_b["last_train"], (
        f"Last train should differ by direction: A={dir_a['last_train']}, "
        f"B={dir_b['last_train']}"
    )


def test_timings_vary_by_line():
    """Jurong East NS direction A weekday last_train (23:48) differs from
    Jurong East EW direction A weekday last_train (23:44)."""
    timings = _get_timings_data()

    ns_timing = _find_timing(timings, "jurong-east", "NS", "A", "weekday")
    ew_timing = _find_timing(timings, "jurong-east", "EW", "A", "weekday")

    assert ns_timing is not None
    assert ew_timing is not None
    assert ns_timing["last_train"] != ew_timing["last_train"], (
        f"Last train should differ by line: NS={ns_timing['last_train']}, "
        f"EW={ew_timing['last_train']}"
    )


# ---------------------------------------------------------------------------
# Test 5: get_day_type correctness
# **Validates: Requirements 14.1**
# ---------------------------------------------------------------------------

def test_get_day_type_weekday():
    """Monday through Friday should return 'weekday'."""
    assert get_day_type(datetime(2026, 7, 13)) == "weekday"  # Monday
    assert get_day_type(datetime(2026, 7, 17)) == "weekday"  # Friday


def test_get_day_type_saturday():
    """Saturday should return 'saturday'."""
    assert get_day_type(datetime(2026, 7, 18)) == "saturday"


def test_get_day_type_sunday():
    """Sunday should return 'sunday_ph'."""
    assert get_day_type(datetime(2026, 7, 19)) == "sunday_ph"


# ---------------------------------------------------------------------------
# Test 6: Hypothesis — random weekday times between 05:30-23:00 → no warnings
# **Validates: Requirements 14.1, 14.2, 14.3**
# ---------------------------------------------------------------------------

@given(
    hour=st.integers(min_value=6, max_value=22),
    minute=st.integers(min_value=0, max_value=59),
    day_offset=st.integers(min_value=0, max_value=4),  # Mon-Fri offset from Monday
)
@settings(max_examples=100)
def test_no_warnings_during_normal_weekday_hours(hour, minute, day_offset):
    """For any weekday time between 06:00-22:59, departing from Jurong East
    on the NS line should produce no warnings (service runs 05:30-23:48)."""
    # 2026-07-13 is a Monday; offset 0-4 gives Mon-Fri
    departure = datetime(2026, 7, 13 + day_offset, hour, minute)

    route_path = _simple_ns_route()
    warnings = validate_last_train(route_path, departure)

    assert warnings == [], (
        f"Expected no warnings at {departure.strftime('%H:%M')} on "
        f"{departure.strftime('%A')}, got: {warnings}"
    )


@given(
    minute=st.integers(min_value=49, max_value=59),
)
@settings(max_examples=20)
def test_after_last_train_always_warns(minute):
    """For any weekday departure at 23:49-23:59 from Jurong East NS direction A
    (last train 23:48), LAST_TRAIN_DEPARTED should always appear."""
    departure = datetime(2026, 7, 13, 23, minute)  # Monday

    route_path = _simple_ns_route()
    warnings = validate_last_train(route_path, departure)

    warning_types = [w["type"] for w in warnings]
    assert "LAST_TRAIN_DEPARTED" in warning_types, (
        f"Expected LAST_TRAIN_DEPARTED at 23:{minute:02d}, got: {warnings}"
    )


@given(
    hour=st.integers(min_value=0, max_value=4),
    minute=st.integers(min_value=0, max_value=59),
)
@settings(max_examples=50)
def test_before_first_train_always_warns(hour, minute):
    """For any weekday departure at 00:00-04:59 from Jurong East NS direction A
    (first train 05:30), SERVICE_NOT_STARTED should appear."""
    departure = datetime(2026, 7, 13, hour, minute)  # Monday

    route_path = _simple_ns_route()
    warnings = validate_last_train(route_path, departure)

    warning_types = [w["type"] for w in warnings]
    assert "SERVICE_NOT_STARTED" in warning_types, (
        f"Expected SERVICE_NOT_STARTED at {hour:02d}:{minute:02d}, got: {warnings}"
    )
