import re
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models.user import User
from app.repositories import users as repo
from app.security import generate_password, hash_password

# Same rule as frontend/src/lib/adminUsers.ts
LOGIN_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,31}$")


async def create_user(
    session: AsyncSession, first_name: str, last_name: str, login: str, role: str
) -> tuple[User, str]:
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
    password = generate_password()
    user = User(
        first_name=first_name,
        last_name=last_name,
        login=login,
        role=role,
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


def _not_an_admin(user: User) -> None:
    """Admins manage regular users. Another admin can't be disabled or have a password reset from here."""
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
