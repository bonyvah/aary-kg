"""A player's character is three ids from fixed lists (same as frontend/.../characters.ts)."""

import secrets
from typing import Any

SHAPES = ("triangle", "diamond", "circle", "square", "hexagon", "star", "heart", "pill")
COLORS = ("red", "blue", "yellow", "green", "orange", "purple", "pink", "teal")
FACES = (
    "smile",
    "grin",
    "wink",
    "surprised",
    "glasses",
    "sleepy",
    "cool",
    "happy",
    "tongue",
    "angry",
    "stars",
    "shy",
)


def random_character() -> dict[str, str]:
    return {
        "shape": secrets.choice(SHAPES),
        "color": secrets.choice(COLORS),
        "face": secrets.choice(FACES),
    }


def is_character(value: Any) -> bool:
    """Exactly the three keys, each from its list. Anything else (extra keys, other types) is no."""
    return (
        isinstance(value, dict)
        and set(value) == {"shape", "color", "face"}
        and value["shape"] in SHAPES
        and value["color"] in COLORS
        and value["face"] in FACES
    )
