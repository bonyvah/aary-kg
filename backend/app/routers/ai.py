from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, UploadFile

from app.ai import materials, questions
from app.config import get_settings
from app.deps import TeacherUser
from app.errors import ApiError
from app.game import ratelimit
from app.redis import get_redis
from app.schemas.base import CamelModel

router = APIRouter(prefix="/ai", tags=["ai"])
DAY_S = 24 * 60 * 60


class GeneratedQuestion(CamelModel):
    text: str
    answers: list[str]
    correct: int


class GeneratedOut(CamelModel):
    title: str
    questions: list[GeneratedQuestion]


@router.post("/questions", response_model=GeneratedOut, response_model_by_alias=True)
async def generate_questions(
    user: TeacherUser,
    count: Annotated[int, Form(ge=questions.MIN_COUNT, le=questions.MAX_COUNT)],
    language: Annotated[Literal["ky", "ru"], Form()],
    text: Annotated[str, Form(max_length=materials.MAX_CHARS * 2)] = "",
    files: Annotated[list[UploadFile] | None, File()] = None,
) -> GeneratedOut:
    """Questions from files (PDF, DOCX, PPTX, TXT; 10 MB in all) or pasted text, for the teacher to
    review in the editor. Nothing is saved."""
    uploads = [f for f in files or [] if f.filename]
    if len(uploads) > materials.MAX_FILES:
        raise ApiError(400, "TOO_MANY_FILES", field="files")
    if uploads:
        parts: list[str] = []
        total = 0
        for upload in uploads:
            kind = materials.kind_of(upload.filename or "")
            if kind is None:
                raise ApiError(415, "UNSUPPORTED_FILE", field="files")
            data = await upload.read(materials.MAX_FILE_BYTES + 1 - total)
            total += len(data)
            if total > materials.MAX_FILE_BYTES:
                raise ApiError(413, "FILE_TOO_LARGE", field="files")
            try:
                parts.append(materials.text_of(kind, data))
            except materials.UnreadableMaterial:
                raise ApiError(400, "MATERIAL_UNREADABLE", field="files") from None
        # One material, file after file, still within what the model is sent.
        material = "\n\n".join(parts)[: materials.MAX_CHARS]
    elif text.strip():
        try:
            material = materials.text_of("txt", text.encode())
        except materials.UnreadableMaterial:
            raise ApiError(400, "MATERIAL_TOO_SHORT", field="text") from None
    else:
        raise ApiError(400, "MATERIAL_REQUIRED")

    settings = get_settings()
    if not settings.openai_api_key:
        raise ApiError(503, "AI_NOT_CONFIGURED")
    if not await ratelimit.allow(get_redis(), f"rl:ai:{user.id}", settings.ai_daily_limit, DAY_S):
        raise ApiError(429, "AI_LIMIT")
    try:
        title, items = await questions.generate(material, count, language)
    except questions.AiNotConfigured:
        raise ApiError(503, "AI_NOT_CONFIGURED") from None
    except questions.AiFailed:
        raise ApiError(502, "AI_FAILED") from None
    return GeneratedOut(title=title, questions=[GeneratedQuestion(**q) for q in items])
