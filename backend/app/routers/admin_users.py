import asyncio
import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile

from app.ai import materials, students
from app.ai.questions import AiFailed, AiNotConfigured
from app.config import get_settings
from app.deps import AdminUser, OverseerUser, Session
from app.errors import ApiError
from app.game import ratelimit
from app.redis import get_redis
from app.schemas.user import (
    CreateStudentsIn,
    CreateUserIn,
    ManagedUser,
    MoveGroupIn,
    PasswordOut,
    ProposedStudent,
    ResetPasswordIn,
    UserWithPassword,
)
from app.services import users as service

router = APIRouter(prefix="/admin/users", tags=["admin"])
DAY_S = 24 * 60 * 60


@router.get("", response_model=list[ManagedUser], response_model_by_alias=True)
async def list_users(viewer: OverseerUser, session: Session) -> list[ManagedUser]:
    """Teachers and students; for the superadmin the admins too. No superadmin is listed."""
    return [ManagedUser.model_validate(u) for u in await service.list_managed(session, viewer)]


@router.post("", status_code=201, response_model=UserWithPassword, response_model_by_alias=True)
async def create_user(body: CreateUserIn, actor: OverseerUser, session: Session) -> UserWithPassword:
    user, password = await service.create_user(
        session, body.first_name, body.last_name, body.login, body.role, body.group_id, body.password, actor
    )
    return UserWithPassword(user=ManagedUser.model_validate(user), password=password)


@router.post("/bulk/parse", response_model=list[ProposedStudent], response_model_by_alias=True)
async def parse_students(
    admin: AdminUser,
    session: Session,
    text: Annotated[str, Form()] = "",
    file: Annotated[UploadFile | None, File()] = None,
) -> list[ProposedStudent]:
    """A student list from a file (Word .docx, Excel .xlsx, .txt; 10 MB) or pasted text, for the admin
    to review. Nothing is saved."""
    try:
        if file is not None and file.filename:
            kind = students.kind_of(file.filename)
            if kind is None:
                raise ApiError(415, "UNSUPPORTED_FILE", field="file")
            data = await file.read(materials.MAX_FILE_BYTES + 1)
            if len(data) > materials.MAX_FILE_BYTES:
                raise ApiError(413, "FILE_TOO_LARGE", field="file")
            material = await asyncio.to_thread(students.text_of_file, kind, data)
        else:
            material = students.text_of_paste(text)
    except materials.UnreadableMaterial:
        raise ApiError(400, "MATERIAL_UNREADABLE", field="file") from None
    except students.ListTooLong:
        raise ApiError(400, "LIST_TOO_LONG") from None
    if not material:
        raise ApiError(400, "MATERIAL_REQUIRED")

    settings = get_settings()
    if not settings.openai_api_key:
        raise ApiError(503, "AI_NOT_CONFIGURED")
    if not await ratelimit.allow(get_redis(), f"rl:ai:{admin.id}", settings.ai_daily_limit, DAY_S):
        raise ApiError(429, "AI_LIMIT")
    try:
        read = await students.read(material)
    except AiNotConfigured:
        raise ApiError(503, "AI_NOT_CONFIGURED") from None
    except AiFailed:
        raise ApiError(502, "AI_FAILED") from None
    except students.ListTooLong:
        raise ApiError(400, "LIST_TOO_LONG") from None
    if not read:
        raise ApiError(400, "NO_STUDENTS_FOUND")
    return await service.propose_students(session, read)


@router.post("/bulk", status_code=201, response_model=list[ManagedUser], response_model_by_alias=True)
async def create_students(body: CreateStudentsIn, _: AdminUser, session: Session) -> list[ManagedUser]:
    created = await service.create_students(session, body.group_id, body.password, body.students)
    return [ManagedUser.model_validate(user) for user in created]


@router.post("/{user_id}/disable", response_model=ManagedUser, response_model_by_alias=True)
async def disable(user_id: uuid.UUID, actor: OverseerUser, session: Session) -> ManagedUser:
    return ManagedUser.model_validate(await service.disable(session, actor, user_id))


@router.put("/{user_id}/group", response_model=ManagedUser, response_model_by_alias=True)
async def move_to_group(user_id: uuid.UUID, body: MoveGroupIn, _: AdminUser, session: Session) -> ManagedUser:
    return ManagedUser.model_validate(await service.move_to_group(session, user_id, body.group_id))


@router.post("/{user_id}/reset-password", response_model=PasswordOut, response_model_by_alias=True)
async def reset_password(
    user_id: uuid.UUID, actor: OverseerUser, session: Session, body: ResetPasswordIn | None = None
) -> PasswordOut:
    password = body.password if body else ""
    return PasswordOut(password=await service.reset_password(session, actor, user_id, password))
