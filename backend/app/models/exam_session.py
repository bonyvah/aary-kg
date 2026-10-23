import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Identity,
    Integer,
    String,
    Table,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.group import Group
from app.models.user import User

exam_session_groups = Table(
    "exam_session_groups",
    Base.metadata,
    Column("session_id", ForeignKey("exam_sessions.id", ondelete="CASCADE"), primary_key=True),
    Column("group_id", ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
)


class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exams.id"))
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    # Copied from the exam sheet when the session starts.
    title: Mapped[str] = mapped_column(String(200))
    minutes: Mapped[int] = mapped_column(Integer)
    questions: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(10), default="open")  # open | closed
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    # The groups the teacher picked, to show them. Who takes the exam is the student list.
    groups: Mapped[list[Group]] = relationship(secondary=exam_session_groups, lazy="selectin")
    students: Mapped[list["ExamSessionStudent"]] = relationship(
        lazy="selectin", cascade="all, delete-orphan", back_populates="session"
    )
    attempts: Mapped[list["ExamAttempt"]] = relationship(lazy="selectin", cascade="all, delete-orphan")

    def attempt_of(self, student_id: uuid.UUID) -> "ExamAttempt | None":
        """The attempt that counts: the student's active one."""
        return next((a for a in self.attempts if a.student_id == student_id and a.active), None)


class ExamSessionStudent(Base):
    __tablename__ = "exam_session_students"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("exam_sessions.id", ondelete="CASCADE"), primary_key=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True, index=True)
    attendance: Mapped[str] = mapped_column(String(10))  # present | late | absent
    # Late only: how late, recorded and shown. The time limit stays the same.
    late_minutes: Mapped[int | None] = mapped_column(Integer, default=None)

    session: Mapped[ExamSession] = relationship(back_populates="students")
    student: Mapped[User] = relationship(lazy="selectin")


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exam_sessions.id", ondelete="CASCADE"))
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    # A second attempt (granted later) makes this one inactive: kept and shown, but not counted.
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # Server time. Answers after it are refused; the attempt ends by itself.
    deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    submit_reason: Mapped[str | None] = mapped_column(String(10), default=None)  # manual | timeout | closed
    # question id -> chosen position 1-4
    answers: Mapped[dict[str, int]] = mapped_column(JSONB, default=dict)
    # Correct answers, counted when the attempt ends.
    score: Mapped[int | None] = mapped_column(Integer, default=None)


class ExamAttemptEvent(Base):
    """A screen signal during an attempt (left the tab, another window, left full screen, paste)."""

    __tablename__ = "exam_attempt_events"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("exam_attempts.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(20))
    question_id: Mapped[str | None] = mapped_column(String(64), default=None)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
