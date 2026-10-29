"""a quiz can have a cover image

Revision ID: 0018
Revises: 0017

The id of the image in the bucket (the hash of its WebP file). Question images live in the
questions document, as everything else about a question does.
"""
import sqlalchemy as sa
from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quizzes", sa.Column("image", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("quizzes", "image")
