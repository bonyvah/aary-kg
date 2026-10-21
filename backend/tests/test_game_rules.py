import pytest

from app.game import anticheat, characters, nicknames, scoring

# --- scoring ---------------------------------------------------------------------------------


def test_points_range_and_speed():
    assert scoring.points(True, 20_000, 20_000) == 1000  # answered at once
    assert scoring.points(True, 0, 20_000) == 500  # answered at the buzzer
    assert scoring.points(True, 10_000, 20_000) == 756  # 500 + 500 * 10 000 / 19 500
    assert scoring.points(False, 20_000, 20_000) == 0
    # same shape for every allowed time: after the first half second, evenly down to 500
    assert scoring.points(True, 5_000, 10_000) == 763
    assert scoring.points(True, 15_000, 60_000) == 626


def test_the_first_half_second_scores_the_full_1000():
    assert scoring.points(True, 20_000 - 500, 20_000) == 1000
    assert scoring.points(True, 5_000 - 500, 5_000) == 1000
    assert scoring.points(True, 20_000 - 520, 20_000) == 999  # and then it falls, without a jump


def test_points_clamps_out_of_range_time():
    assert scoring.points(True, -50, 20_000) == 500
    assert scoring.points(True, 99_999, 20_000) == 1000
    assert scoring.points(True, 1, 0) == 0


# --- characters ------------------------------------------------------------------------------


def test_random_character_is_valid_and_validation_is_strict():
    for _ in range(50):
        assert characters.is_character(characters.random_character())
    ok = {"shape": "star", "color": "teal", "face": "shy"}
    assert characters.is_character(ok)
    assert not characters.is_character({**ok, "shape": "dragon"})
    assert not characters.is_character({**ok, "extra": "x"})
    assert not characters.is_character({"shape": "star", "color": "teal"})
    assert not characters.is_character("star")
    assert not characters.is_character(None)
    assert not characters.is_character({**ok, "face": ["shy"]})  # unhashable value must not crash


# --- nicknames -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("  Alex  ", "Alex"),
        ("Alex   K", "Alex K"),
        ("tab\there", "tab here"),  # whitespace of any kind collapses to one space
        ("Айдана", "Айдана"),
        ("Өмүр", "Өмүр"),
        ("Player1", "Player1"),
        ("🦊 fox", "🦊 fox"),
        ("x" * 20, "x" * 20),
    ],
)
def test_valid_nicknames(raw, expected):
    assert nicknames.validate(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "   ",
        "x" * 21,
        "Admin",
        "аdmin",  # Cyrillic а
        "H0ST",
        "ХОСТ",
        "Ведущий",
        "a.d.m.i.n",
        "zero​width",  # invisible character
        "!!!",
        "fuck you",
        "ПиЗдА",
        "sh1t",
    ],
)
def test_invalid_nicknames(raw):
    with pytest.raises(nicknames.NicknameError) as e:
        nicknames.validate(raw)
    assert e.value.code == "NICKNAME_INVALID"


def test_skeleton_treats_lookalikes_case_and_spaces_as_the_same_name():
    assert nicknames.skeleton("Alex") == nicknames.skeleton("аLEх")  # Cyrillic а, х
    assert nicknames.skeleton("Al ex") == nicknames.skeleton("alex")
    assert nicknames.skeleton("Айдана") != nicknames.skeleton("Айдан")


# --- anti-cheat ------------------------------------------------------------------------------


def test_leaving_the_screen_is_what_flags_a_player():
    flags = anticheat.flags_from_signals(
        {"a": {"PASTE": 2, "TAB_BLUR": 4, "FULLSCREEN_EXIT": 1}, "b": {"WINDOW_BLUR": 3}, "ghost": {}}
    )
    assert flags["a"] == [
        {"kind": "TAB_BLUR", "count": 4},
        {"kind": "FULLSCREEN_EXIT", "count": 1},
        {"kind": "PASTE", "count": 2},
    ]
    assert flags["b"] == [{"kind": "WINDOW_BLUR", "count": 3}]
    assert "ghost" not in flags


def test_answer_speed_is_not_judged():
    assert anticheat.flags_from_signals({}) == {}
    assert not hasattr(anticheat, "compute_flags")
