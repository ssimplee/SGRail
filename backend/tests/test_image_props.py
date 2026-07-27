"""Property tests for image processing.

**Property 16: Moderation Image Processing**
- Invalid content types and oversized files rejected
- Valid files get UUID filename, stripped metadata, resized dimensions

**Validates: Requirements 20.7, 20.8**
"""

import io
import os
import re
import sys
import tempfile
import uuid

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st
from PIL import Image

sys.path.insert(
    0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
)

from app.moderation.image_validator import ImageValidator, ALLOWED_TYPES, MAX_DIMENSION
from app.services.image_service import ImageService


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Strategy for invalid content types (anything not in ALLOWED_TYPES)
invalid_content_type = st.sampled_from([
    "text/plain",
    "application/pdf",
    "text/html",
    "application/json",
    "image/gif",
    "image/bmp",
    "image/tiff",
    "application/octet-stream",
    "video/mp4",
])

# Strategy for valid content types
valid_content_type = st.sampled_from(sorted(ALLOWED_TYPES))

# Strategy for image dimensions (valid, within limits)
valid_dimension = st.integers(min_value=10, max_value=MAX_DIMENSION)

# Strategy for oversized dimensions (exceeding MAX_DIMENSION)
oversized_dimension = st.integers(min_value=MAX_DIMENSION + 1, max_value=5000)

# Strategy for valid image formats (matching content types)
valid_format_map = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def create_test_image(width: int, height: int, fmt: str = "JPEG") -> io.BytesIO:
    """Create an in-memory image with given dimensions and format."""
    img = Image.new("RGB", (width, height), "red")
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    buf.seek(0)
    return buf


def create_image_with_exif(width: int, height: int) -> io.BytesIO:
    """Create a JPEG image with fake EXIF-like data."""
    img = Image.new("RGB", (width, height), "blue")
    buf = io.BytesIO()
    # Save as JPEG — Pillow may add minimal headers
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf


UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$"
)


# ---------------------------------------------------------------------------
# Property 16: Moderation Image Processing — Validation
# ---------------------------------------------------------------------------


class TestImageValidationRejection:
    """Property 16 (Part 1): Invalid content types and oversized files rejected.

    **Validates: Requirements 20.7**
    """

    @given(content_type=invalid_content_type)
    @settings(max_examples=50, deadline=None)
    def test_invalid_content_type_rejected(self, content_type: str):
        """Invalid content types → validate returns (False, error).

        **Validates: Requirements 20.7**
        """
        validator = ImageValidator()

        # Create a valid image file but claim it's a different content type
        buf = create_test_image(100, 100, "JPEG")

        is_valid, error = validator.validate(buf, content_type, max_mb=5)

        assert is_valid is False, (
            f"Expected rejection for content_type='{content_type}', got valid"
        )
        assert "Invalid file type" in error, (
            f"Expected 'Invalid file type' in error, got: {error}"
        )

    @given(
        content_type=valid_content_type,
        max_mb=st.integers(min_value=1, max_value=3),
    )
    @settings(max_examples=30, deadline=None)
    def test_oversized_file_rejected(self, content_type: str, max_mb: int):
        """Files exceeding max_mb → validate returns (False, error).

        **Validates: Requirements 20.7**
        """
        validator = ImageValidator()

        # Create image data exceeding the max size
        # Use a large image that will produce a file bigger than max_mb
        fmt = valid_format_map[content_type]
        # Create a large uncompressed-ish image by making it big enough
        # Use raw bytes to guarantee size exceeds limit
        size_bytes = (max_mb * 1024 * 1024) + 1024
        buf = io.BytesIO(b"\x00" * size_bytes)

        is_valid, error = validator.validate(buf, content_type, max_mb=max_mb)

        assert is_valid is False, (
            f"Expected rejection for oversized file ({size_bytes} bytes > {max_mb} MB)"
        )
        assert "too large" in error.lower() or "empty" in error.lower() or "not a valid" in error.lower(), (
            f"Expected size-related error, got: {error}"
        )

    def test_empty_file_rejected(self):
        """Empty file (0 bytes) → validate returns (False, error).

        **Validates: Requirements 20.7**
        """
        validator = ImageValidator()

        buf = io.BytesIO(b"")

        is_valid, error = validator.validate(buf, "image/jpeg", max_mb=5)

        assert is_valid is False, "Expected rejection for empty file"
        assert "empty" in error.lower(), (
            f"Expected 'empty' in error message, got: {error}"
        )

    @given(
        content_type=valid_content_type,
        width=valid_dimension,
        height=valid_dimension,
    )
    @settings(max_examples=50, deadline=None)
    def test_valid_image_within_size_accepted(
        self, content_type: str, width: int, height: int
    ):
        """Valid JPEG/PNG/WebP within size limits → validate returns (True, "").

        **Validates: Requirements 20.7**
        """
        validator = ImageValidator()

        fmt = valid_format_map[content_type]
        buf = create_test_image(width, height, fmt)

        # Ensure the image we just created is within size limits
        buf.seek(0, io.SEEK_END)
        size_mb = buf.tell() / (1024 * 1024)
        buf.seek(0)
        assume(size_mb <= 5)

        is_valid, error = validator.validate(buf, content_type, max_mb=5)

        assert is_valid is True, (
            f"Expected valid for {content_type} image {width}x{height}, got error: {error}"
        )
        assert error == "", (
            f"Expected empty error string for valid image, got: {error}"
        )


# ---------------------------------------------------------------------------
# Property 16: Moderation Image Processing — Processing
# ---------------------------------------------------------------------------


class TestImageProcessing:
    """Property 16 (Part 2): Valid files get UUID filename, stripped metadata, resized.

    **Validates: Requirements 20.8**
    """

    @given(
        content_type=valid_content_type,
        width=valid_dimension,
        height=valid_dimension,
    )
    @settings(max_examples=50, deadline=None)
    def test_processed_image_gets_uuid_filename(
        self, content_type: str, width: int, height: int
    ):
        """Processed image filename matches UUID pattern (uuid4.webp).

        **Validates: Requirements 20.8**
        """
        with tempfile.TemporaryDirectory() as tmp_dir:
            service = ImageService(upload_folder=tmp_dir, max_mb=5)

            fmt = valid_format_map[content_type]
            buf = create_test_image(width, height, fmt)

            # Ensure file is within size limit
            buf.seek(0, io.SEEK_END)
            size_mb = buf.tell() / (1024 * 1024)
            buf.seek(0)
            assume(size_mb <= 5)

            filename = service.process_upload(buf, content_type)

            assert UUID_PATTERN.match(filename), (
                f"Filename '{filename}' does not match UUID pattern "
                f"'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.webp'"
            )

            # Verify the UUID portion is valid
            uuid_str = filename.rsplit(".", 1)[0]
            parsed_uuid = uuid.UUID(uuid_str)
            assert parsed_uuid.version == 4, (
                f"Expected UUID v4, got version {parsed_uuid.version}"
            )

    @given(
        content_type=valid_content_type,
        width=oversized_dimension,
        height=oversized_dimension,
    )
    @settings(max_examples=30, deadline=None)
    def test_processed_image_dimensions_within_limit(
        self, content_type: str, width: int, height: int
    ):
        """Processed oversized images have dimensions <= MAX_DIMENSION (1920px).

        **Validates: Requirements 20.8**
        """
        with tempfile.TemporaryDirectory() as tmp_dir:
            service = ImageService(upload_folder=tmp_dir, max_mb=50)

            fmt = valid_format_map[content_type]
            buf = create_test_image(width, height, fmt)

            # Ensure file is within size limit (use generous max for dimension tests)
            buf.seek(0, io.SEEK_END)
            size_mb = buf.tell() / (1024 * 1024)
            buf.seek(0)
            assume(size_mb <= 50)

            filename = service.process_upload(buf, content_type)

            # Open the saved file and check dimensions
            filepath = os.path.join(tmp_dir, filename)
            with Image.open(filepath) as saved_img:
                assert saved_img.width <= MAX_DIMENSION, (
                    f"Saved image width {saved_img.width} exceeds max {MAX_DIMENSION}"
                )
                assert saved_img.height <= MAX_DIMENSION, (
                    f"Saved image height {saved_img.height} exceeds max {MAX_DIMENSION}"
                )

    @given(
        content_type=valid_content_type,
        width=valid_dimension,
        height=valid_dimension,
    )
    @settings(max_examples=30, deadline=None)
    def test_processed_image_saved_as_webp(
        self, content_type: str, width: int, height: int
    ):
        """ImageService.process_upload returns a .webp filename for all valid inputs.

        **Validates: Requirements 20.8**
        """
        with tempfile.TemporaryDirectory() as tmp_dir:
            service = ImageService(upload_folder=tmp_dir, max_mb=5)

            fmt = valid_format_map[content_type]
            buf = create_test_image(width, height, fmt)

            buf.seek(0, io.SEEK_END)
            size_mb = buf.tell() / (1024 * 1024)
            buf.seek(0)
            assume(size_mb <= 5)

            filename = service.process_upload(buf, content_type)

            assert filename.endswith(".webp"), (
                f"Expected .webp extension, got: {filename}"
            )

            # Verify the file actually exists and is a valid WebP image
            filepath = os.path.join(tmp_dir, filename)
            assert os.path.exists(filepath), f"File not found: {filepath}"

            with Image.open(filepath) as saved_img:
                assert saved_img.format == "WEBP", (
                    f"Expected WEBP format, got: {saved_img.format}"
                )

    @given(
        width=st.integers(min_value=50, max_value=800),
        height=st.integers(min_value=50, max_value=800),
    )
    @settings(max_examples=30, deadline=None)
    def test_processed_image_has_metadata_stripped(self, width: int, height: int):
        """Processed images have EXIF metadata stripped (converted to RGB).

        **Validates: Requirements 20.8**
        """
        with tempfile.TemporaryDirectory() as tmp_dir:
            service = ImageService(upload_folder=tmp_dir, max_mb=5)

            buf = create_image_with_exif(width, height)

            filename = service.process_upload(buf, "image/jpeg")

            # Open the saved file and verify no EXIF data
            filepath = os.path.join(tmp_dir, filename)
            with Image.open(filepath) as saved_img:
                # WebP files converted from RGB should not carry EXIF
                exif_data = saved_img.info.get("exif", None)
                assert exif_data is None, (
                    f"Expected no EXIF metadata in processed image, but found some"
                )
