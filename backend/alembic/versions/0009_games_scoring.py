"""games: how the answers were scored, speed (500 to 1000) or flat (1 per right answer)

Revision ID: 0009
Revises: 0008

Every game so far was a speed game.
"""
import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("games", sa.Column("scoring", sa.String(8), server_default="speed", nullable=False))


def downgrade() -> None:
    op.drop_column("games", "scoring")
