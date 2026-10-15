"""Only the site's own pages (or listed origins) may open a game socket in a browser."""

import contextlib
from types import SimpleNamespace

import pytest
from starlette.websockets import WebSocket
from websockets.exceptions import ConnectionClosed

from app import netutil
from tests.test_ws import Peer, connect, room, server  # noqa: F401  (fixtures)


def conn(origin=None, host="aary.kg"):
    headers = [(b"host", host.encode())]
    if origin is not None:
        headers.append((b"origin", origin.encode()))
    return WebSocket({"type": "websocket", "headers": headers, "client": ("1.2.3.4", 1)}, None, None)  # type: ignore[arg-type]


@pytest.fixture
def allowed(monkeypatch):
    def set_allowed(value):
        monkeypatch.setattr(
            netutil, "get_settings", lambda: SimpleNamespace(allowed_origin_list=value, trusted_proxy_hops=0)
        )

    return set_allowed


def test_no_origin_means_not_a_browser_and_is_allowed(allowed):
    allowed([])
    assert netutil.origin_allowed(conn())


def test_same_site_is_allowed_when_nothing_is_listed(allowed):
    allowed([])
    assert netutil.origin_allowed(conn("https://aary.kg"))
    assert netutil.origin_allowed(conn("https://AARY.kg"))
    assert not netutil.origin_allowed(conn("https://evil.example"))
    assert not netutil.origin_allowed(conn("https://aary.kg.evil.example"))
    assert not netutil.origin_allowed(conn("null"))  # sandboxed iframes and files send "null"


def test_a_list_replaces_the_same_host_rule(allowed):
    allowed(["http://localhost:3000"])
    assert netutil.origin_allowed(conn("http://localhost:3000", host="localhost:8000"))
    assert netutil.origin_allowed(conn("http://localhost:3000/", host="localhost:8000"))
    assert not netutil.origin_allowed(conn("https://aary.kg", host="aary.kg"))


async def test_a_foreign_page_cannot_open_either_socket(room, monkeypatch):  # noqa: F811
    monkeypatch.setattr(
        netutil,
        "get_settings",
        lambda: SimpleNamespace(allowed_origin_list=["https://aary.kg"], trusted_proxy_hops=0),
    )
    a = await room.join("Aida")

    host = Peer(
        await connect(
            f"{room.base}/ws/host/{room.game['gameId']}",
            additional_headers={"Cookie": f"aary_token={room.host_cookie}", "Origin": "https://evil.example"},
        )
    )
    player = Peer(
        await connect(f"{room.base}/ws/play", additional_headers={"Origin": "https://evil.example"})
    )
    room.peers += [host, player]
    with contextlib.suppress(ConnectionClosed):  # the server may already have hung up
        await player.send(type="hello", token=a["token"])
    assert await host.wait_closed() == 4403
    assert await player.wait_closed() == 4403

    ok = Peer(
        await connect(
            f"{room.base}/ws/host/{room.game['gameId']}",
            additional_headers={"Cookie": f"aary_token={room.host_cookie}", "Origin": "https://aary.kg"},
        )
    )
    room.peers.append(ok)
    assert (await ok.wait("host.state"))["pin"] == room.game["pin"]
