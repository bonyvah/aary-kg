"""End to end over real WebSockets: a live server in this process, a host and players connected."""

import asyncio
import json

import pytest
import uvicorn
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

from app.main import app
from app.redis import get_redis
from app.routers import ws as ws_module


@pytest.fixture
async def server():
    # proxy_headers=False is how the app is run for real (see app/netutil.py): the tests must match.
    config = uvicorn.Config(
        app, host="127.0.0.1", port=0, log_level="warning", lifespan="off", proxy_headers=False
    )
    srv = uvicorn.Server(config)
    task = asyncio.create_task(srv.serve())
    while not srv.started:
        await asyncio.sleep(0.01)
    port = srv.servers[0].sockets[0].getsockname()[1]
    yield f"ws://127.0.0.1:{port}"
    srv.should_exit = True
    await task


class Peer:
    """A WebSocket client that keeps everything it receives."""

    def __init__(self, ws):
        self.ws = ws
        self.events: list[dict] = []
        self.closed = None  # set to the close code once the connection is over
        self._reader = asyncio.create_task(self._read())

    async def _read(self):
        try:
            async for raw in self.ws:
                self.events.append(json.loads(raw))
        except ConnectionClosed:
            pass
        self.closed = self.ws.close_code or 1006

    async def send(self, **message):
        await self.ws.send(json.dumps({"v": 1, **message}))

    async def raw(self, text):
        await self.ws.send(text)

    async def wait(self, type_, count=1, timeout=4):
        """The `count`-th event of this type (waits for it)."""
        end = asyncio.get_running_loop().time() + timeout
        while asyncio.get_running_loop().time() < end:
            found = [e for e in self.events if e["type"] == type_]
            if len(found) >= count:
                return found[count - 1]
            await asyncio.sleep(0.01)
        raise AssertionError(f"no {type_!r} #{count} in {[e['type'] for e in self.events]}")

    async def wait_first(self, timeout=4):
        """Waits until the server has sent anything, or closed the connection."""
        end = asyncio.get_running_loop().time() + timeout
        while not self.events and self.closed is None and asyncio.get_running_loop().time() < end:
            await asyncio.sleep(0.01)

    async def wait_closed(self, timeout=4):
        end = asyncio.get_running_loop().time() + timeout
        while self.closed is None and asyncio.get_running_loop().time() < end:
            await asyncio.sleep(0.01)
        assert self.closed is not None, "connection is still open"
        return self.closed

    def types(self):
        return [e["type"] for e in self.events]

    async def close(self):
        await self.ws.close()
        await self._reader


class Room:
    def __init__(self, base, client, game, host_client):
        self.base, self.client, self.game, self.host_client = base, client, game, host_client
        self.peers: list[Peer] = []

    async def ticket(self, staff=None, game_id=None):
        r = await (staff or self.host_client).post(f"/games/{game_id or self.game['gameId']}/host-ticket")
        return r

    async def host(self, ticket=None, headers=None, game_id=None):
        if ticket is None:
            r = await self.ticket()
            assert r.status_code == 200, r.text
            ticket = r.json()["ticket"]
        url = f"{self.base}/ws/host/{game_id or self.game['gameId']}"
        peer = Peer(await connect(url, additional_headers=headers or {}))
        self.peers.append(peer)
        try:
            await peer.send(type="hello", token=ticket)
        except ConnectionClosed:
            pass  # refused before the hello (a foreign page): the close code tells why
        # The server has attached this screen once it sends its snapshot (or closes it). Until then
        # an event published right away, like a player joining, could be missed.
        await peer.wait_first()
        return peer

    async def join(self, nickname):
        r = await self.client.post("/games/join", json={"pin": self.game["pin"], "nickname": nickname})
        assert r.status_code == 200, r.text
        return r.json()

    async def play(self, token, hello=True):
        peer = Peer(await connect(f"{self.base}/ws/play"))
        self.peers.append(peer)
        if hello:
            await peer.send(type="hello", token=token)
        return peer


@pytest.fixture
async def room(server, client, as_user):
    host_client, _ = await as_user("host1")
    quiz = {
        "title": "Geography",
        "questions": [
            {
                "id": f"q{i}",
                "text": f"Question {i}?",
                "answers": ["a", "b", "c", "d"],
                "correct": i,  # q1 -> 1, q2 -> 2
                "seconds": 20,
            }
            for i in (1, 2)
        ],
    }
    quiz_id = (await host_client.post("/quizzes", json=quiz)).json()["id"]
    game = (await host_client.post("/games", json={"quizId": quiz_id})).json()
    r = Room(server, client, game, host_client)
    r.quiz_id = quiz_id
    yield r
    for peer in r.peers:
        try:
            await peer.close()
        except Exception:
            pass


# --- a whole game ---------------------------------------------------------------------------


async def test_a_whole_game_over_sockets(room):
    host = await room.host()
    assert (await host.wait("host.state"))["phase"] == "lobby"
    a, b = await room.join("Aida"), await room.join("Bek")
    pa, pb = await room.play(a["token"]), await room.play(b["token"])
    snap = await pa.wait("state")
    assert snap["phase"] == "lobby" and snap["you"]["nickname"] == "Aida" and snap["v"] == 1
    assert len((await host.wait("lobby.updated", count=2))["players"]) == 2

    await host.send(type="start")
    q = await pa.wait("question.started")
    assert q["question"] == {
        "index": 1,
        "total": 2,
        "text": "Question 1?",
        "seconds": 20,
        "positions": [1, 2, 3, 4],
    }
    hq = await host.wait("question.started")
    assert hq["question"]["answers"] == ["a", "b", "c", "d"]

    await pa.send(type="answer", position=1)
    assert (await pa.wait("answer.accepted"))["position"] == 1
    assert (await host.wait("answer.count"))["answered"] == 1
    await pb.send(type="answer", position=3)
    closed = await pa.wait("question.closed")  # both answered: closes by itself
    assert closed["reveal"]["correct"] == 1 and closed["reveal"]["points"] > 900 and closed["rank"] == 1
    assert (await pb.wait("question.closed"))["reveal"]["points"] == 0
    hc = await host.wait("question.closed")
    assert hc["counts"] == [1, 0, 1, 0] and hc["correct"] == 1

    await host.send(type="next")  # leaderboard
    lb = await pb.wait("leaderboard")
    assert [s["nickname"] for s in lb["top"]] == ["Aida", "Bek"] and lb["you"]["rank"] == 2
    assert [s["rank"] for s in (await host.wait("leaderboard"))["standings"]] == [1, 2]
    await host.send(type="next")  # question 2
    assert (await pa.wait("question.started", count=2))["question"]["index"] == 2
    await pa.send(type="answer", position=2)
    await pb.send(type="answer", position=2)
    await pa.wait("question.closed", count=2)
    await host.send(type="next")  # leaderboard
    await host.send(type="next")  # the end
    end = await pa.wait("game.ended")
    assert end["you"]["rank"] == 1 and [s["nickname"] for s in end["top"]] == ["Aida", "Bek"]
    final = await host.wait("game.ended")
    assert final["standings"][0]["nickname"] == "Aida"

    # the saved report is there for the host
    await asyncio.sleep(0.2)
    report = (await room.host_client.get(f"/games/{final['gameId']}/report")).json()
    assert [p["nickname"] for p in report["players"]] == ["Aida", "Bek"]


# --- who may connect ---------------------------------------------------------------------------


async def test_only_the_owner_gets_a_host_ticket(room, client, as_user):
    assert (await room.ticket(staff=client)).status_code == 401  # not signed in
    stranger, _ = await as_user("stranger")
    admin, _ = await as_user("root", role="admin")  # an admin can't run somebody's game either
    for staff in (stranger, admin):
        r = await room.ticket(staff=staff)
        assert (r.status_code, r.json()["code"]) == (404, "GAME_NOT_FOUND")
    r = await room.ticket(game_id="ffffffffffffffffffffffffffffffff")
    assert (r.status_code, r.json()["code"]) == (404, "GAME_NOT_FOUND")


async def test_host_socket_needs_a_ticket_for_this_game(room):
    nobody = await room.host(ticket="nope")
    assert await nobody.wait_closed() == 4401
    token = (await room.join("Aida"))["token"]  # a player token is not a host ticket
    assert await (await room.host(ticket=token)).wait_closed() == 4401
    session = room.host_client.cookies["aary_token"]  # nor is the session token itself
    assert await (await room.host(ticket=session)).wait_closed() == 4401
    # a ticket for this game does not open another one
    ticket = (await room.ticket()).json()["ticket"]
    other = await room.host(ticket=ticket, game_id="ffffffffffffffffffffffffffffffff")
    assert await other.wait_closed() == 4401


async def test_host_socket_without_a_hello_is_closed(room):
    peer = Peer(await connect(f"{room.base}/ws/host/{room.game['gameId']}"))
    room.peers.append(peer)
    await peer.send(type="start")  # not a hello
    assert await peer.wait_closed() == 4400


async def test_an_expired_host_ticket_is_refused(room, monkeypatch):
    from datetime import timedelta

    from app import security

    monkeypatch.setattr(security, "HOST_TICKET_TTL", timedelta(seconds=-1))
    ticket = (await room.ticket()).json()["ticket"]
    assert await (await room.host(ticket=ticket)).wait_closed() == 4401


async def test_player_socket_rejects_bad_hello(room):
    junk = await room.play("not-a-token")
    assert await junk.wait_closed() == 4401
    silent = await room.play("", hello=False)
    await silent.raw("not json")
    assert await silent.wait_closed() == 4400
    wrong_first = await room.play("", hello=False)
    await wrong_first.send(type="answer", position=1)  # must say hello first
    assert await wrong_first.wait_closed() == 4400


async def test_player_socket_gives_up_on_a_silent_client(room, monkeypatch):
    monkeypatch.setattr(ws_module, "HELLO_TIMEOUT_S", 0.3)
    silent = await room.play("", hello=False)
    assert await silent.wait_closed() == 4400


async def test_a_token_for_a_removed_player_is_refused(room):
    host = await room.host()
    a = await room.join("Aida")
    await host.wait("host.state")
    await host.send(type="kick", playerId=a["player"]["id"])
    await host.wait("lobby.updated", count=1)
    again = await room.play(a["token"])
    assert await again.wait_closed() == 4403


# --- one connection per player, reconnecting ----------------------------------------------------


async def test_a_second_connection_replaces_the_first(room):
    a = await room.join("Aida")
    first = await room.play(a["token"])
    await first.wait("state")
    second = await room.play(a["token"])
    await second.wait("state")
    await first.wait("replaced")
    assert await first.wait_closed() is not None
    assert "replaced" not in second.types()
    # the new connection works, the old one is gone
    host = await room.host()
    await host.send(type="start")
    await second.wait("question.started")
    assert "question.started" not in first.types()


async def test_reconnecting_mid_question_restores_the_state(room):
    host = await room.host()
    a, b = await room.join("Aida"), await room.join("Bek")
    pa, _pb = await room.play(a["token"]), await room.play(b["token"])
    await pa.wait("state")
    await host.send(type="start")
    await pa.wait("question.started")
    await pa.send(type="answer", position=2)
    await pa.wait("answer.accepted")
    await pa.close()  # drops
    back = await room.play(a["token"])
    snap = await back.wait("state")
    assert snap["phase"] == "question" and snap["answered"] == 2
    assert snap["question"]["text"] == "Question 1?" and 0 < snap["remainingMs"] <= 20_000
    assert "correct" not in json.dumps(snap)
    # still can't answer twice after reconnecting
    await back.send(type="answer", position=1)
    assert (await back.wait("error"))["code"] == "ALREADY_ANSWERED"


# --- misuse ---------------------------------------------------------------------------------


async def test_bad_messages_get_an_error_and_the_socket_stays_open(room):
    a = await room.join("Aida")
    pa = await room.play(a["token"])
    await pa.wait("state")
    await pa.raw("not json")
    await pa.raw(json.dumps({"v": 1, "type": "answer", "position": 5}))  # no such shape
    await pa.raw(json.dumps({"v": 2, "type": "answer", "position": 1}))  # wrong version
    await pa.raw(json.dumps({"v": 1, "type": "start"}))  # a host command
    await pa.raw(json.dumps({"v": 1, "type": "answer", "position": 1, "ms": 5}))  # extra key is just ignored
    await asyncio.sleep(0.3)
    codes = [e["code"] for e in pa.events if e["type"] == "error"]
    assert codes[:4] == ["BAD_MESSAGE"] * 4
    assert codes[4] == "ANSWER_CLOSED"  # the last one was well-formed but the game hasn't started
    assert pa.closed is None


async def test_a_player_cannot_use_host_commands(room):
    host = await room.host()
    a = await room.join("Aida")
    pa = await room.play(a["token"])
    await pa.wait("state")
    await pa.send(type="start")
    await pa.send(type="next")
    await pa.send(type="kick", playerId=a["player"]["id"])
    await asyncio.sleep(0.2)
    assert "question.started" not in host.types()
    assert [e["code"] for e in pa.events if e["type"] == "error"] == ["BAD_MESSAGE"] * 3


async def test_a_host_cannot_answer_and_bad_host_messages_are_errors(room):
    host = await room.host()
    await host.wait("host.state")
    await host.send(type="answer", position=1)
    await host.send(type="nonsense")
    await host.send(type="next")  # nothing to move on from
    await host.wait("error", count=3)
    assert [e["code"] for e in host.events if e["type"] == "error"] == [
        "BAD_MESSAGE",
        "BAD_MESSAGE",
        "INVALID_STATE",
    ]
    await host.send(type="start")  # nobody joined yet
    assert (await host.wait("error", count=4))["code"] == "NO_PLAYERS"


async def test_oversized_messages_close_the_connection(room):
    a = await room.join("Aida")
    pa = await room.play(a["token"])
    await pa.wait("state")
    await pa.raw(json.dumps({"v": 1, "type": "signal", "kind": "PASTE", "pad": "x" * 5000}))
    assert await pa.wait_closed() == 1009


async def test_message_flood_is_rate_limited(room, monkeypatch):
    monkeypatch.setattr(ws_module, "MESSAGE_LIMIT", 5)
    a = await room.join("Aida")
    pa = await room.play(a["token"])
    await pa.wait("state")
    for _ in range(12):
        await pa.send(type="signal", kind="TAB_BLUR")
    await pa.wait("error")
    assert {e["code"] for e in pa.events if e["type"] == "error"} == {"RATE_LIMITED"}


async def test_player_messages_are_counted_without_redis(room):
    # Pongs every 5 seconds from every player: counting them in Redis cost 2 commands each.
    a = await room.join("Aida")
    pa = await room.play(a["token"])
    await pa.wait("state")
    await pa.send(type="signal", kind="TAB_BLUR")
    await pa.send(type="pong", n=1)
    await pa.send(type="bogus")
    await pa.wait("error")
    assert await get_redis().keys("rl:msg:*") == []


async def test_too_many_connections_from_one_address(room, monkeypatch):
    monkeypatch.setattr(ws_module, "CONNECT_LIMIT", 3)
    peers = [await room.play("x", hello=False) for _ in range(5)]
    codes = [await p.wait_closed() for p in peers[3:]]
    assert codes == [4429, 4429]


# --- kicking, signals, latency -------------------------------------------------------------------


async def test_kicking_a_player_closes_their_socket(room):
    host = await room.host()
    a, b = await room.join("Aida"), await room.join("Bek")
    pa, pb = await room.play(a["token"]), await room.play(b["token"])
    await pa.wait("state")
    await host.send(type="kick", playerId=a["player"]["id"])
    await pa.wait("kicked")
    assert await pa.wait_closed() is not None
    assert pb.closed is None
    await host.send(type="kick", playerId="nobody")  # unknown id: no error, no crash
    names = [p["nickname"] for p in (await host.wait("lobby.updated", count=3))["players"]]
    assert names == ["Bek"]


async def test_browser_signals_reach_the_report_as_flags(room):
    host = await room.host()
    a = await room.join("Aida")
    pa = await room.play(a["token"])
    await pa.wait("state")
    await pa.send(type="signal", kind="TAB_BLUR")  # lobby: ignored
    await host.send(type="start")
    await pa.wait("question.started")
    await pa.send(type="signal", kind="TAB_BLUR")
    await pa.send(type="signal", kind="TAB_BLUR")
    await pa.send(type="signal", kind="PASTE")
    await pa.send(type="signal", kind="DEVTOOLS")  # not a kind we know: refused
    await asyncio.sleep(0.2)
    await host.send(type="end")
    final = await host.wait("game.ended")
    await asyncio.sleep(0.2)
    report = (await room.host_client.get(f"/games/{final['gameId']}/report")).json()
    assert report["players"][0]["flags"] == [{"kind": "TAB_BLUR", "count": 2}, {"kind": "PASTE", "count": 1}]
    assert [e["code"] for e in pa.events if e["type"] == "error"] == ["BAD_MESSAGE"]


async def test_the_server_pings_and_a_pong_sets_the_latency(room):
    a = await room.join("Aida")
    pa = await room.play(a["token"])
    ping = await pa.wait("ping")
    await asyncio.sleep(0.05)
    await pa.send(type="pong", n=ping["n"])
    await pa.send(type="pong", n=999)  # an answer to a ping we never sent: ignored
    await asyncio.sleep(0.1)
    assert pa.closed is None
    assert "error" not in pa.types()


async def test_the_clients_own_time_is_ignored(room):
    host = await room.host()
    a = await room.join("Aida")
    pa = await room.play(a["token"])
    await pa.wait("state")
    await host.send(type="start")
    await pa.wait("question.started")
    await asyncio.sleep(0.15)
    # claims to have answered instantly: the server never reads these fields
    await pa.raw(json.dumps({"v": 1, "type": "answer", "position": 1, "ms": 0, "at": 0, "time": 0}))
    closed = await pa.wait("question.closed")
    answers_ms = await ws_module.get_engine().repo.get_answers(room.game["gameId"], 0)
    assert answers_ms[a["player"]["id"]]["ms"] >= 100
    assert closed["reveal"]["points"] < 1000


async def test_hosting_from_two_screens_keeps_the_newest(room):
    first = await room.host()
    await first.wait("host.state")
    second = await room.host()
    await second.wait("host.state")
    await first.wait("replaced")
    assert await first.wait_closed() is not None
    assert "replaced" not in second.types()


async def test_a_double_click_on_continue_moves_the_game_one_step(room):
    host = await room.host()
    pa = await room.play((await room.join("Aida"))["token"])
    await pa.wait("state")
    await host.send(type="start")
    await host.wait("question.started")
    await host.send(type="next", fromPhase="question")  # closes the question
    await host.send(type="next", fromPhase="question")  # the same press again: out of date
    await host.wait("question.closed")
    await asyncio.sleep(0.3)
    assert "leaderboard" not in host.types()  # it did not run on to the leaderboard
    await host.send(type="next", fromPhase="counts")
    await host.send(type="next", fromPhase="counts")
    await host.wait("leaderboard")
    await asyncio.sleep(0.3)
    assert host.types().count("question.started") == 1  # and not on to question 2
