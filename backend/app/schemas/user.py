import uuid
from datetime import datetime
from typing import Literal

from pydantic import field_serializer

from app.schemas.base import CamelModel

UserRole = Literal["admin", "user"]


class LoginIn(CamelModel):
    # Blank is allowed here so the service can answer CREDENTIALS_REQUIRED.
    login: str = ""
    password: str = ""


class ManagedUser(CamelModel):
    id: uuid.UUID
    name: str
    login: str
    role: UserRole
    active: bool
    created_at: datetime

    @field_serializer("created_at")
    def _date_only(self, v: datetime) -> str:
        return v.date().isoformat()


class CreateUserIn(CamelModel):
    name: str = ""
    login: str = ""
    role: UserRole = "user"


class UserWithPassword(CamelModel):
    user: ManagedUser
    password: str


class PasswordOut(CamelModel):
    password: str
