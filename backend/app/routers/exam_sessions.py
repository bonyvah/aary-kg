import uuid

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import AdminUser, Session, StaffUser, TeacherUser
from app.models.exam_session import ExamAttempt, ExamSession, ExamSessionStudent
from app.schemas.exam_session import (
    AttemptDetailOut,
    AttemptState,
    AttendanceChange,
    ExamSessionIn,
    ExamSessionOut,
    ExamSessionSummary,
    ResultQuestionOut,
    SessionGroupOut,
    SessionStudentOut,
    SignalCount,
    SignalOut,
)
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


def _student(s: ExamSession, row: ExamSessionStudent, counts: dict) -> SessionStudentOut:
    attempt = s.attempt_of(row.student_id)
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
        score=attempt.score if attempt else None,
        signals=_signals(counts.get(attempt.id, {})) if attempt else [],
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


@router.get(
    "/{session_id}/students/{student_id}", response_model=AttemptDetailOut, response_model_by_alias=True
)
async def attempt_detail(
    session_id: uuid.UUID, student_id: uuid.UUID, user: StaffUser, session: Session
) -> AttemptDetailOut:
    """One student's answers and screen signals, for the teacher who started the exam or an admin."""
    s, row, attempt, events = await service.attempt_detail(session, user, session_id, student_id)
    answers = attempt.answers if attempt else {}
    return AttemptDetailOut(
        student_id=row.student_id,
        name=row.student.name,
        attempt_state=_state(attempt),
        started_at=attempt.started_at if attempt else None,
        submitted_at=attempt.submitted_at if attempt else None,
        submit_reason=attempt.submit_reason if attempt else None,  # type: ignore[arg-type]
        score=attempt.score if attempt else None,
        total=len(s.questions),
        questions=[
            ResultQuestionOut(
                id=q["id"],
                text=q["text"],
                answers=q["answers"],
                correct=q["correct"],
                chosen=answers.get(q["id"]),
            )
            for q in s.questions
        ],
        signals=[SignalOut(kind=e.kind, question_id=e.question_id, at=e.at) for e in events],
    )


@admin_router.get("", response_model=list[ExamSessionSummary], response_model_by_alias=True)
async def admin_list(_: AdminUser, session: Session) -> list[ExamSessionSummary]:
    """Every exam, read-only: admins don't run exams."""
    return [_summary(s) for s in await service.list_all(session)]
