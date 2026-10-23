"""exam attempts: a student's run through an exam, and the screen signals seen meanwhile

Revision ID: 0014
Revises: 0013

The server owns the clock: the deadline is set when the attempt starts. An attempt ends when the
student submits it, when the time is up or when the teacher closes the exam. Correct answers are only
counted then. `active` is for later: a second attempt makes the first inactive.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "exam_attempts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submit_reason", sa.String(length=10), nullable=True),
        sa.Column("answers", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["exam_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_exam_attempts_session_student", "exam_attempts", ["session_id", "student_id"])
    op.create_table(
        "exam_attempt_events",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("attempt_id", sa.UUID(), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("question_id", sa.String(length=64), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["exam_attempts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_exam_attempt_events_attempt_id", "exam_attempt_events", ["attempt_id"])


def downgrade() -> None:
    op.drop_index("ix_exam_attempt_events_attempt_id", table_name="exam_attempt_events")
    op.drop_table("exam_attempt_events")
    op.drop_index("ix_exam_attempts_session_student", table_name="exam_attempts")
    op.drop_table("exam_attempts")
