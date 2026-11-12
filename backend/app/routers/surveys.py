import uuid

from fastapi import APIRouter

from app.deps import AdminUser, OverseerUser, Session
from app.models.survey import Survey
from app.repositories import surveys as repo
from app.schemas.survey import SurveyGroupOut, SurveyIn, SurveyOut, SurveyStudentOut, SurveySummary
from app.services import surveys as service

# Admins run surveys; the superadmin sees them read-only.
admin_router = APIRouter(prefix="/admin/surveys", tags=["surveys"])


def _summary(survey: Survey, answered: int) -> dict[str, object]:
    return {
        "id": survey.id,
        "title": survey.title,
        "status": survey.status,
        "opened_at": survey.opened_at,
        "closed_at": survey.closed_at,
        "group_names": sorted(g.name for g in survey.groups),
        "student_count": len(survey.students),
        "answered_count": answered,
    }


async def _out(session: Session, survey: Survey) -> SurveyOut:
    answered = (await repo.respondent_counts(session, [survey.id])).get(survey.id, 0)
    responses = await repo.responses(session, survey.id)
    return SurveyOut(
        **_summary(survey, answered),  # type: ignore[arg-type]
        sheet_id=survey.sheet_id,
        groups=[SurveyGroupOut(id=g.id, name=g.name) for g in sorted(survey.groups, key=lambda g: g.name)],
        results=service.results(survey.questions, responses),
        students=[
            SurveyStudentOut(id=u.id, name=u.name, group_name=u.group_name, answered=done)
            for u, done in await repo.students_with_status(session, survey.id)
        ],
    )


@admin_router.get("", response_model=list[SurveySummary], response_model_by_alias=True)
async def list_surveys(_: OverseerUser, session: Session) -> list[SurveySummary]:
    surveys = await repo.list_all(session)
    counts = await repo.respondent_counts(session, [s.id for s in surveys])
    return [SurveySummary.model_validate(_summary(s, counts.get(s.id, 0))) for s in surveys]


@admin_router.post("", status_code=201, response_model=SurveyOut, response_model_by_alias=True)
async def start_survey(body: SurveyIn, user: AdminUser, session: Session) -> SurveyOut:
    return await _out(session, await service.create(session, user, body))


@admin_router.get("/{survey_id}", response_model=SurveyOut, response_model_by_alias=True)
async def get_survey(survey_id: uuid.UUID, _: OverseerUser, session: Session) -> SurveyOut:
    return await _out(session, await service.get(session, survey_id))


@admin_router.post("/{survey_id}/close", response_model=SurveyOut, response_model_by_alias=True)
async def close_survey(survey_id: uuid.UUID, _: AdminUser, session: Session) -> SurveyOut:
    return await _out(session, await service.close(session, survey_id))
