import uuid
from datetime import datetime

from pydantic import field_serializer

from app.schemas.base import CamelModel


class GroupIn(CamelModel):
    # Blank is allowed here so the service can answer FIELD_REQUIRED.
    name: str = ""


class GroupOut(CamelModel):
    id: uuid.UUID
    name: str
    student_count: int
    created_at: datetime

    @field_serializer("created_at")
    def _date_only(self, v: datetime) -> str:
        return v.date().isoformat()
