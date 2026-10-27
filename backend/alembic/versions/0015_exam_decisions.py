"""exam anti-cheat decisions, and an audit of what teachers and admins did to attempts

Revision ID: 0015
Revises: 0014

A teacher rules on an attempt with screen signals: mercy (score kept), zero, or per question (mercy, or
the question doesn't count). The ruling can change any time; the score shown is worked out from it.
Every ruling is written to exam_audit with who, when, before and after.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("exam_attempts", sa.Column("decision", sa.String(length=12), nullable=True))
    op.add_column(
        "exam_attempts",
        sa.Column(
            "question_decisions", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False
        ),
    )
    op.create_table(
        "exam_audit",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("attempt_id", sa.UUID(), nullable=True),
        sa.Column("actor_id", sa.UUID(), nullable=False),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("before", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("after", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["exam_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["attempt_id"], ["exam_attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_exam_audit_session_student", "exam_audit", ["session_id", "student_id"])


def downgrade() -> None:
    op.drop_index("ix_exam_audit_session_student", table_name="exam_audit")
    op.drop_table("exam_audit")
    op.drop_column("exam_attempts", "question_decisions")
    op.drop_column("exam_attempts", "decision")
