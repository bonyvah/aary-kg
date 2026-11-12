"""surveys: a sheet run for student groups, answered anonymously

Revision ID: 0020
Revises: 0019

A survey copies the sheet's title and questions. Who may answer is kept in survey_students, who
answered in survey_respondents, what was answered in survey_responses. Nothing links a respondent
to a response, and neither has a time, so the answers can't be traced back to a student.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "surveys",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("sheet_id", sa.UUID(), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("questions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["sheet_id"], ["survey_sheets.id"]),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "survey_groups",
        sa.Column("survey_id", sa.UUID(), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["survey_id"], ["surveys.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("survey_id", "group_id"),
    )
    op.create_table(
        "survey_students",
        sa.Column("survey_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["survey_id"], ["surveys.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("survey_id", "student_id"),
    )
    op.create_index("ix_survey_students_student_id", "survey_students", ["student_id"])
    op.create_table(
        "survey_respondents",
        sa.Column("survey_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["survey_id"], ["surveys.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("survey_id", "student_id"),
    )
    op.create_table(
        "survey_responses",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("survey_id", sa.UUID(), nullable=False),
        sa.Column("answers", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(["survey_id"], ["surveys.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_survey_responses_survey_id", "survey_responses", ["survey_id"])


def downgrade() -> None:
    op.drop_index("ix_survey_responses_survey_id", table_name="survey_responses")
    op.drop_table("survey_responses")
    op.drop_table("survey_respondents")
    op.drop_index("ix_survey_students_student_id", table_name="survey_students")
    op.drop_table("survey_students")
    op.drop_table("survey_groups")
    op.drop_table("surveys")
