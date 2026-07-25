"""Moderation pipeline — orchestrates all validation steps for incident reports.

The pipeline processes incoming incident submissions through a series of checks:
1. Field validation (required fields present)
2. Text sanitisation (strip HTML/scripts)
3. Length validation (min/max length)
4. Profanity filter
5. Spam detection
6. Duplicate check

If any step fails, the pipeline returns a rejection result with the reason.
The image validation step (step 7) is handled separately by ImageValidator.

Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.9
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from app.moderation.duplicate_checker import DuplicateChecker, IncidentQueryProtocol
from app.moderation.profanity_filter import ProfanityFilter
from app.moderation.spam_detector import SpamDetector
from app.utils.sanitise import sanitise_text


class ModerationResult(str, Enum):
    """Result of the moderation pipeline."""

    APPROVED = "approved"
    REJECTED = "rejected"
    FLAGGED = "flagged"  # e.g. duplicate — warn but allow


@dataclass
class ModerationOutcome:
    """Complete result from running the moderation pipeline."""

    result: ModerationResult
    reason: Optional[str] = None
    details: dict[str, Any] = field(default_factory=dict)
    sanitised_data: dict[str, Any] = field(default_factory=dict)


# Valid incident categories
VALID_CATEGORIES = [
    "overcrowding",
    "lift_breakdown",
    "escalator_breakdown",
    "train_delay",
    "closed_exit",
    "platform_congestion",
    "suspicious_activity",
    "lost_item",
    "other",
]

# Required fields for incident submission
REQUIRED_FIELDS = ["station_id", "category", "title", "description"]

# Length constraints
MIN_TITLE_LENGTH = 5
MAX_TITLE_LENGTH = 150
MIN_DESCRIPTION_LENGTH = 10
MAX_DESCRIPTION_LENGTH = 2000


class ModerationPipeline:
    """Orchestrates all content validation steps for incident reports.

    Usage:
        pipeline = ModerationPipeline()
        outcome = pipeline.process(submission_data)
        if outcome.result == ModerationResult.APPROVED:
            # Save to database using outcome.sanitised_data
        elif outcome.result == ModerationResult.REJECTED:
            # Return error to user with outcome.reason
        elif outcome.result == ModerationResult.FLAGGED:
            # Show warning but allow submission
    """

    def __init__(
        self,
        profanity_filter: Optional[ProfanityFilter] = None,
        spam_detector: Optional[SpamDetector] = None,
        duplicate_checker: Optional[DuplicateChecker] = None,
    ):
        """Initialise the moderation pipeline with configurable validators.

        Args:
            profanity_filter: Custom profanity filter instance. Uses default if None.
            spam_detector: Custom spam detector instance. Uses default if None.
            duplicate_checker: Custom duplicate checker. None disables duplicate checking.
        """
        self._profanity_filter = profanity_filter or ProfanityFilter()
        self._spam_detector = spam_detector or SpamDetector()
        self._duplicate_checker = duplicate_checker or DuplicateChecker()

    def process(self, data: dict[str, Any]) -> ModerationOutcome:
        """Run the full moderation pipeline on an incident submission.

        Args:
            data: The submission data dict with fields like station_id,
                  category, title, description, etc.

        Returns:
            ModerationOutcome with the result, reason, and sanitised data.
        """
        # Step 1: Field validation
        outcome = self._validate_required_fields(data)
        if outcome:
            return outcome

        # Step 2: Category validation
        outcome = self._validate_category(data)
        if outcome:
            return outcome

        # Step 3: Text sanitisation
        sanitised = self._sanitise_fields(data)

        # Step 4: Length validation
        outcome = self._validate_lengths(sanitised)
        if outcome:
            return outcome

        # Step 5: Profanity check
        outcome = self._check_profanity(sanitised)
        if outcome:
            return outcome

        # Step 6: Spam detection
        outcome = self._check_spam(sanitised)
        if outcome:
            return outcome

        # Step 7: Duplicate check (flag, don't reject)
        duplicate_info = self._check_duplicate(sanitised)

        # Build approved/flagged result
        if duplicate_info:
            return ModerationOutcome(
                result=ModerationResult.FLAGGED,
                reason="duplicate_report",
                details=duplicate_info,
                sanitised_data=sanitised,
            )

        return ModerationOutcome(
            result=ModerationResult.APPROVED,
            sanitised_data=sanitised,
        )

    def _validate_required_fields(self, data: dict[str, Any]) -> Optional[ModerationOutcome]:
        """Step 1: Check that all required fields are present and non-empty."""
        missing = []
        for field_name in REQUIRED_FIELDS:
            value = data.get(field_name)
            if value is None or (isinstance(value, str) and not value.strip()):
                missing.append(field_name)

        if missing:
            return ModerationOutcome(
                result=ModerationResult.REJECTED,
                reason="missing_required_fields",
                details={"missing_fields": missing},
            )
        return None

    def _validate_category(self, data: dict[str, Any]) -> Optional[ModerationOutcome]:
        """Step 2: Validate the incident category is one of the allowed types."""
        category = data.get("category", "")
        if category not in VALID_CATEGORIES:
            return ModerationOutcome(
                result=ModerationResult.REJECTED,
                reason="invalid_category",
                details={
                    "provided": category,
                    "valid_categories": VALID_CATEGORIES,
                },
            )
        return None

    def _sanitise_fields(self, data: dict[str, Any]) -> dict[str, Any]:
        """Step 3: Sanitise text fields to remove HTML/scripts."""
        sanitised = dict(data)
        sanitised["title"] = sanitise_text(data.get("title", ""))
        sanitised["description"] = sanitise_text(data.get("description", ""))
        return sanitised

    def _validate_lengths(self, data: dict[str, Any]) -> Optional[ModerationOutcome]:
        """Step 4: Validate text field lengths."""
        title = data.get("title", "")
        description = data.get("description", "")

        if len(title) < MIN_TITLE_LENGTH:
            return ModerationOutcome(
                result=ModerationResult.REJECTED,
                reason="title_too_short",
                details={"min_length": MIN_TITLE_LENGTH, "actual_length": len(title)},
            )

        if len(title) > MAX_TITLE_LENGTH:
            return ModerationOutcome(
                result=ModerationResult.REJECTED,
                reason="title_too_long",
                details={"max_length": MAX_TITLE_LENGTH, "actual_length": len(title)},
            )

        if len(description) < MIN_DESCRIPTION_LENGTH:
            return ModerationOutcome(
                result=ModerationResult.REJECTED,
                reason="description_too_short",
                details={
                    "min_length": MIN_DESCRIPTION_LENGTH,
                    "actual_length": len(description),
                },
            )

        if len(description) > MAX_DESCRIPTION_LENGTH:
            return ModerationOutcome(
                result=ModerationResult.REJECTED,
                reason="description_too_long",
                details={
                    "max_length": MAX_DESCRIPTION_LENGTH,
                    "actual_length": len(description),
                },
            )

        return None

    def _check_profanity(self, data: dict[str, Any]) -> Optional[ModerationOutcome]:
        """Step 5: Check text fields for profanity."""
        title = data.get("title", "")
        description = data.get("description", "")
        combined_text = f"{title} {description}"

        if self._profanity_filter.contains_profanity(combined_text):
            matched = self._profanity_filter.get_matched_words(combined_text)
            return ModerationOutcome(
                result=ModerationResult.REJECTED,
                reason="profanity_detected",
                details={"matched_count": len(matched)},
            )
        return None

    def _check_spam(self, data: dict[str, Any]) -> Optional[ModerationOutcome]:
        """Step 6: Check for spam patterns."""
        title = data.get("title", "")
        description = data.get("description", "")
        combined_text = f"{title} {description}"

        reasons = self._spam_detector.get_spam_reasons(combined_text)
        if reasons:
            return ModerationOutcome(
                result=ModerationResult.REJECTED,
                reason="spam_detected",
                details={"spam_reasons": reasons},
            )
        return None

    def _check_duplicate(self, data: dict[str, Any]) -> Optional[dict]:
        """Step 7: Check for duplicate reports."""
        station_id = data.get("station_id", "")
        category = data.get("category", "")

        if not station_id or not category:
            return None

        return self._duplicate_checker.check_duplicate(
            station_id=station_id,
            category=category,
        )
