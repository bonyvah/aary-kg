"""Fan-out of game events to WebSocket connections, across app instances.

Every event goes through a Redis pub/sub channel per game (`game:{id}:ev`). Each instance keeps one
subscription per game that has connections on it and hands the event to the matching local
connections. So a player on instance B sees what the host on instance A caused.
"""

import asyncio
import json
import logging
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Literal

from redis.asyncio import Redis
from redis.asyncio.client import PubSub

log = logging.getLogger(__name__)

Audience = str  # "all", "host", "players" or "p:<player id>"


@dataclass(eq=False)
class Conn:
    role: Literal["host", "player"]
    send: Callable[[dict[str, Any]], Awaitable[None]]
    close: Callable[[], Awaitable[None]]
    player_id: str | None = None
    id: str = field(default_factory=lambda: uuid.uuid4().hex)
    # Estimated one-way delay to this client in ms, from ping/pong. Used to compensate answer times.
    latency_ms: int = 0

    def wants(self, audience: Audience) -> bool:
        if audience == "all":
            return True
        if audience == "host":
            return self.role == "host"
        if audience == "players":
            return self.role == "player"
        return audience == f"p:{self.player_id}"


@dataclass
class _Sub:
    pubsub: PubSub
    task: asyncio.Task[None] | None = None
    conns: set[Conn] = field(default_factory=set)


def channel(game_id: str) -> str:
    return f"game:{game_id}:ev"


class Hub:
    def __init__(self, redis: Redis) -> None:
        self.r = redis
        self._subs: dict[str, _Sub] = {}
        self._lock = asyncio.Lock()

    async def attach(self, game_id: str, conn: Conn) -> None:
        async with self._lock:
            sub = self._subs.get(game_id)
            if sub is None:
                pubsub = self.r.pubsub()
                await pubsub.subscribe(channel(game_id))
                # Wait for the server to confirm, or an event published right after could be missed.
                await pubsub.get_message(timeout=2)
                sub = _Sub(pubsub)
                sub.task = asyncio.create_task(self._reader(game_id, sub))
                self._subs[game_id] = sub
            sub.conns.add(conn)

    async def detach(self, game_id: str, conn: Conn) -> None:
        async with self._lock:
            sub = self._subs.get(game_id)
            if sub is None:
                return
            sub.conns.discard(conn)
            if not sub.conns:
                del self._subs[game_id]
                if sub.task:
                    sub.task.cancel()
                await sub.pubsub.unsubscribe(channel(game_id))
                await sub.pubsub.aclose()

    async def publish(
        self, game_id: str, audience: Audience, event: dict[str, Any], exclude: str | None = None
    ) -> None:
        payload = json.dumps({"aud": audience, "ev": event, "x": exclude})
        await self.r.publish(channel(game_id), payload)

    def local_connections(self, game_id: str) -> int:
        sub = self._subs.get(game_id)
        return len(sub.conns) if sub else 0

    async def _reader(self, game_id: str, sub: _Sub) -> None:
        try:
            async for message in sub.pubsub.listen():
                if message.get("type") != "message":
                    continue
                try:
                    data = json.loads(message["data"])
                except (ValueError, TypeError):
                    continue
                await self._deliver(sub, data)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("hub reader for game %s stopped", game_id)

    async def _deliver(self, sub: _Sub, data: dict[str, Any]) -> None:
        audience, event, exclude = data["aud"], data["ev"], data.get("x")
        for conn in list(sub.conns):
            if conn.id == exclude or not conn.wants(audience):
                continue
            try:
                await conn.send(event)
                if event.get("type") in ("kicked", "replaced"):
                    await conn.close()
            except Exception:
                sub.conns.discard(conn)  # a dead socket must not stop delivery to the others
