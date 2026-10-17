"""What a game costs in Redis commands. Hosted Redis bills every command, MULTI and EXEC included."""

from collections import Counter

import pytest
from redis.asyncio.client import Pipeline, Redis

from tests.test_engine import env, new_game  # noqa: F401  (env is a fixture)


@pytest.fixture
def commands(monkeypatch):
    """Counts every command sent to Redis, by name, the way a per-command bill would."""
    counts: Counter[str] = Counter()
    send, run_pipeline = Redis.execute_command, Pipeline.execute

    async def execute_command(self, *args, **options):
        counts[str(args[0]).upper()] += 1
        return await send(self, *args, **options)

    async def execute(self, raise_on_error=True):
        if self.is_transaction and self.command_stack:
            counts["MULTI"] += 1
            counts["EXEC"] += 1
        for cmd in self.command_stack:
            counts[str(cmd[0][0]).upper()] += 1
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
