import uuid

from fastapi import APIRouter

from app.deps import AdminUser, Session
from app.repositories import users as repo
from app.schemas.user import CreateUserIn, ManagedUser, MoveGroupIn, PasswordOut, UserWithPassword
from app.services import users as service

router = APIRouter(prefix="/admin/users", tags=["admin"])


@router.get("", response_model=list[ManagedUser], response_model_by_alias=True)
async def list_users(_: AdminUser, session: Session) -> list[ManagedUser]:
    """Teachers and students. No admin is listed, the one asking included."""
    return [ManagedUser.model_validate(u) for u in await repo.list_managed(session)]


@router.post("", status_code=201, response_model=UserWithPassword, response_model_by_alias=True)
async def create_user(body: CreateUserIn, _: AdminUser, session: Session) -> UserWithPassword:
    user, password = await service.create_user(
        session, body.first_name, body.last_name, body.login, body.role, body.group_id, body.password
    )
    return UserWithPassword(user=ManagedUser.model_validate(user), password=password)


@router.post("/{user_id}/disable", response_model=ManagedUser, response_model_by_alias=True)
async def disable(user_id: uuid.UUID, actor: AdminUser, session: Session) -> ManagedUser:
    return ManagedUser.model_validate(await service.set_active(session, actor, user_id, False))


@router.post("/{user_id}/enable", response_model=ManagedUser, response_model_by_alias=True)
async def enable(user_id: uuid.UUID, actor: AdminUser, session: Session) -> ManagedUser:
    return ManagedUser.model_validate(await service.set_active(session, actor, user_id, True))


@router.put("/{user_id}/group", response_model=ManagedUser, response_model_by_alias=True)
async def move_to_group(user_id: uuid.UUID, body: MoveGroupIn, _: AdminUser, session: Session) -> ManagedUser:
    return ManagedUser.model_validate(await service.move_to_group(session, user_id, body.group_id))


@router.post("/{user_id}/reset-password", response_model=PasswordOut, response_model_by_alias=True)
async def reset_password(user_id: uuid.UUID, _: AdminUser, session: Session) -> PasswordOut:
    return PasswordOut(password=await service.reset_password(session, user_id))
