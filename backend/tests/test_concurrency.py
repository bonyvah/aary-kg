"""Things happening at the same instant: the engine must score and close exactly once."""

import asyncio

from app.game.models import GameError
from tests.test_engine import connect, env, new_game, of, settle  # noqa: F401  (env is a fixture)


async def test_fifty_players_answer_at_the_same_instant(env):  # noqa: F811
    names = [f"Player{i:02d}" for i in range(50)]
    state, host, players, feeds = await new_game(env, players=names, n=2)
    await env.engine.start(state.id)

    # even players tap 1 (right for question 1), odd players tap 2 (wrong)
    results = await asyncio.gather(
        *(env.engine.answer(state.id, p.id, 1 if i % 2 == 0 else 2) for i, p in enumerate(players)),
        return_exceptions=True,
    )
    # The 50th answer closes the question. An answer still arriving at that moment may be told
    # «closed» even though it was stored and counted: that is the only error allowed.
    errors = [r for r in results if isinstance(r, Exception)]
    assert all(isinstance(e, GameError) and e.code == "ANSWER_CLOSED" for e in errors), errors

    assert (await env.repo.get_game(state.id)).phase == "counts"
    scored = await env.repo.get_results(state.id, 0)
    assert len(scored) == 50  # every answer stored before the close was counted
    await settle()
    assert len(of(host, "question.closed")) == 1  # closed once, not once per answer
    assert of(host, "question.closed")[0]["counts"] == [25, 25, 0, 0]

    now = {p.id: p for p in await env.repo.get_players(state.id)}
    for i, (p, feed) in enumerate(zip(players, feeds, strict=True)):
        (closed,) = of(feed, "question.closed")  # exactly one reveal per player
        assert closed["reveal"]["correct"] == 1
        if i % 2 == 0:
            assert 500 <= closed["reveal"]["points"] <= 1000
        else:
            assert closed["reveal"]["points"] == 0
        assert now[p.id].score == closed["reveal"]["points"]  # scored once, not twice
    ranks = sorted(c["rank"] for feed in feeds for c in of(feed, "question.closed"))
    assert ranks == list(range(1, 51))  # a strict order: no shared or missing ranks


async def test_the_timer_the_host_and_an_early_close_racing_score_the_question_once(env):  # noqa: F811
    state, host, [aida, bek, _], feeds = await new_game(env, seconds=1)
    await env.engine.start(state.id)
    await env.engine.answer(state.id, aida.id, 1)
    await asyncio.sleep(1.3)  # right at the deadline: the timer fires 0.1 s later
    await asyncio.gather(
        env.engine.close_question(state.id, 0),
        env.engine.next(state.id, from_phase="question"),
        env.engine.close_question(state.id, 0),
        env.engine.next(state.id, from_phase="question"),
    )
    await asyncio.sleep(0.6)  # the timer has fired by now too
    assert (await env.repo.get_game(state.id)).phase == "counts"  # not pushed on by the stale presses
    await settle()
    assert len(of(host, "question.closed")) == 1
    assert len(of(feeds[0], "question.closed")) == 1
    score = (await env.repo.get_player(state.id, aida.id)).score
    assert 500 <= score <= 1000  # one award, not two
    assert (await env.repo.get_player(state.id, bek.id)).score == 0


async def test_joining_while_the_game_starts_loses_nobody(env):  # noqa: F811
    state = await env.engine.create_game(
        "owner",
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "title": "T",
            "questions": [
                {"id": "q1", "text": "Q?", "answers": ["a", "b", "c", "d"], "correct": 1, "seconds": 20}
            ],
        },
    )
    _, first = await env.engine.join(state.pin, "First")

    async def join(i):
        try:
            return await env.engine.join(state.pin, f"Late{i:02d}")
        except GameError as e:
            return e

    results = await asyncio.gather(env.engine.start(state.id), *(join(i) for i in range(30)))
    joined = [r for r in results[1:] if not isinstance(r, GameError)]
    refused = [r for r in results[1:] if isinstance(r, GameError)]
    assert not refused  # a running game can be joined: nobody is turned away by the start
    players = await env.repo.get_players(state.id)
    assert len(players) == 1 + len(joined)  # everyone who got in is in the game, nobody twice
    assert len({p.id for p in players}) == len(players)
    assert first.id in {p.id for p in players}
    assert (await env.repo.get_game(state.id)).phase == "question"


async def test_fifty_players_join_at_once_with_unique_names(env):  # noqa: F811
    state = await env.engine.create_game(
        "o",
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "title": "T",
            "questions": [
                {"id": "q1", "text": "Q?", "answers": ["a", "b", "c", "d"], "correct": 1, "seconds": 20}
            ],
        },
    )
    results = await asyncio.gather(
        *(env.engine.join(state.pin, f"Player{i:02d}") for i in range(50)), return_exceptions=True
    )
    assert not [r for r in results if isinstance(r, Exception)]
    assert await env.repo.player_count(state.id) == 50
    assert len({p.id for _, p in results}) == 50
