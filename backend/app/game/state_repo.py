"""Game state lives in Redis behind this interface, so no handler touches Redis keys directly and
the storage can be swapped. Redis holds live state only: when a game ends it is written to Postgres.

Keys (all expire, see TTL_S):
  pin:{pin}              game id
  game:{id}              JSON GameState
  game:{id}:quiz         JSON quiz snapshot
  game:{id}:players      HASH player id -> JSON
  game:{id}:nicks        HASH nickname skeleton -> player id
  game:{id}:ans:{r}      HASH player id -> JSON, the first answer wins
  game:{id}:res:{r}      HASH player id -> JSON scored answer
  game:{id}:signals      HASH "player id:KIND" -> count
  game:{id}:audit        LIST of JSON events
  game:{id}:lock         transition lock
"""

import asyncio
import json
import secrets
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, Protocol

from redis.asyncio import Redis

from app.game.models import GameError, GameState, PlayerState

TTL_S = 12 * 3600  # a game that is never finished disappears after this
AUDIT_MAX = 5000
SIGNALS_MAX_PER_PLAYER = 200

_RELEASE = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"


class GameStateRepo(Protocol):
    async def now_ms(self) -> int: ...
    async def reserve_pin(self, game_id: str) -> str: ...
    async def game_id_for_pin(self, pin: str) -> str | None: ...
    async def create_game(self, state: GameState, quiz: dict[str, Any]) -> None: ...
    async def get_game(self, game_id: str) -> GameState | None: ...
    async def save_game(self, state: GameState) -> None: ...
    async def get_quiz(self, game_id: str) -> dict[str, Any]: ...
    async def add_player(self, game_id: str, player: PlayerState, nick_key: str) -> bool: ...
    async def get_player(self, game_id: str, player_id: str) -> PlayerState | None: ...
    async def get_players(self, game_id: str) -> list[PlayerState]: ...
    async def save_players(self, game_id: str, players: list[PlayerState]) -> None: ...
    async def remove_player(self, game_id: str, player_id: str, nick_key: str) -> None: ...
    async def player_count(self, game_id: str) -> int: ...
    async def put_answer(self, game_id: str, rnd: int, player_id: str, answer: dict[str, Any]) -> bool: ...
    async def get_answers(self, game_id: str, rnd: int) -> dict[str, dict[str, Any]]: ...
    async def answer_count(self, game_id: str, rnd: int) -> int: ...
    async def put_results(self, game_id: str, rnd: int, results: dict[str, dict[str, Any]]) -> None: ...
    async def get_results(self, game_id: str, rnd: int) -> dict[str, dict[str, Any]]: ...
    async def add_signal(self, game_id: str, player_id: str, kind: str) -> bool: ...
    async def signal_counts(self, game_id: str) -> dict[str, dict[str, int]]: ...
    async def add_audit(self, game_id: str, event: dict[str, Any]) -> None: ...
    async def get_audit(self, game_id: str) -> list[dict[str, Any]]: ...
    def lock(self, game_id: str) -> "asynccontextmanager[None]": ...  # type: ignore[valid-type]


class RedisGameStateRepo:
    def __init__(self, redis: Redis) -> None:
        self.r = redis

    # --- clock: Redis' own, so every app instance agrees on "now" ---
    async def now_ms(self) -> int:
        seconds, micros = await self.r.time()
        return int(seconds) * 1000 + int(micros) // 1000

    # --- game ---
    async def reserve_pin(self, game_id: str) -> str:
        for _ in range(50):
            pin = f"{secrets.randbelow(10**6):06d}"
            if pin != "000000" and await self.r.set(f"pin:{pin}", game_id, nx=True, ex=TTL_S):
                return pin
        raise GameError("NO_FREE_PIN")

    async def game_id_for_pin(self, pin: str) -> str | None:
        return await self.r.get(f"pin:{pin}")

    async def create_game(self, state: GameState, quiz: dict[str, Any]) -> None:
        pipe = self.r.pipeline()
        pipe.set(f"game:{state.id}", json.dumps(state.dump()), ex=TTL_S)
        pipe.set(f"game:{state.id}:quiz", json.dumps(quiz), ex=TTL_S)
        await pipe.execute()

    async def get_game(self, game_id: str) -> GameState | None:
        raw = await self.r.get(f"game:{game_id}")
        return GameState.load(json.loads(raw)) if raw else None

    async def save_game(self, state: GameState) -> None:
        await self.r.set(f"game:{state.id}", json.dumps(state.dump()), ex=TTL_S)

    async def get_quiz(self, game_id: str) -> dict[str, Any]:
        raw = await self.r.get(f"game:{game_id}:quiz")
        if raw is None:
            raise GameError("GAME_NOT_FOUND")
        return json.loads(raw)

    # --- players ---
    async def add_player(self, game_id: str, player: PlayerState, nick_key: str) -> bool:
        """False when the nickname is taken. HSETNX makes two joins with one name safe."""
        nicks = f"game:{game_id}:nicks"
        if not await self.r.hsetnx(nicks, nick_key, player.id):
            return False
        pipe = self.r.pipeline()
        pipe.hset(f"game:{game_id}:players", player.id, json.dumps(player.dump()))
        pipe.expire(nicks, TTL_S)
        pipe.expire(f"game:{game_id}:players", TTL_S)
        await pipe.execute()
        return True

    async def get_player(self, game_id: str, player_id: str) -> PlayerState | None:
        raw = await self.r.hget(f"game:{game_id}:players", player_id)
        return PlayerState.load(json.loads(raw)) if raw else None

    async def get_players(self, game_id: str) -> list[PlayerState]:
        raw = await self.r.hgetall(f"game:{game_id}:players")
        return [PlayerState.load(json.loads(v)) for v in raw.values()]

    async def save_players(self, game_id: str, players: list[PlayerState]) -> None:
        if players:
            await self.r.hset(
                f"game:{game_id}:players", mapping={p.id: json.dumps(p.dump()) for p in players}
            )

    async def remove_player(self, game_id: str, player_id: str, nick_key: str) -> None:
        pipe = self.r.pipeline()
        pipe.hdel(f"game:{game_id}:players", player_id)
        pipe.hdel(f"game:{game_id}:nicks", nick_key)
        await pipe.execute()

    async def player_count(self, game_id: str) -> int:
        return int(await self.r.hlen(f"game:{game_id}:players"))

    # --- answers ---
    async def put_answer(self, game_id: str, rnd: int, player_id: str, answer: dict[str, Any]) -> bool:
        key = f"game:{game_id}:ans:{rnd}"
        stored = await self.r.hsetnx(key, player_id, json.dumps(answer))
        if stored:
            await self.r.expire(key, TTL_S)
        return bool(stored)

    async def get_answers(self, game_id: str, rnd: int) -> dict[str, dict[str, Any]]:
        raw = await self.r.hgetall(f"game:{game_id}:ans:{rnd}")
        return {pid: json.loads(v) for pid, v in raw.items()}

    async def answer_count(self, game_id: str, rnd: int) -> int:
        return int(await self.r.hlen(f"game:{game_id}:ans:{rnd}"))

    async def put_results(self, game_id: str, rnd: int, results: dict[str, dict[str, Any]]) -> None:
        if not results:
            return
        key = f"game:{game_id}:res:{rnd}"
        pipe = self.r.pipeline()
        pipe.hset(key, mapping={pid: json.dumps(v) for pid, v in results.items()})
        pipe.expire(key, TTL_S)
        await pipe.execute()

    async def get_results(self, game_id: str, rnd: int) -> dict[str, dict[str, Any]]:
        raw = await self.r.hgetall(f"game:{game_id}:res:{rnd}")
        return {pid: json.loads(v) for pid, v in raw.items()}

    # --- signals and audit ---
    async def add_signal(self, game_id: str, player_id: str, kind: str) -> bool:
        """Counts a browser signal. Returns False once a player hit the cap (spam)."""
        key = f"game:{game_id}:signals"
        total = int(await self.r.hincrby(key, f"{player_id}:total", 1))
        if total > SIGNALS_MAX_PER_PLAYER:
            return False
        pipe = self.r.pipeline()
        pipe.hincrby(key, f"{player_id}:{kind}", 1)
        pipe.expire(key, TTL_S)
        await pipe.execute()
        return True

    async def signal_counts(self, game_id: str) -> dict[str, dict[str, int]]:
        raw = await self.r.hgetall(f"game:{game_id}:signals")
        out: dict[str, dict[str, int]] = {}
        for field_, value in raw.items():
            pid, kind = field_.rsplit(":", 1)
            if kind != "total":
                out.setdefault(pid, {})[kind] = int(value)
        return out

    async def add_audit(self, game_id: str, event: dict[str, Any]) -> None:
        key = f"game:{game_id}:audit"
        pipe = self.r.pipeline()
        pipe.rpush(key, json.dumps(event))
        pipe.ltrim(key, -AUDIT_MAX, -1)
        pipe.expire(key, TTL_S)
        await pipe.execute()

    async def get_audit(self, game_id: str) -> list[dict[str, Any]]:
        return [json.loads(x) for x in await self.r.lrange(f"game:{game_id}:audit", 0, -1)]

    # --- lock: transitions (start, close, next, end) run one at a time per game, on any instance ---
    @asynccontextmanager
    async def lock(self, game_id: str, wait_s: float = 5.0) -> AsyncIterator[None]:
        key = f"game:{game_id}:lock"
        token = uuid.uuid4().hex
        give_up = time.monotonic() + wait_s
        while not await self.r.set(key, token, nx=True, px=10_000):
            if time.monotonic() > give_up:
                raise GameError("BUSY")
            await asyncio.sleep(0.02)
        try:
            yield
        finally:
            await self.r.eval(_RELEASE, 1, key, token)  # type: ignore[misc]
