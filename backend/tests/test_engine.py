"""The game engine against a real Redis: transitions, scoring, early close, timer, kick, reconnect."""

import asyncio
from types import SimpleNamespace

import pytest

from app.game import engine as engine_module
from app.game.engine import GameEngine
from app.game.hub import Conn, Hub
from app.game.models import GameError
from app.game.state_repo import RedisGameStateRepo
from app.redis import get_redis


def make_quiz(n=3, seconds=20):
    return {
        "id": "00000000-0000-0000-0000-000000000001",
        "title": "Geography",
        "questions": [
            {
                "id": f"q{i + 1}",
                "text": f"Question {i + 1}?",
                "answers": ["a", "b", "c", "d"],
                "correct": (i % 4) + 1,  # q1 -> 1, q2 -> 2, q3 -> 3
                "seconds": seconds,
            }
            for i in range(n)
        ],
    }


@pytest.fixture
async def env():
    redis = get_redis()
    finished = []

    async def on_finished(f):
        finished.append(f)

    hub = Hub(redis)
    engine = GameEngine(RedisGameStateRepo(redis), hub, on_finished)
    ns = SimpleNamespace(engine=engine, repo=engine.repo, hub=hub, finished=finished, conns=[])
    yield ns
    for t in list(engine._tasks):
        t.cancel()
    for game_id, conn in ns.conns:
        await hub.detach(game_id, conn)


async def connect(env, game_id, role, player_id=None):
    """A fake connection that records every event it is sent."""
    events: list[dict] = []

    async def send(event):
        events.append(event)

    async def close():
        pass

    conn = Conn(role=role, send=send, close=close, player_id=player_id)
    await env.hub.attach(game_id, conn)
    env.conns.append((game_id, conn))
    return events


async def settle():
    await asyncio.sleep(0.08)  # pub/sub is async: give the events time to arrive


def of(events, type_):
    return [e for e in events if e["type"] == type_]


async def new_game(env, players=("Aida", "Bek", "Cholpon"), n=3, seconds=20):
    state = await env.engine.create_game("owner-1", make_quiz(n, seconds))
    host = await connect(env, state.id, "host")
    joined, feeds = [], []
    for name in players:
        _, player = await env.engine.join(state.pin, name)
        joined.append(player)
        feeds.append(await connect(env, state.id, "player", player.id))
    return state, host, joined, feeds


# --- lobby ----------------------------------------------------------------------------------


async def test_create_game_gives_a_pin_that_finds_it(env):
    state = await env.engine.create_game("owner-1", make_quiz())
    assert len(state.pin) == 6 and state.pin.isdigit() and state.phase == "lobby"
    assert (await env.engine.lookup_pin(state.pin)).id == state.id


@pytest.mark.parametrize("pin", ["", "12345", "1234567", "12345a", "١٢٣٤٥٦", " 12345", "12 456"])
async def test_malformed_pins_are_invalid(env, pin):
    with pytest.raises(GameError) as e:
        await env.engine.lookup_pin(pin)
    assert e.value.code == "PIN_INVALID"


async def test_unknown_pin_is_not_found(env):
    with pytest.raises(GameError) as e:
        await env.engine.lookup_pin("123456")
    assert e.value.code == "GAME_NOT_FOUND"


async def test_join_cleans_the_nickname_and_gives_a_valid_random_character(env):
    from app.game.characters import is_character

    state = await env.engine.create_game("o", make_quiz())
    _, player = await env.engine.join(state.pin, "  Aida   K  ")
    assert player.nickname == "Aida K" and is_character(player.character)


@pytest.mark.parametrize("name", ["", "   ", "x" * 21, "Admin", "ХОСТ", "fuck"])
async def test_join_rejects_bad_nicknames(env, name):
    state = await env.engine.create_game("o", make_quiz())
    with pytest.raises(GameError) as e:
        await env.engine.join(state.pin, name)
    assert e.value.code == "NICKNAME_INVALID"


async def test_nicknames_are_unique_even_with_lookalike_letters(env):
    state = await env.engine.create_game("o", make_quiz())
    await env.engine.join(state.pin, "Alex")
    for clash in ("alex", "ALEX", "Al ex", "Аlех"):  # the last one is Cyrillic А and х
        with pytest.raises(GameError) as e:
            await env.engine.join(state.pin, clash)
        assert e.value.code == "NICKNAME_TAKEN", clash


async def test_same_nickname_joined_at_once_only_one_wins(env):
    state = await env.engine.create_game("o", make_quiz())
    results = await asyncio.gather(
        *(env.engine.join(state.pin, "Same") for _ in range(8)), return_exceptions=True
    )
    assert sum(1 for r in results if not isinstance(r, Exception)) == 1
    assert await env.repo.player_count(state.id) == 1


async def test_game_full(env, monkeypatch):
    monkeypatch.setattr(engine_module, "MAX_PLAYERS", 2)
    state = await env.engine.create_game("o", make_quiz())
    await env.engine.join(state.pin, "a1")
    await env.engine.join(state.pin, "b2")
    with pytest.raises(GameError) as e:
        await env.engine.join(state.pin, "c3")
    assert e.value.code == "GAME_FULL"


async def test_lobby_updates_reach_host_and_players(env):
    state, host, _, feeds = await new_game(env, players=("Aida",))
    _, bek = await env.engine.join(state.pin, "Bek")
    await settle()
    for feed in (host, feeds[0]):
        names = [pl["nickname"] for pl in of(feed, "lobby.updated")[-1]["players"]]
        assert names == ["Aida", "Bek"]
    assert all(e["v"] == 1 for e in host)


async def test_character_can_be_changed_in_the_lobby_only_and_must_be_valid(env):
    state, host, [aida], _ = await new_game(env, players=("Aida",))
    good = {"shape": "star", "color": "teal", "face": "shy"}
    await env.engine.set_character(state.id, aida.id, good)
    assert (await env.repo.get_player(state.id, aida.id)).character == good
    await settle()
    assert of(host, "lobby.updated")[-1]["players"][0]["character"] == good
    for bad in ({"shape": "dragon", "color": "teal", "face": "shy"}, {**good, "x": 1}, "star", None):
        with pytest.raises(GameError) as e:
            await env.engine.set_character(state.id, aida.id, bad)
        assert e.value.code == "CHARACTER_INVALID"
    await env.engine.start(state.id)
    with pytest.raises(GameError) as e:
        await env.engine.set_character(state.id, aida.id, good)
    assert e.value.code == "INVALID_STATE"


async def test_kick_removes_the_player_frees_the_name_and_blocks_their_answers(env):
    state, host, [aida, bek], feeds = await new_game(env, players=("Aida", "Bek"))
    await env.engine.kick(state.id, aida.id)
    await settle()
    assert of(feeds[0], "kicked")
    assert [pl["nickname"] for pl in of(host, "lobby.updated")[-1]["players"]] == ["Bek"]
    await env.engine.join(state.pin, "Aida")  # the name is free again
    await env.engine.kick(state.id, "no-such-player")  # no error
    await env.engine.start(state.id)
    with pytest.raises(GameError) as e:
        await env.engine.answer(state.id, aida.id, 1)
    assert e.value.code == "UNKNOWN_PLAYER"


# --- starting -------------------------------------------------------------------------------


async def test_start_needs_players_and_only_works_once(env):
    state = await env.engine.create_game("o", make_quiz())
    with pytest.raises(GameError) as e:
        await env.engine.start(state.id)
    assert e.value.code == "NO_PLAYERS"
    await env.engine.join(state.pin, "Aida")
    await env.engine.start(state.id)
    with pytest.raises(GameError) as e:
        await env.engine.start(state.id)
    assert e.value.code == "INVALID_STATE"
    late, _ = await env.engine.join(state.pin, "Late")  # a running game can still be joined
    assert late.id == state.id
    await env.engine.end(state.id)
    with pytest.raises(GameError) as e:
        await env.engine.join(state.pin, "TooLate")
    assert e.value.code == "GAME_ENDED"


async def test_question_order_is_the_quiz_order(env):
    plain, *_ = await new_game(env, players=("A1",), n=8)
    await env.engine.start(plain.id)
    assert (await env.repo.get_game(plain.id)).order == list(range(8))


async def test_the_correct_answer_is_not_sent_before_the_reveal(env):
    state, host, _, feeds = await new_game(env)
    await env.engine.start(state.id)
    await settle()
    player_q = of(feeds[0], "question.started")[0]["question"]
    host_q = of(host, "question.started")[0]["question"]
    assert player_q == {"index": 1, "total": 3, "text": "Question 1?", "seconds": 20}
    assert "answers" not in player_q and host_q["answers"] == ["a", "b", "c", "d"]
    for events in (host, *feeds):
        assert "correct" not in str(events).replace("correctShare", "")
    # and the snapshot a reconnecting player gets is just as clean
    snap = (
        await env.engine.player_snapshot(state.id, (await env.repo.get_players(state.id))[0].id)
    ).model_dump()
    assert "correct" not in str(snap) and snap["question"]["text"] == "Question 1?"
    hsnap = (await env.engine.host_snapshot(state.id)).model_dump()
    assert hsnap["correct"] is None and hsnap["counts"] is None


# --- answering and scoring ------------------------------------------------------------------


async def test_answers_score_by_speed_and_the_last_answer_closes_the_question(env):
    state, host, [aida, bek, chol], feeds = await new_game(env)
    await env.engine.start(state.id)
    await env.engine.answer(state.id, aida.id, 1)  # right (q1 -> 1)
    await asyncio.sleep(0.2)
    await env.engine.answer(state.id, bek.id, 1)  # right, slower
    await env.engine.answer(state.id, chol.id, 3)  # wrong: the last answer closes the question
    assert (await env.repo.get_game(state.id)).phase == "counts"
    await settle()

    scores = {p.id: p.score for p in await env.repo.get_players(state.id)}
    assert 990 <= scores[aida.id] <= 1000
    assert scores[aida.id] > scores[bek.id] >= 990 - 25  # 0.2 s of 20 s costs about 5 points
    assert scores[chol.id] == 0
    closed = {i: of(feeds[i], "question.closed")[0] for i in range(3)}
    assert closed[0]["reveal"] == {"correct": 1, "points": scores[aida.id]}
    assert closed[2]["reveal"] == {"correct": 1, "points": 0} and closed[2]["rank"] == 3
    host_closed = of(host, "question.closed")[0]
    assert host_closed["counts"] == [2, 0, 1, 0] and host_closed["correct"] == 1
    assert [e["answered"] for e in of(host, "answer.count")] == [1, 2, 3]


async def test_a_second_answer_is_refused_and_the_first_stands(env):
    state, _, [aida, bek, _], _ = await new_game(env)
    await env.engine.start(state.id)
    await env.engine.answer(state.id, aida.id, 2)
    with pytest.raises(GameError) as e:
        await env.engine.answer(state.id, aida.id, 1)
    assert e.value.code == "ALREADY_ANSWERED"
    assert (await env.repo.get_answers(state.id, 0))[aida.id]["position"] == 2


async def test_parallel_answers_from_one_player_only_one_counts(env):
    state, _, [aida, *_], _ = await new_game(env)
    await env.engine.start(state.id)
    results = await asyncio.gather(
        *(env.engine.answer(state.id, aida.id, 1) for _ in range(6)), return_exceptions=True
    )
    assert sum(1 for r in results if r is None) == 1
    assert {r.code for r in results if isinstance(r, GameError)} == {"ALREADY_ANSWERED"}


async def test_answers_outside_a_question_are_refused(env):
    state, _, [aida, *_], _ = await new_game(env)
    with pytest.raises(GameError) as e:  # lobby
        await env.engine.answer(state.id, aida.id, 1)
    assert e.value.code == "ANSWER_CLOSED"
    await env.engine.start(state.id)
    await env.engine.next(state.id)  # host closes the question
    with pytest.raises(GameError) as e:  # results screen
        await env.engine.answer(state.id, aida.id, 1)
    assert e.value.code == "ANSWER_CLOSED"
    with pytest.raises(GameError) as e:
        await env.engine.answer(state.id, "ghost", 1)
    assert e.value.code == "ANSWER_CLOSED"


async def test_latency_compensation_lowers_the_time_but_the_client_clock_is_never_read(env):
    state, _, [aida, bek, _], _ = await new_game(env)
    await env.engine.start(state.id)
    await asyncio.sleep(0.1)
    await env.engine.answer(state.id, aida.id, 1, latency_ms=0)
    await env.engine.answer(state.id, bek.id, 1, latency_ms=10_000)  # absurd: capped at 300 ms
    answers = await env.repo.get_answers(state.id, 0)
    assert answers[aida.id]["ms"] >= 90
    assert answers[bek.id]["ms"] == 0  # 100 ms minus the 300 ms cap, never below zero
    # no engine method takes a client timestamp
    import inspect

    assert "timestamp" not in str(inspect.signature(env.engine.answer))


async def test_question_closes_by_itself_at_the_deadline(env):
    state, host, [aida, bek, _], feeds = await new_game(env, seconds=1)
    await env.engine.start(state.id)
    await env.engine.answer(state.id, aida.id, 1)
    assert (await env.repo.get_game(state.id)).phase == "question"
    await asyncio.sleep(1.8)  # 1 s + the 0.4 s grace
    assert (await env.repo.get_game(state.id)).phase == "counts"
    await settle()
    assert of(feeds[1], "question.closed")[0]["reveal"]["points"] == 0  # bek never answered
    assert of(host, "question.closed")[0]["counts"] == [1, 0, 0, 0]


async def test_closing_twice_changes_nothing(env):
    state, host, [aida, *_], _ = await new_game(env)
    await env.engine.start(state.id)
    await env.engine.answer(state.id, aida.id, 1)
    results = await asyncio.gather(*(env.engine.close_question(state.id, 0) for _ in range(4)))
    assert results.count(True) == 1
    await settle()
    assert len(of(host, "question.closed")) == 1
    score = (await env.repo.get_player(state.id, aida.id)).score
    assert await env.engine.close_question(state.id, 0) is False
    assert (await env.repo.get_player(state.id, aida.id)).score == score
    assert await env.engine.close_question(state.id, 7) is False  # a question that isn't open


# --- the whole game -------------------------------------------------------------------------


async def play_round(env, state, answers):
    """answers: [(player, position)]. Then the host steps through results and the leaderboard."""
    for player, position in answers:
        await env.engine.answer(state.id, player.id, position)
    if (await env.repo.get_game(state.id)).phase == "question":
        await env.engine.next(state.id)  # host closes early
    await env.engine.next(state.id)  # results -> leaderboard


async def test_full_game_to_the_podium_and_into_the_finished_record(env):
    state, host, [aida, bek, chol], feeds = await new_game(env)
    await env.engine.start(state.id)
    await play_round(env, state, [(aida, 1), (bek, 1), (chol, 1)])  # q1 right: all
    await env.engine.next(state.id)
    await play_round(env, state, [(aida, 2), (bek, 4)])  # q2 right: aida; cholpon times out below
    await env.engine.next(state.id)
    await play_round(env, state, [(aida, 3), (bek, 3), (chol, 3)])
    state_now = await env.repo.get_game(state.id)
    assert state_now.phase == "leaderboard" and state_now.round == 2
    assert not env.finished
    await env.engine.next(state.id)  # no more questions: the game ends
    await settle()

    assert (await env.repo.get_game(state.id)).phase == "ended"
    (fin,) = env.finished
    ranks = [(s["id"], s["rank"]) for s in fin.standings]
    assert ranks[0] == (aida.id, 1)  # right on all three
    assert set(fin.results) == {0, 1, 2} and fin.results[1].keys() == {aida.id, bek.id}
    assert [e["type"] for e in fin.audit][0] == "game.created" and fin.audit[-1]["type"] == "game.ended"

    ended = of(feeds[0], "game.ended")[0]
    assert ended["you"]["rank"] == 1 and len(ended["top"]) == 3
    assert [s["rank"] for s in of(host, "game.ended")[0]["standings"]] == [1, 2, 3]
    lb = of(feeds[2], "leaderboard")[0]
    assert len(lb["top"]) <= 5 and lb["you"]["id"] == chol.id
    assert [s["rank"] for s in of(host, "leaderboard")[-1]["standings"]] == [1, 2, 3]
    with pytest.raises(GameError) as e:
        await env.engine.next(state.id)
    assert e.value.code == "INVALID_STATE"


async def instant_game(env):
    """Four players who answer every question right, at once: the server flags all of them as too fast."""
    state, host, players, feeds = await new_game(env, players=("Aida", "Bek", "Cholpon", "Dana"))
    await env.engine.start(state.id)
    for right in (1, 2, 3):
        await play_round(env, state, [(player, right) for player in players])
        await env.engine.next(state.id)
    await settle()
    return state, host, players, feeds


async def test_the_podium_lists_the_players_the_pattern_rules_flagged(env):
    state, host, players, _ = await instant_game(env)
    ended = of(host, "game.ended")[0]
    assert {c["playerId"] for c in ended["cheaters"]} == {x.id for x in players}
    assert {f["kind"] for f in ended["cheaters"][0]["flags"]} >= {"FAST_ANSWERS"}
    snapshot = await env.engine.host_snapshot(state.id)
    assert len(snapshot.cheaters) == 4


async def test_host_rulings_change_the_score_the_podium_and_the_saved_game(env):
    state, host, (aida, bek, chol, dana), feeds = await instant_game(env)
    before = {s["id"]: s["score"] for s in of(host, "game.ended")[0]["standings"]}
    assert before[aida.id] > 0

    await env.engine.rule(state.id, aida.id, "zero")
    await env.engine.rule(state.id, bek.id, "void_last")
    await env.engine.rule(state.id, chol.id, "kick")
    await env.engine.rule(state.id, dana.id, "mercy")
    await settle()

    last = of(host, "game.ended")[-1]
    scores = {s["id"]: s["score"] for s in last["standings"]}
    assert scores[aida.id] == 0
    assert scores[bek.id] < before[bek.id]  # the last question no longer counts
    assert chol.id not in scores and scores[dana.id] == before[dana.id]
    assert last["cheaters"] == []  # every one of them has been ruled on
    assert of(feeds[2], "kicked")
    saved = env.finished[-1]
    assert chol.id not in {x.id for x in saved.players}
    assert {e["action"] for e in saved.audit if e["type"] == "player.ruled"} == {
        "zero",
        "void_last",
        "kick",
        "mercy",
    }


async def test_rulings_only_after_the_game_ended(env):
    state, _, (aida, *_), _ = await new_game(env)
    await env.engine.start(state.id)
    with pytest.raises(GameError) as e:
        await env.engine.rule(state.id, aida.id, "zero")
    assert e.value.code == "INVALID_STATE"


async def test_next_walks_question_results_leaderboard_in_order(env):
    state, *_ = await new_game(env, n=2)
    phases = []
    await env.engine.start(state.id)
    for _ in range(4):
        phases.append((await env.repo.get_game(state.id)).phase)
        await env.engine.next(state.id)
    phases.append((await env.repo.get_game(state.id)).phase)
    assert phases == ["question", "counts", "leaderboard", "question", "counts"]


async def test_ending_mid_question_scores_the_open_question_and_saves_the_game(env):
    state, _, [aida, bek, _], _ = await new_game(env)
    await env.engine.start(state.id)
    await env.engine.answer(state.id, aida.id, 1)
    await env.engine.end(state.id)
    (fin,) = env.finished
    assert fin.game.phase == "ended" and fin.results[0][aida.id]["points"] >= 500
    await env.engine.end(state.id)  # ending twice is harmless
    assert len(env.finished) == 1


async def test_ending_in_the_lobby_closes_it_and_saves_nothing(env):
    state, _, _, feeds = await new_game(env)
    await env.engine.end(state.id)
    await settle()
    assert of(feeds[0], "game.closed") and not env.finished
    assert (await env.repo.get_game(state.id)).phase == "ended"


def test_leaderboard_ties_go_to_the_faster_player_then_the_name():
    from app.game.models import PlayerState

    def pl(pid, name, score, time_ms):
        return PlayerState(id=pid, nickname=name, character={}, score=score, time_ms=time_ms)

    ranked = GameEngine._standings(
        [
            pl("1", "Zed", 900, 5000),
            pl("2", "Amy", 900, 3000),
            pl("3", "Bob", 900, 3000),
            pl("4", "Top", 1500, 9000),
        ]
    )
    assert [(s.nickname, s.rank) for s in ranked] == [("Top", 1), ("Amy", 2), ("Bob", 3), ("Zed", 4)]


# --- reconnecting ---------------------------------------------------------------------------


async def test_snapshots_bring_a_reconnecting_player_up_to_date_in_every_phase(env):
    state, host, [aida, bek, _], _ = await new_game(env)
    snap = await env.engine.player_snapshot(state.id, aida.id)
    assert snap.phase == "lobby" and len(snap.players) == 3 and snap.question is None

    await env.engine.start(state.id)
    await env.engine.answer(state.id, aida.id, 3)
    snap = await env.engine.player_snapshot(state.id, aida.id)
    assert snap.phase == "question" and snap.answered == 3 and 0 < snap.remaining_ms <= 20_000
    assert (await env.engine.player_snapshot(state.id, bek.id)).answered is None

    await env.engine.next(state.id)
    snap = await env.engine.player_snapshot(state.id, aida.id)
    assert snap.phase == "counts" and snap.reveal.correct == 1 and snap.reveal.points == 0
    assert snap.answered == 3  # what Aida tapped, so the results screen can say right or wrong
    assert (await env.engine.player_snapshot(state.id, bek.id)).answered is None  # Bek ran out of time
    hsnap = await env.engine.host_snapshot(state.id)
    assert hsnap.phase == "counts" and hsnap.correct == 1 and hsnap.counts == [0, 0, 1, 0]

    await env.engine.next(state.id)
    snap = await env.engine.player_snapshot(state.id, aida.id)
    assert snap.top is not None and snap.question.index == 1  # the leaderboard says «question 1 of 3»
    with pytest.raises(GameError):
        await env.engine.player_snapshot(state.id, "ghost")


# --- signals --------------------------------------------------------------------------------


async def test_signals_are_counted_only_during_play_and_capped(env):
    from app.game.state_repo import SIGNALS_MAX_PER_PLAYER

    state, _, [aida, *_], _ = await new_game(env)
    await env.engine.signal(state.id, aida.id, "TAB_BLUR")  # lobby: ignored
    assert await env.repo.signal_counts(state.id) == {}
    await env.engine.start(state.id)
    await env.engine.signal(state.id, aida.id, "TAB_BLUR")
    await env.engine.signal(state.id, aida.id, "TAB_BLUR")
    await env.engine.signal(state.id, aida.id, "PASTE")
    assert await env.repo.signal_counts(state.id) == {aida.id: {"TAB_BLUR": 2, "PASTE": 1}}
    for _ in range(SIGNALS_MAX_PER_PLAYER + 20):
        await env.engine.signal(state.id, aida.id, "TAB_BLUR")
    assert (await env.repo.signal_counts(state.id))[aida.id]["TAB_BLUR"] < SIGNALS_MAX_PER_PLAYER
    signals_in_audit = [e for e in await env.repo.get_audit(state.id) if e["type"] == "signal"]
    assert len(signals_in_audit) < SIGNALS_MAX_PER_PLAYER + 1  # spam does not flood the audit trail


# --- several app instances ------------------------------------------------------------------


async def test_events_reach_players_connected_to_another_instance(env):
    """Two hubs on one Redis stand in for two app instances: the host's instance publishes, the
    player's instance (a different Hub object with its own subscription) still delivers."""
    state = await env.engine.create_game("o", make_quiz())
    _, aida = await env.engine.join(state.pin, "Aida")
    other_instance = Hub(get_redis())
    events: list[dict] = []

    async def send(e):
        events.append(e)

    async def close():
        pass

    conn = Conn(role="player", send=send, close=close, player_id=aida.id)
    await other_instance.attach(state.id, conn)
    try:
        await env.engine.start(state.id)
        await settle()
        assert of(events, "question.started")
        await env.engine.answer(state.id, aida.id, 1)  # the only player: closes the question
        await settle()
        assert of(events, "question.closed")[0]["reveal"]["correct"] == 1
    finally:
        await other_instance.detach(state.id, conn)


# --- a stale «continue» ---------------------------------------------------------------------


async def test_a_continue_pressed_on_an_old_screen_is_ignored(env):
    state, *_ = await new_game(env, n=2)
    phase = lambda: env.repo.get_game(state.id)  # noqa: E731
    await env.engine.start(state.id)
    await env.engine.next(state.id, from_phase="question")  # closes the question
    assert (await phase()).phase == "counts"
    await env.engine.next(state.id, from_phase="question")  # a double click: still thinks it is on «question»
    assert (await phase()).phase == "counts"
    await env.engine.next(state.id, from_phase="counts")
    assert (await phase()).phase == "leaderboard"
    await env.engine.next(state.id, from_phase="counts")  # stale again
    assert (await phase()).phase == "leaderboard"
    await env.engine.next(state.id, from_phase="leaderboard")
    assert (await phase()).phase == "question" and (await phase()).round == 1


async def test_double_click_at_the_same_instant_moves_one_step_only(env):
    state, *_ = await new_game(env, n=3)
    await env.engine.start(state.id)
    await env.engine.next(state.id)  # results screen
    await asyncio.gather(*(env.engine.next(state.id, from_phase="counts") for _ in range(5)))
    assert (await env.repo.get_game(state.id)).phase == "leaderboard"
