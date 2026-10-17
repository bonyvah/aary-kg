"""What a game costs in Redis commands. Hosted Redis bills every command, MULTI and EXEC included."""

from collections import Counter

import pytest
from redis.asyncio.client import Pipeline, Redis

from tests.test_engine import env, new_game  # noqa: F401  (env is a fixture)


class Commands(Counter[str]):
    """Command name -> how many were sent, plus every command with its arguments in `sent`."""

    sent: list[tuple[str, ...]]


@pytest.fixture
def commands(monkeypatch):
    """Counts every command sent to Redis, by name, the way a per-command bill would."""
    counts = Commands()
    counts.sent = []
    send, run_pipeline = Redis.execute_command, Pipeline.execute

    async def execute_command(self, *args, **options):
        counts[str(args[0]).upper()] += 1
        counts.sent.append(tuple(map(str, args)))
        return await send(self, *args, **options)

    async def execute(self, raise_on_error=True):
        if self.is_transaction and self.command_stack:
            counts["MULTI"] += 1
            counts["EXEC"] += 1
        for cmd in self.command_stack:
            counts[str(cmd[0][0]).upper()] += 1
            counts.sent.append(tuple(map(str, cmd[0])))
        return await run_pipeline(self, raise_on_error)

    monkeypatch.setattr(Redis, "execute_command", execute_command)
    monkeypatch.setattr(Pipeline, "execute", execute)
    return counts


async def test_a_game_sends_no_multi_exec(env, commands):  # noqa: F811
    state, _, players, _ = await new_game(env)
    await env.engine.start(state.id)
    for player in players:
        await env.engine.answer(state.id, player.id, 1)
    await env.engine.signal(state.id, players[0].id, "TAB_BLUR")
    assert commands["MULTI"] == commands["EXEC"] == 0


async def test_an_audit_event_is_one_command_and_the_list_still_expires_and_stays_capped(
    env,  # noqa: F811
    commands,
    monkeypatch,
):
    from app.game import state_repo

    monkeypatch.setattr(state_repo, "AUDIT_MAX", 3)
    await env.repo.add_audit("cost-1", {"type": "first"})
    assert 0 < await env.repo.r.ttl("game:cost-1:audit") <= state_repo.TTL_S
    commands.clear()
    await env.repo.add_audit("cost-1", {"type": "second"})
    assert sum(commands.values()) == 1
    for n in range(5):
        await env.repo.add_audit("cost-1", {"type": f"more {n}"})
    assert [e["type"] for e in await env.repo.get_audit("cost-1")] == ["more 2", "more 3", "more 4"]
    await env.repo.r.delete("game:cost-1:audit")


async def test_audit_reuses_the_time_the_caller_already_read(env, commands):  # noqa: F811
    await env.engine.audit("cost-2", "x", at=123)
    assert commands["TIME"] == 0
    assert (await env.repo.get_audit("cost-2"))[0]["at"] == 123
    await env.repo.r.delete("game:cost-2:audit")


async def test_the_quiz_is_read_from_redis_once_per_game(env, commands):  # noqa: F811
    state, _, players, _ = await new_game(env, n=2)
    await env.engine.start(state.id)
    for player in players:
        await env.engine.answer(state.id, player.id, 1)
    quiz_reads = [c for c in commands.sent if c[0].upper() == "GET" and c[1] == f"game:{state.id}:quiz"]
    assert len(quiz_reads) == 1  # start reads it; three answers and the early close use the copy


async def test_the_quiz_cache_keeps_only_the_latest_games(env, monkeypatch):  # noqa: F811
    from app.game import state_repo

    monkeypatch.setattr(state_repo, "QUIZ_CACHE_MAX", 2)
    games = [await new_game(env, players=("Aida",)) for _ in range(3)]
    for state, *_ in games:
        await env.repo.get_quiz(state.id)
    assert list(env.repo._quizzes) == [games[1][0].id, games[2][0].id]
