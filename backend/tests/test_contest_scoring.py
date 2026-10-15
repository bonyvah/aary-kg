"""Ported from frontend/scripts/check-scoring.mts: the same hand-worked numbers."""

from app.services.contest_scoring import (
    entry_breakdown,
    hundredths,
    juror_entry_score,
    rank_entries,
)

CRITERIA = [
    {"id": "c1", "name": "Voice", "weight": 40},
    {"id": "c2", "name": "Stage", "weight": 30},
    {"id": "c3", "name": "Piece", "weight": 30},
]
ENTRIES = [{"id": f"e{i}", "name": f"Entry {i}", "description": ""} for i in range(1, 6)]
RAW = {  # per jury member, per entry, the scores of the three criteria
    "aizhan": [(5, 4, 5), (4, 4, 4), (4, 4, 4), (3, 3, 4), (2, 3, 2)],
    "omur": [(5, 5, 4), (4, 3, 5), (4, 3, 5), (3, 4, 3), (3, 2, 2)],
    "gulzat": [(4, 5, 5), (5, 4, 4), (5, 4, 4), (4, 3, 3), (2, 2, 3)],
}
SHEETS = {
    (user, ENTRIES[i]["id"]): {c["id"]: s for c, s in zip(CRITERIA, values, strict=True)}
    for user, per_entry in RAW.items()
    for i, values in enumerate(per_entry)
}
JURY = list(RAW)


def test_final_scores_ranks_and_shared():
    ranked = rank_entries(CRITERIA, ENTRIES, JURY, SHEETS)
    assert [r["finalScore"] for r in ranked] == [4.67, 4.13, 4.13, 3.33, 2.33]
    assert [r["rank"] for r in ranked] == [1, 2, 2, 4, 5]  # shared place, next one skipped
    assert [r["shared"] for r in ranked] == [False, True, True, False, False]
    assert all(r["juryCount"] == 3 for r in ranked)
    assert ranked[0]["perCriterion"]["c1"] == 4.67 and ranked[0]["perCriterion"]["c3"] == 4.67


def test_only_finished_jury_count():
    ranked = rank_entries(CRITERIA, ENTRIES, ["aizhan"], SHEETS)
    assert ranked[0]["finalScore"] == 4.7 and all(r["juryCount"] == 1 for r in ranked)


def test_entry_nobody_scored_has_no_score_and_no_rank_and_sorts_last():
    ranked = rank_entries(CRITERIA, ENTRIES, JURY, {k: v for k, v in SHEETS.items() if k[1] != "e1"})
    assert ranked[-1]["entry"]["id"] == "e1"
    assert ranked[-1]["finalScore"] is None and ranked[-1]["rank"] is None
    assert [r["rank"] for r in ranked[:-1]] == [1, 1, 3, 4]


def test_incomplete_sheet_does_not_count():
    assert juror_entry_score(CRITERIA, {"c1": 5, "c2": 4}) is None
    assert juror_entry_score(CRITERIA, None) is None
    assert juror_entry_score([], {"c1": 5}) is None
    ranked = rank_entries(CRITERIA, ENTRIES[:1], ["aizhan"], {("aizhan", "e1"): {"c1": 5, "c2": 5}})
    assert ranked[0]["finalScore"] is None


def test_weighted_score():
    assert hundredths(juror_entry_score(CRITERIA, {"c1": 5, "c2": 4, "c3": 5})) == 470  # 4.7


def test_rounding_is_half_up_and_exact():
    from fractions import Fraction

    assert hundredths(Fraction(2675, 1000)) == 268  # a float would give 2.67
    assert hundredths(Fraction(41333, 10000)) == 413
    assert hundredths(Fraction(4125, 1000)) == 413


def test_equal_averages_share_the_place():
    # Scores are compared at 2 decimals. Here both entries average 3.67, so they share the place.
    criteria = [{"id": "c", "name": "C", "weight": 100}]
    entries = [
        {"id": "a", "name": "A", "description": ""},
        {"id": "b", "name": "B", "description": ""},
    ]
    sheets = {}
    # Three jurors: A gets 4, 4, 3 and B gets 4, 3, 4.
    for user, (sa, sb) in zip("xyz", [(4, 4), (4, 3), (3, 4)], strict=True):
        sheets[(user, "a")] = {"c": sa}
        sheets[(user, "b")] = {"c": sb}
    ranked = rank_entries(criteria, entries, list("xyz"), sheets)
    assert [r["rank"] for r in ranked] == [1, 1] and all(r["shared"] for r in ranked)


def test_breakdown_rows_in_jury_order_with_totals():
    jury = [("aizhan", "Aizhan"), ("omur", "Omur"), ("gulzat", "Gulzat")]
    rows = entry_breakdown(CRITERIA, "e1", jury, SHEETS)
    assert [r["name"] for r in rows] == ["Aizhan", "Omur", "Gulzat"]
    assert rows[0]["total"] == 4.7 and rows[0]["scores"]["c1"] == 5 and rows[2]["total"] == 4.6
    assert entry_breakdown(CRITERIA, "e1", [], SHEETS) == []
