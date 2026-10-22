import uuid
from typing import Annotated, Literal

from pydantic import Field, StringConstraints, model_validator

from app.schemas.base import CamelModel
from app.schemas.quiz import Answer, Text

MIN_MINUTES = 5
MAX_MINUTES = 180


class ExamQuestion(CamelModel):
    # The editor makes the id; it only has to be unique inside the exam.
    id: str = Field(min_length=1, max_length=64)
    text: Text
    answers: list[Answer] = Field(min_length=4, max_length=4)  # triangle, diamond, circle, square
    correct: Literal[1, 2, 3, 4]


class ExamIn(CamelModel):
    title: Annotated[str, StringConstraints(max_length=200)]
    minutes: int = Field(ge=MIN_MINUTES, le=MAX_MINUTES)
    questions: list[ExamQuestion] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def _unique_ids(self) -> "ExamIn":
        ids = [q.id for q in self.questions]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate question ids")
        return self


class ExamOut(CamelModel):
    id: uuid.UUID
    title: str
    minutes: int
    questions: list[ExamQuestion]


class ExamSummary(CamelModel):
    id: uuid.UUID
    title: str
    minutes: int
    question_count: int
