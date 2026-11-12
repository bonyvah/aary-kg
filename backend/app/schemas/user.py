import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field, field_serializer

from app.ai.students import MAX_STUDENTS
from app.schemas.base import CamelModel

UserRole = Literal["superadmin", "admin", "teacher", "student"]


class LoginIn(CamelModel):
    # Blank is allowed here so the service can answer CREDENTIALS_REQUIRED.
    login: str = ""
    password: str = ""


class ManagedUser(CamelModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    # First name, then last name: what lists and messages show.
    name: str
    login: str
    role: UserRole
    # Students only.
    group_id: uuid.UUID | None = None
    group_name: str | None = None
    active: bool
    created_at: datetime

    @field_serializer("created_at")
    def _date_only(self, v: datetime) -> str:
        return v.date().isoformat()


class CreateUserIn(CamelModel):
    first_name: str = ""
    last_name: str = ""
    login: str = ""
    # An admin creates teachers and students, the superadmin creates admins: any other pair is refused.
    # The superadmin comes from the command line (python -m app.cli create-superadmin).
    role: Literal["teacher", "student", "admin"] = "teacher"
    # Required for a student, refused for a teacher.
    group_id: uuid.UUID | None = None
    # Chosen by the admin, under the same rules as a password a person chooses. Blank: generated.
    password: str = ""


class NewStudent(CamelModel):
    first_name: str
    last_name: str
    login: str


class ProposedStudent(NewStudent):
    # Read from the admin's list, for them to review. The login may be blank: the model's wasn't valid.
    # Set when the login got a number: the one the model chose, and whose it is. It may be this student.
    taken_login: str | None = None
    taken_by: str | None = None


class CreateStudentsIn(CamelModel):
    group_id: uuid.UUID | None = None
    # The same for all of them, chosen by the admin: required here.
    password: str = ""
    students: list[NewStudent] = Field(min_length=1, max_length=MAX_STUDENTS)


class MoveGroupIn(CamelModel):
    group_id: uuid.UUID | None = None


class UserWithPassword(CamelModel):
    user: ManagedUser
    password: str


class ResetPasswordIn(CamelModel):
    # Chosen by the admin, under the same rules as on create. Blank: generated.
    password: str = ""


class PasswordOut(CamelModel):
    password: str


class ChangeLoginIn(CamelModel):
    # Asked again so a stolen open session can't take the account over.
    current_password: str = ""
    login: str = ""


class ChangePasswordIn(CamelModel):
    current_password: str = ""
    new_password: str = ""
