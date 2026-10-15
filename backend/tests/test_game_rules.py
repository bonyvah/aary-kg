import pytest

from app.game import anticheat, characters, nicknames, scoring
from app.game.anticheat import Answer

# --- scoring ---------------------------------------------------------------------------------


def test_points_range_and_speed():
    assert scoring.points(True, 20_000, 20_000) == 1000  # answered at once
    assert scoring.points(True, 0, 20_000) == 500  # answered at the buzzer
    assert scoring.points(True, 10_000, 20_000) == 750
    assert scoring.points(False, 20_000, 20_000) == 0
    # same shape for every allowed time: 500 + 500 * share of time left
    assert scoring.points(True, 5_000, 10_000) == 750
    assert scoring.points(True, 15_000, 60_000) == 625


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


def ans(*items):
    return [Answer(q, ms, ok) for q, (ms, ok) in enumerate(items)]


def kinds(flags, player):
    return {f["kind"]: f["count"] for f in flags.get(player, [])}


def test_fast_correct_answers_need_two_to_flag():
    flags = anticheat.compute_flags(
        {
            "once": ans((300, True), (5000, True)),
            "twice": ans((300, True), (350, True), (5000, True)),
            "wrong_fast": ans((100, False), (120, False)),
        },
        {},
    )
    assert "once" not in flags and "wrong_fast" not in flags
    assert kinds(flags, "twice") == {"FAST_ANSWERS": 2}


def test_same_timing_needs_three_players_close_together_on_two_questions():
    close = {  # q0 and q1: a, b, c within 150 ms
        "a": ans((5000, True), (7000, True)),
        "b": ans((5100, True), (7050, True)),
        "c": ans((5140, True), (7140, True)),
        "slow": ans((9000, True), (9000, True)),
    }
    flags = anticheat.compute_flags(close, {})
    for p in "abc":
        assert kinds(flags, p) == {"SAME_TIMING": 2}
    assert "slow" not in flags

    once = {**close, "c": ans((5140, True), (9999, True))}  # only q0 clusters
    assert anticheat.compute_flags(once, {}) == {}

    two_only = {"a": close["a"], "b": close["b"]}  # a pair is not a group
    assert anticheat.compute_flags(two_only, {}) == {}


def test_steady_timing_needs_all_correct_enough_answers_and_tiny_variance():
    steady = ans((4000, True), (4030, True), (3990, True), (4020, True), (4010, True))
    flags = anticheat.compute_flags({"bot": steady, "short": steady[:4]}, {})
    assert kinds(flags, "bot") == {"STEADY_TIMING": 5} and "short" not in flags
    mixed = ans((4000, True), (4030, True), (3990, True), (4020, True), (4010, False))
    assert anticheat.compute_flags({"p": mixed}, {}) == {}
    varied = ans((2000, True), (6000, True), (3000, True), (9000, True), (4000, True))
    assert anticheat.compute_flags({"p": varied}, {}) == {}


def test_browser_signals_are_counted_and_kept_in_order():
    flags = anticheat.compute_flags(
        {"a": ans((5000, True))}, {"a": {"PASTE": 2, "TAB_BLUR": 4}, "ghost": {"TAB_BLUR": 1}}
    )
    assert flags["a"] == [{"kind": "TAB_BLUR", "count": 4}, {"kind": "PASTE", "count": 2}]
    assert flags["ghost"] == [{"kind": "TAB_BLUR", "count": 1}]  # signals alone are shown too


def test_nothing_flagged_for_a_normal_game():
    assert anticheat.compute_flags({"a": ans((5000, True), (8000, False), (3000, True))}, {}) == {}
