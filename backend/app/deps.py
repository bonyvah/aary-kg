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


# Admins look after teachers, students and groups. The superadmin looks after the admins and is the only
# one who corrects games, exams and contests. Both see the other's side read-only.
OVERSEERS = ("admin", "superadmin")


async def require_admin(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != "admin":
        raise ApiError(403, "FORBIDDEN")
    return user


async def require_superadmin(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != "superadmin":
        raise ApiError(403, "FORBIDDEN")
    return user


async def require_overseer(user: Annotated[User, Depends(current_user)]) -> User:
    """An admin or the superadmin: the read-only overviews of the platform."""
    if user.role not in OVERSEERS:
        raise ApiError(403, "FORBIDDEN")
    return user


async def require_staff(user: Annotated[User, Depends(current_user)]) -> User:
    """Admins, the superadmin and teachers: the staff screens. Anyone else (a student) is refused."""
    if user.role not in (*OVERSEERS, "teacher"):
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
SuperAdminUser = Annotated[User, Depends(require_superadmin)]
OverseerUser = Annotated[User, Depends(require_overseer)]
StaffUser = Annotated[User, Depends(require_staff)]
TeacherUser = Annotated[User, Depends(require_teacher)]
StudentUser = Annotated[User, Depends(require_student)]
