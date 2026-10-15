"""users: first and last name instead of one name

Revision ID: 0006
Revises: 0005
"""
import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("first_name", sa.String(60), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(60), server_default="", nullable=False))
    # Existing accounts: the first word is the first name, the rest the last name.
    op.execute(
        "UPDATE users SET first_name = left(split_part(btrim(name), ' ', 1), 60),"
        " last_name = left(btrim(substr(btrim(name), length(split_part(btrim(name), ' ', 1)) + 1)), 60)"
    )
    op.alter_column("users", "first_name", nullable=False)
    op.drop_column("users", "name")


def downgrade() -> None:
    op.add_column("users", sa.Column("name", sa.String(120), nullable=True))
    op.execute("UPDATE users SET name = btrim(first_name || ' ' || last_name)")
    op.alter_column("users", "name", nullable=False)
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
