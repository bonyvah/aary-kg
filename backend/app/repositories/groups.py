import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import Group
from app.models.user import User


async def get(session: AsyncSession, group_id: uuid.UUID) -> Group | None:
    return await session.get(Group, group_id)


async def get_by_name(session: AsyncSession, name: str) -> Group | None:
    result = await session.execute(select(Group).where(func.lower(Group.name) == name.lower()))
    return result.scalar_one_or_none()


async def list_with_counts(session: AsyncSession) -> list[tuple[Group, int]]:
    """Every group by name, with how many students are in it."""
    students = func.count(User.id)
    result = await session.execute(
        select(Group, students)
        .outerjoin(User, User.group_id == Group.id)
        .group_by(Group.id)
        .order_by(func.lower(Group.name))
    )
    return [(group, count) for group, count in result.all()]


async def student_count(session: AsyncSession, group_id: uuid.UUID) -> int:
    result = await session.execute(select(func.count(User.id)).where(User.group_id == group_id))
    return result.scalar_one()


def add(session: AsyncSession, group: Group) -> None:
    session.add(group)
