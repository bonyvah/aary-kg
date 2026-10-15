from redis.asyncio import Redis


async def allow(redis: Redis, key: str, limit: int, window_s: int) -> bool:
    """Fixed window counter: at most `limit` calls per `window_s` seconds for this key.

    SET NX EX then INCR in one round trip, so the key always has an expiry (no counter can get stuck).
    """
    pipe = redis.pipeline()
    pipe.set(key, 0, ex=window_s, nx=True)
    pipe.incr(key)
    _, count = await pipe.execute()
    return int(count) <= limit
