"""Property tests for reliability scoring.

**Property 19: Reliability Scoring**
- Test: score always in [0, 100], badge thresholds correct

**Property 20: Likes Do Not Establish Report Truth**
- Test: incident with only likes → no status transition

**Validates: Requirements 21.1, 21.2, 21.5**
"""

import sys
import os

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

sys.path.insert(
    0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
)

from app.services.reliability_service import (
    calculate_reliability_score,
    BADGE_SUPER_REPORTER,
    BADGE_TRUSTED_COMMUTER,
    BADGE_REGULAR,
    INITIAL_SCORE,
)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

VALID_BADGES = (BADGE_REGULAR, BADGE_TRUSTED_COMMUTER, BADGE_SUPER_REPORTER)


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Non-negative integers for user stats (reasonable range to keep tests fast)
non_neg_int = st.integers(min_value=0, max_value=500)

# Strategy for a valid user_stats dict with all required keys
user_stats_strategy = st.fixed_dictionaries({
    "confirmed": non_neg_int,
    "resolved": non_neg_int,
    "rejected": non_neg_int,
    "abusive": non_neg_int,
    "duplicate": non_neg_int,
    "total": non_neg_int,
})

# Strategy where total > 0 (user has submitted at least one report)
active_user_stats_strategy = st.fixed_dictionaries({
    "confirmed": non_neg_int,
    "resolved": non_neg_int,
    "rejected": non_neg_int,
    "abusive": non_neg_int,
    "duplicate": non_neg_int,
    "total": st.integers(min_value=1, max_value=500),
})

# Strategy for likes count (not part of scoring)
likes_count = st.integers(min_value=0, max_value=1000)


# ---------------------------------------------------------------------------
# Property 19: Reliability Scoring
# ---------------------------------------------------------------------------


class TestReliabilityScoring:
    """Property 19: Reliability Scoring.

    Score is always in [0, 100] and badge thresholds are correctly assigned.

    **Validates: Requirements 21.1, 21.2**
    """

    @given(stats=user_stats_strategy)
    @settings(max_examples=50)
    def test_score_always_in_valid_range(self, stats):
        """For any valid non-negative integer combination of stats,
        score is always in [0, 100].

        **Validates: Requirements 21.1**
        """
        score, badge = calculate_reliability_score(stats)

        assert isinstance(score, int), (
            f"Score must be an integer, got {type(score)}"
        )
        assert 0 <= score <= 100, (
            f"Score {score} not in [0, 100] for stats: {stats}"
        )

    @given(stats=user_stats_strategy)
    @settings(max_examples=50)
    def test_badge_always_valid(self, stats):
        """Badge is always one of: regular, trusted_commuter, super_reporter.

        **Validates: Requirements 21.2**
        """
        score, badge = calculate_reliability_score(stats)

        assert badge in VALID_BADGES, (
            f"Badge '{badge}' not in valid set {VALID_BADGES} "
            f"for stats: {stats}"
        )

    @given(stats=user_stats_strategy)
    @settings(max_examples=50)
    def test_super_reporter_threshold(self, stats):
        """Score >= 80 → badge = super_reporter.

        **Validates: Requirements 21.2**
        """
        score, badge = calculate_reliability_score(stats)

        if score >= 80:
            assert badge == BADGE_SUPER_REPORTER, (
                f"Score {score} >= 80 should yield '{BADGE_SUPER_REPORTER}', "
                f"got '{badge}'"
            )

    @given(stats=user_stats_strategy)
    @settings(max_examples=50)
    def test_trusted_commuter_threshold(self, stats):
        """Score in [60, 79] → badge = trusted_commuter.

        **Validates: Requirements 21.2**
        """
        score, badge = calculate_reliability_score(stats)

        if 60 <= score <= 79:
            assert badge == BADGE_TRUSTED_COMMUTER, (
                f"Score {score} in [60, 79] should yield "
                f"'{BADGE_TRUSTED_COMMUTER}', got '{badge}'"
            )

    @given(stats=user_stats_strategy)
    @settings(max_examples=50)
    def test_regular_threshold(self, stats):
        """Score < 60 → badge = regular.

        **Validates: Requirements 21.2**
        """
        score, badge = calculate_reliability_score(stats)

        if score < 60:
            assert badge == BADGE_REGULAR, (
                f"Score {score} < 60 should yield '{BADGE_REGULAR}', "
                f"got '{badge}'"
            )

    @given(stats=user_stats_strategy)
    @settings(max_examples=50)
    def test_zero_total_gives_initial_score(self, stats):
        """When total=0, score=50 and badge=regular (initial state).

        **Validates: Requirements 21.1, 21.2**
        """
        zero_stats = {**stats, "total": 0}
        score, badge = calculate_reliability_score(zero_stats)

        assert score == INITIAL_SCORE, (
            f"With total=0, expected score={INITIAL_SCORE}, got {score}"
        )
        assert badge == BADGE_REGULAR, (
            f"With total=0, expected badge='{BADGE_REGULAR}', got '{badge}'"
        )


# ---------------------------------------------------------------------------
# Property 20: Likes Do Not Establish Report Truth
# ---------------------------------------------------------------------------


class TestLikesDoNotEstablishTruth:
    """Property 20: Likes Do Not Establish Report Truth.

    Likes are not in the stats dict and do not affect the reliability score.
    Adding a 'likes' key to the stats dict has no effect on the score.

    **Validates: Requirements 21.5**
    """

    @given(stats=active_user_stats_strategy, likes=likes_count)
    @settings(max_examples=50)
    def test_likes_not_in_scoring_factors(self, stats, likes):
        """Adding a 'likes' field to stats dict does not change the score.

        The reliability service only considers: confirmed, resolved, rejected,
        abusive, duplicate, and total. Likes are intentionally excluded.

        **Validates: Requirements 21.5**
        """
        # Calculate score without likes
        score_without, badge_without = calculate_reliability_score(stats)

        # Calculate score with likes added to stats
        stats_with_likes = {**stats, "likes": likes}
        score_with, badge_with = calculate_reliability_score(stats_with_likes)

        assert score_without == score_with, (
            f"Likes should not affect score. Without likes: {score_without}, "
            f"with {likes} likes: {score_with}"
        )
        assert badge_without == badge_with, (
            f"Likes should not affect badge. Without likes: '{badge_without}', "
            f"with {likes} likes: '{badge_with}'"
        )

    @given(likes=likes_count)
    @settings(max_examples=50)
    def test_only_likes_no_status_transition(self, likes):
        """A user with only likes and no other activity stays at initial score.

        An incident with only likes produces no status transition in the
        reliability system because likes alone do not establish report truth.

        **Validates: Requirements 21.5**
        """
        # User with zero meaningful activity but hypothetical likes
        stats = {
            "confirmed": 0,
            "resolved": 0,
            "rejected": 0,
            "abusive": 0,
            "duplicate": 0,
            "total": 0,
            "likes": likes,
        }

        score, badge = calculate_reliability_score(stats)

        # Should remain at initial state regardless of likes count
        assert score == INITIAL_SCORE, (
            f"With only {likes} likes and no reports, expected score="
            f"{INITIAL_SCORE}, got {score}"
        )
        assert badge == BADGE_REGULAR, (
            f"With only likes and no reports, expected badge='{BADGE_REGULAR}', "
            f"got '{badge}'"
        )
