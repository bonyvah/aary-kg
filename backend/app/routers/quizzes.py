import uuid

from fastapi import APIRouter

from app.deps import CurrentUser, Session
from app.repositories import quizzes as repo
from app.schemas.quiz import QuizIn, QuizOut, QuizSummary
from app.services import quizzes as service

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


def _summary(quiz) -> QuizSummary:  # type: ignore[no-untyped-def]
    return QuizSummary(id=quiz.id, title=quiz.title, status=quiz.status, question_count=len(quiz.questions))


@router.get("", response_model=list[QuizSummary], response_model_by_alias=True)
async def list_quizzes(user: CurrentUser, session: Session) -> list[QuizSummary]:
    return [_summary(q) for q in await repo.list_for_owner(session, user.id)]


@router.post("", status_code=201, response_model=QuizOut, response_model_by_alias=True)
async def create_quiz(body: QuizIn, user: CurrentUser, session: Session) -> QuizOut:
    return QuizOut.model_validate(await service.create(session, user, body))


@router.get("/{quiz_id}", response_model=QuizOut, response_model_by_alias=True)
async def get_quiz(quiz_id: uuid.UUID, user: CurrentUser, session: Session) -> QuizOut:
    return QuizOut.model_validate(await service.get_editable(session, user, quiz_id))


@router.put("/{quiz_id}", response_model=QuizOut, response_model_by_alias=True)
async def update_quiz(quiz_id: uuid.UUID, body: QuizIn, user: CurrentUser, session: Session) -> QuizOut:
    return QuizOut.model_validate(await service.update(session, user, quiz_id, body))
