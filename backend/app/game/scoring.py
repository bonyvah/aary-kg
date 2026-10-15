"""Points for one answer. Wrong or missing answers score nothing; a correct one scores 500 to 1000,
more the earlier it came: 500 + 500 * (time left / time allowed). Integer maths, so no float drift."""

BASE_POINTS = 500
MAX_BONUS = 500


def points(correct: bool, remaining_ms: int, total_ms: int) -> int:
    if not correct or total_ms <= 0:
        return 0
    remaining = min(max(remaining_ms, 0), total_ms)
    return BASE_POINTS + (MAX_BONUS * remaining + total_ms // 2) // total_ms
