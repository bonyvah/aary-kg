"""Contest scoring, exactly as written in docs/contest-scoring.md. Pure functions, no database.

Scores go 1-5 and each criterion has a coefficient (0.01 to 10), so a jury member's score for an
entry is sum(score * coefficient) / sum(coefficient). Everything is kept in exact fractions and
rounded half up to 2 decimals only at the end, so there is no floating point drift when two entries
are compared.
"""

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from fractions import Fraction
from typing import Any

# scores[(user_id, entry_id)] = {criterion_id: score}
Sheets = Mapping[tuple[str, str], Mapping[str, int]]


MIN_COEFFICIENT, MAX_COEFFICIENT = 1, 1000  # in hundredths: 0.01 to 10


def coefficient_hundredths(value: Any) -> int | None:
    """The coefficient as a whole number of hundredths, or None when it is not a number with at
    most 2 decimals between 0.01 and 10."""
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        return None
    hundredths_ = round(value * 100)
    if abs(value * 100 - hundredths_) > 1e-9 or not MIN_COEFFICIENT <= hundredths_ <= MAX_COEFFICIENT:
        return None
    return hundredths_


def valid_coefficient(value: Any) -> bool:
    return coefficient_hundredths(value) is not None


def hundredths(value: Fraction) -> int:
    """Round half up to 2 decimals and return it as an integer count of hundredths."""
    return int((value * 100 + Fraction(1, 2)) // 1)


def juror_entry_score(
    criteria: Sequence[Mapping[str, Any]], sheet: Mapping[str, int] | None
) -> Fraction | None:
    """One jury member's score for one entry. None until every criterion has a score."""
    if not criteria or not sheet:
        return None
    total, weights = 0, 0
    for criterion in criteria:
        score = sheet.get(criterion["id"])
        if score is None:
            return None
        k = coefficient_hundredths(criterion["coefficient"]) or 0
        total += score * k
        weights += k
    return Fraction(total, weights) if weights else None


def _mean(values: Sequence[Fraction]) -> Fraction | None:
    return sum(values, Fraction(0)) / len(values) if values else None


def _as_float(value: Fraction | None) -> float | None:
    return None if value is None else hundredths(value) / 100


@dataclass
class _Row:
    entry: Mapping[str, Any]
    final: int | None  # hundredths
    per_criterion: dict[str, float | None]
    jury_count: int


def rank_entries(
    criteria: Sequence[Mapping[str, Any]],
    entries: Sequence[Mapping[str, Any]],
    finished_user_ids: Sequence[str],
    sheets: Sheets,
) -> list[dict[str, Any]]:
    """Highest final score first. Equal scores (at 2 decimals) share the place: 1, 1, 3."""
    rows: list[_Row] = []
    for entry in entries:
        totals: list[Fraction] = []
        per_criterion_values: dict[str, list[Fraction]] = {c["id"]: [] for c in criteria}
        for user_id in finished_user_ids:
            sheet = sheets.get((user_id, entry["id"]))
            total = juror_entry_score(criteria, sheet)
            if total is None or sheet is None:
                continue
            totals.append(total)
            for c in criteria:
                per_criterion_values[c["id"]].append(Fraction(sheet[c["id"]]))
        mean = _mean(totals)
        rows.append(
            _Row(
                entry=entry,
                final=None if mean is None else hundredths(mean),
                per_criterion={c["id"]: _as_float(_mean(per_criterion_values[c["id"]])) for c in criteria},
                jury_count=len(totals),
            )
        )

    scored = sorted((r for r in rows if r.final is not None), key=lambda r: -(r.final or 0))
    ranked = []
    for row in scored:
        first_equal = next(i for i, other in enumerate(scored) if other.final == row.final)
        shared = sum(1 for other in scored if other.final == row.final) > 1
        ranked.append(_out(row, first_equal + 1, shared))
    unscored = [_out(r, None, False) for r in rows if r.final is None]
    return ranked + unscored


def _out(row: _Row, rank: int | None, shared: bool) -> dict[str, Any]:
    return {
        "entry": {
            "id": row.entry["id"],
            "name": row.entry["name"],
            "description": row.entry["description"],
        },
        "finalScore": None if row.final is None else row.final / 100,
        "rank": rank,
        "shared": shared,
        "perCriterion": row.per_criterion,
        "juryCount": row.jury_count,
    }


def entry_breakdown(
    criteria: Sequence[Mapping[str, Any]],
    entry_id: str,
    finished_jury: Sequence[tuple[str, str]],  # (user_id, name) in jury order
    sheets: Sheets,
) -> list[dict[str, Any]]:
    """Every finished jury member's scores for one entry, for the owner's breakdown."""
    rows = []
    for user_id, name in finished_jury:
        sheet = sheets.get((user_id, entry_id))
        total = juror_entry_score(criteria, sheet)
        rows.append(
            {
                "userId": user_id,
                "name": name,
                "scores": {c["id"]: (sheet or {}).get(c["id"]) for c in criteria},
                "total": _as_float(total),
            }
        )
    return rows
