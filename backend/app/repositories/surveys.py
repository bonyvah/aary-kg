import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.survey import Survey, SurveyRespondent, SurveyResponse, SurveySheet, SurveyStudent
from app.models.user import User


async def get_sheet(session: AsyncSession, sheet_id: uuid.UUID) -> SurveySheet | None:
    return await session.get(SurveySheet, sheet_id)


async def list_sheets(session: AsyncSession) -> list[SurveySheet]:
    """Every admin's sheets: the admins run the surveys together."""
    result = await session.execute(
        select(SurveySheet).where(SurveySheet.deleted_at.is_(None)).order_by(SurveySheet.updated_at.desc())
    )
    return list(result.scalars())


async def get(session: AsyncSession, survey_id: uuid.UUID) -> Survey | None:
    survey = await session.get(Survey, survey_id, populate_existing=True)
    return survey if survey and survey.deleted_at is None else None


async def list_all(session: AsyncSession) -> list[Survey]:
    result = await session.execute(
        select(Survey).where(Survey.deleted_at.is_(None)).order_by(Survey.opened_at.desc())
    )
    return list(result.scalars())


async def respondent_counts(session: AsyncSession, survey_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not survey_ids:
        return {}
    rows = await session.execute(
        select(SurveyRespondent.survey_id, func.count())
        .where(SurveyRespondent.survey_id.in_(survey_ids))
        .group_by(SurveyRespondent.survey_id)
    )
    return {survey_id: n for survey_id, n in rows}


async def responses(session: AsyncSession, survey_id: uuid.UUID) -> list[SurveyResponse]:
    result = await session.execute(select(SurveyResponse).where(SurveyResponse.survey_id == survey_id))
    return list(result.scalars())


async def sheet_used(session: AsyncSession, sheet_id: uuid.UUID) -> bool:
    found = await session.scalar(select(func.count()).select_from(Survey).where(Survey.sheet_id == sheet_id))
    return bool(found)


async def list_for_student(session: AsyncSession, student_id: uuid.UUID) -> list[Survey]:
    result = await session.execute(
        select(Survey)
        .join(SurveyStudent, SurveyStudent.survey_id == Survey.id)
        .where(SurveyStudent.student_id == student_id, Survey.deleted_at.is_(None))
        .order_by(Survey.opened_at.desc())
    )
    return list(result.scalars())


async def answered_by(
    session: AsyncSession, student_id: uuid.UUID, survey_ids: list[uuid.UUID]
) -> set[uuid.UUID]:
    if not survey_ids:
        return set()
    result = await session.execute(
        select(SurveyRespondent.survey_id).where(
            SurveyRespondent.student_id == student_id, SurveyRespondent.survey_id.in_(survey_ids)
        )
    )
    return set(result.scalars())


async def own_response(
    session: AsyncSession, survey_id: uuid.UUID, student_id: uuid.UUID
) -> SurveyResponse | None:
    result = await session.execute(
        select(SurveyResponse).where(
            SurveyResponse.survey_id == survey_id, SurveyResponse.student_id == student_id
        )
    )
    return result.scalar_one_or_none()


async def students_with_status(session: AsyncSession, survey_id: uuid.UUID) -> list[tuple[User, bool]]:
    """Every student the survey was for, with whether they answered, sorted by name."""
    done = await session.execute(
        select(SurveyRespondent.student_id).where(SurveyRespondent.survey_id == survey_id)
    )
    answered = set(done.scalars())
    users = await session.execute(
        select(User)
        .join(SurveyStudent, SurveyStudent.student_id == User.id)
        .where(SurveyStudent.survey_id == survey_id)
    )
    rows = [(u, u.id in answered) for u in users.scalars()]
    return sorted(rows, key=lambda r: r[0].name.casefold())
