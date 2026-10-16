"""What the host's report and podium say about a player's behaviour. They are hints, never proof:
nobody is removed or penalised unless the host decides so, on the podium.

The player's screen is what is watched: leaving the tab, switching to another window, leaving full
screen. The browser reports these as signals (easy to block, so they are only counted and shown).
How fast or how evenly a player answers is NOT judged: a quick reader is not a cheater."""

from collections.abc import Mapping

# What makes a player a suspect on the host's podium: the player's screen was left.
SUSPECT_KINDS = ("TAB_BLUR", "WINDOW_BLUR", "FULLSCREEN_EXIT")
# Counted and listed, but not a reason on its own.
HINT_KINDS = ("PASTE",)

KINDS = (*SUSPECT_KINDS, *HINT_KINDS)


def flags_from_signals(signals: Mapping[str, Mapping[str, int]]) -> dict[str, list[dict[str, int | str]]]:
    """player id -> [{kind, count}] for every player the browser reported at least once."""
    result: dict[str, list[dict[str, int | str]]] = {}
    for player, counts in signals.items():
        flags = [{"kind": kind, "count": counts[kind]} for kind in KINDS if counts.get(kind, 0) > 0]
        if flags:
            result[player] = flags
    return result
