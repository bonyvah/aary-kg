"""A student's attempt at an exam. The server owns the clock and the questions' correct answers:
the student gets the questions without them, saves answers one by one, and the attempt ends when they
submit it, when the time is up or when the teacher closes the exam. Only then is the score counted."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.game.anticheat import KINDS
from app.models.exam_session import ExamAttempt, ExamAttemptEvent, ExamSession
from app.models.user import User
from app.repositories import exam_sessions as repo

# An answer sent just before the deadline may arrive a moment after it.
GRACE = timedelta(seconds=3)
MAX_EVENTS = 1000


def now() -> datetime:
    return datetime.now(UTC)


def score(exam_session: ExamSession, answers: dict[str, int]) -> int:
    return sum(1 for q in exam_session.questions if answers.get(q["id"]) == q["correct"])


SUSPECT_KINDS = ("TAB_BLUR", "WINDOW_BLUR", "FULLSCREEN_EXIT")


def final_score(exam_session: ExamSession, attempt: ExamAttempt) -> int | None:
    """The score after the teacher's ruling: zero, or without the questions that don't count."""
    if attempt.score is None:
        return None
    if attempt.decision == "zero":
        return 0
    if attempt.decision == "individual":
        skipped = {qid for qid, d in attempt.question_decisions.items() if d == "skip"}
        return sum(
            1
            for q in exam_session.questions
            if q["id"] not in skipped and attempt.answers.get(q["id"]) == q["correct"]
        )
    return attempt.score


def counted(attempt: ExamAttempt, question_id: str) -> bool:
    if attempt.decision == "zero":
        return False
    return not (attempt.decision == "individual" and attempt.question_decisions.get(question_id) == "skip")


def finish(exam_session: ExamSession, attempt: ExamAttempt, reason: str, at: datetime) -> None:
    attempt.submitted_at = min(at, attempt.deadline_at)
    attempt.submit_reason = reason
    attempt.score = score(exam_session, attempt.answers)


def finish_due(exam_session: ExamSession, at: datetime | None = None) -> bool:
    """Ends every attempt whose time is up. True when one was ended (the caller commits)."""
    at = at or now()
    changed = False
    for attempt in exam_session.attempts:
        if attempt.submitted_at is None and at >= attempt.deadline_at + GRACE:
            finish(exam_session, attempt, "timeout", attempt.deadline_at)
            changed = True
    return changed


def finish_all(exam_session: ExamSession, at: datetime) -> None:
    """The exam closes: what is still running ends with the answers given so far."""
    finish_due(exam_session, at)
    for attempt in exam_session.attempts:
        if attempt.submitted_at is None:
            finish(exam_session, attempt, "closed", at)


async def get_listed(session: AsyncSession, student: User, session_id: uuid.UUID) -> ExamSession:
    """An exam the student is on. Any other gets the same answer as one that doesn't exist."""
    exam_session = await repo.get(session, session_id)
    if not exam_session or not any(s.student_id == student.id for s in exam_session.students):
        raise ApiError(404, "SESSION_NOT_FOUND")
    if finish_due(exam_session):
        await session.commit()
    return exam_session


def attendance_of(exam_session: ExamSession, student_id: uuid.UUID) -> str:
    return next(s.attendance for s in exam_session.students if s.student_id == student_id)


async def start(session: AsyncSession, student: User, session_id: uuid.UUID) -> ExamSession:
    exam_session = await get_listed(session, student, session_id)
    if exam_session.status != "open":
        raise ApiError(409, "SESSION_CLOSED")
    if attendance_of(exam_session, student.id) == "absent":
        raise ApiError(403, "STUDENT_ABSENT")
    if not exam_session.can_start(student.id):
        raise ApiError(409, "ATTEMPT_EXISTS")
    started = now()
    exam_session.attempts.append(
        ExamAttempt(
            student_id=student.id,
            started_at=started,
            deadline_at=started + timedelta(minutes=exam_session.minutes),
            answers={},
        )
    )
    await session.commit()
    return await get_listed(session, student, session_id)


def _running(exam_session: ExamSession, student: User) -> ExamAttempt:
    attempt = exam_session.attempt_of(student.id)
    if attempt is None:
        raise ApiError(404, "ATTEMPT_NOT_FOUND")
    if attempt.submitted_at is not None or exam_session.status != "open":
        raise ApiError(409, "ATTEMPT_FINISHED")
    return attempt


async def answer(
    session: AsyncSession, student: User, session_id: uuid.UUID, question_id: str, position: int | None
) -> ExamSession:
    """Saves one answer (None clears it). Allowed until the deadline."""
    exam_session = await get_listed(session, student, session_id)
    attempt = _running(exam_session, student)
    question = next((q for q in exam_session.questions if q["id"] == question_id), None)
    if question is None:
        raise ApiError(404, "QUESTION_NOT_FOUND")
    if position is not None and not question["answers"][position - 1].strip():
        raise ApiError(422, "VALIDATION_ERROR", field="answer")
    answers = dict(attempt.answers)
    if position is None:
        answers.pop(question_id, None)
    else:
        answers[question_id] = position
    attempt.answers = answers
    await session.commit()
    return await get_listed(session, student, session_id)


async def submit(session: AsyncSession, student: User, session_id: uuid.UUID) -> ExamSession:
    exam_session = await get_listed(session, student, session_id)
    attempt = _running(exam_session, student)
    finish(exam_session, attempt, "manual", now())
    await session.commit()
    return await get_listed(session, student, session_id)


async def signal(
    session: AsyncSession, student: User, session_id: uuid.UUID, kind: str, question_id: str | None
) -> None:
    """Logs a screen signal with the server's time. Outside a running attempt it is dropped."""
    if kind not in KINDS:
        raise ApiError(422, "VALIDATION_ERROR", field="kind")
    exam_session = await get_listed(session, student, session_id)
    attempt = exam_session.attempt_of(student.id)
    if attempt is None or attempt.submitted_at is not None or exam_session.status != "open":
        return
    count = await session.scalar(
        select(func.count()).select_from(ExamAttemptEvent).where(ExamAttemptEvent.attempt_id == attempt.id)
    )
    if (count or 0) >= MAX_EVENTS:
        return
    known = question_id if any(q["id"] == question_id for q in exam_session.questions) else None
    session.add(ExamAttemptEvent(attempt_id=attempt.id, kind=kind, question_id=known))
    await session.commit()


async def list_for_student(session: AsyncSession, student: User) -> list[ExamSession]:
    sessions = await repo.list_for_student(session, student.id)
    if any([finish_due(s) for s in sessions]):
        await session.commit()
    return sessions
