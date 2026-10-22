import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models.exam import Exam
from app.models.user import User
from app.repositories import exams as repo
from app.schemas.exam import ExamIn
from app.services.quizzes import find_issues


def _check(payload: ExamIn) -> None:
    issues = find_issues(payload)
    if issues:
        raise ApiError(400, "EXAM_INVALID", issues=issues)


def _questions(payload: ExamIn) -> list[dict[str, object]]:
    return [q.model_dump() for q in payload.questions]


async def create(session: AsyncSession, owner: User, payload: ExamIn) -> Exam:
    if owner.role != "teacher":
        raise ApiError(403, "FORBIDDEN")
    _check(payload)
    exam = Exam(
        owner_id=owner.id,
        title=payload.title.strip(),
        minutes=payload.minutes,
        questions=_questions(payload),
    )
    session.add(exam)
    await session.commit()
    return exam


async def get_editable(session: AsyncSession, user: User, exam_id: uuid.UUID) -> Exam:
    """Only the owner, like a quiz. Anyone else gets the same answer as for an exam that doesn't exist."""
    exam = await repo.get(session, exam_id)
    if not exam or exam.owner_id != user.id:
        raise ApiError(404, "EXAM_NOT_FOUND")
    return exam


async def update(session: AsyncSession, user: User, exam_id: uuid.UUID, payload: ExamIn) -> Exam:
    """Always allowed: a session copies the questions when it starts, so it never changes under it."""
    exam = await get_editable(session, user, exam_id)
    _check(payload)
    exam.title = payload.title.strip()
    exam.minutes = payload.minutes
    exam.questions = _questions(payload)
    await session.commit()
    return exam
