import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exam_session import ExamSession, ExamSessionStudent


async def get(session: AsyncSession, session_id: uuid.UUID) -> ExamSession | None:
    # Fresh from the database, with the groups and students, also right after a change.
    return await session.get(ExamSession, session_id, populate_existing=True)


async def list_for_owner(session: AsyncSession, owner_id: uuid.UUID) -> list[ExamSession]:
    result = await session.execute(
        select(ExamSession).where(ExamSession.owner_id == owner_id).order_by(ExamSession.opened_at.desc())
    )
    return list(result.scalars())


async def list_for_student(session: AsyncSession, student_id: uuid.UUID) -> list[ExamSession]:
    result = await session.execute(
        select(ExamSession)
        .join(ExamSessionStudent, ExamSessionStudent.session_id == ExamSession.id)
        .where(ExamSessionStudent.student_id == student_id)
        .order_by(ExamSession.opened_at.desc())
    )
    return list(result.scalars())
