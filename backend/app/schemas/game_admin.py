import uuid
from datetime import datetime
from typing import Annotated, Any

from pydantic import Field, StrictBool, StrictInt, StringConstraints

from app.schemas.base import CamelModel
from app.schemas.game import Flag


class AdjustIn(CamelModel):
    # Points to add (positive) or take away (negative), by hand.
    delta: StrictInt = Field(ge=-100_000, le=100_000)


class SetScoreIn(CamelModel):
    score: StrictInt = Field(ge=0, le=1_000_000)


class AnswerEditIn(CamelModel):
    # The answer was right or wrong, and how many points it is worth: 0 for a wrong answer, 1 to 1000
    # for a right one. Give one or both: a right answer alone gets the base 500, a wrong one gets 0.
    correct: StrictBool | None = None
    points: StrictInt | None = Field(default=None, ge=0, le=1000)


class RenameIn(CamelModel):
    nickname: Annotated[str, StringConstraints(max_length=100)] = ""


class DetailQuestion(CamelModel):
    id: str
    text: str
    answers: list[str]
    correct: int  # 1-4, the position of the right answer


class DetailAnswer(CamelModel):
    question: str
    position: int
    ms: int
    points: int
    correct: bool


class DetailPlayer(CamelModel):
    id: str
    nickname: str
    character: dict[str, str]
    rank: int
    score: int
    adjustment: int
    correct: int
    flags: list[Flag]
    answers: list[DetailAnswer]


class Edit(CamelModel):
    at: datetime
    admin_name: str
    action: str
    nickname: str | None
    detail: dict[str, Any]


class GameDetail(CamelModel):
    game_id: uuid.UUID
    quiz_title: str
    owner_name: str
    finished_at: datetime
    duration_seconds: int
    questions: list[DetailQuestion]
    players: list[DetailPlayer]
    edits: list[Edit]
