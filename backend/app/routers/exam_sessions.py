import uuid

from fastapi import APIRouter

from app.deps import Session, StaffUser, TeacherUser
from app.models.exam_session import ExamSession
from app.repositories import exam_sessions as repo
from app.schemas.exam_session import (
    AttendanceChange,
    ExamSessionIn,
    ExamSessionOut,
    ExamSessionSummary,
    SessionGroupOut,
    SessionStudentOut,
)
from app.services import exam_sessions as service

router = APIRouter(prefix="/exam-sessions", tags=["exam-sessions"])


def _out(s: ExamSession) -> ExamSessionOut:
    students = sorted(s.students, key=lambda row: (row.student.name.lower(), str(row.student_id)))
    return ExamSessionOut(
        id=s.id,
        exam_id=s.exam_id,
        title=s.title,
        minutes=s.minutes,
        question_count=len(s.questions),
        status=s.status,  # type: ignore[arg-type]
        opened_at=s.opened_at,
        closed_at=s.closed_at,
        groups=[
            SessionGroupOut(id=g.id, name=g.name) for g in sorted(s.groups, key=lambda g: g.name.lower())
        ],
        students=[
            SessionStudentOut(
                student_id=row.student_id,
                name=row.student.name,
                group_name=row.student.group_name,
                attendance=row.attendance,  # type: ignore[arg-type]
                late_minutes=row.late_minutes,
            )
            for row in students
        ],
    )


def _summary(s: ExamSession) -> ExamSessionSummary:
    return ExamSessionSummary(
        id=s.id,
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
    return [_summary(s) for s in await repo.list_for_owner(session, user.id)]


@router.post("", status_code=201, response_model=ExamSessionOut, response_model_by_alias=True)
async def start_session(body: ExamSessionIn, user: TeacherUser, session: Session) -> ExamSessionOut:
    return _out(await service.create(session, user, body))


@router.get("/{session_id}", response_model=ExamSessionOut, response_model_by_alias=True)
async def get_session(session_id: uuid.UUID, user: StaffUser, session: Session) -> ExamSessionOut:
    return _out(await service.get_owned(session, user, session_id))


@router.put(
    "/{session_id}/students/{student_id}", response_model=ExamSessionOut, response_model_by_alias=True
)
async def set_attendance(
    session_id: uuid.UUID, student_id: uuid.UUID, body: AttendanceChange, user: StaffUser, session: Session
) -> ExamSessionOut:
    return _out(await service.set_attendance(session, user, session_id, student_id, body))


@router.post("/{session_id}/close", response_model=ExamSessionOut, response_model_by_alias=True)
async def close_session(session_id: uuid.UUID, user: StaffUser, session: Session) -> ExamSessionOut:
    return _out(await service.close(session, user, session_id))
