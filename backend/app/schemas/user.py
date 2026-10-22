import uuid
from datetime import datetime
from typing import Literal

from pydantic import field_serializer

from app.schemas.base import CamelModel

UserRole = Literal["admin", "teacher"]


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
    active: bool
    created_at: datetime

    @field_serializer("created_at")
    def _date_only(self, v: datetime) -> str:
        return v.date().isoformat()


class CreateUserIn(CamelModel):
    first_name: str = ""
    last_name: str = ""
    login: str = ""
    # An admin can only create teachers. The first admin comes from the command line
    # (python -m app.cli create-admin); anything but "teacher" here is refused.
    role: Literal["teacher"] = "teacher"


class UserWithPassword(CamelModel):
    user: ManagedUser
    password: str


class PasswordOut(CamelModel):
    password: str


class ChangeLoginIn(CamelModel):
    # Asked again so a stolen open session can't take the account over.
    current_password: str = ""
    login: str = ""


class ChangePasswordIn(CamelModel):
    current_password: str = ""
    new_password: str = ""
