"""What a password a person chooses must satisfy.

8 to 128 characters, at least one letter (any alphabet) and one digit. Capitals and special
characters are not required. It must not contain the person's first name, last name or login, and
that holds across alphabets: names are written in Cyrillic (with the Kyrgyz letters ө ң ү), people
type them in Latin, so «Айжан», «Aizhan», «ayzhan» and «AIJAN1» are all the same name here.

Errors are codes (never text): the frontend translates them.
"""

import re
import unicodedata

from app.errors import ApiError

MIN_LENGTH, MAX_LENGTH = 8, 128
# A part of a name this short («Ай», «Эр») would match half of all passwords, so it is not checked.
MIN_NAME_PART = 3

# Cyrillic to the way it is usually typed in Latin. Digraphs here, sound classes below.
_CYRILLIC = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo", "ж": "zh", "з": "z",
    "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "ң": "ng", "о": "o", "ө": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ү": "u", "ф": "f", "х": "kh", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}  # fmt: skip

# Latin spellings that sound the same become one letter. Capitals are classes (the text is
# lowercase before this, so they can't clash with real letters).
_DIGRAPHS = (
    ("shch", "W"), ("sch", "W"), ("dzh", "J"), ("zh", "J"), ("dj", "J"), ("sh", "S"), ("ch", "C"),
    ("kh", "H"), ("ts", "T"), ("ng", "n"),
)  # fmt: skip
_SINGLES = str.maketrans({"x": "H", "h": "H", "j": "J", "q": "k", "c": "k", "w": "v", "y": "i"})
_SEPARATORS = re.compile(r"[\s\-_.]+")
_REPEATS = re.compile(r"(.)\1+")


def skeleton(text: str) -> str:
    """The text with spelling differences removed: same for «Өмүр», «Omur», «Ömür» and «OMUR»."""
    text = unicodedata.normalize("NFKC", text).casefold()
    text = "".join(_CYRILLIC.get(ch, ch) for ch in text)
    # Drop accents (ü -> u, ö -> o) and everything that is not a letter or a digit.
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch) and ch.isalnum())
    for spelling, sound in _DIGRAPHS:
        text = text.replace(spelling, sound)
    return _REPEATS.sub(r"\1", text.translate(_SINGLES))


def _parts(value: str) -> set[str]:
    """The whole value and each word of it (compound names: «Гүл-Айым», «Мария Анна»)."""
    words = [w for w in _SEPARATORS.split(value.strip()) if w]
    return {skeleton(piece) for piece in [value, *words]}


def check(password: str, *, first_name: str, last_name: str, login: str, field: str = "newPassword") -> None:
    """Raises ApiError(400, code, field) for the first rule the password breaks."""

    def refuse(code: str) -> ApiError:
        return ApiError(400, code, field)

    if len(password) < MIN_LENGTH:
        raise refuse("PASSWORD_TOO_SHORT")
    if len(password) > MAX_LENGTH:
        raise refuse("PASSWORD_TOO_LONG")
    if not any(ch.isalpha() for ch in password):
        raise refuse("PASSWORD_NEEDS_LETTER")
    if not any("0" <= ch <= "9" for ch in password):
        raise refuse("PASSWORD_NEEDS_DIGIT")

    haystack = skeleton(password)
    named = _parts(first_name) | _parts(last_name)
    if any(len(part) >= MIN_NAME_PART and part in haystack for part in named):
        raise refuse("PASSWORD_CONTAINS_NAME")
    if any(len(part) >= MIN_NAME_PART and part in haystack for part in _parts(login)):
        raise refuse("PASSWORD_CONTAINS_LOGIN")
