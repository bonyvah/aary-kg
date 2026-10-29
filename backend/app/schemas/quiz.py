import uuid
from typing import Annotated, Literal

from pydantic import Field, StringConstraints, model_validator

from app.images import ID_PATTERN
from app.schemas.base import CamelModel

Text = Annotated[str, StringConstraints(max_length=500)]
Answer = Annotated[str, StringConstraints(max_length=200)]
# An uploaded image (POST /images). Optional everywhere.
ImageId = Annotated[str, StringConstraints(pattern=ID_PATTERN)]

MIN_SECONDS = 5
MAX_SECONDS = 300
# Reading time: the question and its answers are shown this long before the answers open.
MIN_READ_SECONDS = 3
MAX_READ_SECONDS = 10
DEFAULT_READ_SECONDS = 3


class Question(CamelModel):
    # The editor makes the id; it only has to be unique inside the quiz.
    id: str = Field(min_length=1, max_length=64)
    text: Text
    answers: list[Answer] = Field(min_length=4, max_length=4)  # triangle, diamond, circle, square
    correct: Literal[1, 2, 3, 4]
    seconds: int = Field(ge=MIN_SECONDS, le=MAX_SECONDS)
    read_seconds: int = Field(default=DEFAULT_READ_SECONDS, ge=MIN_READ_SECONDS, le=MAX_READ_SECONDS)
    image: ImageId | None = None


class QuizIn(CamelModel):
    title: Annotated[str, StringConstraints(max_length=200)]
    image: ImageId | None = None
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
    image: str | None
    questions: list[Question]


class QuizSummary(CamelModel):
    id: uuid.UUID
    title: str
    status: Literal["draft", "ready"]
    image: str | None
    question_count: int
