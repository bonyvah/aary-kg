"""survey questions: a multiple-select limit is a min and a max

Revision ID: 0021
Revises: 0020

The limit {mode: none | min | max | exact, n} becomes {min, max}: min is at least 1, a missing max
means as many as there are choices. Sheets and the surveys that copied them are both rewritten.
"""

import json

import sqlalchemy as sa
from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None

TABLES = ("survey_sheets", "surveys")


def _to_range(limit: dict) -> dict:
    mode, n = limit.get("mode", "none"), limit.get("n")
    if mode == "min":
        return {"min": n, "max": None}
    if mode == "max":
        return {"min": 1, "max": n}
    if mode == "exact":
        return {"min": n, "max": n}
    return {"min": 1, "max": None}


def _to_modes(limit: dict) -> dict:
    low, high = limit.get("min", 1), limit.get("max")
    if high is None:
        return {"mode": "none", "n": None} if low == 1 else {"mode": "min", "n": low}
    if low == high:
        return {"mode": "exact", "n": low}
    if low == 1:
        return {"mode": "max", "n": high}
    # No old mode holds both ends: keep the max.
    return {"mode": "max", "n": high}


def _rewrite(convert, old_key: str) -> None:
    bind = op.get_bind()
    for table in TABLES:
        rows = bind.execute(sa.text(f"SELECT id, questions FROM {table}")).all()
        for row_id, questions in rows:
            changed = False
            for q in questions:
                if q.get("kind") == "multi" and old_key in q.get("limit", {}):
                    q["limit"] = convert(q["limit"])
                    changed = True
            if changed:
                bind.execute(
                    sa.text(f"UPDATE {table} SET questions = CAST(:q AS jsonb) WHERE id = :id"),
                    {"q": json.dumps(questions), "id": row_id},
                )


def upgrade() -> None:
    _rewrite(_to_range, "mode")


def downgrade() -> None:
    _rewrite(_to_modes, "min")
