"""exam sessions: one run of an exam sheet for chosen students

Revision ID: 0013
Revises: 0012

A session copies the sheet's title, time limit and questions, so later edits of the sheet never change
it. It opens when it is created and the teacher closes it. Every student on it is present, late (by
how many minutes, only recorded) or absent (sees the exam but can't open it).
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "exam_sessions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("exam_id", sa.UUID(), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("questions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["exam_id"], ["exams.id"]),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_exam_sessions_owner_id", "exam_sessions", ["owner_id"])
    op.create_table(
        "exam_session_groups",
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["exam_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("session_id", "group_id"),
    )
    op.create_table(
        "exam_session_students",
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("attendance", sa.String(length=10), nullable=False),
        sa.Column("late_minutes", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["exam_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("session_id", "student_id"),
    )
    op.create_index("ix_exam_session_students_student_id", "exam_session_students", ["student_id"])


def downgrade() -> None:
    op.drop_index("ix_exam_session_students_student_id", table_name="exam_session_students")
    op.drop_table("exam_session_students")
    op.drop_table("exam_session_groups")
    op.drop_index("ix_exam_sessions_owner_id", table_name="exam_sessions")
    op.drop_table("exam_sessions")
