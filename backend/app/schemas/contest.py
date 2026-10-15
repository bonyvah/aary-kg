import uuid
from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.schemas.base import CamelModel

Name = Annotated[str, StringConstraints(max_length=100)]
ClientId = Annotated[str, StringConstraints(min_length=1, max_length=64)]

ContestStatus = Literal["draft", "open", "closed"]
Score = Literal[1, 2, 3, 4, 5]


class CriterionIn(CamelModel):
    id: ClientId  # the form's own id: failed fields are reported against it
    name: Name
    weight: float  # a float so 33.5 is a WEIGHTS_NOT_100 issue, like on the client


class EntryIn(CamelModel):
    id: ClientId
    name: Name
    description: Annotated[str, StringConstraints(max_length=500)] = ""


class ContestIn(CamelModel):
    title: Annotated[str, StringConstraints(max_length=200)]
    description: Annotated[str, StringConstraints(max_length=1000)] = ""
    criteria: list[CriterionIn] = Field(max_length=20)
    entries: list[EntryIn] = Field(max_length=200)
    jury_ids: list[uuid.UUID] = Field(max_length=100)


class CriterionOut(CamelModel):
    id: str
    name: str
    weight: int


class EntryOut(CamelModel):
    id: str
    name: str
    description: str


class JuryMemberOut(CamelModel):
    user_id: uuid.UUID
    name: str
    finished: bool


class ContestOut(CamelModel):
    id: uuid.UUID
    title: str
    description: str
    status: ContestStatus
    owner_id: uuid.UUID
    owner_name: str
    criteria: list[CriterionOut]
    entries: list[EntryOut]
    jury: list[JuryMemberOut]
    # scores[userId][entryId][criterionId]. Only the viewer's own sheet is ever sent.
    scores: dict[str, dict[str, dict[str, int]]]


class ScoreIn(CamelModel):
    entry_id: ClientId
    criterion_id: ClientId
    score: Score


class RankedEntryOut(CamelModel):
    entry: EntryOut
    final_score: float | None
    rank: int | None
    shared: bool
    per_criterion: dict[str, float | None]
    jury_count: int


class BreakdownRowOut(CamelModel):
    user_id: uuid.UUID
    name: str
    scores: dict[str, int | None]
    total: float | None


class ResultsOut(CamelModel):
    ranking: list[RankedEntryOut]
    # Who gave which score. Only the owner and admins get it, jury members get null.
    breakdown: dict[str, list[BreakdownRowOut]] | None


class DirectoryUser(CamelModel):
    id: uuid.UUID
    name: str
