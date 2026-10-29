import uuid
from datetime import datetime

from fastapi import APIRouter

from app.deps import Session, TeacherUser
from app.errors import ApiError
from app.models.quiz import Quiz
from app.repositories import quizzes as repo
from app.schemas.base import CamelModel
from app.schemas.quiz import Question, QuizOut

router = APIRouter(prefix="/quiz-library", tags=["quizzes"])


class LibraryQuizSummary(CamelModel):
    id: uuid.UUID
    title: str
    image: str | None
    question_count: int
    owner_name: str
    updated_at: datetime


class LibraryQuizOut(CamelModel):
    id: uuid.UUID
    title: str
    image: str | None
    owner_name: str
    questions: list[Question]


async def _shared(session: Session, quiz_id: uuid.UUID) -> Quiz:
    """Any teacher's quiz, by its link: the owner's own link opens too. Not a deleted one."""
    quiz = await repo.get(session, quiz_id)
    if quiz is None or quiz.deleted_at is not None:
        raise ApiError(404, "QUIZ_NOT_FOUND")
    return quiz


@router.get("", response_model=list[LibraryQuizSummary], response_model_by_alias=True)
async def library(user: TeacherUser, session: Session) -> list[LibraryQuizSummary]:
    """Every other teacher's quiz, newest first: to read, host and copy."""
    return [
        LibraryQuizSummary(
            id=q.id,
            title=q.title,
            image=q.image,
            question_count=len(q.questions),
            owner_name=q.owner.name,
            updated_at=q.updated_at,
        )
        for q in await repo.list_others(session, user.id)
    ]


@router.get("/{quiz_id}", response_model=LibraryQuizOut, response_model_by_alias=True)
async def read(quiz_id: uuid.UUID, user: TeacherUser, session: Session) -> LibraryQuizOut:
    quiz = await _shared(session, quiz_id)
    return LibraryQuizOut(
        id=quiz.id, title=quiz.title, image=quiz.image, owner_name=quiz.owner.name, questions=quiz.questions
    )


@router.post("/{quiz_id}/copy", status_code=201, response_model=QuizOut, response_model_by_alias=True)
async def copy(quiz_id: uuid.UUID, user: TeacherUser, session: Session) -> QuizOut:
    """A copy among one's own quizzes: later edits on either side stay apart."""
    original = await _shared(session, quiz_id)
    quiz = Quiz(
        owner_id=user.id,
        title=original.title,
        status="ready",
        image=original.image,
        questions=[dict(q) for q in original.questions],
    )
    session.add(quiz)
    await session.commit()
    return QuizOut.model_validate(quiz)
