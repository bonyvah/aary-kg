import uuid
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
    """How many choices a multiple-select question takes: none (any, at least one), min, max or exact."""

    mode: Literal["none", "min", "max", "exact"] = "none"
    n: int | None = Field(default=None, ge=1, le=MAX_CHOICES)

    @model_validator(mode="after")
    def _n_with_mode(self) -> "SelectLimit":
        if (self.mode == "none") != (self.n is None):
            raise ValueError("n goes with min, max and exact only")
        return self


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
