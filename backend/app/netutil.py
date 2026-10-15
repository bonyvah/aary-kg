import ipaddress

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
