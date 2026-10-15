import asyncio

from redis.asyncio import BlockingConnectionPool

from app.config import get_settings
from app.game import ratelimit
from app.redis import create_redis, get_redis


async def test_a_burst_bigger_than_the_pool_waits_instead_of_failing():
    # 2 connections, 60 requests at once: with redis-py's default pool most of these would raise
    # MaxConnectionsError (that is how 200 players joining at once got 500 errors).
    redis = create_redis(get_settings().redis_url, max_connections=2)
    try:
        results = await asyncio.gather(
            *(ratelimit.allow(redis, f"rl:burst:{i}", 5, 60) for i in range(60)), return_exceptions=True
        )
        assert results == [True] * 60
    finally:
        await redis.aclose()


def test_the_shared_client_uses_a_waiting_pool():
    assert isinstance(get_redis().connection_pool, BlockingConnectionPool)
    assert get_redis().connection_pool.max_connections == get_settings().redis_max_connections
