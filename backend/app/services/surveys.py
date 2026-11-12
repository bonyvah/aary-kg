import random
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models.group import Group
from app.models.survey import Survey, SurveyResponse, SurveyStudent
from app.models.user import User
from app.repositories import surveys as repo
from app.schemas.survey import QuestionResult, SurveyIn
from app.services import survey_sheets

_shuffle = random.SystemRandom().shuffle


async def create(session: AsyncSession, owner: User, payload: SurveyIn) -> Survey:
    """Starts a survey for the active students of the groups, with a copy of the sheet. Open at once."""
    sheet = await survey_sheets.get(session, payload.sheet_id)
    groups = list((await session.execute(select(Group).where(Group.id.in_(payload.group_ids)))).scalars())
    if len(groups) != len(payload.group_ids):
        raise ApiError(404, "GROUP_NOT_FOUND", field="groupIds")
    students = await session.execute(
        select(User.id).where(
            User.group_id.in_(payload.group_ids), User.role == "student", User.active.is_(True)
        )
    )
    ids = list(students.scalars())
    if not ids:
        raise ApiError(400, "SURVEY_NO_STUDENTS", field="groupIds")
    survey = Survey(
        sheet_id=sheet.id,
        owner_id=owner.id,
        title=sheet.title,
        questions=list(sheet.questions),
        status="open",
        groups=groups,
        students=[SurveyStudent(student_id=i) for i in ids],
    )
    session.add(survey)
    await session.commit()
    return await get(session, survey.id)


async def get(session: AsyncSession, survey_id: uuid.UUID) -> Survey:
    survey = await repo.get(session, survey_id)
    if not survey:
        raise ApiError(404, "SURVEY_NOT_FOUND")
    return survey


async def close(session: AsyncSession, survey_id: uuid.UUID) -> Survey:
    survey = await get(session, survey_id)
    if survey.status != "closed":
        survey.status = "closed"
        survey.closed_at = datetime.now(UTC)
        await session.commit()
    return await get(session, survey_id)


async def reopen(session: AsyncSession, survey_id: uuid.UUID) -> Survey:
    """Open again: students can answer and change their answers once more."""
    survey = await get(session, survey_id)
    if survey.status != "open":
        survey.status = "open"
        survey.closed_at = None
        await session.commit()
    return await get(session, survey_id)


async def delete(session: AsyncSession, survey_id: uuid.UUID) -> None:
    """Gone for good, open or closed, with its answers, its groups and its student list."""
    survey = await get(session, survey_id)
    await session.delete(survey)
    await session.commit()


def results(questions: list[dict[str, Any]], responses: list[SurveyResponse]) -> list[QuestionResult]:
    """Per question: how many answered it, the count of each choice, or the open answers shuffled."""
    out: list[QuestionResult] = []
    for q in questions:
        given = [r.answers[q["id"]] for r in responses if q["id"] in r.answers]
        if q["kind"] == "open":
            texts = [str(t) for t in given]
            _shuffle(texts)
            out.append(QuestionResult.model_validate({"question": q, "answered": len(given), "texts": texts}))
            continue
        counts = [0] * len(q["choices"])
        for answer in given:
            for choice in answer if isinstance(answer, list) else [answer]:
                counts[choice - 1] += 1
        out.append(QuestionResult.model_validate({"question": q, "answered": len(given), "counts": counts}))
    return out
