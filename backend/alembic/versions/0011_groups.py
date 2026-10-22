"""groups of students, managed by admins

Revision ID: 0011
Revises: 0010

A student belongs to exactly one group; teachers and admins to none. A group with students in it
can't be deleted.
"""
import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "groups",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ux_groups_name_lower", "groups", [sa.text("lower(name)")], unique=True)
    op.add_column("users", sa.Column("group_id", sa.UUID(), nullable=True))
    op.create_foreign_key("fk_users_group_id", "users", "groups", ["group_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_users_group_id", "users", ["group_id"])


def downgrade() -> None:
    op.drop_index("ix_users_group_id", table_name="users")
    op.drop_constraint("fk_users_group_id", "users", type_="foreignkey")
    op.drop_column("users", "group_id")
    op.drop_index("ux_groups_name_lower", table_name="groups")
    op.drop_table("groups")
