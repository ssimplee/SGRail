"""Spam detection — repeated text, unsupported links, and suspicious patterns.

Validates: Requirements 20.4
"""

import re
from typing import Optional


# Patterns considered spammy
_URL_PATTERN = re.compile(
    r"https?://[^\s<>\"']+|www\.[^\s<>\"']+",
    re.IGNORECASE,
)

# Allowed URL domains (e.g. official MRT-related sites)
DEFAULT_ALLOWED_DOMAINS: list[str] = [
    "lta.gov.sg",
    "smrt.com.sg",
    "sbs.com.sg",
    "mytransport.sg",
    "onemotoring.lta.gov.sg",
]

# Patterns for repeated character spam (e.g. "aaaaaaa" or "!!!!!!")
_REPEATED_CHAR_RE = re.compile(r"(.)\1{9,}")  # 10+ of same char
_REPEATED_WORD_RE = re.compile(r"\b(\w+)\b(?:\s+\1\b){4,}", re.IGNORECASE)  # same word 5+ times

# All-caps detection (for strings longer than 20 chars that are >80% uppercase)
_MIN_CAPS_LENGTH = 20
_CAPS_THRESHOLD = 0.8


class SpamDetector:
    """Detects spam patterns in user-submitted text.

    Checks for:
    - URLs from non-allowed domains
    - Repeated characters (e.g. "aaaaaaa...")
    - Repeated words (e.g. "test test test test test")
    - Excessive ALL CAPS
    """

    def __init__(self, allowed_domains: Optional[list[str]] = None, max_urls: int = 2):
        """Initialise the spam detector.

        Args:
            allowed_domains: List of domains that are permitted in submissions.
            max_urls: Maximum number of URLs allowed before flagging as spam.
        """
        self._allowed_domains = allowed_domains or DEFAULT_ALLOWED_DOMAINS
        self._max_urls = max_urls

    def is_spam(self, text: str) -> bool:
        """Check if text exhibits spam patterns.

        Args:
            text: The text to analyse.

        Returns:
            True if spam is detected, False otherwise.
        """
        if not text:
            return False

        reasons = self.get_spam_reasons(text)
        return len(reasons) > 0

    def get_spam_reasons(self, text: str) -> list[str]:
        """Return a list of reasons the text is flagged as spam.

        Args:
            text: The text to analyse.

        Returns:
            List of reason strings. Empty means no spam detected.
        """
        if not text:
            return []

        reasons: list[str] = []

        # Check unsupported URLs
        urls = _URL_PATTERN.findall(text)
        unsupported_urls = [
            url for url in urls if not self._is_allowed_url(url)
        ]
        if unsupported_urls:
            reasons.append("unsupported_links")
        if len(urls) > self._max_urls:
            reasons.append("too_many_links")

        # Check repeated characters
        if _REPEATED_CHAR_RE.search(text):
            reasons.append("repeated_characters")

        # Check repeated words
        if _REPEATED_WORD_RE.search(text):
            reasons.append("repeated_words")

        # Check excessive ALL CAPS
        if self._is_excessive_caps(text):
            reasons.append("excessive_caps")

        return reasons

    def _is_allowed_url(self, url: str) -> bool:
        """Check if a URL belongs to an allowed domain."""
        url_lower = url.lower()
        for domain in self._allowed_domains:
            if domain in url_lower:
                return True
        return False

    def _is_excessive_caps(self, text: str) -> bool:
        """Check if text has excessive capitalisation."""
        # Only check strings long enough to be meaningful
        alpha_chars = [c for c in text if c.isalpha()]
        if len(alpha_chars) < _MIN_CAPS_LENGTH:
            return False

        upper_count = sum(1 for c in alpha_chars if c.isupper())
        return (upper_count / len(alpha_chars)) > _CAPS_THRESHOLD
