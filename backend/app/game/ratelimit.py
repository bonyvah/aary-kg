import time

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


class LocalWindow:
    """The same fixed window, kept in memory for one connection: no Redis command per message.

    Enough for a player's messages because each player has exactly one socket, on one instance (a newer
    one replaces it), and reconnecting is limited per address in Redis. Pongs every few seconds would
    otherwise cost two Redis commands each for every connected player.
    """

    def __init__(self, limit: int, window_s: float) -> None:
        self.limit, self.window_s = limit, window_s
        self.started, self.count = time.monotonic(), 0

    def allow(self) -> bool:
        now = time.monotonic()
        if now - self.started >= self.window_s:
            self.started, self.count = now, 0
        self.count += 1
        return self.count <= self.limit
