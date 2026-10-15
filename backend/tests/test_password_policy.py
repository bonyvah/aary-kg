import pytest

from app.errors import ApiError
from app.password_policy import check, skeleton

KW = {"first_name": "Айжан", "last_name": "Касымова", "login": "aizhan.k"}


def code(password: str, **who: str) -> str | None:
    try:
        check(password, **{**KW, **who})
    except ApiError as e:
        assert e.status == 400 and e.field == "newPassword"
        return e.code
    return None


def test_a_good_password_passes():
    for ok in ["tulpar-9421", "abcd1234", "парольчик1", "7горы-Алатоо", "x" * 127 + "1"]:
        assert code(ok) is None, ok


def test_length_letter_and_digit():
    assert code("a1b2c3") == "PASSWORD_TOO_SHORT"
    assert code("abcd123") == "PASSWORD_TOO_SHORT"
    assert code("a1" + "x" * 127) == "PASSWORD_TOO_LONG"
    assert code("12345678") == "PASSWORD_NEEDS_LETTER"
    assert code("abcdefgh") == "PASSWORD_NEEDS_DIGIT"
    assert code("абвгдежз") == "PASSWORD_NEEDS_DIGIT"
    assert code("--------1") == "PASSWORD_NEEDS_LETTER"


def test_no_capital_or_special_character_is_required():
    assert code("alllowercase1") is None and code("ALLUPPERCASE1") is None


@pytest.mark.parametrize(
    "password",
    [
        "Айжан2024",  # the name as written
        "айжан-77",  # lowercase Cyrillic
        "Aizhan2024",  # the usual Latin spelling
        "ayzhan123",  # another spelling
        "AIJAN-77x",  # capitals
        "my.aizhan.pass1",  # in the middle
        "Aidzhan123",  # dzh
        "касымова9",  # last name
        "Kasymova9",
        "kasimova99",
        "Kassymova1",  # doubled letter
        "xxKASYMOVAxx1",
    ],
)
def test_the_name_in_any_alphabet_is_refused(password):
    assert code(password) == "PASSWORD_CONTAINS_NAME"


@pytest.mark.parametrize(
    ("first", "last", "password"),
    [
        ("Өмүр", "Эшматов", "omur12345"),  # ө and ү typed as o and u
        ("Өмүр", "Эшматов", "Ömür-12345"),  # typed with the umlauts
        ("Өмүр", "Эшматов", "OMUR12345"),
        ("Үсөн", "Алиев", "uson1234"),
        ("Үсөн", "Алиев", "ÜSÖN1234"),
        ("Ңурлан", "Алиев", "nurlan2025"),  # ң as n
        ("Ңурлан", "Алиев", "Ngurlan2025"),  # ң as ng
        ("Чолпон", "Алиев", "cholpon-12"),
        ("Жылдыз", "Алиев", "jyldyz2020"),
        ("Жылдыз", "Алиев", "zhyldyz2020"),
        ("Мээрим", "Алиев", "meerim2020"),
        ("Алиев", "Щербак", "Scherbak99"),
        ("Алиев", "Хан", "khan-2020"),
        ("Бек", "Алиев", "x-BEK-x-1"),
    ],
)
def test_kyrgyz_letters_and_spellings(first, last, password):
    assert code(password, first_name=first, last_name=last, login="zzz") == "PASSWORD_CONTAINS_NAME"


def test_each_word_of_a_compound_name_counts():
    who = {"first_name": "Гүл-Айым", "last_name": "Мария Анна", "login": "zzz"}
    assert code("gul12345", **who) == "PASSWORD_CONTAINS_NAME"
    assert code("aiym12345", **who) == "PASSWORD_CONTAINS_NAME"
    assert code("maria12345", **who) == "PASSWORD_CONTAINS_NAME"
    assert code("anna12345", **who) == "PASSWORD_CONTAINS_NAME"


def test_the_login_counts_too():
    assert code("xxAIZHAN.K-9", first_name="Z", last_name="Z") == "PASSWORD_CONTAINS_LOGIN"
    assert code("my-bekzat77-ok", login="bekzat77") == "PASSWORD_CONTAINS_LOGIN"
    assert (
        code("my-bekzat77-ok", login="BekZat77", first_name="Q", last_name="Q") == "PASSWORD_CONTAINS_LOGIN"
    )


def test_very_short_name_parts_are_not_checked():
    # «Ай» would be inside half of all passwords.
    assert code("Rainbow-77", first_name="Ай", last_name="Эр", login="ab1") is None


def test_unrelated_passwords_are_not_refused_by_accident():
    assert code("tulpar-9421") is None
    assert code("Bishkek-2024", first_name="Айжан", last_name="Касымова") is None


def test_skeleton_is_the_same_across_spellings():
    same = [
        ["Айжан", "Aizhan", "ayzhan", "AIJAN", "aiJan"],
        ["Өмүр", "Omur", "Ömür", "OMUR"],
        ["Ңурлан", "Nurlan"],
    ]
    for group in same:
        assert len({skeleton(w) for w in group}) == 1, group
    assert skeleton("Асан") != skeleton("Усен")
