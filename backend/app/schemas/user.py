import uuid
from datetime import datetime
from typing import Literal

from pydantic import field_serializer

from app.schemas.base import CamelModel

UserRole = Literal["admin", "teacher", "student"]


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
    # An admin creates teachers and students. The first admin comes from the command line
    # (python -m app.cli create-admin); "admin" here is refused.
    role: Literal["teacher", "student"] = "teacher"
    # Required for a student, refused for a teacher.
    group_id: uuid.UUID | None = None
    # Chosen by the admin, under the same rules as a password a person chooses. Blank: generated.
    password: str = ""


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
