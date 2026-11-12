import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime, ForeignKey, String, Table, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.group import Group


class SurveySheet(Base):
    """An admin's survey questions, run as surveys for student groups."""

    __tablename__ = "survey_sheets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    # [{id, kind: single | multi | open, text, required, choices?, limit?, maxWords?}]
    questions: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # Set when it is deleted after being used: gone from every list, its surveys kept.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


survey_groups = Table(
    "survey_groups",
    Base.metadata,
    Column("survey_id", ForeignKey("surveys.id", ondelete="CASCADE"), primary_key=True),
    Column("group_id", ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
)


class Survey(Base):
    """One run of a sheet for student groups: open until an admin closes it."""

    __tablename__ = "surveys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sheet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("survey_sheets.id"))
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    # Copied from the sheet when the survey starts.
    title: Mapped[str] = mapped_column(String(200))
    questions: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(10), default="open")  # open | closed
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    # Set when an admin deletes it: gone from every list and page, its rows kept.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    groups: Mapped[list[Group]] = relationship(secondary=survey_groups, lazy="selectin")
    students: Mapped[list["SurveyStudent"]] = relationship(lazy="selectin", cascade="all, delete-orphan")


class SurveyStudent(Base):
    """Who may answer: the active students of the groups when the survey started."""

    __tablename__ = "survey_students"

    survey_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("surveys.id", ondelete="CASCADE"), primary_key=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True, index=True)


class SurveyRespondent(Base):
    """THAT a student answered: who finished a survey and who did not."""

    __tablename__ = "survey_respondents"

    survey_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("surveys.id", ondelete="CASCADE"), primary_key=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)


class SurveyResponse(Base):
    """WHAT was answered, by whom: the student can open and change it while the survey is open.

    question id -> choice 1-n, [choices] or text. Responses from before the link have no student: nobody
    can change those.
    """

    __tablename__ = "survey_responses"
    __table_args__ = (UniqueConstraint("survey_id", "student_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    survey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), default=None)
    answers: Mapped[dict[str, Any]] = mapped_column(JSONB)
