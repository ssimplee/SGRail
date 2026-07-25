"""Property tests for incident category validity.

**Property 13: Incident Category Validity**
- Every incident's category must be one of the 9 defined categories
- The VALID_CATEGORIES list has exactly 9 categories
- The IncidentCreateSchema rejects any category not in the valid list

**Validates: Requirements 17.1**
"""

import sys
import os

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st
from marshmallow import ValidationError

sys.path.insert(
    0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
)

from app.moderation.pipeline import VALID_CATEGORIES, ModerationPipeline, ModerationResult
from app.schemas.incident_schema import IncidentCreateSchema, INCIDENT_CATEGORIES


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Strategy for generating random strings that are NOT valid categories
invalid_category = st.text(
    alphabet=st.characters(whitelist_categories=("L", "Nd", "Zs"), whitelist_characters="_- "),
    min_size=1,
    max_size=40,
).filter(lambda s: s.strip() != "" and s not in VALID_CATEGORIES and s not in INCIDENT_CATEGORIES)


# ---------------------------------------------------------------------------
# Property 13: Incident Category Validity
# ---------------------------------------------------------------------------


class TestIncidentCategoryValidity:
    """Property 13: Incident categories are constrained to exactly 9 defined types.

    **Validates: Requirements 17.1**
    """

    def test_valid_categories_has_exactly_9_entries(self):
        """The VALID_CATEGORIES list in the moderation pipeline has exactly 9 categories.

        **Validates: Requirements 17.1**
        """
        assert len(VALID_CATEGORIES) == 9, (
            f"Expected exactly 9 valid categories, got {len(VALID_CATEGORIES)}: {VALID_CATEGORIES}"
        )

    def test_incident_categories_schema_has_exactly_9_entries(self):
        """The INCIDENT_CATEGORIES list in the schema has exactly 9 categories.

        **Validates: Requirements 17.1**
        """
        assert len(INCIDENT_CATEGORIES) == 9, (
            f"Expected exactly 9 incident categories in schema, "
            f"got {len(INCIDENT_CATEGORIES)}: {INCIDENT_CATEGORIES}"
        )

    @given(category=st.sampled_from(VALID_CATEGORIES))
    @settings(max_examples=30)
    def test_valid_category_accepted_by_moderation_pipeline(self, category: str):
        """Any category from VALID_CATEGORIES is accepted by the moderation pipeline.

        **Validates: Requirements 17.1**
        """
        pipeline = ModerationPipeline(duplicate_checker=None)

        data = {
            "station_id": "orchard",
            "category": category,
            "title": "Test incident report title",
            "description": "This is a valid test description for the incident report",
        }

        outcome = pipeline.process(data)

        # Should NOT be rejected for invalid_category
        if outcome.result == ModerationResult.REJECTED:
            assert outcome.reason != "invalid_category", (
                f"Valid category '{category}' was rejected as invalid_category"
            )

    @given(invalid_cat=invalid_category)
    @settings(max_examples=30)
    def test_invalid_category_rejected_by_moderation_pipeline(self, invalid_cat: str):
        """Any category NOT in VALID_CATEGORIES is rejected by the moderation pipeline.

        **Validates: Requirements 17.1**
        """
        pipeline = ModerationPipeline(duplicate_checker=None)

        data = {
            "station_id": "orchard",
            "category": invalid_cat,
            "title": "Test incident report title",
            "description": "This is a valid test description for the incident report",
        }

        outcome = pipeline.process(data)

        assert outcome.result == ModerationResult.REJECTED, (
            f"Expected REJECTED for invalid category '{invalid_cat}', "
            f"got {outcome.result} with reason={outcome.reason}"
        )
        assert outcome.reason == "invalid_category", (
            f"Expected reason 'invalid_category', got '{outcome.reason}'"
        )

    @given(invalid_cat=invalid_category)
    @settings(max_examples=30)
    def test_incident_create_schema_rejects_invalid_category(self, invalid_cat: str):
        """The IncidentCreateSchema rejects any category not in INCIDENT_CATEGORIES.

        **Validates: Requirements 17.1**
        """
        schema = IncidentCreateSchema()

        data = {
            "stationId": "orchard",
            "category": invalid_cat,
            "title": "Test incident title",
            "description": "This is a valid description for the incident",
            "incidentTime": "2025-01-15T10:30:00+08:00",
        }

        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)

        errors = exc_info.value.messages
        assert "category" in errors, (
            f"Expected validation error on 'category' field for '{invalid_cat}', "
            f"got errors: {errors}"
        )
