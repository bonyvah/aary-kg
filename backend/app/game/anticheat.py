"""Suspicious-pattern flags for the host's report. They are hints, never proof: nobody is removed
or penalised because of a flag. Pure functions over what the server measured itself."""

from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from statistics import pstdev

# A correct answer in under 0.4 s of the question being shown is faster than reading it.
FAST_MS = 400
FAST_MIN_COUNT = 2
# Three or more players answering within 0.15 s of each other, on two or more questions.
SAME_WINDOW_MS = 150
SAME_MIN_PLAYERS = 3
SAME_MIN_QUESTIONS = 2
# Every answer right, at least 5 answers, and response times that barely vary (stdev under 0.12 s).
STEADY_MIN_ANSWERS = 5
STEADY_MAX_STDEV_MS = 120

KINDS = ("TAB_BLUR", "PASTE", "FAST_ANSWERS", "SAME_TIMING", "STEADY_TIMING")


@dataclass(frozen=True)
class Answer:
    question: int  # position in the game, from 0
    ms: int  # server-measured time from the question being shown to the answer, latency compensated
    correct: bool


def _same_timing_questions(answers_by_player: Mapping[str, Sequence[Answer]]) -> Counter[str]:
    """For each player, on how many questions they were in a tight cluster of 3+ answers."""
    per_question: dict[int, list[tuple[int, str]]] = {}
    for player, answers in answers_by_player.items():
        for a in answers:
            per_question.setdefault(a.question, []).append((a.ms, player))
    hits: Counter[str] = Counter()
    for entries in per_question.values():
        entries.sort()
        flagged: set[str] = set()
        start = 0
        for end in range(len(entries)):
            while entries[end][0] - entries[start][0] > SAME_WINDOW_MS:
                start += 1
            if end - start + 1 >= SAME_MIN_PLAYERS:
                flagged.update(player for _, player in entries[start : end + 1])
        hits.update(flagged)
    return hits


def compute_flags(
    answers_by_player: Mapping[str, Sequence[Answer]],
    signals: Mapping[str, Mapping[str, int]],
) -> dict[str, list[dict[str, int | str]]]:
    """player id -> [{kind, count}] for every player who has at least one flag.

    `signals` are what the browser reported (TAB_BLUR, PASTE): easy to fake or block, so they are
    only shown, with their counts.
    """
    same = _same_timing_questions(answers_by_player)
    result: dict[str, list[dict[str, int | str]]] = {}
    for player in set(answers_by_player) | set(signals):
        answers = answers_by_player.get(player, [])
        counts: dict[str, int] = {
            "TAB_BLUR": signals.get(player, {}).get("TAB_BLUR", 0),
            "PASTE": signals.get(player, {}).get("PASTE", 0),
            "FAST_ANSWERS": sum(1 for a in answers if a.correct and a.ms < FAST_MS),
            "SAME_TIMING": same.get(player, 0),
            "STEADY_TIMING": 0,
        }
        if counts["FAST_ANSWERS"] < FAST_MIN_COUNT:
            counts["FAST_ANSWERS"] = 0
        if counts["SAME_TIMING"] < SAME_MIN_QUESTIONS:
            counts["SAME_TIMING"] = 0
        if (
            len(answers) >= STEADY_MIN_ANSWERS
            and all(a.correct for a in answers)
            and pstdev(a.ms for a in answers) < STEADY_MAX_STDEV_MS
        ):
            counts["STEADY_TIMING"] = len(answers)
        flags = [{"kind": k, "count": counts[k]} for k in KINDS if counts[k] > 0]
        if flags:
            result[player] = flags
    return result
