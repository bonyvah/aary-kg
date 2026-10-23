import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, func
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
