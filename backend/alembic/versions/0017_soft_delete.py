"""quizzes and exam sheets can be deleted

Revision ID: 0017
Revises: 0016

One that was used (a game played from the quiz, an exam run from the sheet) is only marked deleted:
it disappears from every list, while the history built on it stays whole. One never used is removed.
"""
import sqlalchemy as sa
from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quizzes", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("exams", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("exams", "deleted_at")
    op.drop_column("quizzes", "deleted_at")
