"""Profanity filter — configurable word list check.

Validates: Requirements 20.3
"""

import re
from typing import Optional


# Default profanity word list — kept minimal and configurable.
# In production, load from a config file or database.
DEFAULT_PROFANITY_WORDS: list[str] = [
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "bastard",
    "damn",
    "crap",
    "dick",
    "pussy",
    "nigger",
    "faggot",
    "retard",
    "slut",
    "whore",
    "cock",
    "cunt",
]


class ProfanityFilter:
    """Configurable profanity filter using word boundary matching.

    Detects profanity by checking if any word from the configured list
    appears in the text (case-insensitive, word-boundary aware).
    """

    def __init__(self, word_list: Optional[list[str]] = None):
        """Initialise the profanity filter.

        Args:
            word_list: Optional custom list of profanity words.
                       Defaults to DEFAULT_PROFANITY_WORDS.
        """
        words = word_list if word_list is not None else DEFAULT_PROFANITY_WORDS
        # Build a single regex pattern with word boundaries for efficiency
        if words:
            escaped = [re.escape(word) for word in words]
            pattern = r"\b(" + "|".join(escaped) + r")\b"
            self._pattern = re.compile(pattern, re.IGNORECASE)
        else:
            self._pattern = None

    def contains_profanity(self, text: str) -> bool:
        """Check if text contains any profanity words.

        Args:
            text: The text to check.

        Returns:
            True if profanity is detected, False otherwise.
        """
        if not text or self._pattern is None:
            return False
        return bool(self._pattern.search(text))

    def get_matched_words(self, text: str) -> list[str]:
        """Return all profanity words found in the text.

        Args:
            text: The text to scan.

        Returns:
            List of matched profanity words (lowercased).
        """
        if not text or self._pattern is None:
            return []
        matches = self._pattern.findall(text)
        return [m.lower() for m in matches]
