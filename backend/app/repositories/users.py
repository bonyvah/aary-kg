import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def get(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await session.get(User, user_id)


async def get_by_login(session: AsyncSession, login: str) -> User | None:
    result = await session.execute(select(User).where(User.login == login))
    return result.scalar_one_or_none()


async def list_all(session: AsyncSession, *, exclude: uuid.UUID | None = None) -> list[User]:
    stmt = select(User).order_by(User.created_at, User.first_name, User.last_name)
    if exclude is not None:
        stmt = stmt.where(User.id != exclude)
    result = await session.execute(stmt)
    return list(result.scalars())


async def count(session: AsyncSession) -> int:
    return (await session.execute(select(func.count()).select_from(User))).scalar_one()


def add(session: AsyncSession, user: User) -> None:
    session.add(user)


async def get_many_active_teachers(session: AsyncSession, user_ids: list[uuid.UUID]) -> list[User]:
    result = await session.execute(
        select(User).where(User.id.in_(user_ids), User.active.is_(True), User.role == "teacher")
    )
    return list(result.scalars())


async def list_active_teachers(session: AsyncSession) -> list[User]:
    """Who can be picked as jury."""
    result = await session.execute(
        select(User)
        .where(User.active.is_(True), User.role == "teacher")
        .order_by(User.first_name, User.last_name)
    )
    return list(result.scalars())
