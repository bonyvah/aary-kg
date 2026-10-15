import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Game(Base):
    """A finished game. Redis holds it while it runs; this is the history."""

    __tablename__ = "games"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    # No foreign key: the quiz can change later, the game keeps its own copy below.
    quiz_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    quiz_title: Mapped[str] = mapped_column(String(200))
    # The questions as they were played, in that order, with the right answers.
    questions: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    duration_seconds: Mapped[int] = mapped_column(Integer)
    # Everything that happened, with timestamps, for review after the game.
    audit: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)


class GamePlayer(Base):
    __tablename__ = "game_players"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    game_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"), index=True)
    nickname: Mapped[str] = mapped_column(String(20))
    character: Mapped[dict[str, str]] = mapped_column(JSONB)
    # score = the points of the answers + `adjustment`: what an admin added or took away by hand.
    score: Mapped[int] = mapped_column(Integer)
    adjustment: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    rank: Mapped[int] = mapped_column(Integer)
    correct: Mapped[int] = mapped_column(Integer)
    # Hints for the host, never proof: [{kind, count}].
    flags: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    # [{round, question, position, ms, points, correct}]
    answers: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
