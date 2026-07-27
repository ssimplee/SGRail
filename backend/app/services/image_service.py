"""Image processing service for incident photo uploads.

Handles validation, EXIF stripping, resizing, and storage.

Validates: Requirements 20.7, 20.8, 37.3
"""

from __future__ import annotations

import os
import uuid
from typing import BinaryIO

from PIL import Image

from app.moderation.image_validator import ALLOWED_TYPES, MAX_DIMENSION, ImageValidator


class ImageService:
    """Processes and stores uploaded images safely."""

    def __init__(self, upload_folder: str, max_mb: int = 5) -> None:
        """Initialize the image service.

        Args:
            upload_folder: Absolute path to the uploads directory.
            max_mb: Maximum allowed upload size in megabytes.
        """
        self.upload_folder = upload_folder
        self.max_mb = max_mb
        self.validator = ImageValidator()

    def process_upload(
        self, file_stream: BinaryIO, content_type: str, max_mb: int | None = None
    ) -> str:
        """Process an uploaded image file.

        Steps:
        1. Validate type, size, and integrity
        2. Open with Pillow and convert to RGB (strips EXIF metadata)
        3. Resize if dimensions exceed MAX_DIMENSION
        4. Generate a UUID-based filename
        5. Save as WebP to the uploads directory

        Args:
            file_stream: The file-like object containing image data.
            content_type: The MIME content type of the uploaded file.
            max_mb: Override for maximum file size in MB (defaults to instance setting).

        Returns:
            The generated filename (e.g., "a1b2c3d4-....webp").

        Raises:
            ValueError: If validation fails.
        """
        effective_max_mb = max_mb if max_mb is not None else self.max_mb

        # Step 1: Validate
        is_valid, error = self.validator.validate(
            file_stream, content_type, effective_max_mb
        )
        if not is_valid:
            raise ValueError(error)

        # Step 2: Open and convert to RGB (strips EXIF metadata)
        file_stream.seek(0)
        with Image.open(file_stream) as source_img:
            # Convert to RGB to strip EXIF and handle RGBA/palette images
            if source_img.mode in ("RGBA", "LA"):
                # Composite onto white background for transparency
                background = Image.new("RGB", source_img.size, (255, 255, 255))
                background.paste(source_img, mask=source_img.split()[-1])
                img = background
            elif source_img.mode != "RGB":
                img = source_img.convert("RGB")
            else:
                img = source_img.copy()

        # Step 3: Resize if oversized (maintain aspect ratio)
        if img.width > MAX_DIMENSION or img.height > MAX_DIMENSION:
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

        # Step 4: Generate UUID-based safe filename
        filename = f"{uuid.uuid4()}.webp"

        # Step 5: Ensure upload directory exists and save as WebP
        os.makedirs(self.upload_folder, exist_ok=True)
        filepath = os.path.join(self.upload_folder, filename)
        img.save(filepath, format="WEBP", quality=85)

        return filename
