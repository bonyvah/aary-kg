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


async def create_user(session: AsyncSession, name: str, login: str, role: str) -> tuple[User, str]:
    name = name.strip()
    login = login.strip().lower()
    if not name:
        raise ApiError(400, "FIELD_REQUIRED", "name")
    if not login:
        raise ApiError(400, "FIELD_REQUIRED", "login")
    if not LOGIN_RE.match(login):
        raise ApiError(400, "LOGIN_INVALID", "login")
    if await repo.get_by_login(session, login):
        raise ApiError(409, "LOGIN_TAKEN", "login")
    password = generate_password()
    user = User(name=name, login=login, role=role, password_hash=hash_password(password))
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
    user.active = active
    await session.commit()
    return user


async def reset_password(session: AsyncSession, user_id: uuid.UUID) -> str:
    user = await _get(session, user_id)
    password = generate_password()
    user.password_hash = hash_password(password)
    await session.commit()
    return password
