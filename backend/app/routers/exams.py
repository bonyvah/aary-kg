import uuid

from fastapi import APIRouter

from app.deps import Session, StaffUser, TeacherUser
from app.models.exam import Exam
from app.repositories import exams as repo
from app.schemas.exam import ExamIn, ExamOut, ExamSummary
from app.services import exams as service

router = APIRouter(prefix="/exams", tags=["exams"])


def _summary(exam: Exam) -> ExamSummary:
    return ExamSummary(id=exam.id, title=exam.title, minutes=exam.minutes, question_count=len(exam.questions))


@router.get("", response_model=list[ExamSummary], response_model_by_alias=True)
async def list_exams(user: StaffUser, session: Session) -> list[ExamSummary]:
    return [_summary(e) for e in await repo.list_for_owner(session, user.id)]


@router.post("", status_code=201, response_model=ExamOut, response_model_by_alias=True)
async def create_exam(body: ExamIn, user: TeacherUser, session: Session) -> ExamOut:
    return ExamOut.model_validate(await service.create(session, user, body))


@router.get("/{exam_id}", response_model=ExamOut, response_model_by_alias=True)
async def get_exam(exam_id: uuid.UUID, user: StaffUser, session: Session) -> ExamOut:
    return ExamOut.model_validate(await service.get_editable(session, user, exam_id))


@router.put("/{exam_id}", response_model=ExamOut, response_model_by_alias=True)
async def update_exam(exam_id: uuid.UUID, body: ExamIn, user: StaffUser, session: Session) -> ExamOut:
    return ExamOut.model_validate(await service.update(session, user, exam_id, body))
