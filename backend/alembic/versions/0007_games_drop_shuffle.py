"""games: drop the shuffle flag (the question order is the quiz's own)

Revision ID: 0007
Revises: 0006
"""
import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("games", "shuffle")


def downgrade() -> None:
    op.add_column("games", sa.Column("shuffle", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.alter_column("games", "shuffle", server_default=None)
