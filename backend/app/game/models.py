"""The state of a live game, as it is kept in Redis (JSON) while the game runs."""

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

Phase = Literal["lobby", "question", "counts", "leaderboard", "ended"]


class GameError(Exception):
    """A rule of the game was broken. `code` is the stable error code (never display text)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass
class GameState:
    id: str
    owner_id: str
    quiz_id: str
    pin: str
    phase: Phase = "lobby"
    round: int = -1  # index into `order`; -1 while in the lobby
    order: list[int] = field(default_factory=list)  # question indexes in the order they are played
    created_ms: int = 0
    started_ms: int = 0  # when the first question began
    question_started_ms: int = 0
    deadline_ms: int = 0
    finished_ms: int = 0

    def dump(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def load(cls, data: dict[str, Any]) -> "GameState":
        return cls(**data)


@dataclass
class PlayerState:
    id: str
    nickname: str
    character: dict[str, str]
    score: int = 0
    correct: int = 0
    # Total time of the correct answers: breaks ties on the leaderboard (faster wins).
    time_ms: int = 0

    def dump(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def load(cls, data: dict[str, Any]) -> "PlayerState":
        return cls(**data)


@dataclass
class FinishedGame:
    """Everything the database needs once a game is over."""

    game: GameState
    quiz: dict[str, Any]  # {id, title, questions: [...]} snapshot taken when the game was created
    players: list[PlayerState]
    standings: list[dict[str, Any]]  # final order: {id, rank, score}
    # results[round][player id] = {position, ms, points, correct}. Only scored answers.
    results: dict[int, dict[str, dict[str, Any]]]
    signals: dict[str, dict[str, int]]  # player id -> kind -> count
    audit: list[dict[str, Any]]
