"""survey responses: who answered, so a student can change an answer while the survey is open

Revision ID: 0022
Revises: 0021

Responses from before this have no student and stay as they are.
"""

import sqlalchemy as sa
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("survey_responses", sa.Column("student_id", sa.UUID(), nullable=True))
    op.create_foreign_key("fk_survey_responses_student_id", "survey_responses", "users", ["student_id"], ["id"])
    op.create_unique_constraint(
        "uq_survey_responses_survey_id_student_id", "survey_responses", ["survey_id", "student_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_survey_responses_survey_id_student_id", "survey_responses", type_="unique")
    op.drop_constraint("fk_survey_responses_student_id", "survey_responses", type_="foreignkey")
    op.drop_column("survey_responses", "student_id")
