"""Points for one answer, and places.

Speed scoring (the default): wrong or missing answers score nothing; a correct one scores 500 to 1000,
more the earlier it came. Any right answer in the first FULL_POINTS_MS scores the full 1000 (nobody
taps faster than that, and it absorbs network jitter); after that the points fall evenly to 500 at
the buzzer. Integer maths, so no float drift.
Flat scoring: a correct answer is worth 1, however long it took, and equal scores share a place.
"""

from typing import Literal

Scoring = Literal["speed", "flat"]

BASE_POINTS = 500
MAX_BONUS = 500
FULL_POINTS_MS = 500


def points(correct: bool, remaining_ms: int, total_ms: int) -> int:
    if not correct or total_ms <= 0:
        return 0
    elapsed = total_ms - min(max(remaining_ms, 0), total_ms)
    span = max(1, total_ms - FULL_POINTS_MS)
    left = span - min(max(0, elapsed - FULL_POINTS_MS), span)
    return BASE_POINTS + (MAX_BONUS * left + span // 2) // span


def flat_points(correct: bool) -> int:
    return 1 if correct else 0


def places(scores: list[int], shared: bool) -> list[int]:
    """The place of each score in a list already in standing order. Shared: equal scores get the
    same place and the next one skips (1, 1, 3). Otherwise 1, 2, 3: the order already broke the tie."""
    if not shared:
        return list(range(1, len(scores) + 1))
    out: list[int] = []
    for i, score in enumerate(scores):
        out.append(out[-1] if i and score == scores[i - 1] else i + 1)
    return out
