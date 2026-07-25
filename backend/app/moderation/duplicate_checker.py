"""Duplicate checker — detect same station+category within a time window.

Validates: Requirements 20.5
"""

from datetime import datetime, timedelta
from typing import Optional, Protocol


class IncidentQueryProtocol(Protocol):
    """Protocol for querying existing incidents.

    Allows the duplicate checker to work with any data source
    that provides incident lookup capabilities.
    """

    def find_recent_by_station_and_category(
        self,
        station_id: str,
        category: str,
        since: datetime,
    ) -> list[dict]:
        """Find incidents matching station+category since a given timestamp.

        Returns a list of dicts with at least: id, title, created_at.
        """
        ...


class DuplicateChecker:
    """Checks for duplicate incident reports within a configurable time window.

    A report is flagged as a duplicate if another report with the same
    station_id and category was submitted within the time window.
    Duplicates are not rejected — they are flagged so the UI can show
    a "Similar report exists" warning and optionally merge them.
    """

    def __init__(
        self,
        time_window_minutes: int = 30,
        query_provider: Optional[IncidentQueryProtocol] = None,
    ):
        """Initialise the duplicate checker.

        Args:
            time_window_minutes: Minutes to look back for duplicates.
            query_provider: Provider for querying existing incidents.
                           If None, duplicate checking is disabled.
        """
        self._time_window = timedelta(minutes=time_window_minutes)
        self._query_provider = query_provider

    def check_duplicate(
        self,
        station_id: str,
        category: str,
        current_time: Optional[datetime] = None,
    ) -> Optional[dict]:
        """Check if a similar report already exists within the time window.

        Args:
            station_id: The station being reported.
            category: The incident category.
            current_time: The current timestamp (defaults to utcnow).

        Returns:
            Dict with duplicate info if found, None otherwise.
            Example: {"is_duplicate": True, "existing_id": "abc-123",
                      "existing_title": "Train delay at Jurong East"}
        """
        if self._query_provider is None:
            return None

        now = current_time or datetime.utcnow()
        since = now - self._time_window

        existing = self._query_provider.find_recent_by_station_and_category(
            station_id=station_id,
            category=category,
            since=since,
        )

        if existing:
            latest = existing[0]
            return {
                "is_duplicate": True,
                "existing_id": latest.get("id"),
                "existing_title": latest.get("title"),
                "message": (
                    f"A similar '{category}' report for this station was submitted "
                    f"within the last {int(self._time_window.total_seconds() // 60)} minutes."
                ),
            }

        return None
