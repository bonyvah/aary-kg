import asyncio
from typing import Annotated

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, File, UploadFile

from app import images
from app.config import get_settings
from app.deps import TeacherUser
from app.errors import ApiError
from app.game import ratelimit
from app.redis import get_redis
from app.schemas.base import CamelModel

router = APIRouter(prefix="/images", tags=["images"])
DAY_S = 24 * 60 * 60


class ImageOut(CamelModel):
    # What a quiz or a question keeps; the web app reads <public url>/<id>.webp.
    id: str


@router.post("", status_code=201, response_model=ImageOut, response_model_by_alias=True)
async def upload(user: TeacherUser, file: Annotated[UploadFile, File()]) -> ImageOut:
    """A JPEG, PNG, WebP or GIF of up to 10 MB, for a quiz cover or a question. Stored as WebP."""
    settings = get_settings()
    if not settings.r2_endpoint:
        raise ApiError(503, "IMAGES_NOT_CONFIGURED")
    data = await file.read(images.MAX_UPLOAD_BYTES + 1)
    if len(data) > images.MAX_UPLOAD_BYTES:
        raise ApiError(413, "FILE_TOO_LARGE", field="file")
    if not await ratelimit.allow(get_redis(), f"rl:img:{user.id}", settings.image_daily_limit, DAY_S):
        raise ApiError(429, "RATE_LIMITED")
    try:
        # Decoding a big photo takes a moment: off the event loop.
        webp = await asyncio.to_thread(images.encode, data)
    except images.NotAnImage:
        raise ApiError(415, "UNSUPPORTED_FILE", field="file") from None
    try:
        return ImageOut(id=await images.store(webp))
    except (BotoCoreError, ClientError):
        raise ApiError(502, "IMAGE_UPLOAD_FAILED") from None
