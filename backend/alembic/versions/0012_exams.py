"""exams: quiz-like tests students take on their own

Revision ID: 0012
Revises: 0011

An exam is a reusable document like a quiz: a title, an overall time limit in minutes and the questions
(no per-question time). It is run for students through exam sessions, which copy the questions.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "exams",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("questions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_exams_owner_id", "exams", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_exams_owner_id", table_name="exams")
    op.drop_table("exams")
