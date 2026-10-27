import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.base import CamelModel

Attendance = Literal["present", "late", "absent"]
# none: not started; in_progress: the clock runs; submitted: ended (by the student, the time or the close).
AttemptState = Literal["none", "in_progress", "submitted"]
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


class SignalCount(CamelModel):
    kind: str
    count: int


class SessionStudentOut(CamelModel):
    student_id: uuid.UUID
    name: str
    group_name: str | None
    attendance: Attendance
    late_minutes: int | None
    attempt_state: AttemptState
    started_at: datetime | None
    submitted_at: datetime | None
    # Once ended: manual (handed in), timeout or closed (ended by the exam's close).
    submit_reason: Literal["manual", "timeout", "closed"] | None
    score: int | None
    # Screen signals during the attempt, only the kinds seen.
    signals: list[SignalCount]


class ExamSessionOut(CamelModel):
    id: uuid.UUID
    exam_id: uuid.UUID
    owner_name: str
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
    owner_name: str
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


class StudentQuestionOut(CamelModel):
    """A question as the student gets it: never the correct answer."""

    id: str
    text: str
    answers: list[str]


class StudentAttemptOut(CamelModel):
    state: Literal["in_progress", "submitted"]
    started_at: datetime
    deadline_at: datetime
    submitted_at: datetime | None
    # From the server's clock; the screen counts down from it.
    seconds_left: int
    answers: dict[str, int]


class ResultQuestionOut(CamelModel):
    id: str
    text: str
    answers: list[str]
    correct: int
    # None: not answered.
    chosen: int | None


class StudentResultOut(CamelModel):
    """Once the exam is closed: what the student got, question by question."""

    score: int
    total: int
    questions: list[ResultQuestionOut]


class StudentExamOut(CamelModel):
    id: uuid.UUID
    title: str
    minutes: int
    question_count: int
    status: Literal["open", "closed"]
    opened_at: datetime
    closed_at: datetime | None
    attendance: Attendance
    attempt: StudentAttemptOut | None
    # Only while the attempt runs.
    questions: list[StudentQuestionOut] | None
    # Only once the exam is closed, for a student who took it.
    result: StudentResultOut | None


class AnswerIn(CamelModel):
    answer: Literal[1, 2, 3, 4] | None


class SignalIn(CamelModel):
    kind: str = Field(max_length=20)
    question_id: str | None = Field(default=None, max_length=64)


class SignalOut(CamelModel):
    kind: str
    question_id: str | None
    at: datetime


class AttemptDetailOut(CamelModel):
    """One student's attempt for the teacher (and admins): every answer and every signal."""

    student_id: uuid.UUID
    name: str
    attempt_state: AttemptState
    started_at: datetime | None
    submitted_at: datetime | None
    submit_reason: Literal["manual", "timeout", "closed"] | None
    score: int | None
    total: int
    questions: list[ResultQuestionOut]
    signals: list[SignalOut]
