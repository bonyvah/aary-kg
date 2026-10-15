import ipaddress
from urllib.parse import urlparse

from starlette.requests import HTTPConnection

from app.config import get_settings


def client_ip(conn: HTTPConnection) -> str:
    """Who is really calling: the connecting address, or, behind trusted proxies, the one they saw.

    Rate limits and the audit trail depend on this. A client can send any X-Forwarded-For it likes,
    so the header counts only when AARY_TRUSTED_PROXY_HOPS says how many proxies are in front:
    each of them appended the address it saw, so the client is that many entries from the right.
    """
    peer = conn.client.host if conn.client else "unknown"
    hops = get_settings().trusted_proxy_hops
    if hops <= 0:
        return peer
    entries = [e.strip() for e in conn.headers.get("x-forwarded-for", "").split(",") if e.strip()]
    if len(entries) < hops:
        return peer  # the proxy did not add the header: fall back to who connected
    candidate = entries[-hops]
    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return peer  # not an address (garbage or a hostname): never use it as a rate limit key


def origin_allowed(conn: HTTPConnection) -> bool:
    """May this page open a game WebSocket? Browsers always send an Origin on a WebSocket, and a
    page on another site would send its own: refusing those stops cross-site hijacking of a
    logged-in host's cookie. Clients that are not browsers send none, and have no cookie to abuse.

    Allowed: no Origin, an origin listed in AARY_ALLOWED_ORIGINS, or (when nothing is listed) the
    site's own host. Behind a proxy that rewrites the Host header, list the public origin.
    """
    origin = conn.headers.get("origin")
    if origin is None:
        return True
    listed = get_settings().allowed_origin_list
    if listed:
        return origin.rstrip("/").lower() in listed
    return urlparse(origin).netloc.lower() == conn.headers.get("host", "").lower()
