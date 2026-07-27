"""Property tests for incident interactions.

**Property 17: Prototype Interaction Counters**
- Repeated count actions from one tester simulate multiple commuters

**Property 18: Duplicate Report Detection**
- Same station+category within time window → flagged as duplicate

**Validates: Requirements 19.2, 20.5**
"""

import sys
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

sys.path.insert(
    0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
)

from app import create_app
from app.extensions import db as _db
from app.models.user import User
from app.models.station import Station
from app.models.incident import Incident
from app.services.incident_service import add_interaction, create_incident
from app.moderation.duplicate_checker import DuplicateChecker
from app.moderation.pipeline import (
    ModerationPipeline,
    ModerationResult,
    VALID_CATEGORIES,
)


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

valid_actions = st.sampled_from(["like", "dislike", "confirm", "report_abusive"])
valid_categories = st.sampled_from(VALID_CATEGORIES)


# ---------------------------------------------------------------------------
# Helper: fresh DB context per hypothesis example
# ---------------------------------------------------------------------------

_app = create_app("testing")


def _fresh_db():
    """Context manager that provides a clean DB for each hypothesis example."""

    class _DBContext:
        def __enter__(self):
            self.ctx = _app.app_context()
            self.ctx.push()
            _db.create_all()
            return _db

        def __exit__(self, *args):
            _db.session.rollback()
            _db.drop_all()
            self.ctx.pop()

    return _DBContext()


def _create_user(db_session, user_id: str) -> User:
    """Create and persist a test user."""
    user = User(id=user_id, display_name=f"Test User {user_id}")
    db_session.session.add(user)
    db_session.session.commit()
    return user


def _create_station(db_session, station_id: str) -> Station:
    """Create and persist a test station."""
    station = Station(
        id=station_id,
        name=f"Station {station_id}",
        latitude=1.35,
        longitude=103.8,
    )
    db_session.session.add(station)
    db_session.session.commit()
    return station


def _create_incident(db_session, user_id: str, station_id: str, category: str = "train_delay") -> Incident:
    """Create and persist a test incident."""
    incident_id = str(uuid.uuid4())
    incident = Incident(
        id=incident_id,
        user_id=user_id,
        station_id=station_id,
        category=category,
        title="Test incident for interaction",
        description="A valid test incident description for testing interactions",
        incident_time=datetime.now(timezone.utc),
        status="active",
        moderation_status="approved",
    )
    db_session.session.add(incident)
    db_session.session.commit()
    return incident


# ---------------------------------------------------------------------------
# Property 17: Prototype Interaction Counters
# ---------------------------------------------------------------------------


class TestPrototypeInteractionCounters:
    """Property 17: Prototype Interaction Counters.

    Count actions are intentionally repeatable in the prototype so one tester
    can simulate multiple commuter votes from a single browser.

    **Validates: Requirements 19.2**
    """

    @given(action=valid_actions)
    @settings(max_examples=30)
    def test_first_interaction_succeeds(self, action: str):
        """First interaction from a user on an incident → success.

        **Validates: Requirements 19.2**
        """
        with _fresh_db() as db:
            user = _create_user(db, "user-first-1")
            station = _create_station(db, "NS1")
            incident = _create_incident(db, user.id, station.id)

            result = add_interaction(incident.id, user.id, action)

            assert "error" not in result, (
                f"Expected success for first '{action}' interaction, got error: {result}"
            )
            assert result.get("success") is True, (
                f"Expected success=True, got: {result}"
            )

    @given(action=valid_actions)
    @settings(max_examples=30)
    def test_repeated_interaction_succeeds(self, action: str):
        """Second identical count action succeeds for prototype simulation.

        **Validates: Requirements 19.2**
        """
        with _fresh_db() as db:
            user = _create_user(db, "user-dup-1")
            station = _create_station(db, "EW5")
            incident = _create_incident(db, user.id, station.id)

            # First interaction succeeds
            result1 = add_interaction(incident.id, user.id, action)
            assert result1.get("success") is True, (
                f"First interaction should succeed, got: {result1}"
            )

            # Second identical count action increments again.
            result2 = add_interaction(incident.id, user.id, action)
            assert result2.get("success") is True, (
                f"Expected repeat '{action}' to succeed for prototype counters, "
                f"got: {result2}"
            )

    @given(action=st.sampled_from(["like", "dislike", "confirm"]))
    @settings(max_examples=30)
    def test_remove_interaction_decrements_count(self, action: str):
        """remove_* action removes one prototype count."""
        with _fresh_db() as db:
            user = _create_user(db, "user-remove")
            station = _create_station(db, "CC4")
            incident = _create_incident(db, user.id, station.id)

            add_interaction(incident.id, user.id, action)
            add_interaction(incident.id, user.id, action)
            result = add_interaction(incident.id, user.id, f"remove_{action}")

            assert result.get("success") is True
            db.session.refresh(incident)
            count_attr = f"{action}_count"
            assert getattr(incident, count_attr) == 1

    @given(action1=valid_actions, action2=valid_actions)
    @settings(max_examples=30)
    def test_different_action_from_same_user_succeeds(self, action1: str, action2: str):
        """Different action from the same user on same incident → success (not a duplicate).

        **Validates: Requirements 19.2**
        """
        assume(action1 != action2)

        with _fresh_db() as db:
            user = _create_user(db, "user-diff-act")
            station = _create_station(db, "CC3")
            incident = _create_incident(db, user.id, station.id)

            # First action succeeds
            result1 = add_interaction(incident.id, user.id, action1)
            assert result1.get("success") is True, (
                f"First action '{action1}' should succeed, got: {result1}"
            )

            # Different action from same user → success
            result2 = add_interaction(incident.id, user.id, action2)
            assert result2.get("success") is True, (
                f"Different action '{action2}' from same user should succeed, got: {result2}"
            )

    @given(action=valid_actions)
    @settings(max_examples=30)
    def test_same_action_from_different_user_succeeds(self, action: str):
        """Same action from a different user on same incident → success (not a duplicate).

        **Validates: Requirements 19.2**
        """
        with _fresh_db() as db:
            user_a = _create_user(db, "user-a-unique")
            user_b = _create_user(db, "user-b-unique")
            station = _create_station(db, "DT10")
            incident = _create_incident(db, user_a.id, station.id)

            # User A performs action
            result1 = add_interaction(incident.id, user_a.id, action)
            assert result1.get("success") is True, (
                f"User A's '{action}' should succeed, got: {result1}"
            )

            # User B performs same action → success
            result2 = add_interaction(incident.id, user_b.id, action)
            assert result2.get("success") is True, (
                f"User B's same '{action}' should succeed (different user), got: {result2}"
            )


# ---------------------------------------------------------------------------
# Property 18: Duplicate Report Detection
# ---------------------------------------------------------------------------


class TestDuplicateReportDetection:
    """Property 18: Duplicate Report Detection.

    Two incident submissions with the same station and category created
    within the configured deduplication time window → the second is
    flagged as a duplicate (ModerationResult.FLAGGED with reason
    "duplicate_report").

    **Validates: Requirements 20.5**
    """

    @given(category=valid_categories)
    @settings(max_examples=30)
    def test_second_report_same_station_category_within_window_flagged(self, category: str):
        """Second incident with same station+category within time window → FLAGGED as duplicate.

        **Validates: Requirements 20.5**
        """
        with _fresh_db() as db:
            user = _create_user(db, "user-report-dup")
            station = _create_station(db, "NS5")

            # Create the first incident directly in DB (already approved)
            first_incident = _create_incident(db, user.id, station.id, category=category)

            # Now run the moderation pipeline for a second similar report
            # Use a query provider that checks the real DB
            from app.services.incident_service import _IncidentQueryProvider

            query_provider = _IncidentQueryProvider()
            duplicate_checker = DuplicateChecker(
                time_window_minutes=30,
                query_provider=query_provider,
            )
            pipeline = ModerationPipeline(duplicate_checker=duplicate_checker)

            second_data = {
                "station_id": station.id,
                "category": category,
                "title": "Another similar incident report here",
                "description": "This is a different but similar report for the same station and category",
            }

            outcome = pipeline.process(second_data)

            assert outcome.result == ModerationResult.FLAGGED, (
                f"Expected FLAGGED for duplicate report (station={station.id}, "
                f"category={category}), got {outcome.result} with reason={outcome.reason}"
            )
            assert outcome.reason == "duplicate_report", (
                f"Expected reason 'duplicate_report', got '{outcome.reason}'"
            )

    @given(category1=valid_categories, category2=valid_categories)
    @settings(max_examples=30)
    def test_different_category_same_station_not_flagged(self, category1: str, category2: str):
        """Different category at same station → NOT flagged as duplicate.

        **Validates: Requirements 20.5**
        """
        assume(category1 != category2)

        with _fresh_db() as db:
            user = _create_user(db, "user-diff-cat")
            station = _create_station(db, "EW12")

            # Create first incident
            _create_incident(db, user.id, station.id, category=category1)

            # Run moderation for a different category
            from app.services.incident_service import _IncidentQueryProvider

            query_provider = _IncidentQueryProvider()
            duplicate_checker = DuplicateChecker(
                time_window_minutes=30,
                query_provider=query_provider,
            )
            pipeline = ModerationPipeline(duplicate_checker=duplicate_checker)

            second_data = {
                "station_id": station.id,
                "category": category2,
                "title": "A completely different type of incident",
                "description": "This is about something else entirely at the same station",
            }

            outcome = pipeline.process(second_data)

            assert outcome.result == ModerationResult.APPROVED, (
                f"Expected APPROVED for different category ({category1} vs {category2}), "
                f"got {outcome.result} with reason={outcome.reason}"
            )

    @given(category=valid_categories)
    @settings(max_examples=30)
    def test_same_category_different_station_not_flagged(self, category: str):
        """Same category at a different station → NOT flagged as duplicate.

        **Validates: Requirements 20.5**
        """
        with _fresh_db() as db:
            user = _create_user(db, "user-diff-stn")
            station1 = _create_station(db, "NE4")
            station2 = _create_station(db, "NE7")

            # Create first incident at station1
            _create_incident(db, user.id, station1.id, category=category)

            # Run moderation for same category but different station
            from app.services.incident_service import _IncidentQueryProvider

            query_provider = _IncidentQueryProvider()
            duplicate_checker = DuplicateChecker(
                time_window_minutes=30,
                query_provider=query_provider,
            )
            pipeline = ModerationPipeline(duplicate_checker=duplicate_checker)

            second_data = {
                "station_id": station2.id,
                "category": category,
                "title": "Same type of incident at another station",
                "description": "This is the same category but at a different station entirely",
            }

            outcome = pipeline.process(second_data)

            assert outcome.result == ModerationResult.APPROVED, (
                f"Expected APPROVED for same category at different station, "
                f"got {outcome.result} with reason={outcome.reason}"
            )
