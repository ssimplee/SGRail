"""Text sanitisation utilities — strip HTML/script tags, escape special chars.

Validates: Requirements 20.1, 20.9
"""

import re
from html import escape as html_escape


# Regex patterns for dangerous HTML content
_SCRIPT_TAG_RE = re.compile(r"<script[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL)
_STYLE_TAG_RE = re.compile(r"<style[^>]*>.*?</style>", re.IGNORECASE | re.DOTALL)
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_HTML_ENTITY_RE = re.compile(r"&[a-zA-Z]+;|&#\d+;|&#x[0-9a-fA-F]+;")
_EVENT_HANDLER_RE = re.compile(r"\bon\w+\s*=", re.IGNORECASE)
_JAVASCRIPT_URI_RE = re.compile(r"javascript\s*:", re.IGNORECASE)


def sanitise_text(text: str) -> str:
    """Strip HTML/script tags and escape special characters.

    Steps:
    1. Remove <script> and <style> blocks entirely
    2. Remove all remaining HTML tags
    3. Remove event handler attributes (leftover from malformed HTML)
    4. Remove javascript: URIs
    5. Decode HTML entities and re-escape for safe storage
    6. Collapse excessive whitespace

    Args:
        text: Raw user input text.

    Returns:
        Sanitised text safe for storage and display.
    """
    if not text:
        return text

    # Step 1: Remove script and style blocks
    result = _SCRIPT_TAG_RE.sub("", text)
    result = _STYLE_TAG_RE.sub("", result)

    # Step 2: Remove all HTML tags
    result = _HTML_TAG_RE.sub("", result)

    # Step 3: Remove event handler patterns
    result = _EVENT_HANDLER_RE.sub("", result)

    # Step 4: Remove javascript: URIs
    result = _JAVASCRIPT_URI_RE.sub("", result)

    # Step 5: Escape special HTML chars for safe rendering
    result = html_escape(result, quote=True)

    # Step 6: Collapse excessive whitespace (but preserve single newlines)
    result = re.sub(r"[ \t]+", " ", result)
    result = re.sub(r"\n{3,}", "\n\n", result)
    result = result.strip()

    return result


def is_safe_text(text: str) -> bool:
    """Check if text contains potentially dangerous HTML/script content.

    Returns True if text appears safe (no HTML tags, no script content).
    """
    if _SCRIPT_TAG_RE.search(text):
        return False
    if _STYLE_TAG_RE.search(text):
        return False
    if _HTML_TAG_RE.search(text):
        return False
    if _JAVASCRIPT_URI_RE.search(text):
        return False
    return True
