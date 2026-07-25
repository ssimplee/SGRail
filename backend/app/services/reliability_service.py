"""Reliability service — calculates and maintains reporter reliability scores and badges.

This is the SINGLE backend service responsible for updating user reliability scores.
No other service shall modify scores directly.

Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5
"""

from app.extensions import db
from app.models.user import User
from app.models.incident import Incident
from app.models.incident_interaction import IncidentInteraction


# Badge thresholds
BADGE_SUPER_REPORTER = "super_reporter"
BADGE_TRUSTED_COMMUTER = "trusted_commuter"
BADGE_REGULAR = "regular"

# Initial score for new users (Requirement 21.3)
INITIAL_SCORE = 50

# Scoring parameters
CONFIRMED_BONUS_PER = 3       # Per confirmed report
CONFIRMED_BONUS_CAP = 30      # Max bonus from confirmations
RESOLVED_BONUS_PER = 2        # Per resolved report
RESOLVED_BONUS_CAP = 10       # Max bonus from resolved reports
REJECTED_PENALTY_PER = 5      # Per rejected report
ABUSIVE_PENALTY_PER = 15      # Per abusive report
DUPLICATE_PENALTY_PER = 2     # Per duplicate report


def _clamp(value: int, min_val: int, max_val: int) -> int:
    """Clamp a value between min_val and max_val."""
    return max(min_val, min(value, max_val))


def _get_badge(score: int) -> str:
    """Determine badge based on score thresholds.

    - Super Reporter: score >= 80
    - Trusted Commuter: score >= 60
    - Regular: score < 60
    """
    if score >= 80:
        return BADGE_SUPER_REPORTER
    elif score >= 60:
        return BADGE_TRUSTED_COMMUTER
    else:
        return BADGE_REGULAR


def calculate_reliability_score(user_stats: dict) -> tuple[int, str]:
    """Calculate reliability score and badge from user report statistics.

    Likes alone do NOT establish report truth (Requirement 21.5).
    Only confirmed, resolved, rejected, abusive, and duplicate history
    contribute to the score.

    Args:
        user_stats: Dictionary with keys:
            - confirmed: int — reports confirmed by community
            - resolved: int — reports marked resolved
            - rejected: int — reports rejected by moderation
            - abusive: int — reports flagged as abusive
            - duplicate: int — reports flagged as duplicates
            - total: int — total reports submitted

    Returns:
        Tuple of (score: int 0-100, badge: str)
    """
    confirmed = user_stats.get("confirmed", 0)
    resolved = user_stats.get("resolved", 0)
    rejected = user_stats.get("rejected", 0)
    abusive = user_stats.get("abusive", 0)
    duplicate = user_stats.get("duplicate", 0)
    total = user_stats.get("total", 0)

    # New users with no reports get the initial score
    if total == 0:
        return (INITIAL_SCORE, BADGE_REGULAR)

    # Calculate bonuses (capped)
    confirmed_bonus = min(confirmed * CONFIRMED_BONUS_PER, CONFIRMED_BONUS_CAP)
    resolved_bonus = min(resolved * RESOLVED_BONUS_PER, RESOLVED_BONUS_CAP)

    # Calculate penalties (uncapped — bad behaviour has full impact)
    rejected_penalty = rejected * REJECTED_PENALTY_PER
    abusive_penalty = abusive * ABUSIVE_PENALTY_PER
    duplicate_penalty = duplicate * DUPLICATE_PENALTY_PER

    total_bonuses = confirmed_bonus + resolved_bonus
    total_penalties = rejected_penalty + abusive_penalty + duplicate_penalty

    score = _clamp(INITIAL_SCORE + total_bonuses - total_penalties, 0, 100)
    badge = _get_badge(score)

    return (score, badge)


def get_user_stats(user_id: str) -> dict:
    """Gather report statistics for a user from the database.

    Queries incidents and interactions to build the stats dict
    used by calculate_reliability_score().
    """
    # Count total reports by the user
    total = Incident.query.filter_by(user_id=user_id).count()

    # Count reports confirmed by community (confirm_count > 0 on user's incidents)
    confirmed = Incident.query.filter(
        Incident.user_id == user_id,
        Incident.confirm_count > 0
    ).count()

    # Count resolved reports
    resolved = Incident.query.filter_by(
        user_id=user_id, status="resolved"
    ).count()

    # Count rejected reports (moderation rejected)
    rejected = Incident.query.filter_by(
        user_id=user_id, moderation_status="rejected"
    ).count()

    # Count reports flagged as abusive by other users
    abusive = Incident.query.filter_by(
        user_id=user_id, status="removed"
    ).count()

    # Count duplicate reports (detected by moderation pipeline)
    # We track duplicates via incidents that were flagged during moderation
    # For now, we count incidents with moderation_status="rejected" that have
    # a duplicate interaction flagged. As a simpler heuristic, we use a
    # subquery checking if the incident had a "report_abusive" interaction
    # that led to removal — but actually duplicates are separate from abusive.
    # For a clean implementation, we count incidents rejected as duplicate
    # by checking for a status marker. Since our model doesn't have a separate
    # "duplicate" status, we'll use a count of 0 for now and extend later
    # when duplicate detection persists its findings.
    duplicate = 0  # Will be populated when duplicate detection stores results

    return {
        "confirmed": confirmed,
        "resolved": resolved,
        "rejected": rejected,
        "abusive": abusive,
        "duplicate": duplicate,
        "total": total,
    }


def update_user_reliability(user_id: str) -> None:
    """Recalculate and persist the user's reliability score and badge.

    This is the ONLY function that should update a user's reliability_score
    and badge fields (Requirement 21.4).
    """
    user = User.query.get(user_id)
    if user is None:
        return

    stats = get_user_stats(user_id)
    score, badge = calculate_reliability_score(stats)

    user.reliability_score = score
    user.badge = badge
    db.session.commit()
