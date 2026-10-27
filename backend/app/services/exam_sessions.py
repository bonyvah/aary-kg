import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models.exam_session import ExamAttempt, ExamAttemptEvent, ExamSession, ExamSessionStudent
from app.models.group import Group
from app.models.user import User
from app.repositories import exam_sessions as repo
from app.repositories import users as users_repo
from app.schemas.exam_session import AttendanceChange, ExamSessionIn
from app.services import exam_attempts
from app.services import exams as exams_service


def _late_minutes(change: AttendanceChange) -> int | None:
    if change.attendance != "late":
        return None
    if change.late_minutes is None:
        raise ApiError(422, "VALIDATION_ERROR", field="lateMinutes")
    return change.late_minutes


async def create(session: AsyncSession, owner: User, payload: ExamSessionIn) -> ExamSession:
    """Starts a session: copies the sheet and opens it at once."""
    if owner.role != "teacher":
        raise ApiError(403, "FORBIDDEN")
    exam = await exams_service.get_editable(session, owner, payload.exam_id)
    if not payload.students:
        raise ApiError(400, "SESSION_NO_STUDENTS", field="students")

    groups: list[Group] = []
    if payload.group_ids:
        result = await session.execute(select(Group).where(Group.id.in_(payload.group_ids)))
        groups = list(result.scalars())
        if len(groups) != len(payload.group_ids):
            raise ApiError(404, "GROUP_NOT_FOUND", field="groupIds")

    ids = [s.student_id for s in payload.students]
    found = await users_repo.get_many_active_students(session, ids)
    if len(found) != len(ids):
        raise ApiError(404, "STUDENT_NOT_FOUND", field="students")

    exam_session = ExamSession(
        exam_id=exam.id,
        owner_id=owner.id,
        title=exam.title,
        minutes=exam.minutes,
        questions=list(exam.questions),
        status="open",
        groups=groups,
        students=[
            ExamSessionStudent(
                student_id=s.student_id, attendance=s.attendance, late_minutes=_late_minutes(s)
            )
            for s in payload.students
        ],
    )
    session.add(exam_session)
    await session.commit()
    return await get_owned(session, owner, exam_session.id)


async def get_owned(session: AsyncSession, user: User, session_id: uuid.UUID) -> ExamSession:
    """Only the teacher who started it. Anyone else gets the same answer as for one that doesn't exist."""
    exam_session = await repo.get(session, session_id)
    if not exam_session or exam_session.owner_id != user.id:
        raise ApiError(404, "SESSION_NOT_FOUND")
    if exam_attempts.finish_due(exam_session):
        await session.commit()
    return exam_session


async def get_viewable(session: AsyncSession, user: User, session_id: uuid.UUID) -> ExamSession:
    """The teacher who started it, or an admin (read-only: every change goes through get_owned)."""
    if user.role != "admin":
        return await get_owned(session, user, session_id)
    exam_session = await repo.get(session, session_id)
    if not exam_session:
        raise ApiError(404, "SESSION_NOT_FOUND")
    if exam_attempts.finish_due(exam_session):
        await session.commit()
    return exam_session


async def signal_counts(session: AsyncSession, exam_session: ExamSession) -> dict[uuid.UUID, dict[str, int]]:
    """attempt id -> kind -> how many times, for the session's attempts."""
    ids = [a.id for a in exam_session.attempts]
    if not ids:
        return {}
    rows = await session.execute(
        select(ExamAttemptEvent.attempt_id, ExamAttemptEvent.kind, func.count())
        .where(ExamAttemptEvent.attempt_id.in_(ids))
        .group_by(ExamAttemptEvent.attempt_id, ExamAttemptEvent.kind)
    )
    counts: dict[uuid.UUID, dict[str, int]] = {}
    for attempt_id, kind, n in rows:
        counts.setdefault(attempt_id, {})[kind] = n
    return counts


async def attempt_detail(
    session: AsyncSession, user: User, session_id: uuid.UUID, student_id: uuid.UUID
) -> tuple[ExamSession, ExamSessionStudent, ExamAttempt | None, list[ExamAttemptEvent]]:
    exam_session = await get_viewable(session, user, session_id)
    row = next((s for s in exam_session.students if s.student_id == student_id), None)
    if row is None:
        raise ApiError(404, "STUDENT_NOT_FOUND")
    attempt = exam_session.attempt_of(student_id)
    events: list[ExamAttemptEvent] = []
    if attempt is not None:
        result = await session.execute(
            select(ExamAttemptEvent)
            .where(ExamAttemptEvent.attempt_id == attempt.id)
            .order_by(ExamAttemptEvent.id)
        )
        events = list(result.scalars())
    return exam_session, row, attempt, events


def _open(exam_session: ExamSession) -> None:
    if exam_session.status != "open":
        raise ApiError(409, "SESSION_CLOSED")


async def set_attendance(
    session: AsyncSession, user: User, session_id: uuid.UUID, student_id: uuid.UUID, change: AttendanceChange
) -> ExamSession:
    """Marks a student present, late or absent while the session is open; adds them if they aren't on it.
    Once a student has started, their attendance stays."""
    exam_session = await get_owned(session, user, session_id)
    _open(exam_session)
    if exam_session.attempt_of(student_id):
        raise ApiError(409, "ATTEMPT_STARTED")
    late = _late_minutes(change)
    row = next((s for s in exam_session.students if s.student_id == student_id), None)
    if row is None:
        if not await users_repo.get_many_active_students(session, [student_id]):
            raise ApiError(404, "STUDENT_NOT_FOUND")
        exam_session.students.append(
            ExamSessionStudent(student_id=student_id, attendance=change.attendance, late_minutes=late)
        )
    else:
        row.attendance = change.attendance
        row.late_minutes = late
    await session.commit()
    return await get_owned(session, user, session_id)


async def close(session: AsyncSession, user: User, session_id: uuid.UUID) -> ExamSession:
    exam_session = await get_owned(session, user, session_id)
    _open(exam_session)
    closed = exam_attempts.now()
    exam_attempts.finish_all(exam_session, closed)
    exam_session.status = "closed"
    exam_session.closed_at = closed
    await session.commit()
    return await get_owned(session, user, session_id)


async def list_owned(session: AsyncSession, user: User) -> list[ExamSession]:
    sessions = await repo.list_for_owner(session, user.id)
    if any([exam_attempts.finish_due(s) for s in sessions]):
        await session.commit()
    return sessions


async def list_all(session: AsyncSession) -> list[ExamSession]:
    """For admins: every exam, newest first."""
    sessions = await repo.list_all(session)
    if any([exam_attempts.finish_due(s) for s in sessions]):
        await session.commit()
    return sessions
