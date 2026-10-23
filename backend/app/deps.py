from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import ApiError
from app.models.user import User
from app.services.auth import user_from_token

COOKIE_NAME = "aary_token"

Session = Annotated[AsyncSession, Depends(get_session)]


async def current_user(
    session: Session, token: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None
) -> User:
    user = await user_from_token(session, token)
    if user is None:
        raise ApiError(401, "UNAUTHENTICATED")
    return user


async def require_admin(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != "admin":
        raise ApiError(403, "FORBIDDEN")
    return user


async def require_staff(user: Annotated[User, Depends(current_user)]) -> User:
    """Admins and teachers: the staff screens. Anyone else (a student) is refused."""
    if user.role not in ("admin", "teacher"):
        raise ApiError(403, "FORBIDDEN")
    return user


async def require_teacher(user: Annotated[User, Depends(current_user)]) -> User:
    """Quizzes, hosting and running contests are a teacher's own. Admins only manage."""
    if user.role != "teacher":
        raise ApiError(403, "FORBIDDEN")
    return user


async def require_student(user: Annotated[User, Depends(current_user)]) -> User:
    """A student's own screens: their exams."""
    if user.role != "student":
        raise ApiError(403, "FORBIDDEN")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
StaffUser = Annotated[User, Depends(require_staff)]
TeacherUser = Annotated[User, Depends(require_teacher)]
StudentUser = Annotated[User, Depends(require_student)]
