"""Crowd service — community submissions, anti-spam, and aggregation.

Combines community crowd reports with external providers (LTA, mock)
to produce aggregated crowd level readings per station.

Validates: Requirements 15.1, 15.3, 15.4, 16.1, 16.2, 16.3
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone

from app.extensions import db
from app.models.crowd_reading import CrowdReading

VALID_LEVELS = ("low", "moderate", "crowded", "very_crowded")


class CrowdService:
    """Service for managing crowd level submissions and aggregation."""

    ANTI_SPAM_WINDOW_MINUTES = 15  # One submission per user per station per 15 min
    AGGREGATION_WINDOW_MINUTES = 30  # Only consider submissions from last 30 min
    MIN_SUBMISSIONS_FOR_DISPLAY = 2  # Require at least 2 to display community level

    def submit_crowd_level(self, user_id: str, station_id: str, level: str) -> dict:
        """Submit a crowd observation. Rejects duplicates within window.

        Args:
            user_id: The submitting user's identifier.
            station_id: The station being reported on.
            level: One of "low", "moderate", "crowded", "very_crowded".

        Returns:
            dict with submission result or error information.

        Raises:
            ValueError: If level is not a valid crowd level.
        """
        # Validate level
        if level not in VALID_LEVELS:
            return {
                "success": False,
                "error": "invalid_level",
                "message": f"Level must be one of: {', '.join(VALID_LEVELS)}",
            }

        # Validate inputs
        if not user_id or not user_id.strip():
            return {
                "success": False,
                "error": "invalid_user",
                "message": "A valid user_id is required.",
            }

        if not station_id or not station_id.strip():
            return {
                "success": False,
                "error": "invalid_station",
                "message": "A valid station_id is required.",
            }

        # Anti-spam check: one submission per user per station per time window
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(minutes=self.ANTI_SPAM_WINDOW_MINUTES)

        recent_submission = CrowdReading.query.filter(
            CrowdReading.user_id == user_id,
            CrowdReading.station_id == station_id,
            CrowdReading.source == "community",
            CrowdReading.observed_at >= window_start,
        ).first()

        if recent_submission is not None:
            return {
                "success": False,
                "error": "duplicate_submission",
                "message": (
                    f"You have already submitted a crowd report for this station "
                    f"within the last {self.ANTI_SPAM_WINDOW_MINUTES} minutes."
                ),
            }

        # Create the crowd reading
        reading = CrowdReading(
            station_id=station_id,
            level=level,
            confidence=0.6,
            source="community",
            observed_at=now,
            expires_at=now + timedelta(minutes=self.AGGREGATION_WINDOW_MINUTES),
            user_id=user_id,
        )
        db.session.add(reading)
        db.session.commit()

        return {
            "success": True,
            "message": "Crowd level submitted successfully.",
            "data": {
                "stationId": station_id,
                "level": level,
                "observedAt": now.isoformat(),
            },
        }

    def get_station_crowd(self, station_id: str) -> dict:
        """Get aggregated crowd level for a station combining all sources.

        Priority order:
        1. Community aggregate (if >= MIN_SUBMISSIONS_FOR_DISPLAY recent reports)
        2. External provider (LTA / mock)

        Args:
            station_id: The station identifier.

        Returns:
            dict with crowd level, confidence, source, and timestamps.
        """
        now = datetime.now(timezone.utc)

        # Try community aggregate first
        community_level = self._aggregate_community_crowd(station_id)
        if community_level is not None:
            return {
                "level": community_level,
                "confidence": 0.8,
                "source": "community",
                "observedAt": now.isoformat(),
                "expiresAt": (now + timedelta(minutes=15)).isoformat(),
            }

        # Fall back to external provider
        from app.integrations import get_crowd_provider

        try:
            provider = get_crowd_provider()
            data = provider.get_station_crowd(station_id)
            data.setdefault("source", "historical")
            data.setdefault("observedAt", now.isoformat())
            data.setdefault("expiresAt", (now + timedelta(minutes=15)).isoformat())
            return data
        except Exception:
            # Ultimate fallback
            return {
                "level": "moderate",
                "confidence": 0.3,
                "source": "simulated",
                "observedAt": now.isoformat(),
                "expiresAt": (now + timedelta(minutes=15)).isoformat(),
            }

    def get_all_crowd(self) -> list[dict]:
        """Get crowd levels for all stations.

        Returns crowd data from the provider, enriched with community
        data where available.

        Returns:
            List of crowd level dictionaries per station.
        """
        from app.integrations import get_crowd_provider

        try:
            provider = get_crowd_provider()
            all_crowd = provider.get_all_crowd()
        except Exception:
            all_crowd = []

        # Enrich with community aggregates where available
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(minutes=self.AGGREGATION_WINDOW_MINUTES)

        # Get all recent community readings grouped by station
        recent_community = CrowdReading.query.filter(
            CrowdReading.source == "community",
            CrowdReading.observed_at >= window_start,
        ).all()

        # Group by station
        station_readings: dict[str, list[str]] = {}
        for reading in recent_community:
            station_readings.setdefault(reading.station_id, []).append(reading.level)

        # Build station_id -> provider data lookup
        provider_map = {item["stationId"]: item for item in all_crowd if "stationId" in item}

        # Merge: community overrides provider where we have enough submissions
        result = []
        seen_stations: set[str] = set()

        for station_id, levels in station_readings.items():
            seen_stations.add(station_id)
            if len(levels) >= self.MIN_SUBMISSIONS_FOR_DISPLAY:
                # Use community aggregate
                mode_level = Counter(levels).most_common(1)[0][0]
                result.append({
                    "stationId": station_id,
                    "level": mode_level,
                    "confidence": 0.8,
                    "source": "community",
                    "observedAt": now.isoformat(),
                    "expiresAt": (now + timedelta(minutes=15)).isoformat(),
                })
            elif station_id in provider_map:
                result.append(provider_map[station_id])

        # Add remaining provider data for stations without community data
        for item in all_crowd:
            sid = item.get("stationId")
            if sid and sid not in seen_stations:
                result.append(item)

        return result

    def _aggregate_community_crowd(self, station_id: str) -> str | None:
        """Aggregate community submissions using mode (most common level).

        Only considers submissions from the last AGGREGATION_WINDOW_MINUTES.
        Requires at least MIN_SUBMISSIONS_FOR_DISPLAY submissions.

        Args:
            station_id: The station identifier.

        Returns:
            The most common crowd level string, or None if insufficient data.
        """
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(minutes=self.AGGREGATION_WINDOW_MINUTES)

        recent_readings = CrowdReading.query.filter(
            CrowdReading.station_id == station_id,
            CrowdReading.source == "community",
            CrowdReading.observed_at >= window_start,
        ).all()

        if len(recent_readings) < self.MIN_SUBMISSIONS_FOR_DISPLAY:
            return None

        # Use mode (most frequent level)
        levels = [r.level for r in recent_readings]
        level_counts = Counter(levels)
        most_common_level = level_counts.most_common(1)[0][0]

        return most_common_level
