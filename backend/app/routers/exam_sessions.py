import uuid

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import AdminUser, Session, StaffUser, TeacherUser
from app.models.exam_session import ExamAttempt, ExamSession, ExamSessionStudent
from app.schemas.exam_session import (
    AttemptDetailOut,
    AttemptOut,
    AttemptState,
    AttendanceChange,
    AuditOut,
    DecisionIn,
    ExamSessionIn,
    ExamSessionOut,
    ExamSessionSummary,
    ResultQuestionOut,
    SessionGroupOut,
    SessionStudentOut,
    SignalCount,
    SignalOut,
)
from app.services import exam_attempts
from app.services import exam_sessions as service

router = APIRouter(prefix="/exam-sessions", tags=["exam-sessions"])
admin_router = APIRouter(prefix="/admin/exam-sessions", tags=["admin"])
KIND_ORDER = ("TAB_BLUR", "WINDOW_BLUR", "FULLSCREEN_EXIT", "PASTE")


def _state(attempt: ExamAttempt | None) -> AttemptState:
    if attempt is None:
        return "none"
    return "in_progress" if attempt.submitted_at is None else "submitted"


def _signals(counts: dict[str, int]) -> list[SignalCount]:
    return [SignalCount(kind=kind, count=counts[kind]) for kind in KIND_ORDER if counts.get(kind)]


def _suspect(counts: dict[str, int]) -> bool:
    return any(counts.get(kind) for kind in exam_attempts.SUSPECT_KINDS)


def _student(s: ExamSession, row: ExamSessionStudent, counts: dict) -> SessionStudentOut:
    attempt = s.attempt_of(row.student_id)
    mine = counts.get(attempt.id, {}) if attempt else {}
    return SessionStudentOut(
        student_id=row.student_id,
        name=row.student.name,
        group_name=row.student.group_name,
        attendance=row.attendance,  # type: ignore[arg-type]
        late_minutes=row.late_minutes,
        attempt_state=_state(attempt),
        started_at=attempt.started_at if attempt else None,
        submitted_at=attempt.submitted_at if attempt else None,
        submit_reason=attempt.submit_reason if attempt else None,  # type: ignore[arg-type]
        score=exam_attempts.final_score(s, attempt) if attempt else None,
        raw_score=attempt.score if attempt else None,
        decision=attempt.decision if attempt else None,  # type: ignore[arg-type]
        suspect=_suspect(mine),
        signals=_signals(mine),
        attempt_count=len(s.attempts_of(row.student_id)),
        can_grant=service.can_grant(s, row.student_id),
    )


async def _out(db: AsyncSession, s: ExamSession) -> ExamSessionOut:
    counts = await service.signal_counts(db, s)
    students = sorted(s.students, key=lambda row: (row.student.name.lower(), str(row.student_id)))
    return ExamSessionOut(
        id=s.id,
        exam_id=s.exam_id,
        owner_name=s.owner.name,
        title=s.title,
        minutes=s.minutes,
        question_count=len(s.questions),
        status=s.status,  # type: ignore[arg-type]
        opened_at=s.opened_at,
        closed_at=s.closed_at,
        groups=[
            SessionGroupOut(id=g.id, name=g.name) for g in sorted(s.groups, key=lambda g: g.name.lower())
        ],
        students=[_student(s, row, counts) for row in students],
    )


def _summary(s: ExamSession) -> ExamSessionSummary:
    return ExamSessionSummary(
        id=s.id,
        owner_name=s.owner.name,
        title=s.title,
        status=s.status,  # type: ignore[arg-type]
        opened_at=s.opened_at,
        closed_at=s.closed_at,
        group_names=sorted((g.name for g in s.groups), key=str.lower),
        student_count=len(s.students),
        absent_count=sum(1 for row in s.students if row.attendance == "absent"),
    )


@router.get("", response_model=list[ExamSessionSummary], response_model_by_alias=True)
async def list_sessions(user: StaffUser, session: Session) -> list[ExamSessionSummary]:
    return [_summary(s) for s in await service.list_owned(session, user)]


@router.post("", status_code=201, response_model=ExamSessionOut, response_model_by_alias=True)
async def start_session(body: ExamSessionIn, user: TeacherUser, session: Session) -> ExamSessionOut:
    return await _out(session, await service.create(session, user, body))


@router.get("/{session_id}", response_model=ExamSessionOut, response_model_by_alias=True)
async def get_session(session_id: uuid.UUID, user: StaffUser, session: Session) -> ExamSessionOut:
    return await _out(session, await service.get_viewable(session, user, session_id))


@router.put(
    "/{session_id}/students/{student_id}", response_model=ExamSessionOut, response_model_by_alias=True
)
async def set_attendance(
    session_id: uuid.UUID, student_id: uuid.UUID, body: AttendanceChange, user: StaffUser, session: Session
) -> ExamSessionOut:
    return await _out(session, await service.set_attendance(session, user, session_id, student_id, body))


@router.post("/{session_id}/close", response_model=ExamSessionOut, response_model_by_alias=True)
async def close_session(session_id: uuid.UUID, user: StaffUser, session: Session) -> ExamSessionOut:
    return await _out(session, await service.close(session, user, session_id))


def _attempt(s: ExamSession, attempt: ExamAttempt, number: int, events: list) -> AttemptOut:
    counts: dict[str, int] = {}
    for e in events:
        counts[e.kind] = counts.get(e.kind, 0) + 1
    current = s.attempt_of(attempt.student_id)
    return AttemptOut(
        id=attempt.id,
        number=number,
        active=attempt.active,
        counts=current is not None and current.id == attempt.id,
        attempt_state=_state(attempt),
        started_at=attempt.started_at,
        submitted_at=attempt.submitted_at,
        submit_reason=attempt.submit_reason,  # type: ignore[arg-type]
        score=exam_attempts.final_score(s, attempt),
        raw_score=attempt.score,
        decision=attempt.decision,  # type: ignore[arg-type]
        question_decisions=attempt.question_decisions,  # type: ignore[arg-type]
        suspect=_suspect(counts),
        questions=[
            ResultQuestionOut(
                id=q["id"],
                text=q["text"],
                answers=q["answers"],
                image=q.get("image"),
                correct=q["correct"],
                chosen=attempt.answers.get(q["id"]),
                counted=exam_attempts.counted(attempt, q["id"]),
            )
            for q in s.questions
        ],
        signals=[SignalOut(kind=e.kind, question_id=e.question_id, at=e.at) for e in events],
    )


@router.get(
    "/{session_id}/students/{student_id}", response_model=AttemptDetailOut, response_model_by_alias=True
)
async def attempt_detail(
    session_id: uuid.UUID, student_id: uuid.UUID, user: StaffUser, session: Session
) -> AttemptDetailOut:
    """One student's attempts, answers and screen signals: for the exam's teacher or an admin."""
    s, row, events = await service.attempt_detail(session, user, session_id, student_id)
    audit = await service.history(session, session_id, student_id)
    attempts = s.attempts_of(student_id)
    return AttemptDetailOut(
        student_id=row.student_id,
        name=row.student.name,
        total=len(s.questions),
        attempts=[_attempt(s, a, i + 1, events[a.id]) for i, a in enumerate(attempts)],
        history=[
            AuditOut(actor_name=a.actor.name, at=a.at, action=a.action, before=a.before, after=a.after)
            for a in audit
        ],
    )


@router.post(
    "/{session_id}/students/{student_id}/grant", response_model=ExamSessionOut, response_model_by_alias=True
)
async def grant(
    session_id: uuid.UUID, student_id: uuid.UUID, user: StaffUser, session: Session
) -> ExamSessionOut:
    """One more attempt for the student. Logged."""
    return await _out(session, await service.grant(session, user, session_id, student_id))


@router.put(
    "/{session_id}/students/{student_id}/decision",
    response_model=ExamSessionOut,
    response_model_by_alias=True,
)
async def decide(
    session_id: uuid.UUID, student_id: uuid.UUID, body: DecisionIn, user: StaffUser, session: Session
) -> ExamSessionOut:
    """Mercy, zero, or per question: changeable any time, audited."""
    return await _out(session, await service.decide(session, user, session_id, student_id, body))


@admin_router.get("", response_model=list[ExamSessionSummary], response_model_by_alias=True)
async def admin_list(_: AdminUser, session: Session) -> list[ExamSessionSummary]:
    """Every exam, read-only: admins don't run exams."""
    return [_summary(s) for s in await service.list_all(session)]


attempts_admin_router = APIRouter(prefix="/admin/exam-attempts", tags=["admin"])


@attempts_admin_router.post(
    "/{attempt_id}/inactivate", response_model=ExamSessionOut, response_model_by_alias=True
)
async def inactivate(attempt_id: uuid.UUID, admin: AdminUser, session: Session) -> ExamSessionOut:
    """Admins only: the attempt is kept and shown, but no longer counts. Logged."""
    return await _out(session, await service.inactivate(session, admin, attempt_id))
