import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models.group import Group
from app.repositories import groups as repo
from app.schemas.group import GroupOut

NAME_MAX = 60


async def _clean_name(session: AsyncSession, name: str, keep: uuid.UUID | None = None) -> str:
    name = name.strip()
    if not name:
        raise ApiError(400, "FIELD_REQUIRED", "name")
    if len(name) > NAME_MAX:
        raise ApiError(400, "VALIDATION_ERROR", "name")
    same = await repo.get_by_name(session, name)
    if same and same.id != keep:
        raise ApiError(409, "GROUP_NAME_TAKEN", "name")
    return name


async def _get(session: AsyncSession, group_id: uuid.UUID) -> Group:
    group = await repo.get(session, group_id)
    if not group:
        raise ApiError(404, "GROUP_NOT_FOUND")
    return group


async def _commit(session: AsyncSession) -> None:
    try:
        await session.commit()
    except IntegrityError:  # two saves raced past the name check
        await session.rollback()
        raise ApiError(409, "GROUP_NAME_TAKEN", "name") from None


async def list_all(session: AsyncSession) -> list[GroupOut]:
    return [
        GroupOut(id=g.id, name=g.name, student_count=n, created_at=g.created_at)
        for g, n in await repo.list_with_counts(session)
    ]


async def create(session: AsyncSession, name: str) -> GroupOut:
    group = Group(name=await _clean_name(session, name))
    repo.add(session, group)
    await _commit(session)
    await session.refresh(group)
    return GroupOut(id=group.id, name=group.name, student_count=0, created_at=group.created_at)


async def rename(session: AsyncSession, group_id: uuid.UUID, name: str) -> GroupOut:
    group = await _get(session, group_id)
    group.name = await _clean_name(session, name, keep=group.id)
    await _commit(session)
    count = await repo.student_count(session, group.id)
    return GroupOut(id=group.id, name=group.name, student_count=count, created_at=group.created_at)


async def delete(session: AsyncSession, group_id: uuid.UUID) -> None:
    """Only an empty group: its students are moved to another one first."""
    group = await _get(session, group_id)
    if await repo.student_count(session, group.id):
        raise ApiError(409, "GROUP_NOT_EMPTY")
    await session.delete(group)
    try:
        await session.commit()
    except IntegrityError:  # a student was put in it meanwhile
        await session.rollback()
        raise ApiError(409, "GROUP_NOT_EMPTY") from None
