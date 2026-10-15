import uuid
from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import ApiError
from app.models.user import User
from app.repositories import users as repo
from app.security import decode_token

COOKIE_NAME = "aary_token"

Session = Annotated[AsyncSession, Depends(get_session)]


async def current_user(
    session: Session, token: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None
) -> User:
    sub = decode_token(token) if token else None
    try:
        user_id = uuid.UUID(sub) if sub else None
    except ValueError:
        user_id = None
    user = await repo.get(session, user_id) if user_id else None
    # Disabling a user takes effect immediately, not when the token expires.
    if not user or not user.active:
        raise ApiError(401, "UNAUTHENTICATED")
    return user


async def require_admin(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != "admin":
        raise ApiError(403, "FORBIDDEN")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
