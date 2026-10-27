"""extra exam attempts granted by the teacher

Revision ID: 0016
Revises: 0015

A student gets one attempt plus one for every grant. The latest active attempt counts; an admin can
make an attempt inactive (kept and shown, not counted). Grants and inactivations go to exam_audit.
"""
import sqlalchemy as sa
from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "exam_session_students",
        sa.Column("extra_attempts", sa.Integer(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("exam_session_students", "extra_attempts")
