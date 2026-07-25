"""Image validation for incident photo uploads.

Validates: Requirements 20.7, 20.8, 37.3
"""

from __future__ import annotations

import io
from typing import BinaryIO

from PIL import Image, UnidentifiedImageError

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_DIMENSION = 1920


class ImageValidator:
    """Validates uploaded image files for type, size, and integrity."""

    def validate(
        self, file_stream: BinaryIO, content_type: str, max_mb: int = 5
    ) -> tuple[bool, str]:
        """Validate an uploaded image.

        Args:
            file_stream: The file-like object containing image data.
            content_type: The MIME content type of the uploaded file.
            max_mb: Maximum allowed file size in megabytes.

        Returns:
            A tuple of (is_valid, error_message). If valid, error_message is
            an empty string.
        """
        # Check content type
        if content_type not in ALLOWED_TYPES:
            allowed = ", ".join(sorted(ALLOWED_TYPES))
            return False, f"Invalid file type '{content_type}'. Allowed: {allowed}"

        # Check file size
        file_stream.seek(0, io.SEEK_END)
        size_bytes = file_stream.tell()
        file_stream.seek(0)

        max_bytes = max_mb * 1024 * 1024
        if size_bytes > max_bytes:
            size_mb = round(size_bytes / (1024 * 1024), 2)
            return False, f"File too large ({size_mb} MB). Maximum allowed: {max_mb} MB"

        if size_bytes == 0:
            return False, "File is empty"

        # Validate it's a real image by attempting to open with Pillow
        try:
            img = Image.open(file_stream)
            img.verify()  # Verify image integrity
            file_stream.seek(0)
        except (UnidentifiedImageError, Exception):
            return False, "File is not a valid image or is corrupted"

        return True, ""
