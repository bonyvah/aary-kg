import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models.exam_session import ExamAttempt, ExamAttemptEvent, ExamAudit, ExamSession, ExamSessionStudent
from app.models.group import Group
from app.models.user import User
from app.repositories import exam_sessions as repo
from app.repositories import users as users_repo
from app.schemas.exam_session import AttendanceChange, DecisionIn, ExamSessionIn
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


async def history(session: AsyncSession, session_id: uuid.UUID, student_id: uuid.UUID) -> list[ExamAudit]:
    result = await session.execute(
        select(ExamAudit)
        .where(ExamAudit.session_id == session_id, ExamAudit.student_id == student_id)
        .order_by(ExamAudit.id)
    )
    return list(result.scalars())


def ruling(attempt: ExamAttempt) -> dict[str, object]:
    return {"decision": attempt.decision, "questions": dict(attempt.question_decisions)}


async def decide(
    session: AsyncSession, user: User, session_id: uuid.UUID, student_id: uuid.UUID, payload: DecisionIn
) -> ExamSession:
    """The teacher's anti-cheat ruling on an ended attempt with screen signals. It can change any
    time; the shown score is worked out from it. Every change is audited."""
    exam_session = await get_owned(session, user, session_id)
    attempt = exam_session.attempt_of(student_id)
    if attempt is None:
        raise ApiError(404, "ATTEMPT_NOT_FOUND")
    if attempt.submitted_at is None:
        raise ApiError(409, "ATTEMPT_RUNNING")
    counts = (await signal_counts(session, exam_session)).get(attempt.id, {})
    if not any(counts.get(kind) for kind in exam_attempts.SUSPECT_KINDS):
        raise ApiError(409, "NOT_A_SUSPECT")
    ids = {q["id"] for q in exam_session.questions}
    if any(qid not in ids for qid in payload.questions):
        raise ApiError(404, "QUESTION_NOT_FOUND")
    questions = (
        {qid: d for qid, d in payload.questions.items() if d == "skip"}
        if payload.decision == "individual"
        else {}
    )
    before = ruling(attempt)
    if before == {"decision": payload.decision, "questions": questions}:
        raise ApiError(409, "NOTHING_TO_CHANGE")
    attempt.decision = payload.decision
    attempt.question_decisions = questions
    session.add(
        ExamAudit(
            session_id=exam_session.id,
            student_id=student_id,
            attempt_id=attempt.id,
            actor_id=user.id,
            action="decision",
            before=before,
            after=ruling(attempt),
        )
    )
    await session.commit()
    return await get_owned(session, user, session_id)


async def attempt_detail(
    session: AsyncSession, user: User, session_id: uuid.UUID, student_id: uuid.UUID
) -> tuple[ExamSession, ExamSessionStudent, dict[uuid.UUID, list[ExamAttemptEvent]]]:
    """The student's row, and the signals of each of their attempts (inactive ones too)."""
    exam_session = await get_viewable(session, user, session_id)
    row = exam_session.row_of(student_id)
    if row is None:
        raise ApiError(404, "STUDENT_NOT_FOUND")
    ids = [a.id for a in exam_session.attempts_of(student_id)]
    events: dict[uuid.UUID, list[ExamAttemptEvent]] = {i: [] for i in ids}
    if ids:
        result = await session.execute(
            select(ExamAttemptEvent).where(ExamAttemptEvent.attempt_id.in_(ids)).order_by(ExamAttemptEvent.id)
        )
        for event in result.scalars():
            events[event.attempt_id].append(event)
    return exam_session, row, events


def can_grant(exam_session: ExamSession, student_id: uuid.UUID) -> bool:
    """Open, the student's attempts all ended, and no granted attempt is waiting to be used."""
    row = exam_session.row_of(student_id)
    attempts = exam_session.attempts_of(student_id)
    return (
        exam_session.status == "open"
        and row is not None
        and bool(attempts)
        and all(a.submitted_at is not None for a in attempts)
        and len(attempts) >= 1 + row.extra_attempts
    )


async def grant(
    session: AsyncSession, user: User, session_id: uuid.UUID, student_id: uuid.UUID
) -> ExamSession:
    """One more attempt for a student whose attempt has ended. Logged."""
    exam_session = await get_owned(session, user, session_id)
    _open(exam_session)
    row = exam_session.row_of(student_id)
    if row is None:
        raise ApiError(404, "STUDENT_NOT_FOUND")
    if not can_grant(exam_session, student_id):
        raise ApiError(409, "CANNOT_GRANT")
    # How many attempts the student may take in all, before and after.
    before = {"attempts": 1 + row.extra_attempts}
    row.extra_attempts += 1
    session.add(
        ExamAudit(
            session_id=exam_session.id,
            student_id=student_id,
            actor_id=user.id,
            action="grant",
            before=before,
            after={"attempts": 1 + row.extra_attempts},
        )
    )
    await session.commit()
    return await get_owned(session, user, session_id)


async def inactivate(session: AsyncSession, admin: User, attempt_id: uuid.UUID) -> ExamSession:
    """Admins only: the attempt is kept and shown, but doesn't count any more. Logged."""
    attempt = await session.get(ExamAttempt, attempt_id)
    if attempt is None:
        raise ApiError(404, "ATTEMPT_NOT_FOUND")
    if attempt.submitted_at is None:
        raise ApiError(409, "ATTEMPT_RUNNING")
    if not attempt.active:
        raise ApiError(409, "ATTEMPT_INACTIVE")
    attempt.active = False
    session.add(
        ExamAudit(
            session_id=attempt.session_id,
            student_id=attempt.student_id,
            attempt_id=attempt.id,
            actor_id=admin.id,
            action="inactivate",
            before={"active": True},
            after={"active": False},
        )
    )
    await session.commit()
    return await get_viewable(session, admin, attempt.session_id)


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
    if exam_session.attempts_of(student_id):
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
