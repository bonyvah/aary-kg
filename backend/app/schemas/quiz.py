import uuid
from typing import Annotated, Literal

from pydantic import Field, StringConstraints, model_validator

from app.schemas.base import CamelModel

Text = Annotated[str, StringConstraints(max_length=500)]
Answer = Annotated[str, StringConstraints(max_length=200)]

MIN_SECONDS = 5
MAX_SECONDS = 300


class Question(CamelModel):
    # The editor makes the id; it only has to be unique inside the quiz.
    id: str = Field(min_length=1, max_length=64)
    text: Text
    answers: list[Answer] = Field(min_length=4, max_length=4)  # triangle, diamond, circle, square
    correct: Literal[1, 2, 3, 4]
    seconds: int = Field(ge=MIN_SECONDS, le=MAX_SECONDS)


class QuizIn(CamelModel):
    title: Annotated[str, StringConstraints(max_length=200)]
    questions: list[Question] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def _unique_ids(self) -> "QuizIn":
        ids = [q.id for q in self.questions]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate question ids")
        return self


class QuizOut(CamelModel):
    id: uuid.UUID
    title: str
    status: Literal["draft", "ready"]
    questions: list[Question]


class QuizSummary(CamelModel):
    id: uuid.UUID
    title: str
    status: Literal["draft", "ready"]
    question_count: int
