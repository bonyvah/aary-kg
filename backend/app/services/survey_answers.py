"""A student answers a survey: once, all at once, anonymously."""

import uuid
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models.survey import Survey, SurveyRespondent, SurveyResponse
from app.models.user import User
from app.repositories import surveys as repo
from app.schemas.survey import AnswerValue, max_chars


async def get_listed(session: AsyncSession, student: User, survey_id: uuid.UUID) -> Survey:
    """Only a survey the student is on. Any other gets the same answer as one that doesn't exist."""
    survey = await repo.get(session, survey_id)
    if not survey or all(s.student_id != student.id for s in survey.students):
        raise ApiError(404, "SURVEY_NOT_FOUND")
    return survey


def _issue(q: dict[str, Any], value: AnswerValue) -> tuple[str | None, Any]:
    """What is wrong with the answer to q (None if nothing), and the answer as it is stored."""
    if q["kind"] == "open":
        if not isinstance(value, str):
            return "ANSWER_INVALID", None
        text = value.strip()
        if len(text) > max_chars(q["max_words"]):
            return "TOO_LONG", None
        return None, text
    count = len(q["choices"])
    if q["kind"] == "single":
        if not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= count:
            return "ANSWER_INVALID", None
        return None, value
    if (
        not isinstance(value, list)
        or len(set(value)) != len(value)
        or not all(1 <= c <= count for c in value)
    ):
        return "ANSWER_INVALID", None
    limit = q["limit"]
    n = len(value)
    if value and limit["mode"] in ("min", "exact") and n < limit["n"]:
        return "TOO_FEW", None
    if limit["mode"] in ("max", "exact") and n > limit["n"]:
        return "TOO_MANY", None
    return None, sorted(value)


def check(questions: list[dict[str, Any]], answers: dict[str, AnswerValue]) -> dict[str, Any]:
    """The answers to store, or SURVEY_ANSWER_INVALID with an issue per question ({code, field: id}).

    A blank text or an empty selection is no answer: refused for a mandatory question, left out otherwise.
    """
    known = {q["id"] for q in questions}
    issues = [{"code": "ANSWER_INVALID", "field": qid} for qid in answers if qid not in known]
    stored: dict[str, Any] = {}
    for q in questions:
        code, value = (None, None) if q["id"] not in answers else _issue(q, answers[q["id"]])
        if code:
            issues.append({"code": code, "field": q["id"]})
        elif value not in (None, "", []):
            stored[q["id"]] = value
        elif q["required"]:
            issues.append({"code": "ANSWER_REQUIRED", "field": q["id"]})
    if issues:
        raise ApiError(400, "SURVEY_ANSWER_INVALID", issues=issues)
    return stored


async def submit(
    session: AsyncSession, student: User, survey_id: uuid.UUID, answers: dict[str, AnswerValue]
) -> Survey:
    survey = await get_listed(session, student, survey_id)
    if survey.status != "open":
        raise ApiError(409, "SURVEY_CLOSED")
    if await repo.answered_by(session, student.id, [survey.id]):
        raise ApiError(409, "SURVEY_ALREADY_ANSWERED")
    stored = check(survey.questions, answers)
    session.add(SurveyRespondent(survey_id=survey.id, student_id=student.id))
    session.add(SurveyResponse(survey_id=survey.id, answers=stored))
    try:
        await session.commit()
    except IntegrityError:
        # Sent twice at the same time: the first one counts, the second leaves nothing behind.
        await session.rollback()
        raise ApiError(409, "SURVEY_ALREADY_ANSWERED") from None
    return survey
