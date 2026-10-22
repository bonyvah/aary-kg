import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.group import Group


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name: Mapped[str] = mapped_column(String(60))
    # Empty only for accounts that existed before the name was split in two.
    last_name: Mapped[str] = mapped_column(String(60), default="", server_default="")
    login: Mapped[str] = mapped_column(String(32), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(10))  # admin | teacher | student
    # Students only: the one group they are in. A group with students can't be deleted.
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("groups.id", ondelete="RESTRICT"), index=True, default=None
    )
    group: Mapped[Group | None] = relationship(lazy="joined")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Part of every session token. Bumping it (a password reset) signs the user out everywhere.
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @hybrid_property
    def name(self) -> str:
        """How the person is shown everywhere: first name, then last name."""
        return f"{self.first_name} {self.last_name}".strip()

    @name.inplace.expression
    @classmethod
    def _name_expression(cls):
        return func.trim(cls.first_name + " " + cls.last_name)

    @property
    def group_name(self) -> str | None:
        return self.group.name if self.group else None
