import re
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models.group import Group
from app.models.user import User
from app.repositories import groups as groups_repo
from app.repositories import users as repo
from app.security import generate_password, hash_password

# Same rule as frontend/src/lib/adminUsers.ts
LOGIN_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,31}$")


async def _student_group(session: AsyncSession, group_id: uuid.UUID | None) -> Group:
    if group_id is None:
        raise ApiError(400, "GROUP_REQUIRED", "groupId")
    group = await groups_repo.get(session, group_id)
    if not group:
        raise ApiError(404, "GROUP_NOT_FOUND", "groupId")
    return group


async def create_user(
    session: AsyncSession,
    first_name: str,
    last_name: str,
    login: str,
    role: str,
    group_id: uuid.UUID | None = None,
) -> tuple[User, str]:
    """A teacher has no group; a student is in exactly one."""
    first_name, last_name = first_name.strip(), last_name.strip()
    login = login.strip().lower()
    if not first_name:
        raise ApiError(400, "FIELD_REQUIRED", "firstName")
    if not last_name:
        raise ApiError(400, "FIELD_REQUIRED", "lastName")
    if len(first_name) > 60 or len(last_name) > 60:
        raise ApiError(400, "VALIDATION_ERROR", "firstName" if len(first_name) > 60 else "lastName")
    if not login:
        raise ApiError(400, "FIELD_REQUIRED", "login")
    if not LOGIN_RE.match(login):
        raise ApiError(400, "LOGIN_INVALID", "login")
    if await repo.get_by_login(session, login):
        raise ApiError(409, "LOGIN_TAKEN", "login")
    if role == "student":
        group: Group | None = await _student_group(session, group_id)
    elif group_id is not None:
        raise ApiError(400, "VALIDATION_ERROR", "groupId")
    else:
        group = None
    password = generate_password()
    user = User(
        first_name=first_name,
        last_name=last_name,
        login=login,
        role=role,
        group=group,
        password_hash=hash_password(password),
    )
    repo.add(session, user)
    try:
        await session.commit()
    except IntegrityError:  # two creates raced past the check above
        await session.rollback()
        raise ApiError(409, "LOGIN_TAKEN", "login") from None
    return user, password


async def _get(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await repo.get(session, user_id)
    if not user:
        raise ApiError(404, "USER_NOT_FOUND")
    return user


async def set_active(session: AsyncSession, actor: User, user_id: uuid.UUID, active: bool) -> User:
    user = await _get(session, user_id)
    if user.id == actor.id and not active:
        raise ApiError(400, "CANNOT_DISABLE_SELF")
    _not_an_admin(user)
    user.active = active
    await session.commit()
    return user


async def move_to_group(session: AsyncSession, user_id: uuid.UUID, group_id: uuid.UUID | None) -> User:
    """Students only: from one group to another. They are never left without one."""
    user = await _get(session, user_id)
    if user.role != "student":
        raise ApiError(400, "NOT_A_STUDENT")
    user.group = await _student_group(session, group_id)
    try:
        await session.commit()
    except IntegrityError:  # the group was deleted meanwhile
        await session.rollback()
        raise ApiError(404, "GROUP_NOT_FOUND", "groupId") from None
    return user


def _not_an_admin(user: User) -> None:
    """Admins manage teachers and students. Another admin can't be disabled or reset from here."""
    if user.role == "admin":
        raise ApiError(403, "CANNOT_MANAGE_ADMIN")


async def reset_password(session: AsyncSession, user_id: uuid.UUID) -> str:
    user = await _get(session, user_id)
    _not_an_admin(user)
    password = generate_password()
    user.password_hash = hash_password(password)
    user.token_version += 1  # every open session of this user ends
    await session.commit()
    return password
