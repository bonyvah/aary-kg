import uuid

from fastapi import APIRouter, Response

from app.deps import Session, StudentUser
from app.models.exam_session import ExamAttempt, ExamSession
from app.models.user import User
from app.schemas.exam_session import (
    AnswerIn,
    ResultQuestionOut,
    SignalIn,
    StudentAttemptOut,
    StudentExamOut,
    StudentQuestionOut,
    StudentResultOut,
)
from app.services import exam_attempts as service

router = APIRouter(prefix="/student/exams", tags=["student-exams"])


def _result(s: ExamSession, attempt: ExamAttempt | None, *, with_questions: bool) -> StudentResultOut | None:
    """Nothing about the answers before the exam is closed."""
    if attempt is None or attempt.score is None or s.status != "closed":
        return None
    questions = [
        ResultQuestionOut(
            id=q["id"],
            text=q["text"],
            answers=q["answers"],
            correct=q["correct"],
            chosen=attempt.answers.get(q["id"]),
            counted=service.counted(attempt, q["id"]),
        )
        for q in s.questions
    ]
    return StudentResultOut(
        score=service.final_score(s, attempt) or 0,
        total=len(s.questions),
        questions=questions if with_questions else [],
    )


def _out(s: ExamSession, student: User, *, with_questions: bool) -> StudentExamOut:
    attempt = s.attempt_of(student.id)
    running = attempt is not None and attempt.submitted_at is None and s.status == "open"
    attempt_out = None
    if attempt is not None:
        left = (attempt.deadline_at - service.now()).total_seconds() if running else 0
        attempt_out = StudentAttemptOut(
            state="in_progress" if running else "submitted",
            started_at=attempt.started_at,
            deadline_at=attempt.deadline_at,
            submitted_at=attempt.submitted_at,
            seconds_left=max(0, int(left)),
            answers=attempt.answers if running else {},
        )
    return StudentExamOut(
        id=s.id,
        title=s.title,
        minutes=s.minutes,
        question_count=len(s.questions),
        status=s.status,  # type: ignore[arg-type]
        opened_at=s.opened_at,
        closed_at=s.closed_at,
        attendance=service.attendance_of(s, student.id),  # type: ignore[arg-type]
        attempt=attempt_out,
        can_start=s.can_start(student.id),
        questions=[StudentQuestionOut(id=q["id"], text=q["text"], answers=q["answers"]) for q in s.questions]
        if running and with_questions
        else None,
        result=_result(s, attempt, with_questions=with_questions),
    )


@router.get("", response_model=list[StudentExamOut], response_model_by_alias=True)
async def list_exams(user: StudentUser, session: Session) -> list[StudentExamOut]:
    return [_out(s, user, with_questions=False) for s in await service.list_for_student(session, user)]


@router.get("/{session_id}", response_model=StudentExamOut, response_model_by_alias=True)
async def get_exam(session_id: uuid.UUID, user: StudentUser, session: Session) -> StudentExamOut:
    return _out(await service.get_listed(session, user, session_id), user, with_questions=True)


@router.post("/{session_id}/start", response_model=StudentExamOut, response_model_by_alias=True)
async def start(session_id: uuid.UUID, user: StudentUser, session: Session) -> StudentExamOut:
    return _out(await service.start(session, user, session_id), user, with_questions=True)


@router.put(
    "/{session_id}/answers/{question_id}", response_model=StudentExamOut, response_model_by_alias=True
)
async def answer(
    session_id: uuid.UUID, question_id: str, body: AnswerIn, user: StudentUser, session: Session
) -> StudentExamOut:
    exam_session = await service.answer(session, user, session_id, question_id, body.answer)
    return _out(exam_session, user, with_questions=False)


@router.post("/{session_id}/submit", response_model=StudentExamOut, response_model_by_alias=True)
async def submit(session_id: uuid.UUID, user: StudentUser, session: Session) -> StudentExamOut:
    return _out(await service.submit(session, user, session_id), user, with_questions=False)


@router.post("/{session_id}/signals", status_code=204)
async def signal(session_id: uuid.UUID, body: SignalIn, user: StudentUser, session: Session) -> Response:
    await service.signal(session, user, session_id, body.kind, body.question_id)
    return Response(status_code=204)
