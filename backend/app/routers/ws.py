"""The two WebSocket endpoints. They only move messages: every rule lives in game/engine.py."""

import asyncio
import json
import logging
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.db import SessionLocal
from app.game import protocol as p
from app.game import ratelimit
from app.game.hub import Conn
from app.game.models import GameError
from app.game.runtime import get_engine, get_hub
from app.netutil import client_ip, origin_allowed
from app.redis import get_redis
from app.security import decode_player_token
from app.services.auth import user_from_host_ticket

log = logging.getLogger(__name__)
router = APIRouter()

MAX_MESSAGE_BYTES = 2048
HELLO_TIMEOUT_S = 5
PING_EVERY_S = 5
# Per connection attempts per IP (in Redis), and per player messages (in memory, per socket).
# Generous: a classroom behind one address may reconnect all at once.
CONNECT_LIMIT, CONNECT_WINDOW_S = 600, 60
MESSAGE_LIMIT, MESSAGE_WINDOW_S = 100, 10

# Close codes (4000-4999 are ours)
BAD_MESSAGE, UNAUTHENTICATED, FORBIDDEN, RATE_LIMITED = 4400, 4401, 4403, 4429


def _make_conn(ws: WebSocket, role: str, player_id: str | None = None) -> Conn:
    send_lock = asyncio.Lock()  # one writer at a time: hub events and replies come from different tasks

    async def send(event: dict[str, Any]) -> None:
        async with send_lock:
            await ws.send_json(event)

    async def close() -> None:
        try:
            await ws.close()
        except RuntimeError:
            pass  # already closed

    return Conn(role=role, send=send, close=close, player_id=player_id)  # type: ignore[arg-type]


async def _read(ws: WebSocket) -> Any | None:
    """The next message as JSON, or None when it is too big or not JSON (the caller ignores it)."""
    text = await ws.receive_text()
    if len(text.encode()) > MAX_MESSAGE_BYTES:
        await ws.close(code=1009)
        raise WebSocketDisconnect(1009)
    try:
        return json.loads(text)
    except ValueError:
        return None


async def _refuse(ws: WebSocket) -> int | None:
    """Close code if this connection must not go on: a foreign page, or too many connections."""
    if not origin_allowed(ws):
        return FORBIDDEN
    if not await ratelimit.allow(get_redis(), f"rl:ws:{client_ip(ws)}", CONNECT_LIMIT, CONNECT_WINDOW_S):
        return RATE_LIMITED
    return None


# --- host ---------------------------------------------------------------------------------------


@router.websocket("/ws/host/{game_id}")
async def host_socket(ws: WebSocket, game_id: str) -> None:
    await ws.accept()
    if (refused := await _refuse(ws)) is not None:
        return await ws.close(code=refused)

    # First message: {type: "hello", token: <ticket from POST /games/{id}/host-ticket>}. Not the session
    # cookie: when the web app is on another site than the backend, the browser does not send it here.
    try:
        first = p.parse_player(await asyncio.wait_for(_read(ws), HELLO_TIMEOUT_S))
    except (TimeoutError, WebSocketDisconnect):
        return await ws.close(code=BAD_MESSAGE)
    if not isinstance(first, p.Hello):
        return await ws.close(code=BAD_MESSAGE)
    async with SessionLocal() as session:
        user = await user_from_host_ticket(session, first.token, game_id)
    if user is None:
        return await ws.close(code=UNAUTHENTICATED)

    engine, hub = get_engine(), get_hub()
    state = await engine.repo.get_game(game_id)
    if state is None or state.owner_id != str(user.id):
        return await ws.close(code=FORBIDDEN)  # same answer for «no such game» and «not yours»

    conn = _make_conn(ws, "host")
    await hub.attach(game_id, conn)
    try:
        # One host screen at a time: a newer one replaces this one, like a player's second tab.
        await hub.publish(game_id, "host", p.dump(p.Replaced()), exclude=conn.id)
        await conn.send(p.dump(await engine.host_snapshot(game_id)))
        await engine.audit(game_id, "host.connected", user=str(user.id))
        while True:
            data = await _read(ws)
            message = p.parse_host(data)
            if message is None:
                await conn.send(p.dump(p.ErrorEvent(code="BAD_MESSAGE")))
                continue
            try:
                match message:
                    case p.Start():
                        await engine.start(game_id)
                    case p.Next():
                        await engine.next(game_id, message.from_phase)
                    case p.Kick():
                        await engine.kick(game_id, message.player_id)
                    case p.End():
                        await engine.end(game_id)
                    case p.Rule():
                        await engine.rule(game_id, message.player_id, message.action)
                    case p.Settings():
                        await engine.settings(
                            game_id, show_answers=message.show_answers, scoring=message.scoring
                        )
            except GameError as e:
                await conn.send(p.dump(p.ErrorEvent(code=e.code)))
    except WebSocketDisconnect:
        pass
    finally:
        await hub.detach(game_id, conn)


# --- players ------------------------------------------------------------------------------------


@router.websocket("/ws/play")
async def player_socket(ws: WebSocket) -> None:
    await ws.accept()
    if (refused := await _refuse(ws)) is not None:
        return await ws.close(code=refused)

    # The token is the first message, not part of the URL: URLs end up in logs.
    try:
        first = p.parse_player(await asyncio.wait_for(_read(ws), HELLO_TIMEOUT_S))
    except (TimeoutError, WebSocketDisconnect):
        return await ws.close(code=BAD_MESSAGE)
    if not isinstance(first, p.Hello):
        return await ws.close(code=BAD_MESSAGE)
    ids = decode_player_token(first.token)
    if ids is None:
        return await ws.close(code=UNAUTHENTICATED)
    game_id, player_id = ids

    engine, hub = get_engine(), get_hub()
    try:
        snapshot = await engine.player_snapshot(game_id, player_id)
    except GameError:  # the game is gone, or the host kicked this player
        return await ws.close(code=FORBIDDEN)

    conn = _make_conn(ws, "player", player_id)
    await hub.attach(game_id, conn)
    await engine.repo.player_connected(game_id, player_id, 1)
    pings: dict[int, float] = {}
    messages = ratelimit.LocalWindow(MESSAGE_LIMIT, MESSAGE_WINDOW_S)

    async def pinger() -> None:
        n = 0
        while True:
            n += 1
            pings[n] = time.monotonic()
            await conn.send(p.dump(p.Ping(n=n)))
            await asyncio.sleep(PING_EVERY_S)

    ping_task = asyncio.create_task(pinger())
    try:
        # One connection per player: this one replaces any other, on this instance or another.
        await hub.publish(game_id, f"p:{player_id}", p.dump(p.Replaced()), exclude=conn.id)
        await conn.send(p.dump(snapshot))
        await engine.audit(game_id, "player.connected", player=player_id)
        while True:
            data = await _read(ws)
            if not messages.allow():
                await conn.send(p.dump(p.ErrorEvent(code="RATE_LIMITED")))
                continue
            message = p.parse_player(data)
            try:
                match message:
                    case p.Answer():
                        # The client sends no time. The server uses its own clock and the measured delay.
                        await engine.answer(game_id, player_id, message.position, conn.latency_ms)
                        await conn.send(p.dump(p.AnswerAccepted(position=message.position)))
                    case p.Signal():
                        await engine.signal(game_id, player_id, message.kind)
                    case p.SetCharacter():
                        await engine.set_character(game_id, player_id, message.character)
                    case p.Pong():
                        sent = pings.pop(message.n, None)
                        if sent is not None:
                            one_way = int((time.monotonic() - sent) * 500)  # half the round trip, ms
                            conn.latency_ms = (
                                one_way if conn.latency_ms == 0 else (conn.latency_ms * 3 + one_way) // 4
                            )
                    case _:  # None, or a message that is not for a player after hello
                        await conn.send(p.dump(p.ErrorEvent(code="BAD_MESSAGE")))
            except GameError as e:
                await conn.send(p.dump(p.ErrorEvent(code=e.code)))
    except WebSocketDisconnect:
        pass
    finally:
        ping_task.cancel()
        await hub.detach(game_id, conn)
        try:
            await engine.repo.player_connected(game_id, player_id, -1)
            await engine.audit(game_id, "player.disconnected", player=player_id)
        except Exception:
            log.debug("audit after disconnect failed", exc_info=True)
