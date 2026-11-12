import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.survey import SurveySheet


async def get_sheet(session: AsyncSession, sheet_id: uuid.UUID) -> SurveySheet | None:
    return await session.get(SurveySheet, sheet_id)


async def list_sheets(session: AsyncSession) -> list[SurveySheet]:
    """Every admin's sheets: the admins run the surveys together."""
    result = await session.execute(
        select(SurveySheet).where(SurveySheet.deleted_at.is_(None)).order_by(SurveySheet.updated_at.desc())
    )
    return list(result.scalars())
