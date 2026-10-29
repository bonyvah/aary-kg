"""Quiz and question images: checked, cut to 16:9, shrunk and re-encoded here, then kept in the R2 bucket.

Every upload is decoded and written again as WebP, so what the browsers get is always a plain
image of a known size, whatever was sent (no metadata, no GPS position from a phone photo, no
file that only pretends to be an image). The name is the hash of the result: the same picture
uploaded twice is one file, and a file never changes, so browsers may keep it forever.
"""

import asyncio
import hashlib
import io
import re
from functools import lru_cache
from typing import Any

import boto3
from botocore.config import Config
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import get_settings

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
# Bigger than any photo a phone takes; past this a file is a decompression bomb, not a picture.
MAX_PIXELS = 50_000_000
# The longest side once stored: sharp on a projector, light on a phone.
MAX_SIDE = 1600
# Every image is stored in the shape of the frame that shows it: it fills the frame, nothing is left over.
RATIO = 16 / 9
QUALITY = 82
FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}
ID_PATTERN = r"^[0-9a-f]{64}$"
_ID = re.compile(ID_PATTERN)

Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class NotAnImage(Exception):
    """Not a JPEG, PNG, WebP or GIF, or one that can't be decoded."""


def encode(data: bytes, x: float = 0.5, y: float = 0.5) -> bytes:
    """
    The upload as a 16:9 WebP of at most MAX_SIDE pixels a side, turned upright. Raises NotAnImage.

    `x` and `y` (0 to 1) place the cut where the picture is too wide or too tall: 0 keeps the left
    or top edge, 1 the right or bottom one, 0.5 the middle.
    """
    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.format not in FORMATS:
                raise NotAnImage
            source.seek(0)  # a GIF keeps its first frame
            image = ImageOps.exif_transpose(source)
            image = image.convert("RGBA" if _has_alpha(image) else "RGB")
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError, SyntaxError):
        raise NotAnImage from None
    image = image.crop(_frame(image.width, image.height, x, y))
    image.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    image.save(out, "WEBP", quality=QUALITY, method=4)
    return out.getvalue()


def _frame(width: int, height: int, x: float, y: float) -> tuple[int, int, int, int]:
    """The biggest 16:9 box inside width x height, slid to x, y."""
    if width / height > RATIO:
        cut = max(1, round(height * RATIO))
        left = round((width - cut) * x)
        return left, 0, left + cut, height
    cut = max(1, round(width / RATIO))
    top = round((height - cut) * y)
    return 0, top, width, top + cut


def _has_alpha(image: Image.Image) -> bool:
    return image.mode in ("RGBA", "LA", "PA") or (image.mode == "P" and "transparency" in image.info)


def image_id(webp: bytes) -> str:
    return hashlib.sha256(webp).hexdigest()


def is_id(value: str) -> bool:
    return bool(_ID.match(value))


def key_of(image: str) -> str:
    """Where an image is kept in the bucket; the web app reads it from the same path."""
    return f"{image}.webp"


@lru_cache
def _client() -> Any:
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
        config=Config(connect_timeout=5, read_timeout=20, retries={"max_attempts": 3}),
    )


async def store(webp: bytes) -> str:
    """Puts the image in the bucket and returns its id. Raises the client's error."""
    image = image_id(webp)
    client = _client()
    await asyncio.to_thread(
        client.put_object,
        Bucket=get_settings().r2_bucket,
        Key=key_of(image),
        Body=webp,
        ContentType="image/webp",
        CacheControl="public, max-age=31536000, immutable",
    )
    return image
