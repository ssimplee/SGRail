"""Property tests for crowd system.

**Property 10: Crowd Reading Validity**
- Test: level enum valid, source enum valid, confidence in [0,1]

**Property 11: Crowd Anti-Spam**
- Test: second submission from same user within window → rejected

**Property 12: Crowd Aggregation**
- Test: displayed level = aggregated value, not single report

**Validates: Requirements 15.1, 15.3, 15.4, 16.2, 16.3**
"""

import sys
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

sys.path.insert(
    0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
)

from app import create_app
from app.extensions import db as _db
from app.services.crowd_service import CrowdService, VALID_LEVELS


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

VALID_SOURCES = ("official", "historical", "community", "simulated")

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

valid_level = st.sampled_from(list(VALID_LEVELS))

invalid_level = st.text(
    alphabet=st.characters(whitelist_categories=("L", "Nd")),
    min_size=1,
    max_size=30,
).filter(lambda s: s not in VALID_LEVELS and s.strip() != "")

valid_user_id = st.text(
    alphabet=st.characters(whitelist_categories=("Ll", "Nd"), whitelist_characters="-_"),
    min_size=3,
    max_size=20,
).filter(lambda s: s.strip() != "")

valid_station_id = st.text(
    alphabet=st.characters(whitelist_categories=("Ll", "Nd"), whitelist_characters="-"),
    min_size=3,
    max_size=20,
).filter(lambda s: s.strip() != "")


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


# ---------------------------------------------------------------------------
# Property 10: Crowd Reading Validity
# ---------------------------------------------------------------------------


class TestCrowdReadingValidity:
    """Property 10: Crowd Reading Validity.

    Submissions with valid level succeed; the result structure from
    get_station_crowd always has valid level enum, valid source enum,
    and confidence in [0, 1].

    **Validates: Requirements 15.1, 15.3, 15.4**
    """

    @given(level=valid_level, user_id=valid_user_id, station_id=valid_station_id)
    @settings(max_examples=50)
    def test_submit_valid_level_succeeds(self, level, user_id, station_id):
        """Submitting a valid crowd level returns success.

        **Validates: Requirements 15.1**
        """
        with _fresh_db():
            service = CrowdService()
            result = service.submit_crowd_level(user_id, station_id, level)

            assert result["success"] is True, (
                f"Expected success for valid level '{level}', got: {result}"
            )
            assert result["data"]["level"] == level
            assert result["data"]["stationId"] == station_id

    @given(level=invalid_level, user_id=valid_user_id, station_id=valid_station_id)
    @settings(max_examples=50)
    def test_submit_invalid_level_returns_error(self, level, user_id, station_id):
        """Submitting an invalid crowd level returns error 'invalid_level'.

        **Validates: Requirements 15.1**
        """
        with _fresh_db():
            service = CrowdService()
            result = service.submit_crowd_level(user_id, station_id, level)

            assert result["success"] is False
            assert result["error"] == "invalid_level", (
                f"Expected 'invalid_level' error for level '{level}', got: {result}"
            )

    @given(station_id=valid_station_id)
    @settings(max_examples=30)
    def test_get_station_crowd_returns_valid_structure(self, station_id):
        """get_station_crowd always returns valid level, source, and confidence.

        **Validates: Requirements 15.3, 15.4**
        """
        with _fresh_db():
            service = CrowdService()
            result = service.get_station_crowd(station_id)

            # Level must be one of the valid enum values
            assert result["level"] in VALID_LEVELS, (
                f"Level '{result['level']}' not in valid set {VALID_LEVELS}"
            )

            # Source must be one of the valid source types
            assert result["source"] in VALID_SOURCES, (
                f"Source '{result['source']}' not in valid set {VALID_SOURCES}"
            )

            # Confidence must be in [0, 1]
            confidence = result["confidence"]
            assert isinstance(confidence, (int, float)), (
                f"Confidence must be numeric, got {type(confidence)}"
            )
            assert 0.0 <= confidence <= 1.0, (
                f"Confidence {confidence} not in [0, 1]"
            )

            # Must have timestamp fields
            assert "observedAt" in result, "Missing 'observedAt' timestamp"
            assert "expiresAt" in result, "Missing 'expiresAt' timestamp"


# ---------------------------------------------------------------------------
# Property 11: Crowd Anti-Spam
# ---------------------------------------------------------------------------


class TestCrowdAntiSpam:
    """Property 11: Crowd Anti-Spam.

    Second submission from same user for same station within 15 min window
    is rejected.

    **Validates: Requirements 16.2**
    """

    @given(
        level1=valid_level,
        level2=valid_level,
        user_id=valid_user_id,
        station_id=valid_station_id,
    )
    @settings(max_examples=50)
    def test_duplicate_submission_within_window_rejected(
        self, level1, level2, user_id, station_id
    ):
        """Second submission from same user within 15 min → error 'duplicate_submission'.

        **Validates: Requirements 16.2**
        """
        with _fresh_db():
            service = CrowdService()

            # First submission should succeed
            result1 = service.submit_crowd_level(user_id, station_id, level1)
            assert result1["success"] is True, (
                f"First submission should succeed, got: {result1}"
            )

            # Second submission from same user, same station, within window → rejected
            result2 = service.submit_crowd_level(user_id, station_id, level2)
            assert result2["success"] is False, (
                f"Expected duplicate rejection, got: {result2}"
            )
            assert result2["error"] == "duplicate_submission", (
                f"Expected 'duplicate_submission' error, got: {result2['error']}"
            )

    @given(
        level1=valid_level,
        level2=valid_level,
        user_id1=valid_user_id,
        user_id2=valid_user_id,
        station_id=valid_station_id,
    )
    @settings(max_examples=50)
    def test_different_users_can_both_submit(
        self, level1, level2, user_id1, user_id2, station_id
    ):
        """Two different users submitting for same station → both succeed.

        **Validates: Requirements 16.2**
        """
        assume(user_id1 != user_id2)

        with _fresh_db():
            service = CrowdService()

            result1 = service.submit_crowd_level(user_id1, station_id, level1)
            assert result1["success"] is True, (
                f"First user's submission should succeed, got: {result1}"
            )

            result2 = service.submit_crowd_level(user_id2, station_id, level2)
            assert result2["success"] is True, (
                f"Second user's submission should succeed, got: {result2}"
            )

    @given(
        level1=valid_level,
        level2=valid_level,
        user_id=valid_user_id,
        station_id=valid_station_id,
    )
    @settings(max_examples=30)
    def test_after_window_expires_same_user_can_submit_again(
        self, level1, level2, user_id, station_id
    ):
        """After anti-spam window expires, same user can submit again.

        **Validates: Requirements 16.2**
        """
        with _fresh_db():
            service = CrowdService()

            # First submission
            result1 = service.submit_crowd_level(user_id, station_id, level1)
            assert result1["success"] is True

            # Mock time to be 16 minutes later (past the 15 min window)
            future_time = datetime.now(timezone.utc) + timedelta(minutes=16)
            with patch(
                "app.services.crowd_service.datetime"
            ) as mock_dt:
                mock_dt.now.return_value = future_time
                mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)

                # Second submission after window → should succeed
                result2 = service.submit_crowd_level(user_id, station_id, level2)
                assert result2["success"] is True, (
                    f"Submission after window expiry should succeed, got: {result2}"
                )


# ---------------------------------------------------------------------------
# Property 12: Crowd Aggregation
# ---------------------------------------------------------------------------


class TestCrowdAggregation:
    """Property 12: Crowd Aggregation.

    Displayed level is the aggregated value (mode) of all submissions,
    not a single report. Requires at least 2 submissions.

    **Validates: Requirements 16.3**
    """

    @given(
        level=valid_level,
        user_id=valid_user_id,
        station_id=valid_station_id,
    )
    @settings(max_examples=30)
    def test_single_submission_not_displayed_as_community(
        self, level, user_id, station_id
    ):
        """A single submission does not result in community-sourced display.

        Requires >= 2 submissions to show community aggregate.

        **Validates: Requirements 16.3**
        """
        with _fresh_db():
            service = CrowdService()

            # Submit only one reading
            service.submit_crowd_level(user_id, station_id, level)

            # Get station crowd — should NOT return source="community"
            # because only 1 submission exists (below MIN_SUBMISSIONS_FOR_DISPLAY)
            result = service.get_station_crowd(station_id)
            assert result["source"] != "community", (
                f"Single submission should not produce community source, got: {result}"
            )

    @given(
        station_id=valid_station_id,
        level_majority=valid_level,
        level_minority=valid_level,
    )
    @settings(max_examples=50)
    def test_aggregation_returns_mode_of_submissions(
        self, station_id, level_majority, level_minority
    ):
        """With 2+ submissions, displayed level = mode (most common level).

        **Validates: Requirements 16.3**
        """
        assume(level_majority != level_minority)

        with _fresh_db():
            service = CrowdService()

            # Submit 3 readings with majority level (from different users)
            users = ["user-agg-1", "user-agg-2", "user-agg-3", "user-agg-4"]
            for uid in users[:3]:
                service.submit_crowd_level(uid, station_id, level_majority)

            # Submit 1 reading with minority level
            service.submit_crowd_level(users[3], station_id, level_minority)

            # Get station crowd — should show community source with majority level
            result = service.get_station_crowd(station_id)
            assert result["source"] == "community", (
                f"Expected 'community' source with {len(users)} submissions, "
                f"got: {result['source']}"
            )
            assert result["level"] == level_majority, (
                f"Expected mode level '{level_majority}' (3 votes) over "
                f"'{level_minority}' (1 vote), got: '{result['level']}'"
            )

    @given(
        station_id=valid_station_id,
        level=valid_level,
    )
    @settings(max_examples=30)
    def test_aggregation_with_two_same_submissions_returns_that_level(
        self, station_id, level
    ):
        """Two submissions of the same level → community display shows that level.

        **Validates: Requirements 16.3**
        """
        with _fresh_db():
            service = CrowdService()

            # Submit 2 readings with same level from different users
            service.submit_crowd_level("user-same-1", station_id, level)
            service.submit_crowd_level("user-same-2", station_id, level)

            result = service.get_station_crowd(station_id)
            assert result["source"] == "community", (
                f"Expected 'community' source with 2 submissions, "
                f"got: {result['source']}"
            )
            assert result["level"] == level, (
                f"Expected level '{level}' with 2 identical votes, "
                f"got: '{result['level']}'"
            )
