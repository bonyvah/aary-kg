import uuid
from typing import Any

from fastapi import APIRouter

from app.deps import Session, StudentUser
from app.models.survey import Survey
from app.repositories import surveys as repo
from app.schemas.survey import StudentSurveyOut, SurveySubmitIn
from app.services import survey_answers as service

router = APIRouter(prefix="/student/surveys", tags=["student-surveys"])


def _out(
    survey: Survey, answered: bool, *, with_questions: bool, answers: dict[str, Any] | None = None
) -> StudentSurveyOut:
    # An answered survey stays open to change until it is closed.
    open_to_answer = survey.status == "open"
    return StudentSurveyOut.model_validate(
        {
            "id": survey.id,
            "title": survey.title,
            "status": survey.status,
            "opened_at": survey.opened_at,
            "closed_at": survey.closed_at,
            "question_count": len(survey.questions),
            "answered": answered,
            "questions": survey.questions if open_to_answer and with_questions else None,
            "answers": answers if open_to_answer and with_questions else None,
        }
    )


@router.get("", response_model=list[StudentSurveyOut], response_model_by_alias=True)
async def list_surveys(user: StudentUser, session: Session) -> list[StudentSurveyOut]:
    surveys = await repo.list_for_student(session, user.id)
    answered = await repo.answered_by(session, user.id, [s.id for s in surveys])
    return [_out(s, s.id in answered, with_questions=False) for s in surveys]


@router.get("/{survey_id}", response_model=StudentSurveyOut, response_model_by_alias=True)
async def get_survey(survey_id: uuid.UUID, user: StudentUser, session: Session) -> StudentSurveyOut:
    survey = await service.get_listed(session, user, survey_id)
    answered = bool(await repo.answered_by(session, user.id, [survey.id]))
    own = await repo.own_response(session, survey.id, user.id)
    return _out(survey, answered, with_questions=True, answers=own.answers if own else None)


@router.post("/{survey_id}/submit", response_model=StudentSurveyOut, response_model_by_alias=True)
async def submit(
    survey_id: uuid.UUID, body: SurveySubmitIn, user: StudentUser, session: Session
) -> StudentSurveyOut:
    survey, _ = await service.submit(session, user, survey_id, body.answers)
    return _out(survey, True, with_questions=False)
