import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models.quiz import Quiz
from app.models.user import User
from app.repositories import quizzes as repo
from app.schemas.quiz import QuizIn


def find_issues(payload: QuizIn) -> list[dict[str, str]]:
    """Blank fields, reported with the same keys the editor uses: title, <id>:text, <id>:answer:<n>."""
    issues: list[dict[str, str]] = []
    if not payload.title.strip():
        issues.append({"code": "FIELD_REQUIRED", "field": "title"})
    for q in payload.questions:
        if not q.text.strip():
            issues.append({"code": "FIELD_REQUIRED", "field": f"{q.id}:text"})
        for position, answer in enumerate(q.answers, start=1):
            if not answer.strip():
                issues.append({"code": "FIELD_REQUIRED", "field": f"{q.id}:answer:{position}"})
    return issues


def _questions(payload: QuizIn) -> list[dict[str, object]]:
    return [q.model_dump() for q in payload.questions]


def _check(payload: QuizIn) -> None:
    issues = find_issues(payload)
    if issues:
        raise ApiError(400, "QUIZ_INVALID", issues=issues)


async def create(session: AsyncSession, owner: User, payload: QuizIn) -> Quiz:
    if owner.role == "admin":
        raise ApiError(403, "FORBIDDEN")  # admins manage the platform; quizzes are the users' own
    _check(payload)
    quiz = Quiz(
        owner_id=owner.id,
        title=payload.title.strip(),
        status="ready",
        questions=_questions(payload),
    )
    session.add(quiz)
    await session.commit()
    return quiz


async def get_editable(session: AsyncSession, user: User, quiz_id: uuid.UUID) -> Quiz:
    """Only the owner: not even an admin edits somebody's quiz. Anyone else gets the same answer as for
    a quiz that doesn't exist."""
    quiz = await repo.get(session, quiz_id)
    if not quiz or quiz.owner_id != user.id:
        raise ApiError(404, "QUIZ_NOT_FOUND")
    return quiz


async def update(session: AsyncSession, user: User, quiz_id: uuid.UUID, payload: QuizIn) -> Quiz:
    quiz = await get_editable(session, user, quiz_id)
    _check(payload)
    quiz.title = payload.title.strip()
    quiz.questions = _questions(payload)
    await session.commit()
    return quiz
