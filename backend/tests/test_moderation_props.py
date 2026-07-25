"""Property tests for moderation pipeline.

**Property 14: Moderation Required Field Validation**
- Missing any required field → REJECTED with reason "missing_required_fields"

**Property 15: Moderation Text Validation**
- HTML/script stripped, profanity rejected, spam rejected

**Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.6, 18.5**
"""

import sys
import os

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

sys.path.insert(
    0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
)

from app.moderation.pipeline import (
    ModerationPipeline,
    ModerationOutcome,
    ModerationResult,
    REQUIRED_FIELDS,
    VALID_CATEGORIES,
    MIN_DESCRIPTION_LENGTH,
    MIN_TITLE_LENGTH,
    MAX_TITLE_LENGTH,
    MAX_DESCRIPTION_LENGTH,
)
from app.moderation.profanity_filter import ProfanityFilter, DEFAULT_PROFANITY_WORDS
from app.moderation.spam_detector import SpamDetector
from app.utils.sanitise import sanitise_text


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Strategy for a valid station_id
valid_station_id = st.text(
    alphabet=st.characters(whitelist_categories=("Ll", "Nd"), whitelist_characters="-"),
    min_size=3,
    max_size=30,
).filter(lambda s: s.strip() != "")

# Strategy for a valid category from the allowed list
valid_category = st.sampled_from(VALID_CATEGORIES)

# Strategy for safe text (no HTML, no profanity, no spam patterns)
safe_word = st.from_regex(r"[A-Za-z]{3,10}", fullmatch=True)

safe_title = st.text(
    alphabet=st.characters(whitelist_categories=("L", "Nd", "Zs"), whitelist_characters=" "),
    min_size=MIN_TITLE_LENGTH,
    max_size=min(MAX_TITLE_LENGTH, 60),
).filter(lambda s: len(s.strip()) >= MIN_TITLE_LENGTH)

safe_description = st.text(
    alphabet=st.characters(whitelist_categories=("L", "Nd", "Zs"), whitelist_characters=" .,!?"),
    min_size=MIN_DESCRIPTION_LENGTH,
    max_size=min(MAX_DESCRIPTION_LENGTH, 200),
).filter(lambda s: len(s.strip()) >= MIN_DESCRIPTION_LENGTH)

# Strategy for a valid submission (all required fields present, valid content)
valid_submission = st.fixed_dictionaries({
    "station_id": valid_station_id,
    "category": valid_category,
    "title": safe_title,
    "description": safe_description,
})

# HTML injection strategies
html_tags = st.sampled_from([
    "<script>alert('xss')</script>",
    "<b>bold</b>",
    "<img src=x onerror=alert(1)>",
    "<div onclick='malicious()'>text</div>",
    "<style>body{display:none}</style>",
    "<a href='javascript:void(0)'>link</a>",
    "<iframe src='evil.com'></iframe>",
    "<p>paragraph</p>",
])

# Strategy for profanity words (drawn from the actual word list)
profanity_word = st.sampled_from(DEFAULT_PROFANITY_WORDS)

# Strategy for spam patterns
spam_pattern = st.sampled_from([
    "http://evil-spam-site.com buy now",
    "a" * 15,  # Repeated chars (10+ triggers)
    "test " * 6,  # Repeated word 5+ times
])


# ---------------------------------------------------------------------------
# Pipeline fixture (no duplicate checker to keep tests focused)
# ---------------------------------------------------------------------------

@pytest.fixture
def pipeline():
    """Create a moderation pipeline without duplicate checking."""
    return ModerationPipeline(duplicate_checker=None)


# ---------------------------------------------------------------------------
# Property 14: Moderation Required Field Validation
# ---------------------------------------------------------------------------


class TestModerationRequiredFieldValidation:
    """Property 14: Missing required fields → rejection.

    **Validates: Requirements 20.1, 20.2**
    """

    @given(
        submission=valid_submission,
        field_to_remove=st.sampled_from(REQUIRED_FIELDS),
    )
    @settings(max_examples=100)
    def test_missing_any_required_field_gives_rejection(
        self, submission: dict, field_to_remove: str
    ):
        """Removing any single required field from a valid submission → REJECTED.

        **Validates: Requirements 20.1**
        """
        pipeline = ModerationPipeline(duplicate_checker=None)

        # Remove the field
        data = dict(submission)
        del data[field_to_remove]

        outcome = pipeline.process(data)

        assert outcome.result == ModerationResult.REJECTED, (
            f"Expected REJECTED when '{field_to_remove}' is missing, "
            f"got {outcome.result} with reason={outcome.reason}"
        )
        assert outcome.reason == "missing_required_fields", (
            f"Expected reason 'missing_required_fields', got '{outcome.reason}'"
        )
        assert field_to_remove in outcome.details.get("missing_fields", []), (
            f"Expected '{field_to_remove}' in missing_fields list"
        )

    @given(
        submission=valid_submission,
        field_to_empty=st.sampled_from(REQUIRED_FIELDS),
    )
    @settings(max_examples=100)
    def test_empty_string_required_field_gives_rejection(
        self, submission: dict, field_to_empty: str
    ):
        """Setting any required field to empty string → REJECTED.

        **Validates: Requirements 20.1**
        """
        pipeline = ModerationPipeline(duplicate_checker=None)

        data = dict(submission)
        data[field_to_empty] = "   "  # whitespace-only counts as empty

        outcome = pipeline.process(data)

        assert outcome.result == ModerationResult.REJECTED, (
            f"Expected REJECTED when '{field_to_empty}' is whitespace-only, "
            f"got {outcome.result} with reason={outcome.reason}"
        )
        assert outcome.reason == "missing_required_fields", (
            f"Expected reason 'missing_required_fields', got '{outcome.reason}'"
        )

    @given(
        submission=valid_submission,
        invalid_category=st.text(min_size=1, max_size=30).filter(
            lambda s: s not in VALID_CATEGORIES and s.strip() != ""
        ),
    )
    @settings(max_examples=80)
    def test_invalid_category_gives_rejection(
        self, submission: dict, invalid_category: str
    ):
        """Providing an invalid category → REJECTED with reason 'invalid_category'.

        **Validates: Requirements 20.2**
        """
        pipeline = ModerationPipeline(duplicate_checker=None)

        data = dict(submission)
        data["category"] = invalid_category

        outcome = pipeline.process(data)

        assert outcome.result == ModerationResult.REJECTED, (
            f"Expected REJECTED for invalid category '{invalid_category}', "
            f"got {outcome.result} with reason={outcome.reason}"
        )
        assert outcome.reason == "invalid_category", (
            f"Expected reason 'invalid_category', got '{outcome.reason}'"
        )

    @given(
        submission=valid_submission,
        short_desc=st.text(
            alphabet=st.characters(whitelist_categories=("L", "Nd")),
            min_size=1,
            max_size=MIN_DESCRIPTION_LENGTH - 1,
        ),
    )
    @settings(max_examples=80)
    def test_description_shorter_than_min_length_gives_rejection(
        self, submission: dict, short_desc: str
    ):
        """Description shorter than MIN_DESCRIPTION_LENGTH → REJECTED.

        **Validates: Requirements 20.6**
        """
        assume(len(short_desc.strip()) > 0)  # must not be empty (caught by required fields)

        pipeline = ModerationPipeline(duplicate_checker=None)

        data = dict(submission)
        data["description"] = short_desc

        outcome = pipeline.process(data)

        assert outcome.result == ModerationResult.REJECTED, (
            f"Expected REJECTED for short description (len={len(short_desc)}), "
            f"got {outcome.result} with reason={outcome.reason}"
        )
        assert outcome.reason == "description_too_short", (
            f"Expected reason 'description_too_short', got '{outcome.reason}'"
        )


# ---------------------------------------------------------------------------
# Property 15: Moderation Text Validation
# ---------------------------------------------------------------------------


class TestModerationTextValidation:
    """Property 15: HTML stripped, profanity rejected, spam rejected.

    **Validates: Requirements 20.1, 20.3, 20.4**
    """

    @given(
        submission=valid_submission,
        html_injection=html_tags,
    )
    @settings(max_examples=80)
    def test_html_tags_are_sanitised_from_output(
        self, submission: dict, html_injection: str
    ):
        """Text containing HTML tags gets sanitised — no raw HTML in output.

        The pipeline sanitises text fields. Even if the submission is approved,
        the sanitised_data must not contain raw HTML tags.

        **Validates: Requirements 20.1**
        """
        pipeline = ModerationPipeline(duplicate_checker=None)

        data = dict(submission)
        # Inject HTML into both title and description (keeping them long enough)
        original_title = data["title"]
        original_desc = data["description"]
        data["title"] = f"{original_title} {html_injection}"
        data["description"] = f"{original_desc} {html_injection}"

        outcome = pipeline.process(data)

        # Regardless of overall outcome, check sanitised data if available
        if outcome.sanitised_data:
            sanitised_title = outcome.sanitised_data.get("title", "")
            sanitised_desc = outcome.sanitised_data.get("description", "")

            # No raw HTML tags should remain
            assert "<" not in sanitised_title or "&lt;" in sanitised_title or "<" not in sanitised_title, (
                f"Raw HTML found in sanitised title: {sanitised_title}"
            )
            assert "<script" not in sanitised_title.lower(), (
                f"Script tag found in sanitised title: {sanitised_title}"
            )
            assert "<script" not in sanitised_desc.lower(), (
                f"Script tag found in sanitised description: {sanitised_desc}"
            )
            # Check no unescaped angle brackets from HTML
            import re
            html_tag_re = re.compile(r"<[^>]+>")
            assert not html_tag_re.search(sanitised_title), (
                f"HTML tag found in sanitised title: {sanitised_title}"
            )
            assert not html_tag_re.search(sanitised_desc), (
                f"HTML tag found in sanitised description: {sanitised_desc}"
            )

    @given(
        submission=valid_submission,
        profanity=profanity_word,
    )
    @settings(max_examples=100)
    def test_profanity_in_text_gives_rejection(
        self, submission: dict, profanity: str
    ):
        """Text containing profanity → REJECTED with reason 'profanity_detected'.

        **Validates: Requirements 20.3**
        """
        pipeline = ModerationPipeline(duplicate_checker=None)

        data = dict(submission)
        # Insert profanity as a standalone word in the description
        data["description"] = f"There is a {profanity} situation at this station right now"

        outcome = pipeline.process(data)

        assert outcome.result == ModerationResult.REJECTED, (
            f"Expected REJECTED for profanity '{profanity}' in text, "
            f"got {outcome.result} with reason={outcome.reason}"
        )
        assert outcome.reason == "profanity_detected", (
            f"Expected reason 'profanity_detected', got '{outcome.reason}'"
        )

    @given(submission=valid_submission)
    @settings(max_examples=50)
    def test_spam_with_unsupported_links_gives_rejection(self, submission: dict):
        """Text with links to non-allowed domains → REJECTED as spam.

        **Validates: Requirements 20.4**
        """
        pipeline = ModerationPipeline(duplicate_checker=None)

        data = dict(submission)
        data["description"] = (
            "Check out http://spam-site.example.com for cheap deals! "
            "This is totally relevant to MRT incidents."
        )

        outcome = pipeline.process(data)

        assert outcome.result == ModerationResult.REJECTED, (
            f"Expected REJECTED for spam URL, got {outcome.result} with reason={outcome.reason}"
        )
        assert outcome.reason == "spam_detected", (
            f"Expected reason 'spam_detected', got '{outcome.reason}'"
        )

    @given(submission=valid_submission)
    @settings(max_examples=50)
    def test_spam_with_repeated_text_gives_rejection(self, submission: dict):
        """Text with repeated words (5+ same word) → REJECTED as spam.

        **Validates: Requirements 20.4**
        """
        pipeline = ModerationPipeline(duplicate_checker=None)

        data = dict(submission)
        # Repeated word 6 times triggers the spam detector
        data["description"] = "delay delay delay delay delay delay at this station"

        outcome = pipeline.process(data)

        assert outcome.result == ModerationResult.REJECTED, (
            f"Expected REJECTED for repeated text spam, "
            f"got {outcome.result} with reason={outcome.reason}"
        )
        assert outcome.reason == "spam_detected", (
            f"Expected reason 'spam_detected', got '{outcome.reason}'"
        )

    @given(submission=valid_submission)
    @settings(max_examples=50)
    def test_spam_with_repeated_characters_gives_rejection(self, submission: dict):
        """Text with repeated characters (10+ same char) → REJECTED as spam.

        **Validates: Requirements 20.4**
        """
        pipeline = ModerationPipeline(duplicate_checker=None)

        data = dict(submission)
        data["description"] = "Train is delayeeeeeeeeeeed at Orchard station"

        outcome = pipeline.process(data)

        assert outcome.result == ModerationResult.REJECTED, (
            f"Expected REJECTED for repeated character spam, "
            f"got {outcome.result} with reason={outcome.reason}"
        )
        assert outcome.reason == "spam_detected", (
            f"Expected reason 'spam_detected', got '{outcome.reason}'"
        )

    @given(submission=valid_submission)
    @settings(max_examples=100)
    def test_valid_submission_is_approved(self, submission: dict):
        """A valid submission with all fields correct → APPROVED.

        **Validates: Requirements 20.6, 18.5**
        """
        pipeline = ModerationPipeline(duplicate_checker=None)

        # Ensure the generated submission doesn't accidentally contain profanity or spam
        profanity_filter = ProfanityFilter()
        spam_detector = SpamDetector()

        title = submission["title"]
        desc = submission["description"]
        combined = f"{title} {desc}"

        # Skip if hypothesis generates something that triggers profanity/spam
        assume(not profanity_filter.contains_profanity(combined))
        assume(not spam_detector.is_spam(combined))
        assume(len(title.strip()) >= MIN_TITLE_LENGTH)
        assume(len(desc.strip()) >= MIN_DESCRIPTION_LENGTH)

        # Also check after sanitisation
        sanitised_title = sanitise_text(title)
        sanitised_desc = sanitise_text(desc)
        assume(len(sanitised_title) >= MIN_TITLE_LENGTH)
        assume(len(sanitised_desc) >= MIN_DESCRIPTION_LENGTH)
        sanitised_combined = f"{sanitised_title} {sanitised_desc}"
        assume(not profanity_filter.contains_profanity(sanitised_combined))
        assume(not spam_detector.is_spam(sanitised_combined))

        outcome = pipeline.process(submission)

        assert outcome.result == ModerationResult.APPROVED, (
            f"Expected APPROVED for valid submission, "
            f"got {outcome.result} with reason={outcome.reason}, "
            f"details={outcome.details}"
        )
        assert outcome.sanitised_data, "APPROVED outcome must include sanitised_data"
