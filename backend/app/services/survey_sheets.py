import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models.survey import SurveySheet
from app.models.user import User
from app.repositories import surveys as repo
from app.schemas.survey import MultiQuestion, OpenQuestion, SurveySheetIn


def find_issues(payload: SurveySheetIn) -> list[dict[str, str]]:
    """What is wrong, with the editor's keys: title, <id>:text, <id>:choice:<n>, <id>:limit.

    Blank text is FIELD_REQUIRED. A multiple-select limit above the number of choices is LIMIT_TOO_HIGH.
    """
    issues: list[dict[str, str]] = []
    if not payload.title.strip():
        issues.append({"code": "FIELD_REQUIRED", "field": "title"})
    for q in payload.questions:
        if not q.text.strip():
            issues.append({"code": "FIELD_REQUIRED", "field": f"{q.id}:text"})
        if isinstance(q, OpenQuestion):
            continue
        issues.extend(
            {"code": "FIELD_REQUIRED", "field": f"{q.id}:choice:{n}"}
            for n, choice in enumerate(q.choices, start=1)
            if not choice.strip()
        )
        if isinstance(q, MultiQuestion) and q.limit.n is not None and q.limit.n > len(q.choices):
            issues.append({"code": "LIMIT_TOO_HIGH", "field": f"{q.id}:limit"})
    return issues


def _check(payload: SurveySheetIn) -> None:
    issues = find_issues(payload)
    if issues:
        raise ApiError(400, "SURVEY_INVALID", issues=issues)


def _questions(payload: SurveySheetIn) -> list[dict[str, object]]:
    return [q.model_dump() for q in payload.questions]


async def create(session: AsyncSession, owner: User, payload: SurveySheetIn) -> SurveySheet:
    _check(payload)
    sheet = SurveySheet(owner_id=owner.id, title=payload.title.strip(), questions=_questions(payload))
    session.add(sheet)
    await session.commit()
    return sheet


async def get(session: AsyncSession, sheet_id: uuid.UUID) -> SurveySheet:
    sheet = await repo.get_sheet(session, sheet_id)
    if not sheet or sheet.deleted_at is not None:
        raise ApiError(404, "SURVEY_NOT_FOUND")
    return sheet


async def update(session: AsyncSession, sheet_id: uuid.UUID, payload: SurveySheetIn) -> SurveySheet:
    """Always allowed: a survey copies the questions when it starts."""
    sheet = await get(session, sheet_id)
    _check(payload)
    sheet.title = payload.title.strip()
    sheet.questions = _questions(payload)
    await session.commit()
    return sheet


async def delete(session: AsyncSession, sheet_id: uuid.UUID) -> None:
    sheet = await get(session, sheet_id)
    await session.delete(sheet)
    await session.commit()
