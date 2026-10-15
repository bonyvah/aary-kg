from redis.asyncio import BlockingConnectionPool, Redis

from app.config import get_settings

_client: Redis | None = None


def create_redis(url: str, max_connections: int) -> Redis:
    """A client whose pool makes a request WAIT when every connection is busy.

    redis-py's default pool refuses instantly ("Too many connections") once 100 are in use, which
    turned a burst of 200 players joining at once into 500 errors. Waiting up to 10 seconds smooths
    such bursts out: each request only holds a connection for a millisecond or two.
    """
    pool = BlockingConnectionPool.from_url(
        url, max_connections=max_connections, timeout=10, decode_responses=True
    )
    return Redis(connection_pool=pool)


def get_redis() -> Redis:
    """One shared client. Strings in, strings out."""
    global _client
    if _client is None:
        s = get_settings()
        _client = create_redis(s.redis_url, s.redis_max_connections)
    return _client
