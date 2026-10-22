"""users: the role `user` is now called `teacher`

Revision ID: 0010
Revises: 0009
"""
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE users SET role = 'teacher' WHERE role = 'user'")


def downgrade() -> None:
    op.execute("UPDATE users SET role = 'user' WHERE role = 'teacher'")
