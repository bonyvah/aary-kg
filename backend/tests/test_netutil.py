from types import SimpleNamespace

import pytest
from starlette.requests import Request

from app import netutil


def request(forwarded=None, peer="9.9.9.9"):
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded is not None else []
    return Request({"type": "http", "headers": headers, "client": (peer, 1234)})


@pytest.fixture
def hops(monkeypatch):
    def set_hops(n):
        monkeypatch.setattr(netutil, "get_settings", lambda: SimpleNamespace(trusted_proxy_hops=n))

    return set_hops


def test_without_trusted_proxies_the_header_is_ignored(hops):
    hops(0)
    assert netutil.client_ip(request("1.1.1.1")) == "9.9.9.9"
    assert netutil.client_ip(request()) == "9.9.9.9"


def test_one_trusted_proxy_the_last_entry_is_the_client(hops):
    hops(1)
    assert netutil.client_ip(request("5.5.5.5")) == "5.5.5.5"
    # a client that sends its own header cannot choose its address: the proxy appends the real one
    assert netutil.client_ip(request("6.6.6.6, 5.5.5.5")) == "5.5.5.5"


def test_two_trusted_proxies_count_from_the_right(hops):
    hops(2)
    assert netutil.client_ip(request("7.7.7.7, 5.5.5.5, 10.0.0.2")) == "5.5.5.5"


def test_missing_or_garbage_header_falls_back_to_the_peer(hops):
    hops(1)
    assert netutil.client_ip(request()) == "9.9.9.9"
    assert netutil.client_ip(request("")) == "9.9.9.9"
    assert netutil.client_ip(request("not-an-ip")) == "9.9.9.9"
    hops(3)
    assert netutil.client_ip(request("1.1.1.1")) == "9.9.9.9"  # fewer entries than proxies


def test_ipv6_is_normalised(hops):
    hops(1)
    assert netutil.client_ip(request("2001:DB8:0:0:0:0:0:1")) == "2001:db8::1"


def test_no_client_at_all():
    scope = {"type": "http", "headers": [], "client": None}
    assert netutil.client_ip(Request(scope)) == "unknown"


async def test_rate_limits_follow_the_forwarded_client_only_when_trusted(client, hops):
    # 62 PIN checks from one proxy address, each claiming to be a different client
    async def run():
        codes = []
        for i in range(62):
            r = await client.get("/games/pin/999999", headers={"X-Forwarded-For": f"8.8.8.{i}"})
            codes.append(r.status_code)
        return codes

    hops(0)  # spoofing the header does not escape the limit
    assert 429 in await run()
    from app.redis import get_redis

    await get_redis().flushdb()
    hops(1)  # behind a trusted proxy every real client has their own bucket
    assert 429 not in await run()
