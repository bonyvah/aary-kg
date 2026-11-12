import uuid

from fastapi import APIRouter, Response

from app.deps import AdminUser, Session
from app.models.survey import SurveySheet
from app.repositories import surveys as repo
from app.schemas.survey import SurveySheetIn, SurveySheetOut, SurveySheetSummary
from app.services import survey_sheets as service

router = APIRouter(prefix="/admin/survey-sheets", tags=["surveys"])


def _summary(sheet: SurveySheet) -> SurveySheetSummary:
    return SurveySheetSummary(id=sheet.id, title=sheet.title, question_count=len(sheet.questions))


@router.get("", response_model=list[SurveySheetSummary], response_model_by_alias=True)
async def list_sheets(_: AdminUser, session: Session) -> list[SurveySheetSummary]:
    return [_summary(s) for s in await repo.list_sheets(session)]


@router.post("", status_code=201, response_model=SurveySheetOut, response_model_by_alias=True)
async def create_sheet(body: SurveySheetIn, user: AdminUser, session: Session) -> SurveySheetOut:
    return SurveySheetOut.model_validate(await service.create(session, user, body))


@router.get("/{sheet_id}", response_model=SurveySheetOut, response_model_by_alias=True)
async def get_sheet(sheet_id: uuid.UUID, _: AdminUser, session: Session) -> SurveySheetOut:
    return SurveySheetOut.model_validate(await service.get(session, sheet_id))


@router.put("/{sheet_id}", response_model=SurveySheetOut, response_model_by_alias=True)
async def update_sheet(
    sheet_id: uuid.UUID, body: SurveySheetIn, _: AdminUser, session: Session
) -> SurveySheetOut:
    return SurveySheetOut.model_validate(await service.update(session, sheet_id, body))


@router.delete("/{sheet_id}", status_code=204)
async def delete_sheet(sheet_id: uuid.UUID, _: AdminUser, session: Session) -> Response:
    await service.delete(session, sheet_id)
    return Response(status_code=204)
