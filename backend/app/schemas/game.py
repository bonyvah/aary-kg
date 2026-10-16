import uuid
from datetime import datetime
from typing import Annotated

from pydantic import Field, StringConstraints

from app.schemas.base import CamelModel


class CreateGameIn(CamelModel):
    quiz_id: uuid.UUID


class HostTicketOut(CamelModel):
    ticket: str


class CreateGameOut(CamelModel):
    game_id: str
    pin: str


class JoinIn(CamelModel):
    pin: Annotated[str, StringConstraints(max_length=16)] = ""
    nickname: Annotated[str, StringConstraints(max_length=100)] = ""


class JoinedPlayer(CamelModel):
    id: str
    nickname: str
    character: dict[str, str]


class JoinOut(CamelModel):
    token: str  # game-scoped, short-lived: only good for this player in this game
    player: JoinedPlayer


class Flag(CamelModel):
    kind: str
    count: int


class ReportAnswer(CamelModel):
    question: str  # id of the question
    position: int  # 1 to 4: the answer the player chose
    ms: int
    points: int
    correct: bool


class ReportPlayer(CamelModel):
    id: str
    nickname: str
    character: dict[str, str]
    rank: int
    score: int
    correct: int
    flags: list[Flag]
    answers: list[ReportAnswer]  # only the questions the player answered


class ReportQuestion(CamelModel):
    id: str
    text: str
    answers: list[str]
    correct: int  # 1 to 4: the position of the right answer
    correct_share: float = Field(ge=0, le=1)  # how many of the players got it right


class GameReport(CamelModel):
    game_id: uuid.UUID
    quiz_id: uuid.UUID
    quiz_title: str
    finished_at: datetime
    duration_seconds: int
    question_count: int
    # How many times an admin corrected this game's data. The host can read, never change, it.
    edit_count: int
    players: list[ReportPlayer]
    questions: list[ReportQuestion]


class GameSummary(CamelModel):
    id: uuid.UUID
    quiz_title: str
    owner_name: str  # who hosted it
    finished_at: datetime
    player_count: int
    question_count: int
