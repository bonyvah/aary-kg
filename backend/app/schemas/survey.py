import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, StringConstraints, model_validator

from app.schemas.base import CamelModel
from app.schemas.quiz import Answer, Text

MIN_CHOICES = 2
MAX_CHOICES = 30
MAX_QUESTIONS = 100
# Open answers: the editor counts in words of 6 characters; the server keeps to characters.
CHARS_PER_WORD = 6
MAX_WORDS = 100
MAX_OPEN_CHARS = 650

QuestionId = Annotated[str, StringConstraints(min_length=1, max_length=64)]


class SelectLimit(CamelModel):
    """How many choices a multiple-select question takes: at least `min` (1 by default), at most `max`.

    No `max` means as many as there are choices, so it follows the choices as they change.
    """

    min: int = Field(default=1, ge=1, le=MAX_CHOICES)
    max: int | None = Field(default=None, ge=1, le=MAX_CHOICES)


class SingleQuestion(CamelModel):
    id: QuestionId
    kind: Literal["single"]
    text: Text
    required: bool = True
    choices: list[Answer] = Field(min_length=MIN_CHOICES, max_length=MAX_CHOICES)


class MultiQuestion(CamelModel):
    id: QuestionId
    kind: Literal["multi"]
    text: Text
    required: bool = True
    choices: list[Answer] = Field(min_length=MIN_CHOICES, max_length=MAX_CHOICES)
    limit: SelectLimit = Field(default_factory=SelectLimit)


class OpenQuestion(CamelModel):
    id: QuestionId
    kind: Literal["open"]
    text: Text
    required: bool = True
    max_words: int = Field(default=MAX_WORDS, ge=1, le=MAX_WORDS)


SurveyQuestion = Annotated[SingleQuestion | MultiQuestion | OpenQuestion, Field(discriminator="kind")]


def max_chars(max_words: int) -> int:
    """The characters an open answer may have."""
    return min(max_words * CHARS_PER_WORD, MAX_OPEN_CHARS)


class SurveySheetIn(CamelModel):
    title: Annotated[str, StringConstraints(max_length=200)]
    questions: list[SurveyQuestion] = Field(min_length=1, max_length=MAX_QUESTIONS)

    @model_validator(mode="after")
    def _unique_ids(self) -> "SurveySheetIn":
        ids = [q.id for q in self.questions]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate question ids")
        return self


class SurveySheetOut(CamelModel):
    id: uuid.UUID
    title: str
    questions: list[SurveyQuestion]


class SurveySheetSummary(CamelModel):
    id: uuid.UUID
    title: str
    question_count: int


class SurveyIn(CamelModel):
    sheet_id: uuid.UUID
    group_ids: list[uuid.UUID] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def _unique(self) -> "SurveyIn":
        if len(self.group_ids) != len(set(self.group_ids)):
            raise ValueError("duplicate ids")
        return self


class SurveyGroupOut(CamelModel):
    id: uuid.UUID
    name: str


class QuestionResult(CamelModel):
    """A question with what was answered to it. counts: per choice; texts: open answers, shuffled."""

    question: SurveyQuestion
    # Responses that answered this question (an optional one may be left out).
    answered: int
    counts: list[int] | None = None
    texts: list[str] | None = None


SurveyStatus = Literal["open", "closed"]


class SurveySummary(CamelModel):
    id: uuid.UUID
    title: str
    status: SurveyStatus
    opened_at: datetime
    closed_at: datetime | None
    group_names: list[str]
    student_count: int
    answered_count: int


class SurveyStudentOut(CamelModel):
    id: uuid.UUID
    name: str
    group_name: str | None
    answered: bool


class SurveyOut(SurveySummary):
    sheet_id: uuid.UUID
    groups: list[SurveyGroupOut]
    results: list[QuestionResult]
    # Who the survey was for and who has answered, never what.
    students: list[SurveyStudentOut]


# A single choice is its number (1 to n), a multiple select the list of numbers, an open answer the text.
AnswerValue = Annotated[int, Field(ge=1, le=MAX_CHOICES)] | list[int] | str


class SurveySubmitIn(CamelModel):
    answers: dict[QuestionId, AnswerValue] = Field(max_length=MAX_QUESTIONS)


class StudentSurveyOut(CamelModel):
    id: uuid.UUID
    title: str
    status: SurveyStatus
    opened_at: datetime
    closed_at: datetime | None
    question_count: int
    answered: bool
    # Only while the survey is open, and only on its own page: the questions, and this student's answers
    # so far (none before the first send).
    questions: list[SurveyQuestion] | None = None
    answers: dict[str, AnswerValue] | None = None
