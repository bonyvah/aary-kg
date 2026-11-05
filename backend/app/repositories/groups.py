import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import Group
from app.models.user import User


async def get(session: AsyncSession, group_id: uuid.UUID) -> Group | None:
    return await session.get(Group, group_id)


async def get_by_name(session: AsyncSession, name: str) -> Group | None:
    result = await session.execute(select(Group).where(func.lower(Group.name) == name.lower()))
    return result.scalar_one_or_none()


async def list_with_counts(session: AsyncSession) -> list[tuple[Group, int]]:
    """Every group by name, with how many active students are in it. Disabled ones are not counted."""
    students = func.count(User.id)
    result = await session.execute(
        select(Group, students)
        .outerjoin(User, (User.group_id == Group.id) & User.active.is_(True))
        .group_by(Group.id)
        .order_by(func.lower(Group.name))
    )
    return [(group, count) for group, count in result.all()]


async def student_count(session: AsyncSession, group_id: uuid.UUID) -> int:
    """Active students only: a disabled one is gone for the admin."""
    result = await session.execute(
        select(func.count(User.id)).where(User.group_id == group_id, User.active.is_(True))
    )
    return result.scalar_one()


async def detach_disabled(session: AsyncSession, group_id: uuid.UUID) -> None:
    """Disabled students leave the group, so it can be deleted. Not committed."""
    await session.execute(
        update(User).where(User.group_id == group_id, User.active.is_(False)).values(group_id=None)
    )


def add(session: AsyncSession, group: Group) -> None:
    session.add(group)
