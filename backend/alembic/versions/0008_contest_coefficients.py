"""contests: criteria carry a coefficient instead of a percent weight

Revision ID: 0008
Revises: 0007

A weight of 60 percent becomes the coefficient 6.0 (weight / 10): the ratios between the criteria
stay exactly the same, so no existing result changes.
"""
import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def _convert(rows, rewrite) -> list[tuple[str, list[dict]]]:
    return [(str(row.id), [rewrite(dict(c)) for c in row.criteria]) for row in rows]


def _write(connection, converted) -> None:
    for contest_id, criteria in converted:
        connection.execute(
            sa.text("UPDATE contests SET criteria = CAST(:criteria AS jsonb) WHERE id = CAST(:id AS uuid)"),
            {"criteria": sa.JSON().bind_processor(connection.dialect)(criteria), "id": contest_id},
        )


def upgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, criteria FROM contests")).all()

    def rewrite(c: dict) -> dict:
        c["coefficient"] = int(c.pop("weight")) / 10
        return c

    _write(connection, _convert(rows, rewrite))


def downgrade() -> None:
    # Exact for contests converted by upgrade(); a contest made with other coefficients keeps their ratio only roughly.
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, criteria FROM contests")).all()

    def rewrite(c: dict) -> dict:
        c["weight"] = max(1, min(100, round(float(c.pop("coefficient")) * 10)))
        return c

    _write(connection, _convert(rows, rewrite))
