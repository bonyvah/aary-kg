"""The WebSocket protocol, version 1. Every message is a JSON object with `v` (always 1) and `type`.
Keys are camelCase. Spec and examples: docs/protocol.md.

Client -> server messages are parsed with `parse_client`: anything that does not match is rejected.
Server -> client messages are built from the models below, so their shape is fixed in one place.
"""

from typing import Annotated, Any, Literal

from pydantic import Field, TypeAdapter, ValidationError

from app.schemas.base import CamelModel

VERSION = 1
Phase = Literal["lobby", "question", "counts", "leaderboard", "ended"]
Position = Literal[1, 2, 3, 4]


# --- client -> server ---------------------------------------------------------------------------


class _In(CamelModel):
    v: Literal[1]


class Hello(_In):
    """First message of a player: proves who they are with the game-scoped token from /games/join."""

    type: Literal["hello"]
    token: str = Field(max_length=2048)


class Answer(_In):
    type: Literal["answer"]
    position: Position  # the shape tapped: 1 triangle, 2 diamond, 3 circle, 4 square


class Signal(_In):
    """A browser signal. Only a hint for the host's report, never proof."""

    type: Literal["signal"]
    kind: Literal["TAB_BLUR", "PASTE"]


class Pong(_In):
    type: Literal["pong"]
    n: int


class SetCharacter(_In):
    type: Literal["character.set"]
    character: dict[str, Any]  # validated against the fixed lists, not here


class Start(_In):
    type: Literal["start"]


class Next(_In):
    """Host: close the question early, show the leaderboard, go on to the next question or the end."""

    type: Literal["next"]
    # The phase the host was looking at when they pressed the button. If the game has moved on since
    # (a double click, a timer that closed the question first), the press is ignored instead of
    # skipping a screen.
    from_phase: Phase | None = None


class Kick(_In):
    type: Literal["kick"]
    player_id: str = Field(max_length=64)


class End(_In):
    type: Literal["end"]


Ruling = Literal["kick", "zero", "void_last", "mercy"]


class Rule(_In):
    """Host, on the podium: what to do about a suspected cheater."""

    type: Literal["rule"]
    player_id: str = Field(max_length=64)
    action: Ruling


PlayerMessage = Annotated[Hello | Answer | Signal | Pong | SetCharacter, Field(discriminator="type")]
HostMessage = Annotated[Start | Next | Kick | End | Rule, Field(discriminator="type")]

_player = TypeAdapter(PlayerMessage)
_host = TypeAdapter(HostMessage)


def parse_player(data: Any) -> Hello | Answer | Signal | Pong | SetCharacter | None:
    try:
        return _player.validate_python(data)
    except ValidationError:
        return None


def parse_host(data: Any) -> Start | Next | Kick | End | Rule | None:
    try:
        return _host.validate_python(data)
    except ValidationError:
        return None


# --- server -> client ---------------------------------------------------------------------------


class _Out(CamelModel):
    v: Literal[1] = 1


class PlayerPublic(CamelModel):
    id: str
    nickname: str
    character: dict[str, str]


class Standing(PlayerPublic):
    score: int
    rank: int


class PlayerQuestion(CamelModel):
    """What a player sees: text and time. No answers, and never the correct one."""

    index: int  # 1-based
    total: int
    text: str
    seconds: int


class HostQuestion(PlayerQuestion):
    """The host screen also shows the four answer texts (triangle, diamond, circle, square)."""

    answers: list[str]


class Reveal(CamelModel):
    correct: Position
    points: int


class StateEvent(_Out):
    """Sent to a player right after hello (and so on every reconnect): where the game is now."""

    type: Literal["state"] = "state"
    phase: Phase
    you: Standing
    players: list[PlayerPublic]
    question: PlayerQuestion | None = None
    remaining_ms: int | None = None
    answered: Position | None = None
    reveal: Reveal | None = None
    top: list[Standing] | None = None


class CheaterFlag(CamelModel):
    kind: str
    count: int


class Cheater(CamelModel):
    """A player the server's anti-cheat rules flagged, with the reasons."""

    player_id: str
    nickname: str
    flags: list[CheaterFlag]


class HostStateEvent(_Out):
    type: Literal["host.state"] = "host.state"
    game_id: str
    pin: str
    phase: Phase
    total: int
    players: list[PlayerPublic]
    question: HostQuestion | None = None
    remaining_ms: int | None = None
    answered: int = 0
    counts: list[int] | None = None
    correct: Position | None = None
    standings: list[Standing] | None = None
    cheaters: list[Cheater] | None = None


class LobbyUpdated(_Out):
    type: Literal["lobby.updated"] = "lobby.updated"
    players: list[PlayerPublic]


class QuestionStarted(_Out):
    type: Literal["question.started"] = "question.started"
    question: PlayerQuestion


class HostQuestionStarted(_Out):
    type: Literal["question.started"] = "question.started"
    question: HostQuestion


class AnswerAccepted(_Out):
    type: Literal["answer.accepted"] = "answer.accepted"
    position: Position


class AnswerCount(_Out):
    type: Literal["answer.count"] = "answer.count"
    answered: int
    total: int


class QuestionClosed(_Out):
    type: Literal["question.closed"] = "question.closed"
    reveal: Reveal
    score: int
    rank: int


class HostQuestionClosed(_Out):
    type: Literal["question.closed"] = "question.closed"
    counts: list[int]  # how many tapped triangle, diamond, circle, square
    correct: Position


class Leaderboard(_Out):
    type: Literal["leaderboard"] = "leaderboard"
    top: list[Standing]  # the best five
    you: Standing


class HostLeaderboard(_Out):
    type: Literal["leaderboard"] = "leaderboard"
    standings: list[Standing]


class GameEnded(_Out):
    type: Literal["game.ended"] = "game.ended"
    top: list[Standing]  # the podium: the best three
    you: Standing


class HostGameEnded(_Out):
    type: Literal["game.ended"] = "game.ended"
    game_id: str
    standings: list[Standing]
    cheaters: list[Cheater] = []


class Ping(_Out):
    type: Literal["ping"] = "ping"
    n: int


class Kicked(_Out):
    type: Literal["kicked"] = "kicked"


class Replaced(_Out):
    """The same player connected somewhere else: this connection is closed."""

    type: Literal["replaced"] = "replaced"


class Closed(_Out):
    """The host ended the game before it started."""

    type: Literal["game.closed"] = "game.closed"


class ErrorEvent(_Out):
    type: Literal["error"] = "error"
    code: str


def dump(event: _Out) -> dict[str, Any]:
    return event.model_dump(by_alias=True, mode="json")
