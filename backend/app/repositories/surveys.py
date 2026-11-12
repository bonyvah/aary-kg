import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.survey import Survey, SurveyRespondent, SurveyResponse, SurveySheet


async def get_sheet(session: AsyncSession, sheet_id: uuid.UUID) -> SurveySheet | None:
    return await session.get(SurveySheet, sheet_id)


async def list_sheets(session: AsyncSession) -> list[SurveySheet]:
    """Every admin's sheets: the admins run the surveys together."""
    result = await session.execute(
        select(SurveySheet).where(SurveySheet.deleted_at.is_(None)).order_by(SurveySheet.updated_at.desc())
    )
    return list(result.scalars())


async def get(session: AsyncSession, survey_id: uuid.UUID) -> Survey | None:
    return await session.get(Survey, survey_id, populate_existing=True)


async def list_all(session: AsyncSession) -> list[Survey]:
    result = await session.execute(select(Survey).order_by(Survey.opened_at.desc()))
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
