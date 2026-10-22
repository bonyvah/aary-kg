import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exam import Exam


async def get(session: AsyncSession, exam_id: uuid.UUID) -> Exam | None:
    return await session.get(Exam, exam_id)


async def list_for_owner(session: AsyncSession, owner_id: uuid.UUID) -> list[Exam]:
    result = await session.execute(
        select(Exam).where(Exam.owner_id == owner_id).order_by(Exam.updated_at.desc())
    )
    return list(result.scalars())
