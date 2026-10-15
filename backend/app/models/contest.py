import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.user import User


class ContestJury(Base):
    __tablename__ = "contest_jury"

    contest_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contests.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    # Order the owner picked them in.
    position: Mapped[int] = mapped_column(Integer)
    # Pressed "finish". Only finished jury members count in the final score.
    finished: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(lazy="joined")


class Contest(Base):
    __tablename__ = "contests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(String(1000), default="")
    status: Mapped[str] = mapped_column(String(10), default="draft")  # draft | open | closed
    # Locked once the contest is open, so they live on the contest as documents:
    # criteria [{id, name, weight}], entries [{id, name, description}].
    criteria: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    entries: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped[User] = relationship(lazy="joined")
    jury: Mapped[list[ContestJury]] = relationship(
        lazy="selectin", order_by=ContestJury.position, cascade="all, delete-orphan"
    )


class ContestScore(Base):
    __tablename__ = "contest_scores"
    __table_args__ = (CheckConstraint("score BETWEEN 1 AND 5", name="score_range"),)

    contest_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contests.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    entry_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    criterion_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    score: Mapped[int] = mapped_column(SmallInteger)
