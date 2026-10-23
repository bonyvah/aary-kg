import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.base import CamelModel

Attendance = Literal["present", "late", "absent"]
MIN_LATE_MINUTES = 1
MAX_LATE_MINUTES = 180


class AttendanceChange(CamelModel):
    attendance: Attendance
    # Required when late, ignored otherwise.
    late_minutes: int | None = Field(default=None, ge=MIN_LATE_MINUTES, le=MAX_LATE_MINUTES)


class AttendanceIn(AttendanceChange):
    student_id: uuid.UUID


class ExamSessionIn(CamelModel):
    exam_id: uuid.UUID
    group_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)
    students: list[AttendanceIn] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def _unique(self) -> "ExamSessionIn":
        ids = [s.student_id for s in self.students]
        if len(ids) != len(set(ids)) or len(self.group_ids) != len(set(self.group_ids)):
            raise ValueError("duplicate ids")
        return self


class SessionGroupOut(CamelModel):
    id: uuid.UUID
    name: str


class SessionStudentOut(CamelModel):
    student_id: uuid.UUID
    name: str
    group_name: str | None
    attendance: Attendance
    late_minutes: int | None


class ExamSessionOut(CamelModel):
    id: uuid.UUID
    exam_id: uuid.UUID
    title: str
    minutes: int
    question_count: int
    status: Literal["open", "closed"]
    opened_at: datetime
    closed_at: datetime | None
    groups: list[SessionGroupOut]
    students: list[SessionStudentOut]


class ExamSessionSummary(CamelModel):
    id: uuid.UUID
    title: str
    status: Literal["open", "closed"]
    opened_at: datetime
    closed_at: datetime | None
    group_names: list[str]
    student_count: int
    absent_count: int


class StudentOut(CamelModel):
    id: uuid.UUID
    name: str
    group_id: uuid.UUID | None
    group_name: str | None
