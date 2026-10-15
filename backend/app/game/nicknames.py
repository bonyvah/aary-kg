"""Nickname rules: trimmed, 1-20 characters, no look-alike impersonation of the host or staff, no
profanity. The word lists are plain text and easy to extend: see nickname_blocklist.txt."""

import unicodedata
from pathlib import Path

MAX_LENGTH = 20

# Cyrillic letters that look like Latin ones, folded to the Latin letter. Used only to compare:
# "Аdmin" (Cyrillic А) must not get past "admin", and "Alex" / "Аlех" are the same name.
_LOOKALIKES = str.maketrans(
    {
        "а": "a", "в": "b", "е": "e", "ё": "e", "к": "k", "м": "m", "н": "h", "о": "o",
        "р": "p", "с": "c", "т": "t", "у": "y", "х": "x", "і": "i", "ү": "y", "ө": "o",
        "ң": "h", "ь": "b",
    }
)  # fmt: skip
# Digits people swap in for letters. Only applied when looking for reserved words and profanity.
_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s"})

RESERVED = (
    "host", "admin", "administrator", "moderator", "staff", "system", "support", "aary",
    "ведущий", "хост", "админ", "администратор", "модератор", "система", "жетекчи", "башкаруучу",
)  # fmt: skip


class NicknameError(Exception):
    """The nickname is not allowed. `code` is the stable error code."""

    def __init__(self, code: str = "NICKNAME_INVALID") -> None:
        super().__init__(code)
        self.code = code


def _load_blocklist() -> tuple[str, ...]:
    path = Path(__file__).with_name("nickname_blocklist.txt")
    lines = path.read_text(encoding="utf-8").splitlines()
    return tuple(line.strip() for line in lines if line.strip() and not line.startswith("#"))


def clean(raw: str) -> str:
    """Trim and collapse inner whitespace, so «Alex   K » is «Alex K»."""
    return " ".join(unicodedata.normalize("NFKC", raw).split())


def skeleton(nickname: str) -> str:
    """What two nicknames are compared by: case, spaces, punctuation and look-alike letters ignored."""
    folded = unicodedata.normalize("NFKC", nickname).casefold().translate(_LOOKALIKES)
    return "".join(ch for ch in folded if ch.isalnum())


def _forbidden_form(nickname: str) -> str:
    folded = unicodedata.normalize("NFKC", nickname).casefold().translate(_LEET).translate(_LOOKALIKES)
    return "".join(ch for ch in folded if ch.isalnum())


_BLOCKED = tuple(_forbidden_form(word) for word in _load_blocklist())
_RESERVED = tuple(_forbidden_form(word) for word in RESERVED)


def validate(raw: str) -> str:
    """Returns the cleaned nickname or raises NicknameError."""
    nickname = clean(raw)
    if not 1 <= len(nickname) <= MAX_LENGTH:
        raise NicknameError()
    for ch in nickname:
        # Letters, digits, spaces, punctuation and emoji are fine. Control, format (zero-width)
        # and private-use characters are not: they make invisible or confusing names.
        if unicodedata.category(ch)[0] == "C" or ch in "  ":
            raise NicknameError()
    form = _forbidden_form(nickname)
    if not form:  # only punctuation or symbols: nothing to tell it apart by
        raise NicknameError()
    if any(word in form for word in _RESERVED) or any(word in form for word in _BLOCKED):
        raise NicknameError()
    return nickname
