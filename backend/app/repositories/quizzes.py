import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.quiz import Quiz


async def get(session: AsyncSession, quiz_id: uuid.UUID) -> Quiz | None:
    return await session.get(Quiz, quiz_id)


async def list_for_owner(session: AsyncSession, owner_id: uuid.UUID) -> list[Quiz]:
    result = await session.execute(
        select(Quiz).where(Quiz.owner_id == owner_id).order_by(Quiz.updated_at.desc())
    )
    return list(result.scalars())


async def list_others(session: AsyncSession, owner_id: uuid.UUID) -> list[Quiz]:
    """Everyone else's quizzes, newest first, with their owner."""
    result = await session.execute(
        select(Quiz)
        .where(Quiz.owner_id != owner_id)
        .options(selectinload(Quiz.owner))
        .order_by(Quiz.updated_at.desc())
    )
    return list(result.scalars())
