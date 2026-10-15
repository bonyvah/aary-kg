from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models.user import User
from app.repositories import users as repo
from app.security import DUMMY_HASH, verify_password


async def authenticate(session: AsyncSession, login: str, password: str) -> User:
    login = login.strip().lower()
    if not login or not password:
        raise ApiError(400, "CREDENTIALS_REQUIRED")
    user = await repo.get_by_login(session, login)
    ok = verify_password(user.password_hash if user else DUMMY_HASH, password)
    if not user or not ok or not user.active:
        raise ApiError(401, "INVALID_CREDENTIALS")
    return user
